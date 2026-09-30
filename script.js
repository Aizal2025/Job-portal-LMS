/* ==========================================================
   Zee Job LMS — frontend script.js
   Talks to the backend REST API (server.js): jobs, auth (roles:
   candidate/admin), and applications. Data lives in local JSON
   files on the server, not the browser's localStorage.
   Used by: index.html, about.html, admin.html, login.html
   ========================================================== */

const API_BASE = '/api/jobs';

/* ---------------- shared helpers ---------------- */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

async function getJobs() {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error('Failed to load jobs from server');
  return res.json();
}

async function createJob(payload) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create job');
  }
  return res.json();
}

async function updateJob(id, payload) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update job');
  }
  return res.json();
}

async function removeJob(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error('Failed to delete job');
}

/* ---------------- auth helpers ---------------- */

async function getCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

async function renderAuthArea() {
  const el = document.getElementById('authArea');
  if (!el) return; // page has no auth slot in its navbar

  const user = await getCurrentUser();
  if (user) {
    el.innerHTML = `
      <span style="color:#aaa; margin-right:0.8em; font-size:0.9em;">Hi, ${escapeHtml(user.name)} (${escapeHtml(user.role)})</span>
      <button id="logoutBtn" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:#ededed; border-radius:6px; padding:0.4em 0.9em; cursor:pointer; font-weight:600;">Logout</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = 'index.html';
    });
  } else {
    el.innerHTML = `<a href="login.html" style="color:#2ecc71; font-weight:600; text-decoration:none;">Login</a>`;
  }
}

/* ==========================================================
   FIND JOB PAGE (index.html)
   ========================================================== */

function renderJobs(list, appliedIds) {
  appliedIds = appliedIds || new Set();
  const grid = document.getElementById('jobGrid');
  if (!grid) return;
  const countEl = document.querySelector('.listing-header .count');

  if (list.length === 0) {
    grid.innerHTML = '<p style="color:#888;">No roles available right now.</p>';
  } else {
    grid.innerHTML = list.map(job => `
      <div class="job-card">
        <div class="job-card-top">
          <div class="job-icon">🏢</div>
          <div class="job-posted">${escapeHtml(job.posted)}</div>
        </div>
        <div class="job-title-row">
          <h3>${escapeHtml(job.title)}</h3>
          <a href="#">→</a>
        </div>
        <div class="job-company">${escapeHtml(job.company)}</div>
        <div class="job-meta">
          <span>📍 ${escapeHtml(job.location)}</span>
          <span>🕒 ${escapeHtml(job.type)}</span>
        </div>
        <div class="job-tags">
          ${job.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="job-footer-row">
          <span class="job-salary">${escapeHtml(job.salary)}</span>
          ${appliedIds.has(job.id)
            ? `<button class="job-view applied" disabled>Applied ✓</button>`
            : `<button class="job-view apply-btn" data-job-id="${job.id}">Apply →</button>`}
        </div>
      </div>
    `).join('');
  }

  if (countEl) {
    countEl.textContent = `${list.length} role${list.length !== 1 ? 's' : ''} available`;
  }
}

async function loadAndRenderJobs() {
  const grid = document.getElementById('jobGrid');
  if (!grid) return;

  try {
    const [jobs, user] = await Promise.all([getJobs(), getCurrentUser()]);

    let appliedIds = new Set();
    if (user && user.role === 'candidate') {
      try {
        const mine = await fetch('/api/applications/mine').then(r => (r.ok ? r.json() : []));
        appliedIds = new Set(mine.map(a => a.jobId));
      } catch (e) { /* not critical — cards just won't show "Applied" state */ }
    }

    renderJobs(jobs, appliedIds);
  } catch (err) {
    grid.innerHTML = '<p style="color:#e66;">Could not load jobs. Is the server running?</p>';
  }
}

async function handleApplyClick(e) {
  const btn = e.target.closest('.apply-btn');
  if (!btn) return;

  const jobId = Number(btn.dataset.jobId);
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  if (user.role !== 'candidate') {
    alert('Only candidate accounts can apply to roles. Please log in with a candidate account.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Applying…';

  try {
    const res = await fetch(`/api/jobs/${jobId}/apply`, { method: 'POST' });
    if (res.status === 409) {
      btn.textContent = 'Applied ✓';
      btn.classList.add('applied');
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Could not submit your application right now.');
      btn.disabled = false;
      btn.textContent = 'Apply →';
      return;
    }
    btn.textContent = 'Applied ✓';
    btn.classList.add('applied');
  } catch (err) {
    alert('Could not reach the server. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Apply →';
  }
}

function initFindJobPage() {
  const grid = document.getElementById('jobGrid');
  if (!grid) return; // not on this page

  loadAndRenderJobs();
  grid.addEventListener('click', handleApplyClick);
}

/* ==========================================================
   WHY ZEE PAGE (about.html)
   ========================================================== */

async function initAboutPage() {
  const liveCount = document.getElementById('liveCount');
  if (!liveCount) return; // not on this page

  try {
    const jobs = await getJobs();
    liveCount.textContent = `🟢 ${jobs.length} role${jobs.length !== 1 ? 's' : ''} currently open on Zee`;
    liveCount.style.opacity = 1;
    liveCount.style.transition = 'opacity 0.6s ease';
  } catch (err) {
    // fail quietly on this decorative element
  }
}

/* ==========================================================
   LOGIN / SIGNUP PAGE (login.html)
   ========================================================== */

function initLoginPage() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return; // not on this page

  const signupForm = document.getElementById('signupForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const msg = document.getElementById('authMsg');

  function showMsg(text, isError) {
    msg.textContent = text;
    msg.className = 'auth-msg ' + (isError ? 'error' : 'success');
  }

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    msg.textContent = '';
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.style.display = 'block';
    loginForm.style.display = 'none';
    msg.textContent = '';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error || 'Login failed', true); return; }
      window.location.href = data.role === 'admin' ? 'admin.html' : 'index.html';
    } catch (err) {
      showMsg('Could not reach the server.', true);
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('suName').value.trim();
    const email = document.getElementById('suEmail').value.trim();
    const password = document.getElementById('suPassword').value;
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error || 'Sign up failed', true); return; }
      window.location.href = 'index.html';
    } catch (err) {
      showMsg('Could not reach the server.', true);
    }
  });
}

/* ==========================================================
   ADMIN DESK PAGE (admin.html)
   ========================================================== */

async function renderRoles() {
  const list = document.getElementById('roleList');
  const statOpen = document.getElementById('statOpenRoles');
  if (!list) return;

  let jobs;
  try {
    jobs = await getJobs();
  } catch (err) {
    list.innerHTML = '<p style="color:#e66; padding:1.5em 0;">Could not load roles. Is the server running?</p>';
    return;
  }

  if (statOpen) statOpen.textContent = jobs.length;

  if (jobs.length === 0) {
    list.innerHTML = '<p style="color:#888; padding:1.5em 0;">No roles yet. Click "Add a role" to create one.</p>';
    return;
  }

  list.innerHTML = jobs.map(job => `
    <div class="role-row">
      <div class="role-icon">🏢</div>
      <div class="role-info">
        <div class="title">${escapeHtml(job.title)}</div>
        <div class="meta">${escapeHtml(job.company)} · ${escapeHtml(job.location)}</div>
      </div>
      <div class="role-actions">
        <button title="Edit" onclick="editRole(${job.id})">✎</button>
        <button title="Delete" onclick="deleteRole(${job.id})">🗑</button>
      </div>
    </div>
  `).join('');
}

async function renderApplications() {
  const container = document.getElementById('applicationsList');
  const statApps = document.getElementById('statApplications');
  if (!container) return;

  try {
    const res = await fetch('/api/applications');
    if (!res.ok) throw new Error('not authorized or server error');
    const apps = await res.json();

    if (statApps) statApps.textContent = apps.length;

    if (apps.length === 0) {
      container.innerHTML = `
        <div class="empty-box">
          <span style="font-size:1.6em;">📄</span>
          <span>No applications yet.</span>
        </div>`;
      return;
    }

    container.innerHTML = apps.map(a => `
      <div class="role-row">
        <div class="role-icon">🧑</div>
        <div class="role-info">
          <div class="title">${escapeHtml(a.candidateName)} → ${escapeHtml(a.jobTitle)}</div>
          <div class="meta">${escapeHtml(a.candidateEmail)} · ${escapeHtml(a.company)} · ${new Date(a.appliedAt).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p style="color:#e66;">Could not load applications.</p>';
  }
}

function openModal(job) {
  document.getElementById('modalTitle').textContent = job ? 'Edit role' : 'Add a role';
  document.getElementById('roleId').value = job ? job.id : '';
  document.getElementById('fTitle').value = job ? job.title : '';
  document.getElementById('fCompany').value = job ? job.company : '';
  document.getElementById('fLocation').value = job ? job.location : '';
  document.getElementById('fType').value = job ? job.type : 'Full-time';
  document.getElementById('fTags').value = job ? job.tags.join(', ') : '';
  document.getElementById('fSalary').value = job ? job.salary : '';
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('fTitle').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

async function editRole(id) {
  try {
    const jobs = await getJobs();
    const job = jobs.find(j => j.id === id);
    if (job) openModal(job);
  } catch (err) {
    alert('Could not load this role right now.');
  }
}

async function deleteRole(id) {
  if (!confirm('Delete this role?')) return;
  try {
    await removeJob(id);
    await renderRoles();
  } catch (err) {
    alert('Could not delete this role right now.');
  }
}

async function initAdminPage() {
  const addBtn = document.getElementById('addRoleBtn');
  if (!addBtn) return; // not on this page

  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    window.location.href = 'login.html';
    return;
  }

  renderRoles();
  renderApplications();

  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal(null);
  });

  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  const form = document.getElementById('roleForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const titleVal = document.getElementById('fTitle').value.trim();
      const companyVal = document.getElementById('fCompany').value.trim();
      const locationVal = document.getElementById('fLocation').value.trim();
      const salaryVal = document.getElementById('fSalary').value.trim();

      if (!titleVal || !companyVal || !locationVal || !salaryVal) {
        alert('Please fill in role title, company, location and salary.');
        return;
      }

      const idField = document.getElementById('roleId').value;
      const tags = document.getElementById('fTags').value
        .split(',').map(t => t.trim()).filter(Boolean);

      const payload = {
        title: titleVal,
        company: companyVal,
        location: locationVal,
        type: document.getElementById('fType').value,
        tags: tags,
        salary: salaryVal
      };

      try {
        if (idField) {
          await updateJob(idField, payload);
        } else {
          await createJob(payload);
        }
        await renderRoles();
        closeModal();
      } catch (err) {
        alert(err.message || 'Could not save this role right now.');
      }
    });
  }
}

/* ==========================================================
   BOOT — each init() quietly no-ops on pages that don't need it
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  renderAuthArea();
  initFindJobPage();
  initAboutPage();
  initLoginPage();
  initAdminPage();
});