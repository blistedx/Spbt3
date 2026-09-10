/**
 * S.P. Badminton Tourney 3 · Cookie & Privacy Consent System
 * Modern, GDPR-compliant, theme-aware consent banner & preferences modal.
 */
(function () {
  const STORAGE_KEY = 'sp3_cookie_consent';
  const PREFS_KEY = 'sp3_cookie_preferences';

  function getConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function getPreferences() {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      return saved ? JSON.parse(saved) : { essential: true, preferences: true, analytics: false };
    } catch (e) {
      return { essential: true, preferences: true, analytics: false };
    }
  }

  function saveConsent(level, prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, level);
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs || { essential: true, preferences: level === 'all', analytics: level === 'all' }));
    } catch (e) {}
    hideBanner();
    hideModal();
    window.dispatchEvent(new CustomEvent('sp3_cookie_consent_updated', { detail: { level, prefs } }));
  }

  function injectStyles() {
    if (document.getElementById('sp3-cookie-consent-styles')) return;
    const style = document.createElement('style');
    style.id = 'sp3-cookie-consent-styles';
    style.textContent = `
      .sp3-cookie-banner {
        position: fixed;
        bottom: 24px;
        left: 24px;
        right: 24px;
        max-width: 580px;
        margin: 0 auto;
        background: rgba(246, 245, 238, 0.96);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1.5px solid rgba(20, 24, 15, 0.12);
        box-shadow: 0 20px 45px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08);
        border-radius: 18px;
        padding: 20px 24px;
        z-index: 99998;
        color: #14180F;
        font-family: 'Inter', -apple-system, sans-serif;
        display: none;
        opacity: 0;
        transform: translateY(24px) scale(0.98);
        transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }
      [data-theme="dark"] .sp3-cookie-banner {
        background: rgba(14, 22, 18, 0.94);
        border-color: rgba(34, 197, 94, 0.28);
        box-shadow: 0 24px 50px rgba(0, 0, 0, 0.65), 0 0 25px rgba(34, 197, 94, 0.12);
        color: #f8fafc;
      }
      .sp3-cookie-banner.visible {
        display: block;
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .sp3-cookie-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      .sp3-cookie-icon-wrap {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #1E7A45;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      [data-theme="dark"] .sp3-cookie-icon-wrap {
        background: #16a34a;
      }
      .sp3-cookie-title {
        font-family: 'Outfit', 'Inter', sans-serif;
        font-size: 16px;
        font-weight: 700;
        margin: 0;
        line-height: 1.2;
      }
      .sp3-cookie-desc {
        font-size: 13px;
        line-height: 1.55;
        color: #4b5563;
        margin: 0 0 16px 0;
      }
      [data-theme="dark"] .sp3-cookie-desc {
        color: #94a3b8;
      }
      .sp3-cookie-desc a {
        color: #1E7A45;
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      [data-theme="dark"] .sp3-cookie-desc a {
        color: #4ade80;
      }
      .sp3-cookie-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
      }
      .sp3-cookie-btn {
        padding: 9px 18px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 10px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }
      .sp3-cookie-btn-primary {
        background: #1E7A45;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(30, 122, 69, 0.25);
      }
      .sp3-cookie-btn-primary:hover {
        background: #166336;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(30, 122, 69, 0.35);
      }
      [data-theme="dark"] .sp3-cookie-btn-primary {
        background: #16a34a;
        box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);
      }
      [data-theme="dark"] .sp3-cookie-btn-primary:hover {
        background: #15803d;
      }
      .sp3-cookie-btn-secondary {
        background: transparent;
        border-color: rgba(20, 24, 15, 0.2);
        color: #1f2937;
      }
      .sp3-cookie-btn-secondary:hover {
        background: rgba(20, 24, 15, 0.05);
      }
      [data-theme="dark"] .sp3-cookie-btn-secondary {
        border-color: rgba(255, 255, 255, 0.2);
        color: #e2e8f0;
      }
      [data-theme="dark"] .sp3-cookie-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .sp3-cookie-btn-link {
        background: transparent;
        color: #6b7280;
        padding: 9px 12px;
        text-decoration: underline;
        font-size: 12.5px;
        margin-left: auto;
      }
      [data-theme="dark"] .sp3-cookie-btn-link {
        color: #94a3b8;
      }
      .sp3-cookie-btn-link:hover {
        color: #111827;
      }
      [data-theme="dark"] .sp3-cookie-btn-link:hover {
        color: #ffffff;
      }

      /* Modal for Preferences */
      .sp3-cookie-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(6px);
        z-index: 100006;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .sp3-cookie-modal-overlay.visible {
        display: flex;
        opacity: 1;
      }
      .sp3-cookie-modal {
        background: #F6F5EE;
        border-radius: 18px;
        max-width: 520px;
        width: 100%;
        padding: 24px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
        color: #14180F;
        transform: scale(0.95);
        transition: transform 0.3s ease;
      }
      [data-theme="dark"] .sp3-cookie-modal {
        background: #0f1714;
        border: 1.5px solid rgba(34, 197, 94, 0.25);
        color: #f8fafc;
      }
      .sp3-cookie-modal-overlay.visible .sp3-cookie-modal {
        transform: scale(1);
      }
      .sp3-pref-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 14px 0;
        border-bottom: 1px solid rgba(20, 24, 15, 0.08);
      }
      [data-theme="dark"] .sp3-pref-row {
        border-bottom-color: rgba(255, 255, 255, 0.08);
      }
      .sp3-pref-info h5 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 700;
      }
      .sp3-pref-info p {
        margin: 0;
        font-size: 12px;
        color: #64748b;
        line-height: 1.45;
      }
      [data-theme="dark"] .sp3-pref-info p {
        color: #94a3b8;
      }
      .sp3-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
        margin-top: 4px;
      }
      .sp3-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .sp3-slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: #cbd5e1;
        transition: .3s;
        border-radius: 24px;
      }
      .sp3-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
      }
      input:checked + .sp3-slider {
        background-color: #1E7A45;
      }
      [data-theme="dark"] input:checked + .sp3-slider {
        background-color: #16a34a;
      }
      input:disabled + .sp3-slider {
        opacity: 0.6;
        cursor: not-allowed;
      }
      input:checked + .sp3-slider:before {
        transform: translateX(20px);
      }
      @media (max-width: 600px) {
        .sp3-cookie-banner {
          bottom: 12px;
          left: 12px;
          right: 12px;
          padding: 16px;
        }
        .sp3-cookie-actions {
          flex-direction: column;
          align-items: stretch;
        }
        .sp3-cookie-btn {
          text-align: center;
        }
        .sp3-cookie-btn-link {
          margin-left: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createElements() {
    injectStyles();

    // Banner HTML
    const banner = document.createElement('div');
    banner.id = 'sp3CookieBanner';
    banner.className = 'sp3-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <div class="sp3-cookie-header">
        <div class="sp3-cookie-icon-wrap">🏸</div>
        <div>
          <h4 class="sp3-cookie-title">Cookie &amp; Tournament Experience</h4>
        </div>
      </div>
      <p class="sp3-cookie-desc">
        We use local storage and cookies to remember your theme preferences (Dark/Light mode), secure match scoring sessions, and deliver live bracket updates. See our <a href="/privacy.html" target="_blank">Privacy Policy</a> and <a href="/terms.html" target="_blank">Terms</a>.
      </p>
      <div class="sp3-cookie-actions">
        <button type="button" class="sp3-cookie-btn sp3-cookie-btn-primary" id="sp3AcceptAllBtn">Accept All</button>
        <button type="button" class="sp3-cookie-btn sp3-cookie-btn-secondary" id="sp3EssentialBtn">Essential Only</button>
        <button type="button" class="sp3-cookie-btn sp3-cookie-btn-link" id="sp3PrefBtn">Customize</button>
      </div>
    `;
    document.body.appendChild(banner);

    // Modal HTML
    const modal = document.createElement('div');
    modal.id = 'sp3CookieModal';
    modal.className = 'sp3-cookie-modal-overlay';
    modal.innerHTML = `
      <div class="sp3-cookie-modal">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; font-family:'Outfit', sans-serif; font-size:18px;">Privacy &amp; Cookie Preferences</h3>
          <button type="button" id="sp3CloseModalBtn" style="background:none; border:none; font-size:22px; cursor:pointer; color:inherit;">&times;</button>
        </div>
        <p style="font-size:13px; color:#64748b; margin-top:0; margin-bottom:16px;">
          Customize how S.P. Badminton Tourney stores data on your device. Essential storage is required for site navigation and live score synchronisation.
        </p>

        <div class="sp3-pref-row">
          <div class="sp3-pref-info">
            <h5>Strictly Essential (Required)</h5>
            <p>Maintains registration tokens, dark theme state, and live score WebSockets.</p>
          </div>
          <label class="sp3-switch">
            <input type="checkbox" checked disabled>
            <span class="sp3-slider"></span>
          </label>
        </div>

        <div class="sp3-pref-row">
          <div class="sp3-pref-info">
            <h5>Preferences &amp; Audio</h5>
            <p>Remembers court sound alerts, volume, and filter settings on draws.</p>
          </div>
          <label class="sp3-switch">
            <input type="checkbox" id="sp3PrefCheckbox">
            <span class="sp3-slider"></span>
          </label>
        </div>

        <div class="sp3-pref-row" style="border-bottom:none;">
          <div class="sp3-pref-info">
            <h5>Performance Telemetry</h5>
            <p>Anonymous connection diagnostics to help optimize courtside TV latency.</p>
          </div>
          <label class="sp3-switch">
            <input type="checkbox" id="sp3AnalyticsCheckbox">
            <span class="sp3-slider"></span>
          </label>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; padding-top:16px; border-top:1px solid rgba(20,24,15,0.1);">
          <button type="button" class="sp3-cookie-btn sp3-cookie-btn-secondary" id="sp3ModalCancelBtn">Cancel</button>
          <button type="button" class="sp3-cookie-btn sp3-cookie-btn-primary" id="sp3ModalSaveBtn">Save Preferences</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('sp3AcceptAllBtn')?.addEventListener('click', () => {
      saveConsent('all', { essential: true, preferences: true, analytics: true });
    });

    document.getElementById('sp3EssentialBtn')?.addEventListener('click', () => {
      saveConsent('essential', { essential: true, preferences: false, analytics: false });
    });

    document.getElementById('sp3PrefBtn')?.addEventListener('click', () => {
      openModal();
    });

    document.getElementById('sp3CloseModalBtn')?.addEventListener('click', hideModal);
    document.getElementById('sp3ModalCancelBtn')?.addEventListener('click', hideModal);

    document.getElementById('sp3ModalSaveBtn')?.addEventListener('click', () => {
      const prefs = {
        essential: true,
        preferences: document.getElementById('sp3PrefCheckbox')?.checked ?? true,
        analytics: document.getElementById('sp3AnalyticsCheckbox')?.checked ?? false
      };
      saveConsent(prefs.analytics ? 'all' : 'custom', prefs);
    });

    // Delegated listener for any external open trigger
    document.addEventListener('click', (e) => {
      if (e.target.closest('#cookieSettingsLink, .btn-cookie-settings, [data-open-cookie-settings]')) {
        e.preventDefault();
        openModal();
      }
    });
  }

  function showBanner() {
    const banner = document.getElementById('sp3CookieBanner');
    if (banner) {
      setTimeout(() => banner.classList.add('visible'), 400);
    }
  }

  function hideBanner() {
    const banner = document.getElementById('sp3CookieBanner');
    if (banner) banner.classList.remove('visible');
  }

  function openModal() {
    const modal = document.getElementById('sp3CookieModal');
    if (!modal) return;
    const prefs = getPreferences();
    const prefCheck = document.getElementById('sp3PrefCheckbox');
    const analyticsCheck = document.getElementById('sp3AnalyticsCheckbox');
    if (prefCheck) prefCheck.checked = !!prefs.preferences;
    if (analyticsCheck) analyticsCheck.checked = !!prefs.analytics;
    modal.classList.add('visible');
  }

  function hideModal() {
    const modal = document.getElementById('sp3CookieModal');
    if (modal) modal.classList.remove('visible');
  }

  window.openCookieSettings = openModal;

  window.addEventListener('DOMContentLoaded', () => {
    createElements();
    if (!getConsent()) {
      showBanner();
    }
  });
})();
