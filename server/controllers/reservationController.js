'use strict';
const db = require('../models/db');

/* SSE broadcast 헬퍼 (app이 주입한 broadcast 함수 사용) */
let _broadcast = null;
function getBroadcast() {
  if (!_broadcast) {
    try { const { broadcast } = require('../routes/events'); _broadcast = broadcast; } catch(_) { _broadcast = () => {}; }
  }
  return _broadcast;
}

/* ── 날짜 헬퍼 ─────────────────────────────────── */
function todayKST() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function addWeeks(dateStr, weeks) { return addDays(dateStr, weeks * 7); }

function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().split('T')[0];
}

/* ── 반복 날짜 생성 ────────────────────────────── */
function generateRecurrenceDates(startDate, rule, maxDate90) {
  /*  rule examples:
      "daily:5"          — 매일, 5회
      "weekly:8"         — 매주, 8회
      "biweekly:4"       — 격주, 4회
      "monthly:3"        — 매월 같은 일, 3회
      "weekdays:10"      — 평일만, 10회
  */
  if (!rule) return [];
  const [type, countStr] = rule.split(':');
  const count = Math.min(parseInt(countStr, 10) || 1, 52); // max 52회
  const dates = [];
  let current = startDate;

  for (let i = 1; i < count; i++) {
    let next;
    if (type === 'daily')     next = addDays(current, 1);
    else if (type === 'weekly')    next = addWeeks(current, 1);
    else if (type === 'biweekly')  next = addWeeks(current, 2);
    else if (type === 'monthly')   next = addMonths(current, 1);
    else if (type === 'weekdays') {
      next = addDays(current, 1);
      // skip weekends
      while (true) {
        const dow = new Date(next + 'T00:00:00Z').getUTCDay();
        if (dow !== 0 && dow !== 6) break;
        next = addDays(next, 1);
      }
    } else break;

    if (next > maxDate90) break;
    dates.push(next);
    current = next;
  }
  return dates;
}

/* ── 유효성 검사 ────────────────────────────────── */
const HOURS   = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const VALID_RULES = new Set(['daily','weekly','biweekly','monthly','weekdays']);

function getActiveRooms() {
  return db.prepare('SELECT name, capacity FROM rooms WHERE is_active=1').all();
}

function validateReservation(body) {
  const { room_name, date, start_time, end_time, headcount } = body;
  if (!room_name || !date || !start_time || !end_time || !headcount)
    return '모든 필드를 입력해주세요.';

  const activeRooms = getActiveRooms();
  const room = activeRooms.find(r => r.name === room_name);
  if (!room) return '유효하지 않은 룸입니다.';

  if (!DATE_RE.test(date))              return '날짜 형식이 올바르지 않습니다.';
  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time))
    return '시간 형식이 올바르지 않습니다.';
  if (start_time >= end_time)           return '종료 시간은 시작 시간보다 늦어야 합니다.';
  if (!HOURS.includes(start_time) || !HOURS.includes(end_time))
    return '운영 시간(09:00~18:00) 내에서만 예약 가능합니다.';

  const hc = parseInt(headcount, 10);
  if (isNaN(hc) || hc < 1) return '인원은 1명 이상이어야 합니다.';
  if (hc > room.capacity)
    return `${room_name}의 최대 수용 인원은 ${room.capacity}명입니다.`;

  const today = todayKST();
  if (date < today) return '과거 날짜로는 예약할 수 없습니다.';
  const maxDate = new Date(Date.now() + 9 * 60 * 60 * 1000 + 90 * 86400000);
  if (date > maxDate.toISOString().split('T')[0]) return '90일 이후 날짜는 예약할 수 없습니다.';
  return null;
}

/* ── 단일 예약 INSERT 헬퍼 ─────────────────────── */
function insertOne(userId, body, parentId = null) {
  const { room_name, date, start_time, end_time, headcount, purpose, recurrence_rule } = body;
  const hc   = parseInt(headcount, 10);
  const rule = recurrence_rule || '';

  const conflict = db.prepare(`
    SELECT id FROM reservations
    WHERE room_name=? AND date=? AND status='confirmed'
      AND start_time < ? AND end_time > ?
  `).get(room_name, date, end_time, start_time);
  if (conflict) return { error: `${room_name}은(는) ${date} ${start_time}~${end_time}에 이미 예약이 있습니다.` };

  const userConflict = db.prepare(`
    SELECT id FROM reservations
    WHERE user_id=? AND room_name=? AND date=? AND status='confirmed'
      AND start_time < ? AND end_time > ?
  `).get(userId, room_name, date, end_time, start_time);
  if (userConflict) return { error: `${room_name} ${date} ${start_time}~${end_time} 예약이 이미 있습니다.` };

  const info = db.prepare(
    `INSERT INTO reservations(user_id,room_name,date,start_time,end_time,headcount,purpose,recurrence_rule,recurrence_parent_id)
     VALUES(?,?,?,?,?,?,?,?,?)`
  ).run(userId, room_name, date, start_time, end_time, hc, (purpose||'').trim(), rule, parentId);

  return { id: info.lastInsertRowid };
}

/* ── 예약 생성 ─────────────────────────────────── */
exports.create = (req, res) => {
  const err = validateReservation(req.body);
  if (err) return res.status(400).json({ error: err });

  const { room_name, date, start_time, end_time, headcount, recurrence_rule } = req.body;
  const userId = req.user.id;

  /* 반복 예약 유효성 */
  let recurType = null, recurCount = 1;
  if (recurrence_rule) {
    const parts = recurrence_rule.split(':');
    recurType  = parts[0];
    recurCount = parseInt(parts[1], 10) || 1;
    if (!VALID_RULES.has(recurType))
      return res.status(400).json({ error: '유효하지 않은 반복 규칙입니다. (daily/weekly/biweekly/monthly/weekdays)' });
    if (recurCount < 2 || recurCount > 52)
      return res.status(400).json({ error: '반복 횟수는 2~52 사이여야 합니다.' });
  }

  const maxDate90 = new Date(Date.now() + 9 * 60 * 60 * 1000 + 90 * 86400000).toISOString().split('T')[0];

  /* 모든 INSERT를 트랜잭션으로 */
  const createAll = db.transaction(() => {
    /* 첫 번째 예약 (부모) */
    const first = insertOne(userId, req.body, null);
    if (first.error) throw new Error(first.error);

    const parentId   = first.id;
    const extraDates = generateRecurrenceDates(date, recurrence_rule, maxDate90);
    const skipped    = [];
    const created    = [parentId];

    for (const d of extraDates) {
      const child = insertOne(userId, { ...req.body, date: d }, parentId);
      if (child.error) skipped.push({ date: d, reason: child.error });
      else created.push(child.id);
    }

    return { parentId, created, skipped };
  });

  let result;
  try {
    result = createAll();
  } catch (e) {
    return res.status(409).json({ error: e.message });
  }

  /* 알림 */
  try {
    const uid = userId;
    db.prepare(
      `INSERT INTO notifications(admin_id, target, title, body, type) VALUES(?,?,?,?,?)`
    ).run(
      uid, `user_${uid}`,
      `✅ 예약 확정: ${room_name}`,
      result.created.length > 1
        ? `${date} ${start_time}~${end_time} 외 ${result.created.length - 1}회 반복 예약이 확정됐습니다.`
        : `${date} ${start_time}~${end_time} 예약이 확정됐습니다. (${headcount}명)`,
      'success'
    );
  } catch (_) {}

  const firstRes = db.prepare(`
    SELECT r.*, u.username, u.team FROM reservations r
    JOIN users u ON r.user_id=u.id WHERE r.id=?
  `).get(result.parentId);

  /* SSE: 예약 변경 알림 */
  try { getBroadcast()('reservation_created', { room_name, date, start_time, end_time, count: result.created.length }); } catch(_) {}

  res.status(201).json({
    reservation: firstRes,
    message: result.created.length > 1
      ? `${result.created.length}회 반복 예약이 완료됐습니다.${result.skipped.length ? ` (${result.skipped.length}회 충돌로 건너뜀)` : ''}`
      : '예약이 완료되었습니다.',
    created: result.created,
    skipped: result.skipped,
  });
};

/* ── 내 예약 목록 (#5 페이지네이션 추가) ──────── */
exports.myReservations = (req, res) => {
  const { page=1, limit=50 } = req.query;
  const lim    = Math.min(parseInt(limit,10)||50, 200);
  const offset = (Math.max(parseInt(page,10),1)-1)*lim;
  const total  = db.prepare('SELECT COUNT(*) as c FROM reservations WHERE user_id=?').get(req.user.id).c;
  const rows   = db.prepare(`
    SELECT * FROM reservations WHERE user_id=?
    ORDER BY date DESC, start_time DESC LIMIT ? OFFSET ?
  `).all(req.user.id, lim, offset);
  res.json({ data: rows, total, page: parseInt(page,10), limit: lim });
};

/* ── 예약 취소 ─────────────────────────────────── */
exports.cancel = (req, res) => {
  const id          = parseInt(req.params.id, 10);
  const cancelAll   = req.query.series === 'true';   // ?series=true → 반복 전체 취소
  if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다.' });

  const row = db.prepare('SELECT * FROM reservations WHERE id=?').get(id);
  if (!row)                       return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
  if (row.status === 'cancelled') return res.status(400).json({ error: '이미 취소된 예약입니다.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '본인의 예약만 취소할 수 있습니다.' });

  const today = todayKST();
  if (row.date < today && req.user.role !== 'admin')
    return res.status(400).json({ error: '이미 지난 예약은 취소할 수 없습니다.' });

  if (cancelAll && (row.recurrence_parent_id || row.id)) {
    /* 반복 시리즈 전체 취소 */
    const parentId = row.recurrence_parent_id || row.id;
    db.prepare(`UPDATE reservations SET status='cancelled'
                WHERE (id=? OR recurrence_parent_id=?) AND date >= ? AND status='confirmed'`)
      .run(parentId, parentId, today);
    return res.json({ message: '반복 예약 시리즈가 모두 취소됐습니다.' });
  }

  db.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").run(id);
  try { getBroadcast()('reservation_cancelled', { id }); } catch(_) {}
  res.json({ message: '예약이 취소되었습니다.' });
};

/* ── 팀 예약 ───────────────────────────────────── */
exports.teamReservations = (req, res) => {
  const team = (req.user.team || '').trim();
  if (!team) return res.json([]);
  const today = todayKST();
  const rows = db.prepare(`
    SELECT r.id, r.user_id, r.room_name, r.date, r.start_time, r.end_time,
           r.headcount, r.status, r.recurrence_rule, r.recurrence_parent_id,
           r.created_at, u.username, u.team
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
           r.headcount, r.status, r.recurrence_rule, r.recurrence_parent_id,
           u.username, u.team
    FROM reservations r JOIN users u ON r.user_id=u.id
    WHERE r.status='confirmed' AND r.date >= ? AND r.date <= ?
    ORDER BY r.date ASC, r.start_time ASC
  `).all(past.toISOString().split('T')[0], future.toISOString().split('T')[0]);
  res.json(rows);
};

/* ── CSV 엑스포트 (/api/reservations/export.csv) ── */
exports.exportCsv = (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { date_from, date_to, room, status = 'confirmed' } = req.query;

  const conds  = ['r.status=?'];
  const params = [status];

  if (!isAdmin) { conds.push('r.user_id=?'); params.push(req.user.id); }
  if (room)      { conds.push('r.room_name=?'); params.push(room); }
  if (date_from) { conds.push('r.date>=?');     params.push(date_from); }
  if (date_to)   { conds.push('r.date<=?');     params.push(date_to); }

  const rows = db.prepare(`
    SELECT r.id, u.username, u.display_name, u.team,
           r.room_name, r.date, r.start_time, r.end_time,
           r.headcount, r.purpose, r.status, r.recurrence_rule, r.created_at
    FROM reservations r JOIN users u ON r.user_id=u.id
    WHERE ${conds.join(' AND ')}
    ORDER BY r.date ASC, r.start_time ASC
    LIMIT 5000
  `).all(...params);

  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['ID','사용자','이름','팀','룸','날짜','시작','종료','인원','목적','상태','반복규칙','생성일시'];
  const lines   = [headers.map(esc).join(',')];
  for (const r of rows) {
    lines.push([
      r.id, r.username, r.display_name, r.team,
      r.room_name, r.date, r.start_time, r.end_time,
      r.headcount, r.purpose, r.status, r.recurrence_rule, r.created_at
    ].map(esc).join(','));
  }

  const csv = '\uFEFF' + lines.join('\r\n'); // UTF-8 BOM for Excel
  const filename = `reservations_${todayKST()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(csv);
};

/* ── 공개 통계 ─────────────────────────────────── */
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
      SUM(headcount) AS total_headcount, COUNT(*) AS count,
      ROUND(AVG(headcount), 1) AS avg_headcount,
      COUNT(DISTINCT date) AS day_count,
      ROUND(CAST(COUNT(*) AS REAL) / MAX(1, COUNT(DISTINCT date)), 1) AS avg_per_day
    FROM reservations WHERE status='confirmed'
    GROUP BY start_time ORDER BY start_time
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

/* ── 룸 현황 ───────────────────────────────────── */
exports.roomStatus = (req, res) => {
  const { period = 'month' } = req.query;
  const today = todayKST();
  const ref   = new Date(today + 'T00:00:00');
  let dateFrom, dateTo;
  if (period === 'week') {
    const dow = ref.getDay();
    const mon = new Date(ref); mon.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
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
    dateFrom = `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,'0')}-01`;
    dateTo   = new Date(ref.getFullYear(), ref.getMonth()+1, 0).toISOString().split('T')[0];
  }
  const reservations = db.prepare(`
    SELECT r.id, r.room_name, r.date, r.start_time, r.end_time,
           r.headcount, r.purpose, r.recurrence_rule,
           u.username, u.display_name, u.team
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

/* ── 예약 수정 (목적·인원만 변경 가능) ─────────────────── */
exports.update = (req, res) => {
  const id  = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다.' });

  const row = db.prepare('SELECT * FROM reservations WHERE id=?').get(id);
  if (!row) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
  if (row.status !== 'confirmed') return res.status(400).json({ error: '취소된 예약은 수정할 수 없습니다.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '본인의 예약만 수정할 수 있습니다.' });

  const today = todayKST();
  if (row.date < today && req.user.role !== 'admin')
    return res.status(400).json({ error: '이미 지난 예약은 수정할 수 없습니다.' });

  const fields = [], params = [];

  if (req.body.purpose !== undefined) {
    fields.push('purpose=?');
    params.push((req.body.purpose || '').trim().slice(0, 200));
  }
  if (req.body.headcount !== undefined) {
    const hc = parseInt(req.body.headcount, 10);
    if (isNaN(hc) || hc < 1) return res.status(400).json({ error: '인원은 1명 이상이어야 합니다.' });

    /* 룸 수용 인원 체크 */
    const room = db.prepare('SELECT capacity FROM rooms WHERE name=? AND is_active=1').get(row.room_name);
    if (room && hc > room.capacity)
      return res.status(400).json({ error: `${row.room_name}의 최대 수용 인원은 ${room.capacity}명입니다.` });

    fields.push('headcount=?');
    params.push(hc);
  }

  if (!fields.length) return res.status(400).json({ error: '변경할 항목이 없습니다. (purpose, headcount 중 하나 이상 필요)' });

  params.push(id);
  db.prepare(`UPDATE reservations SET ${fields.join(', ')} WHERE id=?`).run(...params);

  const updated = db.prepare(`
    SELECT r.*, u.username, u.team FROM reservations r
    JOIN users u ON r.user_id=u.id WHERE r.id=?
  `).get(id);

  try { getBroadcast()('reservation_updated', { id, room_name: row.room_name, date: row.date }); } catch(_) {}

  res.json({ message: '예약이 수정됐습니다.', reservation: updated });
};
