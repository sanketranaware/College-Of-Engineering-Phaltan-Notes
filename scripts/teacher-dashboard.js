import { auth } from "./firebase.js";
import { db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ─────────────────────────────────────────────
   Data
───────────────────────────────────────────── */
var BRANCHES = {
  degree: [ "Electronics & Communication", "Civil Engineering", "Mechanical Engineering", "Artificial Intelligence"],
  diploma: ["Computer Science", "Electronics & Communication", "Civil Engineering", "Mechanical Engineering"]
};

var YEARS = {
  degree: ["Year 1", "Year 2", "Year 3", "Year 4"],
  diploma: ["Year 1", "Year 2", "Year 3"]
};

var SEMS = {
  "Year 1": ["Semester 1", "Semester 2"],
  "Year 2": ["Semester 3", "Semester 4"],
  "Year 3": ["Semester 5", "Semester 6"],
  "Year 4": ["Semester 7", "Semester 8"]
};

var SUBJECTS = {
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

/* ─────────────────────────────────────────────
   Auth guard
───────────────────────────────────────────── */
onAuthStateChanged(auth, function (user) {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  var name = user.displayName || user.email.split("@")[0];
  name = name.charAt(0).toUpperCase() + name.slice(1);
  var sub = document.getElementById("welcome-sub");
  if (sub) sub.textContent = "Welcome back, " + name + " — fill in the details below";
});

/* ─────────────────────────────────────────────
   Wire all event listeners after DOM is ready
───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {

  /* Logout button */
  var logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      await signOut(auth);
      window.location.href = "login.html";
    });
  }

  /* Upload another button */
  var anotherBtn = document.getElementById("upload-another-btn");
  if (anotherBtn) {
    anotherBtn.addEventListener("click", resetForm);
  }

  /* Program dropdown → populate branches + years */
  var programSel = document.getElementById("f-program");
  if (programSel) {
    programSel.addEventListener("change", updateBranches);
  }

  /* Year dropdown → populate semesters */
  var yearSel = document.getElementById("f-year");
  if (yearSel) {
    yearSel.addEventListener("change", updateSems);
  }

  /* Semester dropdown → populate subjects */
  var semSel = document.getElementById("f-sem");
  if (semSel) {
    semSel.addEventListener("change", updateSubjects);
  }

  /* Drive link live validation */
  var linkInput = document.getElementById("f-drivelink");
  if (linkInput) {
    linkInput.addEventListener("input", function () {
      validateDriveLink(this.value);
    });
  }

  /* Live clear errors on selects */
  ["program", "branch", "year", "sem", "subject", "unit"].forEach(function (id) {
    var el = document.getElementById("f-" + id);
    if (el) el.addEventListener("change", function () { clearErr(id); });
  });

  /* Live clear errors on text inputs */
  ["subject", "unitname"].forEach(function (id) {
    var el = document.getElementById("f-" + id);
    if (el) el.addEventListener("input", function () { clearErr(id); });
  });

  /* Form submit — the main handler */
  var form = document.getElementById("upload-form");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      console.log("Form submitted");

      if (!validateForm()) {
        console.log("Validation failed");
        return;
      }

      var user = auth.currentUser;
      if (!user) {
        console.log("No user logged in — redirecting");
        window.location.href = "login.html";
        return;
      }

      // Collect values
      var program = document.getElementById("f-program").value;
      var branch = document.getElementById("f-branch").value;
      var year = document.getElementById("f-year").value;
      var sem = document.getElementById("f-sem").value;
      var subject = document.getElementById("f-subject").value;
      var unitNum = document.getElementById("f-unit").value;
      var unitName = document.getElementById("f-unitname").value.trim();
      var driveLink = document.getElementById("f-drivelink").value.trim();

      console.log("Saving:", program, branch, year, sem, subject, unitNum, unitName, driveLink);

      // Loading state
      var btn = document.getElementById("up-submit");
      var spinner = document.getElementById("up-spinner");
      var btnText = document.getElementById("up-btn-text");
      btn.disabled = true;
      btn.classList.add("loading");
      spinner.style.display = "block";
      btnText.textContent = "Saving…";

      try {
        var docRef = await addDoc(collection(db, "notes"), {
          program: program,
          branch: branch,
          year: year,
          semester: sem,
          subject: subject,
          unitNumber: parseInt(unitNum),
          unitName: unitName,
          driveLink: driveLink,
          uploadedBy: user.email,
          uploadedAt: serverTimestamp()
        });

        console.log("Saved successfully, doc ID:", docRef.id);

        // Reset button
        btn.disabled = false;
        btn.classList.remove("loading");
        spinner.style.display = "none";
        btnText.textContent = "Save Notes";

        // Show success screen
        document.getElementById("upload-form").style.display = "none";
        document.getElementById("up-success").classList.add("visible");

      } catch (error) {
        console.error("Firestore error:", error.code, error.message);

        btn.disabled = false;
        btn.classList.remove("loading");
        spinner.style.display = "none";
        btnText.textContent = "Save Notes";

        alert("Failed to save notes.\n\nError: " + error.message + "\n\nCheck the console for details.");
      }
    });
  }
});

/* ─────────────────────────────────────────────
   Cascading dropdowns
───────────────────────────────────────────── */
function updateBranches() {
  var prog = document.getElementById("f-program").value;
  var bSelect = document.getElementById("f-branch");
  var ySelect = document.getElementById("f-year");
  var sSelect = document.getElementById("f-sem");
  var subjSelect = document.getElementById("f-subject");

  bSelect.innerHTML = '<option value="">Select Branch</option>';
  ySelect.innerHTML = '<option value="">Select Year</option>';
  sSelect.innerHTML = '<option value="">Select Semester</option>';
  subjSelect.innerHTML = '<option value="">Select Subject</option>';
  bSelect.disabled = true;
  ySelect.disabled = true;
  sSelect.disabled = true;
  subjSelect.disabled = true;

  if (!prog) return;

  BRANCHES[prog].forEach(function (b) {
    var opt = document.createElement("option");
    opt.value = b; opt.textContent = b;
    bSelect.appendChild(opt);
  });
  bSelect.disabled = false;

  YEARS[prog].forEach(function (y) {
    var opt = document.createElement("option");
    opt.value = y; opt.textContent = y;
    ySelect.appendChild(opt);
  });
  ySelect.disabled = false;

  clearErr("program");
}

function updateSems() {
  var year = document.getElementById("f-year").value;
  var sSelect = document.getElementById("f-sem");
  var subjSelect = document.getElementById("f-subject");

  sSelect.innerHTML = '<option value="">Select Semester</option>';
  sSelect.disabled = true;
  subjSelect.innerHTML = '<option value="">Select Subject</option>';
  subjSelect.disabled = true;

  if (!year) return;

  SEMS[year].forEach(function (s) {
    var opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    sSelect.appendChild(opt);
  });
  sSelect.disabled = false;
  clearErr("year");
}

function updateSubjects() {
  var program = document.getElementById("f-program").value;
  var sem = document.getElementById("f-sem").value;
  var subjSelect = document.getElementById("f-subject");

  subjSelect.innerHTML = '<option value="">Select Subject</option>';
  subjSelect.disabled = true;

  if (!sem || !program) return;

  var subjectList = SUBJECTS[program] && SUBJECTS[program][sem] ? SUBJECTS[program][sem] : [];

  subjectList.forEach(function (subj) {
    var opt = document.createElement("option");
    opt.value = subj; opt.textContent = subj;
    subjSelect.appendChild(opt);
  });
  subjSelect.disabled = false;
  clearErr("sem");
}

/* ─────────────────────────────────────────────
   Drive link validation
───────────────────────────────────────────── */
function isDriveLink(url) {
  return /https:\/\/drive\.google\.com\/(file\/d\/|drive\/|open\?id=|uc\?)/.test(url);
}

function validateDriveLink(val) {
  var icon = document.getElementById("link-icon");
  var preview = document.getElementById("link-preview");
  var previewUrl = document.getElementById("link-preview-url");

  clearErr("drivelink");

  if (!val) {
    icon.className = "link-verify-icon";
    preview.classList.remove("show");
    return;
  }

  if (isDriveLink(val)) {
    icon.className = "link-verify-icon show valid";
    icon.textContent = "✓";
    preview.classList.add("show");
    previewUrl.href = val;
    previewUrl.textContent = val.length > 60 ? val.substring(0, 60) + "…" : val;
  } else {
    icon.className = "link-verify-icon show invalid";
    icon.textContent = "✕";
    preview.classList.remove("show");
  }
}

/* ─────────────────────────────────────────────
   Validation helpers
───────────────────────────────────────────── */
function showErr(id) {
  var err = document.getElementById("err-" + id);
  var field = document.getElementById("f-" + id);
  if (err) err.classList.add("visible");
  if (field) field.classList.add("error");
}

function clearErr(id) {
  var err = document.getElementById("err-" + id);
  var field = document.getElementById("f-" + id);
  if (err) err.classList.remove("visible");
  if (field) field.classList.remove("error");
}

function validateForm() {
  var valid = true;

  ["program", "branch", "year", "sem", "subject", "unit"].forEach(function (id) {
    var el = document.getElementById("f-" + id);
    if (!el || !el.value.trim()) { showErr(id); valid = false; }
    else clearErr(id);
  });

  ["unitname"].forEach(function (id) {
    var el = document.getElementById("f-" + id);
    if (!el || !el.value.trim()) { showErr(id); valid = false; }
    else clearErr(id);
  });

  var link = document.getElementById("f-drivelink").value.trim();
  if (!link || !isDriveLink(link)) {
    showErr("drivelink");
    valid = false;
  } else {
    clearErr("drivelink");
  }

  return valid;
}

/* ─────────────────────────────────────────────
   Reset form
───────────────────────────────────────────── */
function resetForm() {
  var form = document.getElementById("upload-form");
  form.reset();
  form.style.display = "";
  document.getElementById("up-success").classList.remove("visible");

  var icon = document.getElementById("link-icon");
  var preview = document.getElementById("link-preview");
  if (icon) icon.className = "link-verify-icon";
  if (preview) preview.classList.remove("show");

  ["program", "branch", "year", "sem", "unit", "subject", "unitname", "drivelink"]
    .forEach(clearErr);

  var bSelect = document.getElementById("f-branch");
  var ySelect = document.getElementById("f-year");
  var sSelect = document.getElementById("f-sem");
  if (bSelect) { bSelect.innerHTML = '<option value="">Select Branch</option>'; bSelect.disabled = true; }
  if (ySelect) { ySelect.innerHTML = '<option value="">Select Year</option>'; ySelect.disabled = true; }
  if (sSelect) { sSelect.innerHTML = '<option value="">Select Semester</option>'; sSelect.disabled = true; }
}