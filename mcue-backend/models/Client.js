const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 40 },
  company: { type: String, trim: true, maxlength: 120 },
  notes: { type: String, trim: true, maxlength: 2000 }
}, { timestamps: true });

clientSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.models.Client || mongoose.model('Client', clientSchema);
