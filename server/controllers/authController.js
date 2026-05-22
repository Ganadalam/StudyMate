'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../models/db');

const SECRET          = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production')
    console.warn('[WARN] JWT_SECRET 환경변수가 설정되지 않았습니다. 프로덕션에서는 반드시 설정하세요.');
  return 'studymate_dev_secret_change_in_prod';
})();
const REFRESH_SECRET  = process.env.JWT_REFRESH_SECRET || SECRET + '_refresh';
const ACCESS_EXPIRES  = process.env.JWT_EXPIRES        || '15m';   // ← 짧게 변경
const REFRESH_DAYS    = parseInt(process.env.REFRESH_DAYS || '30', 10);
const USERNAME_RE     = /^[a-zA-Z0-9_]{3,20}$/;

/* ── 토큰 생성 헬퍼 ─────────────────────── */
function makeAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, team: user.team || '' },
    SECRET, { expiresIn: ACCESS_EXPIRES }
  );
}

function makeRefreshToken(userId) {
  const raw     = crypto.randomBytes(48).toString('hex');
  const expires = new Date(Date.now() + REFRESH_DAYS * 86400 * 1000);
  /* DB 저장 */
  db.prepare(`INSERT INTO refresh_tokens(user_id, token, expires_at) VALUES(?,?,?)`)
    .run(userId, raw, expires.toISOString());
  return raw;
}

function revokeRefreshToken(token) {
  db.prepare('DELETE FROM refresh_tokens WHERE token=?').run(token);
}

function cleanExpiredTokens() {
  db.prepare(`DELETE FROM refresh_tokens WHERE expires_at < datetime('now')`).run();
}

/* ── 로그인 ─────────────────────────────── */
exports.login = (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

  cleanExpiredTokens();
  const accessToken  = makeAccessToken(user);
  const refreshToken = makeRefreshToken(user.id);

  res.json({
    token:        accessToken,
    refreshToken,
    role:         user.role,
    username:     user.username,
    team:         user.team || '',
    expiresIn:    ACCESS_EXPIRES,
  });
};

/* ── 회원가입 ───────────────────────────── */
exports.register = (req, res) => {
  const { username, password, team } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  if (!USERNAME_RE.test(username.trim()))
    return res.status(400).json({ error: '아이디는 3~20자 영문·숫자·_만 사용 가능합니다.' });
  if (password.length < 6)
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username.trim());
  if (exists) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });

  const hash    = bcrypt.hashSync(password, 12);
  const info    = db.prepare('INSERT INTO users(username,password,role,team) VALUES(?,?,?,?)')
    .run(username.trim(), hash, 'user', (team || '').trim());
  const newUser = { id: info.lastInsertRowid, username: username.trim(), role: 'user', team: (team||'').trim() };

  const accessToken  = makeAccessToken(newUser);
  const refreshToken = makeRefreshToken(newUser.id);

  res.status(201).json({
    token:        accessToken,
    refreshToken,
    role:         'user',
    username:     newUser.username,
    team:         newUser.team,
    expiresIn:    ACCESS_EXPIRES,
  });
};

/* ── 토큰 갱신 (/api/auth/refresh) ─────── */
exports.refresh = (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ error: 'refreshToken이 필요합니다.' });

  const row = db.prepare(`
    SELECT rt.*, u.id as uid, u.username, u.role, u.team
    FROM refresh_tokens rt JOIN users u ON rt.user_id=u.id
    WHERE rt.token=? AND rt.expires_at > datetime('now')
  `).get(refreshToken);

  if (!row) return res.status(401).json({ error: 'Refresh token이 만료됐거나 유효하지 않습니다. 다시 로그인하세요.' });

  /* Rotate: 기존 토큰 삭제 → 새 발급 */
  revokeRefreshToken(refreshToken);
  const newAccess  = makeAccessToken({ id: row.uid, username: row.username, role: row.role, team: row.team });
  const newRefresh = makeRefreshToken(row.uid);

  res.json({ token: newAccess, refreshToken: newRefresh, expiresIn: ACCESS_EXPIRES });
};

/* ── 로그아웃 (/api/auth/logout) ────────── */
exports.logout = (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) revokeRefreshToken(refreshToken);
  res.json({ message: '로그아웃됐습니다.' });
};

/* ── 내 정보 ────────────────────────────── */
exports.me = (req, res) => {
  const user = db.prepare('SELECT id,username,role,team,display_name,email,created_at FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  res.json(user);
};

/* ── 프로필 업데이트 ────────────────────── */
exports.updateProfile = (req, res) => {
  const { team, display_name, currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  const updates = [], params = [];
  if (team         !== undefined) { updates.push('team=?');         params.push((team||'').trim()); }
  if (display_name !== undefined) { updates.push('display_name=?'); params.push((display_name||'').trim()); }
  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: '현재 비밀번호를 입력해주세요.' });
    if (!bcrypt.compareSync(currentPassword, user.password))
      return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다.' });
    updates.push('password=?'); params.push(bcrypt.hashSync(newPassword, 12));
  }
  if (!updates.length) return res.status(400).json({ error: '변경할 정보가 없습니다.' });
  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...params);
  const updated = db.prepare('SELECT id,username,role,team,display_name FROM users WHERE id=?').get(req.user.id);
  res.json({ message: '프로필이 업데이트됐습니다.', token: makeAccessToken(updated), team: updated.team, display_name: updated.display_name });
};

/* ── JWT 검증 미들웨어 ──────────────────── */
exports.verify = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: '인증이 필요합니다.' });
  try {
    req.user = jwt.verify(auth.slice(7), SECRET);
    next();
  } catch (e) {
    const msg = e.name === 'TokenExpiredError'
      ? '액세스 토큰이 만료됐습니다. 토큰을 갱신하세요.'
      : '유효하지 않은 토큰입니다.';
    res.status(401).json({ error: msg, code: e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID' });
  }
};

exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  next();
};
