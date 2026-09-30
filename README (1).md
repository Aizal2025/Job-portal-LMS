# Zee Job LMS

A full-stack job listing portal built for the major-project
requirement: **HTML, CSS, JavaScript, backend, database, full-stack,
user roles, listings/applications, deployment.**

Data is stored in **MongoDB** (a cloud database) instead of the
browser's localStorage or local files — so it's shared across every
browser/device that opens the site, and stays safe even when the
server restarts or gets redeployed.

## What it does

- **Find Job** — browse open roles
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

This is seeded automatically the first time the server connects to
your database. Change it before sharing the project publicly.

## Project structure

```
zee-job-lms/
├── server.js             → Express server, REST API, auth, roles
├── package.json
├── .env.example            → copy this to .env and fill in your own values
├── models/
│   ├── Job.js                → Mongoose schema for job listings
│   ├── User.js                 → Mongoose schema for accounts
│   └── Application.js            → Mongoose schema for applications
├── data/
│   └── jobs.json                 → old starter data, kept only as a backup/reference
└── public/
    ├── index.html         → Find Job page
    ├── about.html          → Why Zee page
    ├── admin.html           → Admin Desk (manage roles, view applications)
    ├── login.html            → Login / candidate sign-up
    └── script.js              → frontend, talks to the API via fetch()
```

## Step 1 — Create a free MongoDB Atlas database

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up (free).
2. Create a new **free (M0) cluster** — any cloud provider/region is fine.
3. Under **Database Access**, create a database user with a username and password (save these).
4. Under **Network Access**, click **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`). This is needed so Render can connect.
5. Click **Connect** on your cluster → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/
   ```
6. Replace `<username>` and `<password>` with the database user you made, and add a database name at the end, e.g.:
   ```
   mongodb+srv://ziya:mypassword@cluster0.xxxxx.mongodb.net/zee-job-lms
   ```

## Step 2 — Run it locally first (test before deploying)

1. Copy `.env.example` to a new file named `.env`.
2. Paste your real connection string as `MONGODB_URI` in `.env`.
3. Then:
   ```bash
   npm install
   npm start
   ```
4. You should see in the terminal:
   ```
   Connected to MongoDB
   Seeded default admin login -> admin@zee.com / admin123
   Zee Job LMS server running at http://localhost:3000
   ```
5. Open `http://localhost:3000/login.html` and test signup/login/apply — exactly like before, but now check your MongoDB Atlas dashboard (**Browse Collections**) and you'll see the actual data sitting there.

## Step 3 — Deploy on Render with the database connected

1. Push this project to GitHub (`.env` will NOT be pushed — it's in `.gitignore`, which is correct, since it has your password).
2. On Render, open your Web Service → **Environment** tab.
3. Add two environment variables:
   - `MONGODB_URI` → your real connection string from Step 1
   - `SESSION_SECRET` → any random text
4. Save, and Render will redeploy automatically. Check the **Logs** tab for the same "Connected to MongoDB" message.

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

## Notes

- Login sessions are still stored in server memory, so logging in resets if the server restarts. The job/user/application data does **not** reset anymore — that's now safely in MongoDB.
- `data/jobs.json` is no longer read by the app; it's kept only as a backup of the original starter data.
