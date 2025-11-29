const { createTransport } = require('nodemailer');
const Mailgen = require('mailgen');
require('dotenv').config();

const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

/**
 * Konfigurasi transporter nodemailer untuk Gmail
 */
const createEmailTransporter = () => {
  return createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL,
      pass: PASSWORD,
    },
  });
};

/**
 * Inisialisasi Mailgen dengan tema dan branding Pluvia Academy
 */
const createMailGenerator = () => {
  return new Mailgen({
    theme: 'default',
    product: {
      name: 'Pluvia Academy',
      link: 'http://localhost:3000',
      logo: 'http://localhost:3000/img/logo-pngegg.png',
    },
  });
};

/**
 * Kirim email OTP kepada user menggunakan template Mailgen
 * @param {string} userEmail - Email tujuan
 * @param {string} userName - Nama user
 * @param {string} otpCode - Kode OTP 6 digit
 * @returns {Promise<Object>} Info pengiriman email
 */
const sendOTPEmail = async (userEmail, userName, otpCode) => {
  try {
    const transporter = createEmailTransporter();
    const mailGenerator = createMailGenerator();

    // Ekstrak nama dari email jika userName tidak tersedia
    const recipientName = userName || extractNameFromEmail(userEmail) || 'Pengguna';

    // Template email OTP menggunakan Mailgen
    const emailPayload = {
      body: {
        name: recipientName,
        intro: 'Terima kasih telah mendaftar di Pluvia Academy!',
        action: {
          instructions: 'Silakan gunakan kode OTP berikut untuk verifikasi akun Anda:',
          button: {
            color: '#22BC66',
            text: otpCode,
            // Link bisa diarahkan ke halaman register dengan auto-fill OTP (opsional)
            // link: `http://localhost:3000/register?otp=${otpCode}`
          },
        },
        outro: [
          'Kode OTP ini berlaku selama 10 menit.',
          'Jika Anda tidak meminta kode ini, abaikan email ini.',
        ],
        signature: 'Salam hangat',
      },
    };

    const emailHtml = mailGenerator.generate(emailPayload);
    const emailText = mailGenerator.generatePlaintext(emailPayload);

    const mailOptions = {
      from: `Pluvia Academy <${EMAIL}>`,
      to: userEmail,
      subject: 'Kode OTP Verifikasi Akun - Pluvia Academy',
      text: emailText,
      html: emailHtml,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

/**
 * Ekstrak nama dari bagian lokal alamat email
 * @param {string} email - Alamat email
 * @returns {string} Nama yang diekstrak
 */
function extractNameFromEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const local = email.split('@')[0];
  const cleaned = local.replace(/[._-]+/g, ' ').replace(/[0-9]/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

module.exports = {
  sendOTPEmail,
  createEmailTransporter,
  createMailGenerator,
};
