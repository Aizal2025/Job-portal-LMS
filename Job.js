const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String, required: true },
  type: { type: String, default: 'Full-time' },
  tags: { type: [String], default: [] },
  salary: { type: String, required: true },
  posted: { type: String, default: 'Just now' }
}, { versionKey: false });

module.exports = mongoose.model('Job', jobSchema);
