/* 
     1. Serves the frontend (index.html, about.html, admin.html,
        login.html, script.js)
     2. REST API for job listings (public read, admin-only write)
     3. Auth API with two user roles: "candidate" and "admin",
        using signed session cookies + hashed passwords
     4. Applications API — candidates apply to listings, admins
        see who applied
     5. All data is stored in MongoDB */

require('dotenv').config();

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const mongoose = require('mongoose');

const Job = require('./models/Job');
const User = require('./models/User');
const Application = require('./models/Application');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zee-job-lms';

app.use(express.json());
app.use(session({
   
  // Demo secret for the local/college-grading environment.
  // Replace with a real secret from an environment variable before
  // deploying this anywhere public.

   
  secret: process.env.SESSION_SECRET || 'zee-job-lms-demo-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hours
}));
app.use(express.static(path.join(__dirname, 'public')));

/* ----------------  default admin on first run ---------------- */

async function ensureSeedData() {
  const jobCount = await Job.countDocuments();
  if (jobCount === 0) {
    await Job.insertMany([
      { id: 1, title: 'Senior Product Designer', company: 'Zee Studio', location: 'New York, NY', type: 'Full-time', tags: ['Design'], salary: '$90k – $120k', posted: '2 days ago' },
      { id: 2, title: 'Frontend Engineer', company: 'Northstar Labs', location: 'Remote — Americas', type: 'Full-time', tags: ['Engineering', 'Remote'], salary: '$100k – $130k', posted: '3 days ago' },
      { id: 3, title: 'Growth Marketing Manager', company: 'Lumen Health', location: 'Austin, TX', type: 'Full-time', tags: ['Marketing'], salary: '$80k – $105k', posted: '1 week ago' },
      { id: 4, title: 'Operations Coordinator', company: 'Civic House', location: 'Chicago, IL', type: 'Full-time', tags: ['Operations'], salary: '$55k – $70k', posted: '1 week ago' }
    ]);
    console.log('Seeded 4 starter job listings into MongoDB');
  }

  const adminCount = await User.countDocuments({ role: 'admin' });
  if (adminCount === 0) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    await User.create({ id: 1, name: 'Admin', email: 'admin@zee.com', passwordHash, role: 'admin' });
    console.log('Seeded default admin login -> admin@zee.com / admin123 (change this before a real deployment)');
  }
}

/* ---------------- auth helpers ---------------- */

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Please log in first' });
    if (req.session.user.role !== role) return res.status(403).json({ error: 'Not allowed for your account type' });
    next();
  };
}

function validateJobPayload(body) {
  const { title, company, location, salary } = body || {};
  if (!title || !company || !location || !salary) {
    return 'title, company, location and salary are required';
  }
  return null;
}

// strip MongoDB's internal _id before sending a document to the frontend
function clean(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  delete obj._id;
  return obj;
}

/*AUTH API */

// Sign up — always creates a candidate (job-seeker) account.
// Admin access uses the seeded admin account below, not public signup.
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const newUser = await User.create({
    id: Date.now(),
    name,
    email: email.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'candidate'
  });

  req.session.user = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
  res.status(201).json(req.session.user);
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json(req.session.user);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

app.get('/api/auth/me', (req, res) => {
  res.json(req.session.user || null);
});

/*JOBS API — public read, admin-only write */

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ id: 1 });
    res.json(jobs.map(clean));
  } catch (err) {
    res.status(500).json({ error: 'Could not read jobs' });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  const job = await Job.findOne({ id: Number(req.params.id) });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(clean(job));
});

app.post('/api/jobs', requireRole('admin'), async (req, res) => {
  const errorMsg = validateJobPayload(req.body);
  if (errorMsg) return res.status(400).json({ error: errorMsg });

  const newJob = await Job.create({
    id: Date.now(),
    title: req.body.title,
    company: req.body.company,
    location: req.body.location,
    type: req.body.type || 'Full-time',
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    salary: req.body.salary,
    posted: 'Just now'
  });
  res.status(201).json(clean(newJob));
});

app.put('/api/jobs/:id', requireRole('admin'), async (req, res) => {
  const job = await Job.findOne({ id: Number(req.params.id) });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const errorMsg = validateJobPayload(req.body);
  if (errorMsg) return res.status(400).json({ error: errorMsg });

  job.title = req.body.title;
  job.company = req.body.company;
  job.location = req.body.location;
  job.type = req.body.type || job.type;
  job.tags = Array.isArray(req.body.tags) ? req.body.tags : job.tags;
  job.salary = req.body.salary;

  await job.save();
  res.json(clean(job));
});

app.delete('/api/jobs/:id', requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await Job.findOneAndDelete({ id });
  if (!deleted) return res.status(404).json({ error: 'Job not found' });

  // keep applications list clean if a listing is removed
  await Application.deleteMany({ jobId: id });

  res.status(204).end();
});

/* APPLICATIONS API — candidate-only apply, admin-only review*/

app.post('/api/jobs/:id/apply', requireRole('candidate'), async (req, res) => {
  const jobId = Number(req.params.id);
  const job = await Job.findOne({ id: jobId });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const already = await Application.findOne({ jobId, candidateId: req.session.user.id });
  if (already) return res.status(409).json({ error: 'You already applied to this role' });

  const newApplication = await Application.create({
    id: Date.now(),
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    candidateId: req.session.user.id,
    candidateName: req.session.user.name,
    candidateEmail: req.session.user.email,
    appliedAt: new Date()
  });

  res.status(201).json(clean(newApplication));
});

app.get('/api/applications', requireRole('admin'), async (req, res) => {
  const applications = await Application.find().sort({ appliedAt: -1 });
  res.json(applications.map(clean));
});

app.get('/api/applications/mine', requireRole('candidate'), async (req, res) => {
  const applications = await Application.find({ candidateId: req.session.user.id }).sort({ appliedAt: -1 });
  res.json(applications.map(clean));
});

/* ---------------- boot ---------------- */

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await ensureSeedData();
    app.listen(PORT, () => {
      console.log(`Zee Job LMS server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;
