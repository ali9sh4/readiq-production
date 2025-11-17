// Create this file: app/api/test-firebase/route.ts
// This will help you test if Firebase Admin is working in production

import { db } from "@/firebase/service";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("=== FIREBASE DIAGNOSTIC TEST ===");

    // Test 1: Check if db is initialized
    if (!db) {
      return NextResponse.json(
        {
          success: false,
          error: "Firestore db is not initialized",
          tests: {
            dbInitialized: false,
          },
        },
        { status: 500 }
      );
    }

    console.log("✅ Firestore db is initialized");

    // Test 2: Try to read from Firestore
    const testSnapshot = await db.collection("courses").limit(1).get();

    console.log("✅ Successfully queried Firestore");
    console.log("Documents found:", testSnapshot.size);

    // Test 3: Check environment variables (without exposing them)
    const envCheck = {
      FIREBASE_PRIVATE_KEY_ID: !!process.env.FIREBASE_PRIVATE_KEY_ID,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_CLIENT_ID: !!process.env.FIREBASE_CLIENT_ID,
      FIREBASE_PRIVATE_KEY_LENGTH:
        process.env.FIREBASE_PRIVATE_KEY?.length || 0,
    };

    console.log("Environment variables check:", envCheck);

    return NextResponse.json({
      success: true,
      message: "Firebase Admin is working correctly!",
      tests: {
        dbInitialized: true,
        firestoreQuery: true,
        documentsFound: testSnapshot.size,
        environmentVariables: envCheck,
      },
    });
  } catch (error) {
    console.error("=== FIREBASE DIAGNOSTIC ERROR ===");
    console.error("Error type:", error?.constructor?.name);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error)
    );
    console.error("Full error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name,
        tests: {
          dbInitialized: !!db,
        },
      },
      { status: 500 }
    );
  }
}
