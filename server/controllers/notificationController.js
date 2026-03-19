'use strict';
const db = require('../models/db');

/* 텍스트 이스케이프 — XSS 방지 */
function esc(str) {
  return String(str||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

const VALID_TYPES   = ['info','warning','success','urgent'];
const TITLE_MAX_LEN = 100;
const BODY_MAX_LEN  = 1000;

/* admin: 알림 생성 */
exports.create = (req, res) => {
  const { title, body, target, type } = req.body;
  if (!title || !body) return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  if (title.length > TITLE_MAX_LEN) return res.status(400).json({ error: `제목은 ${TITLE_MAX_LEN}자 이하로 입력해주세요.` });
  if (body.length  > BODY_MAX_LEN)  return res.status(400).json({ error: `내용은 ${BODY_MAX_LEN}자 이하로 입력해주세요.` });
  const safeType = VALID_TYPES.includes(type) ? type : 'info';

  const info = db.prepare(
    'INSERT INTO notifications(admin_id,target,title,body,type) VALUES(?,?,?,?,?)'
  ).run(req.user.id, target||'all', esc(title.trim()), esc(body.trim()), safeType);

  res.status(201).json({ id: info.lastInsertRowid, message: '알림이 발송됐습니다.' });
};

/* admin: 발송 내역 */
exports.adminList = (req, res) => {
  const rows = db.prepare(`
    SELECT n.*, u.username as admin_name,
      (SELECT COUNT(*) FROM notification_reads r WHERE r.notification_id=n.id) as read_count
    FROM notifications n JOIN users u ON n.admin_id=u.id
    ORDER BY n.created_at DESC LIMIT 200
  `).all();
  res.json(rows);
};

/* admin: 알림 삭제 */
exports.remove = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  db.prepare('DELETE FROM notification_reads WHERE notification_id=?').run(id);
  db.prepare('DELETE FROM notifications WHERE id=?').run(id);
  res.json({ message: '삭제됐습니다.' });
};

/* user: 내 알림 목록 */
exports.userList = (req, res) => {
  const uid = req.user.id, team = req.user.team || '';
  const rows = db.prepare(`
    SELECT n.*,
      CASE WHEN r.user_id IS NOT NULL THEN 1 ELSE 0 END as is_read
    FROM notifications n
    LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.user_id=?
    WHERE n.target='all' OR n.target=? OR n.target='user_'||?
    ORDER BY n.created_at DESC LIMIT 50
  `).all(uid, team, uid);
  res.json(rows);
};

/* user: 읽음 처리 */
exports.markRead = (req, res) => {
  const uid = req.user.id;
  const nid = parseInt(req.params.id, 10);
  if (isNaN(nid)) return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  try { db.prepare('INSERT OR IGNORE INTO notification_reads(user_id,notification_id) VALUES(?,?)').run(uid, nid); } catch {}
  res.json({ ok: true });
};

/* user: 전체 읽음 */
exports.markAllRead = (req, res) => {
  const uid = req.user.id, team = req.user.team || '';
  const notes = db.prepare(`
    SELECT id FROM notifications
    WHERE target='all' OR target=? OR target='user_'||?
  `).all(team, uid);
  const ins = db.prepare('INSERT OR IGNORE INTO notification_reads(user_id,notification_id) VALUES(?,?)');
  db.transaction(() => notes.forEach(n => ins.run(uid, n.id)))();
  res.json({ ok: true });
};

/* user: 미읽음 개수 */
exports.unreadCount = (req, res) => {
  const uid = req.user.id, team = req.user.team || '';
  const row = db.prepare(`
    SELECT COUNT(*) as c FROM notifications n
    WHERE (n.target='all' OR n.target=? OR n.target='user_'||?)
      AND NOT EXISTS (
        SELECT 1 FROM notification_reads r
        WHERE r.notification_id=n.id AND r.user_id=?
      )
  `).get(team, uid, uid);
  res.json({ count: row.c });
};
