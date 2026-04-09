/**
 * Firebase Database Operations - CLEAN VERSION
 * No default data, only Firestore
 */

import { auth, db } from "./firebase.js";
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    serverTimestamp,
    getDoc,
    setDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ════════════════════════════════════════════════════════════
   BRANCHES - Get all branches for a program
════════════════════════════════════════════════════════════ */

export async function getBranches(program = "degree") {
    try {
        const snap = await getDoc(doc(db, "admin_config", "data"));

        if (!snap.exists()) {
            return [];
        }

        const data = snap.data();
        return data.branches?.[program] || [];

    } catch (err) {
        console.error("getBranches error:", err);
        return [];
    }
}

/* ════════════════════════════════════════════════════════════
   YEARS - Static (can keep this)
════════════════════════════════════════════════════════════ */

export async function getYears(program = "degree") {
    const yearMap = {
        degree: ["Year 1", "Year 2", "Year 3", "Year 4"],
        diploma: ["Year 1", "Year 2", "Year 3"]
    };
    return yearMap[program] || [];
}

/* ════════════════════════════════════════════════════════════
   SUBJECTS - Get subjects for a semester
════════════════════════════════════════════════════════════ */

export async function getSubjectsBySemester(program = "degree", semester = "Semester 1") {
    try {
        const snap = await getDoc(doc(db, "admin_config", "data"));

        if (!snap.exists()) {
            return [];
        }

        const data = snap.data();
        return data.subjects?.[program]?.[semester] || [];

    } catch (err) {
        console.error("getSubjectsBySemester error:", err);
        return [];
    }
}

/* ════════════════════════════════════════════════════════════
   NOTES - Get notes for a subject
════════════════════════════════════════════════════════════ */

export async function getNotesBySubject(program, branch, year, subjectName) {
    try {
        const q = query(
            collection(db, "notes"),
            where("program", "==", program),
            where("branch", "==", branch),
            where("year", "==", year),
            where("subject", "==", subjectName),
            orderBy("unitNumber", "asc")
        );

        const snap = await getDocs(q);

        return snap.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));

    } catch (err) {
        console.error("getNotesBySubject error:", err);
        return [];
    }
}

/* ════════════════════════════════════════════════════════════
   NOTES - Add new note
════════════════════════════════════════════════════════════ */

export async function addNote(noteData) {
    try {
        const docRef = await addDoc(collection(db, "notes"), {
            ...noteData,
            uploadedAt: serverTimestamp(),
            uploadedBy: auth.currentUser?.email || "unknown"
        });

        return docRef.id;

    } catch (err) {
        console.error("addNote error:", err);
        throw err;
    }
}

/* ════════════════════════════════════════════════════════════
   NOTES - Get all notes (admin)
════════════════════════════════════════════════════════════ */

export async function getAllNotes() {
    try {
        const q = query(collection(db, "notes"), orderBy("uploadedAt", "desc"));
        const snap = await getDocs(q);

        return snap.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));

    } catch (err) {
        console.error("getAllNotes error:", err);
        return [];
    }
}

/* ════════════════════════════════════════════════════════════
   NOTES - Delete note
════════════════════════════════════════════════════════════ */

export async function deleteNote(noteId) {
    try {
        await deleteDoc(doc(db, "notes", noteId));
    } catch (err) {
        console.error("deleteNote error:", err);
        throw err;
    }
}

/* ════════════════════════════════════════════════════════════
   CONFIG - Update branches
════════════════════════════════════════════════════════════ */

export async function updateBranches(program, branches) {
    try {
        const docRef = doc(db, "admin_config", "data");
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            data.branches = data.branches || {};
            data.branches[program] = branches;
            await setDoc(docRef, data);
        } else {
            await setDoc(docRef, {
                branches: { [program]: branches },
                subjects: {}
            });
        }

    } catch (err) {
        console.error("updateBranches error:", err);
        throw err;
    }
}

/* ════════════════════════════════════════════════════════════
   CONFIG - Update subjects
════════════════════════════════════════════════════════════ */

export async function updateSubjects(program, subjects) {
    try {
        const docRef = doc(db, "admin_config", "data");
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            data.subjects = data.subjects || {};
            data.subjects[program] = subjects;
            await setDoc(docRef, data);
        } else {
            await setDoc(docRef, {
                branches: {},
                subjects: { [program]: subjects }
            });
        }

    } catch (err) {
        console.error("updateSubjects error:", err);
        throw err;
    }
}

/* ════════════════════════════════════════════════════════════
   REAL-TIME NOTES LISTENER
════════════════════════════════════════════════════════════ */

export function onNotesUpdate(program, branch, year, subjectName, callback) {
    try {
        const q = query(
            collection(db, "notes"),
            where("program", "==", program),
            where("branch", "==", branch),
            where("year", "==", year),
            where("subject", "==", subjectName),
            orderBy("unitNumber", "asc")
        );

        return onSnapshot(q, (snap) => {
            const notes = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            callback(notes);
        });

    } catch (err) {
        console.error("onNotesUpdate error:", err);
        return null;
    }
}