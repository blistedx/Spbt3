/**
 * S.P. Badminton Tourney 3 · Privacy-Conscious Lightweight Analytics
 * Automatically tracks page views, CTA interactions, and registration milestones.
 */
(function () {
  const ENDPOINT = '/api/analytics/event';

  function canTrack() {
    try {
      const consent = localStorage.getItem('sp3_cookie_consent');
      if (consent === 'essential') return false; // Respect Essential-Only consent
      const prefs = localStorage.getItem('sp3_cookie_preferences');
      if (prefs && JSON.parse(prefs).analytics === false) return false;
      return true;
    } catch (e) {
      return true;
    }
  }

  function getSessionId() {
    try {
      let sid = sessionStorage.getItem('sp3_sid');
      if (!sid) {
        sid = 's_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
        sessionStorage.setItem('sp3_sid', sid);
      }
      return sid;
    } catch (e) {
      return 's_fallback';
    }
  }

  function sendEvent(eventType, eventData = {}) {
    if (!canTrack()) return;

    const payload = {
      event: eventType,
      path: window.location.pathname || '/',
      hash: window.location.hash || '',
      referrer: document.referrer ? new URL(document.referrer, location.href).hostname : 'direct',
      sessionId: getSessionId(),
      screen: `${window.innerWidth}x${window.innerHeight}`,
      theme: document.documentElement.getAttribute('data-theme') || 'light',
      timestamp: new Date().toISOString(),
      data: eventData
    };

    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      } catch (e) {}
    }

    // Fallback fetch
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  }

  window.sp3TrackEvent = sendEvent;

  // Track Pageview
  window.addEventListener('DOMContentLoaded', () => {
    sendEvent('page_view', { title: document.title });

    // Track user clicks on CTAs & Actions
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a, button, [data-track]');
      if (!target) return;

      const trackName = target.getAttribute('data-track');
      if (trackName) {
        sendEvent('cta_click', { target: trackName, text: target.innerText.trim().slice(0, 40) });
        return;
      }

      // Auto-identify key tournament buttons
      if (target.matches('.cta-main-btn, .header-reg-btn, [onclick*="openRegister"]')) {
        sendEvent('cta_click', { target: 'register_pair_btn', text: 'Register Pair' });
      } else if (target.matches('.cta-verify-btn, [onclick*="openStatusModal"]')) {
        sendEvent('cta_click', { target: 'verify_status_btn', text: 'Check Status' });
      } else if (target.matches('[href="#draws"]')) {
        sendEvent('cta_click', { target: 'draws_link', text: 'View Draws' });
      } else if (target.matches('.nav-pill-live, [href*="/tv"]')) {
        sendEvent('cta_click', { target: 'live_tv_click', text: 'Live TV' });
      } else if (target.matches('#themeToggleBtn, .theme-toggle-btn')) {
        sendEvent('theme_toggle', { nextTheme: document.documentElement.getAttribute('data-theme') });
      }
    }, true);
  });
})();
