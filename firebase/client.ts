import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore"; // Import Firestore

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
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
//export initilaized services
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
