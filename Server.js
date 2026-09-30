/* ==========================================================
   Zee Job LMS — backend server
   Full-stack pieces this file provides (per the major-project
   requirements: HTML/CSS/JS, backend, database, full-stack,
   user roles, listings/applications, deployment):

     1. Serves the frontend (index.html, about.html, admin.html,
        login.html, script.js)
     2. REST API for job listings (public read, admin-only write)
     3. Auth API with two user roles: "candidate" and "admin",
        using signed session cookies + hashed passwords
     4. Applications API — candidates apply to listings, admins
        see who applied
     5. All data persisted to local JSON files under data/
        (acts as the project's database)
   ========================================================== */

const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

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

/* ---------------- generic local JSON "database" helpers ---------------- */

async function readJSON(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(file, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    throw err;
  }
}
async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

const readJobs = () => readJSON(JOBS_FILE, []);
const writeJobs = (jobs) => writeJSON(JOBS_FILE, jobs);
const readUsers = () => readJSON(USERS_FILE, []);
const writeUsers = (users) => writeJSON(USERS_FILE, users);
const readApplications = () => readJSON(APPLICATIONS_FILE, []);
const writeApplications = (apps) => writeJSON(APPLICATIONS_FILE, apps);

/* ---------------- seed a default admin account on first run ---------------- */

async function ensureSeedAdmin() {
  const users = await readUsers();
  if (users.length === 0) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    users.push({ id: 1, name: 'Admin', email: 'admin@zee.com', passwordHash, role: 'admin' });
    await writeUsers(users);
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

/* ==========================================================
   AUTH API
   ========================================================== */

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
  const users = await readUsers();
  if (users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const newUser = {
    id: Date.now(),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'candidate'
  };
  users.push(newUser);
  await writeUsers(users);

  req.session.user = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
  res.status(201).json(req.session.user);
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const users = await readUsers();
  const user = users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
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

/* ==========================================================
   JOBS API (listings) — public read, admin-only write
   ========================================================== */

app.get('/api/jobs', async (req, res) => {
  try {
    res.json(await readJobs());
  } catch (err) {
    res.status(500).json({ error: 'Could not read jobs' });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  const jobs = await readJobs();
  const job = jobs.find(j => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.post('/api/jobs', requireRole('admin'), async (req, res) => {
  const errorMsg = validateJobPayload(req.body);
  if (errorMsg) return res.status(400).json({ error: errorMsg });

  const jobs = await readJobs();
  const newJob = {
    id: Date.now(),
    title: req.body.title,
    company: req.body.company,
    location: req.body.location,
    type: req.body.type || 'Full-time',
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    salary: req.body.salary,
    posted: 'Just now'
  };
  jobs.push(newJob);
  await writeJobs(jobs);
  res.status(201).json(newJob);
});

app.put('/api/jobs/:id', requireRole('admin'), async (req, res) => {
  const jobs = await readJobs();
  const job = jobs.find(j => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const errorMsg = validateJobPayload(req.body);
  if (errorMsg) return res.status(400).json({ error: errorMsg });

  job.title = req.body.title;
  job.company = req.body.company;
  job.location = req.body.location;
  job.type = req.body.type || job.type;
  job.tags = Array.isArray(req.body.tags) ? req.body.tags : job.tags;
  job.salary = req.body.salary;

  await writeJobs(jobs);
  res.json(job);
});

app.delete('/api/jobs/:id', requireRole('admin'), async (req, res) => {
  const jobs = await readJobs();
  const id = Number(req.params.id);
  const remaining = jobs.filter(j => j.id !== id);
  if (remaining.length === jobs.length) {
    return res.status(404).json({ error: 'Job not found' });
  }
  await writeJobs(remaining);

  // keep applications list clean if a listing is removed
  const applications = await readApplications();
  await writeApplications(applications.filter(a => a.jobId !== id));

  res.status(204).end();
});

/* ==========================================================
   APPLICATIONS API — candidate-only apply, admin-only review
   ========================================================== */

app.post('/api/jobs/:id/apply', requireRole('candidate'), async (req, res) => {
  const jobId = Number(req.params.id);
  const jobs = await readJobs();
  const job = jobs.find(j => j.id === jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const applications = await readApplications();
  const already = applications.find(a => a.jobId === jobId && a.candidateId === req.session.user.id);
  if (already) return res.status(409).json({ error: 'You already applied to this role' });

  const newApplication = {
    id: Date.now(),
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    candidateId: req.session.user.id,
    candidateName: req.session.user.name,
    candidateEmail: req.session.user.email,
    appliedAt: new Date().toISOString()
  };
  applications.push(newApplication);
  await writeApplications(applications);
  res.status(201).json(newApplication);
});

app.get('/api/applications', requireRole('admin'), async (req, res) => {
  const applications = await readApplications();
  applications.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
  res.json(applications);
});

app.get('/api/applications/mine', requireRole('candidate'), async (req, res) => {
  const applications = await readApplications();
  res.json(applications.filter(a => a.candidateId === req.session.user.id));
});

/* ---------------- boot ---------------- */

ensureSeedAdmin()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Zee Job LMS server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

module.exports = app;