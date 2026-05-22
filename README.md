<div align="center">

# 📚 StudyMate

https://www.notion.so/3280bd6432ab80b68dc1f8e3a23c6337?source=copy_link

### 스터디룸 예약 · 자료 공유 · 팀 협업 플랫폼

> 사내 스터디룸을 실시간으로 예약·관리하고,  
> 세션별 파일·링크·메모를 팀과 공유하는 풀스택 SaaS 웹 애플리케이션

[![Node.js](https://img.shields.io/badge/Node.js-≥18.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![JWT](https://img.shields.io/badge/Auth-JWT-FB015B?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

</div>

---

## 📋 목차

1. [프로젝트 개요](#-프로젝트-개요)
2. [기술 스택](#-기술-스택)
3. [화면 구성 및 기능](#-화면-구성-및-기능)
   - [로그인 / 회원가입](#1-로그인--회원가입)
   - [예약하기](#2-예약하기)
   - [예약 내역](#3-예약-내역)
   - [즐겨찾기](#4-즐겨찾기)
   - [활동 기록](#5-활동-기록-세션)
   - [팀 자료함](#6-팀-자료함)
   - [통합 검색](#7-통합-검색)
   - [관리자 대시보드](#8-관리자-대시보드)
4. [아키텍처](#-아키텍처)
5. [데이터베이스 설계](#-데이터베이스-설계)
6. [API 명세](#-api-명세)
7. [보안 구현](#-보안-구현)
8. [설치 및 실행](#-설치-및-실행)
9. [운영 배포](#-운영-배포)
10. [구현 시 고려 사항](#-구현-시-고려-사항)

---

## 🎯 프로젝트 개요

StudyMate는 **단일 서버(Node.js + SQLite)** 로 구동되는 경량 SaaS 플랫폼입니다.  
별도 DB 서버 없이 `npm install && node server/app.js` 한 줄로 바로 실행되며,  
소규모 팀~중규모 조직(~수백 명)을 타깃으로 설계됐습니다.

### 핵심 가치

| 가치                  | 설명                                                            |
| --------------------- | --------------------------------------------------------------- |
| **Zero-friction**     | 설치 없이 브라우저만으로 예약·자료 공유 완결                    |
| **Team-aware**        | 팀 소속 기반 자료 공개 범위 (public / team / private)           |
| **Audit-ready**       | 예약 이력, 파일 접근 로그, 다운로드 카운트 자동 기록            |
| **Secure by default** | CSP, HSTS, Rate Limiting, bcrypt, JWT, XSS 이스케이프 기본 적용 |

---

## 🛠 기술 스택

### Backend

| 라이브러리             | 버전   | 역할                                   |
| ---------------------- | ------ | -------------------------------------- |
| **Node.js**            | ≥ 18.x | 런타임                                 |
| **Express**            | 4.x    | HTTP 프레임워크, 라우팅                |
| **better-sqlite3**     | 9.x    | SQLite 동기 드라이버 (WAL 모드)        |
| **bcryptjs**           | 2.x    | 비밀번호 해싱 (cost=12)                |
| **jsonwebtoken**       | 9.x    | JWT 발급/검증                          |
| **multer**             | 1.x    | 멀티파트 파일 업로드                   |
| **helmet**             | 7.x    | 보안 헤더 (CSP, HSTS, X-Frame-Options) |
| **express-rate-limit** | 7.x    | API 요청 횟수 제한                     |
| **cors**               | 2.x    | CORS Origin 화이트리스트               |
| **morgan**             | 1.x    | HTTP 요청 로깅                         |
| **dotenv**             | 16.x   | 환경변수 관리                          |
| **uuid**               | 9.x    | 파일명 난수 생성                       |

### Frontend

| 기술                     | 역할                                    |
| ------------------------ | --------------------------------------- |
| **Vanilla JS (ES2020+)** | 프레임워크 없이 순수 JS — 의존성 최소화 |
| **CSS Variables**        | 다크 테마, 디자인 토큰 시스템           |
| **Bootstrap Icons 1.11** | 아이콘 (CDN)                            |
| **Flatpickr**            | 날짜 피커 (CDN)                         |

> **"Framework-free" 선택 이유:** 학습 곡선 없이 배포 가능, 번들러 불필요, CDN 캐싱으로 초기 로드 최적화

---

## 🖥 화면 구성 및 기능

### 1. 로그인 / 회원가입

```<img width="1511" height="943" alt="스크린샷 2026-03-20 오전 12 07 19" src="https://github.com/user-attachments/assets/5228250a-08ee-40e1-ae03-bca533cb150e" />

┌─────────────────────────────────────────────────┐
│                                                 │
│              📚  StudyMate                      │
│        스터디룸 예약 · 자료 공유 플랫폼                │
│                                                 │
│     ┌──────────────┬──────────────────┐         │
│     │    로그인      │    회원가입        │         │
│     └──────────────┴──────────────────┘         │
│                                                 │
│  👤  아이디    ┌─────────────────────────┐        │
│              │                         │        │
│              └─────────────────────────┘        │
│                                                 │
│  🔒  비밀번호   ┌─────────────────────────┐        │
│              │ ● ● ● ● ● ● ●           │        │
│              └─────────────────────────┘        │
│                                                 │
│         ┌─────────────────────────┐             │
│         │   → 로그인                │             │
│         └─────────────────────────┘             │
│                                                 │
│  ⚙️ [개발 환경] admin/admin123 | user1/user123  │  ← localhost에서만 표시
└─────────────────────────────────────────────────┘
```

**주요 구현:**

- **아이디 실시간 유효성 검사**: 3~20자 영문·숫자·`_` 정규식 즉시 피드백
- **비밀번호 강도 표시**: 4단계 strength bar (미흡/보통/좋음/강함)
- **비밀번호 확인 일치 체크**: 실시간 ✓/✗ 표시
- **세션 만료 자동 안내**: 토큰 만료 후 재진입 시 "세션이 만료됐습니다" 배너
- **개발/운영 환경 분리**: `localhost`에서만 테스트 계정 힌트 노출

---

### 2. 예약하기

```
┌─────────┬──────────────────────────────────────────────────────────────┐
│         │  StudyMate  ›  예약하기          🔴 실시간   🔔              │
│         ├──────────────────────────────────────┬───────────────────────┤
│ 📅      │  🚪 스터디룸 선택                    │   🏢 팀 예약 현황     │
│ 예약    │  ┌──┬──┬──┬──┐                       │                       │
│         │  │🅰 │🅱 │🆒 │🔷│  ← 룸 탭 선택      │  기간: [이번달 ▾]    │
│ 📋      │  └──┴──┴──┴──┘                       │  총 18건 A:6 B:5 C:4 │
│ 내역    │                                      │  ─────────────────   │
│         │  Room A — 포커스룸 · 최대 4인         │  4/21 Room A          │
│ ⭐      │  화이트보드, 모니터, USB 충전포트      │  09:00~10:00 ·3명    │
│ 즐겨찾기│                                      │  김개발 · 팀 회의     │
│         │  ┌───────────────────────────────┐   │                       │
│ 📓      │  │  일  월  화  수  목  금  토    │   │  4/22 Room B          │
│ 활동    │  │                               │   │  14:00~16:00 · 5명   │
│         │  │       ●  ●  .  ●  .           │   │  이디자인 · 발표연습  │
│ 📁      │  │  .  ●  .  .  ●  .  .         │   │                       │
│ 자료함  │  │                               │   │  ─────────────────   │
│         │  └───────────────────────────────┘   │  [ 이번주 / 이번달  ]  │
│ 🔍      │                                      │  [지난달 / 30일예정 ]  │
│ 검색    │  시작: [10:00▾]  종료: [11:00▾]      │                       │
│         │  인원: [─  3명  +]                   │  📅 예약 미리보기     │
│         │  목적: [팀 주간 회의.............]   │  14일 (화)            │
│         │  ⭐ 즐겨찾기 ▾   [✓ 예약 확정]      │  Room A · 10~11       │
│         │                                      │  3명 · ✅ 예약 가능   │
└─────────┴──────────────────────────────────────┴───────────────────────┘
```

**핵심 기능:**

| 기능                         | 구현 방식                                                  |
| ---------------------------- | ---------------------------------------------------------- |
| **월별/주별 캘린더**         | 순수 JS로 직접 구현, 루트별 색상 도트(●) 표시              |
| **실시간 충돌 감지**         | 날짜·룸·시간 선택 즉시 기존 예약과 교집합 연산             |
| **시간대별 혼잡도 예측**     | 과거 누적 통계 기반 히트맵 + 선택일 실제 예약 오버레이     |
| **예약 미리보기**            | 선택 정보 종합 → 충돌 여부·해당 룸 당일 타임라인 즉시 표시 |
| **팀 현황 기간 필터**        | 이번 주 / 이번 달 / 지난 달 / 앞으로 30일 전환             |
| **즐겨찾기 인라인 드롭다운** | 탭 이동 없이 드롭다운에서 1클릭으로 불러오기·저장          |

---

### 3. 예약 내역

```
┌────────────────────────────────────────────────────────────────────┐
│  StudyMate  ›  예약 내역          🔍 [룸·목적 검색]  🔄           │
├────────────────────────────────────────────────────────────────────┤
│  [전체] [예정] [지난예약] [취소됨]  │  [A] [B] [C] [D]           │
├─────┬────────┬──────────┬────────┬───┬────────────┬───────┬──────┤
│  #  │   룸   │   날짜   │  시간  │인원│    목적    │ 상태  │      │
├─────┼────────┼──────────┼────────┼───┼────────────┼───────┼──────┤
│ #42 │ 🅰 A   │ 04/21   │ 10~11  │ 3 │ 팀 주간 회의│✅ 확정│ [X] │
│ #41 │ 🅱 B   │ 04/18   │ 14~16  │ 5 │ 발표 연습  │✅ 확정│ [X] │
│ #38 │ 🆒 C   │ 04/10   │ 10~11  │ 8 │ 스터디     │✅완료 │      │
│ #35 │ 🔷 D   │ 04/05   │ 13~14  │ 2 │ 1on1 미팅  │ 취소됨│      │
└─────┴────────┴──────────┴────────┴───┴────────────┴───────┴──────┘
```

**기능:**

- 다중 필터 조합 (상태 × 룸)
- 키워드 검색 (룸명 + 목적)
- 인원수 혼잡도 뱃지 (여유/보통/혼잡)
- 예정 예약만 취소 가능 (과거 예약 취소 불가 처리)

---

### 4. 즐겨찾기

```
┌────────────────────────────────────────────────────────┐
│  StudyMate  ›  즐겨찾기                          🔄   │
├────────────────────────────────────────────────────────┤
│  ┌─────────────────── 즐겨찾기 추가 ────────────────┐  │
│  │ 이름 [매주 월요일 팀 미팅_______]                 │  │
│  │ 룸   [Room A ▾]    시작 [09:00▾]  종료 [10:00▾] │  │
│  │ 인원 [─  3명  +]                    [✓ 저장]    │  │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  🅰 매주 월요일  │  │  🅱 목요일 스터디│              │
│  │    팀 미팅       │  │                 │              │
│  │  Room A          │  │  Room B          │              │
│  │  09:00 ~ 10:00   │  │  14:00 ~ 16:00   │              │
│  │  3명              │  │  5명              │              │
│  │                  │  │                  │              │
│  │ [⚡ 예약에 적용] │  │ [⚡ 예약에 적용] │              │
│  │ [🗑]             │  │ [🗑]             │              │
│  └─────────────────┘  └─────────────────┘              │
└────────────────────────────────────────────────────────┘
```

**UX 설계 포인트:**

- **탭 이동 없이 적용**: 예약하기 폼 우상단 `⭐ 즐겨찾기 ▾` 클릭 → 인라인 드롭다운에서 1클릭으로 시간·룸·인원 자동 입력
- **즐겨찾기 탭에서 직접 추가**: 예약 탭을 먼저 거치지 않아도 룸·시간·인원 독립 입력 가능
- **적용 후 안내**: 날짜 미선택 시 "달력에서 날짜를 선택하세요" 토스트 + 캘린더 스크롤

---

### 5. 활동 기록 (세션)

```
┌──────────────────────────────────────────────────────────────────┐
│  [내 세션] [팀 세션] [자료 있는 것만]                       🔄   │
├──────────────────────────────────────────────────────────────────┤
│ ▌ 2025-04-21 (월)  🅰 Room A  10:00~11:00  3명  예정           │
│   김개발 · 개발팀  팀 주간 회의                                  │
│   "API 설계 방향 논의, 다음 스프린트 계획 수립..."              │
│   📎 2개   🔗 1개                          [📁 자료 관리 →]   │
├──────────────────────────────────────────────────────────────────┤
│ ▌ 2025-04-18 (금)  🅱 Room B  14:00~16:00  5명  완료           │
│   이디자인 · 디자인팀  발표 연습                                 │
│   📎 3개   🔗 2개                          [📁 자료 관리 →]   │
└──────────────────────────────────────────────────────────────────┘
```

**세션 상세 모달 (자료 관리):**

```
┌──────────────────────────────────────────────────────────────────┐
│  2025-04-21 · Room A                                          [X] │
│  10:00~11:00 · 3명 · 팀 주간 회의                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ✏️  세션 메모                               [저장]              │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  오늘 논의한 내용:                                        │    │
│  │  - REST API 엔드포인트 설계 확정                          │    │
│  │  - 다음 주 화요일 코드 리뷰 예정                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│  0 / 1000                                                          │
│                                                                    │
│  📎  첨부 자료                                                    │
│  ┌──  드래그하거나 클릭하여 파일 업로드  ──────────────────────┐  │
│  │   📄 PDF  PPT  DOC  XLS  이미지  ZIP · 최대 50MB          │  │
│  └───────────────────────────────────────────────────────────┘  │
│  │ 📄 API 설계서.pdf       🔒 나만  김개발  0.5MB  [⬇] [🗑] │  │
│  │ 📊 발표자료.pptx        🏢 팀공유 이디자인 2MB  [⬇] [🗑] │  │
│                                                                    │
│  🔗  외부 링크                                                    │
│  링크 제목 [Notion 회의록_____]   URL [https://notion.so/...]    │
│  유형 [Notion▾]  범위 [팀 공유▾]                   [+ 추가]     │
│  │ 📋 Notion 회의록  notion.so/...  🏢 팀  김개발              │  │
└──────────────────────────────────────────────────────────────────┘
```

**파일 관리 기능:**
| 기능 | 설명 |
|------|------|
| 파일 업로드 | 드래그&드롭 또는 클릭, 최대 50MB, 14개 확장자 허용 |
| 버전 관리 | 동일 제목 재업로드 시 버전 자동 증가 |
| 공개 범위 | 🔒 나만 / 🏢 팀 공유 / 🌐 전체 공개 |
| 태그 | Enter로 추가, 최대 5개, 20자 이내 |
| 다운로드 카운트 | 자동 기록 |
| 외부 링크 | Notion/Figma/GitHub/YouTube/Google Docs/기타 분류 |

---

### 6. 팀 자료함

```
┌──────────────────────────────────────────────────────────────────┐
│  🔍 [자료 검색_____]  [전체형식▾]  [☁ 자료 올리기]  🔄       │
│  [전체] [팀 공유] [전체 공개] [내 자료]                          │
├──────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │               │  │               │  │               │        │
│  │      📄       │  │      📊       │  │      📝       │        │
│  │     PDF       │  │     PPTX      │  │     DOCX      │        │
│  │               │  │               │  │               │        │
│  │  API 설계서   │  │  발표자료     │  │  회의록       │        │
│  │  김개발       │  │  이디자인     │  │  박기획       │        │
│  │  Room A · 4/21│  │  Room B · 4/18│  │  Room C · 4/15│        │
│  │  🏢팀  0.5MB  │  │  🌐전체  2MB  │  │  🏢팀  0.1MB  │        │
│  │          [⬇]  │  │          [⬇]  │  │          [⬇]  │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
│                                                                    │
│   [이전]  1 / 3  [다음]                                          │
└──────────────────────────────────────────────────────────────────┘
```

**직접 업로드 모달:**

```
┌──────────────────────────────────────────┐
│  📎 자료 올리기                      [X] │
│  예약 세션에 파일을 첨부합니다           │
├──────────────────────────────────────────┤
│  연결할 예약 *                           │
│  ┌──────────────────────────────────┐   │
│  │ 04/21 Room A 10:00~11:00 · 팀회의▾│   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  ☁ 드래그하거나 클릭하여 선택    │   │
│  │  PDF, PPT, DOC · 최대 50MB       │   │
│  └──────────────────────────────────┘   │
│  제목 [API설계서_______] 범위 [팀공유▾] │
│  설명 [첫 번째 버전 초안______________]  │
│         [         업로드         ]       │
└──────────────────────────────────────────┘
```

**구현 포인트:**

- 자료함 → 활동기록 탭 이동 없이 **직접 업로드** 가능
- 업로드 성공 시 자료함 자동 갱신 (`loadLibrary()` 호출)
- 빈 상태: "자료 올리기" 버튼 포함 안내 화면

---

### 7. 통합 검색

```
┌──────────────────────────────────────────────────────────────────┐
│  StudyMate  ›  통합 검색                                         │
├──────────────────────────────────────────────────────────────────┤
│  🔍 [API 설계________________________]           [검색]          │
│                                                                    │
│  날짜: [2025-04-01] ~ [2025-04-30]                               │
│  룸: [전체▾]   파일형식: [전체▾]                                 │
├──────────────────────────────────────────────────────────────────┤
│  총 7건 — 파일 3건 · 세션 2건 · 링크 2건                        │
│                                                                    │
│  📎 파일 (3)                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 📄 **API** 설계서.pdf   Room A · 04/21   🏢팀   [⬇]    │   │
│  │   김개발 · 개발팀                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                    │
│  📅 세션 (2)                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 04/21 (월)  Room A  10:00~11:00                          │   │
│  │ 목적: 팀 주간 회의 - **API** 설계 방향 논의              │   │
│  │                                         📎 2개           │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**검색 대상:** 파일 제목·설명·태그 / 세션 목적·메모 내용 / 링크 제목·URL  
**키워드 하이라이트:** 검색어와 일치하는 텍스트 노란 배경 강조  
**날짜 범위 + 룸 + 파일형식** 복합 필터 지원

---

### 8. 관리자 대시보드

```
┌─────────┬────────────────────────────────────────────────────────┐
│         │  StudyMate  ›  관리자                            🔔   │
│ 👑      ├────────────────────────────────────────────────────────┤
│ 대시보드│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│         │  │  총 예약 │ │  취소율  │ │  오늘   │ │평균인원  │   │
│ 📅      │  │  247건  │ │  8.2%   │ │  12건   │ │  3.4명  │   │
│ 예약관리│  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│         │                                                         │
│ 👥      │  시간대별 이용률          룸별 예약 현황               │
│ 사용자  │  09:00 ████████ 99%      Room A ████████ 72건         │
│         │  10:00 ████████ 94%      Room B ██████   58건         │
│ 📣      │  11:00 ████░░░ 68%      Room C █████    43건         │
│ 공지    │  12:00 ██░░░░░ 35%      Room D ████     38건         │
│         │  13:00 ███░░░░ 48%                                    │
│ 🚪      │  14:00 ████████ 87%      팀별 예약                    │
│ 룸관리  │  15:00 ████████ 91%      개발팀   ██████  42건        │
│         │  16:00 ██████░ 76%      디자인팀 █████   35건        │
│ 💾      │  17:00 ████░░░ 57%      기획팀   ████    28건        │
│ 스토리지│                                                         │
└─────────┴────────────────────────────────────────────────────────┘
```

**관리자 전용 기능:**
| 탭 | 기능 |
|----|------|
| **대시보드** | 핵심 KPI 4개, 시간대별/룸별/팀별/날짜별 통계 차트 |
| **예약 관리** | 전체 예약 조회·취소, 날짜·룸·상태 필터, CSV 내보내기 |
| **사용자 관리** | 계정 목록, 팀 변경, 비밀번호 초기화, 계정 삭제 |
| **공지 발송** | 전체/팀별 알림 발송 (info/warning/success/urgent) |
| **룸 관리** | 룸 정보·수용 인원·어메니티·색상 편집, 활성화/비활성화 |
| **스토리지** | 전체 사용량, 유저별/팀별/타입별 현황, 다운로드 TOP 5 |

---

## 🏗 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│   index.html    user.html       admin.html                      │
│   (로그인)      (사용자 UI)     (관리자 UI)                     │
│       │              │               │                          │
│   api.js ─────────────────────────────── (공통 API 클라이언트) │
│   • auth.guard()   • fetch('/api/...')   • JWT 헤더 자동 첨부  │
│   • _isTokenExpired() • escHtml()        • 401 자동 로그아웃   │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP (Bearer JWT)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express Server (app.js)                       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  helmet  │  │   cors   │  │rate-limit│  │  morgan  │      │
│  │ (보안헤더│  │(Origin   │  │(브루트   │  │(로깅)    │      │
│  │  CSP 등) │  │ 화이트   │  │ 포스 방어│  │          │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                 │
│  /api/auth  /api/reservations  /api/files  /api/users ...      │
│       │              │              │            │              │
│  authController  reservationCtrl  fileCtrl  userCtrl ...      │
│       │              │              │            │              │
│  verify() ──────────────────────── JWT 검증 미들웨어          │
└──────────────────────────┬──────────────────────────────────────┘
                           │  better-sqlite3 (동기)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SQLite (studymate.db)                          │
│                                                                 │
│   users  rooms  reservations  files  file_links  favorites     │
│   session_notes  notifications  file_access_logs  ...           │
│                                                                 │
│   WAL 모드 활성화 (journal_mode=WAL)                            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                    server/uploads/
                    (UUID 파일명으로 저장)
```

### 요청 처리 흐름

```
Client Request
     │
     ├─→ Static Files (/css, /js, /pages)
     │         └─→ express.static (캐싱)
     │
     └─→ /api/* 요청
               │
               ├─→ Rate Limiter (횟수 초과 시 429)
               ├─→ CORS 검증
               ├─→ Body Parser (JSON, 2MB 제한)
               │
               ├─→ verify() JWT 미들웨어
               │         ├─→ Bearer 토큰 추출
               │         ├─→ jwt.verify() → req.user 세팅
               │         └─→ 만료/변조 → 401 반환
               │
               ├─→ [requireAdmin()] 관리자 엔드포인트
               │
               └─→ Controller 비즈니스 로직
                         └─→ SQLite (prepare → run/get/all)
                                   └─→ JSON Response
```

---

## 🗄 데이터베이스 설계

### ERD (주요 테이블)

```
┌─────────────────┐     ┌──────────────────────┐
│     users       │     │    reservations       │
├─────────────────┤     ├──────────────────────┤
│ id (PK)         │◄────┤ user_id (FK)          │
│ username        │     │ room_name             │
│ password (hash) │     │ date                  │
│ role            │     │ start_time            │
│ team            │     │ end_time              │
│ display_name    │     │ headcount             │
│ email           │     │ purpose               │
│ created_at      │     │ status (confirmed/    │
└─────────────────┘     │        cancelled)     │
         │              │ created_at            │
         │              └──────────────────────┘
         │                         │
         │              ┌──────────┴───────────┐
         │              │                      │
         │    ┌─────────▼──────┐    ┌──────────▼───────┐
         │    │    files       │    │  session_notes    │
         │    ├────────────────┤    ├──────────────────┤
         └───►│ user_id (FK)   │    │ reservation_id PK │
              │ reservation_id │    │ user_id (FK)      │
              │ title          │    │ content           │
              │ original_name  │    │ updated_at        │
              │ stored_name    │    └──────────────────┘
              │ file_type      │
              │ file_size      │    ┌──────────────────┐
              │ scope          │    │   file_links      │
              │ tags (JSON)    │    ├──────────────────┤
              │ version        │    │ reservation_id FK │
              │ download_count │    │ user_id FK        │
              │ expires_at     │    │ title, url        │
              └────────────────┘    │ link_type         │
                                    │ scope             │
┌─────────────────┐                 └──────────────────┘
│    favorites    │
├─────────────────┤   ┌─────────────────────────────┐
│ user_id (FK)    │   │       notifications         │
│ label           │   ├─────────────────────────────┤
│ room_name       │   │ admin_id (FK → users)       │
│ start_time      │   │ target (all / team명)       │
│ end_time        │   │ title, body                 │
│ headcount       │   │ type (info/warn/success/    │
└─────────────────┘   │      urgent)               │
                       └─────────────────────────────┘
```

### 주요 설계 결정

**WAL 모드 (`PRAGMA journal_mode = WAL`)**

- 읽기/쓰기 동시성 향상 (읽기가 쓰기를 차단하지 않음)
- 충돌 복구 안전성 개선

**파일명 UUID 저장**

```
원본: 발표자료_최종본.pptx
저장: a3f8c2d1-e5b7-4a9c-8d6e-f1234567890b.pptx
```

- 경로 조작 공격(Path Traversal) 방지
- 동일 파일명 충돌 없음
- 원본 파일명은 `original_name` 컬럼에 별도 보존

**scope 기반 접근 제어**

```javascript
function canAccess(file, user) {
  if (file.scope === "public") return true;
  if (file.user_id === user.id) return true; // 본인
  if (user.role === "admin") return true; // 관리자
  if (file.scope === "team") {
    const uploader = db
      .prepare("SELECT team FROM users WHERE id=?")
      .get(file.user_id);
    return uploader?.team === user.team; // 동일 팀
  }
  return false;
}
```

---

## 📡 API 명세

### 인증

| Method  | Endpoint             | 권한   | 설명                       |
| ------- | -------------------- | ------ | -------------------------- |
| `POST`  | `/api/auth/login`    | 공개   | 로그인 (Rate: 15분 20회)   |
| `POST`  | `/api/auth/register` | 공개   | 회원가입 (Rate: 1시간 5회) |
| `GET`   | `/api/auth/me`       | 로그인 | 내 정보 조회               |
| `PATCH` | `/api/auth/profile`  | 로그인 | 프로필·비밀번호 수정       |

**로그인 응답 예시:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "user",
  "username": "user1",
  "display_name": "김개발",
  "team": "개발팀"
}
```

### 예약

| Method  | Endpoint                         | 권한   | 설명                |
| ------- | -------------------------------- | ------ | ------------------- |
| `POST`  | `/api/reservations`              | 로그인 | 예약 생성           |
| `GET`   | `/api/reservations/mine`         | 로그인 | 내 예약 목록        |
| `GET`   | `/api/reservations/team`         | 로그인 | 팀 예약 (오늘 이후) |
| `GET`   | `/api/reservations/calendar`     | 로그인 | 전체 캘린더         |
| `GET`   | `/api/reservations/public-stats` | 로그인 | 시간대별 혼잡도     |
| `GET`   | `/api/reservations/room-status`  | 로그인 | 기간별 룸 현황      |
| `PATCH` | `/api/reservations/:id/cancel`   | 로그인 | 예약 취소           |
| `GET`   | `/api/reservations/all`          | 관리자 | 전체 예약 조회      |
| `GET`   | `/api/reservations/stats`        | 관리자 | 통계 데이터         |

**`/api/reservations/room-status` 쿼리 파라미터:**

```
?period=week          이번 주 (월~일)
?period=month         이번 달 (기본값)
?period=prev_month    지난 달
?period=upcoming      오늘 ~ 30일 후
```

### 자료 (파일)

| Method   | Endpoint                          | 권한   | 설명                    |
| -------- | --------------------------------- | ------ | ----------------------- |
| `POST`   | `/api/files/upload`               | 로그인 | 파일 업로드 (multipart) |
| `GET`    | `/api/files/team`                 | 로그인 | 팀 자료함 목록          |
| `GET`    | `/api/files/search`               | 로그인 | 통합 검색               |
| `GET`    | `/api/files/sessions`             | 로그인 | 활동 기록 타임라인      |
| `GET`    | `/api/files/sessions/:resId`      | 로그인 | 세션 상세               |
| `PUT`    | `/api/files/sessions/:resId/note` | 로그인 | 세션 메모 저장          |
| `GET`    | `/api/files/:id/download`         | 로그인 | 파일 다운로드           |
| `DELETE` | `/api/files/:id`                  | 로그인 | 파일 삭제 (본인/관리자) |
| `POST`   | `/api/files/links`                | 로그인 | 링크 추가               |
| `DELETE` | `/api/files/links/:id`            | 로그인 | 링크 삭제               |
| `GET`    | `/api/files/storage-stats`        | 관리자 | 스토리지 현황           |

---

## 🔐 보안 구현

### 인증 보안

**1. bcrypt cost=12 해싱**

```javascript
// 회원가입 시
const hash = bcrypt.hashSync(password, 12);

// 로그인 시 타이밍 공격 방어
const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
if (!user) {
  // 사용자 없어도 동일 시간 소요 (응답 시간으로 계정 존재 여부 추론 차단)
  bcrypt.compareSync("dummy", "$2a$12$dummyhashfortimingreference...");
  return res
    .status(401)
    .json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
}
```

**2. JWT 검증 (서버 + 클라이언트 이중)**

```javascript
// 서버: verify 미들웨어
exports.verify = (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  if (!token || token.length > 2048) return res.status(401)...;
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    // TokenExpiredError vs JsonWebTokenError 구분
  }
};

// 클라이언트: 요청 전 사전 검증
_isTokenExpired() {
  const p = JSON.parse(atob(this.token().split('.')[1]...));
  return p.exp ? (p.exp * 1000) < Date.now() : false;
}
```

**3. Rate Limiting**

| 엔드포인트           | 제한                  | 목적            |
| -------------------- | --------------------- | --------------- |
| `/api/*`             | 15분 600회            | 일반 남용 방지  |
| `/api/auth/login`    | 15분 20회 (성공 제외) | 브루트포스 방어 |
| `/api/auth/register` | 1시간 5회             | 계정 스팸 방지  |

**4. XSS 방어**

```javascript
// api.js - 전역 함수
function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// 사용 예 (user.html 템플릿 리터럴 전체 적용)
`<div>${escHtml(r.purpose)}</div>`; // ← 28개 위치 적용
```

**5. CSP (Content Security Policy)**

```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      connectSrc: ["'none'"], // 외부 API 호출 차단
      frameAncestors: ["'none'"], // Clickjacking 방지
    },
  },
});
```

**6. 파일 업로드 보안**

```javascript
// 확장자 화이트리스트
const ALLOWED_EXTS = new Set([
  ".pdf",
  ".ppt",
  ".pptx",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".zip",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".txt",
  ".md",
  ".hwp",
]);

// UUID 파일명 저장 (원본 파일명 노출 방지)
filename: (req, file, cb) => cb(null, `${uuidv4()}${ext}`);

// 파일 크기 50MB 제한
limits: {
  fileSize: 50 * 1024 * 1024;
}
```

**7. SQL Injection 방어**

```javascript
// 모든 쿼리는 prepared statement 사용
db.prepare("SELECT * FROM users WHERE username=?").get(username);
// ? 바인딩으로 사용자 입력이 SQL로 해석되지 않음
```

**8. 환경변수 관리**

```bash
# production에서 JWT_SECRET 미설정 시 즉시 종료
if (process.env.NODE_ENV === 'production') {
  console.error('[FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}
```

---

## 🚀 설치 및 실행

### 요구 사항

- Node.js 18.x 이상
- npm 8.x 이상

### 빠른 시작

```bash
# 1. 프로젝트 복사
git clone <repo-url>
cd studymate-prod

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.example .env
# .env 파일을 열고 JWT_SECRET을 강력한 값으로 변경

# 4. 실행
npm start

# 개발 모드 (핫 리로드)
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 초기 계정

| 계정    | 비밀번호   | 권한   | 팀       |
| ------- | ---------- | ------ | -------- |
| `admin` | `admin123` | 관리자 | 운영팀   |
| `user1` | `user123`  | 일반   | 개발팀   |
| `user2` | `user123`  | 일반   | 디자인팀 |
| `user3` | `user123`  | 일반   | 기획팀   |

> ⚠️ **배포 전 반드시 모든 계정 비밀번호를 변경하세요.**

---

## 🌐 운영 배포

### .env 필수 설정

```bash
# 64자 이상 랜덤 문자열 생성
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# .env 설정
NODE_ENV=production
JWT_SECRET=<위에서 생성한 값>
PORT=3000
CORS_ORIGIN=https://yourdomain.com
JWT_EXPIRES=12h
```

### Nginx 리버스 프록시 설정 예시

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 업로드 파일 크기 제한
    client_max_body_size 50M;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### PM2 프로세스 관리

```bash
npm install -g pm2

# 시작
pm2 start server/app.js --name studymate

# 자동 재시작 설정
pm2 startup
pm2 save

# 모니터링
pm2 status
pm2 logs studymate
```

### 배포 체크리스트

- [ ] `JWT_SECRET` 64자 이상 랜덤값 설정
- [ ] `NODE_ENV=production` 설정
- [ ] `CORS_ORIGIN` 실제 도메인으로 제한
- [ ] HTTPS 적용 (Nginx + Let's Encrypt)
- [ ] `uploads/` 디렉토리 백업 정책 수립
- [ ] `studymate.db` 정기 백업 (cron)
- [ ] PM2 또는 systemd로 프로세스 관리
- [ ] 로그 로테이션 설정

---

## 🔬 구현 시 고려 사항

### 1. SQLite 동기 드라이버 선택

`better-sqlite3`는 비동기(`sqlite3`)와 달리 **동기 방식**으로 동작합니다.

**선택 이유:**

- Express + SQLite 환경에서 실제 병목은 DB가 아닌 네트워크
- 동기 코드의 가독성·디버깅 용이성
- `async/await` 체인 없이 단순한 트랜잭션 처리

**한계:**

- 단일 스레드에서 CPU 집약적 쿼리 시 이벤트 루프 블로킹 가능
- 대용량(수만 행 이상) 트랜잭션은 `setTimeout`으로 청크 처리 권장

### 2. 파일 업로드 흐름

```
Client (FormData)
    │
    ├─→ multer.fileFilter()  ← 확장자 화이트리스트 체크
    ├─→ multer.limits        ← 50MB 초과 시 413
    ├─→ multer.diskStorage   ← uploads/{uuid}.ext 저장
    │
    └─→ fileController.upload()
              ├─→ reservation 존재 여부 확인
              ├─→ 동일 제목 → version++ (버전 관리)
              ├─→ DB INSERT files
              └─→ 응답 (파일 메타데이터)
```

### 3. 팀 자료함 쿼리 설계

```sql
-- LEFT JOIN으로 reservation 없는 파일도 표시
SELECT f.*, u.username, u.display_name, u.team,
       COALESCE(r.date,'') as date,
       COALESCE(r.room_name,'') as room_name
FROM files f
JOIN users u ON f.user_id=u.id
LEFT JOIN reservations r ON f.reservation_id=r.id
WHERE (f.scope='public'
    OR (f.scope='team' AND u.team=?)
    OR f.user_id=?)
ORDER BY f.created_at DESC
LIMIT ? OFFSET ?
```

### 4. 실시간 혼잡도 예측 알고리즘

```javascript
// 과거 누적 통계 (byHour)와 선택일 실제 예약 (dayDetail) 오버레이
const avgPct = avgStat
  ? Math.min(
      100,
      Math.round(
        (avgStat.total_headcount / maxAvg) * DOW_MULTIPLIER[dow] * 100,
      ),
    )
  : 0;

const realPct = isRealData
  ? Math.min(100, Math.round((slotRecs.length / ROOM_COUNT) * 100))
  : null;

// 실제 데이터 있으면 우선, 없으면 통계 기반 예측
const displayPct = realPct !== null ? realPct : avgPct;
```

### 5. JWT 클라이언트 사전 검증

서버 호출 전에 만료된 토큰 필터링으로 불필요한 401 응답 제거:

```javascript
_isTokenExpired() {
  const payload = JSON.parse(atob(this.token().split('.')[1]...));
  return payload.exp ? (payload.exp * 1000) < Date.now() : false;
}
// guard() 호출 시: loggedIn() → !!token && !_isTokenExpired()
```

---

## 📁 프로젝트 구조

```
studymate-prod/
├── .env.example                # 환경변수 템플릿
├── .gitignore                  # .env, *.db, uploads/ 제외
├── package.json
├── README.md
│
├── public/                     # 정적 파일 (Express 서빙)
│   ├── css/
│   │   └── style.css           # CSS Variables 다크 테마 (941줄)
│   ├── js/
│   │   └── api.js              # 공통 API 클라이언트 + 보안 헬퍼
│   └── pages/
│       ├── index.html          # 로그인 / 회원가입
│       ├── user.html           # 사용자 UI (2341줄)
│       └── admin.html          # 관리자 대시보드 (1153줄)
│
└── server/
    ├── app.js                  # Express 앱 (미들웨어 스택)
    ├── uploads/                # 업로드 파일 (UUID 파일명, 자동 생성)
    ├── studymate.db            # SQLite DB (자동 생성)
    │
    ├── controllers/            # 비즈니스 로직
    │   ├── authController.js   # 인증 (191줄)
    │   ├── reservationController.js  # 예약 (257줄)
    │   ├── fileController.js   # 자료 (439줄)
    │   ├── favoriteController.js
    │   ├── roomController.js
    │   ├── userController.js
    │   └── notificationController.js
    │
    ├── routes/                 # Express 라우터
    │   ├── auth.js
    │   ├── reservation.js
    │   ├── file.js
    │   ├── favorite.js
    │   ├── room.js
    │   ├── user.js
    │   └── notification.js
    │
    └── models/
        └── db.js               # 스키마 DDL + 시드 데이터
```

---

<div align="center">

**StudyMate** — ❤️ using Node.js + SQLite + Vanilla JS

</div>
