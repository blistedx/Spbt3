# 📱 S.P. Badminton Tourney 3 · Mobile UI/UX & Animation Upgrade Roadmap

**Status:** ✅ Completed & Active (Implemented October 5, 2026)  
**Created:** October 5, 2026  
**Testing Environment:** `http://localhost:3100`  
**Safe Working Branch:** `backup-stable-2026-10-05`  
**Physical Backup:** `D:\Private\sp3_backup_stable` & `D:\Private\sp3_backup_stable_20261005.zip`

---

## 🎯 Objective
Upgrade the frontend UI and UX across the tournament portal specifically tailored for mobile screens (smartphones, tablets, and mobile browsers) while keeping **all backend configurations, database schemas, tournament settings, and routes 100% identical and untouched**.

---

## 📋 Comprehensive Implementation Blueprint

### 1. 📱 App-Style Mobile Bottom Navigation Dock
* **Scope:** `index.html` (media query: `max-width: 768px`)
* **Design & Positioning:**
  * Fixed bottom dock (`position: fixed; bottom: 0; left: 0; right: 0; z-index: 1100;`).
  * Frosted glass aesthetics:
    * Light Mode: `background: rgba(255, 255, 255, 0.88); backdrop-filter: blur(16px); border-top: 1px solid rgba(0, 0, 0, 0.08);`
    * Dark Mode: `background: rgba(9, 14, 12, 0.90); backdrop-filter: blur(16px); border-top: 1px solid rgba(255, 255, 255, 0.1);`
  * Safe-area padding: `padding: 6px 12px calc(6px + env(safe-area-inset-bottom, 8px));`
* **5 Key Touch Actions:**
  1. 🏠 **Home** (`href="#"`)
  2. 🏷️ **Categories** (`href="#categories"`)
  3. 📅 **Schedule** (`href="#schedule"`)
  4. 🏆 **Draws** (`href="#draws"`)
  5. ⚡ **Register** (`onclick="openRegister()"` with highlighted green gradient glow)
* **Interactivity:**
  * Active indicator tracking currently visible section via `IntersectionObserver`.
  * Haptic-style scale tap feedback: `:active { transform: scale(0.92); }`.
  * Page content bottom clearance: `body { padding-bottom: calc(74px + env(safe-area-inset-bottom, 8px)); }`.

---

### 2. 🗂️ Mobile Bottom-Sheet Drawer Modals
* **Affected Modals:**
  * `#regModal` (Registration Form)
  * `#statusModal` (Verify Digital Pass & Status)
  * `#termsModal` (Tournament Rules & Terms)
  * `#regSuccessModal` (Registration Confirmation & Digital Pass)
* **Changes:**
  * On mobile (`<= 768px`), switch from centered popups to **Native Mobile Bottom Sheets**:
    * Sheet anchors to screen bottom: `margin-top: auto; margin-bottom: 0; width: 100%; max-width: 100%;`.
    * Ergonomic rounded top corners: `border-radius: 24px 24px 0 0;`.
    * Maximum viewport height: `max-height: 90vh;` or `calc(100dvh - 24px)`.
    * Tactile pull-down grab bar indicator (`::before` pill) on `.modal-head`.
    * Smooth spring slide-up animation:
      ```css
      @keyframes mobileBottomSheetSlideUp {
        from { transform: translateY(100%); opacity: 0.8; }
        to { transform: translateY(0); opacity: 1; }
      }
      ```
    * Touch scrolling with momentum: `-webkit-overflow-scrolling: touch; overscroll-behavior: contain;`.
    * Large 44px+ hit targets on close buttons.

---

### 3. 👆 Touch Ergonomics & Micro-Animations
* **Tap Feedback:**
  * Remove grey tap highlights: `* { -webkit-tap-highlight-color: transparent; }`.
  * Tactile button compression: `.btn:active, .sched-day-btn:active, .sched-cat-btn:active, .cat-info-card:active { transform: scale(0.96); transition: transform 0.1s ease; }`.
* **Form Accessibility:**
  * Force input font size to `16px` on mobile inputs (`input, select, textarea { font-size: 16px !important; }`) to prevent iOS Safari auto-zooming.
  * Minimum touch target heights: `46px - 50px`.
* **Notch & Safe Areas:**
  * Ensure `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`.
  * Floating widgets clearance (WhatsApp community float & PWA banners) adjusted to sit comfortably above the mobile bottom dock.

---

### 4. 🔄 Horizontal Touch Carousels & Snap Gestures
* **Schedule Section (`#schedule`):**
  * Day selector tabs (`.schedule-day-tabs`) and Category filter pills (`.sched-cat-filters`) configured with horizontal smooth scrolling:
    ```css
    overflow-x: auto;
    flex-wrap: nowrap;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    ```
* **Knockout Bracket Tree (`#draws`):**
  * Bracket columns with smooth touch snap and visible round progress pills.
  * Subtle animated pulse on the swipe hint indicator.

---

### 5. 🎨 Standalone Registration (`register.html`) & Categories (`categories.html`)
* **Responsive Card Padding:**
  * Compact form padding on small screens (`<= 480px`): `padding: 1.25rem 1rem;`.
  * Payment QR code & UPI box centered with instant tap-to-copy button.
  * Sticky or full-width primary CTA button at the bottom of the form.

---

## 🚀 How to Execute When Ready
When you are ready to implement:
1. Ensure the localhost server is running (`node server.js`).
2. Simply say: *"Start mobile UI/UX implementation from roadmap"* or *"Implement mobile dock and bottom sheets"*.
3. All changes will be developed and verified on `http://localhost:3100`.
