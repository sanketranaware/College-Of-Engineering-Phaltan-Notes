
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCOJghicdvhQ72GVTVBxH16HzDk2_U575c",
  authDomain: "college-notes-f54b0.firebaseapp.com",
  databaseURL: "https://college-notes-f54b0-default-rtdb.firebaseio.com",
  projectId: "college-notes-f54b0",
  storageBucket: "college-notes-f54b0.firebasestorage.app",
  messagingSenderId: "749520969047",
  appId: "1:749520969047:web:58fa26858261fb1a6ef212",
  measurementId: "G-ENEZKB8VYW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
export const db   = getFirestore(app); 