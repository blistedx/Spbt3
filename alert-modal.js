/**
 * S.P. Badminton Tourney 3 - Custom Animated Themed Alert Modal System
 * Replaces default browser alerts with high-end, centered, animated flash messages.
 */
(function () {
  'use strict';

  // Inject CSS Styles if not already present
  function injectAlertStyles() {
    if (document.getElementById('sp-custom-alert-styles')) return;

    const style = document.createElement('style');
    style.id = 'sp-custom-alert-styles';
    style.textContent = `
      /* ================= CUSTOM THEMED FLASH / ALERT MODAL ================= */
      .sp-alert-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.28s ease;
      }

      .sp-alert-overlay.sp-alert-active {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .sp-alert-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(4, 9, 6, 0.78);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        transition: opacity 0.28s ease;
      }

      [data-theme="light"] .sp-alert-backdrop {
        background: rgba(15, 23, 18, 0.65);
      }

      .sp-alert-card {
        position: relative;
        max-width: 440px;
        width: 100%;
        background: linear-gradient(180deg, #111c15 0%, #09120c 100%);
        color: #f8fafc;
        border-radius: 24px;
        border: 1.5px solid rgba(34, 197, 94, 0.35);
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(34, 197, 94, 0.25);
        overflow: hidden;
        text-align: center;
        padding: 34px 28px 26px;
        transform: scale(0.8) translateY(28px);
        opacity: 0;
        transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.28s ease, border-color 0.3s ease;
        z-index: 10;
        font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-sizing: border-box;
      }

      .sp-alert-overlay.sp-alert-active .sp-alert-card {
        transform: scale(1) translateY(0);
        opacity: 1;
      }

      .sp-alert-overlay.sp-alert-closing .sp-alert-card {
        transform: scale(0.85) translateY(-16px);
        opacity: 0;
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
      }

      [data-theme="light"] .sp-alert-card {
        background: linear-gradient(180deg, #ffffff 0%, #f6f5ee 100%);
        color: #14180f;
        border: 1.5px solid rgba(30, 122, 69, 0.28);
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.25), 0 0 30px rgba(30, 122, 69, 0.15);
      }

      /* Animated Top Flash / Shimmer Bar */
      .sp-alert-flash-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 5px;
        background: linear-gradient(90deg, #22c55e, #10b981, #f59e0b, #38bdf8, #22c55e);
        background-size: 300% 100%;
        animation: spAlertShimmer 3s ease infinite;
        box-shadow: 0 0 14px rgba(34, 197, 94, 0.6);
      }

      @keyframes spAlertShimmer {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      /* Animated Icon Wrap */
      .sp-alert-icon-wrap {
        width: 72px;
        height: 72px;
        margin: 0 auto 16px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, rgba(34, 197, 94, 0.04) 70%);
        border: 2px solid rgba(34, 197, 94, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        box-shadow: 0 0 28px rgba(34, 197, 94, 0.3);
        animation: spAlertIconPulse 2s ease-in-out infinite alternate;
      }

      @keyframes spAlertIconPulse {
        0% { transform: scale(1); box-shadow: 0 0 20px rgba(34, 197, 94, 0.25); }
        100% { transform: scale(1.06); box-shadow: 0 0 34px rgba(34, 197, 94, 0.5); }
      }

      /* Badge */
      .sp-alert-badge {
        display: inline-block;
        padding: 4px 14px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: #4ade80;
        background: rgba(34, 197, 94, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 999px;
        margin-bottom: 12px;
        font-family: 'Space Mono', 'Inter', monospace;
      }

      [data-theme="light"] .sp-alert-badge {
        color: #15803d;
        background: rgba(30, 122, 69, 0.1);
        border-color: rgba(30, 122, 69, 0.25);
      }

      /* Title */
      .sp-alert-title {
        font-family: 'Outfit', 'Inter', sans-serif;
        font-size: 21px;
        font-weight: 800;
        color: #ffffff;
        margin: 0 0 10px;
        letter-spacing: -0.3px;
      }

      [data-theme="light"] .sp-alert-title {
        color: #14180f;
      }

      /* Message */
      .sp-alert-msg {
        font-size: 15px;
        font-weight: 500;
        line-height: 1.6;
        color: #cbd5e1;
        margin: 0 0 24px;
        word-break: break-word;
        white-space: pre-line;
      }

      [data-theme="light"] .sp-alert-msg {
        color: #475569;
      }

      /* Actions */
      .sp-alert-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      /* Acknowledge Button */
      .sp-alert-btn {
        width: 100%;
        padding: 13px 24px;
        background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
        color: #ffffff;
        border: 1.5px solid rgba(74, 222, 128, 0.5);
        border-radius: 14px;
        font-family: 'Outfit', 'Inter', sans-serif;
        font-size: 15.5px;
        font-weight: 700;
        letter-spacing: 0.5px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(22, 163, 74, 0.4);
        transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        outline: none;
      }

      .sp-alert-btn:hover {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        box-shadow: 0 10px 30px rgba(34, 197, 94, 0.6);
        transform: translateY(-2px);
      }

      .sp-alert-btn:active {
        transform: translateY(0);
        box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);
      }

      /* ================= TYPE CUSTOMIZATIONS ================= */
      /* Closed / Warning */
      .sp-alert-card[data-alert-type="closed"] {
        border-color: rgba(245, 158, 11, 0.45);
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(245, 158, 11, 0.25);
      }
      .sp-alert-card[data-alert-type="closed"] .sp-alert-icon-wrap {
        border-color: rgba(245, 158, 11, 0.5);
        background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0.05) 70%);
        box-shadow: 0 0 28px rgba(245, 158, 11, 0.35);
      }
      .sp-alert-card[data-alert-type="closed"] .sp-alert-badge {
        color: #fbbf24;
        border-color: rgba(245, 158, 11, 0.35);
        background: rgba(245, 158, 11, 0.12);
      }
      .sp-alert-card[data-alert-type="closed"] .sp-alert-btn {
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        border-color: rgba(251, 191, 36, 0.5);
        box-shadow: 0 8px 24px rgba(217, 119, 6, 0.4);
      }
      .sp-alert-card[data-alert-type="closed"] .sp-alert-btn:hover {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        box-shadow: 0 10px 30px rgba(245, 158, 11, 0.55);
      }

      /* Error */
      .sp-alert-card[data-alert-type="error"] {
        border-color: rgba(239, 68, 68, 0.45);
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(239, 68, 68, 0.25);
      }
      .sp-alert-card[data-alert-type="error"] .sp-alert-icon-wrap {
        border-color: rgba(239, 68, 68, 0.5);
        background: radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, rgba(239, 68, 68, 0.05) 70%);
        box-shadow: 0 0 28px rgba(239, 68, 68, 0.35);
      }
      .sp-alert-card[data-alert-type="error"] .sp-alert-badge {
        color: #f87171;
        border-color: rgba(239, 68, 68, 0.35);
        background: rgba(239, 68, 68, 0.12);
      }
      .sp-alert-card[data-alert-type="error"] .sp-alert-btn {
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
        border-color: rgba(248, 113, 113, 0.5);
        box-shadow: 0 8px 24px rgba(220, 38, 38, 0.4);
      }
      .sp-alert-card[data-alert-type="error"] .sp-alert-btn:hover {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        box-shadow: 0 10px 30px rgba(239, 68, 68, 0.55);
      }

      /* Warning */
      .sp-alert-card[data-alert-type="warning"] {
        border-color: rgba(245, 158, 11, 0.45);
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(245, 158, 11, 0.25);
      }
      .sp-alert-card[data-alert-type="warning"] .sp-alert-icon-wrap {
        border-color: rgba(245, 158, 11, 0.5);
        background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0.05) 70%);
      }
      .sp-alert-card[data-alert-type="warning"] .sp-alert-badge {
        color: #fbbf24;
        border-color: rgba(245, 158, 11, 0.35);
        background: rgba(245, 158, 11, 0.12);
      }

      /* Success */
      .sp-alert-card[data-alert-type="success"] {
        border-color: rgba(34, 197, 94, 0.5);
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(34, 197, 94, 0.3);
      }
    `;
    document.head.appendChild(style);
  }

  // Create or retrieve Modal DOM
  function ensureAlertDOM() {
    injectAlertStyles();
    if (document.getElementById('customAlertOverlay')) return;

    const div = document.createElement('div');
    div.id = 'customAlertOverlay';
    div.className = 'sp-alert-overlay';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = `
      <div class="sp-alert-backdrop" onclick="window.closeCustomAlert()"></div>
      <div class="sp-alert-card" id="spAlertCard" role="alertdialog" aria-modal="true" aria-labelledby="spAlertTitle" aria-describedby="spAlertMsg">
        <div class="sp-alert-flash-bar" id="spAlertFlashBar"></div>
        <div class="sp-alert-header">
          <div class="sp-alert-icon-wrap" id="spAlertIconWrap">
            <span class="sp-alert-icon" id="spAlertIcon">🏸</span>
          </div>
          <div class="sp-alert-badge" id="spAlertBadge">S.P. Badminton Tourney 3</div>
        </div>
        <div class="sp-alert-content">
          <h3 class="sp-alert-title" id="spAlertTitle">Notice</h3>
          <p class="sp-alert-msg" id="spAlertMsg"></p>
        </div>
        <div class="sp-alert-actions">
          <button type="button" class="sp-alert-btn" id="spAlertAcknowledgeBtn" onclick="window.closeCustomAlert()">
            <span class="sp-alert-btn-icon">✓</span>
            <span id="spAlertBtnText">Acknowledge</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  // Smart metadata classifier for titles, icons, and badges
  function detectMetadata(msg, options) {
    options = options || {};
    const lower = (msg || '').toString().toLowerCase();

    let title = options.title;
    let badge = options.badge;
    let icon = options.icon;
    let type = options.type;
    let buttonText = options.buttonText || 'Acknowledge';

    if (!type) {
      if (lower.includes('closed')) {
        type = 'closed';
      } else if (lower.includes('error') || lower.includes('failed') || lower.includes('exceeds') || lower.includes('invalid') || lower.includes('could not')) {
        type = 'error';
      } else if (lower.includes('success') || lower.includes('saved') || lower.includes('downloaded') || lower.includes('completed')) {
        type = 'success';
      } else if (lower.includes('please') || lower.includes('must') || lower.includes('warning') || lower.includes('required') || lower.includes('rules')) {
        type = 'warning';
      } else {
        type = 'info';
      }
    }

    if (!title) {
      if (lower.includes('registrations') && lower.includes('closed')) {
        title = 'Registrations Closed';
        badge = badge || 'REGISTRATION NOTICE';
        icon = icon || '🔒';
      } else if (lower.includes('registration id or mobile number')) {
        title = 'Input Required';
        badge = badge || 'VERIFICATION CHECK';
        icon = icon || '🏸';
      } else if (lower.includes('file size exceeds')) {
        title = 'File Too Large';
        badge = badge || 'UPLOAD WARNING';
        icon = icon || '⚠️';
      } else if (lower.includes('same age category')) {
        title = 'Category Mismatch';
        badge = badge || 'REGULATION CHECK';
        icon = icon || '⚠️';
      } else if (lower.includes('10-digit mobile')) {
        title = 'Invalid Mobile Number';
        badge = badge || 'INPUT VALIDATION';
        icon = icon || '📱';
      } else if (lower.includes('live draws & fixtures')) {
        title = 'Draws & Schedule';
        badge = badge || 'TOURNAMENT NOTICE';
        icon = icon || '🏸';
      } else if (lower.includes('tournament rules')) {
        title = 'Tournament Rules';
        badge = badge || 'ACTION REQUIRED';
        icon = icon || '📋';
      } else if (type === 'closed') {
        title = 'Registration Status';
        badge = badge || 'REGISTRATION NOTICE';
        icon = icon || '🔒';
      } else if (type === 'error') {
        title = 'Attention Required';
        badge = badge || 'NOTICE';
        icon = icon || '⚠️';
      } else if (type === 'success') {
        title = 'Success';
        badge = badge || 'CONFIRMATION';
        icon = icon || '🎉';
      } else if (type === 'warning') {
        title = 'Notice';
        badge = badge || 'IMPORTANT';
        icon = icon || '⚠️';
      } else {
        title = 'Tournament Notice';
        badge = badge || 'S.P. BADMINTON TOURNEY 3';
        icon = icon || '🏸';
      }
    }

    if (!badge) badge = 'S.P. BADMINTON TOURNEY 3';
    if (!icon) {
      if (type === 'closed') icon = '🔒';
      else if (type === 'error') icon = '⚠️';
      else if (type === 'success') icon = '🎉';
      else if (type === 'warning') icon = '⚠️';
      else icon = '🏸';
    }

    return { title, badge, icon, type, buttonText };
  }

  const alertQueue = [];
  let isAlertOpen = false;
  let activeResolve = null;

  function processAlertQueue() {
    if (alertQueue.length === 0) {
      isAlertOpen = false;
      return;
    }
    isAlertOpen = true;
    const current = alertQueue.shift();
    activeResolve = current.resolve;

    const msg = typeof current.message === 'object' ? JSON.stringify(current.message, null, 2) : String(current.message ?? '');
    const meta = detectMetadata(msg, current.options);

    const overlay = document.getElementById('customAlertOverlay');
    const card = document.getElementById('spAlertCard');
    const titleEl = document.getElementById('spAlertTitle');
    const msgEl = document.getElementById('spAlertMsg');
    const iconEl = document.getElementById('spAlertIcon');
    const badgeEl = document.getElementById('spAlertBadge');
    const btnTextEl = document.getElementById('spAlertBtnText');
    const btnEl = document.getElementById('spAlertAcknowledgeBtn');

    if (titleEl) titleEl.innerText = (current.options && current.options.title) || meta.title;
    if (msgEl) msgEl.innerText = msg;
    if (iconEl) iconEl.innerText = (current.options && current.options.icon) || meta.icon;
    if (badgeEl) badgeEl.innerText = (current.options && current.options.badge) || meta.badge;
    if (btnTextEl) btnTextEl.innerText = (current.options && current.options.buttonText) || meta.buttonText;

    if (card) {
      card.setAttribute('data-alert-type', meta.type);
    }

    overlay.classList.remove('sp-alert-closing');
    overlay.classList.add('sp-alert-active');
    overlay.setAttribute('aria-hidden', 'false');

    if (btnEl) {
      setTimeout(function () {
        btnEl.focus();
      }, 60);
    }
  }

  window.showCustomAlert = function (message, options) {
    ensureAlertDOM();
    return new Promise(function (resolve) {
      alertQueue.push({ message, options, resolve });
      if (!isAlertOpen) {
        processAlertQueue();
      }
    });
  };

  window.closeCustomAlert = function () {
    const overlay = document.getElementById('customAlertOverlay');
    if (!overlay || !overlay.classList.contains('sp-alert-active')) return;

    overlay.classList.add('sp-alert-closing');

    setTimeout(function () {
      overlay.classList.remove('sp-alert-active', 'sp-alert-closing');
      overlay.setAttribute('aria-hidden', 'true');

      if (activeResolve) {
        try { activeResolve(true); } catch (e) { }
        activeResolve = null;
      }

      if (alertQueue.length > 0) {
        setTimeout(processAlertQueue, 80);
      } else {
        isAlertOpen = false;
      }
    }, 220);
  };

  // Replace standard browser window.alert
  window.alert = function (message, options) {
    return window.showCustomAlert(message, options);
  };

  // Keyboard accessibility (Enter / Escape to acknowledge)
  document.addEventListener('keydown', function (e) {
    const overlay = document.getElementById('customAlertOverlay');
    if (overlay && overlay.classList.contains('sp-alert-active')) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        window.closeCustomAlert();
      }
    }
  });

  // DOM ready hook
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAlertDOM);
  } else {
    ensureAlertDOM();
  }
})();
