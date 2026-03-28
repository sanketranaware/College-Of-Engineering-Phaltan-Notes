import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

/* ── Toast notification system ── */
function showToast(message, type) {
  // Remove any existing toast
  var existing = document.getElementById("login-toast");
  if (existing) existing.remove();

  var toast = document.createElement("div");
  toast.id = "login-toast";
  toast.style.cssText = [
    "position: fixed",
    "top: 24px",
    "left: 50%",
    "transform: translateX(-50%) translateY(-12px)",
    "background: #fff",
    "border-radius: 12px",
    "padding: 14px 20px",
    "display: flex",
    "align-items: center",
    "gap: 12px",
    "font-family: Poppins, sans-serif",
    "font-size: 0.87rem",
    "font-weight: 500",
    "color: #1c1c1e",
    "box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
    "z-index: 9999",
    "max-width: 380px",
    "width: calc(100vw - 48px)",
    "border: 1.5px solid " + (type === "error" ? "#fecaca" : type === "success" ? "#bbf7d0" : "#fed7aa"),
    "opacity: 0",
    "transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
    "pointer-events: none"
  ].join(";");

  // Icon
  var icon = document.createElement("div");
  icon.style.cssText = [
    "width: 32px",
    "height: 32px",
    "border-radius: 8px",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "font-size: 0.95rem",
    "flex-shrink: 0",
    "background: " + (type === "error" ? "#fee2e2" : type === "success" ? "#dcfce7" : "#fff7ed")
  ].join(";");

  icon.textContent = type === "error" ? "✕" : type === "success" ? "✓" : "!";
  icon.style.color = type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#f6ab3b";
  icon.style.fontWeight = "700";

  // Text
  var text = document.createElement("span");
  text.textContent = message;
  text.style.flex = "1";
  text.style.lineHeight = "1.45";

  // Left accent bar
  var bar = document.createElement("div");
  bar.style.cssText = [
    "position: absolute",
    "left: 0", "top: 0", "bottom: 0",
    "width: 4px",
    "border-radius: 12px 0 0 12px",
    "background: " + (type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#f6ab3b")
  ].join(";");

  toast.style.position = "fixed"; // ensure positioning context
  toast.appendChild(bar);
  toast.appendChild(icon);
  toast.appendChild(text);
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(function () {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });

  // Auto dismiss
  var duration = type === "error" ? 4000 : 2500;
  setTimeout(function () {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(-10px)";
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
  }, duration);
}

/* ── Shake the login card ── */
function shakeCard() {
  var card = document.querySelector(".login-card");
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "fp-shake 0.4s ease";
  setTimeout(function () { card.style.animation = ""; }, 500);
}

/* ── Highlight a specific input ── */
function highlightInput(id) {
  var input = document.getElementById(id);
  if (!input) return;
  input.style.borderColor = "#f87171";
  input.style.background = "#fff5f5";
  input.focus();
  setTimeout(function () {
    input.style.borderColor = "";
    input.style.background = "#f6f8fb";
  }, 3000);
}

/* ── Map Firebase error codes → human messages ── */
function getErrorMessage(code) {
  var messages = {
    "auth/invalid-email":
      "That doesn't look like a valid email address.",
    "auth/user-not-found":
      "No account found with this email. Please register first.",
    "auth/wrong-password":
      "Incorrect password. Please try again.",
    "auth/invalid-credential":
      "Email or password is incorrect.",
    "auth/user-disabled":
      "This account has been disabled. Contact your administrator.",
    "auth/too-many-requests":
      "Too many failed attempts. Please wait a moment and try again.",
    "auth/network-request-failed":
      "No internet connection. Check your network and try again.",
    "auth/operation-not-allowed":
      "Email sign-in is not enabled. Contact your administrator.",
    "auth/internal-error":
      "Something went wrong on our end. Please try again.",
    "auth/email-already-in-use":
      "This email is already registered.",
    "auth/weak-password":
      "Password should be at least 6 characters.",
    "auth/popup-closed-by-user":
      "Sign-in popup was closed before completing.",
    "auth/cancelled-popup-request":
      "Only one sign-in popup is allowed at a time.",
    "auth/requires-recent-login":
      "Please log out and log back in to continue.",
    "auth/account-exists-with-different-credential":
      "An account already exists with the same email but different sign-in method.",
  };

  return messages[code] || "Something went wrong. Please try again.";
}

/* ── Main login handler ── */
document.querySelector(".btn-login").addEventListener("click", async function (e) {
  e.preventDefault();

  var email    = document.getElementById("username").value.trim();
  var password = document.getElementById("password").value;

  // ── Client-side checks before hitting Firebase ──
  if (!email) {
    highlightInput("username");
    showToast("Please enter your email address.", "error");
    shakeCard();
    return;
  }

  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    highlightInput("username");
    showToast("That doesn't look like a valid email address.", "error");
    shakeCard();
    return;
  }

  if (!password) {
    highlightInput("password");
    showToast("Please enter your password.", "error");
    shakeCard();
    return;
  }

  // ── Loading state ──
  var btn = document.querySelector(".btn-login");
  var originalText = btn.textContent;
  btn.textContent = "Logging in…";
  btn.disabled = true;
  btn.style.opacity = "0.75";
  btn.style.cursor = "not-allowed";

  try {
    var userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Login successful:", userCredential.user.email);

    // Store session
    sessionStorage.setItem("user", userCredential.user.email);
    sessionStorage.setItem("uid",  userCredential.user.uid);

    showToast("Login successful! Redirecting…", "success");

    setTimeout(function () {
      window.location.href = "teacher-dashboard.html";
    }, 1000);

  } catch (error) {
    console.error("Login error:", error.code, error.message);

    // Reset button
    btn.textContent = originalText;
    btn.disabled = false;
    btn.style.opacity = "";
    btn.style.cursor = "";

    var message = getErrorMessage(error.code);

    // Highlight relevant input based on error
    if (
      error.code === "auth/invalid-email" ||
      error.code === "auth/user-not-found"
    ) {
      highlightInput("username");
    } else if (error.code === "auth/wrong-password") {
      highlightInput("password");
    } else if (error.code === "auth/invalid-credential") {
      highlightInput("username");
      highlightInput("password");
    }

    showToast(message, "error");
    shakeCard();
  }
});

/* ── Clear input highlight on focus ── */
["username", "password"].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) {
    el.addEventListener("focus", function () {
      this.style.borderColor = "";
      this.style.background  = "#f6f8fb";
    });
  }
});