const express = require('express');
const mongoose = require('mongoose');
const Shoot = require('../models/Shoot');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const EmailLog = require('../models/EmailLog');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const sendEmail = require('../utils/sendEmail');
const paymentRequestTemplate = require('../utils/paymentRequestTemplate');

const router = express.Router();
router.use(auth, requireAdmin);

const statuses = ['Requested', 'Acknowledged', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];
const needsDateTime = (status) => ['Scheduled', 'In Progress', 'Completed'].includes(status);
const validDate = (value) => !value || !Number.isNaN(new Date(value).getTime());
const validTime = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const populateClient = (query) => query.populate('clientId', 'name email phone company');

const getShootData = (body) => {
  const data = {};
  ['clientId', 'title', 'date', 'time', 'location', 'status', 'description', 'notes'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = body[field];
  });
  ['title', 'location', 'description', 'notes'].forEach((field) => {
    if (typeof data[field] === 'string') data[field] = data[field].trim();
  });
  if (data.date === '') data.date = undefined;
  else if (data.date) data.date = new Date(data.date);
  if (data.time === '') data.time = undefined;
  return data;
};

const validateShoot = async (data, { requireClient = false } = {}) => {
  if (requireClient && !data.clientId) return 'Choose a client for this shoot.';
  if (Object.prototype.hasOwnProperty.call(data, 'clientId') && !mongoose.isValidObjectId(data.clientId)) return 'Choose a valid client.';
  if (Object.prototype.hasOwnProperty.call(data, 'clientId') && !(await Client.exists({ _id: data.clientId }))) return 'The selected client was not found.';
  if (Object.prototype.hasOwnProperty.call(data, 'title') && !String(data.title || '').trim()) return 'Enter a shoot title.';
  if (Object.prototype.hasOwnProperty.call(data, 'status') && !statuses.includes(data.status)) return 'Choose a valid shoot status.';
  if (!validDate(data.date) || !validTime(data.time)) return 'Enter a valid date and time.';
  return null;
};

router.post('/', async (req, res) => {
  try {
    const data = getShootData(req.body);
    const validationError = await validateShoot(data, { requireClient: true });
    if (validationError) return res.status(400).json({ message: validationError });
    data.status = data.status || 'Scheduled';
    if (data.status === 'Completed') return res.status(400).json({ message: 'Create the shoot first, then use Mark done to record its payment.' });
    if (needsDateTime(data.status) && (!data.date || !data.time)) {
      return res.status(400).json({ message: 'A scheduled shoot needs both a date and a time.' });
    }
    const createdShoot = await Shoot.create(data);
    const shoot = await populateClient(Shoot.findById(createdShoot._id));
    res.status(201).json(shoot);
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    console.error('CREATE SHOOT ERROR:', error);
    res.status(500).json({ message: 'Unable to create this shoot.' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const shoots = await populateClient(Shoot.find()).sort({ date: 1, createdAt: -1 });
    res.json(shoots);
  } catch (error) {
    console.error('GET SHOOTS ERROR:', error);
    res.status(500).json({ message: 'Unable to load shoot records.' });
  }
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid shoot ID.' });
  try {
    const shoot = await populateClient(Shoot.findById(req.params.id));
    if (!shoot) return res.status(404).json({ message: 'Shoot not found.' });
    res.json(shoot);
  } catch (error) {
    console.error('GET SHOOT ERROR:', error);
    res.status(500).json({ message: 'Unable to load this shoot.' });
  }
});

router.put('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid shoot ID.' });
  try {
    const shoot = await Shoot.findById(req.params.id);
    if (!shoot) return res.status(404).json({ message: 'Shoot not found.' });
    const data = getShootData(req.body);
    const validationError = await validateShoot(data);
    if (validationError) return res.status(400).json({ message: validationError });
    if (data.clientId && String(data.clientId) !== String(shoot.clientId) && await Payment.exists({ shootId: shoot._id })) {
      return res.status(409).json({ message: 'A shoot with a payment record cannot be assigned to a different client.' });
    }
    if (data.status === 'Completed' && shoot.status !== 'Completed') {
      return res.status(400).json({ message: 'Use Mark done to complete the shoot and email its payment request.' });
    }
    const nextStatus = data.status || shoot.status;
    const nextDate = Object.prototype.hasOwnProperty.call(data, 'date') ? data.date : shoot.date;
    const nextTime = Object.prototype.hasOwnProperty.call(data, 'time') ? data.time : shoot.time;
    if (needsDateTime(nextStatus) && (!nextDate || !nextTime)) {
      return res.status(400).json({ message: 'A scheduled shoot needs both a date and a time.' });
    }
    Object.assign(shoot, data);
    await shoot.save();
    res.json(await populateClient(Shoot.findById(shoot._id)));
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    console.error('UPDATE SHOOT ERROR:', error);
    res.status(500).json({ message: 'Unable to update this shoot.' });
  }
});

router.post('/:id/complete', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid shoot ID.' });

  const amount = Number(req.body.amount);
  const currency = String(req.body.currency || 'INR').toUpperCase();
  const allowedCurrencies = ['INR', 'USD', 'GBP', 'EUR'];
  const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : undefined;
  const paymentUrl = typeof req.body.paymentUrl === 'string' ? req.body.paymentUrl.trim() : '';
  const paymentInstructions = typeof req.body.paymentInstructions === 'string' ? req.body.paymentInstructions.trim() : '';

  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Enter a payment amount greater than zero.' });
  if (Math.round(amount * 100) / 100 < 0.01) return res.status(400).json({ message: 'The payment amount must be at least 0.01.' });
  if (!allowedCurrencies.includes(currency)) return res.status(400).json({ message: 'Choose INR, USD, GBP, or EUR.' });
  if (req.body.dueDate && Number.isNaN(dueDate.getTime())) return res.status(400).json({ message: 'Enter a valid payment due date.' });
  if (paymentUrl) {
    try {
      const parsedUrl = new URL(paymentUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol');
    } catch {
      return res.status(400).json({ message: 'Enter a valid http or https payment link.' });
    }
  }
  if (paymentInstructions.length > 2000) return res.status(400).json({ message: 'Payment instructions must be 2,000 characters or fewer.' });

  let payment;
  try {
    const shoot = await Shoot.findById(req.params.id).populate('clientId', 'name email');
    if (!shoot) return res.status(404).json({ message: 'Shoot not found.' });
    if (shoot.status === 'Cancelled') return res.status(400).json({ message: 'A cancelled shoot cannot be marked done.' });
    if (!shoot.clientId?.email) return res.status(400).json({ message: 'Add an email address to this client before sending a payment request.' });

    const existingPayment = await Payment.findOne({ shootId: shoot._id });
    if (existingPayment) {
      return res.status(409).json({ message: 'A payment record already exists for this shoot.', payment: existingPayment });
    }

    payment = await Payment.create({
      shootId: shoot._id,
      clientId: shoot.clientId._id,
      clientName: shoot.clientId.name,
      clientEmail: shoot.clientId.email,
      shootTitle: shoot.title,
      amount: Math.round(amount * 100) / 100,
      currency,
      dueDate,
      paymentUrl,
      paymentInstructions
    });

    shoot.status = 'Completed';
    await shoot.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A payment record already exists for this shoot.' });
    if (payment?._id) await Payment.findByIdAndDelete(payment._id).catch(() => {});
    console.error('COMPLETE SHOOT ERROR:', error);
    return res.status(500).json({ message: 'Unable to complete this shoot and record its payment.' });
  }

  const subject = `Payment request for ${payment.shootTitle} — MCue Studio`;
  let emailStatus = 'Sent';
  let emailError = '';
  try {
    await sendEmail({
      to: payment.clientEmail,
      subject,
      html: paymentRequestTemplate(payment)
    });
  } catch (error) {
    emailStatus = 'Failed';
    emailError = error.message || 'Email delivery failed';
  }

  payment.emailStatus = emailStatus;
  payment.emailSentAt = emailStatus === 'Sent' ? new Date() : undefined;
  payment.emailLastError = emailError || undefined;
  await payment.save();
  try {
    await EmailLog.create({
      clientId: payment.clientId,
      paymentId: payment._id,
      recipient: payment.clientEmail,
      subject,
      type: 'Invoice',
      status: emailStatus,
      error: emailError || undefined
    });
  } catch (logError) {
    console.error('PAYMENT EMAIL LOG ERROR:', logError.message);
  }

  res.status(201).json({
    message: emailStatus === 'Sent' ? 'Shoot completed and payment request emailed.' : 'Shoot completed and payment saved, but the email could not be sent.',
    shoot: await populateClient(Shoot.findById(req.params.id)),
    payment,
    paymentEmailSent: emailStatus === 'Sent'
  });
});

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid shoot ID.' });
  try {
    const payment = await Payment.findOne({ shootId: req.params.id });
    if (payment) return res.status(409).json({ message: 'This shoot has a payment record. Keep it for reporting.' });
    const shoot = await Shoot.findByIdAndDelete(req.params.id);
    if (!shoot) return res.status(404).json({ message: 'Shoot not found.' });
    res.json({ message: 'Shoot removed successfully.' });
  } catch (error) {
    console.error('DELETE SHOOT ERROR:', error);
    res.status(500).json({ message: 'Unable to remove this shoot.' });
  }
});

module.exports = router;
