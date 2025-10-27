
  // 1) Get the shared initialized app/auth
    import {auth} from "/assets/js/firebase-init.js";

    // 2) Import the Auth APIs you’ll use
    import {
        signInWithEmailAndPassword,
        onAuthStateChanged
    } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

    // 3) Elements
    const form   = document.getElementById('login-form');
    const email  = document.getElementById('email');
    const pass   = document.getElementById('password');
    const errEl  = document.getElementById('error');
    const logout = document.getElementById('logout');

    // 4) Where to go after successful login
    // If your dashboard is a file, use "/members.html"; if it’s a folder with index.html, use "/members/"
    const DASHBOARD_URL = "dashboard.html";

  // Optional: if already signed in, skip the form and go straight to dashboard
  onAuthStateChanged(auth, (user) => {
    if (user) {
        // You can comment this out during testing to see the form while signed in
        location.replace(DASHBOARD_URL);
    }
  });

  // 5) Handle submit
  form?.addEventListener('submit', async (e) => {
        e.preventDefault();
    errEl.style.display = 'none';
    const btn = form.querySelector('button[type="submit"]');
    btn?.setAttribute('disabled', 'true');

    try {
      const emailVal = email.value.trim();
    const passVal  = pass.value;
    await signInWithEmailAndPassword(auth, emailVal, passVal);
    // Redirect on success
    location.replace(DASHBOARD_URL);
    } catch (err) {
      // Friendlier messages for common errors
      const map = {
        "auth/invalid-credential": "Invalid email or password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found for this email.",
    "auth/wrong-password": "Incorrect password."
      };
    errEl.textContent = map[err.code] || err.message || "Sign-in failed.";
    errEl.style.display = 'block';
    } finally {
        btn?.removeAttribute('disabled');
    }
  });

  // 6) (Optional) Sign out button if you keep it on this page
  logout?.addEventListener('click', async () => {
    const {signOut} = await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js");
    await signOut(auth);
    // After sign-out you might want to stay on login
    // location.replace("/login/");
  });