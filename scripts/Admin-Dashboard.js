// ============================================================
//  admin.js  —  COEP Notes Admin Dashboard
//  Firebase v12 modular ESM
// ============================================================

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ══════════════════════════════════════════════════════════
   ADMIN EMAIL — change this to your admin email
══════════════════════════════════════════════════════════ */
const ADMIN_EMAIL = "admin@coephaltan.edu.in"; 

/* ══════════════════════════════════════════════════════════
   DEFAULT DATA  (same as teacher-dashboard.js)
   Branches & Subjects are stored in Firestore "config" doc
   so admin edits persist everywhere.
══════════════════════════════════════════════════════════ */
const DEFAULT_BRANCHES = {
  degree: ["Computer Engineering", "Mechanical Engineering", "AI & Data Science", "ENTC Engineering", "Civil Engineering"],
  diploma: ["Computer Engineering", "Mechanical Engineering", "ENTC Engineering", "Civil Engineering"]
};

const DEFAULT_SUBJECTS = {
  degree: {
    "Semester 1": ["Data Structures", "Programming Fundamentals", "Digital Logic Design", "Mathematics I"],
    "Semester 2": ["Database Management", "Web Development", "Discrete Mathematics", "Physics"],
    "Semester 3": ["Data Structures", "Compiler Design", "Computer Networks", "Advanced Algorithms"],
    "Semester 4": ["Software Engineering", "Database Design", "System Design", "Multimedia"],
    "Semester 5": ["Machine Learning", "Cloud Computing", "Cybersecurity", "Big Data"],
    "Semester 6": ["Artificial Intelligence", "Mobile Development", "IoT", "Advanced Networking"],
    "Semester 7": ["Distributed Systems", "DevOps", "Advanced Security", "Blockchain"],
    "Semester 8": ["Project Management", "Enterprise Solutions", "Advanced ML", "Microservices"]
  },
  diploma: {
    "Semester 1": ["Fundamentals of Programming", "Computer Fundamentals", "Basic Electronics", "Mathematics Basics"],
    "Semester 2": ["Database Fundamentals", "HTML & CSS", "Basic Algorithms", "Applied Physics"],
    "Semester 3": ["Operating System Concepts", "Software Development", "Networking Basics", "Advanced Programming"],
    "Semester 4": ["Project Development", "Database Programming", "Web Technologies", "Professional Skills"]
  }
};

/* ══════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════ */
let allNotes = [];       // all Firestore notes docs
let branches = {};       // { degree: [...], diploma: [...] }
let subjects = {};       // { degree: { "Semester 1": [...] }, diploma: {...} }
let deleteTarget = null; // { type: "note"|"branch"|"subject", ... }

/* ══════════════════════════════════════════════════════════
   AUTH GUARD
══════════════════════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Only admin allowed
  if (user.email !== ADMIN_EMAIL) {
    showToast("Access denied. Admin only.", "error");
    setTimeout(() => {
      signOut(auth);
      window.location.href = "login.html";
    }, 2000);
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  const el = document.getElementById("admin-name-display");
  if (el) el.textContent = name.charAt(0).toUpperCase() + name.slice(1);

  await initDashboard();
});

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
async function initDashboard() {
  await Promise.all([
    loadConfig(),
    loadNotes()
  ]);
  renderOverview();
  renderBranchTable();
  renderSubjectTable();
  populateBranchFilter();
}

/* ══════════════════════════════════════════════════════════
   LOAD CONFIG  (branches & subjects from Firestore)
   Falls back to DEFAULT_BRANCHES / DEFAULT_SUBJECTS if
   the config doc doesn't exist yet.
══════════════════════════════════════════════════════════ */
async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, "admin_config", "data"));
    if (snap.exists()) {
      const data = snap.data();
      branches = data.branches || DEFAULT_BRANCHES;
      subjects = data.subjects || DEFAULT_SUBJECTS;
    } else {
      // First run — seed Firestore with defaults
      branches = structuredClone(DEFAULT_BRANCHES);
      subjects  = structuredClone(DEFAULT_SUBJECTS);
      await setDoc(doc(db, "admin_config", "data"), { branches, subjects });
    }
  } catch (err) {
    console.error("loadConfig error:", err);
    branches = structuredClone(DEFAULT_BRANCHES);
    subjects  = structuredClone(DEFAULT_SUBJECTS);
  }
}

/* ══════════════════════════════════════════════════════════
   SAVE CONFIG  (write back to Firestore)
══════════════════════════════════════════════════════════ */
async function saveConfig() {
  await setDoc(doc(db, "admin_config", "data"), { branches, subjects });
}

/* ══════════════════════════════════════════════════════════
   LOAD NOTES
══════════════════════════════════════════════════════════ */
async function loadNotes() {
  try {
    const q = query(collection(db, "notes"), orderBy("uploadedAt", "desc"));
    const snap = await getDocs(q);
    allNotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("loadNotes error:", err);
    allNotes = [];
  }
}

/* ══════════════════════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════════════════════ */
window.switchTab = function(tabName, btnEl) {
  document.querySelectorAll(".tab-view").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tabName).classList.add("active");
  if (btnEl) btnEl.classList.add("active");

  if (tabName === "notes") renderNotesTable(allNotes);
};

/* ══════════════════════════════════════════════════════════
   OVERVIEW
══════════════════════════════════════════════════════════ */
function renderOverview() {
  // Count stats
  const totalBranches = (branches.degree || []).length + (branches.diploma || []).length;
  let totalSubjects = 0;
  ["degree", "diploma"].forEach(prog => {
    if (subjects[prog]) {
      Object.values(subjects[prog]).forEach(arr => { totalSubjects += arr.length; });
    }
  });

  const teachers = new Set(allNotes.map(n => n.uploadedBy).filter(Boolean));

  document.getElementById("stat-notes").textContent     = allNotes.length;
  document.getElementById("stat-branches").textContent  = totalBranches;
  document.getElementById("stat-subjects").textContent  = totalSubjects;
  document.getElementById("stat-teachers").textContent  = teachers.size;

  // Nav counts
  document.getElementById("nav-notes-count").textContent   = allNotes.length;
  document.getElementById("nav-branch-count").textContent  = totalBranches;
  document.getElementById("nav-subject-count").textContent = totalSubjects;

  // Recent notes
  const tbody = document.getElementById("recent-notes-body");
  const recent = allNotes.slice(0, 10);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No notes uploaded yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(n => `
    <tr>
      <td><strong>${esc(n.subject || "—")}</strong><br><small style="color:var(--text-sub)">${esc(n.unitName || "")}</small></td>
      <td>${esc(n.branch || "—")}</td>
      <td><span class="badge badge-orange">${esc(n.semester || "—")}</span></td>
      <td>Unit ${esc(String(n.unitNumber || "—"))}</td>
      <td style="font-size:0.78rem;color:var(--text-sub)">${esc(n.uploadedBy || "—")}</td>
      <td class="drive-link-cell">
        ${n.driveLink ? `<a href="${esc(n.driveLink)}" target="_blank">🔗 Open</a>` : "—"}
      </td>
    </tr>
  `).join("");
}

/* ══════════════════════════════════════════════════════════
   NOTES TABLE
══════════════════════════════════════════════════════════ */
function renderNotesTable(notes) {
  const tbody = document.getElementById("notes-table-body");
  const label = document.getElementById("notes-count-label");
  label.textContent = notes.length + " note(s) found";

  if (notes.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No notes found</div>
          <div class="empty-sub">Try adjusting your filters.</div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = notes.map(n => `
    <tr>
      <td>
        <strong>${esc(n.subject || "—")}</strong>
        <div style="font-size:0.75rem;color:var(--text-sub)">${esc(n.unitName || "")}</div>
      </td>
      <td>
        ${esc(n.branch || "—")}
        <div><span class="badge ${n.program === 'degree' ? 'badge-degree' : 'badge-diploma'}">${esc(n.program || "")}</span></div>
      </td>
      <td><span class="badge badge-orange">${esc(n.semester || "—")}</span></td>
      <td>Unit ${esc(String(n.unitNumber || "—"))}</td>
      <td style="font-size:0.78rem;color:var(--text-sub)">${esc(n.uploadedBy || "—")}</td>
      <td class="drive-link-cell">
        ${n.driveLink ? `<a href="${esc(n.driveLink)}" target="_blank">🔗 Open Drive</a>` : "—"}
      </td>
      <td>
        <button class="action-btn delete" onclick="openDeleteModal('note','${n.id}','${esc(n.subject)} — ${esc(n.unitName)}')">
          🗑️ Delete
        </button>
      </td>
    </tr>
  `).join("");
}

window.applyNotesFilter = function() {
  const prog   = document.getElementById("filter-program").value;
  const branch = document.getElementById("filter-branch").value;
  const sem    = document.getElementById("filter-sem").value;
  const search = document.getElementById("filter-search").value.toLowerCase().trim();

  const filtered = allNotes.filter(n => {
    if (prog   && n.program  !== prog)   return false;
    if (branch && n.branch   !== branch) return false;
    if (sem    && n.semester !== sem)    return false;
    if (search && !`${n.subject} ${n.unitName}`.toLowerCase().includes(search)) return false;
    return true;
  });

  renderNotesTable(filtered);
};

function populateBranchFilter() {
  const sel = document.getElementById("filter-branch");
  const allBranches = [...new Set([...(branches.degree || []), ...(branches.diploma || [])])];
  sel.innerHTML = '<option value="">All Branches</option>' +
    allBranches.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
}

/* ══════════════════════════════════════════════════════════
   BRANCHES TABLE
══════════════════════════════════════════════════════════ */
window.renderBranchTable = function() {
  const tbody = document.getElementById("branch-table-body");
  const filterProg = document.getElementById("branch-filter-program")?.value || "";

  let rows = [];
  ["degree", "diploma"].forEach(prog => {
    if (filterProg && filterProg !== prog) return;
    (branches[prog] || []).forEach(b => {
      const count = allNotes.filter(n => n.branch === b && n.program === prog).length;
      rows.push({ name: b, program: prog, count });
    });
  });

  const total = (branches.degree || []).length + (branches.diploma || []).length;
  document.getElementById("branch-count-label").textContent = total + " branch(es) total";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🏫</div><div class="empty-title">No branches found</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td style="color:var(--text-sub);font-size:0.78rem">${i + 1}</td>
      <td><strong>${esc(r.name)}</strong></td>
      <td><span class="badge ${r.program === 'degree' ? 'badge-degree' : 'badge-diploma'}">${r.program}</span></td>
      <td><span class="badge badge-orange">${r.count} notes</span></td>
      <td>
        <button class="action-btn delete" onclick="openDeleteModal('branch','${esc(r.name)}__${r.program}','${esc(r.name)} (${r.program})')">
          🗑️ Delete
        </button>
      </td>
    </tr>
  `).join("");
};

window.addBranch = async function() {
  const prog = document.getElementById("new-branch-program").value;
  const name = document.getElementById("new-branch-name").value.trim();

  if (!name) { showToast("Please enter a branch name.", "error"); return; }

  if (!branches[prog]) branches[prog] = [];
  if (branches[prog].includes(name)) {
    showToast("This branch already exists.", "error"); return;
  }

  branches[prog].push(name);
  try {
    await saveConfig();
    showToast(`Branch "${name}" added successfully!`, "success");
    document.getElementById("new-branch-name").value = "";
    toggleAddForm("branch");
    renderBranchTable();
    populateBranchFilter();
    updateNavCounts();
  } catch (err) {
    branches[prog].pop();
    showToast("Failed to save. Try again.", "error");
    console.error(err);
  }
};

/* ══════════════════════════════════════════════════════════
   SUBJECTS TABLE
══════════════════════════════════════════════════════════ */
window.renderSubjectTable = function() {
  const tbody = document.getElementById("subject-table-body");
  const filterProg = document.getElementById("subj-filter-program")?.value || "";
  const filterSem  = document.getElementById("subj-filter-sem")?.value || "";

  let rows = [];
  ["degree", "diploma"].forEach(prog => {
    if (filterProg && filterProg !== prog) return;
    if (!subjects[prog]) return;
    Object.entries(subjects[prog]).forEach(([sem, subjArr]) => {
      if (filterSem && filterSem !== sem) return;
      subjArr.forEach(s => {
        const count = allNotes.filter(n => n.subject === s && n.program === prog && n.semester === sem).length;
        rows.push({ name: s, sem, program: prog, count });
      });
    });
  });

  let totalSubjects = 0;
  ["degree","diploma"].forEach(prog => {
    if (subjects[prog]) Object.values(subjects[prog]).forEach(arr => { totalSubjects += arr.length; });
  });
  document.getElementById("subject-count-label").textContent = totalSubjects + " subject(s) total";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📚</div><div class="empty-title">No subjects found</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td style="color:var(--text-sub);font-size:0.78rem">${i + 1}</td>
      <td><strong>${esc(r.name)}</strong></td>
      <td><span class="badge badge-orange">${esc(r.sem)}</span></td>
      <td><span class="badge ${r.program === 'degree' ? 'badge-degree' : 'badge-diploma'}">${r.program}</span></td>
      <td><span class="badge badge-orange">${r.count} notes</span></td>
      <td>
        <button class="action-btn delete" onclick="openDeleteModal('subject','${esc(r.name)}__${esc(r.sem)}__${r.program}','${esc(r.name)} (${esc(r.sem)}, ${r.program})')">
          🗑️ Delete
        </button>
      </td>
    </tr>
  `).join("");
};

window.addSubject = async function() {
  const prog = document.getElementById("new-subj-program").value;
  const sem  = document.getElementById("new-subj-sem").value;
  const name = document.getElementById("new-subj-name").value.trim();

  if (!name) { showToast("Please enter a subject name.", "error"); return; }

  if (!subjects[prog]) subjects[prog] = {};
  if (!subjects[prog][sem]) subjects[prog][sem] = [];
  if (subjects[prog][sem].includes(name)) {
    showToast("This subject already exists in this semester.", "error"); return;
  }

  subjects[prog][sem].push(name);
  try {
    await saveConfig();
    showToast(`Subject "${name}" added successfully!`, "success");
    document.getElementById("new-subj-name").value = "";
    toggleAddForm("subject");
    renderSubjectTable();
    updateNavCounts();
  } catch (err) {
    subjects[prog][sem].pop();
    showToast("Failed to save. Try again.", "error");
    console.error(err);
  }
};

/* ══════════════════════════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════════════════════════ */
window.openDeleteModal = function(type, id, label) {
  deleteTarget = { type, id, label };

  const descriptions = {
    note:    `Are you sure you want to delete the note <strong>"${label}"</strong>? This cannot be undone.`,
    branch:  `Are you sure you want to delete the branch <strong>"${label}"</strong>? The notes under this branch will remain but the branch won't appear in dropdowns.`,
    subject: `Are you sure you want to delete the subject <strong>"${label}"</strong>? The notes under this subject will remain but the subject won't appear in dropdowns.`
  };

  document.getElementById("modal-title").textContent = "Delete " + type.charAt(0).toUpperCase() + type.slice(1) + "?";
  document.getElementById("modal-desc").innerHTML = descriptions[type] || "This action cannot be undone.";
  document.getElementById("delete-modal").classList.add("open");
};

window.closeModal = function() {
  document.getElementById("delete-modal").classList.remove("open");
  deleteTarget = null;
};

window.confirmDelete = async function() {
  if (!deleteTarget) return;

  const btn = document.getElementById("modal-confirm-btn");
  btn.textContent = "Deleting…";
  btn.disabled = true;

  try {
    if (deleteTarget.type === "note") {
      await deleteDoc(doc(db, "notes", deleteTarget.id));
      allNotes = allNotes.filter(n => n.id !== deleteTarget.id);
      showToast("Note deleted successfully.", "success");
      renderOverview();
      renderNotesTable(allNotes);

    } else if (deleteTarget.type === "branch") {
      const [name, prog] = deleteTarget.id.split("__");
      if (branches[prog]) {
        branches[prog] = branches[prog].filter(b => b !== name);
        await saveConfig();
        showToast(`Branch "${name}" removed.`, "success");
        renderBranchTable();
        populateBranchFilter();
        updateNavCounts();
      }

    } else if (deleteTarget.type === "subject") {
      const [name, sem, prog] = deleteTarget.id.split("__");
      if (subjects[prog] && subjects[prog][sem]) {
        subjects[prog][sem] = subjects[prog][sem].filter(s => s !== name);
        await saveConfig();
        showToast(`Subject "${name}" removed.`, "success");
        renderSubjectTable();
        updateNavCounts();
      }
    }

    closeModal();
  } catch (err) {
    console.error("Delete error:", err);
    showToast("Failed to delete. Try again.", "error");
  } finally {
    btn.textContent = "Delete";
    btn.disabled = false;
  }
};

/* ══════════════════════════════════════════════════════════
   TOGGLE ADD FORM
══════════════════════════════════════════════════════════ */
window.toggleAddForm = function(type) {
  const form   = document.getElementById(`add-${type}-form`);
  const toggle = document.getElementById(`add-${type}-toggle`);
  const isOpen = form.classList.contains("open");

  form.classList.toggle("open", !isOpen);
  if (toggle) {
    toggle.classList.toggle("open", !isOpen);
    toggle.textContent = isOpen ? `+ Add ${type.charAt(0).toUpperCase() + type.slice(1)}` : "✕ Cancel";
  }
};

/* ══════════════════════════════════════════════════════════
   UPDATE NAV COUNTS
══════════════════════════════════════════════════════════ */
function updateNavCounts() {
  const totalBranches = (branches.degree || []).length + (branches.diploma || []).length;
  let totalSubjects = 0;
  ["degree","diploma"].forEach(prog => {
    if (subjects[prog]) Object.values(subjects[prog]).forEach(arr => { totalSubjects += arr.length; });
  });
  document.getElementById("nav-notes-count").textContent   = allNotes.length;
  document.getElementById("nav-branch-count").textContent  = totalBranches;
  document.getElementById("nav-subject-count").textContent = totalSubjects;
  document.getElementById("stat-branches").textContent = totalBranches;
  document.getElementById("stat-subjects").textContent = totalSubjects;
}

/* ══════════════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════════════ */
document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

/* ══════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════ */
let toastTimer;
function showToast(msg, type) {
  const toast = document.getElementById("admin-toast");
  const icon  = document.getElementById("toast-icon");
  const text  = document.getElementById("toast-msg");

  toast.className = "";
  void toast.offsetWidth;

  icon.textContent = type === "success" ? "✓" : "✕";
  text.textContent = msg;
  toast.classList.add("show", type);

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove("show"); }, type === "success" ? 2800 : 4000);
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}