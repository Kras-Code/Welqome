/**
    * Flashcards: accessible 3D flip interaction
    * - Click / Enter / Space toggles flip (aria-pressed)
    * - Data-driven generation from CARDS array
    * - No external dependencies
    */

    const CARDS = [
    {
        frontTitle: "24/7 Coverage",
    frontBody:  "Round-the-clock triage without staffing overhead.",
    backBody:   "Route calls to on-call staff, log voicemails to CRM, and auto-schedule follow-ups when lines are busy."
  },
    {
        frontTitle: "Brand-Aligned Replies",
    frontBody:  "Responses adhere to your tone and policies.",
    backBody: "Inject style guides and escalation rules; enforce safe handoffs for regulated queries."

  },
    {
        frontTitle: "333333333333",
    frontBody: "Responses adhere to your tone and policies.",
    backBody: "Inject style guides and escalation rules; enforce safe handoffs for regulated queries."
  },
    {
        frontTitle: "333333333333",
    frontBody: "Responses adhere to your tone and policies.",
    backBody: "Inject style guides and escalation rules; enforce safe handoffs for regulated queries."

  },
    {
        frontTitle: "Frictionless Integration",
    frontBody:  "Plug into your phones, calendars, and CRM.",
    backBody:   "Native connectors for HubSpot, Salesforce, Google Calendar, Teams/Slack, WhatsApp, and webhooks."
  },
    {
        frontTitle: "Analytics",
    frontBody:  "See deflection, CSAT, and conversion.",
    backBody:   "Track call outcomes, missed-call recovery, and pipeline impact with exportable reports."
  }
    ];

    // Mount point
    const host = document.getElementById('flashcards');

    function cardTemplate({frontTitle, frontBody, backBody}, idx) {
  const id = `fc-${idx}`;
    return `
    <button type="button" class="fc-card" aria-pressed="false" aria-labelledby="${id}-title">
        <div class="fc-inner">
            <div class="fc-face fc-front" role="group" aria-labelledby="${id}-title">
                <h3 id="${id}-title" class="fc-title">${frontTitle}</h3>
                <p class="fc-body">${frontBody}</p>
                <div class="fc-hint" aria-hidden="true"></div>
            </div>
            <div class="fc-face fc-back" role="group" aria-label="Answer">
                <p class="fc-body">${backBody}</p>
                <div class="fc-hint" aria-hidden="true"></div>
            </div>
        </div>
    </button>
    `.trim();
}

    // Render cards
    host.innerHTML = CARDS.map(cardTemplate).join('');

// Interaction: toggle flip on click + keyboard
host.addEventListener('click', (e) => {
  const btn = e.target.closest('.fc-card');
    if (!btn) return;
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!pressed));
});

// Keyboard support for Enter / Space (safari quirks safe)
host.addEventListener('keydown', (e) => {
  const btn = e.target.closest('.fc-card');
    if (!btn) return;
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!pressed));
  }
});

/* Optional: close others when one opens (uncomment to enforce single-open group)
host.addEventListener('click', (e) => {
  const btn = e.target.closest('.fc-card');
    if (!btn) return;
  [...host.querySelectorAll('.fc-card')].forEach(el => {
    if (el !== btn) el.setAttribute('aria-pressed', 'false');
  });
});
    */