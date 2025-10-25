(function () {
    const SITE_KEY = '6Lc9b_MrAAAAAExSWVuAKc7oL68rB3VF0Mpk0-mE';            // paste your v3 site key
    const ACTION = 'contact_submit';               // any string; must match server check
    const form = document.getElementById('contactForm');
    const tokenEl = document.getElementById('gRecaptchaToken');

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        grecaptcha.ready(function () {
            grecaptcha.execute(SITE_KEY, { action: ACTION })
                .then(function (token) {
                    tokenEl.value = token;
                    form.submit();
                })
                .catch(function (err) {
                    console.error('reCAPTCHA v3 execute() failed', err);
                    alert('reCAPTCHA could not run. Please refresh and try again.');
                });
        });
    });
})();