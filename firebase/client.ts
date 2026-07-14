import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeFirestore, getFirestore } from "firebase/firestore"; // Import Firestore

const firebaseConfig = {
  apiKey: "AIzaSyCmjn2Enchkf-BH3-dBuBfCJPKPDnqfeT8",
  // Production authDomain is the app's own origin so the Google sign-in
  // round-trip stays first-party — Safari ITP (and Chrome's storage
  // partitioning) drops cross-site auth state on the default firebaseapp.com
  // domain, which broke sign-in on iOS. The /__/auth/* and /__/firebase/*
  // helper pages only exist on Firebase Hosting, so next.config.ts proxies
  // them through; this line and those rewrites must ship in the same deploy.
  // Dev keeps the Firebase domain: localhost signs in via the popup path
  // (see authContext), which works cross-origin.
  authDomain:
    process.env.NODE_ENV === "production"
      ? "www.rubiktech.org"
      : "readiq-1f109.firebaseapp.com",
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
