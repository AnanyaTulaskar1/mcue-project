const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const EmailLog = require('../models/EmailLog');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const sendEmail = require('../utils/sendEmail');
const paymentRequestTemplate = require('../utils/paymentRequestTemplate');

const router = express.Router();
router.use(auth, requireAdmin);

router.get('/', async (_req, res) => {
  try {
    const payments = await Payment.find()
      .populate('clientId', 'name email phone')
      .populate({
        path: 'shootId',
        select: 'title date time location status clientId',
        populate: { path: 'clientId', select: 'name email' }
      })
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    console.error('GET PAYMENTS ERROR:', error);
    res.status(500).json({ message: 'Unable to load payment records.' });
  }
});

router.put('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid payment ID.' });
  if (!['Paid', 'Unpaid'].includes(req.body.status)) return res.status(400).json({ message: 'Choose Paid or Unpaid.' });
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment record not found.' });
    payment.status = req.body.status;
    payment.paidAt = req.body.status === 'Paid' ? (payment.paidAt || new Date()) : undefined;
    await payment.save();
    res.json(payment);
  } catch (error) {
    console.error('UPDATE PAYMENT ERROR:', error);
    res.status(500).json({ message: 'Unable to update this payment.' });
  }
});

router.post('/:id/send', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid payment ID.' });
  try {
    const payment = await Payment.findById(req.params.id).populate({
      path: 'shootId',
      populate: { path: 'clientId', select: 'name email' }
    });
    if (!payment) return res.status(404).json({ message: 'Payment record not found.' });
    if (payment.status === 'Paid') return res.status(409).json({ message: 'This payment is already marked as paid.' });

    const currentClient = payment.clientId
      ? await Client.findById(payment.clientId).select('name email')
      : payment.shootId?.clientId || null;
    const recipient = currentClient?.email || payment.clientEmail;
    if (!recipient) return res.status(400).json({ message: 'Add an email address to this client before retrying the payment request.' });
    if (currentClient) {
      payment.clientId = currentClient._id;
      payment.clientName = currentClient.name;
      payment.clientEmail = recipient;
    }
    payment.shootTitle = payment.shootTitle || payment.shootId?.title || 'Photography session';
    payment.currency = payment.currency || 'INR';

    const subject = `Payment request for ${payment.shootTitle} — MCue Studio`;
    let status = 'Sent';
    let emailError = '';
    try {
      await sendEmail({ to: recipient, subject, html: paymentRequestTemplate(payment) });
    } catch (error) {
      status = 'Failed';
      emailError = error.message || 'Email delivery failed';
    }

    payment.emailStatus = status;
    payment.emailSentAt = status === 'Sent' ? new Date() : undefined;
    payment.emailLastError = emailError || undefined;
    await payment.save();
    try {
      await EmailLog.create({
        clientId: payment.clientId,
        paymentId: payment._id,
        recipient,
        subject,
      type: 'Reminder',
        status,
        error: emailError || undefined
      });
    } catch (logError) {
      console.error('PAYMENT EMAIL LOG ERROR:', logError.message);
    }

    res.json({
      message: status === 'Sent' ? 'Payment request emailed to the client.' : 'The payment request could not be emailed. Check the email settings and try again.',
      payment,
      paymentEmailSent: status === 'Sent'
    });
  } catch (error) {
    console.error('SEND PAYMENT EMAIL ERROR:', error);
    res.status(500).json({ message: 'Unable to send the payment request.' });
  }
});

module.exports = router;
