(function () {
    function initBlogCardStagger() {
        // Only act on the blog page
        if (!document.body || !document.body.classList.contains('blog')) return;

        var cards = document.querySelectorAll('body.blog .features article');
        if (!cards.length) return;

        // Respect reduced-motion preference: just reveal all at once
        var mql = window.matchMedia ?
            window.matchMedia('(prefers-reduced-motion: reduce)') :
            null;

        if (mql && mql.matches) {
            cards.forEach(function (card) {
                card.classList.add('wq-card--visible');
            });
            return;
        }

        var baseDelay = 350; // ms between cards → slow chained fade-in

        cards.forEach(function (card, index) {
            var delay = index * baseDelay;
            setTimeout(function () {
                card.classList.add('wq-card--visible');
            }, delay);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBlogCardStagger);
    } else {
        initBlogCardStagger();
    }
})();