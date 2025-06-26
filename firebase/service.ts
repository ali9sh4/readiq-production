import { getApp, getApps, initializeApp, cert, ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore"; // Add this import

const serviceAccount= 
    {                                                                                                                                                                   
        "type": "service_account",
        "project_id": "readiq-1f109",
        "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
        "private_key": process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'), // Ensure newlines are correctly formatted
        "client_email": process.env.FIREBASE_CLIENT_EMAIL,
        "client_id": process.env.FIREBASE_CLIENT_ID,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40readiq-1f109.iam.gserviceaccount.com",
        "universe_domain": "googleapis.com"
      }
     const app = !getApps().length? initializeApp({
        
         credential: cert(serviceAccount as ServiceAccount),
         storageBucket: "readiq-1f109.firebasestorage.app"
     }) : getApp();
         //export initilaized services
         export const adminAuth = getAuth(app);
         export const storage = getStorage(app);
         export const db = getFirestore(app);

         export const getTotalPages =  async(firestoreQuery:FirebaseFirestore.Query<
            FirebaseFirestore.DocumentData,
            FirebaseFirestore.DocumentData
            >,pageSize:number)=>{
                const queryCount = firestoreQuery.count();
                const querySnapshot = await queryCount.get();
                const countdata = querySnapshot.data();
                const total = countdata.count;
                const totalPages = Math.ceil(total/pageSize);
                return totalPages;

         }
         

      


      