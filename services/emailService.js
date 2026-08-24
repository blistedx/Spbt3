const nodemailer = require('nodemailer');

function getTransporter() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASS;

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

function getAdminEmails() {
  if (process.env.ADMIN_EMAILS) {
    return process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean);
  }
  return [];
}

/**
 * 1. Send Player Registration Receipt Email
 */
async function sendPlayerRegistrationReceipt(reg) {
  try {
    const transporter = getTransporter();
    const p1Email = (reg.p1Email || reg.player1Email || '').trim();
    if (!p1Email || !p1Email.includes('@')) return;

    const senderEmail = process.env.SMTP_USER || process.env.EMAIL_USER || 'no-reply@spbadminton.com';
    const regId = reg.regId || 'SP3-XXXX';
    const category = reg.categoryName || reg.category || 'Men\'s Doubles';
    const p1Name = reg.p1Name || reg.player1Name || 'Lead Player';
    const p2Name = reg.p2Name || reg.player2Name || 'Partner';
    const p1Phone = reg.p1Phone || reg.player1Phone || '';
    const utr = reg.paymentUtr || reg.upiUtr || 'N/A';
    const time = reg.timestamp || new Date().toLocaleString('en-IN');

    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #166534 100%); padding:26px 20px; text-align:center; color:#ffffff;">
        <h2 style="margin:0 0 4px 0; font-size:22px; color:#fde047; letter-spacing:0.5px;">S.P. BADMINTON TOURNEY 3</h2>
        <p style="margin:0; font-size:12.5px; opacity:0.9; text-transform:uppercase; letter-spacing:0.05em;">Registration Received · Under Verification</p>
      </div>

      <div style="padding:24px;">
        <p style="font-size:15px; color:#1e293b; margin:0 0 16px 0;">Dear <strong>${p1Name} &amp; ${p2Name}</strong>,</p>
        <p style="font-size:13.5px; color:#475569; line-height:1.6; margin:0 0 20px 0;">
          Thank you for registering for <strong>S.P. BADMINTON TOURNEY 3</strong>! Your team registration has been successfully submitted and is currently <strong>Under Verification (2–6 Hours)</strong>.
        </p>

        <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; padding:18px; margin-bottom:20px;">
          <table style="width:100%; border-collapse:collapse; font-size:13.5px; color:#334155;">
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0; color:#64748b; width:40%;"><strong>Registration ID:</strong></td>
              <td style="padding:8px 0; font-weight:800; font-family:monospace; font-size:16px; color:#166534;">${regId}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0; color:#64748b;"><strong>Category:</strong></td>
              <td style="padding:8px 0; font-weight:700; color:#0f172a;">${category}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0; color:#64748b;"><strong>Player 1 (Lead):</strong></td>
              <td style="padding:8px 0;">${p1Name} (${p1Phone})</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0; color:#64748b;"><strong>Player 2 (Partner):</strong></td>
              <td style="padding:8px 0;">${p2Name}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 0; color:#64748b;"><strong>Payment Reference / UTR:</strong></td>
              <td style="padding:8px 0; font-family:monospace; font-weight:700;">${utr}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#64748b;"><strong>Submission Time:</strong></td>
              <td style="padding:8px 0;">${time}</td>
            </tr>
          </table>
        </div>

        <div style="background:#eff6ff; border-left:4px solid #3b82f6; border-radius:6px; padding:14px; margin-bottom:20px; font-size:13px; color:#1e40af; line-height:1.5;">
          <strong>Next Steps:</strong><br>
          • Our committee will verify your payment details and approve your entry.<br>
          • Once approved, you will automatically receive your <strong>Official Digital Match Pass</strong>.<br>
          • You can track live verification status anytime on the tournament website by entering your Reg ID (<strong>${regId}</strong>) or mobile number.
        </div>

        <div style="text-align:center; margin-top:20px;">
          <a href="https://spbt3.vercel.app" target="_blank" style="background:#166534; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:700; font-size:13.5px; display:inline-block;">Track Status on Website &rarr;</a>
        </div>
      </div>

      <div style="background:#f1f5f9; text-align:center; padding:14px; font-size:11.5px; color:#64748b; border-top:1px solid #e2e8f0;">
        S.P. Badminton Club · Suryodaya Park · Official Tournament System
      </div>
    </div>
    `;

    if (transporter) {
      await transporter.sendMail({
        from: `"S.P. Badminton Tourney 3" <${senderEmail}>`,
        to: p1Email,
        subject: `🏸 Registration Received: S.P. Badminton Tourney 3 (${regId})`,
        html
      });
      console.log(`✅ Registration receipt email sent to: ${p1Email}`);
    } else {
      console.log(`ℹ️ Email skipped (SMTP not configured in .env). Receipt email ready for: ${p1Email}`);
    }
  } catch (err) {
    console.warn(`⚠️ Error sending player registration receipt email:`, err.message);
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

    const senderEmail = process.env.SMTP_USER || process.env.EMAIL_USER || 'no-reply@spbadminton.com';
    const regId = reg.regId || 'SP3-XXXX';
    const category = reg.categoryName || reg.category || 'Men\'s Doubles';
    const p1Name = reg.p1Name || reg.player1Name || 'Player 1';
    const p2Name = reg.p2Name || reg.player2Name || 'Player 2';
    const p1Phone = reg.p1Phone || reg.player1Phone || '';
    const p2Phone = reg.p2Phone || reg.player2Phone || '';
    const utr = reg.paymentUtr || reg.upiUtr || 'N/A';
    const time = reg.timestamp || new Date().toLocaleString('en-IN');

    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">
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
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 0; color:#64748b; width:35%;"><strong>Player 1 (Lead):</strong></td><td style="padding:6px 0; font-weight:600;">${p1Name} (<a href="tel:${p1Phone}" style="color:#16a34a; text-decoration:none;">${p1Phone}</a>)</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 0; color:#64748b;"><strong>Player 2 (Partner):</strong></td><td style="padding:6px 0; font-weight:600;">${p2Name} (<a href="tel:${p2Phone}" style="color:#16a34a; text-decoration:none;">${p2Phone}</a>)</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 0; color:#64748b;"><strong>UPI UTR / Ref:</strong></td><td style="padding:6px 0; font-family:monospace; font-weight:700; color:#0f172a;">${utr}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 0; color:#64748b;"><strong>Time:</strong></td><td style="padding:6px 0;">${time}</td></tr>
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
      await transporter.sendMail({
        from: `"S.P. Badminton Alerts" <${senderEmail}>`,
        to: adminEmails.join(', '),
        subject: `🏸 [New Registration] ${p1Name} & ${p2Name} (${category} - ${regId})`,
        html
      });
      console.log(`✅ Admin notification email sent to: ${adminEmails.join(', ')}`);
    } else {
      console.log(`ℹ️ Admin email skipped (SMTP not configured in .env). Alert ready for: ${adminEmails.join(', ')}`);
    }
  } catch (err) {
    console.warn(`⚠️ Error sending admin registration alert email:`, err.message);
  }
}

/**
 * 3. Send Player Approval & Official Digital Match Pass Email
 */
async function sendPlayerApprovalEmail(reg) {
  try {
    const transporter = getTransporter();
    const p1Email = (reg.p1Email || reg.player1Email || '').trim();
    if (!p1Email || !p1Email.includes('@')) return;

    const senderEmail = process.env.SMTP_USER || process.env.EMAIL_USER || 'no-reply@spbadminton.com';
    const regId = reg.regId || 'SP3-XXXX';
    const category = reg.categoryName || reg.category || 'Men\'s Doubles';
    const p1Name = reg.p1Name || reg.player1Name || 'Player 1';
    const p2Name = reg.p2Name || reg.player2Name || 'Player 2';
    const p1Phone = reg.p1Phone || reg.player1Phone || '';
    const utr = reg.paymentUtr || reg.upiUtr || 'VERIFIED';

    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
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

    if (transporter) {
      await transporter.sendMail({
        from: `"S.P. Badminton Tourney 3" <${senderEmail}>`,
        to: p1Email,
        subject: `🎉 Registration APPROVED: S.P. Badminton Tourney 3 (${regId})`,
        html
      });
      console.log(`✅ Approval confirmation email sent to: ${p1Email}`);
    } else {
      console.log(`ℹ️ Approval email skipped (SMTP not configured in .env). Ready for: ${p1Email}`);
    }
  } catch (err) {
    console.warn(`⚠️ Error sending player approval email:`, err.message);
  }
}

module.exports = {
  sendPlayerRegistrationReceipt,
  sendAdminRegistrationAlert,
  sendPlayerApprovalEmail
};
