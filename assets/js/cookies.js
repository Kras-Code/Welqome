(() => {
    const CONSENT_KEY = 'wq.cookieConsent';
    const CONSENT_VERSION = 1; // bump if your categories/policy meaningfully change

    const $banner = document.getElementById('wq-cookie-banner');
    const $modal = document.getElementById('wq-cookie-modal');
    const $dialog = $modal?.querySelector('.wq-cookie__dialog');

    // Helpers
    const nowISO = () => new Date().toISOString();
    const defaultConsent = () => ({
        version: CONSENT_VERSION,
        timestamp: nowISO(),
        essential: true,
        functional: false,
        analytics: false,
        marketing: false
    });

    function readConsent() {
        try {
            const raw = localStorage.getItem(CONSENT_KEY);
            if (!raw) return null;
            const c = JSON.parse(raw);
            if (!c || typeof c !== 'object') return null;
            if (c.version !== CONSENT_VERSION) return null; // re-ask on version change
            return c;
        } catch { return null; }
    }

    function saveConsent(c) {
        const payload = { ...c, version: CONSENT_VERSION, timestamp: nowISO() };
        localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
        applyConsent(payload);
    }

    // Gate third-party scripts by category.
    // Pattern: <script type="text/plain" data-cookie-category="analytics" data-src="..."></script>
    function activatePendingScripts(consent) {
        const pending = document.querySelectorAll('script[type="text/plain"][data-cookie-category]:not([data-activated])');
        pending.forEach(el => {
            const cat = String(el.dataset.cookieCategory || '').toLowerCase();
            const allowed =
                (cat === 'functional' && consent.functional) ||
                (cat === 'analytics' && consent.analytics) ||
                (cat === 'marketing' && consent.marketing);

            if (!allowed) return;

            const s = document.createElement('script');
            // Allow inline blocks or external via data-src
            const src = el.dataset.src;
            if (src) s.src = src;
            // Copy booleans if present
            if (el.dataset.async !== undefined) s.async = true;
            if (el.dataset.defer !== undefined) s.defer = true;
            // Transfer inline content if any
            if (!src && el.textContent) s.text = el.textContent;

            // Preserve nonce/integrity if provided
            if (el.nonce) s.nonce = el.nonce;
            if (el.integrity) s.integrity = el.integrity;
            if (el.referrerPolicy) s.referrerPolicy = el.referrerPolicy;
            if (el.crossOrigin) s.crossOrigin = el.crossOrigin;

            el.replaceWith(s);
            el.dataset.activated = 'true';
        });
    }

    // Optional: Update Google Consent Mode v2 if gtag is present
    function updateGTag(consent) {
        if (typeof window.gtag !== 'function') return;
        const granted = v => v ? 'granted' : 'denied';
        window.gtag('consent', 'update', {
            analytics_storage: granted(consent.analytics),
            ad_storage: granted(consent.marketing),
            ad_user_data: granted(consent.marketing),
            ad_personalization: granted(consent.marketing),
            functionality_storage: granted(consent.functional),
            security_storage: 'granted' // essential only
        });
    }

    function applyConsent(c) {
        // Fire any hooks your app may need
        document.documentElement.dispatchEvent(new CustomEvent('wq:cookie-consent', { detail: c }));
        // Update gtag if present
        updateGTag(c);
        // Activate queued scripts
        activatePendingScripts(c);
        // Hide UIs
        hideBanner();
        closeModal();
    }

    // UI control
    function showBanner() { if ($banner) { $banner.setAttribute('aria-hidden', 'false'); } }
    function hideBanner() { if ($banner) { $banner.setAttribute('aria-hidden', 'true'); } }

    function openModal() {
        if (!$modal) return;
        $modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // 1. If user has already saved consent, mirror their real choices.
        const stored = readConsent();

        // 2. If no stored consent yet, just *pre-fill the UI* to "all on".
        //    This does NOT apply consent – it only changes the checkbox state.
        const uiState = stored || {
            ...defaultConsent(),
            functional: true,
            analytics: true,
            marketing: true
        };

        setSwitch('#wq-cc-functional', uiState.functional);
        setSwitch('#wq-cc-analytics', uiState.analytics);
        setSwitch('#wq-cc-marketing', uiState.marketing);

        queueMicrotask(() => $dialog?.focus());
    }

    function closeModal() {
        if (!$modal) return;
        $modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    function setSwitch(sel, on) {
        const el = document.querySelector(sel);
        if (el) el.checked = !!on;
    }

    // Bindings
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-wq-cc]');
        if (!btn) return;
        const action = btn.getAttribute('data-wq-cc');

        if (action === 'open-modal') { openModal(); }
        else if (action === 'accept-all') {
            saveConsent({ ...defaultConsent(), functional: true, analytics: true, marketing: true });
        } else if (action === 'essential-only' || action === 'deny-all') {
            saveConsent({ ...defaultConsent(), functional: false, analytics: false, marketing: false });
        } else if (action === 'save') {
            const consent = {
                ...defaultConsent(),
                functional: !!document.getElementById('wq-cc-functional')?.checked,
                analytics: !!document.getElementById('wq-cc-analytics')?.checked,
                marketing: !!document.getElementById('wq-cc-marketing')?.checked
            };
            saveConsent(consent);
        }
    });

    // Close modal on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && $modal?.getAttribute('aria-hidden') === 'false') {
            closeModal();
        }
    });

    // Public hook to reopen preferences: add [data-cookie-open] to any link/button
    document.addEventListener('click', (e) => {
        const t = e.target.closest('[data-cookie-open]');
        if (t) { e.preventDefault(); openModal(); }
    });

    // Initialise
    (function init() {
        const c = readConsent();
        if (c) {
            // Apply stored consent at boot (enables eligible scripts)
            applyConsent(c);
        } else {
            // Default to essential-only and show banner for choice
            // (But do not save until user acts)
            showBanner();
            updateGTag(defaultConsent()); // set Consent Mode defaults if gtag present
        }
    })();
})();