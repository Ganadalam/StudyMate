'use strict';
/* ══════════════════════════════════════════════════════
   user-render.js — 렌더 · UI 헬퍼 · 이벤트 없는 순수 함수
   user.html 에서 분리됨 
══════════════════════════════════════════════════════ */

function toggleSb(){ document.getElementById('sb').classList.toggle('collapsed'); }
function openMobileSidebar(){
  const sb=document.getElementById('sb');
  const bd=document.getElementById('sidebar-backdrop');
  sb.classList.add('mobile-open');
  bd.classList.add('visible');
  document.body.style.overflow='hidden';
}
function closeMobileSidebar(){
  const sb=document.getElementById('sb');
  const bd=document.getElementById('sidebar-backdrop');
  sb.classList.remove('mobile-open');
  bd.classList.remove('visible');
  document.body.style.overflow='';
}
function goPage(name,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(window.innerWidth<=680) closeMobileSidebar();
  if(name==='history')  { loadHist(); }
  if(name==='favorites'){ loadFavorites(); }
  if(name==='sessions') { loadSessions(); }
  if(name==='library')  { loadLibrary(); }
  if(name==='search')   { initSearchDates(); }
}

/* ── 검색 날짜 초기화 ─────────────────────────────────── */
function initSearchDates(){
  const today=todayStr();
  if(window._fpFrom){ if(!window._fpFrom.selectedDates.length) window._fpFrom.setDate(today,true); }
  else { const el=document.getElementById('srch-from'); if(el&&!el.value) el.value=today; }
  if(window._fpTo){ if(!window._fpTo.selectedDates.length) window._fpTo.setDate(getMonthEnd(today),true); }
  else { const el=document.getElementById('srch-to'); if(el&&!el.value) el.value=getMonthEnd(today); }
}

/* ── ROOM TABS ───────────────────────────────────────── */
function renderRoomTabs(){
  const rooms=roomsData.length?roomsData:[
    {name:'Room A',display_name:'Room A',capacity:4,description:'',amenities:'',color:'#818cf8'},
    {name:'Room B',display_name:'Room B',capacity:8,description:'',amenities:'',color:'#38bdf8'},
    {name:'Room C',display_name:'Room C',capacity:16,description:'',amenities:'',color:'#fb923c'},
    {name:'Room D',display_name:'Room D',capacity:10,description:'',amenities:'',color:'#f472b6'},
  ];
  document.getElementById('room-tabs').innerHTML=rooms.map(r=>
    `<button class="room-tab ${r.name===selectedRoom?'active':''}" onclick="selectRoomTab('${r.name}',this)"
      style="color:${r.name===selectedRoom?r.color:'var(--txt3)'};">
      ${ROOM_EMO[r.name]||'🚪'} ${r.name.replace('Room ','')}
    </button>`
  ).join('');
  document.getElementById('room-opts').innerHTML=rooms.map(r=>
    `<div class="room-opt ${r.name===selectedRoom?'selected':''}" data-room="${r.name}" data-action="selectRoom" style="${r.name===selectedRoom?`border-color:${r.color};background:${r.color}18`:''}">
      <div class="room-opt-check" style="background:${r.color};">✓</div>
      <div class="room-opt-name" style="color:${r.color};">${ROOM_EMO[r.name]||'🚪'} ${r.name}</div>
      <div class="room-opt-desc">최대 ${r.capacity}인</div>
    </div>`
  ).join('');
  renderRoomDetail(selectedRoom);
}
function selectRoomTab(name,btn){
  selectedRoom=name;
  document.querySelectorAll('.room-tab').forEach(b=>{b.classList.remove('active');b.style.color='var(--txt3)';});
  const r=roomsData.find(x=>x.name===name)||{color:'var(--blue)'};
  btn.classList.add('active'); btn.style.color=r.color;
  document.querySelectorAll('.room-opt').forEach(o=>{o.classList.remove('selected');o.style.borderColor='';o.style.background='';});
  const opt=document.querySelector(`.room-opt[data-room="${name}"]`);
  if(opt){opt.classList.add('selected');opt.style.borderColor=r.color;opt.style.background=r.color+'18';}
  renderRoomDetail(name); updatePreview();
}
function selectRoom(el){
  const name=el.dataset.room;
  const tabs=document.querySelectorAll('.room-tab');
  const idx=['Room A','Room B','Room C','Room D'].indexOf(name);
  if(idx>=0&&tabs[idx]) selectRoomTab(name,tabs[idx]);
}
function renderRoomDetail(name){
  const r=roomsData.find(x=>x.name===name);
  const el=document.getElementById('room-detail');
  if(!r||!r.description){el.style.display='none';return;}
  el.style.display='';
  const amenList=r.amenities?r.amenities.split(',').map(a=>
    `<span style="font-size:10.5px;padding:2px 7px;border-radius:4px;background:${r.color}15;color:${r.color};border:1px solid ${r.color}30;white-space:nowrap;">${a.trim()}</span>`
  ).join(''):'';
  el.innerHTML=`<div style="font-size:12px;color:var(--txt2);margin-bottom:8px;">${r.description}</div>${amenList?`<div style="display:flex;flex-wrap:wrap;gap:4px;">${amenList}</div>`:''}`;
}

/* ── TODAY WIDGET ────────────────────────────────────── */
function renderTodayWidget(){
  const today=todayStr();
  const mine=myResData.filter(r=>r.date===today&&r.status==='confirmed').sort((a,b)=>a.start_time.localeCompare(b.start_time));
  const widget=document.getElementById('today-widget');
  if(!mine.length){widget.style.display='none';return;}
  widget.style.display='';
  document.getElementById('today-count').textContent=`${mine.length}건`;
  document.getElementById('today-list').innerHTML=mine.map(r=>{
    const col=ROOM_COL[r.room_name]||'var(--blue)';
    return `<div class="today-item">
      <div class="today-time">${r.start_time}~${r.end_time}</div>
      <div style="width:3px;height:28px;border-radius:99px;background:${col};flex-shrink:0;"></div>
      <div><div class="today-room" style="color:${col};">${r.room_name}</div>${r.purpose?`<div class="today-purpose">${r.purpose}</div>`:''}</div>
      <button class="btn-danger" style="margin-left:auto;font-size:10px;padding:3px 8px;" onclick="cancelRes(${r.id})"><i class="bi bi-x"></i></button>
    </div>`;
  }).join('');
}

/* ── CALENDAR ────────────────────────────────────────── */
function setView(v){calView=v;document.getElementById('vbtn-month').classList.toggle('active',v==='month');document.getElementById('vbtn-week').classList.toggle('active',v==='week');renderCal();}
function moveMonth(delta){
  if(calView==='week'){const ref=selectedDate?new Date(selectedDate+'T00:00:00'):new Date(calY,calM,1);ref.setDate(ref.getDate()+delta*7);calY=ref.getFullYear();calM=ref.getMonth();}
  else{calM+=delta;if(calM>11){calM=0;calY++;}if(calM<0){calM=11;calY--;}}
  renderCal();
}
function toggleFP(key){FP[key]=!FP[key];document.getElementById('fp-'+key).classList.toggle('on',FP[key]);renderCal();}
function buildDateMap(){
  const map={},myIds=new Set(myResData.filter(r=>r.status==='confirmed').map(r=>r.id));
  if(FP.mine) myResData.filter(r=>r.status==='confirmed').forEach(r=>{(map[r.date]||(map[r.date]=[])).push({...r,_mine:true});});
  allCalData.forEach(r=>{const l=r.room_name.replace('Room ','');if(!FP[l])return;if(!map[r.date])map[r.date]=[];if(!map[r.date].find(x=>x.id===r.id))map[r.date].push({...r,_mine:myIds.has(r.id)});});
  return map;
}
function renderCal(){const today=todayStr(),dm=buildDateMap();calView==='month'?renderMonthView(today,dm):renderWeekView(today,dm);}
function renderMonthView(today,dm){
  document.getElementById('cal-title').textContent=`${calY}년 ${MONTHS[calM]}`;
  const fd=new Date(calY,calM,1).getDay(),days=new Date(calY,calM+1,0).getDate();
  let html='';
  for(let i=0;i<fd;i++) html+='<div class="cal-cell ec"></div>';
  for(let d=1;d<=days;d++){
    const ds=dStr(calY,calM,d),recs=dm[ds]||[],past=ds<today;
    const cls='cal-cell'+(past?' pc':'')+(ds===today?' tc':'')+(ds===selectedDate?' sc':'');
    html+=`<div class="${cls}" ${!past?`onclick="pickDate('${ds}')"`:''}><span class="cal-num">${d}</span><div class="dots-row">${buildDots(recs)}</div></div>`;
  }
  document.getElementById('cal-days').innerHTML=html;
}
function renderWeekView(today,dm){
  const ref=selectedDate?new Date(selectedDate+'T00:00:00'):new Date(calY,calM,1);
  const start=new Date(ref);start.setDate(start.getDate()-start.getDay());
  const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
  const s=days[0],e=days[6];
  document.getElementById('cal-title').textContent=s.getMonth()===e.getMonth()?`${calY}년 ${MONTHS[s.getMonth()]} ${s.getDate()}~${e.getDate()}일`:`${MONTHS[s.getMonth()]} ${s.getDate()} ~ ${MONTHS[e.getMonth()]} ${e.getDate()}`;
  let html='';
  for(const d of days){
    const ds=dStr(d.getFullYear(),d.getMonth(),d.getDate()),recs=dm[ds]||[],past=ds<today;
    const cls='cal-cell'+(past?' pc':'')+(ds===today?' tc':'')+(ds===selectedDate?' sc':'');
    html+=`<div class="${cls}" style="min-height:58px;" ${!past?`onclick="pickDate('${ds}')"`:''}><span class="cal-num">${d.getDate()}</span><div class="dots-row" style="flex-wrap:wrap;max-width:42px;">${buildDots(recs)}</div></div>`;
  }
  document.getElementById('cal-days').innerHTML=html;
}
function buildDots(recs){
  const myIds=new Set(myResData.filter(r=>r.status==='confirmed').map(r=>r.id));
  const dots=[],seenRooms=new Set();
  if(recs.find(r=>myIds.has(r.id))&&FP.mine) dots.push(`<div class="cal-dot" style="background:var(--green);box-shadow:0 0 4px rgba(34,197,94,.5);"></div>`);
  for(const r of recs){if(myIds.has(r.id))continue;const l=r.room_name.replace('Room ','');if(!FP[l]||seenRooms.has(r.room_name))continue;seenRooms.add(r.room_name);dots.push(`<div class="cal-dot" style="background:${ROOM_COL[r.room_name]};"></div>`);if(dots.length>=4)break;}
  if(recs.length>4) dots.push(`<div style="font-size:7.5px;color:var(--txt3);font-weight:700;">+${recs.length-4}</div>`);
  return dots.join('');
}
function pickDate(ds){
  selectedDate=ds;renderCal();
  const dt=new Date(ds+'T00:00:00');
  document.getElementById('sel-date-lbl').textContent=`${dt.getFullYear()}년 ${MONTHS[dt.getMonth()]} ${dt.getDate()}일 (${WDS[dt.getDay()]})`;
  updatePreview(); renderPrediction(ds); showDayPopup(ds);
}

/* ── DAY POPUP ───────────────────────────────────────── */
function setPopTab(tab,btn){popTab=tab;document.querySelectorAll('.pop-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderPopupBody();}
function showDayPopup(ds){
  popupDate=ds; popTab='team';
  document.getElementById('ptab-team').classList.add('active');
  document.getElementById('ptab-all').classList.remove('active');
  const dt=new Date(ds+'T00:00:00');
  document.getElementById('pop-day').textContent=dt.getDate();
  document.getElementById('pop-sub').textContent=`${dt.getFullYear()}년 ${MONTHS[dt.getMonth()]} ${dt.getDate()}일 (${WDS[dt.getDay()]})`;
  renderPopupBody();
  document.getElementById('popup').style.display='flex';
  document.body.style.overflow='hidden';
}
function renderPopupBody(){
  const myIds=new Set(myResData.filter(r=>r.status==='confirmed').map(r=>r.id));
  const dayRecs=allCalData.filter(r=>r.date===popupDate).sort((a,b)=>a.start_time.localeCompare(b.start_time));
  const body=document.getElementById('pop-body');
  if(!dayRecs.length){body.innerHTML=`<div class="pop-empty"><i class="bi bi-calendar-x" style="font-size:26px;display:block;margin-bottom:8px;opacity:.22;"></i><p>이 날 예약이 없습니다</p></div>`;return;}
  let html='';
  if(popTab==='team'){
    const myTeamRecs=dayRecs.filter(r=>r.team===myTeam);
    const mySlots=new Set(myTeamRecs.map(r=>r.start_time));
    const conflicts=dayRecs.filter(r=>r.team!==myTeam&&mySlots.has(r.start_time));
    if(myTeamRecs.length){html+=`<div class="pop-section-lbl">🏢 ${myTeam||'내 팀'} 예약 (${myTeamRecs.length}건)</div>`;html+=myTeamRecs.map(r=>rcCard(r,myIds)).join('');}
    if(conflicts.length){html+=`<div class="pop-section-lbl" style="margin-top:4px;">⚠️ 동일 시간대 타 팀</div>`;html+=conflicts.map(r=>rcCard(r,myIds,true)).join('');}
    if(!myTeamRecs.length) html=`<div class="pop-empty"><i class="bi bi-calendar-x" style="font-size:26px;display:block;margin-bottom:8px;opacity:.22;"></i><p>내 팀 예약이 없습니다</p></div>`;
  } else {
    html+=`<div class="pop-section-lbl">📋 전체 예약 (${dayRecs.length}건)</div>`;
    html+=dayRecs.map(r=>rcCard(r,myIds)).join('');
  }
  body.innerHTML=html;
}
function rcCard(r,myIds,isConflict=false){
  const isMine=myIds.has(r.id),col=ROOM_COL[r.room_name]||'var(--blue)',bg=ROOM_BG[r.room_name]||'rgba(49,130,246,.12)';
  return `<div class="rc" style="--rc-col:${col};">
    <div style="width:32px;height:32px;border-radius:var(--r-sm);background:${bg};display:grid;place-items:center;font-size:14px;flex-shrink:0;">${ROOM_EMO[r.room_name]||'🚪'}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:700;">${r.room_name}</div>
      <div style="font-size:11px;color:var(--txt3);font-family:var(--font-mono);margin-top:2px;">${r.start_time} ~ ${r.end_time}</div>
      <div style="font-size:10.5px;color:var(--txt3);margin-top:2px;"><i class="bi bi-person" style="font-size:9px;"></i>${r.username||'—'}${r.team?` · ${r.team}`:''}</div>
      ${r.purpose?`<div style="font-size:10px;color:var(--txt3);margin-top:2px;font-style:italic;">"${r.purpose}"</div>`:''}
    </div>
    <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
      <div style="font-size:13px;font-weight:800;color:${col};">${r.headcount}명</div>
      ${isMine?`<span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(34,197,94,.15);color:var(--green);">내 예약</span>
        <button class="btn-danger" style="font-size:10px;padding:2px 7px;" onclick="cancelFromPopup(${r.id})"><i class="bi bi-x"></i>취소</button>`
      :`<span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:4px;background:var(--border);color:var(--txt3);">${isConflict?'⚠️ 충돌':'타인'}</span>`}
    </div>
  </div>`;
}

function closePopupOutside(e){if(e.target===document.getElementById('popup'))hidePopup();}
function hidePopup(){document.getElementById('popup').style.display='none';document.body.style.overflow='';}
function quickReserve(){hidePopup();document.getElementById('f-start').scrollIntoView({behavior:'smooth',block:'center'});}

/* ── TEAM PANEL ──────────────────────────────────────── */
function setTF(val,btn){
  teamFilter=val;
  document.querySelectorAll('.team-filter .tp-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  renderTeamPanel();
}

function renderTeamPanel(){
  const PLABELS={week:'이번 주',month:'이번 달',prev_month:'지난 달',upcoming:'앞으로 30일'};
  const myIds=new Set(myResData.filter(r=>r.status==='confirmed').map(r=>r.id));
  const sd=teamStatusData;
  const pLabel=PLABELS[teamPeriod]||teamPeriod;

  // 헤더 레이블 업데이트
  const nameLbl=document.getElementById('team-name-lbl');
  if(nameLbl) nameLbl.textContent=myTeam
    ?`${myTeam} · ${pLabel}${sd?.dateFrom?` (${sd.dateFrom}~${sd.dateTo})`:''}`:'소속팀 없음';

  // 기간 요약 (룸별 건수)
  const summEl=document.getElementById('team-period-summary');
  if(summEl){
    if(sd?.byRoom?.length){
      summEl.style.display='';
      const total=sd.byRoom.reduce((a,r)=>a+r.count,0);
      const pills=sd.byRoom.map(r=>{
        const col=ROOM_COL[r.room_name]||'var(--blue)';
        return `<span style="display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:4px;background:${col}18;color:${col};font-weight:700;">${ROOM_EMO[r.room_name]||'🚪'}${r.room_name.replace('Room ','')} ${r.count}</span>`;
      }).join('');
      summEl.innerHTML=`<span style="color:var(--txt3);margin-right:6px;">총 ${total}건</span>${pills}`;
    } else summEl.style.display='none';
  }

  // 예약 목록 - roomStatus API 기반 (기간 내 전체)
  const allRecs=(sd?.reservations||[]);
  let data=allRecs.filter(r=>!myTeam||r.team===myTeam);
  if(teamFilter==='mine')        data=data.filter(r=>myIds.has(r.id));
  else if(teamFilter!=='all')    data=data.filter(r=>r.room_name.endsWith(teamFilter));

  const badge=document.getElementById('team-count-badge');
  if(badge){ badge.style.display=data.length?'':'none'; if(data.length) badge.textContent=`${data.length}건`; }

  const body=document.getElementById('team-body');
  if(!data.length){
    body.innerHTML=`<div style="text-align:center;padding:28px;color:var(--txt3);font-size:13px;">
      <i class="bi bi-calendar-x" style="font-size:26px;display:block;margin-bottom:8px;opacity:.2;"></i>
      <p>${!myTeam?'소속팀을 설정하면 팀 예약이 표시됩니다':pLabel+' 해당 예약이 없습니다'}</p>
    </div>`;
    return;
  }

  const today=todayStr(), groups={};
  data.forEach(r=>{ (groups[r.date]||(groups[r.date]=[])).push(r); });
  body.innerHTML=Object.keys(groups).sort().map(ds=>{
    const dt=new Date(ds+'T00:00:00'), isToday=ds===today, isPast=ds<today;
    const lbl=isToday?'오늘':`${MONTHS[dt.getMonth()]} ${dt.getDate()}일 (${WDS[dt.getDay()]})`;
    const rows=groups[ds].sort((a,b)=>a.start_time.localeCompare(b.start_time)).map(r=>{
      const isMine=myIds.has(r.id), col=ROOM_COL[r.room_name]||'var(--blue)';
      return `<div class="trr" style="${isPast?'opacity:.55':''}">
        <div class="trr-bar" style="background:${col};"></div>
        <div class="trr-info">
          <div class="trr-room" style="color:${col};">${ROOM_EMO[r.room_name]||'🚪'} ${r.room_name}</div>
          <div class="trr-time">${r.start_time} ~ ${r.end_time}</div>
          <div class="trr-who"><i class="bi bi-person" style="font-size:9px;"></i>${r.display_name||r.username||'—'}${r.team?` · ${r.team}`:''}${r.purpose?` — ${r.purpose}`:''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
          <span class="badge" style="background:${col}20;color:${col};font-size:10.5px;">${r.headcount}명</span>
          ${isMine&&!isPast?`<button class="btn-danger" style="font-size:10px;padding:2px 7px;" onclick="cancelTeamRes(${r.id})"><i class="bi bi-x"></i>취소</button>`
            :`<span style="font-size:9.5px;color:var(--txt3);">${isMine?'✓내 예약':'타인'}</span>`}
        </div>
      </div>`;
    }).join('');
    return `<div>
      <div class="tdl">${lbl}
        ${isToday?'<span class="today-badge">TODAY</span>':''}
        ${isPast?'<span style="font-size:9px;color:var(--txt3);padding:1px 5px;border-radius:3px;background:var(--border);">완료</span>':''}
      </div>${rows}
    </div>`;
  }).join('');
}


function updatePreview(){
  const s=document.getElementById('f-start').value,e=document.getElementById('f-end').value;
  const ok=selectedDate&&s&&e;
  document.getElementById('prev-empty').style.display=ok?'none':'';
  document.getElementById('prev-filled').style.display=ok?'':'none';
  document.getElementById('prev-sub').textContent=ok?'예약 내용을 확인하세요':'날짜·시간을 선택하세요';
  const readyEl=document.getElementById('prev-ready');
  if(!ok){readyEl.style.display='none';return;}
  const dt=new Date(selectedDate+'T00:00:00'),col=ROOM_COL[selectedRoom]||'var(--blue)';
  document.getElementById('prev-day-big').textContent=dt.getDate();
  document.getElementById('prev-monyear').textContent=`${dt.getFullYear()}년 ${MONTHS[dt.getMonth()]}`;
  document.getElementById('prev-wd').textContent=WDS[dt.getDay()]+'요일';
  document.getElementById('prev-room').textContent=selectedRoom;
  document.getElementById('prev-time').textContent=`${s} ~ ${e}`;
  document.getElementById('prev-hc').innerHTML=crowdBadge(hc);
  const conflicts=allCalData.filter(r=>r.date===selectedDate&&r.room_name===selectedRoom&&r.start_time<e&&r.end_time>s);
  const conflictWrap=document.getElementById('prev-conflict');
  if(conflicts.length){
    conflictWrap.style.display='';
    const myIds=new Set(myResData.filter(x=>x.status==='confirmed').map(x=>x.id));
    document.getElementById('prev-conflict-list').innerHTML=conflicts.map(r=>
      `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);border-radius:var(--r-sm);margin-bottom:4px;font-size:12px;">
        <div><span style="font-weight:700;color:var(--red);">${r.start_time}~${r.end_time}</span><span style="color:var(--txt3);margin-left:6px;">${r.username||'—'}${r.team?` (${r.team})`:''}</span></div>
        <span style="font-size:11px;font-weight:700;color:var(--red);">${r.headcount}명</span>
      </div>`
    ).join('');
    readyEl.className='badge';readyEl.style.cssText='background:rgba(239,68,68,.15);color:var(--red);';
    readyEl.innerHTML='<i class="bi bi-exclamation-triangle-fill"></i> 시간 충돌';readyEl.style.display='';
  } else {
    conflictWrap.style.display='none';
    readyEl.className='badge badge-green';readyEl.style.cssText='';
    readyEl.innerHTML='<i class="bi bi-check-circle-fill"></i> 예약 가능';readyEl.style.display='';
  }
  const roomDayRecs=allCalData.filter(r=>r.date===selectedDate&&r.room_name===selectedRoom).sort((a,b)=>a.start_time.localeCompare(b.start_time));
  const tlWrap=document.getElementById('prev-timeline');
  if(roomDayRecs.length){
    tlWrap.style.display='';document.getElementById('prev-timeline-room').textContent=selectedRoom;
    document.getElementById('prev-timeline-list').innerHTML=roomDayRecs.map(r=>{
      const isConflict=r.start_time<e&&r.end_time>s;
      const borderCol = ROOM_COL[r.room_name] || 'var(--blue)';
      const inlineStyle = isConflict ? '' : `border-left-color:${borderCol};`;
      return `<div class="prev-timeline-block ${isConflict ? 'conflict' : ''}" style="${inlineStyle}">
        <div>
          <span style="font-family:var(--font-mono);font-weight:700;">${r.start_time}~${r.end_time}</span>
          <span style="margin-left:8px;color:var(--txt3);">${r.username||'—'}${r.team ? ` (${r.team})` : ''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-weight:700;">${r.headcount}명</span>
          ${isConflict ? '<span>⚠️</span>' : ''}
        </div>
      </div>`;
    }).join('');
  } else tlWrap.style.display='none';
}

/* ── PREDICTION ──────────────────────────────────────── */
function renderPrediction(ds){
  if(!predStats) return;
  const dt=new Date(ds+'T00:00:00'), dow=dt.getDay();
  const ALL_SLOTS=['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
  const dayDetail=(predStats.byDateRoom||[]).filter(r=>r.date===ds);
  const isRealData=dayDetail.length>0;
  document.getElementById('pred-sub').textContent=`${MONTHS[dt.getMonth()]} ${dt.getDate()}일 (${WDS[dow]}) ${isRealData?'실제+평균':'평균 예측'}`;
  const hours=predStats.byHour||[];
  const maxAvg=Math.max(...hours.map(h=>h.total_headcount),1);
  const mult=[0.3,0.85,1.0,1.1,1.05,0.75,0.2][dow];
  let notice='';
  if(!isRealData){
    notice=`<div style="background:rgba(49,130,246,.08);border:1px solid rgba(49,130,246,.08);border-radius:var(--r-sm);padding:7px 10px;font-size:11px;color:var(--blue);margin-bottom:8px;display:flex;gap:5px;align-items:center;">${dow===0||dow===6?'🌙 주말':'📊 과거 통계'} — 과거 평균치 기반 예측입니다</div>`;
  } else {
    notice=`<div style="display:flex;gap:12px;align-items:center;padding:7px 10px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:8px;font-size:11px;flex-wrap:wrap;">
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:4px;border-radius:2px;background:var(--blue);display:inline-block;"></span>실제 예약 현황</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:4px;border-radius:2px;background:rgba(49,130,246,.08);display:inline-block;"></span>시간대별 평균</span>
    </div>`;
  }
  const rows=ALL_SLOTS.map(slot=>{
    const slotRecs=dayDetail.filter(r=>r.start_time===slot);
    const avgStat=hours.find(h=>h.start_time===slot);
    const avgPct=avgStat?Math.min(100,Math.round((avgStat.total_headcount/maxAvg)*mult*100)):0;
    const realPct=isRealData?Math.min(100,Math.round((slotRecs.length/4)*100)):null;
    const displayPct=realPct!==null?realPct:avgPct;
    const col=displayPct>=75?'var(--red)':displayPct>=50?'var(--orange)':'var(--green)';
    const lbl=displayPct>=75?'혼잡':displayPct>=50?'보통':'여유';
    const pills=slotRecs.map(r=>`<span class="pred-room-pill" style="background:${ROOM_BG[r.room_name]};color:${ROOM_COL[r.room_name]};">${r.room_name.replace('Room ','')} ${r.headcount}명</span>`).join('');
    return `<div class="pred-row">
      <span class="pred-time">${slot}</span>
      <div style="flex:1;position:relative;height:10px;background:var(--bg-surface);border-radius:99px;overflow:hidden;">
        ${isRealData?`<div style="position:absolute;left:0;top:0;height:100%;width:${avgPct}%;background:rgba(49,130,246,.08);border-radius:99px;"></div>`:''}
        <div style="position:absolute;left:0;top:${isRealData?'2px':'0'};height:${isRealData?'6px':'100%'};width:${displayPct}%;background:${col};border-radius:99px;transition:width .7s var(--ease-enter);"></div>
      </div>
      <div class="pred-right">
        <span class="pred-lbl" style="color:${col};">${lbl}${isRealData&&slotRecs.length?` (${slotRecs.length}룸)`:''}</span>
        ${pills?`<div class="pred-rooms">${pills}</div>`:''}
      </div>
    </div>`;
  }).join('');
  document.getElementById('pred-body').innerHTML=`<div class="pred-inner">${notice}${rows}</div>`;
}

/* ── SUBMIT ──────────────────────────────────────────── */
function changeHc(d){hc=Math.max(1,Math.min(10,hc+d));document.getElementById('hc-val').textContent=hc;updatePreview();}

function setHF(val,btn){histFilter=val;document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));btn.classList.add('active');renderHist();}
function renderHist(){
  const today=todayStr();
  const q=((document.getElementById('hist-search')||{}).value||'').toLowerCase();
  let data=histData.filter(r=>(r.room_name+' '+(r.purpose||'')).toLowerCase().includes(q));
  if(histFilter==='upcoming')  data=data.filter(r=>r.status==='confirmed'&&r.date>=today);
  else if(histFilter==='past') data=data.filter(r=>r.status==='confirmed'&&r.date<today);
  else if(histFilter==='cancelled') data=data.filter(r=>r.status==='cancelled');
  else if('ABCD'.includes(histFilter)) data=data.filter(r=>r.room_name.endsWith(histFilter));
  const tbody=document.getElementById('hist-tbody');
  if(!data.length){tbody.innerHTML=`<tr><td colspan="8">${emptyState('calendar-x','예약 내역이 없습니다','예약하기 탭에서 스터디룸을 예약하세요')}</td></tr>`;return;}
  tbody.innerHTML=data.map(r=>{
    const col=ROOM_COL[r.room_name]||'var(--blue)',isPast=r.date<today,isFuture=r.date>=today;
    const isRecur=!!(r.recurrence_rule||r.recurrence_parent_id);
    const recurIcon=isRecur?`<span title="반복 예약" style="color:var(--accent);font-size:11px;margin-left:4px;"><i class="bi bi-arrow-repeat"></i></span>`:'';
    let cancelBtn='';
    if(r.status==='confirmed'&&isFuture){
      cancelBtn=`<div style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="btn-ghost" style="font-size:11.5px;padding:5px 10px;" onclick="editRes(${r.id})"><i class="bi bi-pencil"></i> 수정</button>
        <button class="btn-danger" style="font-size:11.5px;padding:5px 10px;" onclick="cancelRes(${r.id})"><i class="bi bi-x"></i> 취소</button>
        ${isRecur?`<button class="btn-danger" style="font-size:11px;padding:5px 8px;opacity:.75;" onclick="cancelSeriesRes(${r.id})" title="시리즈 전체 취소"><i class="bi bi-arrow-repeat"></i><i class="bi bi-x"></i></button>`:''}
      </div>`;
    } else if(r.status==='confirmed'&&isPast){
      cancelBtn=`<span style="font-size:10.5px;color:var(--txt3);">완료됨</span>`;
    }
    return `<tr class="fade-in" style="${isPast&&r.status==='confirmed'?'opacity:.65':''}">
      <td class="mono">#${r.id}</td>
      <td><span class="room-tag" style="border-color:${col}30;color:${col};"><i class="bi bi-door-open"></i>${r.room_name}</span>${recurIcon}</td>
      <td style="font-weight:500;">${r.date}</td>
      <td style="font-family:var(--font-mono);font-size:12px;">${r.start_time} ~ ${r.end_time}</td>
      <td>${crowdBadge(r.headcount)}</td>
      <td style="font-size:12px;color:var(--txt2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.purpose||'—'}</td>
      <td>${r.status==='confirmed'?'<span class="badge badge-green"><i class="bi bi-check-circle-fill"></i> 확정</span>':'<span class="badge badge-gray"><i class="bi bi-x-circle"></i> 취소됨</span>'}</td>
      <td>${cancelBtn}</td>
    </tr>`;
  }).join('');
}

function changeFavHc(d){ favHc=Math.max(1,Math.min(10,favHc+d)); const el=document.getElementById('fav-hc-val'); if(el) el.textContent=favHc; }
function toggleFavAdd(){ const c=document.getElementById('fav-add-card'); if(!c) return; const open=c.style.display!=='none'; c.style.display=open?'none':''; if(!open) document.getElementById('fav-label')?.focus(); }
function updateFavBadge(){ const b=document.getElementById('fav-badge'); if(!b) return; b.style.display=favData.length?'':'none'; b.textContent=favData.length; }

function toggleFavDropdown(e){
  e.stopPropagation();
  const dd=document.getElementById('fav-dropdown');
  if(!dd) return;
  const open=dd.style.display!=='none';
  if(open){ closeFavDropdown(); return; }
  renderFavDropdown();
  dd.style.display='';
  const ch=document.getElementById('fav-drop-chevron'); if(ch) ch.className='bi bi-chevron-up';
  setTimeout(()=>document.addEventListener('click', _closeFavOnOutside, {once:true}), 0);
}
function _closeFavOnOutside(e){ if(!document.getElementById('fav-dropdown')?.contains(e.target)) closeFavDropdown(); }
function closeFavDropdown(){
  const dd=document.getElementById('fav-dropdown'); if(dd) dd.style.display='none';
  const ch=document.getElementById('fav-drop-chevron'); if(ch) ch.className='bi bi-chevron-down';
}
function renderFavDropdown(){
  const list=document.getElementById('fav-dropdown-list'); if(!list) return;
  if(!favData.length){
    list.innerHTML=`<div style="padding:16px;text-align:center;color:var(--txt3);font-size:12px;"><i class="bi bi-bookmark-star" style="font-size:22px;display:block;margin-bottom:6px;opacity:.25;"></i>저장된 즐겨찾기가 없습니다<br><small>즐겨찾기 탭에서 추가하세요</small></div>`;
    return;
  }
  list.innerHTML=favData.map(f=>{
    const col=ROOM_COL[f.room_name]||'var(--blue)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;transition:background .1s;border-bottom:1px solid var(--border);"
      onmouseover="this.style.background='var(--bg-surface)'" onmouseout="this.style.background=''"
      onclick="applyFavorite(${f.id});closeFavDropdown()">
      <div style="width:30px;height:30px;border-radius:var(--r-sm);background:${col}18;display:grid;place-items:center;flex-shrink:0;font-size:14px;">${ROOM_EMO[f.room_name]||'🚪'}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.label}</div>
        <div style="font-size:10.5px;color:var(--txt3);font-family:var(--font-mono);margin-top:1px;">${f.room_name.replace('Room ','')} · ${f.start_time}~${f.end_time} · ${f.headcount}명</div>
      </div>
      <button onclick="event.stopPropagation();deleteFav(${f.id})" 
        style="background:none;border:none;padding:4px 5px;border-radius:4px;cursor:pointer;color:var(--txt3);flex-shrink:0;"
        onmouseover="this.style.color='var(--red)';this.style.background='rgba(239,68,68,.1)'" 
        onmouseout="this.style.color='var(--txt3)';this.style.background=''"><i class="bi bi-trash3" style="font-size:11px;"></i></button>
    </div>`;
  }).join('');
}

/* 예약하기 탭에서 현재 설정 저장 */

function renderFavorites(){
  const el=document.getElementById('fav-list'); if(!el) return;
  if(!favData.length){
    el.innerHTML=emptyState('bookmark-star','저장된 즐겨찾기가 없습니다','위 버튼으로 추가하거나 예약하기 탭 즐겨찾기 버튼에서 저장하세요');
    return;
  }
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">
    ${favData.map(f=>{
      const col=ROOM_COL[f.room_name]||'var(--blue)';
      return `<div class="card" style="padding:16px;cursor:pointer;transition:border-color .15s,transform .1s;position:relative;"
        onclick="applyFavorite(${f.id})"
        onmouseover="this.style.borderColor='${col}';this.style.transform='translateY(-2px)'"
        onmouseout="this.style.borderColor='';this.style.transform=''">
        <button class="fav-del" style="position:absolute;top:8px;right:8px;" onclick="event.stopPropagation();deleteFav(${f.id})"><i class="bi bi-x"></i></button>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:20px;">${ROOM_EMO[f.room_name]||'🚪'}</span>
          <div style="font-size:13px;font-weight:700;color:${col};">${f.label}</div>
        </div>
        <div style="font-size:12px;color:var(--txt2);">${f.room_name}</div>
        <div style="font-size:11.5px;font-family:var(--font-mono);color:var(--txt3);margin-top:2px;">${f.start_time} ~ ${f.end_time} · ${f.headcount}명</div>
        <div style="margin-top:10px;display:flex;gap:6px;">
          <button class="btn btn-primary" style="flex:1;font-size:11.5px;padding:6px;" onclick="event.stopPropagation();applyFavorite(${f.id})">
            <i class="bi bi-lightning-fill"></i> 예약하기 적용
          </button>
          <button class="btn btn-ghost" style="font-size:11.5px;padding:6px 10px;" onclick="event.stopPropagation();deleteFav(${f.id})">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function applyFavorite(id){
  const f=favData.find(x=>x.id===id); if(!f) return;
  selectedRoom=f.room_name;
  document.getElementById('f-start').value=f.start_time;
  document.getElementById('f-end').value=f.end_time;
  hc=f.headcount; document.getElementById('hc-val').textContent=hc;
  renderRoomTabs();
  goPage('reserve',document.querySelectorAll('.sb-item')[0]);
  updatePreview();
  if(selectedDate){
    renderPrediction(selectedDate);
    toast(`✅ "${f.label}" 적용! 예약 확정을 눌러주세요.`,'success',4000);
  } else {
    setTimeout(()=>document.querySelector('.cal-outer')?.scrollIntoView({behavior:'smooth',block:'center'}),100);
    toast(`📅 "${f.label}" 적용됐습니다. 달력에서 날짜를 선택하세요.`,'info',4500);
  }
}


function setSessionTab(tab,btn){
  sessionTab=tab; sessionPage=1;
  document.querySelectorAll('#stab-mine,#stab-team,#stab-files').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  loadSessions();
}

function buildSessionCard(s){
  const col=ROOM_COL[s.room_name]||'var(--blue)';
  const today=todayStr(),isPast=s.date<today;
  const dt=new Date(s.date+'T00:00:00');
  const card=document.createElement('div');
  card.className='card fade-in';
  card.style.cssText=`overflow:hidden;transition:border-color .2s,transform .15s;cursor:pointer;${isPast?'opacity:.85':''}`;
  card.onmouseenter=()=>{card.style.borderColor=col;card.style.transform='translateY(-2px)';};
  card.onmouseleave=()=>{card.style.borderColor='';card.style.transform='';};
  card.onclick=()=>openSessionModal(s.id);
  const notePreview=s.note?`<div style="font-size:11.5px;color:var(--txt3);margin-top:5px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:400px;">"${s.note}"</div>`:'';
  const fileBadge=s.file_count>0?`<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:rgba(49,130,246,.12);color:var(--blue);"><i class="bi bi-paperclip" style="font-size:10px;"></i>${s.file_count}개</span>`:'';
  const linkBadge=s.link_count>0?`<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:rgba(34,197,94,.1);color:var(--green);"><i class="bi bi-link-45deg" style="font-size:10px;"></i>${s.link_count}개</span>`:'';
  card.innerHTML=`<div style="display:flex;align-items:stretch;">
    <div style="width:4px;background:${col};flex-shrink:0;"></div>
    <div style="flex:1;padding:14px 18px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;flex-wrap:wrap;">
            <span style="font-size:14px;font-weight:700;">${s.date} (${WDS[dt.getDay()]})</span>
            <span class="room-tag" style="border-color:${col}30;color:${col};"><i class="bi bi-door-open"></i>${s.room_name}</span>
            <span style="font-family:var(--font-mono);font-size:12px;color:var(--txt3);">${s.start_time}~${s.end_time}</span>
            ${isPast?'<span class="badge badge-gray" style="font-size:9.5px;">완료</span>':'<span class="badge badge-green" style="font-size:9.5px;">예정</span>'}
          </div>
          <div style="font-size:12.5px;color:var(--txt2);display:flex;align-items:center;gap:12px;">
            <span><i class="bi bi-people" style="font-size:11px;"></i> ${s.display_name||s.username} · ${s.team||'팀 없음'}</span>
            <span><i class="bi bi-person-fill" style="font-size:11px;"></i> ${s.headcount}명</span>
            ${s.purpose?`<span style="color:var(--txt3);">${s.purpose}</span>`:''}
          </div>
          ${notePreview}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;">
          ${fileBadge}${linkBadge}
          <button class="btn btn-primary" style="font-size:11.5px;padding:5px 12px;margin-top:2px;" onclick="event.stopPropagation();openSessionModal(${s.id})">
            <i class="bi bi-folder2-open"></i> 자료 관리
          </button>
        </div>
      </div>
    </div>
  </div>`;
  return card;
}

/* ── SESSION MODAL ───────────────────────────────────── */

document.getElementById('sm-note').addEventListener('input',e=>{
  document.getElementById('sm-note-char').textContent=`${e.target.value.length} / 2000`;
});
function closeSessionModal(){
  document.getElementById('session-modal').style.display='none';
  document.body.style.overflow='';
  currentResId=null; uploadFiles=[]; uploadTags=[];
  // 포커스를 마지막 트리거 요소로 복귀
  if(window._lastSessionTrigger) { window._lastSessionTrigger.focus(); window._lastSessionTrigger=null; }
  if(document.getElementById('page-sessions').classList.contains('active')) loadSessions();
}
function closeSessionOutside(e){if(e.target===document.getElementById('session-modal'))closeSessionModal();}

function isImageFile(name){ return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name||''); }


function renderSessionFiles(files, links){
  const list=document.getElementById('sm-files-list');
  if(!files.length&&!links.length){list.innerHTML=`<div style="text-align:center;padding:14px 0;color:var(--txt3);font-size:12.5px;"><i class="bi bi-paperclip" style="font-size:20px;display:block;margin-bottom:6px;opacity:.2;"></i>첨부된 자료가 없습니다</div>`;return;}
  list.innerHTML=files.map(f=>{
    const scopeColor=SCOPE_COLORS[f.scope]||'var(--txt3)';
    const imgThumb=isImageFile(f.original_name)
    ?`<div id="thumb-${f.id}" style="width:44px;height:44px;border-radius:var(--r-sm);overflow:hidden;border:1px solid var(--border);flex-shrink:0;cursor:pointer;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:20px;" onclick="event.stopPropagation();downloadFile(${f.id},'${f.original_name}')" data-fid="${f.id}">${f.icon}</div>`
    :`<span style="font-size:20px;flex-shrink:0;">${f.icon}</span>`
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);margin-bottom:6px;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--border-hover)'" onmouseout="this.style.borderColor='var(--border)'">
      ${imgThumb}
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.title}</div>
        <div style="font-size:10.5px;color:var(--txt3);margin-top:2px;display:flex;align-items:center;gap:8px;">
          <span>${f.display_name||f.username}</span>
          <span>${(f.file_size/1024/1024).toFixed(1)}MB</span>
          <span style="color:${scopeColor};">${SCOPE_LABELS[f.scope]||f.scope}</span>
          ${f.download_count?`<span><i class="bi bi-download" style="font-size:9px;"></i>${f.download_count}</span>`:''}
          ${f.version>1?`<span class="badge badge-blue" style="font-size:9px;padding:1px 5px;">v${f.version}</span>`:''}
        </div>
        ${f.description?`<div style="font-size:10.5px;color:var(--txt3);margin-top:2px;">${f.description}</div>`:''}
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;">
        <button class="btn btn-ghost" style="font-size:11px;padding:4px 9px;" onclick="downloadFile(${f.id},'${f.original_name}')"><i class="bi bi-download"></i></button>
        ${f.user_id===myUserId?`<button class="btn btn-danger" style="font-size:11px;padding:4px 9px;" onclick="deleteFile(${f.id})"><i class="bi bi-trash3"></i></button>`:''}
      </div>
    </div>`;
  }).join('')+links.map(l=>{
    const icon=LINK_ICONS[l.link_type]||'🔗',scopeColor=SCOPE_COLORS[l.scope]||'var(--txt3)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);margin-bottom:6px;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--border-hover)'" onmouseout="this.style.borderColor='var(--border)'">
      <span style="font-size:20px;flex-shrink:0;">${icon}</span>
      <div style="flex:1;min-width:0;">
        <a href="${l.url}" target="_blank" rel="noopener" style="font-size:13px;font-weight:600;color:var(--blue);text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.title} <i class="bi bi-box-arrow-up-right" style="font-size:10px;"></i></a>
        <div style="font-size:10.5px;color:var(--txt3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.url}</div>
        <div style="font-size:10.5px;color:var(--txt3);margin-top:1px;display:flex;gap:8px;"><span>${l.display_name||l.username}</span><span style="color:${scopeColor};">${SCOPE_LABELS[l.scope]||l.scope}</span></div>
      </div>
      ${l.user_id===myUserId?`<button class="btn btn-danger" style="font-size:11px;padding:4px 9px;" onclick="deleteLink(${l.id})"><i class="bi bi-trash3"></i></button>`:''}
    </div>`;
  }).join('');
}

/* ── 파일 업로드 ─────────────────────────────────────── */

function handleDrop(e){e.preventDefault();document.getElementById('sm-dropzone').style.borderColor='';document.getElementById('sm-dropzone').style.background='';handleFileSelect(e.dataTransfer.files);}
function handleFileSelect(files){
  if(!files||!files.length) return;
  const file=files[0];
  if(file.size>50*1024*1024){toast('50MB 이하 파일만 업로드 가능합니다.','error');return;}
  uploadFiles=[file];
  document.getElementById('sm-upload-area').style.display='';
  document.getElementById('sm-upload-filename').textContent=file.name;
  document.getElementById('sm-upload-title').value=file.name.replace(/\.[^.]+$/,'');
  // 이미지 미리보기
  const isImg=/\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name);
  const wrap=document.getElementById('sm-img-preview-wrap');
  const img=document.getElementById('sm-img-preview');
  if(isImg){
    const reader=new FileReader();
    reader.onload=e=>{img.src=e.target.result;wrap.style.display='';};
    reader.readAsDataURL(file);
  } else {
    wrap.style.display='none'; img.src='';
  }
}
function handleTagInput(e){
  if(e.key!=='Enter') return;
  const val=e.target.value.trim();
  if(!val||uploadTags.length>=5) return;
  uploadTags.push(val); e.target.value=''; renderTagsPreview();
}
function renderTagsPreview(){
  document.getElementById('sm-tags-preview').innerHTML=uploadTags.map((t,i)=>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;background:rgba(49,130,246,.12);color:var(--blue);font-size:11.5px;font-weight:600;">
      ${t}<button onclick="removeTag(${i})" style="background:none;border:none;color:inherit;cursor:pointer;font-size:13px;line-height:1;padding:0;">×</button>
    </span>`
  ).join('');
}
function removeTag(i){uploadTags.splice(i,1);renderTagsPreview();}

function renderTaskList(tasks){
  const list=document.getElementById('sm-task-list');
  if(!tasks.length){
    list.innerHTML=`<div style="font-size:12.5px;color:var(--txt4);padding:6px 2px;">등록된 할 일이 없습니다.</div>`;
    return;
  }
  list.innerHTML='';
  tasks.forEach(t=>{
    const row=document.createElement('div');
    row.dataset.taskId=t.id;
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:var(--bg2);transition:opacity .2s;';
    if(t.done) row.style.opacity='.55';
    const due=t.due_date?`<span style="font-size:11px;color:var(--txt3);font-family:var(--font-mono);">~${t.due_date}</span>`:'';
    const assignee=t.assignee?`<span style="font-size:11px;color:var(--blue);font-weight:600;">${t.assignee}</span>`:'';
    row.innerHTML=`
      <button onclick="doToggleTask(${t.id},this)" style="background:none;border:2px solid ${t.done?'var(--green)':'var(--border)'};border-radius:50%;width:18px;height:18px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:border-color .15s,background .15s;" title="${t.done?'미완료로 변경':'완료 표시'}">
        ${t.done?'<i class="bi bi-check" style="font-size:11px;color:var(--green);"></i>':''}
      </button>
      <span style="flex:1;font-size:13px;${t.done?'text-decoration:line-through;color:var(--txt3);':''}">${t.title}</span>
      ${assignee}${due}
      <button onclick="doDeleteTask(${t.id},this)" style="background:none;border:none;color:var(--txt4);cursor:pointer;font-size:14px;padding:0 2px;line-height:1;transition:color .15s;" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--txt4)'" title="삭제">×</button>
    `;
    list.appendChild(row);
  });
}

function setLibScope(scope,btn){
  libScope=scope; libPage=1;
  document.querySelectorAll('#lscope-all,#lscope-team,#lscope-public,#lscope-mine').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  loadLibrary();
}
function debounceLib(){clearTimeout(libDebounce);libDebounce=setTimeout(()=>{libPage=1;loadLibrary();},400);}

function buildFileCard(f){
  const scopeColor=SCOPE_COLORS[f.scope]||'var(--txt3)';
  const col=ROOM_COL[f.room_name]||'var(--blue)';
  const card=document.createElement('div');
  card.className='file-card fade-in';
  card.onmouseenter=()=>{card.style.borderColor=col;card.style.transform='translateY(-3px)';};
  card.onmouseleave=()=>{card.style.borderColor='';card.style.transform='';};
  card.innerHTML=`
    <div class="file-icon" style="background:${col}18;">${f.icon}</div>
    <div class="file-title" title="${f.title}">${f.title}</div>
    <div class="file-meta">
      <div style="font-weight:700;color:${col};">${f.room_name} · ${f.date}</div>
      <div style="color:var(--txt3);margin-top:2px;">${f.display_name||f.username}${f.team ? ` (${f.team})` : ''}</div>
      ${f.description ? `<div style="margin-top:4px;font-style:italic;color:var(--txt4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.description}</div>` : ''}
    </div>
    <div class="file-footer">
      <div style="display:flex;gap:4px;align-items:center;">
        <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;color:${scopeColor};background:${scopeColor}18;border:1px solid ${scopeColor}30;">${SCOPE_LABELS[f.scope]}</span>
        <span style="font-size:10px;color:var(--txt3);">${(f.file_size/1024/1024).toFixed(1)}MB</span>
      </div>
      <button class="btn btn-primary" style="font-size:11px;padding:4px 10px;" onclick="event.stopPropagation();downloadFile(${f.id},'${f.original_name}')">
        <i class="bi bi-download"></i>
      </button>
    </div>`;
  card.addEventListener('click',()=>openSessionModal(f.reservation_id));
  return card;
}
function clearSearch(){
  document.getElementById('srch-q').value='';
  if(window._fpFrom)window._fpFrom.clear();else document.getElementById('srch-from').value='';
  if(window._fpTo)  window._fpTo.clear();  else document.getElementById('srch-to').value='';
  document.getElementById('srch-room').value=''; document.getElementById('srch-type').value='';
  document.getElementById('srch-results').innerHTML=`<div style="text-align:center;padding:48px;color:var(--txt3);"><i class="bi bi-search" style="font-size:36px;display:block;margin-bottom:12px;opacity:.18;"></i><p style="font-size:14px;">키워드 또는 날짜를 입력하고 검색하세요</p></div>`;
}

/* ── PROFILE ─────────────────────────────────────────── */
function closeProfile(){document.getElementById('profile-modal').style.display='none';document.body.style.overflow='';}
function closeProfileOutside(e){if(e.target===document.getElementById('profile-modal'))closeProfile();}
function pickTeamProf(name){document.getElementById('prof-team').value=name;document.querySelectorAll('.team-chip').forEach(c=>c.classList.toggle('active',c.textContent===name));}
document.getElementById('prof-team').addEventListener('input',()=>document.querySelectorAll('.team-chip').forEach(c=>c.classList.remove('active')));

function startNotifPoll(){if(_notifPollTimer)return;_notifPollTimer=setInterval(loadNotifCount,2*60*1000);}

function buildNotifItem(n){
  const col=NOTIF_COLS[n.type]||'var(--blue)',icon=NOTIF_ICONS[n.type]||'💬';
  const wrap=document.createElement('div');wrap.className=`ni ${n.is_read?'':'unread'}`;wrap.onclick=()=>readNotif(n.id,wrap);
  wrap.innerHTML=`<span class="ni-icon" style="background:${col}20;color:${col};">${icon}</span>
    <div class="ni-body"><div class="ni-title">${n.title}</div><div class="ni-body-text">${n.body}</div>
    <div class="ni-time">${relTime(n.created_at)}</div></div>`;
  return wrap;
}

function toggleNotifDrawer(){document.getElementById('notif-drawer').classList.contains('open')?closeNotifDrawer():openNotifDrawer();}
function openNotifDrawer(){document.getElementById('notif-drawer').classList.add('open');document.getElementById('notif-overlay').style.display='block';loadNotifList();}
function closeNotifDrawer(){document.getElementById('notif-drawer').classList.remove('open');document.getElementById('notif-overlay').style.display='none';}

/* ── HELPERS ─────────────────────────────────────────── */
function crowdBadge(n){if(n<=2)return `<span class="badge badge-blue">${n}명 여유</span>`;if(n<=5)return `<span class="badge badge-amber">${n}명 보통</span>`;return `<span class="badge badge-red">${n}명 혼잡</span>`;}

/* ════════════════════════════════════════════════════════
   CSP 대응 이벤트 위임 — data-action 디스패처
   모든 정적 onclick을 addEventListener로 대체
   (이벤트 디스패처는 user-actions.js에 있음)
════════════════════════════════════════════════════════ */
