// /assets/js/firebase-init.js
import { initializeApp, getApps, getApp }
    from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth }
    from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCQcNfuEgyabzrmKwJGuaM1q45HuMbZv9o",
    authDomain: "welqome-login.firebaseapp.com",
    projectId: "welqome-login",
    storageBucket: "welqome-login.firebasestorage.app", // verify in Console
    messagingSenderId: "603864042555",
    appId: "1:603864042555:web:5b40b000cc75d4dc91201e",
    measurementId: "G-ETRQ7G1895" // optional
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
