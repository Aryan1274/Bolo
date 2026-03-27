// src/firebaseAuth.js
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "./firebase"; 

const provider = new GoogleAuthProvider();

export const googleLogin = async () => {
  const result = await signInWithPopup(auth, provider);
  return { user: result.user };
};
