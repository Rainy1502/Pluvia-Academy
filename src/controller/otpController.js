const supabase = require('../supabaseClient').default;
const { sendOTPEmail } = require('../utils/emailService');
require('dotenv').config();

const OTP_MINUTES = parseInt(process.env.OTP_MINUTES) || 10;

/**
 * Generate kode OTP 6 digit random
 * @returns {string} Kode OTP
 */
const generateOTPCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * POST /api/otp/send
 * Mengirim kode OTP ke email user
 * Body: { email, username }
 */
const sendOTP = async (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email wajib diisi' });
    }

    // Cek apakah email sudah terdaftar
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }

    // Generate OTP code
    const otpCode = generateOTPCode();
    const expiresAt = new Date(Date.now() + OTP_MINUTES * 60 * 1000);

    // Simpan OTP ke database (temporary storage tanpa user_id karena user belum terdaftar)
    // Kita akan simpan dengan target = email untuk identifikasi
    const { error: otpError } = await supabase
      .from('otp_codes')
      .insert({
        user_id: null, // user belum ada
        target: email, // gunakan email sebagai identifier
        code: otpCode,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        used: false,
      });

    if (otpError) {
      console.error('Error saving OTP:', otpError);
      return res.status(500).json({ error: 'Gagal menyimpan kode OTP' });
    }

    // Kirim OTP via email menggunakan Mailgen
    try {
      await sendOTPEmail(email, username, otpCode);
      return res.status(200).json({
        success: true,
        message: 'Kode OTP telah dikirim ke email Anda',
        expiresIn: `${OTP_MINUTES} menit`,
      });
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      return res.status(500).json({ error: 'Gagal mengirim email OTP' });
    }
  } catch (error) {
    console.error('Error in sendOTP:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
};

/**
 * POST /api/otp/verify
 * Verifikasi kode OTP yang dimasukkan user
 * Body: { email, code }
 */
const verifyOTP = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email dan kode OTP wajib diisi' });
    }

    // Ambil OTP yang valid (belum expired, belum digunakan)
    const { data: otpRecords, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('target', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching OTP:', fetchError);
      return res.status(500).json({ error: 'Gagal memverifikasi OTP' });
    }

    if (!otpRecords || otpRecords.length === 0) {
      return res.status(400).json({ error: 'Kode OTP tidak valid atau sudah kadaluarsa' });
    }

    const otpRecord = otpRecords[0];

    // Increment attempts
    const newAttempts = otpRecord.attempts + 1;

    // Update OTP as used
    const { error: updateError } = await supabase
      .from('otp_codes')
      .update({
        used: true,
        attempts: newAttempts,
      })
      .eq('id', otpRecord.id);

    if (updateError) {
      console.error('Error updating OTP:', updateError);
      return res.status(500).json({ error: 'Gagal memverifikasi OTP' });
    }

    return res.status(200).json({
      success: true,
      message: 'Kode OTP valid',
      verified: true,
    });
  } catch (error) {
    console.error('Error in verifyOTP:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  generateOTPCode,
};
