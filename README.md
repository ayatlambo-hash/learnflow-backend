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

## Deployment (Railway)
1. Create new Railway project
2. Add PostgreSQL plugin → copy DATABASE_URL
3. Set environment variables in Railway dashboard
4. Deploy from GitHub

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
