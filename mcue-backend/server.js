require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const Client = require('./models/Client');
const Shoot = require('./models/Shoot');

const app = express();

// 1. Precise CORS Configuration (Must be declared BEFORE routes)
const localOrigins = [
  'https://localhost:5173',
  'http://localhost:5173',
  'https://127.0.0.1:5173',
  'http://127.0.0.1:5173'
];
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const allowedOrigins = new Set([...localOrigins, ...configuredOrigins]);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('This website is not allowed to access the API.'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 2. Body Parser Middleware
app.use(express.json());

// 3. API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/shoots', require('./routes/shoots'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/email-logs', require('./routes/emailLogs'));

app.get('/', (req, res) => {
  res.send('MCue API is running.');
});

// 4. Database Connection & Environment Validation
if (!process.env.MONGO_URI) {
  console.error('ERROR: MONGO_URI is missing in .env!');
  process.exit(1);
}

async function migrateLegacyClientContacts() {
  const legacyClients = await User.find({ role: 'client' }).select('name email phone createdAt').lean();
  let migrated = 0;
  for (const user of legacyClients) {
    if (!user.email) continue;
    const email = user.email.trim().toLowerCase();
    let client = await Client.findOne({ email });
    if (!client) {
      try {
        client = await Client.create({
          _id: user._id,
          name: user.name,
          email,
          phone: user.phone,
          createdAt: user.createdAt
        });
        migrated += 1;
      } catch (error) {
        if (error.code !== 11000) throw error;
        client = await Client.findOne({ email });
      }
    }
    if (client && String(client._id) !== String(user._id)) {
      await Shoot.updateMany({ clientId: user._id }, { $set: { clientId: client._id } });
    }
  }
  if (migrated) console.log(`Migrated ${migrated} legacy client contact(s).`);
}

async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('Admin account bootstrap skipped; set ADMIN_EMAIL and ADMIN_PASSWORD to provision an admin.');
    return;
  }

  const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let admin = await User.findOne({ email: new RegExp(`^${escapedEmail}$`, 'i') });
  if (!admin) {
    await User.create({
      name: process.env.ADMIN_NAME?.trim() || 'Studio Admin',
      email,
      password,
      role: 'admin'
    });
    console.log(`Admin account provisioned for ${email}.`);
    return;
  }
  if (admin.role !== 'admin') {
    admin.role = 'admin';
    admin.password = password;
    await admin.save();
    console.log(`Admin account enabled for ${email}.`);
  }
}

// 5. HTTP is used on cloud hosts where TLS ends at the platform proxy.
const PORT = process.env.PORT || 5000;
const useHttps = process.env.HTTPS_ENABLED === 'true';

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected successfully');
    await migrateLegacyClientContacts();
    await bootstrapAdmin();
    if (useHttps) {
      const sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'cert.key')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.crt'))
      };
      https.createServer(sslOptions, app).listen(PORT, '0.0.0.0', () => {
        console.log(`HTTPS Server running on https://localhost:${PORT}`);
      });
    } else {
      http.createServer(app).listen(PORT, '0.0.0.0', () => {
        console.log(`HTTP Server listening on port ${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error('MongoDB startup error:', err);
    process.exit(1);
  });
