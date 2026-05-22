'use strict';
const db = require('../models/db');

/* 즐겨찾기용 유효성 검사 (reservationController 와 동일 기준) */
const TIME_RE  = /^\d{2}:\d{2}$/;
const HOURS    = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

function validateFavorite({ room_name, start_time, end_time, headcount }) {
  const activeRooms = db.prepare('SELECT name, capacity FROM rooms WHERE is_active=1').all();
  const room = activeRooms.find(r => r.name === room_name);
  if (!room) return '유효하지 않은 룸입니다.';

  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time))
    return '시간 형식이 올바르지 않습니다.';
  if (start_time >= end_time)
    return '종료 시간은 시작 시간보다 늦어야 합니다.';
  if (!HOURS.includes(start_time) || !HOURS.includes(end_time))
    return '운영 시간(09:00~18:00) 내에서만 예약 가능합니다.';

  const hc = parseInt(headcount, 10);
  if (isNaN(hc) || hc < 1) return '인원은 1명 이상이어야 합니다.';
  if (hc > room.capacity) return `${room_name}의 최대 수용 인원은 ${room.capacity}명입니다.`;

  return null; // valid
}

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
  const validErr = validateFavorite({ room_name, start_time, end_time, headcount });
  if (validErr) return res.status(400).json({ error: validErr });
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
