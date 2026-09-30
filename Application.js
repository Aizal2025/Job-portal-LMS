const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  jobId: { type: Number, required: true },
  jobTitle: { type: String, required: true },
  company: { type: String, required: true },
  candidateId: { type: Number, required: true },
  candidateName: { type: String, required: true },
  candidateEmail: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = mongoose.model('Application', applicationSchema);
