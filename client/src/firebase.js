// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDdopiOgrtv6tWZksROFGAgm8IbTlJsSEU",
  authDomain: "photos-app-8bbf6.firebaseapp.com",
  projectId: "photos-app-8bbf6",
  storageBucket: "photos-app-8bbf6.firebasestorage.app",
  messagingSenderId: "277718578193",
  appId: "1:277718578193:web:e71c3db3ad15b39446edb0",
  measurementId: "G-BC2KH2DQZ1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app)