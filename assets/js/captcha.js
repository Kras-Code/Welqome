
    (function () {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      // Require a reCAPTCHA token before posting to Formspree
      const ok = (typeof grecaptcha !== 'undefined') && (grecaptcha.getResponse().length > 0);
    if (!ok) {
        e.preventDefault();
    const status = document.getElementById('form-status');
    if (status) status.textContent = 'Please complete the reCAPTCHA to prove you are human.';
    try {document.querySelector('.g-recaptcha iframe')?.focus(); } catch (_) { }
      }
    });
  })();

