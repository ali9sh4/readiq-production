"use server";

import { auth } from "@/firebase/service"
import { cookies } from "next/headers";
export const removeToken = async()=>{
const cookieStore = await cookies();
cookieStore.delete("firebaseAuthToken")
cookieStore.delete("firebaseAuthRefreshToken")
}

export const setToken = async ({token,refreshToken}:{token:string,refreshToken:string}) => {
    // we need to verify the token and check if the user is an admin
    const verifyAuthToken = await auth.verifyIdToken(token)
    if(!verifyAuthToken){
        return;
    }
    const userRecord = await auth.getUser(verifyAuthToken.uid)
    if (process.env.FIREBASE_ADMIN_EMAIL ===  userRecord.email && !userRecord.customClaims?.admin)
        {
            auth.setCustomUserClaims(verifyAuthToken.uid ,{admin:true}
            )
    }
const cookieStore = await cookies();
cookieStore.set("firebaseAuthToken" , token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'lax', // ADD THIS
    maxAge: 60 * 60, // ADD THIS - 1 hour to match Firebase token expiry
    path: '/' // ADD THIS
})
cookieStore.set("firebaseAuthRefreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'lax', // ADD THIS (use 'lax' not 'strict' for OAuth)
    maxAge: 60 * 60 * 24 * 30, // ADD THIS - 30 days
    path: '/' // ADD THIS
})


}
