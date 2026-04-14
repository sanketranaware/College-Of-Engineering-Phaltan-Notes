import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  doc, getDoc, collection,
  addDoc, deleteDoc, query, where,
  getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ── State ──────────────────────────────────────────────────────────
let currentUser   = null;
let adminConfig   = { branches: {}, subjects: {} };
let myNotes       = [];
let mySyllabus    = [];
let pendingDelete = null; // { id, collection, title }

const yearToSemesters = {
  "Year 1": ["Semester 1", "Semester 2"],
  "Year 2": ["Semester 3", "Semester 4"],
  "Year 3": ["Semester 5", "Semester 6"],
  "Year 4": ["Semester 7", "Semester 8"],
};
const diplomaYears = ["Year 1", "Year 2", "Year 3"];
const degreeYears  = ["Year 1", "Year 2", "Year 3", "Year 4"];

// ── DOM helper ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function setOptions(selectEl, options, placeholder) {
  selectEl.innerHTML =
    `<option value="">${placeholder}</option>` +
    options.map(o => `<option value="${o}">${o}</option>`).join("");
  selectEl.disabled = false;
}

function resetSelect(selectEl, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  selectEl.disabled = true;
}

function showAlert(successId, errorId, successMsgId, errorMsgId, type, msg) {
  $(successId).classList.remove("show");
  $(errorId).classList.remove("show");
  if (type === "success") {
    $(successMsgId).textContent = msg;
    $(successId).classList.add("show");
  } else {
    $(errorMsgId).textContent = msg;
    $(errorId).classList.add("show");
  }
  setTimeout(() => {
    $(successId).classList.remove("show");
    $(errorId).classList.remove("show");
  }, 5000);
}

function showNoteAlert(type, msg) {
  showAlert("alert-success","alert-error","alert-success-msg","alert-error-msg", type, msg);
}
function showSylAlert(type, msg) {
  showAlert("syl-alert-success","syl-alert-error","syl-alert-success-msg","syl-alert-error-msg", type, msg);
}

// ── Tab switcher ───────────────────────────────────────────────────
window.switchUploadTab = function(tab) {
  $("tab-notes").classList.toggle("active", tab === "notes");
  $("tab-syllabus").classList.toggle("active", tab === "syllabus");
  $("panel-notes").classList.toggle("active", tab === "notes");
  $("panel-syllabus").classList.toggle("active", tab === "syllabus");
};

// ── Load admin config from Firestore ──────────────────────────────
async function loadAdminConfig() {
  $("loading-strip").style.display = "flex";
  try {
    const snap = await getDoc(doc(db, "admin_config", "data"));
    if (snap.exists()) {
      const data = snap.data();
      adminConfig.branches = data.branches || {};
      adminConfig.subjects  = data.subjects  || {};
    }
  } catch (e) {
    console.warn("Could not load admin config:", e.message);
  } finally {
    $("loading-strip").style.display = "none";
  }
}

// ── Notes cascade selects ──────────────────────────────────────────
window.onProgramChange = function() {
  const prog = $("f-program").value;
  resetSelect($("f-branch"),   "— Select Branch —");
  resetSelect($("f-year"),     "— Select Year —");
  resetSelect($("f-semester"), "— Select Year first —");
  resetSelect($("f-subject"),  "— Select Semester first —");
  if (!prog) return;
  const branches = adminConfig.branches[prog] || [];
  branches.length
    ? setOptions($("f-branch"), branches, "— Select Branch —")
    : resetSelect($("f-branch"), "No branches found");
  const years = prog === "degree" ? degreeYears : diplomaYears;
  setOptions($("f-year"), years, "— Select Year —");
};

window.onBranchChange = function() {
  resetSelect($("f-semester"), "— Select Year first —");
  resetSelect($("f-subject"),  "— Select Semester first —");
  const year = $("f-year").value;
  if (year) setOptions($("f-semester"), yearToSemesters[year] || [], "— Select Semester —");
};

window.onYearChange = function() {
  const year = $("f-year").value;
  resetSelect($("f-semester"), "— Select Year first —");
  resetSelect($("f-subject"),  "— Select Semester first —");
  if (!year) return;
  setOptions($("f-semester"), yearToSemesters[year] || [], "— Select Semester —");
};

window.onSemesterChange = function() {
  const prog   = $("f-program").value;
  const branch = $("f-branch").value;
  const sem    = $("f-semester").value;
  resetSelect($("f-subject"), "— Select Semester first —");
  if (!prog || !branch || !sem) return;
  const subjects = ((adminConfig.subjects[prog] || {})[branch] || {})[sem] || [];
  subjects.length
    ? setOptions($("f-subject"), subjects, "— Select Subject —")
    : resetSelect($("f-subject"), "No subjects for this branch/semester");
};

// ── Syllabus cascade selects ───────────────────────────────────────
window.onSylProgramChange = function() {
  const prog = $("sf-program").value;
  resetSelect($("sf-branch"),   "— Select Branch —");
  resetSelect($("sf-year"),     "— Select Year —");
  resetSelect($("sf-semester"), "— Select Year first —");
  if (!prog) return;
  const branches = adminConfig.branches[prog] || [];
  branches.length
    ? setOptions($("sf-branch"), branches, "— Select Branch —")
    : resetSelect($("sf-branch"), "No branches found");
  const years = prog === "degree" ? degreeYears : diplomaYears;
  setOptions($("sf-year"), years, "— Select Year —");
};

window.onSylYearChange = function() {
  const year = $("sf-year").value;
  resetSelect($("sf-semester"), "— Select Year first —");
  if (!year) return;
  setOptions($("sf-semester"), yearToSemesters[year] || [], "— Select Semester —");
};

// ── Submit note ────────────────────────────────────────────────────
window.submitNote = async function() {
  const program   = $("f-program").value;
  const branch    = $("f-branch").value;
  const year      = $("f-year").value;
  const semester  = $("f-semester").value;
  const subject   = $("f-subject").value;
  const unitNum   = $("f-unit-num").value.trim();
  const unitName  = $("f-unit-name").value.trim();
  const title     = $("f-title").value.trim();
  const driveLink = $("f-drive").value.trim();

  if (!program || !branch || !year || !semester || !subject || !unitNum || !unitName || !title || !driveLink) {
    showNoteAlert("error", "Please fill in all fields before uploading.");
    return;
  }
  if (!driveLink.startsWith("http")) {
    showNoteAlert("error", "Please enter a valid Google Drive link starting with https://");
    return;
  }

  const btn = $("submit-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="inline-spinner"></span> Uploading…';

  try {
    await addDoc(collection(db, "notes"), {
      program, branch, year, semester, subject,
      unitNumber: parseInt(unitNum),
      unitName, title, driveLink,
      uploadedBy: currentUser.email,
      uploadedAt: serverTimestamp()
    });
    showNoteAlert("success", `Note "${title}" uploaded successfully!`);
    $("f-unit-num").value  = "";
    $("f-unit-name").value = "";
    $("f-title").value     = "";
    $("f-drive").value     = "";
    await loadAllMyUploads();
  } catch (e) {
    showNoteAlert("error", "Upload failed: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "📤 Upload Note";
  }
};

// ── Submit syllabus ────────────────────────────────────────────────
window.submitSyllabus = async function() {
  const program   = $("sf-program").value;
  const branch    = $("sf-branch").value;
  const year      = $("sf-year").value;
  const semester  = $("sf-semester").value;
  const title     = $("sf-title").value.trim();
  const driveLink = $("sf-drive").value.trim();

  if (!program || !branch || !year || !semester || !title || !driveLink) {
    showSylAlert("error", "Please fill in all fields before uploading.");
    return;
  }
  if (!driveLink.startsWith("http")) {
    showSylAlert("error", "Please enter a valid link starting with https://");
    return;
  }

  const btn = $("syl-submit-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="inline-spinner"></span> Uploading…';

  try {
    await addDoc(collection(db, "syllabus"), {
      program, branch, year, semester, title, driveLink,
      uploadedBy: currentUser.email,
      uploadedAt: serverTimestamp()
    });
    showSylAlert("success", `Syllabus "${title}" uploaded successfully!`);
    $("sf-title").value = "";
    $("sf-drive").value = "";
    await loadAllMyUploads();
  } catch (e) {
    showSylAlert("error", "Upload failed: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "📋 Upload Syllabus";
  }
};

// ── Load all uploads (notes + syllabus) ───────────────────────────
async function loadAllMyUploads() {
  const listEl = $("my-uploads-list");
  listEl.innerHTML = `<div class="spinner-row"><span class="inline-spinner"></span> Loading your uploads…</div>`;
  try {
    // Query only by uploadedBy — no orderBy to avoid needing a composite index
    const [notesSnap, sylSnap] = await Promise.all([
      getDocs(query(
        collection(db, "notes"),
        where("uploadedBy", "==", currentUser.email)
      )),
      getDocs(query(
        collection(db, "syllabus"),
        where("uploadedBy", "==", currentUser.email)
      ))
    ]);

    myNotes    = notesSnap.docs.map(d => ({ id: d.id, _col: "notes",    ...d.data() }));
    mySyllabus = sylSnap.docs.map(d  => ({ id: d.id, _col: "syllabus", ...d.data() }));

    renderAllUploads();
  } catch (e) {
    console.error("Load uploads error:", e);
    listEl.innerHTML = `
      <div class="empty-uploads">
        <div class="empty-icon">⚠️</div>
        <strong>Could not load uploads</strong><br>
        <span style="font-size:0.8rem;color:#ef4444;">${e.message}</span><br><br>
        <span style="font-size:0.78rem;">Make sure your Firestore rules allow authenticated users
        to read documents from <code>notes</code> and <code>syllabus</code> collections.</span>
      </div>`;
  }
}

function renderAllUploads() {
  const listEl = $("my-uploads-list");
  const all    = [...myNotes, ...mySyllabus];
  $("my-uploads-badge").textContent = all.length;

  if (!all.length) {
    listEl.innerHTML = `
      <div class="empty-uploads">
        <div class="empty-icon">📭</div>
        You haven't uploaded anything yet.
      </div>`;
    return;
  }

  listEl.innerHTML =
    `<div class="note-list">` +
    all.map(item => {
      const isSyl = item._col === "syllabus";
      const meta  = isSyl
        ? `${cap(item.program)} · ${item.branch || ""} · ${item.semester || ""}`
        : `${cap(item.program)} · ${item.branch || ""} · ${item.semester || ""} · ${item.subject || ""} · Unit ${item.unitNumber || ""}`;
      const safeTitle = (item.title || "Untitled").replace(/'/g, "\\'").replace(/"/g, "&quot;");
      return `
        <div class="note-item" id="item-${item.id}">
          <div class="note-item-left">
            <div class="note-title">${item.title || "Untitled"}</div>
            <div class="note-meta">${meta}</div>
          </div>
          <div class="note-item-actions">
            <span class="note-type-badge ${isSyl ? "badge-syllabus" : "badge-notes"}">${isSyl ? "Syllabus" : "Note"}</span>
            ${item.driveLink
              ? `<a href="${item.driveLink}" target="_blank" rel="noopener" class="note-link-btn">Open ↗</a>`
              : `<span style="font-size:0.78rem;color:var(--text-sub);">No link</span>`}
            <button class="note-delete-btn"
              onclick="openDeleteModal('${item.id}','${item._col}','${safeTitle}')">
              🗑️ Delete
            </button>
          </div>
        </div>`;
    }).join("") +
    `</div>`;
}

function cap(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Delete modal ───────────────────────────────────────────────────
window.openDeleteModal = function(id, col, title) {
  pendingDelete = { id, col };
  $("delete-modal-msg").textContent =
    `Are you sure you want to delete "${title}"? This cannot be undone.`;
  $("delete-modal").classList.add("show");
};

window.closeDeleteModal = function() {
  $("delete-modal").classList.remove("show");
  pendingDelete = null;
};

window.confirmDelete = async function() {
  if (!pendingDelete) return;
  const { id, col } = pendingDelete;
  const btn = $("delete-confirm-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="inline-spinner"></span> Deleting…';

  try {
    await deleteDoc(doc(db, col, id));
    closeDeleteModal();
    await loadAllMyUploads();
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = "🗑️ Delete";
    $("delete-modal-msg").textContent = "Delete failed: " + e.message;
  }
};

// ── Logout ─────────────────────────────────────────────────────────
window.doLogout = async function() {
  try { await signOut(auth); } catch (_) {}
  window.location.href = "login.html";
};

// ── Auth listener ──────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    $("teacher-email-display").textContent = user.email;
    $("auth-gate").style.display  = "none";
    $("dashboard").style.display  = "block";
    await loadAdminConfig();
    await loadAllMyUploads();
  } else {
    currentUser = null;
    $("auth-gate").style.display  = "flex";
    $("dashboard").style.display  = "none";
    $("teacher-email-display").textContent = "";
  }
});