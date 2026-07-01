# 클리닉 명단 관리

담임 선생님이 학생별 정규반·이름·담임·해야할 일·특이사항을 입력하고,
클리닉 담당 선생님이 출결 체크와 클리닉 결과를 입력하는 월별 클리닉 명단 관리 웹앱입니다.

- 로그인 없이 링크만 있으면 누구나 편집 가능
- 저장소: Firebase Firestore
- 빌드 과정 없이 정적 파일(HTML/CSS/JS)만으로 동작 → GitHub Pages로 바로 배포 가능

## 파일 구성

```
index.html    앱 진입점 (React, Firebase, Babel CDN 로드)
style.css     디자인/스타일
app.js        앱 로직 (React 컴포넌트, JSX — 브라우저에서 Babel로 변환됨)
config.js     Firebase 프로젝트 설정값
firestore.rules  Firestore 보안 규칙 (참고용, Firebase 콘솔에 붙여넣어 사용)
```

## 사용 방법

### 1. GitHub에 올리기

이 폴더(clinic-app) 전체를 GitHub 저장소에 업로드하세요.

```
git init
git add .
git commit -m "클리닉 명단 관리 앱"
git branch -M main
git remote add origin <본인의 GitHub 저장소 주소>
git push -u origin main
```

### 2. GitHub Pages로 배포

1. GitHub 저장소 → **Settings** → **Pages**
2. **Source**를 `Deploy from a branch`로, **Branch**를 `main` / `/(root)`로 설정 후 저장
3. 잠시 후 `https://<본인계정>.github.io/<저장소이름>/` 주소로 접속하면 앱이 열립니다.
4. 이 링크를 담임 선생님, 클리닉 담당 선생님들께 공유하면 됩니다. (로그인 불필요)

### 3. Firebase 설정 확인

`config.js`에 이미 아래 프로젝트 설정이 들어있습니다.

```js
projectId: "cms-clinic-a5385"
```

Firebase 콘솔(https://console.firebase.google.com) → 해당 프로젝트 → **Firestore Database**가
활성화되어 있는지 확인해주세요. (빌드 모드는 "테스트 모드"로 시작해도 되고,
아래 4번의 보안 규칙을 붙여넣어도 됩니다.)

### 4. Firestore 보안 규칙 설정 (중요)

로그인 기능이 없기 때문에, Firestore 규칙에서 읽기/쓰기를 열어줘야 앱이 정상 동작합니다.

1. Firebase 콘솔 → **Firestore Database** → **규칙(Rules)** 탭
2. 이 저장소의 `firestore.rules` 내용을 그대로 붙여넣고 **게시(Publish)**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

이 규칙은 앱 링크(또는 Firebase 설정값)를 아는 사람은 누구나 데이터를 읽고 쓸 수 있다는 뜻입니다.
내부 관계자끼리만 공유하는 용도로 사용해주세요.

## 데이터 구조 (Firestore)

```
clinicMonths/{YYYY-MM}                 예: 2026-02
  ├─ year, month
  ├─ weekdayGroups: [{ id, dayOfWeek(0~6), grade, time, teacher, order }]
  └─ sessions (하위 컬렉션)
       {sessionId}
         ├─ date (YYYY-MM-DD), dayOfWeek, groupId, grade, time, teacher, order
         └─ students: [{ id, classRoom, name, homeroom, task, note, attended, result }]
```

- `weekdayGroups`는 방을 만들 때 설정한 "요일별 반 구성"의 원본이며,
  이 정보를 바탕으로 그 달의 실제 날짜마다 `sessions` 문서가 자동 생성됩니다.
- 학생 목록(`students`)은 세션 문서 안에 배열로 저장되어, 이미지 속 표(정규반/이름/담임/
  해야할 일/특이사항/출결/클리닉 결과)와 그대로 대응됩니다.

## 주요 기능

1. **메인 화면**: 만들어진 월별 클리닉 방 목록, 새 방 만들기
2. **클리닉 방 만들기**:
   - 몇 년 몇 월인지 입력
   - **이전 달 포맷 불러오기** — 기존 달의 요일·반·시간·담당자 구성을 그대로 불러와 수정만 하면 됨
   - 클리닉 요일 선택 (일~토 자유롭게, 요일별로 여러 반 구성 가능)
   - 요일별로 반을 몇 개 만들지, 각 반의 대상 학년/클리닉 시간/담당자 입력
   - 저장하면 그 달의 실제 날짜에 맞춰 명단 표가 자동 생성됨
3. **클리닉 방 화면**: 날짜별로 표가 나열되며,
   - 담임 선생님 입력 영역(연한 크림색): 정규반, 이름, 담임, 해야할 일, 특이사항
   - 클리닉 담당 선생님 입력 영역(연한 초록색): 출결 체크, 클리닉 결과
   - 학생 추가/삭제, 반(세션) 추가/삭제
   - **클리닉 날짜/반 추가** 버튼으로 정해진 요일 외에 단기간 진행되는 다른 요일 클리닉도 자유롭게 추가 가능

## 로컬에서 확인하는 방법

빌드 과정이 없으므로 파일을 그대로 열어도 되지만, 브라우저 보안 정책상 로컬 서버로 여는 것을 권장합니다.

```
cd clinic-app
python3 -m http.server 8000
```

이후 브라우저에서 `http://localhost:8000` 접속.
