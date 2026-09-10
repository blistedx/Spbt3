/**
 * S.P. Badminton Tourney 3 · PWA Service Worker & Install Handler
 */
(function () {
  // 1. Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
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

  function showInstallPromotion() {
    if (document.getElementById('sp3-pwa-banner')) return;
    if (sessionStorage.getItem('sp3_pwa_dismissed')) return;

    const banner = document.createElement('div');
    banner.id = 'sp3-pwa-banner';
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      max-width: 360px;
      background: rgba(9, 14, 12, 0.94);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(34, 197, 94, 0.35);
      border-radius: 14px;
      padding: 12px 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 99999;
      color: #fff;
      font-family: 'Inter', sans-serif;
      animation: pwaFadeIn 0.4s ease;
    `;

    banner.innerHTML = `
      <img src="/favicon-32x32.png" alt="SP Tourney" style="width:32px; height:32px; border-radius:8px; flex-shrink:0;">
      <div style="flex:1; min-width:0;">
        <div style="font-size:13px; font-weight:700; color:#4ade80;">Install SP Tourney App</div>
        <div style="font-size:11px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Faster access &amp; offline fixtures</div>
      </div>
      <button id="sp3PwaInstallBtn" style="background:#16a34a; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">Install</button>
      <button id="sp3PwaDismissBtn" style="background:transparent; color:#94a3b8; border:none; font-size:16px; cursor:pointer; padding:2px 6px;">&times;</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('sp3PwaInstallBtn')?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User choice:', outcome);
        deferredPrompt = null;
      }
      banner.remove();
    });

    document.getElementById('sp3PwaDismissBtn')?.addEventListener('click', () => {
      sessionStorage.setItem('sp3_pwa_dismissed', 'true');
      banner.remove();
    });
  }

  window.promptPwaInstall = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
    } else {
      alert('To install the app, tap Share on iOS Safari and "Add to Home Screen", or click Install in your browser address bar!');
    }
  };
})();
