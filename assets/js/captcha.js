(function () {
    const form = document.getElementById('contact-form');
    const statusEl = document.getElementById('form-status');
    if (!form) return;

    // Toggle “Other” requiredness only when visible
    const refSel = document.getElementById('referrer');
    const otherWrap = document.getElementById('referrer_other_wrap');
    const otherInput = document.getElementById('referrer_other');

    function syncOther() {
        const show = refSel && refSel.value === 'Other';
        if (otherWrap) otherWrap.hidden = !show;
        if (otherInput) {
            otherInput.required = show;
            otherInput.disabled = !show;
            if (!show) otherInput.value = '';
        }
    }
    if (refSel) {
        syncOther();
        refSel.addEventListener('change', syncOther);
    }

    form.addEventListener('submit', function (e) {
        // 1) Let native validation decide first
        if (!form.checkValidity()) {
            e.preventDefault();
            form.classList.add('was-validated');   // <-- enables CSS error rings
            form.reportValidity();
            return;
        }

        // 2) Require reCAPTCHA v2 checkbox
        const hasToken = (typeof grecaptcha !== 'undefined') && grecaptcha.getResponse().length > 0;
        if (!hasToken) {
            e.preventDefault();
            form.classList.add('was-validated');   // keep error styling active
            if (statusEl) statusEl.textContent = 'Please complete the reCAPTCHA to prove you are human.';
            try { document.querySelector('.g-recaptcha iframe')?.focus(); } catch (_) { }
            return;
        }

        // 3) (Optional) Normalize company field into name/url prior to submit
        const company = document.getElementById('company');
        const companyName = document.getElementById('company_name');
        const companyUrl = document.getElementById('company_url');
        if (company && companyName && companyUrl) {
            const v = company.value.trim();
            if (/^https?:\/\//i.test(v) || v.includes('.')) {
                companyUrl.value = v;
                companyName.value = '';
            } else {
                companyName.value = v;
                companyUrl.value = '';
            }
        }
    });
})();