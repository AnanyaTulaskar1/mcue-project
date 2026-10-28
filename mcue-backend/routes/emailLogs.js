const express = require('express');
const EmailLog = require('../models/EmailLog');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();
router.use(auth, requireAdmin);

router.get('/', async (_req, res) => {
  try {
    const logs = await EmailLog.find()
      .populate('clientId', 'name email')
      .populate('paymentId', 'shootTitle amount currency status')
      .sort({ sentAt: -1 })
      .limit(500);
    res.json(logs);
  } catch (error) {
    console.error('GET EMAIL LOGS ERROR:', error);
    res.status(500).json({ message: 'Unable to load email history.' });
  }
});

module.exports = router;
