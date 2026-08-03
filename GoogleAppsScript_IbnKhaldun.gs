// ============================================================
// ইবনে খালদুন ইনস্টিটিউট — Google Apps Script Email Service
// ============================================================
// এই Script টি Google Apps Script (script.google.com) -এ deploy করুন।
//
// সেটআপ পদ্ধতি:
// ১. script.google.com এ যান
// ২. নতুন Project তৈরি করুন (নাম: IbnKhaldunInstitute_Email)
// ৩. এই পুরো কোডটি Code.gs তে paste করুন
// ৪. Extensions → Apps Script Properties এ গিয়ে SECRET_TOKEN সেট করুন
//    অথবা নিচের SECRET_TOKEN ভেরিয়েবলে সরাসরি দিন।
// ৫. Deploy → New Deployment → Web App:
//    - Execute as: Me (momizanr@gmail.com)
//    - Who has access: Anyone
// ৬. Deploy URL টি কপি করে backend/.env এর GOOGLE_SCRIPT_URL তে বসান
//
// IMPORTANT: Gmail এ "Less secure app access" বা App Password লাগবে না।
// Google Apps Script নিজেই আপনার Gmail দিয়ে email পাঠায়।
// ============================================================

// ── সিক্রেট টোকেন — backend .env এর GOOGLE_SCRIPT_SECRET এর সাথে হুবহু মিলতে হবে ──
const SECRET_TOKEN = 'ibnkhaldun_gas_secret_2024';

// ── প্রতিষ্ঠানের নাম ──
const INSTITUTE_NAME = 'ইবনে খালদুন ইনস্টিটিউট';

// ── প্রতিষ্ঠানের রঙ ──
const PRIMARY_COLOR = '#066144';
const GOLD_COLOR    = '#F5C518';

// ============================================================
// doPost — সমস্ত POST request এখানে আসে
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Secret token যাচাই
    if (data.secret !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }

    const { to, subject, html, type } = data;

    if (!to || !subject || !html) {
      return jsonResponse({ ok: false, error: 'Missing required fields: to, subject, html' });
    }

    // Email পাঠান
    GmailApp.sendEmail(to, subject, stripHtml(html), {
      htmlBody: wrapEmailTemplate(html, type),
      name: INSTITUTE_NAME,
      replyTo: 'momizanr@gmail.com',
    });

    return jsonResponse({ ok: true, message: 'Email sent', to: to, type: type || 'general' });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ============================================================
// doGet — Health check
// ============================================================
function doGet(e) {
  return jsonResponse({ ok: true, service: INSTITUTE_NAME + ' Email Service', status: 'active' });
}

// ============================================================
// Email Template Wrapper — সুন্দর HTML ইমেইল তৈরি করে
// ============================================================
function wrapEmailTemplate(html, type) {
  // Type-specific header color
  let headerColor = PRIMARY_COLOR;
  let headerTitle = INSTITUTE_NAME;

  if (type === 'otp') {
    headerColor = PRIMARY_COLOR;
    headerTitle = INSTITUTE_NAME + ' — OTP যাচাইকরণ';
  } else if (type === 'login') {
    headerColor = '#1e40af';
    headerTitle = INSTITUTE_NAME + ' — লগইন সতর্কতা';
  } else if (type === 'purchase' || type === 'purchase-confirm') {
    headerColor = '#7c3aed';
    headerTitle = INSTITUTE_NAME + ' — কোর্স ক্রয় নিশ্চিতকরণ';
  } else if (type === 'access-approved') {
    headerColor = '#065f46';
    headerTitle = INSTITUTE_NAME + ' — কোর্স একসেস অনুমোদিত';
  } else if (type === 'access-rejected') {
    headerColor = '#991b1b';
    headerTitle = INSTITUTE_NAME + ' — রিকোয়েস্ট আপডেট';
  } else if (type === 'admin-notify') {
    headerColor = '#92400e';
    headerTitle = INSTITUTE_NAME + ' — অ্যাডমিন নোটিফিকেশন';
  } else if (type === 'password-reset') {
    headerColor = '#be185d';
    headerTitle = INSTITUTE_NAME + ' — পাসওয়ার্ড রিসেট';
  }

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headerTitle}</title>
  <style>
    body { margin:0; padding:0; background:#f4f7f3; font-family: Arial, 'Hind Siliguri', sans-serif; }
    .wrapper { max-width:600px; margin:24px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.10); }
    .header { background:${headerColor}; padding:24px 28px; text-align:center; }
    .header h1 { color:#ffffff; margin:0; font-size:20px; font-weight:700; }
    .header .icon { font-size:32px; margin-bottom:8px; display:block; }
    .body { padding:28px 32px; color:#1f2937; font-size:15px; line-height:1.7; }
    .footer { background:#f9fafb; padding:16px 28px; text-align:center; border-top:1px solid #e5e7eb; }
    .footer p { color:#9ca3af; font-size:12px; margin:4px 0; }
    .footer .logo { font-weight:700; color:${PRIMARY_COLOR}; font-size:14px; }
    .btn { display:inline-block; padding:12px 28px; background:${PRIMARY_COLOR}; color:#ffffff !important; text-decoration:none; border-radius:8px; font-weight:700; font-size:15px; margin:14px 0; }
    .otp-box { background:#f0fdf4; border:2px dashed ${PRIMARY_COLOR}; border-radius:10px; padding:20px; text-align:center; margin:16px 0; }
    .otp-code { font-size:42px; font-weight:900; letter-spacing:14px; color:#04412e; font-family:monospace; }
    .info-table { width:100%; border-collapse:collapse; margin:12px 0; }
    .info-table td { padding:9px 12px; border-bottom:1px solid #f3f4f6; font-size:14px; }
    .info-table td:first-child { font-weight:700; color:#374151; width:40%; }
    .alert-box { background:#fef3c7; border:1px solid ${GOLD_COLOR}; border-radius:8px; padding:12px 16px; margin:14px 0; font-size:13px; color:#92400e; }
    .success-box { background:#dcfce7; border:1px solid #16a34a; border-radius:8px; padding:12px 16px; margin:14px 0; font-size:13px; color:#065f46; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${headerTitle}</h1>
    </div>
    <div class="body">
      ${html}
    </div>
    <div class="footer">
      <p class="logo">${INSTITUTE_NAME}</p>
      <p>এই ইমেইলটি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে। সরাসরি reply করবেন না।</p>
      <p>যোগাযোগ: <a href="mailto:momizanr@gmail.com" style="color:${PRIMARY_COLOR}">momizanr@gmail.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================
// Helpers
// ============================================================
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}


// ============================================================
// ════════════════════════════════════════════════════════════
// নিচের ফাংশনগুলো Backend (server.js) থেকে call হয়।
// কিন্তু এখানে সরাসরি test করতে পারবেন।
// ════════════════════════════════════════════════════════════
// ============================================================

// ── Test: OTP Email পাঠানো ──
function testSendOTP() {
  const testEmail = 'test@example.com';
  const otp = '5678';
  GmailApp.sendEmail(
    testEmail,
    INSTITUTE_NAME + ' — OTP টেস্ট',
    'আপনার OTP: ' + otp,
    {
      htmlBody: wrapEmailTemplate(buildOTPHtml(otp, 'নিবন্ধন'), 'otp'),
      name: INSTITUTE_NAME,
    }
  );
  Logger.log('Test OTP email sent to: ' + testEmail);
}

// ── Test: Login Notification ──
function testLoginNotification() {
  const testEmail = 'test@example.com';
  GmailApp.sendEmail(
    testEmail,
    INSTITUTE_NAME + ' — লগইন সতর্কতা টেস্ট',
    'আপনার অ্যাকাউন্টে লগইন হয়েছে।',
    {
      htmlBody: wrapEmailTemplate(buildLoginHtml('টেস্ট ব্যবহারকারী', testEmail, new Date().toLocaleString('bn-BD'), 'টেস্ট ডিভাইস'), 'login'),
      name: INSTITUTE_NAME,
    }
  );
  Logger.log('Test login email sent to: ' + testEmail);
}

// ── HTML Builders (for reference/documentation) ──

function buildOTPHtml(otp, purpose) {
  return `
    <p>আপনার <strong>${purpose}</strong> OTP কোড:</p>
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>
    <p style="color:#6b7280;font-size:13px">এই কোড <strong>৫ মিনিট</strong> পর্যন্ত valid।</p>
    <p style="color:#6b7280;font-size:13px">কোডটি কারো সাথে শেয়ার করবেন না।</p>
  `;
}

function buildLoginHtml(name, email, time, device) {
  return `
    <p>প্রিয় <strong>${name}</strong>,</p>
    <p>আপনার <strong>${INSTITUTE_NAME}</strong> অ্যাকাউন্টে সফলভাবে লগইন হয়েছে।</p>
    <table class="info-table">
      <tr><td>ইমেইল</td><td>${email}</td></tr>
      <tr><td>সময়</td><td>${time}</td></tr>
      <tr><td>ডিভাইস</td><td>${device}</td></tr>
    </table>
    <div class="alert-box">
      যদি আপনি লগইন না করে থাকেন, অবিলম্বে আপনার পাসওয়ার্ড পরিবর্তন করুন এবং আমাদের সাথে যোগাযোগ করুন।
    </div>
  `;
}
