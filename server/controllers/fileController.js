'use strict';
const path = require('path');
const fs   = require('fs');
const db   = require('../models/db');

const UPLOAD_DIR    = path.join(__dirname, '../uploads');
const ALLOWED_SCOPES= new Set(['private','team','public']);
const LINK_TYPES    = new Set(['notion','gdocs','figma','github','youtube','general']);

const FILE_ICONS = {
  pdf:'📄', ppt:'📊', pptx:'📊', doc:'📝', docx:'📝',
  xls:'📗', xlsx:'📗', zip:'🗜️', jpg:'🖼️', jpeg:'🖼️',
  png:'🖼️', gif:'🖼️', hwp:'📃', txt:'📋', md:'📋',
};
function fileIcon(ext) {
  return FILE_ICONS[ext.replace('.','').toLowerCase()] || '📁';
}

/* ── 권한 체크 ───────────────────────────── */
function canAccess(file, user) {
  if (file.scope === 'public')       return true;
  if (file.user_id === user.id)      return true;
  if (user.role   === 'admin')       return true;
  if (file.scope  === 'team') {
    const uploader = db.prepare('SELECT team FROM users WHERE id=?').get(file.user_id);
    return !!(uploader && uploader.team && uploader.team === user.team);
  }
  return false;
}

function canAccessLink(link, user) {
  if (link.scope === 'public')  return true;
  if (link.user_id === user.id) return true;
  if (user.role === 'admin')    return true;
  if (link.scope === 'team') {
    const up = db.prepare('SELECT team FROM users WHERE id=?').get(link.user_id);
    return !!(up && up.team && up.team === user.team);
  }
  return false;
}

/* ── 예약별 파일 목록 ─────────────────────── */
exports.listByReservation = (req, res) => {
  const resId = parseInt(req.params.resId, 10);
  const resv  = db.prepare('SELECT id FROM reservations WHERE id=?').get(resId);
  if (!resv) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });

  const files = db.prepare(`
    SELECT f.*, u.username, u.display_name, u.team
    FROM files f JOIN users u ON f.user_id=u.id
    WHERE f.reservation_id=? ORDER BY f.created_at DESC
  `).all(resId).filter(f => canAccess(f, req.user))
    .map(f => ({ ...f, icon: fileIcon('.'+f.file_type) }));

  const links = db.prepare(`
    SELECT l.*, u.username, u.display_name, u.team
    FROM file_links l JOIN users u ON l.user_id=u.id
    WHERE l.reservation_id=? ORDER BY l.created_at DESC
  `).all(resId).filter(l => canAccessLink(l, req.user));

  res.json({ files, links });
};

/* ── 팀 자료함 ───────────────────────────── */
exports.teamFiles = (req, res) => {
  const { page=1, limit=24, q, type, scope } = req.query;
  const lim    = Math.min(parseInt(limit,10)||24, 100);
  const offset = (Math.max(parseInt(page,10),1)-1)*lim;
  const team   = req.user.team || '';
  const uid    = req.user.id;
  const isAdmin = req.user.role === 'admin';

  const conds  = [];
  const params = [];

  // scope 필터
  if (scope === 'public') {
    conds.push("f.scope='public'");
  } else if (scope === 'team') {
    conds.push("(f.scope='team' AND u.team=?)"); params.push(team);
  } else if (scope === 'private') {
    conds.push('f.user_id=?'); params.push(uid);
  } else {
    // 전체: 접근 가능한 것 모두
    if (isAdmin) {
      // admin은 모든 파일 볼 수 있음
      conds.push('1=1');
    } else {
      conds.push("(f.scope='public' OR (f.scope='team' AND u.team=?) OR f.user_id=?)");
      params.push(team, uid);
    }
  }

  if (q)    { conds.push('(f.title LIKE ? OR f.description LIKE ? OR f.tags LIKE ?)'); const ql=`%${q}%`; params.push(ql,ql,ql); }
  if (type) { conds.push('f.file_type=?'); params.push(type); }

  const where = 'WHERE ' + (conds.length ? conds.join(' AND ') : '1=1');

  const total = db.prepare(`SELECT COUNT(*) as c FROM files f JOIN users u ON f.user_id=u.id LEFT JOIN reservations r ON f.reservation_id=r.id ${where}`).get(...params).c;
  const rows  = db.prepare(`
    SELECT f.*, u.username, u.display_name, u.team,
           COALESCE(r.date,'') as date, COALESCE(r.room_name,'') as room_name,
           COALESCE(r.purpose,'') as purpose
    FROM files f JOIN users u ON f.user_id=u.id
    LEFT JOIN reservations r ON f.reservation_id=r.id
    ${where}
    ORDER BY f.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset).map(f => ({ ...f, icon: fileIcon('.'+f.file_type) }));

  res.json({ files: rows, total, page: parseInt(page,10), limit: lim });
};

/* ── 통합 검색 ───────────────────────────── */
exports.search = (req, res) => {
  const { q='', date_from, date_to, team, file_type, room } = req.query;
  if (!q && !date_from && !date_to && !team)
    return res.status(400).json({ error: '검색어 또는 날짜를 입력해주세요.' });

  const uid      = req.user.id;
  const userTeam = req.user.team || '';
  const isAdmin  = req.user.role === 'admin';

  /* 파일 검색 */
  const fConds  = [];
  const fParams = [];

  if (!isAdmin) {
    fConds.push("(f.scope='public' OR f.user_id=? OR (f.scope='team' AND u.team=?))");
    fParams.push(uid, userTeam);
  }
  if (q)         { fConds.push('(f.title LIKE ? OR f.description LIKE ? OR f.tags LIKE ? OR r.purpose LIKE ?)'); const ql=`%${q}%`; fParams.push(ql,ql,ql,ql); }
  if (date_from) { fConds.push('r.date >= ?');      fParams.push(date_from); }
  if (date_to)   { fConds.push('r.date <= ?');      fParams.push(date_to); }
  if (team)      { fConds.push('u.team=?');         fParams.push(team); }
  if (file_type) { fConds.push('f.file_type=?');   fParams.push(file_type); }
  if (room)      { fConds.push('r.room_name=?');    fParams.push(room); }

  const fWhere = fConds.length ? 'WHERE '+fConds.join(' AND ') : '';

  const files = db.prepare(`
    SELECT f.*, u.username, u.display_name, u.team,
      r.date, r.room_name, r.purpose, r.id as res_id
    FROM files f JOIN users u ON f.user_id=u.id
    JOIN reservations r ON f.reservation_id=r.id
    ${fWhere}
    ORDER BY r.date DESC, f.created_at DESC LIMIT 50
  `).all(...fParams).map(f => ({ ...f, icon: fileIcon('.'+f.file_type), _type: 'file' }));

  /* 세션 검색 */
  const rConds  = [];
  const rParams = [];

  if (!isAdmin) {
    rConds.push('(r.user_id=? OR u.team=?)');
    rParams.push(uid, userTeam);
  }
  if (q)         { rConds.push('(r.purpose LIKE ? OR sn.content LIKE ?)'); const ql=`%${q}%`; rParams.push(ql,ql); }
  if (date_from) { rConds.push('r.date >= ?');   rParams.push(date_from); }
  if (date_to)   { rConds.push('r.date <= ?');   rParams.push(date_to); }
  if (room)      { rConds.push('r.room_name=?'); rParams.push(room); }

  const rWhere = rConds.length ? 'WHERE '+rConds.join(' AND ') : '';

  const sessions = db.prepare(`
    SELECT r.id, r.room_name, r.date, r.start_time, r.end_time,
      r.headcount, r.purpose, r.status,
      u.username, u.display_name, u.team,
      sn.content as note,
      COUNT(f.id) as file_count
    FROM reservations r
    JOIN users u ON r.user_id=u.id
    LEFT JOIN session_notes sn ON sn.reservation_id=r.id
    LEFT JOIN files f ON f.reservation_id=r.id
    ${rWhere}
    GROUP BY r.id
    ORDER BY r.date DESC LIMIT 30
  `).all(...rParams).map(s => ({ ...s, _type: 'session' }));

  /* 링크 검색 */
  const lConds  = [];
  const lParams = [];

  if (!isAdmin) {
    lConds.push("(l.scope='public' OR l.user_id=? OR (l.scope='team' AND u.team=?))");
    lParams.push(uid, userTeam);
  }
  if (q) { lConds.push('(l.title LIKE ? OR l.url LIKE ?)'); const ql=`%${q}%`; lParams.push(ql,ql); }

  const lWhere = lConds.length ? 'WHERE '+lConds.join(' AND ') : '';

  const links = db.prepare(`
    SELECT l.*, u.username, u.display_name, u.team, r.date, r.room_name, r.purpose
    FROM file_links l JOIN users u ON l.user_id=u.id
    JOIN reservations r ON l.reservation_id=r.id
    ${lWhere}
    ORDER BY l.created_at DESC LIMIT 20
  `).all(...lParams).map(l => ({ ...l, _type: 'link' }));

  res.json({ files, sessions, links, total: files.length + sessions.length + links.length });
};

/* ── 파일 업로드 ──────────────────────────── */
exports.upload = (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });
  const { reservation_id, title, description='', scope='team', tags='[]', expires_at } = req.body;
  if (!reservation_id) return res.status(400).json({ error: 'reservation_id가 필요합니다.' });

  const resId = parseInt(reservation_id, 10);
  if (isNaN(resId)) return res.status(400).json({ error: '유효하지 않은 reservation_id입니다.' });

  const resv = db.prepare('SELECT id FROM reservations WHERE id=?').get(resId);
  if (!resv) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });

  if (!ALLOWED_SCOPES.has(scope)) return res.status(400).json({ error: '유효하지 않은 공개 범위입니다.' });

  const count = db.prepare('SELECT COUNT(*) as c FROM files WHERE reservation_id=?').get(resId).c;
  if (count >= 10) return res.status(400).json({ error: '예약당 최대 10개까지 첨부할 수 있습니다.' });

  const ext     = path.extname(req.file.originalname).toLowerCase();
  const fType   = ext.replace('.','') || 'unknown';
  const titleStr= (title || req.file.originalname).trim().slice(0,100);

  // 같은 제목 → 버전 증가
  const existing = db.prepare('SELECT id, version FROM files WHERE reservation_id=? AND title=? ORDER BY version DESC LIMIT 1').get(resId, titleStr);
  const version  = existing ? existing.version + 1 : 1;

  let tagsJson = '[]';
  try {
    const arr = typeof tags === 'string' ? JSON.parse(tags) : (Array.isArray(tags) ? tags : []);
    tagsJson  = JSON.stringify(arr.slice(0,5).map(t => String(t).slice(0,20)));
  } catch (_) {}

  const info = db.prepare(`
    INSERT INTO files(reservation_id,user_id,title,description,original_name,stored_name,file_type,file_size,scope,tags,version,expires_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(resId, req.user.id, titleStr, description.slice(0,200), req.file.originalname, req.file.filename, fType, req.file.size, scope, tagsJson, version, expires_at||null);

  if (existing) {
    db.prepare('INSERT INTO file_versions(file_id,version,stored_name,file_size) VALUES(?,?,?,?)').run(info.lastInsertRowid, version, req.file.filename, req.file.size);
  }

  const file = db.prepare('SELECT f.*, u.username, u.display_name FROM files f JOIN users u ON f.user_id=u.id WHERE f.id=?').get(info.lastInsertRowid);
  res.status(201).json({ ...file, icon: fileIcon('.'+fType) });
};

/* ── 파일 다운로드 ────────────────────────── */
exports.download = (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const file = db.prepare('SELECT * FROM files WHERE id=?').get(id);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  if (!canAccess(file, req.user)) return res.status(403).json({ error: '접근 권한이 없습니다.' });

  if (file.expires_at && file.expires_at < new Date().toISOString().split('T')[0])
    return res.status(410).json({ error: '만료된 자료입니다.' });

  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일이 서버에 존재하지 않습니다.' });

  db.prepare('UPDATE files SET download_count=download_count+1 WHERE id=?').run(id);
  db.prepare('INSERT INTO file_access_logs(file_id,user_id,action) VALUES(?,?,?)').run(id, req.user.id, 'download');

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
  res.sendFile(filePath);
};

/* ── 파일 메타 수정 ───────────────────────── */
exports.update = (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const file = db.prepare('SELECT * FROM files WHERE id=?').get(id);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  if (file.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '수정 권한이 없습니다.' });

  const { title, description, scope, tags, expires_at } = req.body;
  const updates=[], params=[];
  if (title       !== undefined) { updates.push('title=?');       params.push(title.trim().slice(0,100)); }
  if (description !== undefined) { updates.push('description=?'); params.push(description.slice(0,200)); }
  if (scope && ALLOWED_SCOPES.has(scope)) { updates.push('scope=?'); params.push(scope); }
  if (expires_at  !== undefined) { updates.push('expires_at=?');  params.push(expires_at||null); }
  if (tags !== undefined) {
    try { updates.push('tags=?'); params.push(JSON.stringify(JSON.parse(tags).slice(0,5))); } catch(_){}
  }
  if (!updates.length) return res.status(400).json({ error: '변경할 내용이 없습니다.' });
  params.push(id);
  db.prepare(`UPDATE files SET ${updates.join(',')} WHERE id=?`).run(...params);
  res.json({ message: '수정됐습니다.', file: db.prepare('SELECT * FROM files WHERE id=?').get(id) });
};

/* ── 파일 삭제 ───────────────────────────── */
exports.remove = (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const file = db.prepare('SELECT * FROM files WHERE id=?').get(id);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  if (file.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '삭제 권한이 없습니다.' });

  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(_) {}
  db.prepare('DELETE FROM files WHERE id=?').run(id);
  db.prepare('DELETE FROM file_versions WHERE file_id=?').run(id);
  res.json({ message: '삭제됐습니다.' });
};

/* ── 세션 상세 ───────────────────────────── */
exports.session = (req, res) => {
  const resId = parseInt(req.params.resId, 10);
  const resv  = db.prepare(`
    SELECT r.*, u.username, u.display_name, u.team
    FROM reservations r JOIN users u ON r.user_id=u.id WHERE r.id=?
  `).get(resId);
  if (!resv) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });

  const note  = db.prepare('SELECT * FROM session_notes WHERE reservation_id=?').get(resId);
  const files = db.prepare(`
    SELECT f.*, u.username, u.display_name
    FROM files f JOIN users u ON f.user_id=u.id
    WHERE f.reservation_id=? ORDER BY f.created_at DESC
  `).all(resId).filter(f => canAccess(f, req.user)).map(f => ({ ...f, icon: fileIcon('.'+f.file_type) }));
  const links = db.prepare(`
    SELECT l.*, u.username, u.display_name
    FROM file_links l JOIN users u ON l.user_id=u.id
    WHERE l.reservation_id=? ORDER BY l.created_at DESC
  `).all(resId).filter(l => canAccessLink(l, req.user));

  res.json({ reservation: resv, note: note||null, files, links });
};

/* ── 세션 타임라인 ───────────────────────── */
exports.timeline = (req, res) => {
  const { scope='mine', page=1, limit=15, only_with_files } = req.query;
  const lim    = Math.min(parseInt(limit,10)||15, 50);
  const offset = (Math.max(parseInt(page,10),1)-1)*lim;

  const conds  = ["r.status='confirmed'"];
  const params = [];

  if (scope === 'team' && req.user.team) {
    conds.push('u.team=?'); params.push(req.user.team);
  } else {
    conds.push('r.user_id=?'); params.push(req.user.id);
  }

  if (only_with_files === '1') {
    conds.push('(SELECT COUNT(*) FROM files WHERE reservation_id=r.id)>0');
  }

  const where = 'WHERE '+conds.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as c FROM reservations r JOIN users u ON r.user_id=u.id ${where}`).get(...params).c;
  const sessions = db.prepare(`
    SELECT r.id, r.room_name, r.date, r.start_time, r.end_time, r.headcount, r.purpose, r.status,
      u.username, u.display_name, u.team,
      sn.content as note,
      COUNT(DISTINCT f.id) as file_count,
      COUNT(DISTINCT fl.id) as link_count
    FROM reservations r
    JOIN users u ON r.user_id=u.id
    LEFT JOIN session_notes sn ON sn.reservation_id=r.id
    LEFT JOIN files f ON f.reservation_id=r.id
    LEFT JOIN file_links fl ON fl.reservation_id=r.id
    ${where}
    GROUP BY r.id
    ORDER BY r.date DESC, r.start_time DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ sessions, total, page: parseInt(page,10), limit: lim });
};

/* ── 세션 메모 저장 ───────────────────────── */
exports.saveNote = (req, res) => {
  const resId   = parseInt(req.params.resId, 10);
  const content = (req.body.content||'').trim().slice(0, 1000);
  const resv    = db.prepare('SELECT id FROM reservations WHERE id=?').get(resId);
  if (!resv) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO session_notes(reservation_id,user_id,content,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(reservation_id) DO UPDATE SET content=excluded.content, user_id=excluded.user_id, updated_at=excluded.updated_at
  `).run(resId, req.user.id, content, now);
  res.json({ message: '메모가 저장됐습니다.', content, updated_at: now });
};

/* ── 링크 추가 ───────────────────────────── */
exports.addLink = (req, res) => {
  const { reservation_id, title, url, link_type='general', scope='team' } = req.body;
  if (!reservation_id || !title || !url) return res.status(400).json({ error: '필수 항목이 누락됐습니다.' });
  try { new URL(url); } catch(_) { return res.status(400).json({ error: '유효하지 않은 URL입니다.' }); }
  if (!ALLOWED_SCOPES.has(scope)) return res.status(400).json({ error: '유효하지 않은 공개 범위입니다.' });
  const safeType = LINK_TYPES.has(link_type) ? link_type : 'general';
  const resId    = parseInt(reservation_id, 10);
  const resv     = db.prepare('SELECT id FROM reservations WHERE id=?').get(resId);
  if (!resv) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
  const info = db.prepare('INSERT INTO file_links(reservation_id,user_id,title,url,link_type,scope) VALUES(?,?,?,?,?,?)')
    .run(resId, req.user.id, title.trim().slice(0,100), url, safeType, scope);
  res.status(201).json({ id: info.lastInsertRowid, message: '링크가 추가됐습니다.' });
};

/* ── 링크 삭제 ───────────────────────────── */
exports.removeLink = (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const link = db.prepare('SELECT * FROM file_links WHERE id=?').get(id);
  if (!link) return res.status(404).json({ error: '링크를 찾을 수 없습니다.' });
  if (link.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
  db.prepare('DELETE FROM file_links WHERE id=?').run(id);
  res.json({ message: '삭제됐습니다.' });
};

/* ── Admin 스토리지 현황 ──────────────────── */
exports.storageStats = (req, res) => {
  const QUOTA    = parseInt(process.env.STORAGE_QUOTA_BYTES || String(10*1024*1024*1024), 10);
  const total    = db.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(file_size),0) as sz FROM files').get();
  const byUser   = db.prepare(`
    SELECT u.username, u.display_name, u.team,
      COUNT(f.id) as cnt, COALESCE(SUM(f.file_size),0) as sz
    FROM files f JOIN users u ON f.user_id=u.id
    GROUP BY f.user_id ORDER BY sz DESC LIMIT 10
  `).all();
  const byTeam   = db.prepare(`
    SELECT u.team, COUNT(f.id) as cnt, COALESCE(SUM(f.file_size),0) as sz
    FROM files f JOIN users u ON f.user_id=u.id
    WHERE u.team!='' GROUP BY u.team ORDER BY sz DESC
  `).all();
  const byType   = db.prepare(`
    SELECT file_type, COUNT(*) as cnt, COALESCE(SUM(file_size),0) as sz
    FROM files GROUP BY file_type ORDER BY sz DESC
  `).all();
  const topDL    = db.prepare(`
    SELECT f.title, f.file_type, f.download_count, u.username, u.display_name
    FROM files f JOIN users u ON f.user_id=u.id
    ORDER BY f.download_count DESC LIMIT 5
  `).all();

  res.json({
    total_files: total.cnt, total_size: total.sz,
    quota: QUOTA, byUser, byTeam, byType, topDL
  });
};
