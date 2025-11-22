const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient').default;
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// store last email send result for debugging (do not include secrets)
let lastEmailSendResult = null;

// optional Twilio client (SMS) if configured
let twilioClient = null;
if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
  try {
    const Twilio = require('twilio');
    twilioClient = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  } catch (err) {
    console.warn('Twilio package not available or failed to initialize:', err && err.message);
    twilioClient = null;
  }
}

// helper: generate 6-digit numeric OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// helper: send email OTP with priority: SMTP -> Brevo API -> Ethereal fallback
async function sendEmailOTP(to, code) {
  let host = process.env.SMTP_HOST;
  let port = parseInt(process.env.SMTP_PORT || '587', 10);
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;
  let transporter;

  // template rendering from env (simple replacement)
  const minutes = process.env.OTP_MINUTES || '10';
  const defaultSubject = 'Pluvia Academy - Kode Verifikasi';
  const defaultText = `Kode verifikasi Anda: {{code}} (berlaku {{minutes}} menit)`;
  const defaultHtml = `<p>Kode verifikasi Anda: <strong>{{code}}</strong></p><p>Berlaku {{minutes}} menit.</p>`;
  const subjectTemplate = process.env.OTP_SUBJECT || defaultSubject;
  const textTemplate = process.env.OTP_TEXT || defaultText;
  const htmlTemplate = process.env.OTP_HTML || defaultHtml;
  const render = (tpl, vars) => {
    let out = tpl;
    Object.keys(vars).forEach(k => {
      const re = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
      out = out.replace(re, vars[k]);
    });
    return out;
  };
  const subject = render(subjectTemplate, { code, minutes });
  const textBody = render(textTemplate, { code, minutes });
  const htmlBody = render(htmlTemplate, { code, minutes });

  // Prefer SMTP relay if configured
  if (host && user && pass) {
    try {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || user,
        to,
        subject: subject,
        text: textBody,
        html: htmlBody
      });

      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log('Email preview URL:', preview);
      console.log('SMTP email sent:', info && info.messageId);
      lastEmailSendResult = { provider: 'smtp', ok: true, info, preview };
      return true;
    } catch (err) {
      console.error('SMTP send error:', err && err.message);
      if (err && err.stack) console.error(err.stack);
      lastEmailSendResult = { provider: 'smtp', ok: false, error: err && err.message };
      // fall through to try Brevo API if available
    }
  }

  // Try Brevo API if configured
  if (process.env.BREVO_API_KEY) {
    try {
      const apiKey = process.env.BREVO_API_KEY;
      const fromRaw = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';
      let senderName = 'Pluvia Academy';
      let senderEmail = fromRaw;
      const match = /^(.*)<([^>]+)>$/.exec(fromRaw);
      if (match) {
        senderName = match[1].trim().replace(/^"|"$/g, '') || senderName;
        senderEmail = match[2].trim();
      }

      const payload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlBody,
        textContent: textBody
      };

      const headers = { 'Content-Type': 'application/json', 'api-key': apiKey };
      console.log('Brevo API key present:', !!apiKey);
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const respText = await resp.text();
      if (!resp.ok) {
        console.error('Brevo send failed', resp.status, respText);
        lastEmailSendResult = { provider: 'brevo', ok: false, status: resp.status, body: respText };
      } else {
        console.log('Brevo send OK', resp.status, respText);
        lastEmailSendResult = { provider: 'brevo', ok: true, status: resp.status, body: respText };
        return true;
      }
    } catch (err) {
      console.error('Brevo send error:', err && err.message);
      if (err && err.stack) console.error(err.stack);
      lastEmailSendResult = { provider: 'brevo', ok: false, error: err && err.message };
    }
  }

  // Fallback Ethereal for development
  try {
    console.warn('Using Ethereal test account for email preview.');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || testAccount.user,
      to,
      subject: subject,
      text: textBody,
      html: htmlBody
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Email preview URL:', preview);
    console.log('Ethereal email sent:', info && info.messageId);
    lastEmailSendResult = { provider: 'ethereal', ok: true, info, preview };
    return true;
  } catch (err) {
    console.error('sendEmailOTP error:', err && err.message);
    lastEmailSendResult = { provider: 'ethereal', ok: false, error: err && err.message };
    return false;
  }
}

// helper: send SMS OTP via Twilio if available
async function sendSmsOTP(to, code) {
  if (!twilioClient) return false;
  try {
    const from = process.env.TWILIO_FROM;
    if (!from) return false;
    const msg = await twilioClient.messages.create({ body: `Pluvia Academy kode verifikasi: ${code}`, from, to });
    console.log('SMS sent:', msg && msg.sid);
    return true;
  } catch (err) {
    console.error('sendSmsOTP error:', err && err.message);
    return false;
  }
}

// helper: normalize phone numbers to E.164-like string
function normalizePhone(phone) {
  if (!phone) return null;
  let s = String(phone).trim();
  if (!s) return null;
  // if already looks like +country..., return as-is
  if (/^\+\d+$/.test(s.replace(/\s+/g, ''))) return s.replace(/\s+/g, '');
  // strip non-digits
  let digits = s.replace(/\D/g, '');
  if (!digits) return null;
  // common Indonesian handling: leading 0 -> +62
  if (digits.startsWith('0')) return '+62' + digits.slice(1);
  if (digits.startsWith('62')) return '+' + digits;
  // fallback: prefix +
  return '+' + digits;
}

// POST /api/auth/resend-otp
// body: { email, phone, full_name, username }
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, phone, full_name, username, password, passwordConfirm } = req.body;
    const normalizedPhone = normalizePhone(phone);

    // require all registration fields per desired flow
    if (!email || !password || !passwordConfirm || !username) {
      return res.status(400).json({ error: 'Lengkapi nama pengguna, email, password, dan konfirmasi password.' });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Password dan konfirmasi tidak cocok.' });
    }

    // find existing user by email (primary key for this flow)
    let user = null;
    if (email) {
      const { data: usersByEmail, error: findErr } = await supabase.from('users').select('*').eq('email', email).limit(1);
      if (findErr) return res.status(500).json({ error: findErr.message });
      if (usersByEmail && usersByEmail.length) user = usersByEmail[0];
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (user) {
      // update existing user with provided registration data (but keep is_verified=false)
      const updatePayload = {
        full_name: full_name || username || user.full_name,
        username: username || user.username,
        phone: normalizedPhone || user.phone,
        password_hash: passwordHash,
        is_verified: false
      };
      const { data: updated, error: updateErr } = await supabase.from('users').update(updatePayload).eq('id', user.id).select();
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      user = updated[0];
    } else {
      // insert new user record with provided data
      const insertPayload = {
        full_name: full_name || username,
        username: username,
        phone: normalizedPhone || null,
        email: email,
        password_hash: passwordHash,
        is_verified: false
      };
      const { data: inserted, error: insertErr } = await supabase.from('users').insert([insertPayload]).select();
      if (insertErr) return res.status(500).json({ error: insertErr.message });
      user = inserted[0];
    }

    // create OTP linked to this user
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const otpPayload = { user_id: user.id, target: 'email', code, expires_at: expiresAt };
    const { data: otpInserted, error: otpErr } = await supabase.from('otp_codes').insert([otpPayload]).select();
    if (otpErr) return res.status(500).json({ error: otpErr.message });

    // send via email (preferred for this flow)
    let sent = false;
    if (user.email) {
      sent = await sendEmailOTP(user.email, code);
    }
    if (!sent) {
      console.warn('No email provider configured — OTP logged to console.');
      console.log(`OTP for user ${user.id} (email): ${code}`);
    }

    return res.json({ message: 'OTP dikirim ke email Anda.', user_id: user.id, otp_sent: !!sent });
  } catch (err) {
    console.error('resend-otp error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register
// body: { full_name, username, phone, email, password }
router.post('/register', async (req, res) => {
  try {
    const { full_name, username, phone, email, password } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });

    const normalizedPhone = normalizePhone(phone);

    // check existing by email or phone
    const orClause = normalizedPhone ? `email.eq.${email},phone.eq.${normalizedPhone}` : `email.eq.${email}`;
    const { data: exists, error: existsErr } = await supabase
      .from('users')
      .select('id')
      .or(orClause)
      .limit(1);

    if (existsErr) return res.status(500).json({ error: existsErr.message });
    if (exists && exists.length) return res.status(409).json({ error: 'Email or phone already registered' });

    // hash password
    const hash = await bcrypt.hash(password, 10);

    // insert user (not verified yet)
    const payload = {
      full_name,
      username: username || null,
      phone: normalizedPhone || null,
      email,
      password_hash: hash
    };

    const { data: inserted, error: insertErr } = await supabase.from('users').insert([payload]).select();
    if (insertErr) return res.status(500).json({ error: insertErr.message });
    const user = inserted[0];

    // create OTP row
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const otpPayload = {
      user_id: user.id,
      target: normalizedPhone ? 'phone' : 'email',
      code,
      expires_at: expiresAt
    };

    const { data: otpInserted, error: otpErr } = await supabase.from('otp_codes').insert([otpPayload]).select();
    if (otpErr) {
      // cleanup: delete created user to avoid orphans (optional)
      await supabase.from('users').delete().eq('id', user.id);
      return res.status(500).json({ error: otpErr.message });
    }

    // send OTP via provider if configured, otherwise log for dev
    let sent = false;
    if (otpPayload.target === 'phone' && twilioClient) {
      sent = await sendSmsOTP(normalizedPhone, code);
    }
    if (!sent && user.email) {
      // try email if SMS not sent or not configured
      sent = await sendEmailOTP(user.email, code);
    }

    if (!sent) {
      // fallback: log OTP into server console (development)
      console.warn('No SMS/SMTP provider configured — OTP logged to console for development.');
      console.log(`OTP for user ${user.id} (${otpPayload.target}): ${code}`);
    }

    return res.status(201).json({ message: 'Registered. OTP created', user_id: user.id, otp_sent: !!sent });
  } catch (err) {
    console.error('Register error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/verify-otp
// body: { user_id, code }
router.post('/verify-otp', async (req, res) => {
  try {
    const { user_id, code } = req.body;
    if (!user_id || !code) return res.status(400).json({ error: 'Missing required fields' });

    // find latest unused OTP for user
    const { data: otps, error: otpErr } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', user_id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpErr) return res.status(500).json({ error: otpErr.message });
    if (!otps || !otps.length) return res.status(404).json({ error: 'OTP not found or expired' });

    const otp = otps[0];

    // check attempts limit
    const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

    if (otp.code === code) {
      // mark OTP used
      const { data: usedOtp, error: markErr } = await supabase.from('otp_codes').update({ used: true }).eq('id', otp.id).select();
      if (markErr) return res.status(500).json({ error: markErr.message });

      // set user verified
      const { data: updatedUser, error: userErr } = await supabase.from('users').update({ is_verified: true }).eq('id', user_id).select();
      if (userErr) return res.status(500).json({ error: userErr.message });

      return res.json({ message: 'Verified' });
    }

    // wrong code: increment attempts and possibly expire
    const { data: incData, error: incErr } = await supabase.from('otp_codes').update({ attempts: otp.attempts + 1 }).eq('id', otp.id).select();
    if (incErr) return res.status(500).json({ error: incErr.message });

    const newAttempts = (incData && incData[0] && incData[0].attempts) || (otp.attempts + 1);
    if (newAttempts >= MAX_ATTEMPTS) {
      // mark as used to block further attempts
      await supabase.from('otp_codes').update({ used: true }).eq('id', otp.id);
      return res.status(429).json({ error: 'Too many attempts. OTP invalidated.' });
    }

    return res.status(400).json({ error: 'Invalid code', attempts: newAttempts });
  } catch (err) {
    console.error('Verify OTP error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
// body: { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

    const { data: users, error: userErr } = await supabase.from('users').select('*').eq('email', email).limit(1);
    if (userErr) return res.status(500).json({ error: userErr.message });
    if (!users || !users.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // create refresh token and store hashed version
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + (process.env.SESSION_DAYS ? parseInt(process.env.SESSION_DAYS,10) : 30) * 24 * 60 * 60 * 1000).toISOString();

    const sessionPayload = {
      user_id: user.id,
      refresh_token_hash: tokenHash,
      user_agent: req.headers['user-agent'] || null,
      ip_address: req.ip || req.connection && req.connection.remoteAddress || null,
      expires_at: expiresAt
    };

    const { data: sessInserted, error: sessErr } = await supabase.from('auth_sessions').insert([sessionPayload]).select();
    if (sessErr) return res.status(500).json({ error: sessErr.message });

    // set cookie with plaintext token (server compares hashed copy)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === '1',
      sameSite: 'lax',
      maxAge: (process.env.SESSION_DAYS ? parseInt(process.env.SESSION_DAYS,10) : 30) * 24 * 60 * 60 * 1000,
      path: '/'
    };
    res.cookie('refresh_token', token, cookieOptions);

    return res.json({ message: 'Logged in', user_id: user.id });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/logout
router.get('/logout', async (req, res) => {
  try {
    // read token from cookie header if cookie-parser not used
    let token = req.headers['x-refresh-token'];
    if (!token) {
      const cookieHeader = req.headers && req.headers.cookie;
      if (cookieHeader) {
        const cookies = {};
        cookieHeader.split(';').forEach(pair => {
          const idx = pair.indexOf('=');
          if (idx === -1) return;
          const key = pair.slice(0, idx).trim();
          const val = pair.slice(idx + 1).trim();
          cookies[key] = decodeURIComponent(val);
        });
        token = cookies['refresh_token'];
      }
    }
    if (!token) {
      // clear cookie anyway
      res.setHeader('Set-Cookie', 'refresh_token=; Max-Age=0; Path=/; HttpOnly');
      return res.json({ message: 'Logged out' });
    }

    // find session by comparing hashes
    const { data: sessions, error: sessErr } = await supabase.from('auth_sessions').select('*');
    if (sessErr) {
      res.setHeader('Set-Cookie', 'refresh_token=; Max-Age=0; Path=/; HttpOnly');
      return res.json({ message: 'Logged out' });
    }

    // find matching session by comparing token to refresh_token_hash
    for (const s of sessions || []) {
      try {
        const ok = await bcrypt.compare(token, s.refresh_token_hash);
        if (ok) {
          await supabase.from('auth_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', s.id);
          break;
        }
      } catch (e) { /* ignore compare errors */ }
    }

    res.setHeader('Set-Cookie', 'refresh_token=; Max-Age=0; Path=/; HttpOnly');
    return res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error', err);
    res.setHeader('Set-Cookie', 'refresh_token=; Max-Age=0; Path=/; HttpOnly');
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/test-email
// Query: ?to=someone@example.com
router.get('/test-email', async (req, res) => {
  try {
    const to = req.query.to || process.env.SMTP_TEST_TO;
    if (!to) return res.status(400).json({ error: 'Missing `to` query parameter or SMTP_TEST_TO env var' });
    const code = generateOTP();
    const ok = await sendEmailOTP(to, code);
    const result = lastEmailSendResult || null;
    if (ok) return res.json({ message: 'Test email sent (if SMTP configured).', result });
    return res.status(500).json({ error: 'Failed to send test email. Check server logs.', result });
  } catch (err) {
    console.error('test-email error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
