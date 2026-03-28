import { auth } from "./firebase.js";
import { db } from "./firebase.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ─────────────────────────────────────────────
   Verify secret code from Firestore
───────────────────────────────────────────── */
async function verifySecretCode(enteredCode) {
  const snap = await getDoc(doc(db, "config", "college"));
  if (!snap.exists()) return false;
  return enteredCode === snap.data().secretCode;
}

/* ─────────────────────────────────────────────
   Toast notification
───────────────────────────────────────────── */
function showToast(message, type) {
  var existing = document.getElementById("rg-toast");
  if (existing) existing.remove();

  var toast = document.createElement("div");
  toast.id = "rg-toast";
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
    "max-width: 400px",
    "width: calc(100vw - 48px)",
    "border: 1.5px solid " + (type === "error" ? "#fecaca" : type === "success" ? "#bbf7d0" : "#fed7aa"),
    "opacity: 0",
    "transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
    "pointer-events: none"
  ].join(";");

  var bar = document.createElement("div");
  bar.style.cssText = [
    "position: absolute",
    "left: 0", "top: 0", "bottom: 0",
    "width: 4px",
    "border-radius: 12px 0 0 12px",
    "background: " + (type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#f6ab3b")
  ].join(";");

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
    "font-weight: 700",
    "background: " + (type === "error" ? "#fee2e2" : type === "success" ? "#dcfce7" : "#fff7ed"),
    "color: "        + (type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#f6ab3b")
  ].join(";");
  icon.textContent = type === "error" ? "✕" : type === "success" ? "✓" : "!";

  var text = document.createElement("span");
  text.textContent = message;
  text.style.flex = "1";
  text.style.lineHeight = "1.45";

  toast.appendChild(bar);
  toast.appendChild(icon);
  toast.appendChild(text);
  document.body.appendChild(toast);

  requestAnimationFrame(function () {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });

  var duration = type === "success" ? 2500 : 4000;
  setTimeout(function () {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(-10px)";
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
  }, duration);
}

/* ─────────────────────────────────────────────
   Field error helpers
───────────────────────────────────────────── */
function setFieldError(inputId, message) {
  var input = document.getElementById(inputId);
  if (!input) return;

  input.style.borderColor = "#f87171";
  input.style.background  = "#fff5f5";

  input.classList.remove("rg-shake");
  void input.offsetWidth;
  input.classList.add("rg-shake");

  var errorBox = document.getElementById("regError");
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.classList.add("rg-visible");
  }

  input.focus();

  setTimeout(function () {
    input.classList.remove("rg-shake");
  }, 500);
}

function clearFieldError(inputId) {
  var input = document.getElementById(inputId);
  if (!input) return;
  input.style.borderColor = "";
  input.style.background  = inputId === "secretCode" ? "#fff7ea" : "#f6f8fb";
}

function clearAllErrors() {
  ["fullname", "regEmail", "regPassword", "confirmPassword", "secretCode"].forEach(clearFieldError);
  var errorBox = document.getElementById("regError");
  if (errorBox) {
    errorBox.textContent = "";
    errorBox.classList.remove("rg-visible");
  }
}

/* ─────────────────────────────────────────────
   Shake the card
───────────────────────────────────────────── */
function shakeCard() {
  var card = document.querySelector(".login-card");
  if (!card) return;
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "fp-shake 0.4s ease";
  setTimeout(function () { card.style.animation = ""; }, 500);
}

/* ─────────────────────────────────────────────
   Firebase error → readable message
───────────────────────────────────────────── */
function getFirebaseError(code) {
  var map = {
    "auth/email-already-in-use":       "An account with this email already exists. Try logging in instead.",
    "auth/invalid-email":              "That doesn't look like a valid email address.",
    "auth/weak-password":              "Password is too weak. Use at least 6 characters.",
    "auth/operation-not-allowed":      "Email registration is not enabled. Contact your administrator.",
    "auth/network-request-failed":     "No internet connection. Check your network and try again.",
    "auth/too-many-requests":          "Too many attempts. Please wait a moment and try again.",
    "auth/internal-error":             "Something went wrong. Please try again.",
    "auth/admin-restricted-operation": "Registration is restricted. Contact your administrator.",
  };
  return map[code] || "Registration failed. Please try again.";
}

/* ─────────────────────────────────────────────
   Client-side validation (sync — no Firestore)
───────────────────────────────────────────── */
function validateSync() {
  clearAllErrors();

  var name     = document.getElementById("fullname").value.trim();
  var email    = document.getElementById("regEmail").value.trim();
  var password = document.getElementById("regPassword").value;
  var confirm  = document.getElementById("confirmPassword").value;

  if (name.length < 3) {
    setFieldError("fullname", "Please enter your full name (at least 3 characters).");
    showToast("Please enter your full name.", "error");
    shakeCard();
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError("regEmail", "Please enter a valid email address.");
    showToast("That doesn't look like a valid email address.", "error");
    shakeCard();
    return false;
  }

  if (password.length < 6) {
    setFieldError("regPassword", "Password must be at least 6 characters.");
    showToast("Password must be at least 6 characters.", "error");
    shakeCard();
    return false;
  }

  if (password !== confirm) {
    setFieldError("confirmPassword", "Passwords do not match.");
    showToast("Passwords do not match. Please re-enter.", "error");
    shakeCard();
    return false;
  }

  return true;
}

/* ─────────────────────────────────────────────
   Password strength meter
───────────────────────────────────────────── */
window.checkStrength = function (val) {
  var fill = document.getElementById("strengthFill");
  var text = document.getElementById("strengthText");
  if (!fill || !text) return;

  var score = 0;
  if (val.length >= 6)            score++;
  if (val.length >= 10)           score++;
  if (/[A-Z]/.test(val))         score++;
  if (/[0-9]/.test(val))         score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  var levels = [
    { w: "0%",   c: "#eee",    t: "" },
    { w: "25%",  c: "#f87171", t: "Weak" },
    { w: "50%",  c: "#fb923c", t: "Fair" },
    { w: "75%",  c: "#facc15", t: "Good" },
    { w: "90%",  c: "#4ade80", t: "Strong" },
    { w: "100%", c: "#22c55e", t: "Very Strong" },
  ];

  var s = levels[Math.min(score, 5)];
  fill.style.width      = s.w;
  fill.style.background = s.c;
  text.textContent      = s.t;
  text.style.color      = score > 2 ? s.c : "#aaa";
};

/* ─────────────────────────────────────────────
   Toggle password visibility
───────────────────────────────────────────── */
window.togglePass = function (inputId, btn) {
  var input    = document.getElementById(inputId);
  var isHidden = input.type === "password";
  input.type   = isHidden ? "text" : "password";
  btn.querySelector(".eye-icon").innerHTML = isHidden
    ? '<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>'
    : '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
};

/* ─────────────────────────────────────────────
   Success screen
───────────────────────────────────────────── */
function showSuccessScreen(name) {
  var card = document.querySelector(".login-card");
  card.innerHTML =
    '<div class="rg-success-wrap">' +
      '<div class="rg-success-icon">' +
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">' +
          '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>' +
        '</svg>' +
      '</div>' +
      '<h2>Account Created!</h2>' +
      '<p>Welcome, <strong>' + name + '</strong>!<br>Your college account has been registered successfully.<br>You can now log in.</p>' +
      '<a href="login.html"><button class="btn-login" style="margin-top:22px;width:100%;">Go to Login</button></a>' +
    '</div>';
}

/* ─────────────────────────────────────────────
   MAIN SUBMIT HANDLER
   Flow: sync validate → verify Firestore secret → create account
───────────────────────────────────────────── */
document.querySelector("form.login-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  // ── Step 1: sync checks (name, email, password, confirm) ──
  if (!validateSync()) return;

  var name     = document.getElementById("fullname").value.trim();
  var email    = document.getElementById("regEmail").value.trim();
  var password = document.getElementById("regPassword").value;
  var secret   = document.getElementById("secretCode").value.trim();

  // ── Step 2: show loading ──
  var btn = document.querySelector(".btn-login");
  var originalText = btn.textContent;
  btn.textContent   = "Verifyin College Secret Code";
  btn.disabled      = true;
  btn.style.opacity = "0.75";
  btn.style.cursor  = "not-allowed";

  // ── Step 3: check secret code against Firestore ──
  try {
    var isValid = await verifySecretCode(secret);

    if (!isValid) {
      btn.textContent   = originalText;
      btn.disabled      = false;
      btn.style.opacity = "";
      btn.style.cursor  = "";

      setFieldError("secretCode", "Invalid college secret code.");
      showToast("Invalid college secret code. Contact your administrator.", "warning");
      shakeCard();
      return;
    }

  } catch (err) {
    btn.textContent   = originalText;
    btn.disabled      = false;
    btn.style.opacity = "";
    btn.style.cursor  = "";

    showToast("Could not verify secret code. Check your connection and try again.", "error");
    shakeCard();
    return;
  }

  // ── Step 4: create Firebase Auth account ──
  btn.textContent = "Creating account…";

  try {
    var userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(userCredential.user, { displayName: name });

    console.log("Registration successful:", userCredential.user.email);

    showToast("Account created successfully!", "success");

    setTimeout(function () {
      showSuccessScreen(name);
    }, 1200);

  } catch (error) {
    console.error("Registration error:", error.code, error.message);

    btn.textContent   = originalText;
    btn.disabled      = false;
    btn.style.opacity = "";
    btn.style.cursor  = "";

    var message = getFirebaseError(error.code);

    if (error.code === "auth/email-already-in-use" || error.code === "auth/invalid-email") {
      setFieldError("regEmail", message);
    } else if (error.code === "auth/weak-password") {
      setFieldError("regPassword", message);
    } else {
      var errorBox = document.getElementById("regError");
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.classList.add("rg-visible");
      }
    }

    showToast(message, "error");
    shakeCard();
  }
});

/* ─────────────────────────────────────────────
   Clear errors on input focus
───────────────────────────────────────────── */
["fullname", "regEmail", "regPassword", "confirmPassword", "secretCode"].forEach(function (id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("focus", function () {
    clearFieldError(id);
    var errorBox = document.getElementById("regError");
    if (errorBox) {
      errorBox.textContent = "";
      errorBox.classList.remove("rg-visible");
    }
  });
});