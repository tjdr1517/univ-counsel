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
  const [server, dashboard, consultations, approval, attachments] = await Promise.all([
    readFile(new URL("../lib/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/consultations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/users/[id]/approve/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/attachments/[id]/route.ts", import.meta.url), "utf8"),
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
  for (const label of ["관심 대학", "대학", "학과", "전형", "수능 최저", "내신 등급", "2023년 커트라인", "2024년 커트라인", "2025년 커트라인", "지망 순위", "기타 메모", "상담 내용", "파일 또는 이미지 첨부"]) assert.match(app, new RegExp(label));
  assert.doesNotMatch(app, /setPlans|emptyPlan/);
  assert.doesNotMatch(consultations, /input\.plans|normalizedPlans/);
  assert.match(interests, /interest_universities/);
  assert.match(interests, /student_id/);
  assert.match(app, /\/api\/interests/);
  assert.match(app, /\/api\/attachments/);
  assert.doesNotMatch(app, /event\.currentTarget\.elements/);
  assert.match(app, /const files = Array\.from\(\(formElement\.elements\.namedItem\("files"\)/);
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
  for (const path of ["lib/firebase.ts", "firebase.json", "firestore.rules", "firestore.indexes.json"]) await assert.rejects(access(new URL(`../${path}`, import.meta.url)));
  assert.ok(root);
});
