import { db } from "./firebase.js";
import {
    collection,
    query,
    where,
    orderBy,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ─────────────────────────────────────────────
   Data (mirrored from teacher-dashboard.js)
───────────────────────────────────────────── */
var BRANCHES = {
  degree: ["Computer Engineering", "Mechanical Engineering", "AI & Data Science", "ENTC Engineering", "Civil Engineering"],
  diploma: ["Computer Engineering", "Mechanical Engineering", "ENTC Engineering", "Civil Engineering"]
};

var YEARS = {
  degree: ["First Year", "Second Year", "Third Year", "Fourth Year"],
  diploma: ["First Year", "Second Year", "Third Year"]
};

var SEMS = {
  "First Year": ["Semester 1", "Semester 2"],
  "Second Year": ["Semester 3", "Semester 4"],
  "Third Year": ["Semester 5", "Semester 6"],
  "Fourth Year": ["Semester 7", "Semester 8"]
};

var SUBJECTS = {
  degree: {
    "Semester 1": ["Data Structures", "Programming Fundamentals", "Digital Logic Design", "Mathematics I"],
    "Semester 2": ["Database Management ", "Web Development", "Discrete Mathematics", "Physics"],
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
   Main
───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async function () {

    var container = document.getElementById("notes-container");
    if (!container) return;

    var program  = document.body.dataset.program;
    var branch   = document.body.dataset.branch;
    var year     = document.body.dataset.year;
    var semester = document.body.dataset.semester;
    var subject  = document.body.dataset.subject;

    if (!program || !BRANCHES[program]) return hideSection();
    if (!branch || !BRANCHES[program].includes(branch)) return hideSection();
    if (!year || !YEARS[program].includes(year)) return hideSection();
    if (!semester || !SEMS[year].includes(semester)) return hideSection();
    if (!subject || !(SUBJECTS[program][semester] || []).includes(subject)) return hideSection();

    container.innerHTML = '<p class="nv-loading">Loading notes…</p>';

    try {
        var q = query(
            collection(db, "notes"),
            where("program",  "==", program),
            where("branch",   "==", branch),
            where("year",     "==", year),
            where("semester", "==", semester),
            where("subject",  "==", subject),
            orderBy("unitNumber", "asc")
        );

        var snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = '<p class="nv-empty">No notes uploaded for this subject yet.</p>';
            container.style.display = "flex";
            container.style.justifyContent = "center";
            container.style.alignItems = "center";
            hideSection();
            return;
        }

        showSection();

        var html = "";
        snap.forEach(function (doc) {
            html += makeCard(doc.data());
        });
        container.innerHTML = html;

    } catch (err) {
        console.error("notes-viewer error:", err.code, err.message);
        container.innerHTML = "";
        hideSection();
    }
});

/* ───────────────────────────────────────────── */
function showSection() {
    var s = document.getElementById("dynamic-section");
    if (s) s.style.display = "flex";
}

function hideSection() {
    var s = document.getElementById("dynamic-section");
    if (s) s.style.display = "none";
}

/* ───────────────────────────────────────────── */
function makeCard(d) {
    var link = d.driveLink || "#";
    return (
        '<a class="nv-card" href="' + link + '" target="_blank">' +
            '<div class="nv-unit-badge">Unit<br>' + esc(d.unitNumber || "?") + '</div>' +
            '<div class="nv-card-body">' +
                '<div class="nv-unit-sub">' + esc(d.subject || "") + '</div>' +
            '</div>' +
            '<div class="nv-card-arrow">→</div>' +
        '</a>'
    );
}

/* ───────────────────────────────────────────── */
function esc(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
