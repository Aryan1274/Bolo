   // src/pages/LoginPage.jsx
   import React, { useState, useEffect } from 'react';
   import './LoginPage.css';
   import { auth } from '../firebase';
   import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, fetchSignInMethodsForEmail } from "firebase/auth";
   import { googleLogin } from '../firebaseAuth'; // Import googleLogin
   import { loginToBackend } from '../utils/api';


   const LoginPage = ({ onLoginSuccess, onSignupSuccess }) => {
       const [email, setEmail] = useState("");
       const [password, setPassword] = useState("");
       const [name, setName] = useState("");
       const [error, setError] = useState("");
       const [resetEmail, setResetEmail] = useState(""); // State for reset email

       useEffect(() => {
           const tabs = document.querySelectorAll('.form-tab');
           const forms = document.querySelectorAll('form[role="tabpanel"]');
           const navLinks = document.querySelectorAll('header nav a');

           function activateTab(newActiveTab) {
               tabs.forEach((tab, i) => {
                   const isActive = tab === newActiveTab;
                   tab.classList.toggle('active', isActive);
                   tab.setAttribute('aria-selected', isActive);
                   tab.setAttribute('tabindex', isActive ? '0' : '-1');
                   forms[i].classList.toggle('active', isActive);
               });
               const activeForm = document.querySelector('form.active');
               if (activeForm) {
                   const firstInput = activeForm.querySelector('input');
                   if (firstInput) firstInput.focus();
               }
           }

           tabs.forEach(tab => {
               tab.addEventListener('click', () => {
                   activateTab(tab);
               });
               tab.addEventListener('keydown', e => {
                   if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                       e.preventDefault();
                       let idx = Array.from(tabs).indexOf(tab);
                       if (e.key === 'ArrowRight') idx = (idx + 1) % tabs.length;
                       else idx = (idx - 1 + tabs.length) % tabs.length;
                       tabs[idx].focus();
                       activateTab(tabs[idx]);
                   }
               });
           });

           navLinks.forEach(link => {
               link.addEventListener('click', e => {
                   e.preventDefault();
                   const targetId = link.getAttribute('href').substring(1);
                   const targetTab = Array.from(tabs).find(t => t.getAttribute('aria-controls') === targetId);
                   if (targetTab) {
                       activateTab(targetTab);
                       window.scrollTo({ top: document.getElementById('forms').offsetTop - 20, behavior: 'smooth' });
                   }
               });
           });

           document.getElementById('start-btn').addEventListener('click', () => {
               activateTab(tabs[0]);
               window.scrollTo({ top: document.getElementById('forms').offsetTop - 20, behavior: 'smooth' });
           });

           document.getElementById('to-forgot-link').addEventListener('click', e => {
               e.preventDefault();
               const forgotTab = Array.from(tabs).find(t => t.id === 'tab-forgot');
               if (forgotTab) activateTab(forgotTab);
               window.scrollTo({ top: document.getElementById('forms').offsetTop - 20, behavior: 'smooth' });
           });
       }, []);

       const handleGoogleLogin = async () => {
           try {
               const { user, username } = await googleLogin();
               alert(`Welcome back, ${username}!`);
               onLoginSuccess(user); // Pass the user object to the parent component
               window.location.href = "mes.html"; // Redirect after successful login
           } catch (err) {
               setError(err.message);
           }
       };

       const handleEmailPasswordLogin = async () => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // 🔐 Optional: Get Firebase ID token
    const token = await user.getIdToken();

    // 🧠 Call your backend
    const res = await loginToBackend({
      email: user.email,
      uid: user.uid,
      token: token, // optional
    });

    console.log("Backend response:", res);
    onLoginSuccess(user); // Your existing logic
  } catch (err) {
    setError(err.message);
  }
};


       const handleSignup = async () => {
           try {
               const userCredential = await createUserWithEmailAndPassword(auth, email, password);
               await updateProfile(userCredential.user, { displayName: name });
               onSignupSuccess(userCredential.user);
               activateTab(document.getElementById('tab-login'));
           } catch (err) {
               setError(err.message);
           }
       };

       const handleForgotPassword = (e) => {
           e.preventDefault();
           const forgotEmail = document.getElementById("forgot-email").value.trim();

           if (!forgotEmail || !validateEmail(forgotEmail)) {
               setError("Please enter a valid email address for password reset.");
               return;
           }

           fetchSignInMethodsForEmail(auth, forgotEmail)
               .then((signInMethods) => {
                   if (signInMethods.length === 0) {
                       setError("Account not found. Would you like to create a new account?");
                       // Optionally, redirect to signup page here
                   } else {
                       sendPasswordResetEmail(auth, forgotEmail)
                           .then(() => {
                               alert("Password reset email sent successfully. Please check your inbox!");
                               activateTab(document.getElementById('tab-login')); // Switch back to login tab
                           })
                           .catch((error) => {
                               setError("Error sending reset email: " + error.message);
                           });
               }
           })
               .catch((error) => {
                   setError("Error checking email: " + error.message);
               });
       };

       // Function to validate email format
       function validateEmail(email) {
           const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
           return re.test(String(email).toLowerCase());
       }

       return (
           <div>
               <header>
                   <div className="nav-inner container">
                       <div className="logo" aria-label="ChatApp Logo">BOLO</div>
                       <nav aria-label="Primary Navigation">
                           <ul>
                               <li><a href="#login" tabIndex="0">Login</a></li>
                               <li><a href="#signup" tabIndex="0">Sign Up</a></li>
                               <li><a href="#forgot" tabIndex="0">Forgot Password</a></li>
                           </ul>
                       </nav>
                   </div>
               </header>
               <main>
                   <section className="hero container" aria-label="Application Hero">
                       <h1>Connect instantly with your friends and family</h1>
                       <p>Join ChatApp, the secure and intuitive chat platform designed for seamless communication.</p>
                       <button className="cta-btn" id="start-btn" aria-controls="forms" aria-haspopup="true">Get Started</button>
                   </section>

                   <section className="forms" id="forms" aria-live="polite" aria-label="User Authentication Forms">
                       <nav className="form-tabs" role="tablist" aria-label="Login and Signup Tabs">
                           <button className="form-tab active" role="tab" aria-selected="true" aria-controls="login" id="tab-login" tabIndex="0">Login</button>
                           <button className="form-tab" role="tab" aria-selected="false" aria-controls="signup" id="tab-signup" tabIndex="-1">Sign Up</button>
                           <button className="form-tab" role="tab" aria-selected="false" aria-controls="forgot" id="tab-forgot" tabIndex="-1">Forgot Password</button>
                       </nav>

                       <form id="login" className="active" role="tabpanel" aria-labelledby="tab-login" tabIndex="0" noValidate onSubmit={(e) => { e.preventDefault(); handleEmailPasswordLogin(); }}>
                           <label htmlFor="login-email">Email</label>
                           <input type="email" id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} name="email" placeholder="you@example.com" required autoComplete="username" />
                           <label htmlFor="login-password">Password</label>
                           <input type="password" id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} name="password" placeholder="Your password" required autoComplete="current-password" />
                           {error && document.querySelector('form.active')?.id === 'login' && <p className="error">{error}</p>}
                           <div className="form-actions">
                               <a href="#" id="to-forgot-link">Forgot password?</a>
                           </div>
                           <button type="submit">Login</button>
                           <button type="button" className="google-login" onClick={handleGoogleLogin}>Login with Google</button>
                       </form>

                       <form id="signup" role="tabpanel" aria-labelledby="tab-signup" tabIndex="0" noValidate onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
                           <label htmlFor="signup-name">Full Name</label>
                           <input type="text" id="signup-name" value={name} onChange={(e) => setName(e.target.value)} name="name" placeholder="Your Full Name" required autoComplete="name" />
                           <label htmlFor="signup-email">Email</label>
                           <input type="email" id="signup-email" value={email} onChange={(e) => setEmail(e.target.value)} name="email" placeholder="you@example.com" required autoComplete="email" />
                           <label htmlFor="signup-password">Password</label>
                           <input type="password" id="signup-password" value={password} onChange={(e) => setPassword(e.target.value)} name="password" placeholder="Create a password" required autoComplete="new-password" />
                           {error && document.querySelector('form.active')?.id === 'signup' && <p className="error">{error}</p>}
                           <button type="submit">Sign Up</button>
                           <button type="button" className="google-login" onClick={handleGoogleLogin}>Sign Up with Google</button>
                       </form>

                       <form id="forgot" role="tabpanel" aria-labelledby="tab-forgot" tabIndex="0" noValidate onSubmit={handleForgotPassword}>
                           <label htmlFor="forgot-email">Email</label>
                           <input type="email" id="forgot-email" name="email" placeholder="you@example.com" required autoComplete="email" />
                           {error && document.querySelector('form.active')?.id === 'forgot' && <p className="error">{error}</p>}
                           <button type="submit">Reset Password</button>
                       </form>
                   </section>
               </main>
           </div>
       );
   };

   export default LoginPage;
   