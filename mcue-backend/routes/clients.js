const express = require('express');
const mongoose = require('mongoose');
const Client = require('../models/Client');
const Shoot = require('../models/Shoot');
const Payment = require('../models/Payment');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();
router.use(auth, requireAdmin);

const clientFields = ['name', 'email', 'phone', 'company', 'notes'];
const normalizeClient = (body) => {
  const result = {};
  clientFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
    }
  });
  if (result.email) result.email = result.email.toLowerCase();
  return result;
};

router.post('/', async (req, res) => {
  try {
    const data = normalizeClient(req.body);
    if (!data.name || !data.email) {
      return res.status(400).json({ message: 'Client name and email are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return res.status(400).json({ message: 'Enter a valid client email address.' });
    }

    const client = await Client.create(data);
    res.status(201).json(client);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A client with this email already exists.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    console.error('CREATE CLIENT ERROR:', error);
    res.status(500).json({ message: 'Unable to save this client.' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    console.error('GET CLIENTS ERROR:', error);
    res.status(500).json({ message: 'Unable to load client records.' });
  }
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid client ID.' });
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found.' });
    res.json(client);
  } catch (error) {
    console.error('GET CLIENT ERROR:', error);
    res.status(500).json({ message: 'Unable to load this client.' });
  }
});

router.put('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid client ID.' });
  try {
    const data = normalizeClient(req.body);
    if (Object.keys(data).length === 0) return res.status(400).json({ message: 'No client details were provided.' });
    if (data.name === '' || data.email === '') return res.status(400).json({ message: 'Client name and email cannot be empty.' });
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return res.status(400).json({ message: 'Enter a valid client email address.' });
    }

    const client = await Client.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client not found.' });
    res.json(client);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A client with this email already exists.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    console.error('UPDATE CLIENT ERROR:', error);
    res.status(500).json({ message: 'Unable to update this client.' });
  }
});

router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid client ID.' });
  try {
    const linkedRecord = await Promise.all([
      Shoot.exists({ clientId: req.params.id }),
      Payment.exists({ clientId: req.params.id })
    ]);
    if (linkedRecord.some(Boolean)) {
      return res.status(409).json({ message: 'This client has shoot or payment history. Keep the record and edit it instead.' });
    }
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found.' });
    res.json({ message: 'Client removed successfully.' });
  } catch (error) {
    console.error('DELETE CLIENT ERROR:', error);
    res.status(500).json({ message: 'Unable to remove this client.' });
  }
});

module.exports = router;
