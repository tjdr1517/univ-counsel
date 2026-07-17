"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bell, BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, ClipboardList, Copy,
  GraduationCap, Home, LogOut, Menu, Megaphone, MoreHorizontal, Plus, Search,
  Settings, Sparkles, UserRound, Users, X,
} from "lucide-react";
import {
  auth, connectStudentToTeacher, createAnnouncement, createConsultation, ensureTeacherConnectionCode, getOrCreateProfile, googleLogin,
  isFirebaseConfigured, logout, subscribeAnnouncements, subscribeConsultations,
  subscribeStudents, type AdmissionPlan, type Announcement, type AppRole,
  type ConsultationRecord, type UserProfile,
} from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type View = "home" | "records" | "students" | "announcements";

const demoTeacher: UserProfile = { uid: "teacher-demo", displayName: "김도윤", email: "teacher@damda.school", role: "teacher", connectionCode: "DAMDA1" };
const demoStudent: UserProfile = { uid: "student-seoyun", displayName: "박서윤", email: "seoyun@damda.school", role: "student", teacherId: "teacher-demo", teacherName: "김도윤", teacherCode: "DAMDA1", grade: 3, classNumber: 2 };
const demoStudents: UserProfile[] = [
  demoStudent,
  { uid: "student-minjun", displayName: "이민준", email: "minjun@damda.school", role: "student", teacherId: "teacher-demo", grade: 3, classNumber: 2 },
  { uid: "student-jihye", displayName: "최지혜", email: "jihye@damda.school", role: "student", teacherId: "teacher-demo", grade: 3, classNumber: 3 },
  { uid: "student-hyunwoo", displayName: "정현우", email: "hyunwoo@damda.school", role: "student", teacherId: "teacher-demo", grade: 3, classNumber: 4 },
];
const demoRecords: ConsultationRecord[] = [
  {
    id: "record-1", teacherId: "teacher-demo", studentId: "student-seoyun", studentName: "박서윤", date: "2026-07-15", topic: "수시 지원 전략 2차 점검",
    summary: "6월 모의평가 성적과 학생부 강점을 바탕으로 지원 대학을 구체화했습니다. 교과와 종합의 균형을 유지하며 8월 상담 전까지 자기소개 자료를 정리하기로 했습니다.",
    plans: [
      { university: "연세대학교", department: "사회학과", track: "학생부종합 활동우수형", minimum: "국·수·탐 중 2개 합 4", memo: "세특의 사회문제 탐구 활동 연결" },
      { university: "성균관대학교", department: "사회과학계열", track: "학생부종합 융합형", minimum: "없음", memo: "면접 없음, 서류 완성도 집중" },
    ],
  },
  {
    id: "record-2", teacherId: "teacher-demo", studentId: "student-minjun", studentName: "이민준", date: "2026-07-12", topic: "정시 학습 계획 및 목표 대학 설정",
    summary: "수학과 탐구 영역의 주간 학습량을 재조정했습니다. 9월 모의평가 전까지 오답 노트 루틴을 유지합니다.",
    plans: [{ university: "한양대학교", department: "기계공학부", track: "정시 일반전형", minimum: "해당 없음", memo: "수학 반영비율 확인" }],
  },
  {
    id: "record-3", teacherId: "teacher-demo", studentId: "student-seoyun", studentName: "박서윤", date: "2026-06-28", topic: "학생부 마감 전 최종 확인",
    summary: "교과 세부능력특기사항과 동아리 활동 기재 내용을 함께 확인했습니다.",
    plans: [{ university: "고려대학교", department: "정치외교학과", track: "학생부종합 학업우수형", minimum: "4개 합 8", memo: "수능 최저 충족 가능성 점검" }],
  },
];
const demoAnnouncements: Announcement[] = [
  { id: "notice-1", authorId: "teacher-demo", authorName: "김도윤", title: "2027학년도 수시 원서접수 일정 안내", body: "대학별 원서접수 기간과 제출서류 마감일을 꼭 확인하세요. 개인별 지원표는 다음 상담 전까지 업데이트해 주세요.", category: "입시 일정", isPinned: true },
  { id: "notice-2", authorId: "teacher-demo", authorName: "김도윤", title: "여름방학 자기소개 자료 작성 가이드", body: "활동을 단순 나열하지 말고, 관심이 생긴 계기와 탐구 과정, 배운 점을 중심으로 정리해 보세요.", category: "자료", isPinned: false },
  { id: "notice-3", authorId: "teacher-demo", authorName: "김도윤", title: "7월 상담 가능 시간표", body: "상담을 원하는 학생은 공강 시간과 방과 후 시간 중 가능한 시간을 메시지로 알려주세요.", category: "상담", isPinned: false },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export default function ConsultationApp() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [view, setView] = useState<View>("home");
  const [records, setRecords] = useState<ConsultationRecord[]>(demoRecords);
  const [announcements, setAnnouncements] = useState<Announcement[]>(demoAnnouncements);
  const [students, setStudents] = useState<UserProfile[]>(demoStudents);
  const [selectedRecord, setSelectedRecord] = useState<ConsultationRecord | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [recordModal, setRecordModal] = useState(false);
  const [noticeModal, setNoticeModal] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async user => {
      if (!user) { setProfile(null); setLoading(false); return; }
      try {
        const nextProfile = await getOrCreateProfile(user);
        setProfile(await ensureTeacherConnectionCode(nextProfile));
      }
      finally { setLoading(false); }
    });
  }, []);

  useEffect(() => {
    if (!profile || !isFirebaseConfigured) return;
    const unsubRecords = subscribeConsultations(profile, setRecords);
    const unsubNotices = subscribeAnnouncements(setAnnouncements);
    const unsubStudents = profile.role === "teacher" ? subscribeStudents(profile.uid, setStudents) : () => undefined;
    return () => { unsubRecords(); unsubNotices(); unsubStudents(); };
  }, [profile]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleRecords = useMemo(() => {
    const scoped = profile?.role === "student" ? records.filter(row => row.studentId === profile.uid) : records;
    const keyword = search.trim().toLowerCase();
    return keyword ? scoped.filter(row => `${row.studentName} ${row.topic} ${row.summary} ${row.plans.map(plan => `${plan.university} ${plan.department} ${plan.track} ${plan.minimum} ${plan.memo}`).join(" ")}`.toLowerCase().includes(keyword)) : scoped;
  }, [profile, records, search]);

  if (loading) return <div className="loading-screen"><span className="brand-mark">담</span><p>상담 기록을 불러오는 중...</p></div>;
  if (!profile) return <LoginScreen onDemo={role => setProfile(role === "teacher" ? demoTeacher : demoStudent)} />;

  const selectView = (next: View) => { setView(next); setMobileNav(false); setSelectedRecord(null); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-top">
          <button className="brand" onClick={() => selectView("home")} aria-label="홈으로 이동"><span className="brand-mark">담</span><span>담다</span></button>
          <button className="icon-button mobile-only" onClick={() => setMobileNav(false)} aria-label="메뉴 닫기"><X size={20} /></button>
        </div>
        <div className="profile-chip">
          <span className="avatar">{profile.displayName.slice(0, 1)}</span>
          <div><strong>{profile.displayName}</strong><small>{profile.role === "teacher" ? "진로진학 교사" : `${profile.grade ?? 3}학년 학생`}</small></div>
          <ChevronDown size={16} />
        </div>
        <nav className="nav-list" aria-label="주요 메뉴">
          <NavItem active={view === "home"} icon={<Home />} label="홈" onClick={() => selectView("home")} />
          <NavItem active={view === "records"} icon={<ClipboardList />} label="상담 기록" badge={visibleRecords.length} onClick={() => selectView("records")} />
          {profile.role === "teacher" && <NavItem active={view === "students"} icon={<Users />} label="학생 관리" badge={students.length} onClick={() => selectView("students")} />}
          <NavItem active={view === "announcements"} icon={<Megaphone />} label="공지 · 정보" onClick={() => selectView("announcements")} />
        </nav>
        <div className="sidebar-section">
          <span>빠른 보기</span>
          <button onClick={() => selectView("records")}><span className="dot amber" />최근 상담</button>
          <button onClick={() => selectView("announcements")}><span className="dot blue" />입시 일정</button>
        </div>
        <div className="sidebar-footer">
          <button><Settings size={17} />설정</button>
          <button onClick={async () => { await logout(); setProfile(null); }}><LogOut size={17} />로그아웃</button>
        </div>
      </aside>
      {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="메뉴 닫기" />}

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileNav(true)} aria-label="메뉴 열기"><Menu size={21} /></button>
          <div className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="학생, 대학, 상담 내용 검색" aria-label="통합 검색" /></div>
          <div className="topbar-actions"><button className="icon-button" aria-label="알림"><Bell size={19} /><span className="notification-dot" /></button><span className="top-avatar">{profile.displayName.slice(0, 1)}</span></div>
        </header>

        <div className="page-wrap">
          {view === "home" && <Dashboard profile={profile} records={visibleRecords} announcements={announcements} students={students} onProfileChange={setProfile} onToast={setToast} onView={selectView} onSelectRecord={row => { setSelectedRecord(row); setView("records"); }} onNewRecord={() => setRecordModal(true)} />}
          {view === "records" && <RecordsPage profile={profile} records={visibleRecords} selected={selectedRecord} onSelect={setSelectedRecord} onBack={() => setSelectedRecord(null)} onNew={() => setRecordModal(true)} />}
          {view === "students" && <StudentsPage students={students} records={records} onOpen={student => { const first = records.find(row => row.studentId === student.uid) ?? null; setSelectedRecord(first); setView("records"); }} />}
          {view === "announcements" && <AnnouncementsPage profile={profile} announcements={announcements} onNew={() => setNoticeModal(true)} />}
        </div>
      </main>

      {recordModal && <RecordModal profile={profile} students={students} onClose={() => setRecordModal(false)} onSave={async input => {
        if (isFirebaseConfigured) await createConsultation(input);
        else setRecords(current => [{ ...input, id: `demo-${Date.now()}` }, ...current]);
        setRecordModal(false); setToast("상담 기록을 저장했습니다.");
      }} />}
      {noticeModal && <NoticeModal profile={profile} onClose={() => setNoticeModal(false)} onSave={async input => {
        if (isFirebaseConfigured) await createAnnouncement(input);
        else setAnnouncements(current => [{ ...input, id: `demo-${Date.now()}` }, ...current]);
        setNoticeModal(false); setToast("새 공지를 게시했습니다.");
      }} />}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

function LoginScreen({ onDemo }: { onDemo: (role: AppRole) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const login = async () => {
    if (!isFirebaseConfigured) { setError("아래 데모 계정으로 먼저 둘러보세요. Firebase 설정 후 Google 로그인이 활성화됩니다."); return; }
    setBusy(true); setError("");
    try { await googleLogin(); } catch { setError("로그인하지 못했습니다. 잠시 후 다시 시도해 주세요."); setBusy(false); }
  };
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand"><span className="brand-mark">담</span><span>담다</span></div>
        <div className="story-copy"><span className="eyebrow">대입 상담 기록 플랫폼</span><h1>한 번의 상담도,<br />놓치지 않도록.</h1><p>교사와 학생이 같은 방향을 바라볼 수 있게<br />상담의 과정과 지원 전략을 차곡차곡 담습니다.</p></div>
        <div className="quote-card"><Sparkles size={18} /><p>“기록은 학생의 가능성을<br />더 선명하게 만듭니다.”</p><small>담다의 시작 화면</small></div>
      </section>
      <section className="login-panel">
        <div className="login-box">
          <span className="mobile-login-logo"><span className="brand-mark">담</span>담다</span>
          <h2>반가워요</h2><p>학교 Google 계정으로 간편하게 시작하세요.</p>
          <button className="google-button" onClick={login} disabled={busy}><span className="google-g">G</span>{busy ? "로그인 중..." : "Google 계정으로 계속하기"}</button>
          {error && <p className="login-error">{error}</p>}
          {!isFirebaseConfigured && <div className="demo-login"><span>설정 전 데모 체험</span><div><button onClick={() => onDemo("teacher")}>교사로 둘러보기</button><button onClick={() => onDemo("student")}>학생으로 둘러보기</button></div></div>}
          <p className="privacy-note">계속하면 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</p>
        </div>
      </section>
    </main>
  );
}

function NavItem({ active, icon, label, badge, onClick }: { active: boolean; icon: React.ReactNode; label: string; badge?: number; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span>{badge !== undefined && <small>{badge}</small>}</button>;
}

function Dashboard({ profile, records, announcements, students, onProfileChange, onToast, onView, onSelectRecord, onNewRecord }: {
  profile: UserProfile; records: ConsultationRecord[]; announcements: Announcement[]; students: UserProfile[];
  onProfileChange: (profile: UserProfile) => void; onToast: (message: string) => void;
  onView: (view: View) => void; onSelectRecord: (record: ConsultationRecord) => void; onNewRecord: () => void;
}) {
  const isTeacher = profile.role === "teacher";
  const todayLabel = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date());
  const currentMonth = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" }).format(new Date());
  return <>
    <div className="page-heading"><div><span className="date-label">{todayLabel}</span><h1>{profile.displayName} {isTeacher ? "선생님" : "학생"}, 안녕하세요 <span>👋</span></h1><p>{isTeacher ? "오늘도 학생들의 가능성을 함께 찾아볼까요?" : "지원 계획과 지난 상담 내용을 차근차근 확인해 보세요."}</p></div>{isTeacher && <button className="primary-button" onClick={onNewRecord}><Plus size={18} />새 상담 기록</button>}</div>
    <ConnectionPanel profile={profile} onProfileChange={onProfileChange} onToast={onToast} />
    <div className="stats-grid">
      <Stat icon={<Users />} color="sage" label={isTeacher ? "담당 학생" : "나의 상담"} value={isTeacher ? `${students.length}명` : `${records.length}건`} note={isTeacher ? "고3 전체" : "누적 기록"} />
      <Stat icon={<CalendarDays />} color="peach" label="이번 달 상담" value={`${records.filter(r => r.date.startsWith(currentMonth)).length}건`} note="최근 업데이트" />
      <Stat icon={<GraduationCap />} color="blue" label="지원 대학" value={`${new Set(records.flatMap(r => r.plans.map(p => p.university))).size}곳`} note="전체 전형 기준" />
    </div>
    <div className="content-grid">
      <section className="card recent-card"><CardHeader icon={<ClipboardList />} title="최근 상담 기록" action="전체 보기" onClick={() => onView("records")} /><div className="record-list">{records.slice(0, 4).map(row => <button className="record-row" key={row.id} onClick={() => onSelectRecord(row)}><span className="date-tile"><strong>{new Date(`${row.date}T00:00:00`).getDate()}</strong><small>{new Date(`${row.date}T00:00:00`).toLocaleString("ko-KR", { month: "short" })}</small></span><span className="record-copy"><strong>{row.topic}</strong><small>{isTeacher && `${row.studentName} · `}{row.plans.map(p => p.university).join(", ")}</small></span><ChevronRight size={18} /></button>)}</div></section>
      <section className="card notice-card"><CardHeader icon={<Megaphone />} title="공지 · 입시 정보" action="전체 보기" onClick={() => onView("announcements")} /><div className="notice-list">{announcements.slice(0, 3).map(item => <article key={item.id}><span className="tag">{item.category}</span><div><strong>{item.title}</strong><p>{item.body}</p></div></article>)}</div></section>
    </div>
    <section className="tip-banner"><span className="tip-icon"><BookOpen /></span><div><span>오늘의 상담 팁</span><strong>학생이 스스로 다음 행동을 말하게 해보세요.</strong><p>상담의 마지막 3분, “그래서 이번 주에는 무엇을 해볼까요?”라고 물으면 실행 가능성이 높아집니다.</p></div></section>
  </>;
}

function ConnectionPanel({ profile, onProfileChange, onToast }: { profile: UserProfile; onProfileChange: (profile: UserProfile) => void; onToast: (message: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (profile.role === "teacher") {
    return <section className="connection-panel teacher-connection"><div><span className="connection-icon"><Users /></span><div><strong>학생 연결 코드</strong><p>학생에게 코드를 전달하면 담당 학생으로 안전하게 연결됩니다.</p></div></div><button type="button" onClick={async () => { await navigator.clipboard.writeText(profile.connectionCode ?? ""); onToast("연결 코드를 복사했습니다."); }}><b>{profile.connectionCode ?? "생성 중"}</b><Copy size={15} /></button></section>;
  }
  if (profile.teacherId) {
    return <section className="connection-panel connected"><span className="connection-icon"><Check /></span><div><strong>{profile.teacherName ?? "담당 교사"} 선생님과 연결됨</strong><p>상담 기록은 연결된 선생님과 학생 본인만 볼 수 있습니다.</p></div></section>;
  }
  return <section className="connection-panel needs-connection"><div><span className="connection-icon"><UserRound /></span><div><strong>담당 선생님과 연결해 주세요</strong><p>선생님에게 받은 6자리 연결 코드를 입력하세요.</p></div></div><form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); try { const next = await connectStudentToTeacher(profile, code); onProfileChange(next); onToast("담당 선생님과 연결되었습니다."); } catch (reason) { setError(reason instanceof Error ? reason.message : "연결하지 못했습니다."); } finally { setBusy(false); } }}><input value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={6} placeholder="연결 코드" aria-label="교사 연결 코드" required /><button className="primary-button" disabled={busy}>{busy ? "확인 중" : "연결"}</button></form>{error && <p className="connection-error">{error}</p>}</section>;
}

function Stat({ icon, color, label, value, note }: { icon: React.ReactNode; color: string; label: string; value: string; note: string }) {
  return <section className="stat-card"><span className={`stat-icon ${color}`}>{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></section>;
}

function CardHeader({ icon, title, action, onClick }: { icon: React.ReactNode; title: string; action: string; onClick: () => void }) {
  return <header className="card-header"><h2>{icon}{title}</h2><button onClick={onClick}>{action}<ChevronRight size={15} /></button></header>;
}

function RecordsPage({ profile, records, selected, onSelect, onBack, onNew }: { profile: UserProfile; records: ConsultationRecord[]; selected: ConsultationRecord | null; onSelect: (row: ConsultationRecord) => void; onBack: () => void; onNew: () => void }) {
  if (selected) return <RecordDetail record={selected} onBack={onBack} />;
  return <><div className="section-heading"><div><span className="eyebrow">COUNSELING LOG</span><h1>상담 기록</h1><p>{profile.role === "teacher" ? "학생과 나눈 상담과 지원 전략을 한곳에서 관리합니다." : "선생님과 함께 정리한 상담 내용과 지원 전략입니다."}</p></div>{profile.role === "teacher" && <button className="primary-button" onClick={onNew}><Plus size={18} />상담 기록 추가</button>}</div><section className="card table-card"><div className="table-head"><span>일자</span><span>학생</span><span>상담 주제</span><span>지원 대학</span><span /></div>{records.length ? records.map(row => <button className="table-row" key={row.id} onClick={() => onSelect(row)}><span>{formatDate(row.date)}</span><span className="student-cell"><i>{row.studentName.slice(0, 1)}</i>{row.studentName}</span><strong>{row.topic}</strong><span>{row.plans.map(p => p.university).join(", ")}</span><ChevronRight size={17} /></button>) : <div className="empty-state"><ClipboardList /><strong>아직 상담 기록이 없습니다.</strong><p>첫 상담을 기록해 보세요.</p></div>}</section></>;
}

function RecordDetail({ record, onBack }: { record: ConsultationRecord; onBack: () => void }) {
  return <article className="record-detail"><button className="back-button" onClick={onBack}>← 상담 기록</button><div className="detail-title"><span className="page-icon"><ClipboardList /></span><div><span>{formatDate(record.date)} · {record.studentName}</span><h1>{record.topic}</h1></div><button className="icon-button"><MoreHorizontal /></button></div><section><h2>상담 요약</h2><p className="summary-text">{record.summary}</p></section><section><h2>지원 전형</h2><div className="plan-grid">{record.plans.map((plan, index) => <article className="plan-card" key={`${plan.university}-${index}`}><header><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{plan.university}</h3><p>{plan.department}</p></div></header><dl><div><dt>전형</dt><dd>{plan.track}</dd></div><div><dt>수능 최저</dt><dd>{plan.minimum}</dd></div><div><dt>메모</dt><dd>{plan.memo}</dd></div></dl></article>)}</div></section><section><h2>다음 상담 전 체크</h2><label className="check-item"><input type="checkbox" />대학별 모집요강의 변경 사항 다시 확인하기</label><label className="check-item"><input type="checkbox" />학생부 활동과 지원동기 연결 문장 정리하기</label></section></article>;
}

function StudentsPage({ students, records, onOpen }: { students: UserProfile[]; records: ConsultationRecord[]; onOpen: (student: UserProfile) => void }) {
  return <><div className="section-heading"><div><span className="eyebrow">MY STUDENTS</span><h1>학생 관리</h1><p>담당 학생의 상담 현황을 빠르게 확인합니다.</p></div></div><div className="student-grid">{students.map(student => { const own = records.filter(r => r.studentId === student.uid); return <button className="student-card" key={student.uid} onClick={() => onOpen(student)}><span className="student-avatar">{student.displayName.slice(0, 1)}</span><div><h3>{student.displayName}</h3><p>{student.grade ?? 3}학년 {student.classNumber ?? 1}반</p></div><dl><div><dt>상담</dt><dd>{own.length}건</dd></div><div><dt>최근</dt><dd>{own[0]?.date.slice(5).replace("-", ".") ?? "-"}</dd></div></dl><ChevronRight size={17} /></button>; })}</div></>;
}

function AnnouncementsPage({ profile, announcements, onNew }: { profile: UserProfile; announcements: Announcement[]; onNew: () => void }) {
  return <><div className="section-heading"><div><span className="eyebrow">NOTICE & GUIDE</span><h1>공지 · 입시 정보</h1><p>중요 일정과 도움이 되는 자료를 함께 확인합니다.</p></div>{profile.role === "teacher" && <button className="primary-button" onClick={onNew}><Plus size={18} />새 글 작성</button>}</div><div className="announcement-grid">{announcements.map(item => <article className={`announcement-card ${item.isPinned ? "pinned" : ""}`} key={item.id}>{item.isPinned && <span className="pin-label">중요 공지</span>}<div className="announcement-meta"><span className="tag">{item.category}</span><span>{item.authorName} 선생님</span></div><h2>{item.title}</h2><p>{item.body}</p><button>자세히 보기 <ChevronRight size={15} /></button></article>)}</div></>;
}

function ModalShell({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-scrim" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><h2 id="modal-title">{title}</h2><p>{description}</p></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X /></button></header>{children}</section></div>;
}

const emptyPlan = (): AdmissionPlan => ({ university: "", department: "", track: "", minimum: "", memo: "" });

function RecordModal({ profile, students, onClose, onSave }: { profile: UserProfile; students: UserProfile[]; onClose: () => void; onSave: (input: Omit<ConsultationRecord, "id">) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<AdmissionPlan[]>([emptyPlan()]);
  const updatePlan = (index: number, key: keyof AdmissionPlan, value: string) => setPlans(current => current.map((plan, planIndex) => planIndex === index ? { ...plan, [key]: value } : plan));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const student = students.find(item => item.uid === form.get("studentId"));
    if (!student) { setSaving(false); return; }
    await onSave({ teacherId: profile.uid, studentId: student.uid, studentName: student.displayName, date: String(form.get("date")), topic: String(form.get("topic")), summary: String(form.get("summary")), plans });
  };
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  return <ModalShell title="새 상담 기록" description="상담 내용과 지원 전형을 기록합니다." onClose={onClose}><form onSubmit={submit} className="modal-form"><div className="field-row"><label>학생<select name="studentId" required defaultValue=""><option value="" disabled>{students.length ? "학생 선택" : "연결된 학생이 없습니다"}</option>{students.map(s => <option value={s.uid} key={s.uid}>{s.displayName}</option>)}</select></label><label>상담 일자<input name="date" type="date" required defaultValue={today} /></label></div><label>상담 주제<input name="topic" required placeholder="예: 수시 지원 전략 2차 점검" /></label><label>상담 요약<textarea name="summary" required rows={4} placeholder="상담에서 나눈 핵심 내용과 다음 행동을 기록하세요." /></label>{plans.map((plan, index) => <div className="plan-editor" key={index}><div className="form-divider"><span>지원 전형 {String(index + 1).padStart(2, "0")}</span>{plans.length > 1 && <button type="button" onClick={() => setPlans(current => current.filter((_, planIndex) => planIndex !== index))}>삭제</button>}</div><div className="field-row"><label>학교<input required value={plan.university} onChange={e => updatePlan(index, "university", e.target.value)} placeholder="대학교" /></label><label>학과<input required value={plan.department} onChange={e => updatePlan(index, "department", e.target.value)} placeholder="학과 / 계열" /></label></div><div className="field-row"><label>전형<input required value={plan.track} onChange={e => updatePlan(index, "track", e.target.value)} placeholder="학생부종합" /></label><label>수능 최저<input value={plan.minimum} onChange={e => updatePlan(index, "minimum", e.target.value)} placeholder="예: 2개 합 5 / 없음" /></label></div><label>전형 메모<input value={plan.memo} onChange={e => updatePlan(index, "memo", e.target.value)} placeholder="확인할 사항이나 학생의 강점" /></label></div>)}<button type="button" className="add-plan-button" onClick={() => setPlans(current => [...current, emptyPlan()])}><Plus size={15} />지원 전형 추가</button><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={saving || !students.length}>{saving ? "저장 중..." : "기록 저장"}</button></div></form></ModalShell>;
}

function NoticeModal({ profile, onClose, onSave }: { profile: UserProfile; onClose: () => void; onSave: (input: Omit<Announcement, "id" | "publishedAt">) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget); await onSave({ authorId: profile.uid, authorName: profile.displayName, title: String(form.get("title")), body: String(form.get("body")), category: String(form.get("category")), isPinned: form.get("isPinned") === "on" }); };
  return <ModalShell title="새 공지 작성" description="모든 학생이 함께 볼 정보를 게시합니다." onClose={onClose}><form onSubmit={submit} className="modal-form"><label>분류<select name="category"><option>입시 일정</option><option>자료</option><option>상담</option><option>기타</option></select></label><label>제목<input name="title" required placeholder="공지 제목" /></label><label>내용<textarea name="body" rows={7} required placeholder="학생들에게 전달할 내용을 작성하세요." /></label><label className="toggle-label"><input type="checkbox" name="isPinned" />중요 공지로 상단에 표시</label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={saving}>{saving ? "게시 중..." : "공지 게시"}</button></div></form></ModalShell>;
}
