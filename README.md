# MARTYS · 일본 선교팀 2026

8명 전용 모바일 웹사이트. GitHub Pages(정적 호스팅) + Firebase Authentication, Firestore, Storage.

## 포함 기능
- 이메일/비밀번호 로그인. `users/{uid}` 승인된 8명만 화면 및 Firestore 데이터 접근
- `admin`은 일정·지출·찬양 등록/수정/삭제, `member`는 읽기만 가능
- 2026년 10월 16–18일 일정, 선교 목적과 기도제목
- 8명 총예산 6,640,000원: 회비 400,000원/인, 항공 430,000원/인
- 지출 입력 시 사용액/잔액 자동 계산, 실시간 동기화
- 일본어 가사·한글 발음·한국어 뜻, 음원 재생, 악보 PDF/이미지 업로드

## 1. Firebase 만들기
1. https://console.firebase.google.com/ → 프로젝트 만들기
2. 프로젝트 설정 → 내 앱 → 웹(</>) 앱 등록 → Firebase SDK 설정 객체 복사
3. `firebase-config.js`의 `REPLACE_ME` 값들을 실제 설정값으로 교체
4. Authentication → Sign-in method → **Email/Password** 사용 설정
5. Firestore Database 생성 (Production mode 권장), Storage 생성 (요금제/리전 조건은 Firebase 콘솔에서 확인)
6. Firestore → Rules에서 `firestore.rules` 내용 전체를 붙여넣고 **게시**
7. Storage → Rules에서 `storage.rules` 내용 전체를 붙여넣고 **게시**

## 2. 8명 계정 승인 (중요)
1. Authentication → Users → Add user로 팀원별 이메일/임시 비밀번호 생성. 비밀번호는 각자 안전하게 전달.
2. 생성된 사용자마다 **UID** 복사
3. Firestore → `users` 컬렉션 생성 → 문서 ID를 **정확한 UID**로 지정
4. 각 문서에 필드 추가: `active` (boolean) `true`, `role` (string) `admin` 또는 `member`, `name` (string) 팀원 표시 이름
5. **관리자 1명만 `admin`**, 나머지 7명 `member` 권장. `users` 문서는 웹사이트에서 변경할 수 없으며 콘솔에서만 관리.
6. 테스트 계정으로 로그인 후 읽기/쓰기 권한을 검증.

예시: `users/abc123uid` → `{ active: true, role: "admin", name: "팀장" }`

## 3. GitHub Pages 배포
1. GitHub에서 Public 저장소 `japan-mission-2026` 생성 (무료 Pages의 일반적인 사용 방법)
2. 이 폴더의 **파일 전체**를 저장소 최상위(root)에 업로드 (`index.html`, `style.css`, `app.js`, `firebase-config.js` 등)
3. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save
4. 사이트 주소: `https://사용자이름.github.io/japan-mission-2026/`
5. Firebase Authentication → Settings → Authorized domains에 `사용자이름.github.io` 추가 (필요 시)
6. Firebase Storage 이용 시 Firebase 프로젝트의 과금/요금제 제한을 확인.

## 주의 및 보안
- GitHub Pages **Public 저장소의 코드와 Firebase 설정값은 공개**됩니다. Firebase 웹 설정값은 비밀키가 아니며 실제 접근 제한은 Firestore/Storage Rules에서 수행됩니다. 서비스 계정 비밀키는 절대 업로드하지 마세요.
- `users` 승인 목록 및 역할은 Firestore 규칙으로 검사됩니다. 계정만 만들어서는 접속할 수 없습니다.
- Firebase Storage `getDownloadURL`은 **토큰을 아는 누구나 열 수 있는 공유 링크**를 발급합니다. 사이트 UI와 Firestore 데이터는 팀원 전용이지만, 음원/악보 다운로드 URL을 외부에 전달하면 외부인도 파일을 열 수 있습니다. 엄격한 파일 비공개가 필요하다면 토큰 URL 대신 인증 기반 다운로드 구현/별도 프록시가 필요합니다.
- Firestore의 모든 지출은 등록된 실제 사용액만 합산합니다. 예산 계획과 실제 사용을 구분합니다.
- 찬양 저작권을 확인하세요. 허가받은 음원/악보만 올리세요.
- 파일 업로드가 성공하고 DB 저장이 실패하면 고아 파일이 남을 수 있습니다. Firebase Storage 콘솔에서 정리할 수 있습니다.
- GitHub Pages와 Firebase 모두 실제 배포·로그인 테스트는 본인 계정 연결 후 진행해야 합니다. 이 ZIP은 설정값 미입력 상태로 제공됩니다.

## 파일 구조
- `index.html` : 시작 화면
- `style.css` : 모바일 반응형 스타일
- `app.js` : 로그인·관리자·일정·예산·찬양 전체 동작
- `firebase-config.js` : Firebase 프로젝트 연결값 입력
- `firestore.rules` : DB 접근 규칙
- `storage.rules` : 음원/악보 접근 규칙
