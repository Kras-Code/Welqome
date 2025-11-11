(function () {
    function initBlogCardFadeIn() {
        var cards = document.querySelectorAll('body.blog .features article');
        if (!cards.length) return;

        // Respect prefers-reduced-motion
        var prefersReducedMotion = false;
        try {
            prefersReducedMotion = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {}

        if (prefersReducedMotion) {
            // Show everything immediately with no stagger
            cards.forEach
                ? cards.forEach(function (card) {
                      card.classList.add('wq-card-visible');
                  })
                : Array.prototype.forEach.call(cards, function (card) {
                      card.classList.add('wq-card-visible');
                  });
            return;
        }

        var baseDelay = 160;  // initial delay before the first card (ms)
        var stagger   = 140;  // gap between each card (ms)

        (cards.forEach
            ? cards.forEach.bind(cards)
            : function (cb) { Array.prototype.forEach.call(cards, cb); }
        )(function (card, index) {
            var delay = baseDelay + index * stagger;
            setTimeout(function () {
                card.classList.add('wq-card-visible');
            }, delay);
        });
    }

    // Run once the full page (including fonts/images) has loaded
    window.addEventListener('load', initBlogCardFadeIn);
})();