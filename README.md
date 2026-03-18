# 🍼 우리아기 이유식 레시피 북

Firebase Firestore 기반의 이유식 레시피 관리 앱입니다.
iPhone · MacBook 등 모든 기기에서 실시간 동기화됩니다.

## 기능
- 레시피 추가 / 수정 / 삭제 (삭제 확인 모달)
- 사진 첨부 (Firebase Storage)
- 재료, 만드는 순서, 큐브 양, 메모 기록
- 단계별 분류 (커스텀 가능)
- 카테고리별 분류 (커스텀 가능)
- 실시간 Firebase 동기화
- PWA — iPhone 홈화면에 앱처럼 추가 가능

## 설정 방법

### 1. Firebase config 입력
`index.html` 파일에서 아래 부분을 본인 Firebase 값으로 교체:
```js
const firebaseConfig = {
  apiKey:            "여기에_API_KEY",
  authDomain:        "여기에.firebaseapp.com",
  projectId:         "여기에_PROJECT_ID",
  storageBucket:     "여기에.appspot.com",
  messagingSenderId: "여기에_SENDER_ID",
  appId:             "여기에_APP_ID"
};
```

### 2. Firebase 규칙 설정
**Firestore** → 규칙 탭:
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

**Storage** → 규칙 탭:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

### 3. GitHub Pages 배포
1. GitHub에 저장소 생성
2. 파일 4개 업로드 (`index.html`, `app.js`, `style.css`, `README.md`)
3. Settings → Pages → Branch: main 설정
4. `https://아이디.github.io/저장소이름` 으로 접속

### 4. iPhone 홈화면에 추가
Safari에서 접속 → 공유 버튼(□↑) → 홈 화면에 추가 🍼
