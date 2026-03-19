'use strict';
const db = require('../models/db');

/* ── 날짜 헬퍼 ─────────────────────────────────── */
/* KST(UTC+9) 기준 오늘 날짜 — 서버 타임존과 무관하게 동작 */
function todayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

/* ── 유효성 검사 ────────────────────────────────── */
const ROOMS   = ['Room A', 'Room B', 'Room C', 'Room D'];
const HOURS   = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function validateReservation(body) {
  const { room_name, date, start_time, end_time, headcount } = body;
  if (!room_name || !date || !start_time || !end_time || !headcount)
    return '모든 필드를 입력해주세요.';
  if (!ROOMS.includes(room_name))      return '유효하지 않은 룸입니다.';
  if (!DATE_RE.test(date))              return '날짜 형식이 올바르지 않습니다.';
  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time))
    return '시간 형식이 올바르지 않습니다.';
  if (start_time >= end_time)           return '종료 시간은 시작 시간보다 늦어야 합니다.';
  if (!HOURS.includes(start_time) || !HOURS.includes(end_time))
    return '운영 시간(09:00~18:00) 내에서만 예약 가능합니다.';
  const hc = parseInt(headcount, 10);
  if (isNaN(hc) || hc < 1 || hc > 10) return '인원은 1~10명 사이여야 합니다.';

  const today = todayKST();
  if (date < today) return '과거 날짜로는 예약할 수 없습니다.';
  const maxDate = new Date(Date.now() + 9 * 60 * 60 * 1000 + 90 * 86400000);
  if (date > maxDate.toISOString().split('T')[0]) return '90일 이후 날짜는 예약할 수 없습니다.';
  return null;
}

/* XSS 방어용 텍스트 이스케이프 */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── 예약 생성 ─────────────────────────────────── */
exports.create = (req, res) => {
  const err = validateReservation(req.body);
  if (err) return res.status(400).json({ error: err });

  const { room_name, date, start_time, end_time, headcount, purpose } = req.body;
  const hc = parseInt(headcount, 10);

  const conflict = db.prepare(`
    SELECT id FROM reservations
    WHERE room_name=? AND date=? AND status='confirmed'
      AND start_time < ? AND end_time > ?
  `).get(room_name, date, end_time, start_time);
  if (conflict)
    return res.status(409).json({ error: `${room_name}은(는) 해당 시간대에 이미 예약이 있습니다.` });

  /* 본인이 동일 룸+시간 중복 방지 (다른 룸은 허용) */
  const userConflict = db.prepare(`
    SELECT id FROM reservations
    WHERE user_id=? AND room_name=? AND date=? AND status='confirmed'
      AND start_time < ? AND end_time > ?
  `).get(req.user.id, room_name, date, end_time, start_time);
  if (userConflict)
    return res.status(409).json({ error: `${room_name}에 해당 시간 예약이 이미 있습니다.` });

  const info = db.prepare(
    'INSERT INTO reservations(user_id,room_name,date,start_time,end_time,headcount,purpose) VALUES(?,?,?,?,?,?,?)'
  ).run(req.user.id, room_name, date, start_time, end_time, hc, (purpose||'').trim());

  const created = db.prepare(`
    SELECT r.*, u.username, u.team FROM reservations r
    JOIN users u ON r.user_id=u.id WHERE r.id=?
  `).get(info.lastInsertRowid);

  res.status(201).json({ reservation: created, message: '예약이 완료되었습니다.' });
};

/* ── 내 예약 목록 ──────────────────────────────── */
exports.myReservations = (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM reservations WHERE user_id=?
    ORDER BY date DESC, start_time DESC LIMIT 500
  `).all(req.user.id);
  res.json(rows);
};

/* ── 예약 취소 ─────────────────────────────────── */
exports.cancel = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다.' });

  const row = db.prepare('SELECT * FROM reservations WHERE id=?').get(id);
  if (!row)                       return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
  if (row.status === 'cancelled') return res.status(400).json({ error: '이미 취소된 예약입니다.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '본인의 예약만 취소할 수 있습니다.' });

  const today = todayKST();
  if (row.date < today && req.user.role !== 'admin')
    return res.status(400).json({ error: '이미 지난 예약은 취소할 수 없습니다.' });

  db.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").run(id);
  res.json({ message: '예약이 취소되었습니다.' });
};

/* ── 팀 예약 (오늘 이후) ───────────────────────── */
exports.teamReservations = (req, res) => {
  const team = (req.user.team || '').trim();
  if (!team) return res.json([]);
  const today = todayKST();
  const rows = db.prepare(`
    SELECT r.id, r.user_id, r.room_name, r.date, r.start_time, r.end_time,
           r.headcount, r.status, r.created_at, u.username, u.team
    FROM reservations r JOIN users u ON r.user_id=u.id
    WHERE u.team=? AND r.status='confirmed' AND r.date >= ?
    ORDER BY r.date ASC, r.start_time ASC LIMIT 500
  `).all(team, today);
  res.json(rows);
};

/* ── 전체 캘린더 ───────────────────────────────── */
exports.calendarAll = (req, res) => {
  const past   = new Date(Date.now() + 9*3600000 - 7*86400000);
  const future = new Date(Date.now() + 9*3600000 + 90*86400000);
  const rows = db.prepare(`
    SELECT r.id, r.user_id, r.room_name, r.date, r.start_time, r.end_time,
           r.headcount, r.status, u.username, u.team
    FROM reservations r JOIN users u ON r.user_id=u.id
    WHERE r.status='confirmed' AND r.date >= ? AND r.date <= ?
    ORDER BY r.date ASC, r.start_time ASC
  `).all(past.toISOString().split('T')[0], future.toISOString().split('T')[0]);
  res.json(rows);
};

/* ── 공개 통계 (혼잡도용) ──────────────────────── */
exports.publicStats = (req, res) => {
  const byHour = db.prepare(`
    SELECT start_time, SUM(headcount) AS total_headcount, COUNT(*) AS count
    FROM reservations WHERE status='confirmed'
    GROUP BY start_time ORDER BY start_time
  `).all();

  const future = new Date(Date.now() + 9*3600000 + 90*86400000);
  const byDateRoom = db.prepare(`
    SELECT r.date, r.room_name, r.start_time, r.end_time,
           r.headcount, u.username, u.team
    FROM reservations r JOIN users u ON r.user_id=u.id
    WHERE r.status='confirmed'
      AND r.date >= date('now', '-1 day')
      AND r.date <= ?
    ORDER BY r.date ASC, r.start_time ASC, r.room_name ASC
  `).all(future.toISOString().split('T')[0]);

  res.json({ byHour, byDateRoom });
};

/* ── 전체 예약 (admin) ─────────────────────────── */
exports.all = (req, res) => {
  const { page=1, limit=500, status, room, date_from, date_to } = req.query;
  const lim    = Math.min(parseInt(limit,10)||500, 2000);
  const offset = (Math.max(parseInt(page,10),1)-1)*lim;
  const conds  = ['1=1'], params = [];
  if (status)    { conds.push('r.status=?');    params.push(status); }
  if (room)      { conds.push('r.room_name=?'); params.push(room); }
  if (date_from) { conds.push('r.date>=?');     params.push(date_from); }
  if (date_to)   { conds.push('r.date<=?');     params.push(date_to); }
  const where = 'WHERE '+conds.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as c FROM reservations r ${where}`).get(...params).c;
  const rows  = db.prepare(`
    SELECT r.*, u.username, u.team FROM reservations r
    JOIN users u ON r.user_id=u.id ${where}
    ORDER BY r.date DESC, r.start_time DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);
  res.json({ data: rows, total, page: parseInt(page,10), limit: lim });
};

/* ── 통계 (admin) ──────────────────────────────── */
exports.stats = (req, res) => {
  const today   = todayKST();
  const total   = db.prepare("SELECT COUNT(*) as c, SUM(headcount) as s FROM reservations WHERE status='confirmed'").get();
  const cancelled = db.prepare("SELECT COUNT(*) as c FROM reservations WHERE status='cancelled'").get();
  const todayC  = db.prepare("SELECT COUNT(*) as c FROM reservations WHERE status='confirmed' AND date=?").get(today);
  const byHour  = db.prepare(`
    SELECT start_time,
      SUM(headcount)                                    AS total_headcount,
      COUNT(*)                                          AS count,
      ROUND(AVG(headcount), 1)                          AS avg_headcount,
      COUNT(DISTINCT date)                               AS day_count,
      ROUND(CAST(COUNT(*) AS REAL) / MAX(1, COUNT(DISTINCT date)), 1) AS avg_per_day
    FROM reservations
    WHERE status='confirmed'
    GROUP BY start_time
    ORDER BY start_time
  `).all();
  const byRoom  = db.prepare(`SELECT room_name, COUNT(*) AS count, SUM(headcount) AS total FROM reservations WHERE status='confirmed' GROUP BY room_name ORDER BY count DESC`).all();
  const byDate  = db.prepare(`SELECT date, COUNT(*) AS count, SUM(headcount) AS total FROM reservations WHERE status='confirmed' GROUP BY date ORDER BY date DESC LIMIT 14`).all();
  const byTeam  = db.prepare(`SELECT u.team, COUNT(*) AS count FROM reservations r JOIN users u ON r.user_id=u.id WHERE r.status='confirmed' AND u.team!='' GROUP BY u.team ORDER BY count DESC LIMIT 10`).all();
  res.json({
    total: total.c, totalHeadcount: total.s||0, cancelled: cancelled.c,
    todayCount: todayC.c,
    avgHeadcount: total.c>0 ? parseFloat((total.s/total.c).toFixed(1)) : 0,
    byHour, byRoom, byDate, byTeam
  });
};

/* ── 룸 현황 기간 필터 ─────────────────────── */
exports.roomStatus = (req, res) => {
  const { period = 'month' } = req.query;
  const today = todayKST();
  const ref   = new Date(today + 'T00:00:00');
  let dateFrom, dateTo;

  if (period === 'week') {
    const dow = ref.getDay();
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    dateFrom = mon.toISOString().split('T')[0];
    dateTo   = sun.toISOString().split('T')[0];
  } else if (period === 'prev_month') {
    const last  = new Date(ref.getFullYear(), ref.getMonth(), 0);
    const first = new Date(last.getFullYear(), last.getMonth(), 1);
    dateFrom = first.toISOString().split('T')[0];
    dateTo   = last.toISOString().split('T')[0];
  } else if (period === 'upcoming') {
    dateFrom = today;
    dateTo   = new Date(Date.now() + 9*3600000 + 30*86400000).toISOString().split('T')[0];
  } else {
    // month (default)
    dateFrom = `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,'0')}-01`;
    dateTo   = new Date(ref.getFullYear(), ref.getMonth()+1, 0).toISOString().split('T')[0];
  }

  const reservations = db.prepare(`
    SELECT r.id, r.room_name, r.date, r.start_time, r.end_time,
           r.headcount, r.purpose, u.username, u.display_name, u.team
    FROM reservations r JOIN users u ON r.user_id=u.id
    WHERE r.status='confirmed' AND r.date >= ? AND r.date <= ?
    ORDER BY r.date ASC, r.start_time ASC
  `).all(dateFrom, dateTo);

  const byRoom = db.prepare(`
    SELECT room_name, COUNT(*) AS count,
           SUM(headcount) AS total_headcount,
           COUNT(DISTINCT date) AS day_count
    FROM reservations
    WHERE status='confirmed' AND date >= ? AND date <= ?
    GROUP BY room_name ORDER BY count DESC
  `).all(dateFrom, dateTo);

  res.json({ reservations, byRoom, dateFrom, dateTo, period });
};
