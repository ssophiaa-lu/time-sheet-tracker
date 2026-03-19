# Workforce Time Tracking System

I built a full-stack web app for employees to log hours and managers to approve timesheets. This project simulates real time tracking and approval used in enterprise systems. It focuses on enforcing data integrity, role-based access control, and state transitions between employees and managers.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- API: REST + session-based auth

## Key Features

- Role-based dashboards (employee vs manager)
- Time entry CRUD with validation
- Weekly timesheet grouping and aggregation
- Timesheet submission and approval workflow
- Status tracking: draft, submitted, approved, rejected
- Data integrity constraints (one timesheet per user/week)

## Demo Accounts

All users use password: `password123`

- `employee1` (employee)
- `employee2` (employee)
- `manager1` (manager)

## Prerequisites

Make sure you have the following installed:

- Node.js (v18+ recommended)
- npm
- PostgreSQL
- Git

Verify installation:

node -v  
npm -v  
psql --version
## Setup Instructions

### 1) Create database

```bash
createdb workforce_time_tracking
```

### 2) Configure backend environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` if your local PostgreSQL credentials differ.

### 3) Create schema and seed data

```bash
psql -d workforce_time_tracking -f sql/schema.sql
psql -d workforce_time_tracking -f sql/seed.sql
```

### 4) Start backend

```bash
cd backend
npm install
npm run dev
```

Backend runs at `http://localhost:4000`.

### 5) Start frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## API Endpoints

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Employee

- `GET /api/time-entries?weekStart=YYYY-MM-DD`
- `POST /api/time-entries`
- `PUT /api/time-entries/:id`
- `DELETE /api/time-entries/:id`
- `POST /api/timesheets/week` (create or fetch weekly timesheet)
- `GET /api/timesheets/week/:weekStart`
- `POST /api/timesheets/:id/submit`
- `GET /api/timesheets`

### Manager

- `GET /api/manager/timesheets?status=submitted`
- `GET /api/manager/timesheets/:id`
- `POST /api/manager/timesheets/:id/approve`
- `POST /api/manager/timesheets/:id/reject`

## Example API Requests

### Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"employee1","password":"password123"}'
```

### Add time entry

```bash
curl -X POST http://localhost:4000/api/time-entries \
  -H "Content-Type: application/json" \
  -d '{"work_date":"2026-03-19","project_name":"Client A","hours":8,"notes":"Feature work"}'
```

### Submit timesheet

```bash
curl -X POST http://localhost:4000/api/timesheets/1/submit
```

### Approve timesheet (manager)

```bash
curl -X POST http://localhost:4000/api/manager/timesheets/1/approve
```

### Reject timesheet (manager)

```bash
curl -X POST http://localhost:4000/api/manager/timesheets/1/reject \
  -H "Content-Type: application/json" \
  -d '{"manager_comment":"Please add missing Friday hours."}'
```

## Rules Implemented

- Weekly grouping uses Monday as `week_start`.
- One timesheet per employee per week.
- Multiple entries allowed per week.
- Weekly totals shown in both dashboards.
- Employees can edit/delete only while timesheet is not submitted or approved.
- Managers can approve/reject submitted sheets and add rejection comment.
