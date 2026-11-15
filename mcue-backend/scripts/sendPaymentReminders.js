require('dotenv').config();
const mongoose = require('mongoose');
const { sendDuePaymentReminders } = require('../utils/paymentReminders');

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is required to send payment reminders.');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await sendDuePaymentReminders();
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error('PAYMENT REMINDER RUN ERROR:', error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
