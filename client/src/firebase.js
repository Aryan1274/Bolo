import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, setPersistence, inMemoryPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDE5ncnpdyQlNYLMkN1-ssMYtyECn3pTPg",
  authDomain: "chat-app-4e399.firebaseapp.com",
  databaseURL: "https://chat-app-4e399-default-rtdb.firebaseio.com",
  projectId: "chat-app-4e399",
  storageBucket: "chat-app-4e399.firebasestorage.app",
  messagingSenderId: "320501109989",
  appId: "1:320501109989:web:c23a85eeaf17fb5c65300c",
  measurementId: "G-QWBFKSV6YK"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

setPersistence(auth, inMemoryPersistence).catch((error) => {
  console.error("❌ Firebase persistence error:", error);
});

export { db, auth };
