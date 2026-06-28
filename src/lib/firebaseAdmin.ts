import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";

const getCredential = () => {
  // 1. Try parsing service account key JSON first
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return cert(serviceAccount);
    } catch (e) {
      console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }

  // 2. Try individual environment variables
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    });
  }

  return null;
};

if (getApps().length === 0) {
  const credential = getCredential();
  if (credential) {
    initializeApp({
      credential,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
}

const adminDb = getFirestore("default");
const adminAuth = getAuth();
const adminStorage = getStorage();
const adminMessaging = getMessaging();

export { adminDb, adminAuth, adminStorage, adminMessaging };
