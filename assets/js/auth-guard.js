// Redirects unauthenticated users to /login/
import { auth } from "/assets/js/firebase-init.js";
import { onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const LOGIN_URL = "/login/";

document.documentElement.style.visibility = "hidden";
onAuthStateChanged(auth, (user) => {
    if (!user) location.replace(LOGIN_URL);
    else document.documentElement.style.visibility = "visible";
});