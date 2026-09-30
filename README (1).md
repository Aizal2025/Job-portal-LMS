# Zee Job LMS

A full-stack job listing portal built for the major-project
requirement: **HTML, CSS, JavaScript, backend, database, full-stack,
user roles, listings/applications, deployment.**

Data is stored in local JSON files on the server (`data/`) instead of
the browser's localStorage — so it's shared across every browser/device
that opens the site, and survives a page refresh or a server restart.

## What it does

- **Find Job** — browse open roles, search by title/company/tag
- **Candidate accounts** — sign up, log in, apply to a role (one-click,
  duplicate applies are blocked)
- **Admin account** — log in, add/edit/delete listings, see everyone
  who applied and to which role
- Two user roles enforced by the backend: `candidate` and `admin`

## Default admin login

```
email:    admin@zee.com
password: admin123
```

This is seeded automatically the first time the server runs. Change
it (or add a real admin-management flow) before deploying anywhere
public.

## Project structure

```
zee-job-lms/
├── server.js            → Express server, REST API, auth, roles
├── package.json
├── data/
│   ├── jobs.json          → job listings ("database")
│   ├── users.json          → accounts (candidate + admin), auto-created
│   └── applications.json    → who applied to what, auto-created
└── public/
    ├── index.html         → Find Job page (search + apply)
    ├── about.html          → Why Zee page
    ├── admin.html           → Admin Desk (manage roles, view applications)
    ├── login.html            → Login / candidate sign-up
    └── script.js              → frontend, talks to the API via fetch()
```

## How to run

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

- Find Job: http://localhost:3000/index.html
- Login / Sign up: http://localhost:3000/login.html
- Admin Desk: http://localhost:3000/admin.html (log in as admin first)

## API reference

| Method | Endpoint                | Access             | Description                  |
|--------|--------------------------|--------------------|-------------------------------|
| POST   | /api/auth/signup         | Public             | Create a candidate account   |
| POST   | /api/auth/login          | Public             | Log in (candidate or admin)  |
| POST   | /api/auth/logout         | Logged in          | Log out                      |
| GET    | /api/auth/me             | Public             | Current session user, or null|
| GET    | /api/jobs                | Public             | List all jobs                |
| GET    | /api/jobs/:id            | Public             | Get one job                  |
| POST   | /api/jobs                | Admin only         | Create a job                 |
| PUT    | /api/jobs/:id            | Admin only         | Update a job                 |
| DELETE | /api/jobs/:id            | Admin only         | Delete a job (and its apps)  |
| POST   | /api/jobs/:id/apply      | Candidate only     | Apply to a job                |
| GET    | /api/applications        | Admin only         | List every application        |
| GET    | /api/applications/mine   | Candidate only     | List the caller's own applications |

## Deployment

This is a Node app (not a static site), so it needs a Node host —
e.g. Render, Railway, Replit, or a college server with Node
installed. Steps:

1. Push this folder to a Git repo (or upload it directly on the host).
2. Set the `SESSION_SECRET` environment variable to a random string
   (the code falls back to a demo secret if you don't).
3. Run `npm install` then `npm start` — most platforms detect the
   `start` script automatically.
4. Put the live URL in your project report.

