/**
 * S.P. Badminton Tourney 3 · PWA Service Worker, Install Handler, & Background Push Alerts
 */
(function () {
  'use strict';

  // 1. Register Service Worker
  let swRegistration = null;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          swRegistration = reg;
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // 2. Install Prompt Handling
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
  });

  // When app is successfully installed by user
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App successfully installed!');
    deferredPrompt = null;
    const banner = document.getElementById('sp3-pwa-banner');
    if (banner) banner.remove();
    // Prompt for alerts & background delivery immediately upon install
    setTimeout(() => {
      showPwaAlertPrompt(true);
    }, 600);
  });

  // Detect standalone PWA mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  // If already installed and launched standalone, check if alerts are enabled
  if (isStandalone) {
    window.addEventListener('load', () => {
      const alreadySubscribed = localStorage.getItem('sp3_player_push_subscribed') === 'true';
      const isDismissed = sessionStorage.getItem('sp3_pwa_alert_prompt_dismissed') === 'true';
      const isDenied = ('Notification' in window) && Notification.permission === 'denied';

      if (!alreadySubscribed && !isDismissed && !isDenied) {
        setTimeout(() => {
          showPwaAlertPrompt(true);
        }, 1200);
      }
    });
  }

  function showInstallPromotion() {
    if (document.getElementById('sp3-pwa-banner')) return;
    if (sessionStorage.getItem('sp3_pwa_dismissed')) return;
    if (isStandalone) return;

    const banner = document.createElement('div');
    banner.id = 'sp3-pwa-banner';
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      max-width: 360px;
      background: rgba(9, 14, 12, 0.95);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(34, 197, 94, 0.35);
      border-radius: 14px;
      padding: 12px 16px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(34, 197, 94, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 99999;
      color: #fff;
      font-family: 'Inter', -apple-system, sans-serif;
      animation: sp3PwaFadeIn 0.35s ease;
    `;

    banner.innerHTML = `
      <img src="/favicon-32x32.png" alt="SP Tourney" style="width:34px; height:34px; border-radius:9px; flex-shrink:0;">
      <div style="flex:1; min-width:0;">
        <div style="font-size:13.5px; font-weight:700; color:#4ade80;">Install SP Tourney App</div>
        <div style="font-size:11px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Live match alerts even when closed</div>
      </div>
      <button id="sp3PwaInstallBtn" style="background:linear-gradient(135deg, #16a34a, #15803d); color:#fff; border:none; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(22,163,74,0.4);">Install</button>
      <button id="sp3PwaDismissBtn" style="background:transparent; color:#94a3b8; border:none; font-size:18px; cursor:pointer; padding:2px 6px;">&times;</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('sp3PwaInstallBtn')?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User install choice:', outcome);
        deferredPrompt = null;
        if (outcome === 'accepted') {
          setTimeout(() => showPwaAlertPrompt(true), 700);
        }
      }
      banner.remove();
    });

    document.getElementById('sp3PwaDismissBtn')?.addEventListener('click', () => {
      sessionStorage.setItem('sp3_pwa_dismissed', 'true');
      banner.remove();
    });
  }

  // 3. Web Push Helpers
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function arrayBufferToBase64(buffer) {
    if (!buffer) return '';
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  async function getPublicVapidKey() {
    try {
      const res = await fetch('/api/push/vapid-public-key');
      const data = await res.json();
      if (data && data.publicKey) return data.publicKey;
    } catch (e) {
      console.warn('[PWA] Failed to get VAPID key:', e);
    }
    return null;
  }

  async function registerPwaPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push alerts are not supported in this browser.');
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        return false;
      }

      const vapidKey = await getPublicVapidKey();
      if (!vapidKey) return false;

      const readyReg = await navigator.serviceWorker.ready;
      let sub = await readyReg.pushManager.getSubscription();
      if (!sub) {
        sub = await readyReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      }

      let subJson = {};
      try {
        if (typeof sub.toJSON === 'function') subJson = sub.toJSON();
      } catch (e) {}

      const rawP256dh = sub.getKey ? sub.getKey('p256dh') : null;
      const rawAuth = sub.getKey ? sub.getKey('auth') : null;
      const p256dh = (subJson.keys && subJson.keys.p256dh) || arrayBufferToBase64(rawP256dh);
      const auth = (subJson.keys && subJson.keys.auth) || arrayBufferToBase64(rawAuth);
      const endpoint = sub.endpoint || subJson.endpoint;

      const ident = localStorage.getItem('sp3_player_ident') || ('pwa_' + Math.random().toString(36).substring(2, 9));

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          keys: { p256dh, auth },
          p256dh,
          auth,
          subscription: { endpoint, keys: { p256dh, auth } },
          audienceType: 'ALL',
          userIdentifier: ident
        })
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        localStorage.setItem('sp3_player_push_subscribed', 'true');
        localStorage.setItem('sp3_player_ident', ident);
        if (typeof window.updateHeaderPushUI === 'function') {
          window.updateHeaderPushUI(true);
        }
        return true;
      }
    } catch (err) {
      console.warn('[PWA] Push registration error:', err);
    }
    return false;
  }

  // 4. Modal 1: Automatic Alert & Background Permission Dialog
  function showPwaAlertPrompt(isStandaloneApp) {
    if (document.getElementById('sp3-alert-permission-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'sp3-alert-permission-modal';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999999;
      background: rgba(4, 9, 6, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
      animation: sp3PwaFadeIn 0.3s ease;
    `;

    overlay.innerHTML = `
      <div style="
        background: linear-gradient(180deg, #111c15 0%, #09120c 100%);
        border: 1.5px solid rgba(34, 197, 94, 0.45);
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(34, 197, 94, 0.25);
        border-radius: 24px;
        max-width: 440px;
        width: 100%;
        padding: 28px 24px 24px;
        text-align: center;
        color: #f8fafc;
        position: relative;
        overflow: hidden;
      ">
        <div style="
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, #22c55e, #10b981, #38bdf8, #22c55e);
        "></div>

        <div style="
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.05) 70%);
          border: 2px solid rgba(34, 197, 94, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          box-shadow: 0 0 24px rgba(34, 197, 94, 0.35);
        ">🔔</div>

        <div style="
          display: inline-block;
          padding: 3px 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #4ade80;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 999px;
          margin-bottom: 12px;
        ">${isStandaloneApp ? 'APP INSTALLED' : 'S.P. BADMINTON 3'}</div>

        <h3 style="font-size: 21px; font-weight: 800; color: #fff; margin: 0 0 10px; letter-spacing: -0.3px;">
          Enable Live Match &amp; Score Alerts?
        </h3>

        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.55; margin: 0 0 18px;">
          Get real-time match results, schedule updates, and court announcements <strong>even when this app is completely closed</strong>.
        </p>

        <div style="
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 12px;
          padding: 10px 14px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
          font-size: 12.5px;
          color: #94a3b8;
        ">
          <div style="display:flex; align-items:center; gap:8px; color:#e2e8f0;">
            <span style="color:#4ade80;">✓</span> Instant Live Score &amp; Point Updates
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:#e2e8f0;">
            <span style="color:#4ade80;">✓</span> Works in Background when App is Closed
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:#e2e8f0;">
            <span style="color:#4ade80;">✓</span> Match Schedule &amp; Draw Notifications
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="sp3EnableAlertsBtn" style="
            width: 100%;
            padding: 13px 20px;
            background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
            color: #ffffff;
            border: 1.5px solid rgba(74, 222, 128, 0.5);
            border-radius: 14px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(22, 163, 74, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          ">
            <span>🔔 Turn On Match Alerts</span>
          </button>

          <button id="sp3DismissAlertsBtn" style="
            width: 100%;
            padding: 10px;
            background: transparent;
            color: #94a3b8;
            border: none;
            font-size: 13.5px;
            cursor: pointer;
            font-weight: 600;
          ">
            Maybe Later
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sp3EnableAlertsBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('sp3EnableAlertsBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳ Activating Alerts...</span>';
      }

      let success = false;
      if (typeof window.requestPublicPushSubscription === 'function') {
        success = await window.requestPublicPushSubscription('ALL');
      } else {
        success = await registerPwaPushSubscription();
      }

      overlay.remove();

      if (success) {
        // Show Background Activity Guidance
        showBackgroundActivityGuide();
      } else {
        if (typeof window.showToast === 'function') {
          window.showToast('⚠️ Notifications were not allowed.');
        }
      }
    });

    document.getElementById('sp3DismissAlertsBtn')?.addEventListener('click', () => {
      sessionStorage.setItem('sp3_pwa_alert_prompt_dismissed', 'true');
      overlay.remove();
    });
  }

  // 5. Modal 2: Android Background Activity Optimization Guide
  function showBackgroundActivityGuide() {
    if (document.getElementById('sp3-bg-guide-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'sp3-bg-guide-modal';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999999;
      background: rgba(4, 9, 6, 0.86);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
      animation: sp3PwaFadeIn 0.3s ease;
    `;

    overlay.innerHTML = `
      <div style="
        background: linear-gradient(180deg, #111c15 0%, #09120c 100%);
        border: 1.5px solid rgba(34, 197, 94, 0.45);
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(34, 197, 94, 0.25);
        border-radius: 24px;
        max-width: 440px;
        width: 100%;
        padding: 26px 22px 22px;
        text-align: center;
        color: #f8fafc;
        position: relative;
      ">
        <div style="
          width: 58px;
          height: 58px;
          margin: 0 auto 14px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.05) 70%);
          border: 2px solid rgba(34, 197, 94, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          box-shadow: 0 0 24px rgba(34, 197, 94, 0.35);
        ">⚡</div>

        <div style="
          display: inline-block;
          padding: 3px 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #4ade80;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 999px;
          margin-bottom: 10px;
        ">BACKGROUND DELIVERY ACTIVE</div>

        <h3 style="font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 8px;">
          Alerts Enabled Successfully!
        </h3>

        <p style="font-size: 13.5px; color: #cbd5e1; line-height: 1.5; margin: 0 0 16px;">
          To ensure Android delivers live score alerts <strong>instantly when the app is closed</strong>, check your phone's battery setting:
        </p>

        <div style="
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(34, 197, 94, 0.25);
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 20px;
          text-align: left;
          font-size: 13px;
          color: #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        ">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <span style="background:rgba(34,197,94,0.2); color:#4ade80; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; flex-shrink:0;">1</span>
            <div>Long press app icon on Home screen ➔ Tap <strong>App Info (ℹ️)</strong></div>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <span style="background:rgba(34,197,94,0.2); color:#4ade80; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; flex-shrink:0;">2</span>
            <div>Tap <strong>Battery</strong> ➔ Select <strong>Unrestricted</strong> (or <em>Allow background activity</em>)</div>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <span style="background:rgba(34,197,94,0.2); color:#4ade80; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; flex-shrink:0;">3</span>
            <div><em>(Xiaomi/Vivo/Oppo):</em> Turn on <strong>Autostart</strong></div>
          </div>
        </div>

        <button id="sp3BgGuideDoneBtn" style="
          width: 100%;
          padding: 13px 20px;
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: #ffffff;
          border: 1.5px solid rgba(74, 222, 128, 0.5);
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(22, 163, 74, 0.4);
        ">
          Got It, All Set! ✓
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sp3BgGuideDoneBtn')?.addEventListener('click', () => {
      overlay.remove();
    });
  }

  // Inject CSS keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes sp3PwaFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  // Global manual triggers
  window.promptPwaInstall = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setTimeout(() => showPwaAlertPrompt(true), 700);
        }
      });
    } else {
      if (isStandalone) {
        showPwaAlertPrompt(true);
      } else {
        alert('To install the app, tap Share on iOS Safari and "Add to Home Screen", or click Install in your browser address bar!');
      }
    }
  };

  window.promptPwaAlertSettings = function () {
    showPwaAlertPrompt(isStandalone);
  };
})();
