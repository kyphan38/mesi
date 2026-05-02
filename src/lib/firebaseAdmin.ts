import "server-only";

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";

function readFirebaseAdminEnv() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env. Required: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

let appSingleton: App | null = null;
let authSingleton: Auth | null = null;

export function getFirebaseAdminApp(): App {
  if (appSingleton) return appSingleton;

  if (getApps().length > 0) {
    appSingleton = getApps()[0]!;
    return appSingleton;
  }

  const serviceAccount = readFirebaseAdminEnv();
  appSingleton = initializeApp({ credential: cert(serviceAccount) });
  return appSingleton;
}

export function getFirebaseAdminAuth(): Auth {
  if (authSingleton) return authSingleton;
  authSingleton = getAuth(getFirebaseAdminApp());
  return authSingleton;
}
