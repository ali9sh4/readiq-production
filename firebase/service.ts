import {
  getApp,
  getApps,
  initializeApp,
  cert,
  ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";

// ✅ Parse the entire service account JSON from environment variable
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}"
) as ServiceAccount;

const app = !getApps().length
  ? initializeApp({
      credential: cert(serviceAccount),
      storageBucket: "readiq-1f109.firebasestorage.app",
    })
  : getApp();

// Export initialized services
export const adminAuth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);

export const getTotalPages = async (
  firestoreQuery: FirebaseFirestore.Query<
    FirebaseFirestore.DocumentData,
    FirebaseFirestore.DocumentData
  >,
  pageSize: number
) => {
  const queryCount = firestoreQuery.count();
  const querySnapshot = await queryCount.get();
  const countdata = querySnapshot.data();
  const total = countdata.count;
  const totalPages = Math.ceil(total / pageSize);
  return totalPages;
};
