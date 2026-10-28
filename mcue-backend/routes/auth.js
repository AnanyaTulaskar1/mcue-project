const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();
const jwtSecret = () => process.env.JWT_SECRET || 'mcue_secret_key';
const findAdminByEmail = (email) => {
  const normalizedEmail = typeof email === 'string' ? email.trim() : '';
  if (!normalizedEmail) return null;
  const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return User.findOne({ email: new RegExp(`^${escapedEmail}$`, 'i'), role: 'admin' });
};

const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Please try again later.' }
});

const resetVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many verification attempts. Please try again later.' }
});

router.post('/signup-request-otp', (_req, res) => res.status(403).json({ message: 'Admin accounts are provisioned by the studio. Client records are managed inside the admin workspace.' }));
router.post('/signup-verify-otp', (_req, res) => res.status(403).json({ message: 'Admin accounts are provisioned by the studio.' }));

router.post('/password-reset-request', resetRequestLimiter, async (req, res) => {
  if (!req.body.email || typeof req.body.email !== 'string') {
    return res.status(400).json({ message: 'Email is required.' });
  }
  try {
    const user = await findAdminByEmail(req.body.email);
    if (user) {
      const otp = crypto.randomInt(100000, 1000000).toString();
      user.passwordResetOtp = crypto.createHash('sha256').update(otp).digest('hex');
      user.passwordResetOtpExpires = Date.now() + 10 * 60 * 1000;
      user.passwordResetOtpAttempts = 0;
      await user.save();

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await sendEmail({
          to: user.email,
          subject: 'MCue Studio - Admin password reset code',
          html: `<div style="font-family:Arial,sans-serif;padding:24px;color:#222"><h2>Admin password reset</h2><p>Use this code to reset your MCue Studio admin password:</p><p style="font-size:26px;font-weight:bold;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes. Ignore this message if you did not request it.</p></div>`
        });
      } else {
        console.log(`[ADMIN PASSWORD RESET OTP] Verification code for ${user.email}: ${otp}`);
      }
    }
    res.json({ message: 'If an admin account exists for that email, a reset code has been sent.' });
  } catch (error) {
    console.error('ADMIN PASSWORD RESET REQUEST ERROR:', error);
    res.status(500).json({ message: 'Unable to send a reset code right now.' });
  }
});

router.post('/password-reset-confirm', resetVerifyLimiter, async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Email, verification code, and new password are required.' });
  if (String(newPassword).length < 8) return res.status(400).json({ message: 'Use a password with at least 8 characters.' });
  try {
    const user = await findAdminByEmail(email);
    const hashedOtp = crypto.createHash('sha256').update(String(otp)).digest('hex');
    const valid = user && user.passwordResetOtp === hashedOtp && user.passwordResetOtpExpires > Date.now() && user.passwordResetOtpAttempts < 5;
    if (!valid) {
      if (user && user.passwordResetOtpExpires > Date.now() && user.passwordResetOtpAttempts < 5) {
        user.passwordResetOtpAttempts += 1;
        await user.save();
      }
      return res.status(400).json({ message: 'Invalid or expired password reset code.' });
    }

    user.password = newPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpires = undefined;
    user.passwordResetOtpAttempts = 0;
    await user.save();
    const token = jwt.sign({ id: user._id, role: user.role, email: user.email, name: user.name }, jwtSecret(), { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('ADMIN PASSWORD RESET CONFIRM ERROR:', error);
    res.status(500).json({ message: 'Password reset failed.' });
  }
});

router.post('/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
  try {
    const user = await findAdminByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password || ''))) {
      return res.status(401).json({ message: 'Invalid admin email or password.' });
    }
    const token = jwt.sign({ id: user._id, role: 'admin', email: user.email, name: user.name }, jwtSecret(), { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: 'admin' } });
  } catch (error) {
    console.error('ADMIN LOGIN ERROR:', error);
    res.status(500).json({ message: 'Admin login failed.' });
  }
});

module.exports = router;
