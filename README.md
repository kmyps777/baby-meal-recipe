# 🍼 우리아기 이유식 레시피북

Firebase 익명 인증 + Capacitor iOS 앱

## 파일 구조
```
wooriaagi-babyrecipe/
├── www/
│   ├── index.html     # Firebase 설정 + 앱 진입점
│   ├── app.js         # React 메인 앱
│   ├── style.css      # 스타일
│   └── privacy.html   # 개인정보처리방침
├── capacitor.config.json
├── package.json
└── README.md
```

## 설정 순서

### 1. Firebase 설정
`www/index.html`에서 firebaseConfig 값 교체
Firebase Console → Authentication → 로그인 방법 → **익명** 활성화 필수!

### 2. Firebase 보안 규칙
Firestore Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /recipes/{recipeId} {
      allow read, write: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }
    match /settings/{userId} {
      allow read, write: if request.auth != null && userId == request.auth.uid;
    }
  }
}
```

### 3. Capacitor iOS 설정
```bash
npm install
npx cap add ios
npx cap sync
npx cap open ios
```

### 4. Xcode에서
- Bundle ID: `com.wooriaagi.babyrecipe`
- Signing & Capabilities → 본인 Apple Developer 계정 선택
- 빌드 & 아카이브 → App Store Connect 업로드

### 5. GitHub Pages (웹 버전)
www 폴더 안 파일들을 GitHub에 올리면 웹에서도 사용 가능
