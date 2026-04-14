

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ══════════════════════════════════════════════════════════
   ADMIN EMAIL
══════════════════════════════════════════════════════════ */
const ADMIN_EMAIL = "admin@coephaltan.edu.in";

/* ══════════════════════════════════════════════════════════
   SEMESTERS PER PROGRAM
══════════════════════════════════════════════════════════ */
const SEMS = {
  degree:  ["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6","Semester 7","Semester 8"],
  diploma: ["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6"]
};

/* ══════════════════════════════════════════════════════════
   DEFAULT BRANCHES  (only branches have defaults;
   subjects are entered manually per branch)
══════════════════════════════════════════════════════════ */
const DEFAULT_BRANCHES = {
  degree:  ["Computer Engineering","Mechanical Engineering","AI & Data Science","ENTC Engineering","Civil Engineering"],
  diploma: ["Computer Engineering","Mechanical Engineering","ENTC Engineering","Civil Engineering"]
};

/* ══════════════════════════════════════════════════════════
   STATE
   subjects shape:  subjects[prog][branch][sem] = string[]
══════════════════════════════════════════════════════════ */
let allNotes     = [];
let branches     = {};
let subjects     = {};
let deleteTarget = null;
let subjFormOpen = false;

const CONFIG_REF = () => doc(db, "admin_config", "data");

/* ══════════════════════════════════════════════════════════
   AUTH GUARD
══════════════════════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }

  if (user.email !== ADMIN_EMAIL) {
    showToast("Access denied. Admin only.", "error");
    setTimeout(async () => { await signOut(auth); window.location.href = "login.html"; }, 2000);
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
  await Promise.all([loadConfig(), loadNotes()]);
  renderOverview();
  renderBranchTable();
  subjRenderTable();
  populateBranchFilter();
}

/* ══════════════════════════════════════════════════════════
   LOAD CONFIG
   Migrates old flat structure  subjects[prog][sem][]
   to new branch-aware          subjects[prog][branch][sem][]
══════════════════════════════════════════════════════════ */
async function loadConfig() {
  try {
    const snap = await getDoc(CONFIG_REF());
    if (snap.exists()) {
      const data = snap.data();
      branches = data.branches || structuredClone(DEFAULT_BRANCHES);
      subjects = data.subjects || {};

      // Migration: delete any "Semester X" keys that ended up at the branch level
      let dirty = false;
      for (const prog of Object.keys(subjects)) {
        const progData = subjects[prog] || {};
        for (const key of Object.keys(progData)) {
          if (/^Semester\s/i.test(key)) {
            delete progData[key];
            dirty = true;
          }
        }
      }
      if (dirty) await updateDoc(CONFIG_REF(), { subjects });
    } else {
      // First run — seed branches only
      branches = structuredClone(DEFAULT_BRANCHES);
      subjects  = {};
      await setDoc(CONFIG_REF(), { branches, subjects });
    }
  } catch (err) {
    console.error("loadConfig error:", err);
    branches = structuredClone(DEFAULT_BRANCHES);
    subjects  = {};
  }
}

/* ══════════════════════════════════════════════════════════
   SAVE CONFIG
══════════════════════════════════════════════════════════ */
async function saveConfig() {
  await setDoc(CONFIG_REF(), { branches, subjects });
}

/* ══════════════════════════════════════════════════════════
   COUNT SUBJECTS  (3-level: prog → branch → sem → [])
══════════════════════════════════════════════════════════ */
function countSubjects() {
  let total = 0;
  for (const prog of ["degree","diploma"]) {
    if (!subjects[prog]) continue;
    for (const branchData of Object.values(subjects[prog])) {
      if (!branchData || typeof branchData !== "object" || Array.isArray(branchData)) continue;
      for (const semArr of Object.values(branchData)) {
        if (Array.isArray(semArr)) total += semArr.length;
      }
    }
  }
  return total;
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
  const totalBranches = (branches.degree||[]).length + (branches.diploma||[]).length;
  const totalSubjects = countSubjects();
  const teachers      = new Set(allNotes.map(n => n.uploadedBy).filter(Boolean));

  document.getElementById("stat-notes").textContent    = allNotes.length;
  document.getElementById("stat-branches").textContent = totalBranches;
  document.getElementById("stat-subjects").textContent = totalSubjects;
  document.getElementById("stat-teachers").textContent = teachers.size;

  document.getElementById("nav-notes-count").textContent   = allNotes.length;
  document.getElementById("nav-branch-count").textContent  = totalBranches;
  document.getElementById("nav-subject-count").textContent = totalSubjects;

  const tbody  = document.getElementById("recent-notes-body");
  const recent = allNotes.slice(0, 10);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-row">No notes uploaded yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(n => `
    <tr>
      <td><strong>${esc(n.subject||"—")}</strong><br><small style="color:var(--text-sub)">${esc(n.unitName||"")}</small></td>
      <td>${esc(n.branch||"—")}</td>
      <td><span class="badge badge-orange">${esc(n.semester||"—")}</span></td>
      <td>Unit ${esc(String(n.unitNumber||"—"))}</td>
      <td style="font-size:0.78rem;color:var(--text-sub)">${esc(n.uploadedBy||"—")}</td>
      <td class="drive-link-cell">${n.driveLink?`<a href="${esc(n.driveLink)}" target="_blank">🔗 Open</a>`:"—"}</td>
    </tr>`).join("");
}

/* ══════════════════════════════════════════════════════════
   NOTES TABLE
══════════════════════════════════════════════════════════ */
function renderNotesTable(notes) {
  const tbody = document.getElementById("notes-table-body");
  document.getElementById("notes-count-label").textContent = notes.length + " note(s) found";

  if (notes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No notes found</div><div class="empty-sub">Try adjusting your filters.</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = notes.map(n => `
    <tr>
      <td><strong>${esc(n.subject||"—")}</strong><div style="font-size:0.75rem;color:var(--text-sub)">${esc(n.unitName||"")}</div></td>
      <td>${esc(n.branch||"—")}<div><span class="badge ${n.program==="degree"?"badge-degree":"badge-diploma"}">${esc(n.program||"")}</span></div></td>
      <td><span class="badge badge-orange">${esc(n.semester||"—")}</span></td>
      <td>Unit ${esc(String(n.unitNumber||"—"))}</td>
      <td style="font-size:0.78rem;color:var(--text-sub)">${esc(n.uploadedBy||"—")}</td>
      <td class="drive-link-cell">${n.driveLink?`<a href="${esc(n.driveLink)}" target="_blank">🔗 Open Drive</a>`:"—"}</td>
      <td><button class="action-btn delete" onclick="openDeleteModal('note','${n.id}','${esc(n.subject)} — ${esc(n.unitName)}')">🗑️ Delete</button></td>
    </tr>`).join("");
}

window.applyNotesFilter = function() {
  const prog   = document.getElementById("filter-program").value;
  const branch = document.getElementById("filter-branch").value;
  const sem    = document.getElementById("filter-sem").value;
  const search = document.getElementById("filter-search").value.toLowerCase().trim();
  renderNotesTable(allNotes.filter(n => {
    if (prog   && n.program  !== prog)   return false;
    if (branch && n.branch   !== branch) return false;
    if (sem    && n.semester !== sem)    return false;
    if (search && !`${n.subject} ${n.unitName}`.toLowerCase().includes(search)) return false;
    return true;
  }));
};

function populateBranchFilter() {
  const sel = document.getElementById("filter-branch");
  const all = [...new Set([...(branches.degree||[]), ...(branches.diploma||[])])];
  sel.innerHTML = '<option value="">All Branches</option>' +
    all.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
}

/* ══════════════════════════════════════════════════════════
   BRANCHES TABLE
══════════════════════════════════════════════════════════ */
window.renderBranchTable = function() {
  const tbody      = document.getElementById("branch-table-body");
  const filterProg = document.getElementById("branch-filter-program")?.value || "";
  let rows = [];

  ["degree","diploma"].forEach(prog => {
    if (filterProg && filterProg !== prog) return;
    (branches[prog]||[]).forEach(b => {
      const count = allNotes.filter(n => n.branch === b && n.program === prog).length;
      rows.push({ name: b, program: prog, count });
    });
  });

  const total = (branches.degree||[]).length + (branches.diploma||[]).length;
  document.getElementById("branch-count-label").textContent = total + " branch(es) total";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🏫</div><div class="empty-title">No branches found</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td style="color:var(--text-sub);font-size:0.78rem">${i+1}</td>
      <td><strong>${esc(r.name)}</strong></td>
      <td><span class="badge ${r.program==="degree"?"badge-degree":"badge-diploma"}">${r.program}</span></td>
      <td><span class="badge badge-orange">${r.count} notes</span></td>
      <td><button class="action-btn delete" onclick="openDeleteModal('branch','${esc(r.name)}__${r.program}','${esc(r.name)} (${r.program})')">🗑️ Delete</button></td>
    </tr>`).join("");
};

window.addBranch = async function() {
  const prog = document.getElementById("new-branch-program").value;
  const name = document.getElementById("new-branch-name").value.trim();
  if (!name) { showToast("Please enter a branch name.", "error"); return; }
  if (!branches[prog]) branches[prog] = [];
  if (branches[prog].includes(name)) { showToast("This branch already exists.", "error"); return; }

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
   SUBJECTS — branch-aware  subjects[prog][branch][sem][]
══════════════════════════════════════════════════════════ */

// Toggle add-subject form
window.subjToggleForm = function() {
  subjFormOpen = !subjFormOpen;
  const form = document.getElementById("add-subject-form");
  const btn  = document.getElementById("add-subject-toggle");
  form.classList.toggle("open", subjFormOpen);
  btn.classList.toggle("open", subjFormOpen);
  btn.textContent = subjFormOpen ? "✕ Cancel" : "+ Add Subject";
  if (!subjFormOpen) {
    document.getElementById("new-subj-program").value = "";
    const branchSel = document.getElementById("new-subj-branch");
    const semSel    = document.getElementById("new-subj-sem");
    branchSel.innerHTML = "<option value=''>— Select Program first —</option>";
    branchSel.disabled  = true;
    semSel.innerHTML    = "<option value=''>— Select Program first —</option>";
    semSel.disabled     = true;
    document.getElementById("new-subj-name").value = "";
  }
};

// Program changed → populate branches, then semesters on branch pick
window.subjOnProgramChange = function() {
  const prog      = document.getElementById("new-subj-program").value;
  const branchSel = document.getElementById("new-subj-branch");
  const semSel    = document.getElementById("new-subj-sem");

  branchSel.innerHTML = "<option value=''>— Select Branch —</option>";
  semSel.innerHTML    = "<option value=''>— Select Branch first —</option>";
  branchSel.disabled  = true;
  semSel.disabled     = true;
  if (!prog) return;

  const progBranches = branches[prog] || [];
  if (progBranches.length === 0) {
    branchSel.innerHTML = "<option value=''>No branches — add branches first</option>";
    return;
  }
  progBranches.forEach(b => {
    const o = document.createElement("option");
    o.value = b; o.textContent = b;
    branchSel.appendChild(o);
  });
  branchSel.disabled = false;

  branchSel.onchange = function() {
    semSel.innerHTML = "<option value=''>— Select Semester —</option>";
    semSel.disabled  = true;
    if (!branchSel.value) return;
    (SEMS[prog] || []).forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s;
      semSel.appendChild(o);
    });
    semSel.disabled = false;
  };
};

// Save new subject
window.subjAddSubject = async function() {
  const prog   = document.getElementById("new-subj-program").value;
  const branch = document.getElementById("new-subj-branch").value;
  const sem    = document.getElementById("new-subj-sem").value;
  const name   = document.getElementById("new-subj-name").value.trim();

  if (!prog)   { showToast("Select a Program",   "error"); return; }
  if (!branch) { showToast("Select a Branch",    "error"); return; }
  if (!sem)    { showToast("Select a Semester",  "error"); return; }
  if (!name)   { showToast("Enter subject name", "error"); return; }

  const btn = document.getElementById("subj-save-btn");
  btn.disabled = true; btn.textContent = "Saving…";

  try {
    if (!subjects[prog])                              subjects[prog]                = {};
    if (!subjects[prog][branch])                      subjects[prog][branch]        = {};
    if (!Array.isArray(subjects[prog][branch][sem]))  subjects[prog][branch][sem]   = [];

    if (subjects[prog][branch][sem].includes(name)) {
      showToast("Subject already exists in this branch/semester!", "error");
      return;
    }
    subjects[prog][branch][sem].push(name);
    await saveConfig();
    showToast(`"${name}" added to ${branch} — ${sem}`, "success");
    subjToggleForm();
    subjRenderTable();
    updateNavCounts();
  } catch (err) {
    console.error(err);
    // rollback
    if (Array.isArray(subjects[prog]?.[branch]?.[sem])) {
      subjects[prog][branch][sem] = subjects[prog][branch][sem].filter(s => s !== name);
    }
    showToast("Failed: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "Save";
  }
};

// Delete subject directly (called from table row buttons)
window.subjDeleteSubject = async function(prog, branch, sem, name) {
  if (!confirm(`Delete "${name}" from ${branch} — ${sem}?`)) return;
  try {
    if (Array.isArray(subjects[prog]?.[branch]?.[sem])) {
      subjects[prog][branch][sem] = subjects[prog][branch][sem].filter(s => s !== name);
      await saveConfig();
      showToast(`"${name}" deleted.`, "success");
      subjRenderTable();
      updateNavCounts();
    }
  } catch (err) {
    showToast("Failed: " + err.message, "error");
  }
};

// Render subjects table
window.subjRenderTable = function() {
  const filterProg   = document.getElementById("subj-filter-program")?.value  || "";
  const filterBranch = document.getElementById("subj-filter-branch")?.value   || "";
  const filterSem    = document.getElementById("subj-filter-sem")?.value      || "";
  const tbody        = document.getElementById("subject-table-body");

  const rows = [];
  for (const prog of ["degree","diploma"]) {
    if (filterProg && prog !== filterProg) continue;
    const progData = subjects[prog] || {};
    for (const branch of Object.keys(progData)) {
      if (/^Semester\s/i.test(branch)) continue;   // skip stale old-format keys
      if (filterBranch && branch !== filterBranch) continue;
      const branchData = progData[branch] || {};
      for (const sem of Object.keys(branchData)) {
        if (filterSem && sem !== filterSem) continue;
        const list = branchData[sem];
        if (!Array.isArray(list)) continue;
        for (const name of list) rows.push({ prog, branch, sem, name });
      }
    }
  }

  const total = countSubjects();
  document.getElementById("subject-count-label").textContent = total + " subject(s) total";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-row" style="color:var(--text-sub)">No subjects found. Click <strong>+ Add Subject</strong> to get started.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r, i) => {
    const progBadge = r.prog === "degree"
      ? "<span class='badge badge-degree'>Degree</span>"
      : "<span class='badge badge-diploma'>Diploma</span>";
    // Build safe inline onclick args
    const args = [r.prog, r.branch, r.sem, r.name]
      .map(v => `'${String(v).replace(/\\/g,"\\\\").replace(/'/g,"\\'")}'`)
      .join(",");
    return `<tr>
      <td style="color:var(--text-sub);font-size:0.78rem">${i+1}</td>
      <td><strong>${esc(r.name)}</strong></td>
      <td>${esc(r.branch)}</td>
      <td><span class="badge badge-orange">${esc(r.sem)}</span></td>
      <td>${progBadge}</td>
      <td><button class="action-btn delete" onclick="subjDeleteSubject(${args})">🗑️ Delete</button></td>
    </tr>`;
  }).join("");
};

// Populate branch filter dropdown when program filter changes
window.subjOnFilterProgramChange = function() {
  const prog      = document.getElementById("subj-filter-program").value;
  const branchSel = document.getElementById("subj-filter-branch");
  branchSel.innerHTML = "<option value=''>All Branches</option>";
  if (prog) {
    (branches[prog] || []).forEach(b => {
      const o = document.createElement("option");
      o.value = b; o.textContent = b;
      branchSel.appendChild(o);
    });
  }
  subjRenderTable();
};

/* ══════════════════════════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════════════════════════ */
window.openDeleteModal = function(type, id, label) {
  deleteTarget = { type, id, label };
  const descriptions = {
    note:    `Are you sure you want to delete the note <strong>"${label}"</strong>? This cannot be undone.`,
    branch:  `Are you sure you want to delete the branch <strong>"${label}"</strong>? Notes under this branch will remain but the branch won't appear in dropdowns.`,
    subject: `Are you sure you want to delete the subject <strong>"${label}"</strong>? Notes under this subject will remain but the subject won't appear in dropdowns.`
  };
  document.getElementById("modal-title").textContent =
    "Delete " + type.charAt(0).toUpperCase() + type.slice(1) + "?";
  document.getElementById("modal-desc").innerHTML =
    descriptions[type] || "This action cannot be undone.";
  document.getElementById("delete-modal").classList.add("open");
};

window.closeModal = function() {
  document.getElementById("delete-modal").classList.remove("open");
  deleteTarget = null;
};

window.confirmDelete = async function() {
  if (!deleteTarget) return;
  const btn = document.getElementById("modal-confirm-btn");
  btn.textContent = "Deleting…"; btn.disabled = true;

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
    }

    closeModal();
  } catch (err) {
    console.error("Delete error:", err);
    showToast("Failed to delete. Try again.", "error");
  } finally {
    btn.textContent = "Delete"; btn.disabled = false;
  }
};

/* ══════════════════════════════════════════════════════════
   TOGGLE ADD FORM  (used for branches only;
   subjects use subjToggleForm)
══════════════════════════════════════════════════════════ */
window.toggleAddForm = function(type) {
  const form   = document.getElementById(`add-${type}-form`);
  const toggle = document.getElementById(`add-${type}-toggle`);
  const isOpen = form.classList.contains("open");
  form.classList.toggle("open", !isOpen);
  if (toggle) {
    toggle.classList.toggle("open", !isOpen);
    toggle.textContent = isOpen
      ? `+ Add ${type.charAt(0).toUpperCase() + type.slice(1)}`
      : "✕ Cancel";
  }
};

/* ══════════════════════════════════════════════════════════
   UPDATE NAV COUNTS
══════════════════════════════════════════════════════════ */
function updateNavCounts() {
  const totalBranches = (branches.degree||[]).length + (branches.diploma||[]).length;
  const totalSubjects = countSubjects();
  document.getElementById("nav-notes-count").textContent   = allNotes.length;
  document.getElementById("nav-branch-count").textContent  = totalBranches;
  document.getElementById("nav-subject-count").textContent = totalSubjects;
  document.getElementById("stat-branches").textContent     = totalBranches;
  document.getElementById("stat-subjects").textContent     = totalSubjects;
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
  toastTimer = setTimeout(() => toast.classList.remove("show"), type === "success" ? 2800 : 4000);
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function esc(str) {
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}