# 담다 — 대입 상담 기록

교사와 학생이 Google 계정으로 로그인해 상담 기록, 대학·학과·전형별 지원 계획, 수능 최저, 메모와 공지사항을 관리하는 반응형 웹앱입니다.

## Firebase 연결

1. Firebase 콘솔에서 웹 앱을 만들고 Authentication > Google 로그인을 활성화합니다.
2. `.env.example`을 `.env.local`로 복사하고 웹 앱 설정값 6개를 입력합니다.
3. Firestore Database를 만든 뒤 `firebase deploy --only firestore`로 보안 규칙과 인덱스를 반영합니다.
4. 최초 교사 계정으로 한 번 로그인한 후 Firestore `users/{uid}` 문서의 `role`을 관리자 콘솔에서 `teacher`로 바꿉니다. 일반 사용자는 보안 규칙상 스스로 교사 권한을 얻을 수 없습니다.
5. 학생 문서에 담당 교사의 UID를 `teacherId`로 지정합니다.

설정값이 없을 때에는 로그인 화면의 교사/학생 데모 모드로 UI를 확인할 수 있습니다.
