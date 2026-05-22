'use strict';
const db = require('../models/db');

/* 전체 룸 목록 */
exports.list = (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms WHERE is_active=1 ORDER BY sort_order').all();
  res.json(rooms);
};

/* 모든 룸 (admin, 비활성 포함) */
exports.listAll = (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY sort_order').all();
  res.json(rooms);
};

/* 룸 수정 (admin) */
exports.update = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  const { display_name, capacity, description, amenities, color, is_active } = req.body;
  const room = db.prepare('SELECT * FROM rooms WHERE id=?').get(id);
  if (!room) return res.status(404).json({ error: '룸을 찾을 수 없습니다.' });
  const updates = [], params = [];
  if (display_name !== undefined) { updates.push('display_name=?'); params.push(display_name.trim()); }
  if (capacity     !== undefined) { updates.push('capacity=?');     params.push(parseInt(capacity,10)); }
  if (description  !== undefined) { updates.push('description=?');  params.push(description.trim()); }
  if (amenities    !== undefined) { updates.push('amenities=?');    params.push(amenities.trim()); }
  if (color        !== undefined) { updates.push('color=?');        params.push(color.trim()); }
  if (is_active    !== undefined) { updates.push('is_active=?');    params.push(is_active?1:0); }
  if (!updates.length) return res.status(400).json({ error: '변경할 내용이 없습니다.' });
  params.push(id);
  db.prepare(`UPDATE rooms SET ${updates.join(',')} WHERE id=?`).run(...params);
  res.json({ message: '룸 정보가 업데이트됐습니다.', room: db.prepare('SELECT * FROM rooms WHERE id=?').get(id) });
};
