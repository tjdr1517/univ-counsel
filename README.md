# 담다 — 대입 상담 기록

교사와 학생이 Google 계정으로 로그인해 상담 기록, 대학·학과·전형별 지원 계획, 수능 최저, 메모와 공지사항을 관리하는 반응형 웹앱입니다.

## Firebase 연결

1. Firebase 콘솔에서 웹 앱을 만들고 Authentication > Google 로그인을 활성화합니다.
2. `.env.example`을 `.env.local`로 복사하고 웹 앱 설정값 6개를 입력합니다.
3. Firestore Database를 만든 뒤 `firebase deploy --only firestore`로 보안 규칙과 인덱스를 반영합니다.
4. 교사 이메일을 소문자로 하여 `teacherAllowlist/{교사 이메일}` 문서를 Firebase 콘솔에서 미리 만듭니다. 내용은 비어 있어도 됩니다. 허용 목록에 있는 Google 계정만 교사 권한을 받을 수 있습니다.
5. 교사가 로그인하면 6자리 연결 코드가 자동 생성됩니다. 학생이 로그인 후 해당 코드를 입력하면 담당 교사와 연결됩니다.

설정값이 없을 때에는 로그인 화면의 교사/학생 데모 모드로 UI를 확인할 수 있습니다.
