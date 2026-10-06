/**
 * S.P. Badminton Tourney 3 · Lightweight Share Fallback
 * Optimized for 0ms page load latency without injecting heavy DOM overlays
 */
(function () {
  window.openShareModal = function () {
    if (navigator.share) {
      navigator.share({
        title: "S.P. Badminton Tourney Season 3 · Suryodaya Park",
        text: "🏸 Register your Men's Doubles pair for S.P. Badminton Tourney Season 3 at Suryodaya Park! Check fixtures, knockout draws & watch courtside live TV:",
        url: window.location.origin || "https://spbadminton.in"
      }).catch(() => {});
    }
  };
})();
