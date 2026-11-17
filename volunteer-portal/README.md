# Volunteer Portal

An isolated React/Vite frontend and Express API for inquiry management. The application uses in-memory mock data; restarting the backend resets changes and sessions.

## Requirements

- Node.js 20 or newer
- npm

## Start the backend

```bash
cd backend
npm install
npm run dev
```

The API listens on `http://localhost:3001` by default. Override the port with `PORT` and the allowed frontend origin with `FRONTEND_ORIGIN`.

## Start the frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). Set `VITE_API_URL` in `.env` to the backend base URL if it differs from `http://localhost:3001`.

## Mock accounts

| Role | Email | Password |
|---|---|---|
| Volunteer Reviewer (Volunteer and Sponsor categories) | `alex.volunteer@example.com` | `Volunteer123!` |
| Volunteer Reviewer (Speaker category) | `sam.volunteer@example.com` | `Volunteer123!` |
| Admin | `admin@example.com` | `Admin123!` |
| Member (no inquiry access) | `member@example.com` | `Member123!` |

This mock authentication is for local development only. Tokens are opaque in-memory session identifiers, not production credentials or a production authentication design.

## API

- `POST /auth/signin`
- `GET /users` (authenticated)
- `GET /inquiry-categories` (authenticated)
- `POST /inquiry-categories` (admin; create a category)
- `PUT /users/:id/inquiry-categories` (admin; replace a volunteer reviewer's category assignments)
- `GET /inquiries` (authenticated)
- `PATCH /inquiries/:id` (authenticated; update status or assigned owner)
- `POST /inquiries/:id/follow-ups` (authenticated; append a timestamped note attributed to the signed-in user)
All endpoints except sign-in require `Authorization: Bearer <token>`. Inquiry access is role-scoped: admins can access every category, volunteer reviewers can access only their assigned categories, and members have no inquiry access. Admins can create inquiry categories and assign or remove multiple categories for each volunteer reviewer; multiple reviewers may share a category. In the dashboard, only admins see the inquiry assignment control; reviewers can see the assigned manager but cannot edit that field. Reviewers can add follow-up activity only to inquiries assigned to them; admins can add activity to any inquiry. Follow-up activity records include the server timestamp and signed-in user, are shown newest first, and remain in memory for the lifetime of the backend process.