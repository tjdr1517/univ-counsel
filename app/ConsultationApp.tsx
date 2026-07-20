"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Bell, CalendarClock, Check, ChevronLeft, ChevronRight, ClipboardList, FileText, GraduationCap, Home, LogOut, Menu, Megaphone, MessageCircle, Paperclip, Pencil, Plus, Search, Send, Settings2, ShieldCheck, Trash2, Upload, Users, X } from "lucide-react";
import type { Announcement, AppointmentSlot, Attachment, Consultation, DashboardData, InterestUniversity, Role, User } from "../lib/types";

type View = "home" | "records" | "interests" | "appointments" | "students" | "announcements" | "settings";

const viewHashes: Record<View, string> = { home: "", records: "records", interests: "interests", appointments: "appointments", students: "students", announcements: "announcements", settings: "settings" };

function viewFromLocation(): View {
  if (typeof window === "undefined") return "home";
  const hash = window.location.hash.slice(1);
  return (Object.entries(viewHashes).find(([, value]) => value === hash)?.[0] as View | undefined) ?? "home";
}

function viewUrl(view: View) {
  const base = `${window.location.pathname}${window.location.search}`;
  return view === "home" ? base : `${base}#${viewHashes[view]}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

function formatDate(value: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!parts) return value;
  const [, year, month, day] = parts;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(Number(year), Number(month) - 1, Number(day)));
}

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function ConsultationApp() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>(viewFromLocation);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [recordModal, setRecordModal] = useState(false);
  const [interestModal, setInterestModal] = useState(false);
  const [editingInterest, setEditingInterest] = useState<InterestUniversity | null>(null);
  const [appointmentModal, setAppointmentModal] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [noticeModal, setNoticeModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null);
  const [noticeCategory, setNoticeCategory] = useState("입시 일정");
  const [toast, setToast] = useState("");

  const refresh = async () => {
    const next = await api<DashboardData>("/api/dashboard");
    setData(next); setUser(next.user);
  };

  useEffect(() => {
    const initialView = viewFromLocation();
    const state = window.history.state as { appView?: View } | null;
    if (!state?.appView) {
      if (initialView === "home") window.history.replaceState({ appView: "home" }, "", viewUrl("home"));
      else {
        window.history.replaceState({ appView: "home" }, "", viewUrl("home"));
        window.history.pushState({ appView: initialView }, "", viewUrl(initialView));
      }
    }
    const restoreView = () => { setView(viewFromLocation()); setMenu(false); setSelected(null); };
    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, []);

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then(next => {
      setData(next); setUser(next.user);
    }).catch(async () => {
      try { const { user } = await api<{ user: User }>("/api/auth/me"); setUser(user); }
      catch { setUser(null); }
    }).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const records = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const rows = data?.consultations ?? [];
    return keyword ? rows.filter(row => `${row.studentName} ${row.topic} ${row.summary}`.toLowerCase().includes(keyword)) : rows;
  }, [data, search]);
  const interests = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const rows = data?.interests ?? [];
    return keyword ? rows.filter(row => `${row.studentName} ${row.university} ${row.department} ${row.track} ${row.admissionName} ${row.evaluationFactors} ${row.minimum} ${row.memo}`.toLowerCase().includes(keyword)) : rows;
  }, [data, search]);

  if (checking) return <div className="center-state" role="status" aria-label="앱 불러오는 중"><div className="spinner" /></div>;
  if (!user) return <AuthScreen onAuthenticated={next => { setUser(next); if (next.status === "approved") refresh().catch(() => undefined); }} />;
  if (user.status !== "approved") return <ApprovalWaiting user={user} onLogout={async () => { await api("/api/auth/logout", { method: "POST" }); setUser(null); }} />;
  if (!data) return <div className="center-state"><div className="spinner" /><p>상담 기록을 불러오고 있습니다.</p></div>;

  const navigate = (next: View) => {
    if (next !== view || window.location.hash.slice(1) !== viewHashes[next]) window.history.pushState({ appView: next }, "", viewUrl(next));
    setView(next); setMenu(false); setSelected(null);
  };
  const logout = async () => { await api("/api/auth/logout", { method: "POST" }); setUser(null); setData(null); };
  const notify = (message: string) => { setToast(message); refresh().catch(() => undefined); };

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <div className="sidebar-top"><button className="brand" onClick={() => navigate("home")}><span className="brand-mark">대</span><span>대입 상담</span></button><button className="icon-button mobile-only" onClick={() => setMenu(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
      <div className="profile-chip"><span className="avatar">{user.name.slice(0, 1)}</span><div><strong>{user.name}</strong><small>{user.role === "teacher" ? "진로진학 교사" : `${user.studentNumber ?? "-"}번 학생`}</small></div></div>
      <nav className="nav-list">
        <Nav active={view === "home"} icon={<Home />} label="홈" onClick={() => navigate("home")} />
        <Nav active={view === "records"} icon={<ClipboardList />} label="상담 기록" badge={records.length} onClick={() => navigate("records")} />
        <Nav active={view === "interests"} icon={<GraduationCap />} label="관심 대학" badge={interests.length} onClick={() => navigate("interests")} />
        <Nav active={view === "appointments"} icon={<CalendarClock />} label="상담 신청" badge={data.appointments.filter(slot => slot.status === "available" || slot.isMine).length} onClick={() => navigate("appointments")} />
        {user.role === "teacher" && <Nav active={view === "students"} icon={<Users />} label="학생 관리" badge={data.students.length} onClick={() => navigate("students")} />}
        <Nav active={view === "announcements"} icon={<Megaphone />} label="공지 · 정보" onClick={() => navigate("announcements")} />
        {user.role === "teacher" && <Nav active={view === "settings"} icon={<Settings2 />} label="설정" onClick={() => navigate("settings")} />}
      </nav>
      <div className="sidebar-footer"><button onClick={logout}><LogOut size={17} />로그아웃</button></div>
    </aside>
    {menu && <button className="nav-scrim" onClick={() => setMenu(false)} aria-label="메뉴 닫기" />}
    <main className="main-panel">
      <header className="topbar"><button className="icon-button mobile-only" onClick={() => setMenu(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="학생, 학교, 상담 내용 검색" /></div><div className="topbar-actions"><Bell size={18} /><span className="top-avatar">{user.name.slice(0, 1)}</span></div></header>
      <div className="page-wrap">
        {view === "home" && <HomePage user={user} data={data} records={records} onView={navigate} onNew={() => setRecordModal(true)} onSelect={record => { setSelected(record); setView("records"); }} />}
        {view === "records" && <RecordsPage user={user} records={records} selected={selected} onSelect={setSelected} onBack={() => setSelected(null)} onNew={() => setRecordModal(true)} />}
        {view === "interests" && <InterestsPage user={user} students={data.students} interests={interests} onNew={() => { setEditingInterest(null); setInterestModal(true); }} onEdit={item => { setEditingInterest(item); setInterestModal(true); }} onPriorityChange={async (id, priority) => { await api(`/api/interests/${id}`, { method: "PATCH", body: JSON.stringify({ priority }) }); notify("지망 순위를 변경했습니다."); }} />}
        {view === "appointments" && <AppointmentsPage user={user} appointments={data.appointments} notices={data.announcements.filter(notice => notice.category === "상담")} onNew={date => { setAppointmentDate(date); setAppointmentModal(true); }} onReserve={async id => { await api(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ action: "reserve" }) }); notify("상담을 신청했습니다. 교사 승인을 기다려 주세요."); }} onApprove={async id => { await api(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }); notify("상담 예약을 확정했습니다."); }} onApproveCancel={async id => { await api(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ action: "approve_cancel" }) }); notify("학생의 예약 취소를 승인했습니다."); }} onRejectCancel={async id => { await api(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ action: "reject_cancel" }) }); notify("학생의 예약 취소를 거절했습니다."); }} onCancel={async id => { await api(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) }); notify("취소 요청을 처리했습니다."); }} onDelete={async id => { await api(`/api/appointments/${id}`, { method: "DELETE" }); notify("상담 시간을 삭제했습니다."); }} onNewNotice={() => { setEditingNotice(null); setNoticeCategory("상담"); setNoticeModal(true); }} onEditNotice={notice => { setEditingNotice(notice); setNoticeCategory("상담"); setNoticeModal(true); }} onDeleteNotice={async notice => { await api(`/api/announcements/${notice.id}`, { method: "DELETE" }); notify("상담 공지를 삭제했습니다."); }} />}
        {view === "students" && <StudentsPage data={data} />}
        {view === "announcements" && <AnnouncementsPage user={user} announcements={data.announcements} onNew={() => { setEditingNotice(null); setNoticeCategory("입시 일정"); setNoticeModal(true); }} onEdit={notice => { setEditingNotice(notice); setNoticeCategory(notice.category); setNoticeModal(true); }} onDelete={async notice => { await api(`/api/announcements/${notice.id}`, { method: "DELETE" }); notify("공지를 삭제했습니다."); }} />}
        {view === "settings" && user.role === "teacher" && <SettingsPage onRegistrationChanged={() => refresh().catch(() => undefined)} />}
      </div>
    </main>
    {recordModal && <RecordModal students={data.students} onClose={() => setRecordModal(false)} onSaved={() => { setRecordModal(false); notify("상담 기록을 저장했습니다."); }} />}
    {interestModal && <InterestModal user={user} students={data.students} interest={editingInterest} onClose={() => { setInterestModal(false); setEditingInterest(null); }} onSaved={() => { const edited = Boolean(editingInterest); setInterestModal(false); setEditingInterest(null); notify(edited ? "관심 대학을 수정했습니다." : "관심 대학을 저장했습니다."); }} />}
    {appointmentModal && <AppointmentModal initialDate={appointmentDate} appointments={data.appointments} onClose={() => setAppointmentModal(false)} onSaved={() => { setAppointmentModal(false); notify("상담 가능 일정을 추가했습니다."); }} />}
    {noticeModal && <NoticeModal notice={editingNotice} defaultCategory={noticeCategory} onClose={() => { setNoticeModal(false); setEditingNotice(null); }} onSaved={attachmentFailed => { const edited = Boolean(editingNotice); setNoticeModal(false); setEditingNotice(null); notify(attachmentFailed ? `${edited ? "공지는 수정했지만" : "공지는 게시했지만"} 첨부 파일은 올리지 못했습니다.` : edited ? "공지를 수정했습니다." : "공지를 게시했습니다."); }} />}
    {toast && <div className="toast"><Check size={17} />{toast}</div>}
  </div>;
}

function Nav({ active, icon, label, badge, onClick }: { active: boolean; icon: React.ReactNode; label: string; badge?: number; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span>{badge !== undefined && <small>{badge}</small>}</button>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  useEffect(() => { api<{ registrationOpen: boolean }>("/api/auth/registration").then(result => setRegistrationOpen(result.registrationOpen)).catch(() => setRegistrationOpen(false)); }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result = await api<{ user: User }>(`/api/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", body: JSON.stringify({ ...body, role }) });
      onAuthenticated(result.user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "처리하지 못했습니다."); setBusy(false); }
  };
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">대</span><div><strong>대입 상담</strong><small>상담 기록</small></div></div><h1>{mode === "login" ? "로그인" : "계정 만들기"}</h1><p>{mode === "login" ? "아이디와 비밀번호로 시작하세요." : role === "teacher" ? "교사 계정은 개설 코드가 필요합니다." : registrationOpen ? "가입하면 바로 상담 기록을 사용할 수 있습니다." : "현재 학생 가입이 닫혀 있습니다."}</p>
    {mode === "register" && <div className="role-tabs"><button type="button" className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>학생</button><button type="button" className={role === "teacher" ? "active" : ""} onClick={() => setRole("teacher")}>교사</button></div>}
    <form onSubmit={submit} className="auth-form">
      {mode === "register" && <label>이름<input name="name" required autoComplete="name" placeholder="이름" /></label>}
      <label>아이디<input name="username" required minLength={4} maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9._-]{3,19}" autoComplete="username" placeholder="영문·숫자 4~20자" /></label>
      <label>비밀번호<input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="8자 이상" /></label>
      {mode === "register" && role === "student" && <label>번호<input name="studentNumber" type="number" inputMode="numeric" min="1" max="99" required placeholder="우리 반 번호" /></label>}
      {mode === "register" && role === "teacher" && <label>교사 개설 코드<input name="setupCode" type="password" required placeholder="관리자에게 받은 코드" /></label>}
      {mode === "register" && role === "student" && registrationOpen === false && <p className="registration-closed">선생님이 설정에서 학생 가입을 열면 가입할 수 있습니다.</p>}
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button auth-submit" disabled={busy || (mode === "register" && role === "student" && registrationOpen !== true)}>{busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}</button>
    </form>
    <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "처음이신가요? 계정 만들기" : "이미 계정이 있나요? 로그인"}</button>
  </section></main>;
}

function ApprovalWaiting({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <main className="auth-page"><section className="auth-card waiting-card"><span className="waiting-icon"><ShieldCheck /></span><h1>학생 가입이 닫혀 있어요</h1><p><strong>{user.name}</strong>님의 기존 계정은 아직 연결되지 않았습니다.<br />선생님이 학생 가입을 열면 자동으로 사용할 수 있습니다.</p><button className="secondary-button" onClick={onLogout}>다른 계정으로 로그인</button></section></main>;
}

function HomePage({ user, data, records, onView, onNew, onSelect }: { user: User; data: DashboardData; records: Consultation[]; onView: (view: View) => void; onNew: () => void; onSelect: (record: Consultation) => void }) {
  const teacher = user.role === "teacher";
  return <><div className="page-heading"><div><span className="eyebrow">TODAY&apos;S COUNSELING</span><h1>{user.name}님, 안녕하세요.</h1><p>{teacher ? "학생의 지원 전략과 상담 과정을 차곡차곡 기록하세요." : "선생님과 함께 정리한 지원 전략을 확인하세요."}</p></div>{teacher && <button className="primary-button" onClick={onNew}><Plus size={17} />새 상담 기록</button>}</div>
    <div className="stats-grid"><Stat icon={<Users />} label={teacher ? "담당 학생" : "나의 상담"} value={teacher ? `${data.students.length}명` : `${records.length}건`} /><Stat icon={<ClipboardList />} label="상담 기록" value={`${records.length}건`} /><Stat icon={<GraduationCap />} label="관심 대학" value={`${new Set(data.interests.map(item => item.university)).size}곳`} /></div>
    <div className="content-grid"><section className="card"><div className="card-header"><h2><ClipboardList />최근 상담</h2><button onClick={() => onView("records")}>전체 보기 <ChevronRight /></button></div><div className="record-list">{records.slice(0, 5).map(row => <button className="record-row" key={row.id} onClick={() => onSelect(row)}><span className="date-tile"><strong>{row.date.slice(8)}</strong><small>{row.date.slice(5, 7)}월</small></span><span className="record-copy"><strong>{row.topic}</strong><small>{row.studentName} · {row.summary}</small></span><ChevronRight /></button>)}{!records.length && <Empty text="아직 상담 기록이 없습니다." />}</div></section>
    <section className="card"><div className="card-header"><h2><Megaphone />최근 공지</h2><button onClick={() => onView("announcements")}>전체 보기 <ChevronRight /></button></div><div className="notice-list">{data.announcements.slice(0, 4).map(item => <article key={item.id}><span className="tag">{item.category}</span><div><strong>{item.title}</strong><p>{item.body}</p></div></article>)}{!data.announcements.length && <Empty text="등록된 공지가 없습니다." />}</div></section></div></>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="stat-card"><span className="stat-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div></article>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><FileText /><strong>{text}</strong></div>; }

function RecordsPage({ user, records, selected, onSelect, onBack, onNew }: { user: User; records: Consultation[]; selected: Consultation | null; onSelect: (record: Consultation) => void; onBack: () => void; onNew: () => void }) {
  if (selected) return <RecordDetail record={selected} onBack={onBack} />;
  return <><div className="section-heading"><div><span className="eyebrow">COUNSELING LOG</span><h1>상담 기록</h1><p>학생과 나눈 실제 상담 내용과 후속 행동을 기록합니다.</p></div>{user.role === "teacher" && <button className="primary-button" onClick={onNew}><Plus size={17} />상담 기록 추가</button>}</div><section className="card table-card"><div className="table-head"><span>일자</span><span>학생</span><span>상담 주제</span><span>상담 내용</span><span /></div>{records.map(row => <button className="table-row" key={row.id} onClick={() => onSelect(row)}><span>{row.date}</span><span>{row.studentName}</span><strong>{row.topic}</strong><span>{row.summary}</span><ChevronRight /></button>)}{!records.length && <Empty text="아직 상담 기록이 없습니다." />}</section></>;
}

function Attachments({ files }: { files: Attachment[] }) {
  if (!files.length) return null;
  const images = files.filter(file => file.contentType.startsWith("image/"));
  const documents = files.filter(file => !file.contentType.startsWith("image/"));
  return <div className="attachment-area">
    {images.length > 0 && <div className="image-thumbnails">{images.map(file => <a href={`/api/attachments/${file.id}`} target="_blank" rel="noreferrer" key={file.id} aria-label={`${file.fileName} 원본 보기`} title={file.fileName}><Image src={`/api/attachments/${file.id}`} alt={file.fileName} width={188} height={141} loading="lazy" unoptimized /></a>)}</div>}
    {documents.length > 0 && <div className="attachment-list">{documents.map(file => <a href={`/api/attachments/${file.id}`} target="_blank" rel="noreferrer" key={file.id}><Paperclip /><span>{file.fileName}<small>{fileSize(file.size)}</small></span></a>)}</div>}
  </div>;
}

function RecordDetail({ record, onBack }: { record: Consultation; onBack: () => void }) {
  return <article className="record-detail"><button className="back-button" onClick={onBack}>← 상담 기록</button><div className="detail-title"><span className="page-icon"><ClipboardList /></span><div><span>{formatDate(record.date)} · {record.studentName}</span><h1>{record.topic}</h1></div></div><section><h2>상담 내용</h2><p className="summary-text">{record.summary}</p><Attachments files={record.attachments} /></section></article>;
}

function StudentsPage({ data }: { data: DashboardData }) {
  return <><div className="section-heading"><div><span className="eyebrow">STUDENT MANAGEMENT</span><h1>학생 관리</h1><p>가입을 완료한 우리 반 학생을 확인합니다.</p></div></div><div className="student-grid">{data.students.map(student => <article className="student-card" key={student.id}><span className="student-avatar">{student.studentNumber ?? "-"}</span><div><h3>{student.name}</h3><p>{student.studentNumber ?? "-"}번</p><small>@{student.username}</small></div></article>)}</div>{!data.students.length && <Empty text="아직 등록된 학생이 없습니다." />}</>;
}

function InterestsPage({ user, students, interests, onNew, onEdit, onPriorityChange }: { user: User; students: User[]; interests: InterestUniversity[]; onNew: () => void; onEdit: (interest: InterestUniversity) => void; onPriorityChange: (id: string, priority: number) => Promise<void> }) {
  const [studentId, setStudentId] = useState("all");
  const [updating, setUpdating] = useState("");
  const [priorityError, setPriorityError] = useState("");
  const visible = studentId === "all" ? interests : interests.filter(item => item.studentId === studentId);
  const selectedStudent = students.find(student => student.id === studentId);
  return <>
    <div className="section-heading"><div><span className="eyebrow">UNIVERSITY RESEARCH</span><h1>관심 대학</h1><p>{user.role === "teacher" ? "학생별로 찾아본 대학·학과·전형을 확인합니다." : "찾아본 대학·학과·전형과 수능 최저 조건을 정리합니다."}</p></div><button className="primary-button" onClick={onNew}><Plus size={17} />관심 대학 추가</button></div>
    {user.role === "teacher" && <div className="student-filter" aria-label="학생별 관심 대학"><button className={studentId === "all" ? "active" : ""} onClick={() => setStudentId("all")}><span>전체 학생</span><small>{interests.length}</small></button>{students.map(student => { const count = interests.filter(item => item.studentId === student.id).length; return <button className={studentId === student.id ? "active" : ""} key={student.id} onClick={() => setStudentId(student.id)}><span>{student.studentNumber ?? "-"}번 {student.name}</span><small>{count}</small></button>; })}</div>}
    {priorityError && <p className="form-error priority-error">{priorityError}</p>}
    {selectedStudent && <div className="interest-owner"><span className="student-avatar">{selectedStudent.studentNumber ?? "-"}</span><div><strong>{selectedStudent.name} 학생의 관심 대학</strong><small>@{selectedStudent.username} · {visible.length}개 기록</small></div></div>}
    <div className="interest-grid">{visible.map(item => {
      const total = interests.filter(row => row.studentId === item.studentId).length;
      return <article className="interest-card" key={item.id}><header><div className="interest-card-actions"><label className="priority-control"><select value={item.priority < 999 ? item.priority : 999} disabled={updating === item.id} onChange={async event => { setUpdating(item.id); setPriorityError(""); try { await onPriorityChange(item.id, Number(event.target.value)); } catch (reason) { setPriorityError(reason instanceof Error ? reason.message : "순위를 변경하지 못했습니다."); } finally { setUpdating(""); } }} aria-label={`${item.university} 지망 순위`}>{Array.from({ length: total }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}지망</option>)}<option value="999">순위 미정</option></select></label>{user.role === "teacher" && <button type="button" className="interest-edit-button" onClick={() => onEdit(item)} aria-label={`${item.university} 관심 대학 수정`}><Pencil /></button>}</div><span className="page-icon"><GraduationCap /></span><div><span>{user.role === "teacher" && studentId === "all" ? item.studentName : item.track}</span><h2>{item.university}</h2><p>{item.department}</p></div></header><dl><div><dt>전형 종류</dt><dd>{item.track}</dd></div><div><dt>전형 이름</dt><dd>{item.admissionName || "-"}</dd></div><div><dt>학교장 추천</dt><dd>{item.schoolRecommendation ? "필요" : "해당 없음"}</dd></div><div><dt>평가 요소</dt><dd>{item.evaluationFactors || "-"}</dd></div><div><dt>수능 최저</dt><dd>{item.minimum || "없음"}</dd></div><div><dt>내신 등급</dt><dd>{item.schoolGrade || "-"}</dd></div><div><dt>2023 입결</dt><dd>{item.cutoff2023 || "-"}</dd></div><div><dt>2024 입결</dt><dd>{item.cutoff2024 || "-"}</dd></div><div><dt>2025 입결</dt><dd>{item.cutoff2025 || "-"}</dd></div><div><dt>메모</dt><dd>{item.memo || "-"}</dd></div></dl></article>;
    })}</div>
    {!visible.length && <Empty text={selectedStudent ? `${selectedStudent.name} 학생의 관심 대학이 아직 없습니다.` : "아직 관심 대학이 없습니다."} />}
  </>;
}

function AppointmentsPage({ user, appointments, notices, onNew, onReserve, onApprove, onApproveCancel, onRejectCancel, onCancel, onDelete, onNewNotice, onEditNotice, onDeleteNotice }: { user: User; appointments: AppointmentSlot[]; notices: Announcement[]; onNew: (date: string) => void; onReserve: (id: string) => Promise<void>; onApprove: (id: string) => Promise<void>; onApproveCancel: (id: string) => Promise<void>; onRejectCancel: (id: string) => Promise<void>; onCancel: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onNewNotice: () => void; onEditNotice: (notice: Announcement) => void; onDeleteNotice: (notice: Announcement) => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const teacher = user.role === "teacher";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const upcoming = appointments.filter(slot => slot.date >= today);
  const initialDate = upcoming.find(slot => teacher || slot.status === "available" || slot.isMine)?.date ?? today;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [month, setMonth] = useState(initialDate.slice(0, 7));
  const [year, monthNumber] = month.split("-").map(Number);
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? `${month}-${String(day).padStart(2, "0")}` : null;
  });
  const selectedSlots = upcoming.filter(slot => slot.date === selectedDate);
  const moveMonth = (amount: number) => {
    const next = new Date(year, monthNumber - 1 + amount, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    const firstSlot = upcoming.find(slot => slot.date.startsWith(nextMonth));
    setMonth(nextMonth); setSelectedDate(firstSlot?.date ?? `${nextMonth}-01`);
  };
  const run = async (id: string, action: () => Promise<void>) => { setBusy(id); setError(""); try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : "요청을 처리하지 못했습니다."); } finally { setBusy(""); } };
  const cancel = (slot: AppointmentSlot, label = "예약") => { const message = !teacher && slot.bookingStatus === "confirmed" ? `${formatDate(slot.date)} ${slot.time} 예약 취소를 요청할까요?\n교사가 승인하면 취소가 확정됩니다.` : `${formatDate(slot.date)} ${slot.time} ${label}을 취소할까요?`; if (window.confirm(message)) run(slot.id, () => onCancel(slot.id)); };
  const remove = (slot: AppointmentSlot) => { if (window.confirm(`${formatDate(slot.date)} ${slot.time} 상담 시간을 삭제할까요?${slot.status === "reserved" ? "\n예약도 함께 취소됩니다." : ""}`)) run(slot.id, () => onDelete(slot.id)); };
  const deleteNotice = (notice: Announcement) => { if (window.confirm(`상담 공지 '${notice.title}'을 삭제할까요?`)) run(`notice-${notice.id}`, () => onDeleteNotice(notice)); };
  return <><div className="section-heading"><div><span className="eyebrow">COUNSELING APPOINTMENT</span><h1>{teacher ? "상담 일정 관리" : "상담 신청"}</h1><p>{teacher ? "학생의 상담 신청과 취소 요청을 승인하고 일정을 관리합니다." : "원하는 시간을 신청하면 교사 승인 후 예약이 확정됩니다."}</p></div>{teacher && <button className="primary-button" onClick={() => onNew(selectedDate < today ? today : selectedDate)}><Plus size={17} />선택 날짜에 일정 추가</button>}</div><section className="appointment-notices"><header><div><Megaphone /><span><strong>상담 공지</strong><small>상담 신청 전에 확인해 주세요.</small></span></div>{teacher && <button type="button" onClick={onNewNotice}><Plus />공지 등록</button>}</header>{notices.length ? <div className="appointment-notice-list">{notices.map(notice => <article key={notice.id}><div><strong>{notice.title}</strong><p>{notice.body}</p></div>{teacher && <span className="appointment-notice-actions"><button type="button" onClick={() => onEditNotice(notice)} aria-label="상담 공지 수정"><Pencil /></button><button type="button" onClick={() => deleteNotice(notice)} disabled={busy === `notice-${notice.id}`} aria-label="상담 공지 삭제"><Trash2 /></button></span>}</article>)}</div> : <p className="appointment-notice-empty">등록된 상담 공지가 없습니다.</p>}</section>{error && <p className="form-error appointment-error">{error}</p>}<div className="appointment-calendar-layout"><section className="calendar-card"><header className="calendar-toolbar"><button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft /></button><h2>{year}년 {monthNumber}월</h2><button type="button" onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight /></button></header><div className="calendar-weekdays">{["일", "월", "화", "수", "목", "금", "토"].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{calendarDays.map((date, index) => {
    if (!date) return <span className="calendar-empty" key={`empty-${index}`} />;
    const slots = upcoming.filter(slot => slot.date === date);
    const availableCount = slots.filter(slot => slot.status === "available").length;
    const pendingCount = slots.filter(slot => slot.bookingStatus === "pending" || slot.bookingStatus === "cancel_pending").length;
    const disabled = date < today || (!teacher && slots.length === 0);
    return <button type="button" className={`calendar-day ${date === selectedDate ? "selected" : ""} ${date === today ? "today" : ""}`} disabled={disabled} aria-pressed={date === selectedDate} onClick={() => setSelectedDate(date)} key={date}><span>{Number(date.slice(8))}</span><div className="calendar-dots">{slots.slice(0, 3).map(slot => <i className={slot.isMine ? slot.bookingStatus : slot.status} key={slot.id} />)}</div>{slots.length > 0 && <small>{teacher && pendingCount ? `승인 대기 ${pendingCount}` : teacher ? `${slots.length}개` : availableCount ? `가능 ${availableCount}` : "예약됨"}</small>}</button>;
  })}</div><footer className="calendar-legend"><span><i className="available" />신청 가능</span><span><i className="reserved" />예약됨</span>{teacher && <span><i className="pending" />처리 대기</span>}{!teacher && <><span><i className="pending" />승인 대기</span><span><i className="confirmed" />예약 확정</span></>}</footer></section><section className="day-schedule"><header><div><span>선택한 날짜</span><h2>{formatDate(selectedDate)}</h2></div>{teacher && <button type="button" onClick={() => onNew(selectedDate < today ? today : selectedDate)}><Plus />일정 추가</button>}</header><div className="time-slot-list">{selectedSlots.map(slot => <article className={`time-slot-row ${slot.isMine ? "mine" : ""} ${slot.bookingStatus}`} key={slot.id}><strong>{slot.time}</strong>{teacher ? <div className="time-slot-copy">{slot.bookingStatus === "pending" ? <><span className="status-pill pending">예약 승인 대기</span><small>{slot.studentNumber ?? "-"}번 · {slot.studentName}</small></> : slot.bookingStatus === "cancel_pending" ? <><span className="status-pill cancel_pending">취소 승인 대기</span><small>{slot.studentNumber ?? "-"}번 · {slot.studentName}</small></> : slot.bookingStatus === "confirmed" ? <><span className="status-pill confirmed">예약 확정</span><small>{slot.studentNumber ?? "-"}번 · {slot.studentName}</small></> : <span className="status-pill available">신청 가능</span>}</div> : <div className="time-slot-copy">{slot.isMine ? <span className={`status-pill ${slot.bookingStatus}`}>{slot.bookingStatus === "pending" ? "예약 승인 대기" : slot.bookingStatus === "cancel_pending" ? "취소 승인 대기" : "예약 확정"}</span> : slot.status === "reserved" ? <span className="status-pill reserved">예약됨</span> : <span className="status-pill available">신청 가능</span>}</div>}<div className="appointment-actions">{teacher ? <>{slot.bookingStatus === "pending" && <><button type="button" className="reserve-button" disabled={busy === slot.id} onClick={() => run(slot.id, () => onApprove(slot.id))}>승인</button><button type="button" disabled={busy === slot.id} onClick={() => cancel(slot, "신청")}>거절</button></>}{slot.bookingStatus === "cancel_pending" && <><button type="button" className="reserve-button" disabled={busy === slot.id} onClick={() => run(slot.id, () => onApproveCancel(slot.id))}>취소 승인</button><button type="button" disabled={busy === slot.id} onClick={() => run(slot.id, () => onRejectCancel(slot.id))}>취소 거절</button></>}{slot.bookingStatus === "confirmed" && <button type="button" disabled={busy === slot.id} onClick={() => cancel(slot)}>예약 취소</button>}<button type="button" className="danger" disabled={busy === slot.id} onClick={() => remove(slot)}><Trash2 />삭제</button></> : slot.isMine ? slot.bookingStatus === "cancel_pending" ? <button type="button" disabled>취소 승인 대기</button> : <button type="button" disabled={busy === slot.id} onClick={() => cancel(slot, slot.bookingStatus === "pending" ? "신청" : "예약 취소 요청")}>{slot.bookingStatus === "confirmed" ? "취소 요청" : "취소"}</button> : slot.status === "available" ? <button type="button" className="reserve-button" disabled={busy === slot.id} onClick={() => run(slot.id, () => onReserve(slot.id))}>{busy === slot.id ? "신청 중…" : "신청"}</button> : <button type="button" disabled>예약됨</button>}</div></article>)}{!selectedSlots.length && <div className="calendar-no-slots"><CalendarClock /><strong>{teacher ? "이 날짜에 등록된 일정이 없습니다." : "신청 가능한 일정이 없습니다."}</strong>{teacher && <button type="button" onClick={() => onNew(selectedDate < today ? today : selectedDate)}>상담 일정 추가</button>}</div>}</div></section></div></>;
}

type NotificationSettings = { notificationsEnabled: boolean; discordConfigured: boolean; maskedWebhook: string; registrationOpen: boolean };

function SettingsPage({ onRegistrationChanged }: { onRegistrationChanged: () => void }) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [webhook, setWebhook] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "clear" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const load = async () => { const next = await api<NotificationSettings>("/api/settings"); setSettings(next); setEnabled(next.notificationsEnabled); };
  useEffect(() => { let active = true; api<NotificationSettings>("/api/settings").then(next => { if (active) { setSettings(next); setEnabled(next.notificationsEnabled); } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "설정을 불러오지 못했습니다."); }); return () => { active = false; }; }, []);
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy("save"); setError(""); setMessage(""); try { await api("/api/settings", { method: "PATCH", body: JSON.stringify({ notificationsEnabled: enabled, webhookUrl: webhook.trim() || undefined }) }); setWebhook(""); await load(); setMessage("알림 설정을 저장했습니다."); } catch (reason) { setError(reason instanceof Error ? reason.message : "설정을 저장하지 못했습니다."); } finally { setBusy(""); } };
  const test = async () => { setBusy("test"); setError(""); setMessage(""); try { await api("/api/settings", { method: "POST", body: JSON.stringify({ action: "test" }) }); setMessage("디스코드로 테스트 알림을 보냈습니다."); } catch (reason) { setError(reason instanceof Error ? reason.message : "테스트 알림을 보내지 못했습니다."); } finally { setBusy(""); } };
  const clear = async () => { if (!window.confirm("저장된 디스코드 연결을 삭제할까요?")) return; setBusy("clear"); setError(""); setMessage(""); try { await api("/api/settings", { method: "PATCH", body: JSON.stringify({ notificationsEnabled: false, clearWebhook: true }) }); setWebhook(""); await load(); setMessage("디스코드 연결을 삭제했습니다."); } catch (reason) { setError(reason instanceof Error ? reason.message : "연결을 삭제하지 못했습니다."); } finally { setBusy(""); } };
  const toggleRegistration = async () => {
    if (!settings) return;
    const nextOpen = !settings.registrationOpen;
    setRegistrationBusy(true); setRegistrationMessage("");
    try {
      const next = await api<NotificationSettings>("/api/settings", { method: "PATCH", body: JSON.stringify({ action: "registration", registrationOpen: nextOpen }) });
      setSettings(next); onRegistrationChanged(); setRegistrationMessage(nextOpen ? "학생 가입을 열었습니다. 이제 학생이 가입하면 바로 사용할 수 있습니다." : "학생 가입을 닫았습니다. 기존 학생은 계속 로그인할 수 있습니다.");
    } catch (reason) { setRegistrationMessage(reason instanceof Error ? reason.message : "학생 가입 설정을 변경하지 못했습니다."); }
    finally { setRegistrationBusy(false); }
  };
  return <><div className="section-heading"><div><span className="eyebrow">SETTINGS</span><h1>설정</h1><p>학생 가입과 상담 신청 알림을 관리합니다.</p></div></div><div className="settings-layout"><div className="settings-stack"><section className="settings-card registration-settings"><header><span className="settings-icon"><Users /></span><div><h2>학생 가입</h2><p>개별 승인 없이 가입 가능한 기간을 직접 열고 닫습니다.</p></div><span className={`registration-status ${settings?.registrationOpen ? "open" : "closed"}`}>{settings?.registrationOpen ? "가입 열림" : "가입 닫힘"}</span></header><div className="registration-settings-body"><p>{settings?.registrationOpen ? "학생이 계정을 만들면 우리 반에 바로 등록되고 즉시 로그인할 수 있습니다." : "새 학생은 계정을 만들 수 없으며, 이미 가입한 학생은 계속 이용할 수 있습니다."}</p><button type="button" className={settings?.registrationOpen ? "secondary-button" : "primary-button"} onClick={toggleRegistration} disabled={!settings || registrationBusy}>{registrationBusy ? "변경 중…" : settings?.registrationOpen ? "학생 가입 닫기" : "학생 가입 열기"}</button>{registrationMessage && <small>{registrationMessage}</small>}</div></section><section className="settings-card"><header><span className="settings-icon"><MessageCircle /></span><div><h2>상담 신청 알림</h2><p>학생이 상담을 신청하면 디스코드 채널로 바로 알려드립니다.</p></div><label className="settings-switch"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={!settings} /><span /></label></header><form className="settings-form" onSubmit={save}><label>디스코드 웹훅 URL<input type="url" value={webhook} onChange={event => setWebhook(event.target.value)} placeholder={settings?.discordConfigured ? "새 URL을 입력하면 기존 연결이 변경됩니다" : "https://discord.com/api/webhooks/..."} autoComplete="off" /></label>{settings?.discordConfigured && <div className="connection-status"><Check /><span><strong>디스코드 연결됨</strong><small>{settings.maskedWebhook}</small></span></div>}<div className="settings-help"><strong>웹훅 주소는 어디서 만드나요?</strong><span>디스코드 채널 설정 → 연동 → 웹후크 → 새 웹후크 → URL 복사</span></div>{error && <p className="form-error">{error}</p>}{message && <p className="settings-success"><Check />{message}</p>}<div className="settings-actions"><button className="primary-button" disabled={Boolean(busy) || (enabled && !settings?.discordConfigured && !webhook.trim())}>{busy === "save" ? "저장 중…" : "설정 저장"}</button><button type="button" className="secondary-button" onClick={test} disabled={Boolean(busy) || !settings?.discordConfigured}>{busy === "test" ? "전송 중…" : <><Send />테스트 알림</>}</button>{settings?.discordConfigured && <button type="button" className="text-danger" onClick={clear} disabled={Boolean(busy)}>{busy === "clear" ? "삭제 중…" : "연결 삭제"}</button>}</div></form></section></div><aside className="settings-note"><ShieldCheck /><div><strong>안전하게 보관됩니다</strong><p>웹훅 주소는 교사만 등록할 수 있으며 학생 화면이나 설정 조회 결과에 원문으로 노출되지 않습니다.</p></div></aside></div></>;
}

function AnnouncementsPage({ user, announcements, onNew, onEdit, onDelete }: { user: User; announcements: Announcement[]; onNew: () => void; onEdit: (notice: Announcement) => void; onDelete: (notice: Announcement) => Promise<void> }) {
  const [deleting, setDeleting] = useState("");
  const [error, setError] = useState("");
  const remove = async (notice: Announcement) => {
    if (!window.confirm(`「${notice.title}」 공지를 삭제할까요?\n첨부 파일도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    setDeleting(notice.id); setError("");
    try { await onDelete(notice); } catch (reason) { setError(reason instanceof Error ? reason.message : "공지를 삭제하지 못했습니다."); } finally { setDeleting(""); }
  };
  return <><div className="section-heading"><div><span className="eyebrow">NOTICE & GUIDE</span><h1>공지 · 입시 정보</h1><p>모든 학생에게 필요한 정보와 자료를 공유합니다.</p></div>{user.role === "teacher" && <button className="primary-button" onClick={onNew}><Plus size={17} />새 글</button>}</div>{error && <p className="form-error notice-error">{error}</p>}<div className="announcement-grid">{announcements.map(item => { const manageable = user.role === "teacher" && item.authorId === user.id; return <article className={`announcement-card ${item.isPinned ? "pinned" : ""}`} key={item.id}>{item.isPinned && <span className="pin-label">중요</span>}<div className="announcement-meta"><span className="tag">{item.category}</span><span>{item.authorName} · {formatDate(item.publishedAt)}</span></div><h2>{item.title}</h2><p>{item.body}</p><Attachments files={item.attachments} />{manageable && <div className="announcement-actions"><button type="button" onClick={() => onEdit(item)}><Pencil />수정</button><button type="button" className="danger" disabled={deleting === item.id} onClick={() => remove(item)}><Trash2 />{deleting === item.id ? "삭제 중…" : "삭제"}</button></div>}</article>; })}</div>{!announcements.length && <Empty text="등록된 공지가 없습니다." />}</>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-scrim"><section className="modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X /></button></header>{children}</section></div>; }

async function uploadFiles(ownerType: string, ownerId: string, files: File[]) {
  if (!files.length) return;
  const form = new FormData(); form.set("ownerType", ownerType); form.set("ownerId", ownerId);
  files.forEach(file => form.append("files", file));
  await api("/api/attachments", { method: "POST", body: form });
}

function FileField() { return <label className="file-field"><Upload /><span><strong>파일 또는 이미지 첨부</strong><small>최대 10개, 파일당 10MB</small></span><input name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp" /></label>; }

function filesFrom(form: FormData) {
  return form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
}

function RecordModal({ students, onClose, onSaved }: { students: User[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setError(""); try { const form = new FormData(event.currentTarget); const files = filesFrom(form); const result = await api<{ id: string }>("/api/consultations", { method: "POST", body: JSON.stringify({ studentId: form.get("studentId"), date: form.get("date"), topic: form.get("topic"), summary: form.get("summary") }) }); await uploadFiles("consultation", result.id, files); onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "저장하지 못했습니다."); setSaving(false); } };
  return <Modal title="새 상담 기록" onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="field-row"><label>학생<select name="studentId" required defaultValue=""><option value="" disabled>학생 선택</option>{students.map(s => <option key={s.id} value={s.id}>{s.studentNumber}번 · {s.name}</option>)}</select></label><label>상담 일자<input name="date" type="date" required defaultValue={new Intl.DateTimeFormat("en-CA").format(new Date())} /></label></div><label>상담 주제<input name="topic" required placeholder="예: 7월 진로 상담" /></label><label>상담 내용<textarea name="summary" required rows={8} placeholder="학생과 나눈 이야기, 확인한 내용, 다음 상담 전까지 할 일을 자유롭게 기록하세요." /></label><FileField />{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={saving || !students.length}>{saving ? "저장 중…" : "기록 저장"}</button></div></form></Modal>;
}

function InterestModal({ user, students, interest, onClose, onSaved }: { user: User; students: User[]; interest: InterestUniversity | null; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const editing = Boolean(interest);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = { studentId: form.get("studentId"), university: form.get("university"), department: form.get("department"), track: form.get("track"), admissionName: form.get("admissionName"), schoolRecommendation: form.get("schoolRecommendation") === "yes", evaluationFactors: form.get("evaluationFactors"), minimum: form.get("minimum"), schoolGrade: form.get("schoolGrade"), cutoff2023: form.get("cutoff2023"), cutoff2024: form.get("cutoff2024"), cutoff2025: form.get("cutoff2025"), priority: form.get("priority"), memo: form.get("memo") };
    try { await api(interest ? `/api/interests/${interest.id}` : "/api/interests", { method: interest ? "PATCH" : "POST", body: JSON.stringify(payload) }); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "저장하지 못했습니다."); setSaving(false); }
  };
  return <Modal title={editing ? "관심 대학 수정" : "관심 대학 추가"} onClose={onClose}><form className="modal-form" onSubmit={submit}>
    {user.role === "teacher" && (interest ? <div className="selected-interest-student"><span>학생</span><strong>{interest.studentName}</strong></div> : <label>학생<select name="studentId" required defaultValue=""><option value="" disabled>학생 선택</option>{students.map(student => <option key={student.id} value={student.id}>{student.studentNumber}번 · {student.name}</option>)}</select></label>)}
    <div className="field-row"><label>대학<input name="university" required defaultValue={interest?.university ?? ""} placeholder="대학명" /></label><label>학과<input name="department" required defaultValue={interest?.department ?? ""} placeholder="학과·계열" /></label></div>
    <div className="field-row"><label>전형 종류<select name="track" required defaultValue={interest?.track ?? ""}><option value="" disabled>전형 선택</option><option>학생부 종합 전형</option><option>학생부 교과 전형</option><option>논술 전형</option><option>실기(특기자) 전형</option><option>기타 전형</option></select></label><label>전형 이름<input name="admissionName" required defaultValue={interest?.admissionName ?? ""} placeholder="예: 학생부종합 일반전형" /></label></div>
    <div className="field-row"><label>학교장 추천 여부<select name="schoolRecommendation" defaultValue={interest?.schoolRecommendation ? "yes" : "no"}><option value="no">추천 불필요</option><option value="yes">추천 필요</option></select></label><label>지망 순위<input name="priority" type="number" min="1" max="99" required defaultValue={interest && interest.priority < 999 ? interest.priority : 1} placeholder="1" /></label></div>
    <label><span className="field-label">평가 요소<span className="help-wrap"><button type="button" className="help-button" aria-label="평가 요소 작성 예시">?</button><span className="help-popover" role="tooltip"><strong>작성 예시</strong><span>생기부 50 + 교과 50</span><span>교과 100</span></span></span></span><input name="evaluationFactors" defaultValue={interest?.evaluationFactors ?? ""} placeholder="예: 생기부 50 + 교과 50" /></label>
    <div className="field-row"><label>수능 최저<input name="minimum" defaultValue={interest?.minimum ?? ""} placeholder="예: 2개 합 5 / 없음" /></label><label>내신 등급<input name="schoolGrade" defaultValue={interest?.schoolGrade ?? ""} placeholder="예: 2.3등급" /></label></div>
    <div className="cutoff-grid"><label>2023년 입결<input name="cutoff2023" defaultValue={interest?.cutoff2023 ?? ""} placeholder="등급·점수" /></label><label>2024년 입결<input name="cutoff2024" defaultValue={interest?.cutoff2024 ?? ""} placeholder="등급·점수" /></label><label>2025년 입결<input name="cutoff2025" defaultValue={interest?.cutoff2025 ?? ""} placeholder="등급·점수" /></label></div>
    <label>기타 메모<textarea name="memo" rows={4} defaultValue={interest?.memo ?? ""} placeholder="모집 인원, 전년도 결과, 확인할 내용 등을 기록하세요." /></label>
    {error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={saving || (!editing && user.role === "teacher" && !students.length)}>{saving ? "저장 중…" : editing ? "수정 내용 저장" : "관심 대학 저장"}</button></div>
  </form></Modal>;
}

function AppointmentModal({ initialDate, appointments, onClose, onSaved }: { initialDate: string; appointments: AppointmentSlot[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [slotMode, setSlotMode] = useState<"time" | "period">("time");
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const [date, setDate] = useState(initialDate && initialDate >= today ? initialDate : today);
  const existingLabels = new Set(appointments.filter(slot => slot.date === date).map(slot => slot.time));
  const timeOptions = Array.from({ length: 26 }, (_, index) => `${String(8 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`);
  const toggleTime = (time: string) => setSelectedTimes(current => current.includes(time) ? current.filter(value => value !== time) : [...current, time].sort());
  const togglePeriod = (period: number) => setSelectedPeriods(current => current.includes(period) ? current.filter(value => value !== period) : [...current, period].sort((a, b) => a - b));
  const selectedCount = slotMode === "time" ? selectedTimes.length : selectedPeriods.length;
  const selectedLabels = slotMode === "time" ? selectedTimes : selectedPeriods.map(period => `${period}교시`);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!selectedCount) { setError(`추가할 ${slotMode === "time" ? "시간" : "교시"}를 하나 이상 선택해 주세요.`); return; } setSaving(true); setError(""); const form = new FormData(event.currentTarget); try { await api("/api/appointments", { method: "POST", body: JSON.stringify({ date: form.get("date"), ...(slotMode === "time" ? { times: selectedTimes } : { periods: selectedPeriods }) }) }); onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "상담 일정을 추가하지 못했습니다."); setSaving(false); } };
  return <Modal title="상담 가능 일정 추가" onClose={onClose}><form className="modal-form appointment-time-form" onSubmit={submit}><label>상담 일자<input name="date" type="date" min={today} required value={date} onChange={event => { setDate(event.target.value); setSelectedTimes([]); setSelectedPeriods([]); setError(""); }} /></label><div className="slot-mode-tabs" role="tablist" aria-label="일정 등록 방식"><button type="button" role="tab" aria-selected={slotMode === "time"} className={slotMode === "time" ? "active" : ""} onClick={() => { setSlotMode("time"); setError(""); }}>시간으로 등록</button><button type="button" role="tab" aria-selected={slotMode === "period"} className={slotMode === "period" ? "active" : ""} onClick={() => { setSlotMode("period"); setError(""); }}>교시로 등록</button></div><fieldset className="time-picker-field"><legend><span>{slotMode === "time" ? "시간 선택" : "교시 선택"}</span><small>회색으로 표시된 일정은 이미 등록되어 있어요</small></legend>{slotMode === "time" ? <div className="time-picker-grid">{timeOptions.map(time => { const selected = selectedTimes.includes(time); const registered = existingLabels.has(time); return <button key={time} type="button" className={selected ? "selected" : ""} aria-pressed={selected} disabled={registered} onClick={() => toggleTime(time)}><span>{registered ? "등록됨" : Number(time.slice(0, 2)) < 12 ? "오전" : "오후"}</span><strong>{time}</strong>{selected && <Check />}</button>; })}</div> : <div className="period-picker-grid">{Array.from({ length: 10 }, (_, index) => index + 1).map(period => { const selected = selectedPeriods.includes(period); const registered = existingLabels.has(`${period}교시`); return <button key={period} type="button" className={selected ? "selected" : ""} aria-pressed={selected} disabled={registered} onClick={() => togglePeriod(period)}><strong>{period}교시</strong>{registered ? <small>등록됨</small> : selected && <Check />}</button>; })}</div>}</fieldset><div className="selected-time-summary"><CalendarClock /><div><strong>{selectedCount ? `${selectedCount}개 ${slotMode === "time" ? "시간" : "교시"} 선택됨` : `${slotMode === "time" ? "시간" : "교시"}를 선택해 주세요`}</strong><span>{selectedCount ? selectedLabels.join(" · ") : "버튼을 다시 누르면 선택이 해제됩니다."}</span></div></div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={saving || !selectedCount}>{saving ? "추가 중…" : selectedCount ? `${selectedCount}개 일정 추가` : `${slotMode === "time" ? "시간" : "교시"} 선택`}</button></div></form></Modal>;
}

function NoticeModal({ notice, defaultCategory, onClose, onSaved }: { notice: Announcement | null; defaultCategory: string; onClose: () => void; onSaved: (attachmentFailed?: boolean) => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setError(""); try { const form = new FormData(event.currentTarget); const files = filesFrom(form); const payload = JSON.stringify({ title: form.get("title"), body: form.get("body"), category: form.get("category"), isPinned: form.get("isPinned") === "on" }); const result = notice ? await api<{ id: string }>(`/api/announcements/${notice.id}`, { method: "PATCH", body: payload }) : await api<{ id: string }>("/api/announcements", { method: "POST", body: payload }); try { await uploadFiles("announcement", result.id, files); onSaved(); } catch { onSaved(true); } } catch (reason) { setError(reason instanceof Error ? reason.message : notice ? "수정하지 못했습니다." : "게시하지 못했습니다."); setSaving(false); } };
  return <Modal title={notice ? "공지 수정" : "새 공지 작성"} onClose={onClose}><form className="modal-form" onSubmit={submit}><label>분류<select name="category" defaultValue={notice?.category ?? defaultCategory}><option>입시 일정</option><option>자료</option><option>상담</option><option>기타</option></select></label><label>제목<input name="title" required defaultValue={notice?.title ?? ""} /></label><label>내용<textarea name="body" rows={7} required defaultValue={notice?.body ?? ""} /></label><label className="toggle-label"><input name="isPinned" type="checkbox" defaultChecked={notice?.isPinned ?? false} />중요 공지로 표시</label>{notice && notice.attachments.length > 0 && <div className="existing-attachments"><span>현재 첨부 파일</span><Attachments files={notice.attachments} /></div>}<FileField />{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={saving}>{saving ? notice ? "수정 중…" : "게시 중…" : notice ? "수정 저장" : "공지 게시"}</button></div></form></Modal>;
}
