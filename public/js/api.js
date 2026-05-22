'use strict';

/* ── AUTH ──────────────────────────────────────────────── */
const auth = {
  _k: { t:'sm_token', r:'sm_role', u:'sm_user', g:'sm_team', n:'sm_name' },
  save(token, role, username, team, displayName='', refreshToken='') {
    localStorage.setItem(this._k.t, token);
    if (refreshToken) localStorage.setItem('sm_refresh_token', refreshToken);
    localStorage.setItem(this._k.r, role);
    localStorage.setItem(this._k.u, username);
    localStorage.setItem(this._k.g, team || '');
    localStorage.setItem(this._k.n, displayName || username);
  },
  clear()        { Object.values(this._k).forEach(k => localStorage.removeItem(k)); localStorage.removeItem('sm_refresh_token'); },
  refreshToken() { return localStorage.getItem('sm_refresh_token'); },
  token()        { return localStorage.getItem(this._k.t); },
  role()         { return localStorage.getItem(this._k.r); },
  username()     { return localStorage.getItem(this._k.u); },
  team()         { return localStorage.getItem(this._k.g) || ''; },
  displayName()  { return localStorage.getItem(this._k.n) || this.username(); },
  loggedIn()     { return !!this.token(); },   // 만료 여부는 서버에 맡김
  isAdmin()      { return this.role() === 'admin'; },

  /* 토큰 페이로드에서 만료까지 남은 ms (음수 = 만료) */
  _msUntilExpiry() {
    try {
      const t = this.token(); if (!t) return -1;
      const b64 = t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const p = JSON.parse(atob(b64.padEnd(b64.length+(4-b64.length%4)%4,'=')));
      return p.exp ? (p.exp * 1000) - Date.now() : Infinity;
    } catch { return -1; }
  },

  /* refreshToken으로 accessToken 조용히 갱신 — Promise 반환 */
  _refreshPromise: null,
  async _doRefresh() {
    const rt = this.refreshToken();
    if (!rt) throw new Error('no_refresh_token');
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ refreshToken: rt })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'refresh_failed');
    localStorage.setItem('sm_token', data.token);
    if (data.refreshToken) localStorage.setItem('sm_refresh_token', data.refreshToken);
    return data.token;
  },
  /* 중복 갱신 방지: 동시에 여러 요청이 만료 시 1번만 갱신 */
  silentRefresh() {
    if (!this._refreshPromise) {
      this._refreshPromise = this._doRefresh().finally(() => { this._refreshPromise = null; });
    }
    return this._refreshPromise;
  },

  /* 페이지 진입 시 호출 — 만료 임박/만료 시 갱신 후 계속, 실패 시 로그인 페이지 */
  async guard(role) {
    if (!this.token()) {
      if (sessionStorage.getItem('sm_expired')) {}
      location.href = '/pages/index.html'; return false;
    }
    /* 만료까지 2분 미만이면 선제 갱신 */
    if (this._msUntilExpiry() < 120_000 && this.refreshToken()) {
      try { await this.silentRefresh(); }
      catch {
        this.clear();
        sessionStorage.setItem('sm_expired', '1');
        location.href = '/pages/index.html'; return false;
      }
    }
    if (role && this.role() !== role) {
      location.href = this.isAdmin() ? '/pages/admin.html' : '/pages/user.html';
      return false;
    }
    /* 만료 1분 전 자동 갱신 타이머 세팅 */
    this._scheduleRefresh();
    return true;
  },

  _refreshTimer: null,
  _scheduleRefresh() {
    clearTimeout(this._refreshTimer);
    const ms = this._msUntilExpiry();
    if (ms <= 0 || ms === Infinity) return;
    /* 만료 60초 전에 갱신 */
    const delay = Math.max(ms - 60_000, 5_000);
    this._refreshTimer = setTimeout(async () => {
      if (!this.refreshToken()) return;
      try { await this.silentRefresh(); this._scheduleRefresh(); }
      catch { /* 다음 API 호출 시 401로 처리 */ }
    }, delay);
  },

  logout() { this.clear(); clearTimeout(this._refreshTimer); location.href = '/pages/index.html'; }
};

/* ── API CLIENT ────────────────────────────────────────── */
const api = {
  async _req(method, path, body, _retry = false) {
    let res;
    try {
      res = await fetch('/api' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(auth.token() ? { 'Authorization': `Bearer ${auth.token()}` } : {})
        },
        cache: 'no-store',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
    } catch { throw new Error('네트워크 연결을 확인해주세요.'); }

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch {
      console.error(`[API] Non-JSON ${res.status} ${method} ${path}:`, text.slice(0,200));
      throw new Error(`서버 오류 (${res.status})`);
    }

    if (res.status === 401) {
      /* 토큰 만료 → 갱신 후 1회 재시도 */
      if (!_retry && data.code === 'TOKEN_EXPIRED' && auth.refreshToken()) {
        try {
          await auth.silentRefresh();
          return api._req(method, path, body, true);  // 재시도
        } catch {
          /* 갱신 실패 → 로그아웃 */
        }
      }
      toast('세션이 만료됐습니다. 다시 로그인해 주세요.', 'warning');
      setTimeout(() => auth.logout(), 1800);
      throw new Error(data.error || '세션 만료');
    }
    if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
    return data;
  },

  login: async b => {
    const d = await api._req('POST', '/auth/login', b);
    if (d.refreshToken) localStorage.setItem('sm_refresh_token', d.refreshToken);
    return d;
  },
  refreshToken:  b  => api._req('POST',  '/auth/refresh', b),
  logout:        b  => api._req('POST',  '/auth/logout', b),
  register:      b  => api._req('POST',  '/auth/register', b),
  me:            () => api._req('GET',   '/auth/me'),
  updateProfile: b  => api._req('PATCH', '/auth/profile', b),

  rooms:         () => api._req('GET',   '/rooms'),
  roomsAll:      () => api._req('GET',   '/rooms/all'),
  updateRoom:    (id,b) => api._req('PATCH', `/rooms/${id}`, b),

  createReservation:  b  => api._req('POST',  '/reservations', b),
  myReservations:     () => api._req('GET',   '/reservations/mine'),
  teamReservations:   () => api._req('GET',   '/reservations/team'),
  cancelReservation:  (id, series=false) => api._req('PATCH', `/reservations/${id}/cancel${series ? '?series=true' : ''}`),
  updateReservation:  (id, b) => api._req('PATCH', `/reservations/${id}`, b),
  exportReservationsCsv: (q='') => fetch(`/api/reservations/export.csv${q}`, { headers: { 'Authorization': `Bearer ${auth.token()}` }, cache: 'no-store' }),
  calendarAll:        () => api._req('GET',   '/reservations/calendar'),
  allReservations:    (q='') => api._req('GET', `/reservations/all${q}`),
  stats:              () => api._req('GET',   '/reservations/stats'),
  publicStats:        () => api._req('GET',   '/reservations/public-stats'),
  roomStatus:         (q='') => api._req('GET', `/reservations/room-status${q}`),

  favorites:        () => api._req('GET',    '/favorites'),
  addFavorite:      b  => api._req('POST',   '/favorites', b),
  removeFavorite:   id => api._req('DELETE', `/favorites/${id}`),

  userList:         () => api._req('GET',    '/users'),
  userStats:        () => api._req('GET',    '/users/stats'),
  updateUser:       (id,b) => api._req('PATCH', `/users/${id}`, b),
  resetUserPw:      (id,b) => api._req('POST',  `/users/${id}/reset-password`, b),
  deleteUser:       id => api._req('DELETE', `/users/${id}`),
  exportCSV:        () => fetch('/api/users/export-csv', {
    headers: { 'Authorization': `Bearer ${auth.token()}` },
    cache: 'no-store'
  }),

  notifList:         () => api._req('GET',    '/notifications'),
  notifUnread:       () => api._req('GET',    '/notifications/unread-count'),
  notifRead:         id => api._req('PATCH',  `/notifications/${id}/read`),
  notifReadAll:      () => api._req('PATCH',  '/notifications/read-all'),
  notifCreate:       b  => api._req('POST',   '/notifications', b),
  notifAdminList:    () => api._req('GET',    '/notifications/admin'),
  notifDelete:       id => api._req('DELETE', `/notifications/${id}`),

  sessions:        (q='') => api._req('GET',  `/files/sessions${q}`),
  session:         id     => api._req('GET',  `/files/sessions/${id}`),
  saveNote:        (id,b) => api._req('PUT',  `/files/sessions/${id}/note`, b),

  tasks:           id     => api._req('GET',    `/reservations/${id}/tasks`),
  createTask:      (id,b) => api._req('POST',   `/reservations/${id}/tasks`, b),
  toggleTask:      id     => api._req('PATCH',  `/tasks/${id}/toggle`),
  updateTask:      (id,b) => api._req('PATCH',  `/tasks/${id}`, b),
  deleteTask:      id     => api._req('DELETE', `/tasks/${id}`),
  filesByRes:      id     => api._req('GET',  `/files/by-reservation/${id}`),
  uploadFile:      fd     => {
    return fetch('/api/files/upload', {
      method:'POST',
      headers:{ Authorization:`Bearer ${auth.token()}` },
      cache: 'no-store',
      body: fd
    }).then(async r=>{
      const t=await r.text(); let d;
      try{d=JSON.parse(t);}catch{throw new Error(`서버 오류 (${r.status})`);}
      if(!r.ok) throw new Error(d.error||`업로드 실패 (${r.status})`);
      return d;
    });
  },
  downloadFile:    id     => fetch(`/api/files/${id}/download`, { headers:{ Authorization:`Bearer ${auth.token()}` }, cache: 'no-store' }),
  updateFile:      (id,b) => api._req('PATCH', `/files/${id}`, b),
  deleteFile:      id     => api._req('DELETE',`/files/${id}`),
  teamFiles:       (q='') => api._req('GET',  `/files/team${q}`),
  searchFiles:     (q='') => api._req('GET',  `/files/search${q}`),
  addLink:         b      => api._req('POST',  '/files/links', b),
  removeLink:      id     => api._req('DELETE',`/files/links/${id}`),
  storageStats:    ()     => api._req('GET',   '/files/storage-stats'),
};

/* ── TOAST ─────────────────────────────────────────────── */
function toast(msg, type='success', duration=3500) {
  const PAL={ success:'#22c55e', error:'#ef4444', warning:'#f59e0b', info:'#3b82f6' };
  const ICONS={ success:'bi-check-circle-fill', error:'bi-x-circle-fill', warning:'bi-exclamation-triangle-fill', info:'bi-info-circle-fill' };
  let stack=document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el=document.createElement('div');
  el.className='toast';
  el.setAttribute('role','alert');
  el.innerHTML=`
    <i class="bi ${ICONS[type] || 'bi-info-circle-fill'}" style="color:${PAL[type]};font-size:18px;flex-shrink:0;"></i>
    <span style="flex:1;font-family:var(--font-body);">${msg}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--txt4);cursor:pointer;padding:0 0 0 12px;font-size:16px;line-height:1;transition:color 0.2s;" onmouseover="this.style.color='var(--txt)'" onmouseout="this.style.color='var(--txt4)'">×</button>
  `;
  stack.appendChild(el);
  const t=setTimeout(()=>{ el.classList.add('removing'); el.addEventListener('animationend',()=>el.remove(),{once:true}); }, duration);
  el.querySelector('button').addEventListener('click',()=>clearTimeout(t));
}

/* ── HELPERS ────────────────────────────────────────────── */
function fmtDate(ds) {
  const d=new Date(ds+'T00:00:00');
  const M=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const W=['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}년 ${M[d.getMonth()]} ${d.getDate()}일 (${W[d.getDay()]})`;
}
function relTime(dt) {
  const diff=Date.now()-new Date(dt).getTime(), m=Math.floor(diff/60000), h=Math.floor(m/60), dd=Math.floor(h/24);
  if(m<1)  return '방금 전';
  if(m<60) return `${m}분 전`;
  if(h<24) return `${h}시간 전`;
  if(dd<7) return `${dd}일 전`;
  return new Date(dt).toLocaleDateString('ko-KR',{month:'short',day:'numeric'});
}
async function downloadCSV() {
  try {
    const res = await api.exportCSV();
    if (!res.ok) throw new Error('다운로드 실패');
    const blob  = await res.blob();
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `studymate_reservations_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  } catch(e) { toast(e.message,'error'); }
}

/* ── THEME MANAGER ─────────────────────────────────────── */
const theme = {
  get() { return localStorage.getItem('sm_theme') || 'light'; },
  set(t) {
    localStorage.setItem('sm_theme', t);
    document.documentElement.setAttribute('data-theme', t);
    this.updateUI(t);
  },
  toggle() { const next = this.get() === 'dark' ? 'light' : 'dark'; this.set(next); return next; },
  init() { const active = this.get(); document.documentElement.setAttribute('data-theme', active); this.updateUI(active); },
  updateUI(t) {
    const icons = document.querySelectorAll('.theme-icon-el, #theme-icon');
    icons.forEach(icon => {
      const isLegacy = icon.id === 'theme-icon';
      if (t === 'dark') { icon.className = isLegacy ? 'bi bi-sun-fill' : 'bi bi-sun-fill theme-icon-el'; }
      else              { icon.className = isLegacy ? 'bi bi-moon-stars-fill' : 'bi bi-moon-stars-fill theme-icon-el'; }
    });
  }
};

window.auth=auth; window.api=api; window.toast=toast;
window.fmtDate=fmtDate; window.relTime=relTime; window.downloadCSV=downloadCSV;
window.theme=theme;

theme.init();
document.addEventListener('DOMContentLoaded', () => theme.init());

/* ── EMPTY STATE ──────────────────────────────────────── */
function emptyState(icon, title, desc='', btnHtml='') {
  return `<div style="text-align:center;padding:48px 20px;color:var(--txt3);">
    <i class="bi bi-${icon}" style="font-size:36px;display:block;margin-bottom:12px;opacity:.2;"></i>
    <p style="font-size:14px;font-weight:600;color:var(--txt2);margin-bottom:4px;">${title}</p>
    ${desc ? `<p style="font-size:12.5px;">${desc}</p>` : ''}
    ${btnHtml ? `<div style="margin-top:14px;">${btnHtml}</div>` : ''}
  </div>`;
}
window.emptyState = emptyState;
