import { getFreshFirebaseIdToken } from "./firebaseAuth";

const FIREBASE_SDK_VERSION = "12.14.0";

type UploadProgress = {
  bytesTransferred: number;
  totalBytes: number;
};

type UploadOptions = {
  contentType: string;
  cacheControl?: string;
  onProgress?: (progress: UploadProgress) => void;
};

type FirebaseStorageSdk = {
  initializeApp: (config: Record<string, string>) => unknown;
  getApps: () => unknown[];
  getApp: () => unknown;
  getStorage: (app?: unknown, bucketUrl?: string) => unknown;
  ref: (storage: unknown, path: string) => unknown;
  uploadBytesResumable: (
    ref: unknown,
    data: Blob,
    metadata: { contentType: string; cacheControl?: string },
  ) => {
    on: (
      event: "state_changed",
      next: (snapshot: UploadProgress) => void,
      error: (error: Error) => void,
      complete: () => void,
    ) => void;
  };
  getDownloadURL: (ref: unknown) => Promise<string>;
};

let sdkPromise: Promise<FirebaseStorageSdk> | null = null;
let storageInstance: unknown | null = null;

function getFirebaseConfig() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Firebase storage is missing config: ${missing.join(", ")}`);
  }

  return config as Record<string, string>;
}

async function loadFirebaseStorageSdk(): Promise<FirebaseStorageSdk> {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-storage.js`),
    ]).then(([app, storage]) => ({ ...app, ...storage }) as FirebaseStorageSdk);
  }
  return sdkPromise;
}

async function getFirebaseStorage() {
  if (storageInstance) return storageInstance;
  const sdk = await loadFirebaseStorageSdk();
  const app = sdk.getApps().length > 0 ? sdk.getApp() : sdk.initializeApp(getFirebaseConfig());
  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  storageInstance = sdk.getStorage(app, bucket ? `gs://${bucket}` : undefined);
  return storageInstance;
}

function storageRef(sdk: FirebaseStorageSdk, storage: unknown, path: string) {
  return sdk.ref(storage, path.replace(/^\/+/, ""));
}

export async function uploadFirebaseStorageObject(
  path: string,
  data: Blob,
  options: UploadOptions,
): Promise<void> {
  await getFreshFirebaseIdToken();
  const sdk = await loadFirebaseStorageSdk();
  const storage = await getFirebaseStorage();
  const task = sdk.uploadBytesResumable(storageRef(sdk, storage, path), data, {
    contentType: options.contentType,
    cacheControl: options.cacheControl,
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => options.onProgress?.({
        bytesTransferred: snapshot.bytesTransferred,
        totalBytes: snapshot.totalBytes,
      }),
      reject,
      resolve,
    );
  });
}

export async function getFirebaseStorageDownloadUrl(path: string): Promise<string> {
  await getFreshFirebaseIdToken();
  const sdk = await loadFirebaseStorageSdk();
  const storage = await getFirebaseStorage();
  return sdk.getDownloadURL(storageRef(sdk, storage, path));
}

export function resetFirebaseStorageForTests() {
  sdkPromise = null;
  storageInstance = null;
}

export function setFirebaseStorageSdkLoaderForTests(
  loader: () => Promise<FirebaseStorageSdk>,
) {
  sdkPromise = loader();
  storageInstance = null;
}
