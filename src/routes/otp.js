const express = require('express');
const { sendOTP, verifyOTP } = require('../controller/otpController');

const router = express.Router();

// POST /api/otp/send - Kirim kode OTP ke email
router.post('/send', sendOTP);

// POST /api/otp/verify - Verifikasi kode OTP
router.post('/verify', verifyOTP);

module.exports = router;
