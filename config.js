// Firebase 프로젝트 설정
// Firebase 콘솔 > 프로젝트 설정 > 내 앱 에서 확인/변경할 수 있습니다.
const firebaseConfig = {
  apiKey: "AIzaSyA-0ESEiGLqk21OxfOlRBckIezRkXAfyKg",
  authDomain: "cms-clinic-a5385.firebaseapp.com",
  projectId: "cms-clinic-a5385",
  storageBucket: "cms-clinic-a5385.firebasestorage.app",
  messagingSenderId: "302566959788",
  appId: "1:302566959788:web:2e6ac31ba1c83e1abbcd09",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
