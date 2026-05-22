"use strict";
/* ══════════════════════════════════════════════════════
   user-state.js — 상수 · 상태 · 날짜 유틸 · 앱 초기화
   user.html 에서 분리됨 
══════════════════════════════════════════════════════ */
if (!auth.guard("user")) throw 0;

/* ── CONSTANTS ───────────────────────────────────────── */
const MONTHS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];
const WDS = ["일", "월", "화", "수", "목", "금", "토"];
const ROOM_COL = {
  "Room A": "#818cf8",
  "Room B": "#38bdf8",
  "Room C": "#fb923c",
  "Room D": "#f472b6",
};
const ROOM_BG = {
  "Room A": "rgba(129,140,248,.12)",
  "Room B": "rgba(56,189,248,.12)",
  "Room C": "rgba(251,146,60,.12)",
  "Room D": "rgba(244,114,182,.12)",
};
const ROOM_EMO = {
  "Room A": "🅰️",
  "Room B": "🅱️",
  "Room C": "🆒",
  "Room D": "🔷",
};
const NOTIF_ICONS = { info: "💬", warning: "⚠️", success: "✅", urgent: "🚨" };
const NOTIF_COLS = {
  info: "var(--blue)",
  warning: "var(--orange)",
  success: "var(--green)",
  urgent: "var(--red)",
};
const SCOPE_LABELS = { private: "🔒 나만", team: "🏢 팀", public: "🌐 전체" };
const SCOPE_COLORS = {
  private: "var(--txt3)",
  team: "var(--blue)",
  public: "var(--green)",
};
const LINK_ICONS = {
  notion: "📋",
  gdocs: "📄",
  figma: "🎨",
  github: "💻",
  youtube: "▶️",
  general: "🔗",
};

/* ── STATE ───────────────────────────────────────────── */
/* ── 전역 상태 네임스페이스 (SM) — 단일 진실 공급원 ── */
const SM = {
  hc: 1,
  selectedRoom: "Room A",
  selectedDate: null,
  calY: 0,
  calM: 0,
  calView: "month",
  myResData: [],
  allCalData: [],
  teamData: [],
  histData: [],
  favData: [],
  predStats: null,
  roomsData: [],
  histFilter: "all",
  teamFilter: "all",
  teamPeriod: "month",
  popTab: "team",
  popupDate: null,
  teamStatusData: {},
  FP: { mine: true, A: true, B: true, C: true, D: true },
  notifPollTimer: null,
  sessionTab: "mine",
  sessionPage: 1,
  sessionHasMore: false,
  libScope: "all",
  libPage: 1,
  libHasMore: false,
  libDebounce: null,
  currentResId: null,
  uploadFiles: [],
  uploadTags: [],
};

/* 하위 호환 — 기존 코드가 전역명으로 접근하는 경우를 위한 getter/setter 프록시
   SM 을 단일 진실 공급원으로 유지하면서 전역 변수처럼 읽고 쓸 수 있도록 합니다. */
const _smKeys = [
  "hc",
  "selectedRoom",
  "selectedDate",
  "calY",
  "calM",
  "calView",
  "myResData",
  "allCalData",
  "teamData",
  "histData",
  "favData",
  "predStats",
  "roomsData",
  "histFilter",
  "teamFilter",
  "teamPeriod",
  "popTab",
  "popupDate",
  "teamStatusData",
  "sessionTab",
  "sessionPage",
  "sessionHasMore",
  "libScope",
  "libPage",
  "libHasMore",
  "libDebounce",
  "currentResId",
  "uploadFiles",
  "uploadTags",
];
_smKeys.forEach((k) => {
  Object.defineProperty(window, k, {
    get() {
      return SM[k];
    },
    set(v) {
      SM[k] = v;
    },
    configurable: true,
  });
});
/* FP 는 객체 참조를 공유 — 별칭만 노출 */
Object.defineProperty(window, "FP", {
  get() {
    return SM.FP;
  },
  configurable: true,
});

const now = new Date();
SM.calY = now.getFullYear();
SM.calM = now.getMonth();
let _notifPollTimer = null;

/* ── 날짜 유틸 ────────────────────────────────────────── */
function todayStr() {
  return new Date(Date.now() + 9 * 3600000).toISOString().split("T")[0];
}
function getMonthEnd(ds) {
  if (!ds) return "";
  const d = new Date(ds + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
}
function dStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ── INIT ────────────────────────────────────────────── */
const myUsername = auth.username(),
  myTeam = auth.team(),
  myName = auth.displayName();
const myUserId = (() => {
  try {
    const t = auth.token();
    if (!t) return -1;
    const b64 = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(
      atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=")),
    ).id;
  } catch {
    return -1;
  }
})();

document.getElementById("sb-uname").textContent = myName || myUsername || "—";
document.getElementById("sb-av").textContent = (myName ||
  myUsername ||
  "U")[0].toUpperCase();
document.getElementById("sb-team-lbl").textContent = myTeam
  ? `📌 ${myTeam}`
  : "소속팀 없음";
document.getElementById("team-name-lbl").textContent = myTeam
  ? `${myTeam} · 오늘 이후`
  : "소속팀 없음";

/* flatpickr 초기화 — window.onload로 CDN 로드 완료 보장 */
window.addEventListener("load", () => {
  if (typeof flatpickr === "undefined") return;
  const ko = (flatpickr.l10ns && flatpickr.l10ns.ko) || {};
  const base = {
    locale: ko,
    dateFormat: "Y-m-d",
    allowInput: false,
    disableMobile: true,
  };
  const fpFrom = flatpickr("#srch-from", {
    ...base,
    defaultDate: todayStr(),
    onChange([d]) {
      const ds = d.toISOString().split("T")[0];
      fpTo.set("minDate", ds);
      if (!fpTo.selectedDates[0] || fpTo.selectedDates[0] < d)
        fpTo.setDate(getMonthEnd(ds), true);
    },
  });
  const fpTo = flatpickr("#srch-to", {
    ...base,
    defaultDate: getMonthEnd(todayStr()),
  });
  window._fpFrom = fpFrom;
  window._fpTo = fpTo;
});

(async () => {
  const results = await Promise.allSettled([
    api.publicStats(),
    api.myReservations(),
    api.calendarAll(),
    api.teamReservations(),
    api.rooms(),
    api.favorites(),
    api.roomStatus("?period=month"),
  ]);
  if (results[0].status === "fulfilled") predStats = results[0].value;
  if (results[1].status === "fulfilled")
    myResData = results[1].value?.data ?? results[1].value;
  if (results[2].status === "fulfilled") allCalData = results[2].value;
  if (results[3].status === "fulfilled") teamData = results[3].value;
  if (results[4].status === "fulfilled") roomsData = results[4].value;
  if (results[5].status === "fulfilled") favData = results[5].value;
  if (results[6].status === "fulfilled") teamStatusData = results[6].value;
  renderRoomTabs();
  renderCal();
  renderTeamPanel();
  renderTodayWidget();
  updateFavBadge();
  loadNotifCount();
  startNotifPoll();
})();
