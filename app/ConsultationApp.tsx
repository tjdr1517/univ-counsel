"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, Check, ChevronRight, ClipboardList, FileText, GraduationCap, Home, LogOut, Menu, Megaphone, Paperclip, Plus, Search, ShieldCheck, Upload, Users, X } from "lucide-react";
import type { Announcement, Attachment, Consultation, DashboardData, InterestUniversity, Role, User } from "../lib/types";

type View = "home" | "records" | "interests" | "students" | "announcements";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function ConsultationApp() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>("home");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [recordModal, setRecordModal] = useState(false);
  const [interestModal, setInterestModal] = useState(false);
  const [noticeModal, setNoticeModal] = useState(false);
  const [toast, setToast] = useState("");

  const refresh = async () => {
    const next = await api<DashboardData>("/api/dashboard");
    setData(next); setUser(next.user);
  };

  useEffect(() => {
    api<{ user: User }>("/api/auth/me").then(({ user }) => {
      setUser(user);
      if (user.status === "approved") return refresh();
    }).catch(() => setUser(null)).finally(() => setChecking(false));
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
    return keyword ? rows.filter(row => `${row.studentName} ${row.university} ${row.department} ${row.track} ${row.minimum} ${row.memo}`.toLowerCase().includes(keyword)) : rows;
  }, [data, search]);

  if (checking) return <div className="center-state"><div className="spinner" /><p>계정을 확인하고 있습니다.</p></div>;
  if (!user) return <AuthScreen onAuthenticated={next => { setUser(next); if (next.status === "approved") refresh().catch(() => undefined); }} />;
  if (user.status !== "approved") return <ApprovalWaiting user={user} onLogout={async () => { await api("/api/auth/logout", { method: "POST" }); setUser(null); }} />;
  if (!data) return <div className="center-state"><div className="spinner" /><p>상담 기록을 불러오고 있습니다.</p></div>;

  const navigate = (next: View) => { setView(next); setMenu(false); setSelected(null); };
  const logout = async () => { await api("/api/auth/logout", { method: "POST" }); setUser(null); setData(null); };
  const notify = (message: string) => { setToast(message); refresh().catch(() => undefined); };

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <div className="sidebar-top"><button className="brand" onClick={() => navigate("home")}><span className="brand-mark">담</span><span>담다</span></button><button className="icon-button mobile-only" onClick={() => setMenu(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
      <div className="profile-chip"><span className="avatar">{user.name.slice(0, 1)}</span><div><strong>{user.name}</strong><small>{user.role === "teacher" ? "진로진학 교사" : `${user.studentNumber ?? "-"}번 학생`}</small></div></div>
      <nav className="nav-list">
        <Nav active={view === "home"} icon={<Home />} label="홈" onClick={() => navigate("home")} />
        <Nav active={view === "records"} icon={<ClipboardList />} label="상담 기록" badge={records.length} onClick={() => navigate("records")} />
        <Nav active={view === "interests"} icon={<GraduationCap />} label="관심 대학" badge={interests.length} onClick={() => navigate("interests")} />
        {user.role === "teacher" && <Nav active={view === "students"} icon={<Users />} label="학생 관리" badge={data.pendingStudents.length || data.students.length} onClick={() => navigate("students")} />}
        <Nav active={view === "announcements"} icon={<Megaphone />} label="공지 · 정보" onClick={() => navigate("announcements")} />
      </nav>
      <div className="sidebar-footer"><button onClick={logout}><LogOut size={17} />로그아웃</button></div>
    </aside>
    {menu && <button className="nav-scrim" onClick={() => setMenu(false)} aria-label="메뉴 닫기" />}
    <main className="main-panel">
      <header className="topbar"><button className="icon-button mobile-only" onClick={() => setMenu(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="학생, 학교, 상담 내용 검색" /></div><div className="topbar-actions"><Bell size={18} /><span className="top-avatar">{user.name.slice(0, 1)}</span></div></header>
      <div className="page-wrap">
        {view === "home" && <HomePage user={user} data={data} records={records} onView={navigate} onNew={() => setRecordModal(true)} onSelect={record => { setSelected(record); setView("records"); }} />}
        {view === "records" && <RecordsPage user={user} records={records} selected={selected} onSelect={setSelected} onBack={() => setSelected(null)} onNew={() => setRecordModal(true)} />}
        {view === "interests" && <InterestsPage user={user} students={data.students} interests={interests} onNew={() => setInterestModal(true)} onPriorityChange={async (id, priority) => { await api(`/api/interests/${id}`, { method: "PATCH", body: JSON.stringify({ priority }) }); notify("지망 순위를 변경했습니다."); }} />}
        {view === "students" && <StudentsPage data={data} onApprove={async id => { await api(`/api/users/${id}/approve`, { method: "POST" }); notify("학생 계정을 승인했습니다."); }} />}
        {view === "announcements" && <AnnouncementsPage user={user} announcements={data.announcements} onNew={() => setNoticeModal(true)} />}
      </div>
    </main>
    {recordModal && <RecordModal students={data.students} onClose={() => setRecordModal(false)} onSaved={() => { setRecordModal(false); notify("상담 기록을 저장했습니다."); }} />}
    {interestModal && <InterestModal user={user} students={data.students} onClose={() => setInterestModal(false)} onSaved={() => { setInterestModal(false); notify("관심 대학을 저장했습니다."); }} />}
    {noticeModal && <NoticeModal onClose={() => setNoticeModal(false)} onSaved={attachmentFailed => { setNoticeModal(false); notify(attachmentFailed ? "공지는 게시했지만 첨부 파일은 올리지 못했습니다." : "공지를 게시했습니다."); }} />}
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
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result = await api<{ user: User }>(`/api/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", body: JSON.stringify({ ...body, role }) });
      onAuthenticated(result.user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "처리하지 못했습니다."); setBusy(false); }
  };
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">담</span><div><strong>담다</strong><small>대입 상담 기록</small></div></div><h1>{mode === "login" ? "로그인" : "계정 만들기"}</h1><p>{mode === "login" ? "아이디와 비밀번호로 시작하세요." : "학생 계정은 가입 후 교사 승인이 필요합니다."}</p>
    {mode === "register" && <div className="role-tabs"><button type="button" className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>학생</button><button type="button" className={role === "teacher" ? "active" : ""} onClick={() => setRole("teacher")}>교사</button></div>}
    <form onSubmit={submit} className="auth-form">
      {mode === "register" && <label>이름<input name="name" required autoComplete="name" placeholder="이름" /></label>}
      <label>아이디<input name="username" required minLength={4} maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9._-]{3,19}" autoComplete="username" placeholder="영문·숫자 4~20자" /></label>
      <label>비밀번호<input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="8자 이상" /></label>
      {mode === "register" && role === "student" && <label>번호<input name="studentNumber" type="number" inputMode="numeric" min="1" max="99" required placeholder="우리 반 번호" /></label>}
      {mode === "register" && role === "teacher" && <label>교사 개설 코드<input name="setupCode" type="password" required placeholder="관리자에게 받은 코드" /></label>}
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button auth-submit" disabled={busy}>{busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}</button>
    </form>
    <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "처음이신가요? 계정 만들기" : "이미 계정이 있나요? 로그인"}</button>
  </section></main>;
}

function ApprovalWaiting({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <main className="auth-page"><section className="auth-card waiting-card"><span className="waiting-icon"><ShieldCheck /></span><h1>교사 승인을 기다리고 있어요</h1><p><strong>{user.name}</strong>님의 가입 신청이 접수되었습니다.<br />담당 교사가 승인하면 상담 기록을 확인할 수 있습니다.</p><button className="secondary-button" onClick={onLogout}>다른 계정으로 로그인</button></section></main>;
}

function HomePage({ user, data, records, onView, onNew, onSelect }: { user: User; data: DashboardData; records: Consultation[]; onView: (view: View) => void; onNew: () => void; onSelect: (record: Consultation) => void }) {
  const teacher = user.role === "teacher";
  return <><div className="page-heading"><div><span className="eyebrow">TODAY&apos;S COUNSELING</span><h1>{user.name}님, 안녕하세요.</h1><p>{teacher ? "학생의 지원 전략과 상담 과정을 차곡차곡 기록하세요." : "선생님과 함께 정리한 지원 전략을 확인하세요."}</p></div>{teacher && <button className="primary-button" onClick={onNew}><Plus size={17} />새 상담 기록</button>}</div>
    {teacher && data.pendingStudents.length > 0 && <button className="approval-banner" onClick={() => onView("students")}><ShieldCheck /><span><strong>승인 대기 학생 {data.pendingStudents.length}명</strong><small>학생 관리에서 가입을 승인해 주세요.</small></span><ChevronRight /></button>}
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
  return <div className="attachment-list">{files.map(file => <a href={`/api/attachments/${file.id}`} target="_blank" rel="noreferrer" key={file.id}><Paperclip /><span>{file.fileName}<small>{fileSize(file.size)}</small></span></a>)}</div>;
}

function RecordDetail({ record, onBack }: { record: Consultation; onBack: () => void }) {
  return <article className="record-detail"><button className="back-button" onClick={onBack}>← 상담 기록</button><div className="detail-title"><span className="page-icon"><ClipboardList /></span><div><span>{formatDate(record.date)} · {record.studentName}</span><h1>{record.topic}</h1></div></div><section><h2>상담 내용</h2><p className="summary-text">{record.summary}</p><Attachments files={record.attachments} /></section></article>;
}

function StudentsPage({ data, onApprove }: { data: DashboardData; onApprove: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState("");
  return <><div className="section-heading"><div><span className="eyebrow">STUDENT MANAGEMENT</span><h1>학생 관리</h1><p>가입 신청을 승인하고 우리 반 학생을 확인합니다.</p></div></div>{data.pendingStudents.length > 0 && <section className="approval-section"><h2>승인 대기 <span>{data.pendingStudents.length}</span></h2>{data.pendingStudents.map(student => <article className="approval-row" key={student.id}><span className="student-avatar">{student.name.slice(0, 1)}</span><div><strong>{student.studentNumber ?? "-"}번 · {student.name}</strong><small>@{student.username}</small></div><button className="primary-button" disabled={busy === student.id} onClick={async () => { setBusy(student.id); await onApprove(student.id); setBusy(""); }}>{busy === student.id ? "승인 중…" : "승인"}</button></article>)}</section>}<div className="student-grid">{data.students.map(student => <article className="student-card" key={student.id}><span className="student-avatar">{student.studentNumber ?? "-"}</span><div><h3>{student.name}</h3><p>{student.studentNumber ?? "-"}번</p><small>@{student.username}</small></div></article>)}</div>{!data.students.length && !data.pendingStudents.length && <Empty text="아직 등록된 학생이 없습니다." />}</>;
}

function InterestsPage({ user, students, interests, onNew, onPriorityChange }: { user: User; students: User[]; interests: InterestUniversity[]; onNew: () => void; onPriorityChange: (id: string, priority: number) => Promise<void> }) {
  const [studentId, setStudentId] = useState("all");
  const [updating, setUpdating] = useState("");
  const [priorityError, setPriorityError] = useState("");
  const visible = studentId === "all" ? interests : interests.filter(item => item.studentId === studentId);
  const selectedStudent = students.find(student => student.id === studentId);
  return <><div className="section-heading"><div><span className="eyebrow">UNIVERSITY RESEARCH</span><h1>관심 대학</h1><p>{user.role === "teacher" ? "학생별로 찾아본 대학·학과·전형을 확인합니다." : "찾아본 대학·학과·전형과 수능 최저 조건을 정리합니다."}</p></div><button className="primary-button" onClick={onNew}><Plus size={17} />관심 대학 추가</button></div>{user.role === "teacher" && <div className="student-filter" aria-label="학생별 관심 대학"><button className={studentId === "all" ? "active" : ""} onClick={() => setStudentId("all")}><span>전체 학생</span><small>{interests.length}</small></button>{students.map(student => { const count = interests.filter(item => item.studentId === student.id).length; return <button className={studentId === student.id ? "active" : ""} key={student.id} onClick={() => setStudentId(student.id)}><span>{student.studentNumber ?? "-"}번 {student.name}</span><small>{count}</small></button>; })}</div>}{priorityError && <p className="form-error priority-error">{priorityError}</p>}{selectedStudent && <div className="interest-owner"><span className="student-avatar">{selectedStudent.studentNumber ?? "-"}</span><div><strong>{selectedStudent.name} 학생의 관심 대학</strong><small>@{selectedStudent.username} · {visible.length}개 기록</small></div></div>}<div className="interest-grid">{visible.map(item => { const total = interests.filter(row => row.studentId === item.studentId).length; return <article className="interest-card" key={item.id}><header><label className="priority-control"><select value={item.priority < 999 ? item.priority : 999} disabled={updating === item.id} onChange={async event => { setUpdating(item.id); setPriorityError(""); try { await onPriorityChange(item.id, Number(event.target.value)); } catch (reason) { setPriorityError(reason instanceof Error ? reason.message : "순위를 변경하지 못했습니다."); } finally { setUpdating(""); } }} aria-label={`${item.university} 지망 순위`}>{Array.from({ length: total }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}지망</option>)}<option value="999">순위 미정</option></select></label><span className="page-icon"><GraduationCap /></span><div><span>{user.role === "teacher" && studentId === "all" ? item.studentName : item.track}</span><h2>{item.university}</h2><p>{item.department}</p></div></header><dl><div><dt>전형</dt><dd>{item.track}</dd></div><div><dt>수능 최저</dt><dd>{item.minimum || "없음"}</dd></div><div><dt>내신 등급</dt><dd>{item.schoolGrade || "-"}</dd></div><div><dt>2023 커트</dt><dd>{item.cutoff2023 || "-"}</dd></div><div><dt>2024 커트</dt><dd>{item.cutoff2024 || "-"}</dd></div><div><dt>2025 커트</dt><dd>{item.cutoff2025 || "-"}</dd></div><div><dt>메모</dt><dd>{item.memo || "-"}</dd></div></dl></article>; })}</div>{!visible.length && <Empty text={selectedStudent ? `${selectedStudent.name} 학생의 관심 대학이 아직 없습니다.` : "아직 관심 대학이 없습니다."} />}</>;
}

function AnnouncementsPage({ user, announcements, onNew }: { user: User; announcements: Announcement[]; onNew: () => void }) {
  return <><div className="section-heading"><div><span className="eyebrow">NOTICE & GUIDE</span><h1>공지 · 입시 정보</h1><p>모든 승인 학생에게 필요한 정보와 자료를 공유합니다.</p></div>{user.role === "teacher" && <button className="primary-button" onClick={onNew}><Plus size={17} />새 글</button>}</div><div className="announcement-grid">{announcements.map(item => <article className={`announcement-card ${item.isPinned ? "pinned" : ""}`} key={item.id}>{item.isPinned && <span className="pin-label">중요</span>}<div className="announcement-meta"><span className="tag">{item.category}</span><span>{item.authorName} · {formatDate(item.publishedAt)}</span></div><h2>{item.title}</h2><p>{item.body}</p><Attachments files={item.attachments} /></article>)}</div>{!announcements.length && <Empty text="등록된 공지가 없습니다." />}</>;
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

function InterestModal({ user, students, onClose, onSaved }: { user: User; students: User[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); try { await api("/api/interests", { method: "POST", body: JSON.stringify({ studentId: form.get("studentId"), university: form.get("university"), department: form.get("department"), track: form.get("track"), minimum: form.get("minimum"), schoolGrade: form.get("schoolGrade"), cutoff2023: form.get("cutoff2023"), cutoff2024: form.get("cutoff2024"), cutoff2025: form.get("cutoff2025"), priority: form.get("priority"), memo: form.get("memo") }) }); onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "저장하지 못했습니다."); setSaving(false); } };
  return <Modal title="관심 대학 추가" onClose={onClose}><form className="modal-form" onSubmit={submit}>{user.role === "teacher" && <label>학생<select name="studentId" required defaultValue=""><option value="" disabled>학생 선택</option>{students.map(student => <option key={student.id} value={student.id}>{student.studentNumber}번 · {student.name}</option>)}</select></label>}<div className="field-row"><label>대학<input name="university" required placeholder="대학명" /></label><label>학과<input name="department" required placeholder="학과·계열" /></label></div><div className="field-row"><label>전형<input name="track" required placeholder="예: 학생부종합" /></label><label>지망 순위<input name="priority" type="number" min="1" max="99" required defaultValue="1" placeholder="1" /></label></div><div className="field-row"><label>수능 최저<input name="minimum" placeholder="예: 2개 합 5 / 없음" /></label><label>내신 등급<input name="schoolGrade" placeholder="예: 2.3등급" /></label></div><div className="cutoff-grid"><label>2023년 커트라인<input name="cutoff2023" placeholder="등급·점수" /></label><label>2024년 커트라인<input name="cutoff2024" placeholder="등급·점수" /></label><label>2025년 커트라인<input name="cutoff2025" placeholder="등급·점수" /></label></div><label>기타 메모<textarea name="memo" rows={4} placeholder="모집 인원, 전년도 결과, 확인할 내용 등을 기록하세요." /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={saving || (user.role === "teacher" && !students.length)}>{saving ? "저장 중…" : "관심 대학 저장"}</button></div></form></Modal>;
}

function NoticeModal({ onClose, onSaved }: { onClose: () => void; onSaved: (attachmentFailed?: boolean) => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setError(""); try { const form = new FormData(event.currentTarget); const files = filesFrom(form); const result = await api<{ id: string }>("/api/announcements", { method: "POST", body: JSON.stringify({ title: form.get("title"), body: form.get("body"), category: form.get("category"), isPinned: form.get("isPinned") === "on" }) }); try { await uploadFiles("announcement", result.id, files); onSaved(); } catch { onSaved(true); } } catch (reason) { setError(reason instanceof Error ? reason.message : "게시하지 못했습니다."); setSaving(false); } };
  return <Modal title="새 공지 작성" onClose={onClose}><form className="modal-form" onSubmit={submit}><label>분류<select name="category"><option>입시 일정</option><option>자료</option><option>상담</option><option>기타</option></select></label><label>제목<input name="title" required /></label><label>내용<textarea name="body" rows={7} required /></label><label className="toggle-label"><input name="isPinned" type="checkbox" />중요 공지로 표시</label><FileField />{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "게시 중…" : "공지 게시"}</button></div></form></Modal>;
}
