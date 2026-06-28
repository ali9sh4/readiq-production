import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeFirestore, getFirestore } from "firebase/firestore"; // Import Firestore

const firebaseConfig = {
  apiKey: "AIzaSyCmjn2Enchkf-BH3-dBuBfCJPKPDnqfeT8",
  authDomain: "readiq-1f109.firebaseapp.com",
  projectId: "readiq-1f109",
  storageBucket: "readiq-1f109.firebasestorage.app",
  messagingSenderId: "338348007207",
  appId: "1:338348007207:web:3a02400113057ea6455302",
  measurementId: "G-5GX4VE53WX",
};
// Initialize Firebase only once
const isFirstInit = !getApps().length;
const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();
//export initilaized services
export const auth = getAuth(app);
export const storage = getStorage(app);

// Use auto-detected long-polling instead of the default WebChannel streaming
// transport. The streaming `Listen` connection dies on long-open sessions
// (sleep/wake, network blips, proxies) with an HTTP 400 and frequently fails to
// self-heal, which froze onSnapshot listeners until a full logout/login.
// initializeFirestore must run before any getFirestore() call and only once per
// app, so guard it against HMR / re-import re-initialization.
export const db = isFirstInit
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  : getFirestore(app);
