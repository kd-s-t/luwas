import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "demo-dro.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-dro",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "demo-dro.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "000000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:000000000000:web:demo",
};

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let emulatorsConnected = false;

function getFirebaseApp() {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0]!;
  }
  return app;
}

export function getClientAuth() {
  auth = getAuth(getFirebaseApp());
  connectEmulatorsOnce();
  return auth;
}

export function getClientDb() {
  db = getFirestore(getFirebaseApp());
  connectEmulatorsOnce();
  return db;
}

export function getClientStorage() {
  storage = getStorage(getFirebaseApp());
  connectEmulatorsOnce();
  return storage;
}

function connectEmulatorsOnce() {
  if (!useEmulators || emulatorsConnected || typeof window === "undefined") {
    return;
  }

  const firebaseApp = getFirebaseApp();
  const authInstance = getAuth(firebaseApp);
  const dbInstance = getFirestore(firebaseApp);
  const storageInstance = getStorage(firebaseApp);

  connectAuthEmulator(authInstance, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(dbInstance, "127.0.0.1", 8080);
  connectStorageEmulator(storageInstance, "127.0.0.1", 9199);

  emulatorsConnected = true;
}

export { useEmulators };
