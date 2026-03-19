'use strict';
const bcrypt = require('bcryptjs');
const db = require('../models/db');

/* 전체 사용자 목록 (admin) */
exports.list = (req, res) => {
  const users = db.prepare(
    'SELECT id, username, role, team, display_name, email, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(users);
};

/* 사용자 정보 수정 (admin) */
exports.update = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  const { team, role, display_name, email } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  if (role && !['user','admin'].includes(role)) return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
  // 본인 admin 권한 제거 방지
  if (id === req.user.id && role && role !== 'admin')
    return res.status(400).json({ error: '본인의 관리자 권한은 변경할 수 없습니다.' });
  const updates=[], params=[];
  if (team         !== undefined) { updates.push('team=?');         params.push((team||'').trim()); }
  if (role         !== undefined) { updates.push('role=?');         params.push(role); }
  if (display_name !== undefined) { updates.push('display_name=?'); params.push((display_name||'').trim()); }
  if (email        !== undefined) { updates.push('email=?');        params.push((email||'').trim()); }
  if (!updates.length) return res.status(400).json({ error: '변경할 내용이 없습니다.' });
  params.push(id);
  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...params);
  res.json({ message: '사용자 정보가 업데이트됐습니다.' });
};

/* 비밀번호 초기화 (admin) */
exports.resetPassword = (req, res) => {
  const id  = parseInt(req.params.id, 10);
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  const user = db.prepare('SELECT id FROM users WHERE id=?').get(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(newPassword, 12), id);
  res.json({ message: '비밀번호가 초기화됐습니다.' });
};

/* 사용자 삭제 (admin) */
exports.remove = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다.' });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  if (user.role === 'admin') return res.status(400).json({ error: '관리자 계정은 삭제할 수 없습니다.' });
  // 예약은 남기되 user soft-delete (username에 [삭제됨] 표시)
  db.prepare("UPDATE users SET username=?, team='', display_name='[탈퇴]' WHERE id=?")
    .run(`__deleted_${id}`, id);
  res.json({ message: '사용자가 삭제됐습니다.' });
};

/* 통계 요약 (admin) */
exports.stats = (req, res) => {
  const total  = db.prepare("SELECT COUNT(*) as c FROM users WHERE username NOT LIKE '__deleted_%'").get().c;
  const byTeam = db.prepare("SELECT team, COUNT(*) as count FROM users WHERE team!='' AND username NOT LIKE '__deleted_%' GROUP BY team ORDER BY count DESC").all();
  const active = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM reservations WHERE status='confirmed' AND date >= date('now','-30 days')").get().c;
  res.json({ total, byTeam, active30d: active });
};

/* CSV 내보내기 (admin) */
exports.exportCSV = (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, u.username, u.display_name, u.team, r.room_name, r.date,
           r.start_time, r.end_time, r.headcount, r.purpose, r.status, r.created_at
    FROM reservations r JOIN users u ON r.user_id=u.id
    ORDER BY r.date DESC, r.start_time DESC
  `).all();
  const header = '예약ID,아이디,이름,팀,룸,날짜,시작,종료,인원,목적,상태,등록일\n';
  const esc    = v => `"${String(v||'').replace(/"/g,'""')}"`;
  const csv    = header + rows.map(r =>
    [r.id,r.username,r.display_name,r.team,r.room_name,r.date,r.start_time,r.end_time,r.headcount,r.purpose,r.status,r.created_at]
    .map(esc).join(',')
  ).join('\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="reservations.csv"');
  res.send('\uFEFF' + csv); // BOM for Excel
};
