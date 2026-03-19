'use strict';
const db = require('../models/db');

/* 내 즐겨찾기 목록 */
exports.list = (req, res) => {
  const rows = db.prepare('SELECT * FROM favorites WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
};

/* 즐겨찾기 추가 */
exports.create = (req, res) => {
  const { label, room_name, start_time, end_time, headcount } = req.body;
  if (!label || !room_name || !start_time || !end_time || !headcount)
    return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
  if (label.length > 30) return res.status(400).json({ error: '이름은 30자 이하로 입력해주세요.' });
  // 최대 10개 제한
  const count = db.prepare('SELECT COUNT(*) as c FROM favorites WHERE user_id=?').get(req.user.id).c;
  if (count >= 10) return res.status(400).json({ error: '즐겨찾기는 최대 10개까지 저장할 수 있습니다.' });
  const info = db.prepare(
    'INSERT INTO favorites(user_id,label,room_name,start_time,end_time,headcount) VALUES(?,?,?,?,?,?)'
  ).run(req.user.id, label.trim(), room_name, start_time, end_time, parseInt(headcount,10));
  res.status(201).json({ id: info.lastInsertRowid, message: '즐겨찾기에 추가됐습니다.' });
};

/* 즐겨찾기 삭제 */
exports.remove = (req, res) => {
  const id  = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT * FROM favorites WHERE id=?').get(id);
  if (!row) return res.status(404).json({ error: '즐겨찾기를 찾을 수 없습니다.' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: '본인의 즐겨찾기만 삭제할 수 있습니다.' });
  db.prepare('DELETE FROM favorites WHERE id=?').run(id);
  res.json({ message: '삭제됐습니다.' });
};
