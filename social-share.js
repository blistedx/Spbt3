/**
 * S.P. Badminton Tourney 3 · Social Share Module
 * Native Web Share API + Custom Modal (WhatsApp, X/Twitter, Facebook, Telegram, Copy Link)
 */
(function () {
  const SHARE_DATA = {
    title: "S.P. Badminton Tourney Season 3 · Suryodaya Park",
    text: "🏸 Register your Men's Doubles pair for S.P. Badminton Tourney Season 3 at Suryodaya Park! Check fixtures, knockout draws & watch courtside live TV:",
    url: window.location.origin || "https://spbadminton.in"
  };

  function injectStyles() {
    if (document.getElementById('sp3-share-styles')) return;
    const style = document.createElement('style');
    style.id = 'sp3-share-styles';
    style.textContent = `
      .sp3-share-float-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #1E7A45;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 20px rgba(30, 122, 69, 0.4);
        cursor: pointer;
        z-index: 99990;
        border: none;
        transition: transform 0.25s ease, background-color 0.25s ease;
      }
      [data-theme="dark"] .sp3-share-float-btn {
        background: #16a34a;
        box-shadow: 0 6px 22px rgba(22, 163, 74, 0.5);
      }
      .sp3-share-float-btn:hover {
        transform: scale(1.1) translateY(-2px);
      }
      .sp3-share-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(6px);
        z-index: 100008;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .sp3-share-modal-overlay.visible {
        display: flex;
        opacity: 1;
      }
      .sp3-share-modal {
        background: #F6F5EE;
        border-radius: 20px;
        max-width: 440px;
        width: 100%;
        padding: 24px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
        color: #14180F;
        font-family: 'Inter', sans-serif;
        transform: scale(0.95);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      [data-theme="dark"] .sp3-share-modal {
        background: #0f1714;
        border: 1.5px solid rgba(34, 197, 94, 0.25);
        color: #f8fafc;
      }
      .sp3-share-modal-overlay.visible .sp3-share-modal {
        transform: scale(1);
      }
      .sp3-share-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin: 20px 0;
      }
      .sp3-share-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-decoration: none;
        color: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        padding: 10px 4px;
        border-radius: 12px;
        transition: transform 0.2s, background-color 0.2s;
      }
      .sp3-share-item:hover {
        transform: translateY(-2px);
        background: rgba(20, 24, 15, 0.05);
      }
      [data-theme="dark"] .sp3-share-item:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .sp3-share-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #fff;
      }
      .sp3-copy-box {
        display: flex;
        align-items: center;
        background: rgba(20, 24, 15, 0.05);
        border: 1px solid rgba(20, 24, 15, 0.12);
        border-radius: 12px;
        padding: 8px 12px;
        margin-top: 14px;
      }
      [data-theme="dark"] .sp3-copy-box {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.15);
      }
      .sp3-copy-input {
        background: transparent;
        border: none;
        outline: none;
        font-size: 12.5px;
        color: inherit;
        flex: 1;
        text-overflow: ellipsis;
      }
      .sp3-copy-btn {
        background: #1E7A45;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s;
      }
      [data-theme="dark"] .sp3-copy-btn {
        background: #16a34a;
      }
      .sp3-copy-btn:hover {
        background: #166336;
      }
      .sp3-official-strip {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid rgba(20, 24, 15, 0.1);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      [data-theme="dark"] .sp3-official-strip {
        border-top-color: rgba(255, 255, 255, 0.12);
      }
      .sp3-official-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        margin: 0;
      }
      .sp3-official-btns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .sp3-official-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 7px 10px;
        border-radius: 10px;
        font-size: 11.5px;
        font-weight: 700;
        color: #fff !important;
        text-decoration: none;
        transition: transform 0.2s ease, filter 0.2s ease;
      }
      .sp3-official-btn.insta {
        background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
      }
      .sp3-official-btn.yt {
        background: #ef4444;
      }
      .sp3-official-btn:hover {
        transform: translateY(-1.5px);
        filter: brightness(1.08);
      }
    `;
    document.head.appendChild(style);
  }

  function createModal() {
    injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'sp3ShareModal';
    overlay.className = 'sp3-share-modal-overlay';
    overlay.innerHTML = `
      <div class="sp3-share-modal">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-family:'Outfit', sans-serif; font-size:18px;">Share S.P. Badminton Tourney</h3>
          <button type="button" id="sp3CloseShareBtn" style="background:none; border:none; font-size:22px; cursor:pointer; color:inherit;">&times;</button>
        </div>
        <p style="font-size:12.5px; color:#64748b; margin:6px 0 0 0;">
          Invite badminton pairs, friends, and spectators to join the tournament!
        </p>

        <div class="sp3-share-grid">
          <!-- WhatsApp -->
          <a class="sp3-share-item" id="shareWhatsApp" target="_blank" rel="noopener">
            <div class="sp3-share-icon" style="background:#25D366;">💬</div>
            <span>WhatsApp</span>
          </a>
          <!-- Twitter / X -->
          <a class="sp3-share-item" id="shareTwitter" target="_blank" rel="noopener">
            <div class="sp3-share-icon" style="background:#000000;">𝕏</div>
            <span>X / Twitter</span>
          </a>
          <!-- Telegram -->
          <a class="sp3-share-item" id="shareTelegram" target="_blank" rel="noopener">
            <div class="sp3-share-icon" style="background:#0088cc;">✈️</div>
            <span>Telegram</span>
          </a>
          <!-- Facebook -->
          <a class="sp3-share-item" id="shareFacebook" target="_blank" rel="noopener">
            <div class="sp3-share-icon" style="background:#1877F2;">📘</div>
            <span>Facebook</span>
          </a>
        </div>

        <div class="sp3-copy-box">
          <input type="text" class="sp3-copy-input" id="sp3ShareUrlInput" readonly value="${window.location.origin || 'https://spbadminton.in'}">
          <button type="button" class="sp3-copy-btn" id="sp3CopyShareLinkBtn">Copy Link</button>
        </div>

        <div class="sp3-official-strip">
          <div class="sp3-official-title">Official Tournament Channels</div>
          <div class="sp3-official-btns">
            <a href="https://www.instagram.com/sm_badminton_tournament_13?stkn=ZDVwcmpyOWU2cTlj" target="_blank" rel="noopener noreferrer" class="sp3-official-btn insta">
              <span>📸 Instagram</span>
            </a>
            <a href="https://youtube.com/@suryodaybadmintonclub?si=ej3mvLa6angJnqVj" target="_blank" rel="noopener noreferrer" class="sp3-official-btn yt">
              <span>▶️ YouTube</span>
            </a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Populate links
    const shareUrl = encodeURIComponent(SHARE_DATA.url);
    const shareText = encodeURIComponent(SHARE_DATA.text + " " + SHARE_DATA.url);

    document.getElementById('shareWhatsApp').href = `https://api.whatsapp.com/send?text=${shareText}`;
    document.getElementById('shareTwitter').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_DATA.text)}&url=${shareUrl}`;
    document.getElementById('shareTelegram').href = `https://t.me/share/url?url=${shareUrl}&text=${encodeURIComponent(SHARE_DATA.text)}`;
    document.getElementById('shareFacebook').href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;

    // Event listeners
    document.getElementById('sp3CloseShareBtn').addEventListener('click', closeShareModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeShareModal();
    });

    document.getElementById('sp3CopyShareLinkBtn').addEventListener('click', () => {
      const input = document.getElementById('sp3ShareUrlInput');
      input.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(() => {
          showToast("Tournament link copied to clipboard!");
          closeShareModal();
        });
      } else {
        document.execCommand('copy');
        showToast("Link copied!");
        closeShareModal();
      }
      if (window.sp3TrackEvent) window.sp3TrackEvent('social_share', { platform: 'clipboard' });
    });

    ['shareWhatsApp', 'shareTwitter', 'shareTelegram', 'shareFacebook'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        if (window.sp3TrackEvent) window.sp3TrackEvent('social_share', { platform: id.replace('share', '').toLowerCase() });
      });
    });
  }

  function openShareModal() {
    if (navigator.share) {
      navigator.share({
        title: SHARE_DATA.title,
        text: SHARE_DATA.text,
        url: SHARE_DATA.url
      }).then(() => {
        if (window.sp3TrackEvent) window.sp3TrackEvent('social_share', { platform: 'native_web_share' });
      }).catch(() => {
        // User cancelled or fallback
      });
      return;
    }

    const modal = document.getElementById('sp3ShareModal');
    if (modal) modal.classList.add('visible');
  }

  function closeShareModal() {
    const modal = document.getElementById('sp3ShareModal');
    if (modal) modal.classList.remove('visible');
  }

  window.openShareModal = openShareModal;

  window.addEventListener('DOMContentLoaded', () => {
    createModal();
    document.querySelectorAll('.btn-share-trigger, [data-action="share"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openShareModal();
      });
    });
  });
})();
