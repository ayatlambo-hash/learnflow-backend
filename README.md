# LearnFlow Backend

## Setup

### 1. Create `.env` file
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/learnflow
JWT_SECRET=your_secret_key_min_32_chars
PORT=5000
CLIENT_URL=http://localhost:3000
```

### 2. Create PostgreSQL database
```bash
createdb learnflow
psql learnflow < schema.sql
```

### 3. Install dependencies
```bash
npm install
```

### 4. Start server
```bash
npm run dev   # development with nodemon
npm start     # production
```

## Deployment (Railway + PostgreSQL)

### 1. Create Railway project and PostgreSQL
- Go to https://railway.app and sign up
- Click **New Project** → **Add PostgreSQL**
- Railway will create a PostgreSQL database and set `DATABASE_URL` automatically
- Add these environment variables in Railway dashboard:
  - `JWT_SECRET` = any long random string (min 32 chars)
  - `INSTRUCTOR_CODE` = `teacher2026`
  - `PORT` = `5000` (optional, Railway sets its own port too)

### 2. Deploy backend from GitHub
- In your Railway project, click **Add Service** → **GitHub Repo**
- Select `ayatlambo-hash/learnflow-backend`
- Railway will use:
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
- Click **Deploy**
- After deployment, copy your Railway URL (e.g. `https://learnflow-backend.up.railway.app`)

### 3. Update frontend API URL
- In your frontend repo, edit `.env.production`
- Set `REACT_APP_API_URL=https://your-railway-url.up.railway.app/api`
- Commit and push → Netlify will redeploy automatically

## Deployment (Render + Neon — alternative)
If you prefer Render:
- Create a free PostgreSQL database on https://neon.tech
- Deploy the backend on https://render.com as a Node web service
- Set `DATABASE_URL`, `JWT_SECRET`, and `INSTRUCTOR_CODE=teacher2026`
- Update frontend `.env.production` to your Render URL + `/api`

## API Endpoints
- `POST /api/auth/register` — register user
- `POST /api/auth/login` — login
- `GET  /api/auth/me` — get current user
- `GET  /api/modules` — list modules (with student progress)
- `POST /api/modules` — create module (instructor)
- `GET  /api/modules/:id/lessons` — list lessons
- `POST /api/modules/:id/lessons` — add lesson (instructor)
- `POST /api/modules/progress/:lessonId` — mark lesson complete
- `POST /api/upload/:lessonId` — submit assignment file
- `GET  /api/upload/:lessonId/submissions` — list submissions (instructor)
- `POST /api/upload/grade/:submissionId` — grade submission (instructor)
- `GET  /api/students` — list all students (instructor)
- `GET  /api/students/:id/progress` — student detail (instructor)
- `GET  /api/students/submissions/all` — all submissions (instructor)
- `GET  /api/resources` — list resources
- `POST /api/resources` — upload file resource (instructor)
- `POST /api/resources/link` — add link resource (instructor)
- `GET  /api/chat` — get messages
- `POST /api/chat` — send message
- `GET  /api/forum` — list posts
- `POST /api/forum` — create post
- `GET  /api/announcements` — list announcements
- `POST /api/announcements` — create announcement (instructor)
