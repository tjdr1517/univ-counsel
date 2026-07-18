import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("renders the Korean username login experience", async () => {
  const [layout, app] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ConsultationApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /<html lang="ko">/);
  assert.match(layout, /담다 \| 대입 상담 기록/);
  assert.match(app, /로그인/);
  assert.match(app, /계정 만들기/);
  assert.match(app, /아이디와 비밀번호/);
  assert.match(app, /name="username"/);
  assert.match(app, /name="studentNumber"/);
  assert.match(app, /window\.history\.pushState/);
  assert.match(app, /window\.history\.replaceState/);
  assert.match(app, /addEventListener\("popstate"/);
  assert.match(app, /window\.location\.hash/);
  assert.match(app, /api<DashboardData>\("\/api\/dashboard"\)\.then/);
  assert.doesNotMatch(app, /계정을 확인하고 있습니다/);
  assert.doesNotMatch(app, /name="grade"|name="classNumber"/);
  assert.doesNotMatch(app, /type="email"|Google 계정|firebase/i);
});

test("uses D1 and R2 with generated migrations", async () => {
  const [hosting, schema, migrationFiles] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readdir(new URL("../drizzle/", import.meta.url)),
  ]);
  const migration = (await Promise.all(migrationFiles.filter(file => file.endsWith(".sql")).map(file => readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8")))).join("\n");
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
  for (const table of ["users", "sessions", "consultations", "interest_universities", "announcements", "attachments"]) {
    assert.ok(schema.includes(`sqliteTable("${table}"`));
    assert.ok(migration.includes("CREATE TABLE `" + table + "`"));
  }
});

test("keeps authentication and record authorization on the server", async () => {
  const [server, dashboard, consultations, approval, attachments, announcementActions] = await Promise.all([
    readFile(new URL("../lib/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/consultations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/users/[id]/approve/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/attachments/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/announcements/[id]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(server, /PBKDF2/);
  assert.match(server, /PBKDF2_ITERATIONS = 100_000/);
  assert.doesNotMatch(server, /120_000/);
  assert.match(server, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(server, /TEACHER_IDS/);
  assert.match(dashboard, /student_id = \?/);
  assert.match(dashboard, /teacher_id = \?/);
  assert.match(consultations, /teacher_id=\?/);
  assert.match(approval, /status='approved'/);
  assert.match(attachments, /canAccessOwner/);
  assert.match(announcementActions, /row\.author_id !== auth\.user\.id/);
  assert.match(announcementActions, /export async function PATCH/);
  assert.match(announcementActions, /export async function DELETE/);
  assert.match(announcementActions, /FILES\.delete/);
});

test("separates counseling notes from researched universities", async () => {
  const [app, consultations, interests, interestPriority, dashboard, server] = await Promise.all([
    readFile(new URL("../app/ConsultationApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/consultations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/interests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/interests/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server.ts", import.meta.url), "utf8"),
  ]);
  for (const label of ["관심 대학", "대학", "학과", "전형 종류", "평가 요소", "수능 최저", "내신 등급", "2023년 입결", "2024년 입결", "2025년 입결", "지망 순위", "기타 메모", "상담 내용", "파일 또는 이미지 첨부"]) assert.match(app, new RegExp(label));
  for (const track of ["학생부 종합 전형", "학생부 교과 전형", "논술 전형", "실기(특기자) 전형", "기타 전형"]) assert.ok(app.includes(track));
  assert.match(app, /생기부 50 \+ 교과 50/);
  assert.match(app, /교과 100/);
  assert.match(interests, /evaluation_factors/);
  assert.doesNotMatch(app, /커트라인|2023 커트|2024 커트|2025 커트/);
  assert.doesNotMatch(app, /setPlans|emptyPlan/);
  assert.doesNotMatch(consultations, /input\.plans|normalizedPlans/);
  assert.match(interests, /interest_universities/);
  assert.match(interests, /student_id/);
  assert.match(app, /\/api\/interests/);
  assert.match(app, /\/api\/attachments/);
  assert.doesNotMatch(app, /event\.currentTarget\.elements/);
  assert.doesNotMatch(app, /formElement\.elements/);
  assert.match(app, /form\.getAll\("files"\)/);
  assert.match(app, /type="submit" className="primary-button" disabled=\{saving\}/);
  assert.match(app, /첨부 파일은 올리지 못했습니다/);
  assert.match(app, /공지 수정/);
  assert.match(app, /공지를 삭제할까요/);
  assert.match(app, /contentType\.startsWith\("image\/"\)/);
  assert.match(app, /className="image-thumbnails"/);
  assert.match(app, /loading="lazy"/);
  assert.match(app, /\^\(\\d\{4\}\)-\(\\d\{2\}\)-\(\\d\{2\}\)/);
  assert.doesNotMatch(app, /value\.includes\("T"\)/);
  assert.match(app, /student-filter/);
  assert.match(app, /학생별 관심 대학/);
  assert.match(app, /interests\.filter\(item => item\.studentId === studentId\)/);
  assert.match(interestPriority, /reorderInterestPriorities/);
  assert.match(server, /ranked\.splice/);
  assert.match(dashboard, /ORDER BY priority ASC/);
});

test("removes every Firebase project artifact and keeps responsive CSS", async () => {
  const [pkg, css] = await Promise.all([readFile(new URL("../package.json", import.meta.url), "utf8"), readFile(new URL("../app/globals.css", import.meta.url), "utf8")]);
  assert.doesNotMatch(pkg, /firebase/i);
  assert.match(css, /@media\(max-width:720px\)|@media \(max-width:720px\)/);
  assert.match(css, /\.interest-card header\{position:relative/);
  assert.match(css, /\.interest-card dl\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.modal-scrim\{align-items:flex-end/);
  assert.match(css, /\.help-popover\{left:-68px;right:auto/);
  for (const path of ["lib/firebase.ts", "firebase.json", "firestore.rules", "firestore.indexes.json"]) await assert.rejects(access(new URL(`../${path}`, import.meta.url)));
  assert.ok(root);
});
