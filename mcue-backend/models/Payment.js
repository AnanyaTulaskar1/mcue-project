const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  shootId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shoot',
    required: true
  },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  clientName: { type: String, default: '' },
  clientEmail: { type: String, default: '' },
  shootTitle: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['INR', 'USD', 'GBP', 'EUR'], default: 'INR' },
  status: { type: String, enum: ['Unpaid', 'Paid', 'Pending'], default: 'Unpaid' },
  dueDate: { type: Date },
  paidAt: { type: Date },
  paymentUrl: { type: String, trim: true, maxlength: 1000 },
  paymentInstructions: { type: String, trim: true, maxlength: 2000 },
  emailStatus: { type: String, enum: ['Not sent', 'Sent', 'Failed'], default: 'Not sent' },
  emailSentAt: { type: Date },
  emailLastError: { type: String, maxlength: 500 }
}, { timestamps: true });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
