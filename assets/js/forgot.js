// /assets/js/forgot.js
// Firebase v12.4.0 password-reset logic, split into a standalone module.

import { auth } from '/assets/js/firebase-init.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';

function show(el, text) { el.textContent = text; el.style.display = ''; }
function hide(el) { el.style.display = 'none'; el.textContent = ''; }

// Where the user lands after clicking the reset link in their email.
// Adjust if you have a dedicated “reset-complete” page.
const actionCodeSettings = {
    url: window.location.origin + '/',
    handleCodeInApp: false
};

function wireForgotForm() {
    const form = document.getElementById('forgot-form');
    const emailEl = document.getElementById('forgot-email');
    const submit = document.getElementById('forgot-submit');
    const msgEl = document.getElementById('forgot-msg');
    const errEl = document.getElementById('forgot-error');

    if (!form || !emailEl || !submit || !msgEl || !errEl) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hide(errEl);
        hide(msgEl);

        const email = (emailEl.value || '').trim().toLowerCase();
        if (!email) {
            show(errEl, 'Please enter your email address.');
            return;
        }

        submit.disabled = true;

        try {
            await sendPasswordResetEmail(auth, email, actionCodeSettings);
            // Neutral UX to avoid account enumeration.
            show(msgEl, 'If an account exists for that email, a password reset link has been sent.');
            form.reset();
        } catch (err) {
            if (err?.code === 'auth/invalid-email') {
                show(errEl, 'That email address is not valid. Please check the format.');
            } else {
                // Covers user-not-found and other cases without leaking existence.
                show(msgEl, 'If an account exists for that email, a password reset link has been sent.');
            }
        } finally {
            submit.disabled = false;
        }
    });
}

// Module scripts are deferred by default, but this ensures safety
// even if the script is moved into <head>.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireForgotForm);
} else {
    wireForgotForm();
}