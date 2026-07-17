import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("renders the Korean email login experience", async () => {
  const [layout, app] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ConsultationApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /<html lang="ko">/);
  assert.match(layout, /담다 \| 대입 상담 기록/);
  assert.match(app, /로그인/);
  assert.match(app, /계정 만들기/);
  assert.doesNotMatch(app, /Google 계정|firebase/i);
});

test("uses D1 and R2 with generated migrations", async () => {
  const [hosting, schema, migration] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_even_phalanx.sql", import.meta.url), "utf8"),
  ]);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
  for (const table of ["users", "sessions", "consultations", "announcements", "attachments"]) {
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
  assert.match(server, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(dashboard, /student_id = \?/);
  assert.match(dashboard, /teacher_id = \?/);
  assert.match(consultations, /teacher_id=\?/);
  assert.match(approval, /status='approved'/);
  assert.match(attachments, /canAccessOwner/);
});

test("supports all requested admissions fields and uploads", async () => {
  const app = await readFile(new URL("../app/ConsultationApp.tsx", import.meta.url), "utf8");
  for (const label of ["상담 일자", "학교", "학과", "전형", "수능 최저", "기타 메모", "파일 또는 이미지 첨부"]) assert.match(app, new RegExp(label));
  assert.match(app, /setPlans\(current => \[\.\.\.current, emptyPlan\(\)\]\)/);
  assert.match(app, /\/api\/attachments/);
});

test("removes every Firebase project artifact and keeps responsive CSS", async () => {
  const [pkg, css] = await Promise.all([readFile(new URL("../package.json", import.meta.url), "utf8"), readFile(new URL("../app/globals.css", import.meta.url), "utf8")]);
  assert.doesNotMatch(pkg, /firebase/i);
  assert.match(css, /@media\(max-width:720px\)|@media \(max-width:720px\)/);
  for (const path of ["lib/firebase.ts", "firebase.json", "firestore.rules", "firestore.indexes.json"]) await assert.rejects(access(new URL(`../${path}`, import.meta.url)));
  assert.ok(root);
});
