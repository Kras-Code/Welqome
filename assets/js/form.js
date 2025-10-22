/* /assets/js/wq-contact.js */
(() => {
    // Ensure DOM is parsed (when not using `defer`, wrap in DOMContentLoaded)
    const form = document.getElementById('contact-form');
    if (!form) return;

    /* =========================================
     * 1) "Other" referrer → show inline “Where?”
     * ========================================= */
    const sel = form.querySelector('#referrer');
    const wrap = form.querySelector('#referrer_other_wrap'); // <div hidden>
    const other = form.querySelector('#referrer_other');      // <input type="text">

    if (sel && wrap && other) {
        function syncOtherField() {
            const isOther = (sel.value || '').toLowerCase() === 'other';
            wrap.hidden = !isOther;
            other.required = isOther;
            other.disabled = !isOther;
            if (!isOther) other.value = '';
            sel.setAttribute('aria-expanded', isOther ? 'true' : 'false');
        }
        sel.setAttribute('aria-controls', 'referrer_other_wrap');
        sel.addEventListener('change', syncOtherField);
        syncOtherField(); // initial state (incl. BFCache)
    }

    /* ======================================================
     * 2) Company field accepts name OR URL + maps to hidden
     *    inputs: company_name OR company_url (not both)
     * ====================================================== */
    const companyInput = form.querySelector('#company');        // visible text input
    const nameHidden = form.querySelector('#company_name');   // <input type="hidden">
    const urlHidden = form.querySelector('#company_url');    // <input type="hidden">

    if (companyInput && nameHidden && urlHidden) {
        function looksLikeURL(v) {
            const s = (v || '').trim();
            return /^https?:\/\//i.test(s) || /^www\./i.test(s) || s.includes('.');
        }

        function normalizeURL(v) {
            let s = (v || '').trim();
            if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
            try { return new URL(s).href; } catch { return null; }
        }

        form.addEventListener('submit', (e) => {
            // reset mapping
            nameHidden.value = '';
            urlHidden.value = '';
            companyInput.setCustomValidity('');

            const raw = (companyInput.value || '').trim();
            if (!raw) {
                companyInput.setCustomValidity('Please provide your company name or website.');
                companyInput.reportValidity();
                e.preventDefault();
                return;
            }

            if (looksLikeURL(raw)) {
                const href = normalizeURL(raw);
                if (!href) {
                    companyInput.setCustomValidity('Please enter a valid URL (e.g., https://example.com) or a company name.');
                    companyInput.reportValidity();
                    e.preventDefault();
                    return;
                }
                urlHidden.value = href;   // submit as company_url
            } else {
                nameHidden.value = raw;   // submit as company_name
            }
        });
    }
})();
