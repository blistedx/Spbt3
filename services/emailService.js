const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASS || '').replace(/\s+/g, '');

  if (!user || !pass) {
    console.warn('⚠️ SMTP credentials not found in environment (SMTP_USER/SMTP_PASS missing). Emails will be skipped.');
    return null;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = port === 465;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    pool: true,
    maxConnections: 3,
    maxMessages: 200,
    family: 4, // Prevents Windows IPv6 DNS timeout (drops latency from 30s to <1s)
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    auth: { user, pass }
  });

  return cachedTransporter;
}

function getAdminEmails() {
  if (process.env.ADMIN_EMAILS) {
    return process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean);
  }
  const fallback = process.env.SMTP_USER || process.env.EMAIL_USER;
  return fallback ? [fallback] : [];
}

/**
 * 1. Send Player Registration Receipt Email
 */
async function sendPlayerRegistrationReceipt(reg) {
  try {
    const transporter = getTransporter();
    const p1Email = (reg.p1Email || reg.player1Email || reg.email || reg.p1_email || '').trim().toLowerCase();
    const p2Email = (reg.p2Email || reg.player2Email || reg.p2_email || '').trim().toLowerCase();

    if (!p1Email || !p1Email.includes('@')) {
      console.warn(`ℹ️ Registration receipt skipped: No valid player email provided for Reg ID: ${reg.regId || 'N/A'}`);
      return;
    }

    const senderEmail = process.env.SMTP_USER || process.env.EMAIL_USER || 'blistedx@gmail.com';
    const regId = reg.regId || 'SP3-XXXX';
    const category = reg.categoryName || reg.category || "Men's Doubles";
    const p1Name = reg.p1Name || reg.player1Name || 'Lead Player';
    const p2Name = reg.p2Name || reg.player2Name || 'Partner';
    const p1Phone = reg.p1Phone || reg.player1Phone || '';
    const utr = reg.paymentUtr || reg.upiUtr || 'N/A';
    const time = reg.timestamp || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const textContent = `
S.P. BADMINTON TOURNEY SEASON 3
REGISTRATION RECEIPT & STATUS

Dear ${p1Name} & ${p2Name},

Thank you for registering for S.P. BADMINTON TOURNEY 3!
Your team registration has been successfully received and is currently Under Verification (2-6 Hours).

DETAILS:
- Registration ID: ${regId}
- Category: ${category}
- Player 1 (Lead): ${p1Name} (${p1Phone})
- Player 2 (Partner): ${p2Name}
- UPI UTR / Ref: ${utr}
- Submitted: ${time}

NEXT STEPS:
- Our committee will verify your payment details and approve your team slot.
- Once approved, you will automatically receive your Official Digital Match Pass.
- Track live status anytime on the tournament website with your Reg ID (${regId}) or mobile number.

Tournament Website: https://spbt3.vercel.app
Suryodaya Park Badminton Club
    `.trim();

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 4px 14px rgba(0,0,0,0.07);">
      <div style="background: linear-gradient(135deg, #09090b 0%, #15803d 100%); padding:28px 24px; text-align:center; color:#ffffff;">
        <h1 style="margin:0 0 6px 0; font-size:22px; color:#fde047; letter-spacing:0.5px; font-weight:800;">S.P. BADMINTON TOURNEY 3</h1>
        <p style="margin:0; font-size:12.5px; opacity:0.92; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Registration Received · Under Verification</p>
      </div>

      <div style="padding:26px 22px;">
        <p style="font-size:15px; color:#1e293b; margin:0 0 14px 0;">Dear <strong>${p1Name} &amp; ${p2Name}</strong>,</p>
        <p style="font-size:13.5px; color:#475569; line-height:1.6; margin:0 0 20px 0;">
          Thank you for registering for <strong>S.P. BADMINTON TOURNEY 3</strong>! Your team registration has been successfully submitted and is currently <strong>Under Verification (2–6 Hours)</strong>.
        </p>

        <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; padding:18px; margin-bottom:20px;">
          <table style="width:100%; border-collapse:collapse; font-size:13.5px; color:#334155;">
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:9px 0; color:#64748b; width:40%;"><strong>Registration ID:</strong></td>
              <td style="padding:9px 0; font-weight:800; font-family:monospace; font-size:16px; color:#15803d;">${regId}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:9px 0; color:#64748b;"><strong>Category:</strong></td>
              <td style="padding:9px 0; font-weight:700; color:#0f172a;">${category}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:9px 0; color:#64748b;"><strong>Player 1 (Lead):</strong></td>
              <td style="padding:9px 0;">${p1Name} (${p1Phone})</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:9px 0; color:#64748b;"><strong>Player 2 (Partner):</strong></td>
              <td style="padding:9px 0;">${p2Name}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:9px 0; color:#64748b;"><strong>Payment UTR / Ref:</strong></td>
              <td style="padding:9px 0; font-family:monospace; font-weight:700;">${utr}</td>
            </tr>
            <tr>
              <td style="padding:9px 0; color:#64748b;"><strong>Submission Time:</strong></td>
              <td style="padding:9px 0;">${time}</td>
            </tr>
          </table>
        </div>

        <div style="background:#eff6ff; border-left:4px solid #3b82f6; border-radius:6px; padding:14px; margin-bottom:20px; font-size:13px; color:#1e40af; line-height:1.5;">
          <strong>What Happens Next?</strong><br>
          • Our committee will verify your payment details and approve your entry slot.<br>
          • Once approved, you will automatically receive your <strong>Official Digital Match Pass</strong>.<br>
          • You can track live verification status anytime on the tournament website using your Reg ID (<strong>${regId}</strong>) or mobile number.
        </div>

        <div style="text-align:center; margin:24px 0 10px 0;">
          <a href="https://spbt3.vercel.app" target="_blank" style="background:#15803d; color:#ffffff; padding:13px 26px; text-decoration:none; border-radius:8px; font-weight:700; font-size:14px; display:inline-block; box-shadow:0 2px 8px rgba(21,128,61,0.3);">Track Status on Tournament Portal &rarr;</a>
        </div>
      </div>

      <div style="background:#f1f5f9; text-align:center; padding:14px; font-size:11.5px; color:#64748b; border-top:1px solid #e2e8f0;">
        S.P. Badminton Club · Suryodaya Park Outdoor Courts · Official Tournament System
      </div>
    </div>
    `;

    // Send to Player 1, and CC Player 2 if provided
    let toList = [p1Email];
    if (p2Email && p2Email.includes('@') && p2Email !== p1Email) {
      toList.push(p2Email);
    }

    if (transporter) {
      const info = await transporter.sendMail({
        from: `"S.P. Badminton Tourney 3" <${senderEmail}>`,
        replyTo: senderEmail,
        to: toList.join(', '),
        subject: `🏸 Registration Received: S.P. Badminton Tourney 3 [ID: ${regId}]`,
        text: textContent,
        html: htmlContent
      });
      console.log(`✅ [Email] Player receipt successfully sent to: ${toList.join(', ')} (MsgID: ${info.messageId})`);
    } else {
      console.log(`ℹ️ [Email] Skipped (SMTP not configured). Receipt ready for: ${toList.join(', ')}`);
    }
  } catch (err) {
    console.error(`❌ [Email] Error sending player registration receipt:`, err.message);
  }
}

/**
 * 2. Send New Registration Alert Email to Admins
 */
async function sendAdminRegistrationAlert(reg) {
  try {
    const transporter = getTransporter();
    const adminEmails = getAdminEmails();
    if (!adminEmails || adminEmails.length === 0) return;

    const senderEmail = process.env.SMTP_USER || process.env.EMAIL_USER || 'blistedx@gmail.com';
    const regId = reg.regId || 'SP3-XXXX';
    const category = reg.categoryName || reg.category || "Men's Doubles";
    const p1Name = reg.p1Name || reg.player1Name || 'Player 1';
    const p2Name = reg.p2Name || reg.player2Name || 'Player 2';
    const p1Phone = reg.p1Phone || reg.player1Phone || '';
    const p2Phone = reg.p2Phone || reg.player2Phone || '';
    const utr = reg.paymentUtr || reg.upiUtr || 'N/A';
    const time = reg.timestamp || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const textContent = `
[NEW REGISTRATION ALERT] S.P. BADMINTON TOURNEY 3
Registration ID: ${regId}
Category: ${category}

Player 1: ${p1Name} (${p1Phone})
Player 2: ${p2Name} (${p2Phone})
Payment UTR: ${utr}
Time: ${time}

Approve or review in Admin Panel: https://spbt3.vercel.app/admin
    `.trim();

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">
      <div style="background:#14532d; padding:22px 20px; text-align:center; color:#ffffff;">
        <h2 style="margin:0 0 4px 0; font-size:20px; color:#facc15;">🏸 S.P. BADMINTON TOURNEY 3</h2>
        <p style="margin:0; font-size:13px; opacity:0.95;">New Team Registration Alert</p>
      </div>

      <div style="padding:22px;">
        <div style="background:#dcfce7; border:1px solid #86efac; border-radius:8px; padding:12px 16px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:11px; color:#166534; font-weight:700; text-transform:uppercase;">Registration ID</div>
            <div style="font-size:18px; font-weight:800; color:#14532d; font-family:monospace;">${regId}</div>
          </div>
          <div style="background:#166534; color:#ffffff; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700;">
            ${category}
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:13.5px; color:#334155; margin-bottom:18px;">
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 0; color:#64748b; width:35%;"><strong>Player 1 (Lead):</strong></td><td style="padding:7px 0; font-weight:600;">${p1Name} (<a href="tel:${p1Phone}" style="color:#16a34a; text-decoration:none;">${p1Phone}</a>)</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 0; color:#64748b;"><strong>Player 2 (Partner):</strong></td><td style="padding:7px 0; font-weight:600;">${p2Name} (<a href="tel:${p2Phone}" style="color:#16a34a; text-decoration:none;">${p2Phone}</a>)</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 0; color:#64748b;"><strong>UPI UTR / Ref:</strong></td><td style="padding:7px 0; font-family:monospace; font-weight:700; color:#0f172a;">${utr}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 0; color:#64748b;"><strong>Time:</strong></td><td style="padding:7px 0;">${time}</td></tr>
        </table>

        <div style="text-align:center; margin-top:20px;">
          <a href="https://spbt3.vercel.app/admin" target="_blank" style="background:#16a34a; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:700; font-size:14px; display:inline-block;">Open Admin Panel to Approve / Reject &rarr;</a>
        </div>
      </div>

      <div style="background:#f8fafc; text-align:center; padding:12px; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0;">
        Admin notification automatically dispatched to: ${adminEmails.join(', ')}
      </div>
    </div>
    `;

    if (transporter) {
      const info = await transporter.sendMail({
        from: `"S.P. Badminton Alerts" <${senderEmail}>`,
        replyTo: senderEmail,
        to: adminEmails.join(', '),
        subject: `🏸 [New Registration] ${p1Name} & ${p2Name} (${category} - ${regId})`,
        text: textContent,
        html: htmlContent
      });
      console.log(`✅ [Email] Admin notification sent to: ${adminEmails.join(', ')} (MsgID: ${info.messageId})`);
    }
  } catch (err) {
    console.error(`❌ [Email] Error sending admin registration alert:`, err.message);
  }
}

/**
 * 3. Send Player Approval & Official Digital Match Pass Email
 */
async function sendPlayerApprovalEmail(reg) {
  try {
    const transporter = getTransporter();
    const p1Email = (reg.p1Email || reg.player1Email || reg.email || reg.p1_email || '').trim().toLowerCase();
    const p2Email = (reg.p2Email || reg.player2Email || reg.p2_email || '').trim().toLowerCase();

    if (!p1Email || !p1Email.includes('@')) return;

    const senderEmail = process.env.SMTP_USER || process.env.EMAIL_USER || 'blistedx@gmail.com';
    const regId = reg.regId || 'SP3-XXXX';
    const category = reg.categoryName || reg.category || "Men's Doubles";
    const p1Name = reg.p1Name || reg.player1Name || 'Player 1';
    const p2Name = reg.p2Name || reg.player2Name || 'Player 2';
    const p1Phone = reg.p1Phone || reg.player1Phone || '';
    const utr = reg.paymentUtr || reg.upiUtr || 'VERIFIED';

    const textContent = `
CONGRATULATIONS! REGISTRATION APPROVED
S.P. BADMINTON TOURNEY SEASON 3

Dear ${p1Name} & ${p2Name},
Your registration has been VERIFIED & APPROVED for the tournament.

REGISTRATION ID: ${regId}
CATEGORY: ${category}
VENUE: Suryodaya Park Outdoor Badminton Court
DATES: 28–30 Aug 2026

Access your official Match Pass: https://spbt3.vercel.app
    `.trim();

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 4px 14px rgba(0,0,0,0.07);">
      <div style="background: linear-gradient(135deg, #14180F 0%, #1E7A45 100%); padding:28px 20px; text-align:center; color:#ffffff;">
        <h2 style="margin:0 0 4px 0; font-size:24px; color:#FFD700; letter-spacing:0.02em;">S.P. BADMINTON TOURNEY 3</h2>
        <div style="font-size:12px; opacity:0.9; text-transform:uppercase; letter-spacing:0.06em;">Official Player Match Pass &amp; Entry Confirmation</div>
      </div>

      <div style="padding:24px;">
        <div style="background:#dcfce7; border:1.5px solid #86efac; border-radius:8px; padding:14px; margin-bottom:20px; text-align:center;">
          <div style="font-size:18px; font-weight:bold; color:#166534; margin-bottom:2px;">✓ REGISTRATION VERIFIED &amp; APPROVED</div>
          <div style="font-size:12.5px; color:#15803d;">Your team slot is confirmed for the championship knockout draw.</div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Registration ID:</strong></td><td style="padding:8px 0; font-family:monospace; font-weight:bold; font-size:16px; color:#166534;">${regId}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Category:</strong></td><td style="padding:8px 0; font-weight:bold; color:#1E7A45;">${category}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Player 1 (Lead):</strong></td><td style="padding:8px 0; font-weight:600;">${p1Name} (${p1Phone})</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Player 2 (Partner):</strong></td><td style="padding:8px 0; font-weight:600;">${p2Name}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Tournament Venue:</strong></td><td style="padding:8px 0;">Suryodaya Park Outdoor Badminton Court</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;"><strong>Tournament Dates:</strong></td><td style="padding:8px 0;">28–30 Aug 2026</td></tr>
          <tr><td style="padding:8px 0; color:#64748b;"><strong>Payment Status:</strong></td><td style="padding:8px 0; color:#16a34a; font-weight:700;">VERIFIED (${utr})</td></tr>
        </table>

        <div style="background:#f8fafc; border-radius:8px; padding:14px; border:1px solid #e2e8f0; font-size:12.5px; color:#475569; line-height:1.5; margin-bottom:20px;">
          <strong>Important Player Instructions:</strong><br>
          • Please arrive at the venue at least 30 minutes prior to your scheduled match slot.<br>
          • Non-marking badminton shoes are mandatory.<br>
          • Keep this confirmation email or check your digital pass from the tournament website for desk verification.
        </div>

        <div style="text-align:center;">
          <a href="https://spbt3.vercel.app" target="_blank" style="background:#14532D; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:14px; display:inline-block;">View Match Schedule &amp; Pass &rarr;</a>
        </div>
      </div>

      <div style="background:#f1f5f9; text-align:center; padding:14px; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0;">
        S.P. Badminton Club · Suryodaya Park · Need help? Contact tournament directors
      </div>
    </div>
    `;

    let toList = [p1Email];
    if (p2Email && p2Email.includes('@') && p2Email !== p1Email) {
      toList.push(p2Email);
    }

    if (transporter) {
      const info = await transporter.sendMail({
        from: `"S.P. Badminton Tourney 3" <${senderEmail}>`,
        replyTo: senderEmail,
        to: toList.join(', '),
        subject: `🎉 Registration APPROVED: S.P. Badminton Tourney 3 [Pass: ${regId}]`,
        text: textContent,
        html: htmlContent
      });
      console.log(`✅ [Email] Approval confirmation sent to: ${toList.join(', ')} (MsgID: ${info.messageId})`);
    }
  } catch (err) {
    console.error(`❌ [Email] Error sending player approval email:`, err.message);
  }
}

module.exports = {
  sendPlayerRegistrationReceipt,
  sendAdminRegistrationAlert,
  sendPlayerApprovalEmail
};
