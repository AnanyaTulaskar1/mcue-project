const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  recipient: { type: String, required: true },
  subject: { type: String, required: true },
  type: { type: String, enum: ['Invoice', 'Reminder', 'Confirmation', 'General'], default: 'General' },
  status: { type: String, enum: ['Sent', 'Failed'], required: true },
  error: { type: String, maxlength: 500 },
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);
