'use strict';
const db = require('../models/db');

/* ── 세션 할 일 목록 조회 ── */
exports.list = (req, res) => {
  const resId = parseInt(req.params.resId, 10);
  const resv  = db.prepare('SELECT id, user_id FROM reservations WHERE id=?').get(resId);
  if (!resv) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });

  /* 본인 예약이 아니고 관리자도 아니면 팀원 여부 확인 */
  if (resv.user_id !== req.user.id && req.user.role !== 'admin') {
    /* 같은 팀이면 조회 허용, 아니면 403 */
    const owner = db.prepare('SELECT team FROM users WHERE id=?').get(resv.user_id);
    const me    = db.prepare('SELECT team FROM users WHERE id=?').get(req.user.id);
    if (!owner || !me || !owner.team || owner.team !== me.team)
      return res.status(403).json({ error: '해당 예약의 할 일 목록을 볼 권한이 없습니다.' });
  }

  const tasks = db.prepare(
    'SELECT * FROM tasks WHERE reservation_id=? ORDER BY done ASC, created_at ASC'
  ).all(resId);
  res.json({ tasks });
};

/* ── 할 일 추가 ── */
exports.create = (req, res) => {
  const resId    = parseInt(req.params.resId, 10);
  const { title, assignee = '', due_date = null } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '할 일 제목을 입력해주세요.' });

  const resv = db.prepare('SELECT id FROM reservations WHERE id=?').get(resId);
  if (!resv) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO tasks(reservation_id, user_id, title, assignee, due_date) VALUES(?,?,?,?,?)'
  ).run(resId, req.user.id, title.trim().slice(0, 200), assignee.trim().slice(0, 100), due_date || null);

  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(lastInsertRowid);
  res.status(201).json({ task });
};

/* ── 완료 상태 토글 ── */
exports.toggle = (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  if (!task) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  if (task.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '본인이 등록한 할 일만 수정할 수 있습니다.' });

  const now  = new Date().toISOString();
  const done = task.done ? 0 : 1;
  db.prepare('UPDATE tasks SET done=?, updated_at=? WHERE id=?').run(done, now, id);
  res.json({ task: { ...task, done, updated_at: now } });
};

/* ── 할 일 수정 ── */
exports.update = (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  if (!task) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  if (task.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '본인이 등록한 할 일만 수정할 수 있습니다.' });

  const title    = (req.body.title    ?? task.title).trim().slice(0, 200);
  const assignee = (req.body.assignee ?? task.assignee).trim().slice(0, 100);
  const due_date = req.body.due_date !== undefined ? req.body.due_date || null : task.due_date;
  const now      = new Date().toISOString();
  db.prepare('UPDATE tasks SET title=?, assignee=?, due_date=?, updated_at=? WHERE id=?')
    .run(title, assignee, due_date, now, id);
  res.json({ task: { ...task, title, assignee, due_date, updated_at: now } });
};

/* ── 할 일 삭제 ── */
exports.remove = (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  if (!task) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  if (task.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '본인이 등록한 할 일만 삭제할 수 있습니다.' });

  db.prepare('DELETE FROM tasks WHERE id=?').run(id);
  res.json({ message: '삭제됐습니다.' });
};
