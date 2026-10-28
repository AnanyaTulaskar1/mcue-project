const mongoose = require('mongoose');

const shootSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  date: { type: Date },
  time: { type: String },
  location: { type: String, trim: true, maxlength: 180 },
  status: {
    type: String,
    enum: ['Requested', 'Acknowledged', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  description: { type: String, trim: true, maxlength: 2000 },
  notes: { type: String, trim: true, maxlength: 2000 }
}, { timestamps: true });

module.exports = mongoose.models.Shoot || mongoose.model('Shoot', shootSchema);
