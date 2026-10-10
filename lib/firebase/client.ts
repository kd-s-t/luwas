import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
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

/** Next only inlines NEXT_PUBLIC_* when accessed as a static property
 * (`process.env.NEXT_PUBLIC_FOO`), not via `process.env[name]`. */
function pub(raw: string | undefined, fallback: string): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

const firebaseConfig = {
  apiKey: pub(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "demo-api-key"),
  authDomain: pub(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    "demo-dro.firebaseapp.com",
  ),
  projectId: pub(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "demo-dro"),
  storageBucket: pub(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    "demo-dro.appspot.com",
  ),
  messagingSenderId: pub(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    "000000000000",
  ),
  appId: pub(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    "1:000000000000:web:demo",
  ),
};

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let emulatorsConnected = false;

function getFirebaseApp() {
  if (!getApps().length) {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "demo-api-key") {
      // Still allow emulator / local demo; production should never hit empty keys.
      if (!useEmulators && typeof window !== "undefined") {
        console.warn(
          "[luwas] Firebase web config looks like a placeholder. Check NEXT_PUBLIC_FIREBASE_* build env.",
        );
      }
    }
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

const SECONDARY_AUTH_NAME = "luwas-secondary";
let secondaryAuthConnected = false;

/**
 * Separate Auth instance so a captain can create officer logins
 * without replacing their own signed-in session.
 */
export function getSecondaryAuth(): Auth {
  getFirebaseApp();
  let secondaryApp: FirebaseApp;
  try {
    secondaryApp = getApp(SECONDARY_AUTH_NAME);
  } catch {
    secondaryApp = initializeApp(firebaseConfig, SECONDARY_AUTH_NAME);
  }
  const secondary = getAuth(secondaryApp);
  if (
    useEmulators &&
    !secondaryAuthConnected &&
    typeof window !== "undefined"
  ) {
    connectAuthEmulator(secondary, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    secondaryAuthConnected = true;
  }
  return secondary;
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
