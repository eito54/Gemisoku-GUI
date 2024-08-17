import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_API_FIRE_BASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_API_FIRE_BASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_API_FIRE_BASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_API_FIRE_BASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_API_FIRE_BASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_API_FIRE_BASE_APP_ID
};

initializeApp(firebaseConfig);
export const storage = getStorage();
