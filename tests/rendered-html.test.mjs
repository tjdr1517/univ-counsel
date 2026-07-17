import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished Korean Google sign-in experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>담다 \| 대입 상담 기록<\/title>/);
  assert.match(html, /Google 계정으로 계속하기/);
  assert.match(html, /한 번의 상담도/);
  assert.match(html, /교사로 둘러보기/);
  assert.match(html, /학생으로 둘러보기/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/);
});

test("contains the complete consultation and multi-track recording workflow", async () => {
  const app = await readFile(new URL("../app/ConsultationApp.tsx", import.meta.url), "utf8");
  const firebase = await readFile(new URL("../lib/firebase.ts", import.meta.url), "utf8");
  for (const label of ["상담 일자", "학교", "학과", "전형", "수능 최저", "전형 메모", "지원 전형 추가"]) {
    assert.match(app, new RegExp(label));
  }
  assert.match(app, /setPlans\(current => \[\.\.\.current, emptyPlan\(\)\]\)/);
  assert.match(firebase, /plans: AdmissionPlan\[\]/);
  assert.match(firebase, /orderBy\("date", "desc"\)/);
  assert.match(app, /plan\.university.*plan\.department.*plan\.track.*plan\.minimum.*plan\.memo/s);
});

test("enforces participant-only records and teacher-only publishing", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /resource\.data\.studentId == request\.auth\.uid/);
  assert.match(rules, /resource\.data\.teacherId == request\.auth\.uid/);
  assert.match(rules, /match \/announcements\/\{postId\}/);
  assert.match(rules, /allow create: if isTeacher\(\)/);
  assert.match(rules, /match \/teacherAllowlist\/\{email\}/);
  assert.match(rules, /match \/teacherCodes\/\{code\}/);
  assert.match(rules, /get\(\/databases\/\$\(database\)\/documents\/users\/\$\(request\.resource\.data\.studentId\)\)\.data\.teacherId == request\.auth\.uid/);
});

test("keeps the finished interface responsive and removes starter assets", async () => {
  const [css, page, packageJson] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(css, /@media \(max-width:720px\)/);
  assert.match(css, /\.sidebar\s*\{transform:translateX\(-100%\)/);
  assert.match(css, /\.stats-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /\.plan-grid\{grid-template-columns:1fr\}/);
  assert.match(page, /<ConsultationApp \/>/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", projectRoot)));
});
