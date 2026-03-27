// src/components/LoginPage.jsx
import React, { useState } from "react";
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { googleLogin } from "../firebaseAuth";

const TABS = ["login", "signup", "forgot"];

const LoginPage = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  function clearForm() {
    setEmail("");
    setPassword("");
    setName("");
    setError("");
    setResetSent(false);
  }

  function switchTab(tab) {
    setActiveTab(tab);
    clearForm();
  }

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const { user } = await googleLogin();
      onLoginSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Full name is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setError("");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Wait for the profile update to finish
      await updateProfile(userCredential.user, { displayName: name.trim() });
      // Force reload the user object so the new displayName is immediately available
      await auth.currentUser.reload();
      onLoginSuccess(auth.currentUser);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (!resetEmail || !validateEmail(resetEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase());
  }

  return (
    <div>
      <header>
        <div className="nav-inner container">
          <div className="logo" aria-label="ChatApp Logo">BOLO</div>
          <nav aria-label="Primary Navigation">
            <ul>
              <li><a href="#login" onClick={(e) => { e.preventDefault(); switchTab("login"); }}>Login</a></li>
              <li><a href="#signup" onClick={(e) => { e.preventDefault(); switchTab("signup"); }}>Sign Up</a></li>
              <li><a href="#forgot" onClick={(e) => { e.preventDefault(); switchTab("forgot"); }}>Forgot Password</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero container" aria-label="Application Hero">
          <h1>Connect instantly with your friends and family</h1>
          <p>Join Bolo, the secure and intuitive chat platform designed for seamless communication.</p>
          <button
            className="cta-btn"
            onClick={() => switchTab("login")}
            aria-controls="forms"
          >
            Get Started
          </button>
        </section>

        <section className="forms" id="forms" aria-live="polite" aria-label="User Authentication Forms">
          {/* Tab Navigation */}
          <nav className="form-tabs" role="tablist" aria-label="Login and Signup Tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`form-tab${activeTab === tab ? " active" : ""}`}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => switchTab(tab)}
              >
                {tab === "login" ? "Login" : tab === "signup" ? "Sign Up" : "Forgot Password"}
              </button>
            ))}
          </nav>

          {/* Login Form */}
          {activeTab === "login" && (
            <form id="login" role="tabpanel" aria-labelledby="tab-login" noValidate onSubmit={handleEmailLogin}>
              <label htmlFor="login-email">Email</label>
              <input
                type="email" id="login-email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="username"
              />
              <label htmlFor="login-password">Password</label>
              <input
                type="password" id="login-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password" required autoComplete="current-password"
              />
              {error && <p className="error">{error}</p>}
              <div className="form-actions">
                <a href="#" onClick={(e) => { e.preventDefault(); switchTab("forgot"); }}>
                  Forgot password?
                </a>
              </div>
              <button type="submit" disabled={loading}>
                {loading ? "Logging in…" : "Login"}
              </button>
              <button type="button" className="google-login" onClick={handleGoogleLogin} disabled={loading}>
                Login with Google
              </button>
            </form>
          )}

          {/* Signup Form */}
          {activeTab === "signup" && (
            <form id="signup" role="tabpanel" aria-labelledby="tab-signup" noValidate onSubmit={handleSignup}>
              <label htmlFor="signup-name">Full Name</label>
              <input
                type="text" id="signup-name" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Full Name" required autoComplete="name"
              />
              <label htmlFor="signup-email">Email</label>
              <input
                type="email" id="signup-email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="email"
              />
              <label htmlFor="signup-password">Password</label>
              <input
                type="password" id="signup-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password (6+ characters)" required autoComplete="new-password"
              />
              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={loading}>
                {loading ? "Creating account…" : "Sign Up"}
              </button>
              <button type="button" className="google-login" onClick={handleGoogleLogin} disabled={loading}>
                Sign Up with Google
              </button>
            </form>
          )}

          {/* Forgot Password Form */}
          {activeTab === "forgot" && (
            <form id="forgot" role="tabpanel" aria-labelledby="tab-forgot" noValidate onSubmit={handleForgotPassword}>
              <label htmlFor="forgot-email">Email</label>
              <input
                type="email" id="forgot-email" value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="email"
              />
              {error && <p className="error">{error}</p>}
              {resetSent && (
                <p style={{ color: "#34c759", fontWeight: "600" }}>
                  ✅ Reset email sent! Check your inbox.
                </p>
              )}
              <button type="submit" disabled={loading}>
                {loading ? "Sending…" : "Reset Password"}
              </button>
              <button
                type="button"
                className="google-login"
                onClick={() => switchTab("login")}
              >
                Back to Login
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};

export default LoginPage;