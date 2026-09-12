/**
 * Web Push Notification Service for S.P. Badminton Tourney 3
 * Using Web Push Protocol & VAPID Keys
 */

require('dotenv').config();
const webpush = require('web-push');
const dataStore = require('../config/dataStore');

// Ensure VAPID keys from environment or generated fallback
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
let vapidSubject = process.env.VAPID_SUBJECT || 'mailto:blistedx@gmail.com';

if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    const gen = webpush.generateVAPIDKeys();
    vapidPublicKey = gen.publicKey;
    vapidPrivateKey = gen.privateKey;
    console.log('[WebPush] Auto-generated temporary VAPID Keys.');
  } catch (e) {
    console.error('[WebPush] Failed to generate VAPID keys:', e.message);
  }
}

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('[WebPush] VAPID details configured successfully.');
  } catch (e) {
    console.warn('[WebPush] Error setting VAPID details:', e.message);
  }
}

// In-memory log of recent sent notifications
const notificationLog = [];

const pushNotificationService = {
  getPublicKey() {
    return vapidPublicKey;
  },

  async subscribeClient(subData) {
    return await dataStore.savePushSubscription(subData);
  },

  async sendPushNotification({ title, message, url, icon, badge, audience, adminPin }) {
    const targetAudience = (audience || 'ALL').toUpperCase();
    try { await dataStore.syncFromDb(); } catch (e) {}
    const subs = dataStore.getPushSubscriptions(targetAudience);

    const payload = JSON.stringify({
      title: title || 'S.P. Badminton Tourney 3',
      body: message || 'Live Tournament Update',
      icon: icon || '/logo.png',
      badge: badge || '/favicon-32x32.png',
      url: url || '/',
      tag: 'sp3-alert-' + Date.now(),
      data: {
        url: url || '/',
        timestamp: Date.now()
      }
    });

    let sentCount = 0;
    let failedCount = 0;
    const pruneList = [];

    const sendPromises = subs.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys ? sub.keys.p256dh : sub.p256dh,
          auth: sub.keys ? sub.keys.auth : sub.auth
        }
      };

      try {
        const pushOptions = {
          TTL: 86400, // 24 hours delivery window
          urgency: 'high' // Maximum priority for heads-up lockscreen delivery even when PWA/browser is closed
        };
        await webpush.sendNotification(pushSubscription, payload, pushOptions);
        sentCount++;
      } catch (err) {
        failedCount++;
        // If subscription is expired or unregistered, prune it
        if (err.statusCode === 404 || err.statusCode === 410) {
          pruneList.push(sub.endpoint);
        } else {
          console.warn('[WebPush] Delivery warning to endpoint:', err.statusCode, err.message);
        }
      }
    });

    await Promise.all(sendPromises);

    // Prune expired endpoints
    pruneList.forEach(ep => dataStore.deletePushSubscription(ep));

    const logEntry = {
      id: 'notif_' + Date.now(),
      title: title || 'S.P. Badminton Tourney 3',
      message: message || '',
      audience: targetAudience,
      url: url || '/',
      targetedCount: subs.length,
      sentCount,
      failedCount,
      timestamp: new Date().toISOString()
    };

    notificationLog.unshift(logEntry);
    if (notificationLog.length > 50) notificationLog.pop();

    return {
      success: true,
      targetedCount: subs.length,
      sentCount,
      failedCount,
      logEntry
    };
  },

  getNotificationLogs() {
    return [...notificationLog];
  },

  async getStats() {
    const storeStats = await dataStore.getPushStats();
    return {
      ...storeStats,
      totalSentCampaigns: notificationLog.length
    };
  }
};

module.exports = pushNotificationService;
