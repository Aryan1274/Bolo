import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();


export const googleLogin = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if the user document exists in Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            // If the user document does not exist, prompt for a username
            let username;
            do {
                username = prompt("Please set a unique username (minimum 4 characters):");
            } while (!username || !validateUsername(username) || !(await checkUsername(username)));

            // Store the user information in Firestore
            await setDoc(doc(db, "users", user.uid), {
                username: username,
                email: user.email,
                displayName: user.displayName
            });

            alert("Username set successfully!");
        } else {
            const userData = userDoc.data();
            alert(`Welcome back, ${userData.username}!`);
        }

        // Redirect to chat page or another page
        window.location.href = "/App"; // Change this to your chat page route
    } catch (error) {
        console.error("Error during Google login:", error);
        alert("Error: " + error.message);
    }
};

// Function to validate username
function validateUsername(username) {
    const minLength = 4;
    const startsWithValidChar = /^[a-zA-Z0-9]/; // Starts with a letter or number
    const alphabeticCount = (username.match(/[a-zA-Z]/g) || []).length; // Count alphabetic characters

    return username.length >= minLength && 
           startsWithValidChar.test(username) && 
           alphabeticCount >= 2; // At least two alphabetic characters
}

// Function to check if the username is available
async function checkUsername(username) {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));

    try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            alert("This username is already taken. Please try another one.");
            return false; // Username is taken
        }
        return true; // Username is available
    } catch (error) {
        console.error("Error checking username:", error);
        return false; // Handle error appropriately
    }
}
