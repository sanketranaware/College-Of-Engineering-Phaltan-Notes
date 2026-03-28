import { auth } from "./firebase.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

/* ─────────────────────────────────────────────
   Toast notification (same system as login.js)
───────────────────────────────────────────── */
function showToast(message, type) {
  var existing = document.getElementById("fp-toast");
  if (existing) existing.remove();

  var toast = document.createElement("div");
  toast.id = "fp-toast";
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

  var duration = type === "success" ? 3000 : 4000;
  setTimeout(function () {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(-10px)";
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
  }, duration);
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
   Highlight input on error
───────────────────────────────────────────── */
function highlightInput(id) {
  var input = document.getElementById(id);
  if (!input) return;
  input.style.borderColor = "#f87171";
  input.style.background  = "#fff5f5";
  input.focus();

  // Apply shake animation
  input.classList.remove("fp-shake");
  void input.offsetWidth;
  input.classList.add("fp-shake");
  setTimeout(function () {
    input.classList.remove("fp-shake");
  }, 500);
}

function clearInputHighlight(id) {
  var input = document.getElementById(id);
  if (!input) return;
  input.style.borderColor = "";
  input.style.background  = "#f6f8fb";
}

/* ─────────────────────────────────────────────
   Firebase error → readable message
───────────────────────────────────────────── */
function getErrorMessage(code) {
  var map = {
    "auth/invalid-email":          "That doesn't look like a valid email address.",
    "auth/user-not-found":         "No account found with this email address.",
    "auth/missing-email":          "Please enter your email address.",
    "auth/too-many-requests":      "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "No internet connection. Check your network and try again.",
    "auth/internal-error":         "Something went wrong. Please try again.",
    "auth/invalid-continue-uri":   "Invalid redirect URL. Contact your administrator.",
    "auth/unauthorized-continue-uri": "The redirect domain is not authorised. Contact your administrator.",
  };
  return map[code] || "Failed to send reset email. Please try again.";
}

/* ─────────────────────────────────────────────
   Switch to sent view
───────────────────────────────────────────── */
function showSentView(email) {
  document.getElementById("emailView").style.display = "none";
  document.getElementById("emailDisplay").textContent = email;
  document.getElementById("sentView").style.display  = "block";
  startCooldown(30);
}

/* ─────────────────────────────────────────────
   Resend cooldown timer
───────────────────────────────────────────── */
var cooldownTimer = null;

function startCooldown(seconds) {
  var btn = document.getElementById("resendBtn");
  if (!btn) return;

  btn.style.pointerEvents = "none";
  btn.style.color         = "#bbb";
  var t = seconds;
  btn.textContent = "Resend in " + t + "s";

  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(function () {
    t--;
    if (t <= 0) {
      clearInterval(cooldownTimer);
      btn.textContent         = "Resend email";
      btn.style.pointerEvents = "";
      btn.style.color         = "";
    } else {
      btn.textContent = "Resend in " + t + "s";
    }
  }, 1000);
}

/* ─────────────────────────────────────────────
   Resend handler
───────────────────────────────────────────── */
window.doResend = async function () {
  var email = document.getElementById("emailDisplay").textContent.trim();
  if (!email || email === "—") return;

  var btn = document.getElementById("resendBtn");
  btn.style.pointerEvents = "none";
  btn.textContent         = "Sending…";

  try {
    await sendPasswordResetEmail(auth, email);
    btn.textContent = "Sent ✓";
    btn.style.color = "#22c55e";
    showToast("Reset link resent to " + email, "success");

    setTimeout(function () {
      btn.style.color = "";
      startCooldown(30);
    }, 1500);

  } catch (error) {
    console.error("Resend error:", error.code);
    btn.textContent         = "Resend email";
    btn.style.pointerEvents = "";
    btn.style.color         = "";
    showToast(getErrorMessage(error.code), "error");
  }
};

/* ─────────────────────────────────────────────
   Main form handler
───────────────────────────────────────────── */
window.validateForgot = function () {
  return false; // prevent default — handled below
};

document.querySelector("form.login-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  var email = document.getElementById("email").value.trim();

  // ── Client-side checks ──
  if (!email) {
    highlightInput("email");
    showToast("Please enter your email address.", "error");
    shakeCard();
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    highlightInput("email");
    showToast("That doesn't look like a valid email address.", "error");
    shakeCard();
    return;
  }

  // ── Loading state ──
  var btn      = document.getElementById("sendBtn");
  var spinner  = document.getElementById("spinner");
  var btnText  = document.getElementById("btnText");

  btn.classList.add("fp-loading");
  btn.disabled       = true;
  spinner.style.display = "inline-block";
  btnText.textContent   = "Sending…";

  try {
    await sendPasswordResetEmail(auth, email);

    console.log("Reset email sent to:", email);

    // Small delay so loading state is visible
    setTimeout(function () {
      btn.classList.remove("fp-loading");
      btn.disabled          = false;
      spinner.style.display = "none";
      btnText.textContent   = "Send Reset Link";

      showSentView(email);
    }, 800);

  } catch (error) {
    console.error("Reset error:", error.code, error.message);

    // Reset button
    btn.classList.remove("fp-loading");
    btn.disabled          = false;
    spinner.style.display = "none";
    btnText.textContent   = "Send Reset Link";

    var message = getErrorMessage(error.code);

    // Highlight input for relevant errors
    if (
      error.code === "auth/invalid-email" ||
      error.code === "auth/user-not-found" ||
      error.code === "auth/missing-email"
    ) {
      highlightInput("email");
    }

    showToast(message, "error");
    shakeCard();
  }
});

/* ─────────────────────────────────────────────
   Clear input highlight on focus
───────────────────────────────────────────── */
var emailInput = document.getElementById("email");
if (emailInput) {
  emailInput.addEventListener("focus", function () {
    clearInputHighlight("email");
  });
}