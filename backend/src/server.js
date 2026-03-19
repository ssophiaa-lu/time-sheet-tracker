const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const pool = require("./db");
const { requireAuth, requireRole } = require("./middleware/auth");
const { getWeekStart, toISODate } = require("./utils/week");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = new Set([process.env.FRONTEND_URL || "http://localhost:5173"]);
      const isLocalDevOrigin =
        typeof origin === "string" &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      // Allow non-browser tools (curl/postman) without an Origin header.
      if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 },
  }),
);

app.use(async (req, _res, next) => {
  if (req.session?.user) {
    req.user = req.session.user;
    return next();
  }

  const headerUserId = Number(req.get("x-demo-user-id"));
  if (!Number.isInteger(headerUserId) || headerUserId <= 0) {
    return next();
  }

  try {
    const userResult = await pool.query(
      "SELECT id, username, role FROM users WHERE id = $1",
      [headerUserId],
    );
    if (userResult.rows[0]) {
      req.user = userResult.rows[0];
    }
  } catch (error) {
    console.error("Failed to load user from header:", error);
  }

  return next();
});

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const userResult = await pool.query(
    "SELECT id, username, password, role FROM users WHERE username = $1",
    [username],
  );
  const user = userResult.rows[0];

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  req.user = req.session.user;

  return res.json({ user: req.user });
});

app.post("/api/auth/logout", (req, res) => {
  if (!req.session) {
    res.clearCookie("connect.sid");
    return res.json({ message: "Logged out successfully." });
  }

  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/time-entries", requireAuth, async (req, res) => {
  const { weekStart } = req.query;
  const values = [req.user.id];
  let filter = "";

  if (weekStart) {
    values.push(weekStart);
    filter = "AND t.week_start = $2";
  }

  const result = await pool.query(
    `SELECT e.id, e.timesheet_id, e.work_date, e.project_name, e.hours, e.notes,
            t.week_start, t.status AS timesheet_status
     FROM time_entries e
     JOIN timesheets t ON t.id = e.timesheet_id
     WHERE t.user_id = $1 ${filter}
     ORDER BY e.work_date DESC, e.id DESC`,
    values,
  );

  res.json({ entries: result.rows });
});

app.post("/api/time-entries", requireAuth, async (req, res) => {
  const { work_date, project_name, hours, notes } = req.body;

  if (!work_date || !project_name || !hours) {
    return res.status(400).json({ message: "work_date, project_name, and hours are required." });
  }

  if (Number(hours) <= 0 || Number(hours) > 24) {
    return res.status(400).json({ message: "Hours must be between 0 and 24." });
  }

  const weekStart = toISODate(getWeekStart(work_date));

  let timesheet = await pool.query(
    "SELECT id, status FROM timesheets WHERE user_id = $1 AND week_start = $2",
    [req.user.id, weekStart],
  );

  if (!timesheet.rows[0]) {
    timesheet = await pool.query(
      `INSERT INTO timesheets (user_id, week_start, status)
       VALUES ($1, $2, 'draft')
       RETURNING id, status`,
      [req.user.id, weekStart],
    );
  }

  if (["approved", "submitted"].includes(timesheet.rows[0].status)) {
    return res.status(400).json({ message: "Cannot modify entries for submitted/approved timesheets." });
  }

  const entryResult = await pool.query(
    `INSERT INTO time_entries (timesheet_id, work_date, project_name, hours, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [timesheet.rows[0].id, work_date, project_name, hours, notes || null],
  );

  return res.status(201).json({ entry: entryResult.rows[0] });
});

app.put("/api/time-entries/:id", requireAuth, async (req, res) => {
  const entryId = req.params.id;
  const { work_date, project_name, hours, notes } = req.body;

  const entry = await pool.query(
    `SELECT e.id, t.user_id, t.status
     FROM time_entries e
     JOIN timesheets t ON t.id = e.timesheet_id
     WHERE e.id = $1`,
    [entryId],
  );

  if (!entry.rows[0]) {
    return res.status(404).json({ message: "Entry not found." });
  }

  if (entry.rows[0].user_id !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (["approved", "submitted"].includes(entry.rows[0].status)) {
    return res.status(400).json({ message: "Cannot edit submitted/approved entries." });
  }

  if (Number(hours) <= 0 || Number(hours) > 24) {
    return res.status(400).json({ message: "Hours must be between 0 and 24." });
  }

  const updated = await pool.query(
    `UPDATE time_entries
     SET work_date = $1, project_name = $2, hours = $3, notes = $4
     WHERE id = $5
     RETURNING *`,
    [work_date, project_name, hours, notes || null, entryId],
  );

  return res.json({ entry: updated.rows[0] });
});

app.delete("/api/time-entries/:id", requireAuth, async (req, res) => {
  const entryId = req.params.id;
  const entry = await pool.query(
    `SELECT e.id, t.user_id, t.status
     FROM time_entries e
     JOIN timesheets t ON t.id = e.timesheet_id
     WHERE e.id = $1`,
    [entryId],
  );

  if (!entry.rows[0]) {
    return res.status(404).json({ message: "Entry not found." });
  }
  if (entry.rows[0].user_id !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (["approved", "submitted"].includes(entry.rows[0].status)) {
    return res.status(400).json({ message: "Cannot delete submitted/approved entries." });
  }

  await pool.query("DELETE FROM time_entries WHERE id = $1", [entryId]);
  return res.status(204).send();
});

app.get("/api/timesheets/week/:weekStart", requireAuth, async (req, res) => {
  const { weekStart } = req.params;
  const result = await pool.query(
    `SELECT id, user_id, week_start, status, manager_comment, submitted_at
     FROM timesheets
     WHERE user_id = $1 AND week_start = $2`,
    [req.user.id, weekStart],
  );
  res.json({ timesheet: result.rows[0] || null });
});

app.post("/api/timesheets/week", requireAuth, async (req, res) => {
  const inputWeek = req.body.week_start || toISODate(getWeekStart(new Date()));
  let timesheet = await pool.query(
    `SELECT id, user_id, week_start, status, manager_comment, submitted_at
     FROM timesheets
     WHERE user_id = $1 AND week_start = $2`,
    [req.user.id, inputWeek],
  );

  if (!timesheet.rows[0]) {
    timesheet = await pool.query(
      `INSERT INTO timesheets (user_id, week_start, status)
       VALUES ($1, $2, 'draft')
       RETURNING id, user_id, week_start, status, manager_comment, submitted_at`,
      [req.user.id, inputWeek],
    );
  }

  res.json({ timesheet: timesheet.rows[0] });
});

app.post("/api/timesheets/:id/submit", requireAuth, async (req, res) => {
  const timesheetId = req.params.id;
  const result = await pool.query(
    `SELECT id, user_id, status
     FROM timesheets
     WHERE id = $1`,
    [timesheetId],
  );
  const timesheet = result.rows[0];

  if (!timesheet) {
    return res.status(404).json({ message: "Timesheet not found." });
  }
  if (timesheet.user_id !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (timesheet.status === "submitted") {
    return res.status(400).json({ message: "Timesheet already submitted." });
  }
  if (timesheet.status === "approved") {
    return res.status(400).json({ message: "Timesheet is already approved." });
  }

  const entryCountResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM time_entries WHERE timesheet_id = $1",
    [timesheetId],
  );
  if (entryCountResult.rows[0].count < 1) {
    return res.status(400).json({ message: "Cannot submit an empty timesheet." });
  }

  const updated = await pool.query(
    `UPDATE timesheets
     SET status = 'submitted', submitted_at = NOW(), manager_comment = NULL
     WHERE id = $1
     RETURNING id, user_id, week_start, status, manager_comment, submitted_at`,
    [timesheetId],
  );

  return res.json({ timesheet: updated.rows[0] });
});

app.get("/api/timesheets", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT t.id, t.week_start, t.status, t.manager_comment, t.submitted_at,
            COALESCE(SUM(e.hours), 0)::numeric(6,2) AS total_hours
     FROM timesheets t
     LEFT JOIN time_entries e ON e.timesheet_id = t.id
     WHERE t.user_id = $1
     GROUP BY t.id
     ORDER BY t.week_start DESC`,
    [req.user.id],
  );
  res.json({ timesheets: result.rows });
});

app.get("/api/manager/timesheets", requireRole("manager"), async (req, res) => {
  const status = req.query.status || "submitted";
  const result = await pool.query(
    `SELECT t.id, t.week_start, t.status, t.submitted_at, u.username AS employee_name,
            COALESCE(SUM(e.hours), 0)::numeric(6,2) AS total_hours
     FROM timesheets t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN time_entries e ON e.timesheet_id = t.id
     WHERE t.status = $1
     GROUP BY t.id, u.username
     ORDER BY t.submitted_at DESC NULLS LAST, t.week_start DESC`,
    [status],
  );
  res.json({ timesheets: result.rows });
});

app.get("/api/manager/timesheets/:id", requireRole("manager"), async (req, res) => {
  const timesheetId = req.params.id;
  const timesheetResult = await pool.query(
    `SELECT t.id, t.week_start, t.status, t.manager_comment, t.submitted_at,
            u.username AS employee_name, u.id AS employee_id
     FROM timesheets t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = $1`,
    [timesheetId],
  );

  if (!timesheetResult.rows[0]) {
    return res.status(404).json({ message: "Timesheet not found." });
  }

  const entriesResult = await pool.query(
    `SELECT id, work_date, project_name, hours, notes
     FROM time_entries
     WHERE timesheet_id = $1
     ORDER BY work_date ASC, id ASC`,
    [timesheetId],
  );

  const totalHours = entriesResult.rows.reduce((sum, entry) => sum + Number(entry.hours), 0);
  return res.json({
    timesheet: {
      ...timesheetResult.rows[0],
      total_hours: totalHours.toFixed(2),
      entries: entriesResult.rows,
    },
  });
});

app.post("/api/manager/timesheets/:id/approve", requireRole("manager"), async (req, res) => {
  const timesheetId = req.params.id;

  const updated = await pool.query(
    `UPDATE timesheets
     SET status = 'approved', manager_comment = NULL
     WHERE id = $1 AND status = 'submitted'
     RETURNING id, user_id, week_start, status, manager_comment, submitted_at`,
    [timesheetId],
  );

  if (!updated.rows[0]) {
    return res.status(400).json({ message: "Only submitted timesheets can be approved." });
  }

  return res.json({ timesheet: updated.rows[0] });
});

app.post("/api/manager/timesheets/:id/reject", requireRole("manager"), async (req, res) => {
  const timesheetId = req.params.id;
  const { manager_comment } = req.body;

  const updated = await pool.query(
    `UPDATE timesheets
     SET status = 'rejected', manager_comment = $2
     WHERE id = $1 AND status = 'submitted'
     RETURNING id, user_id, week_start, status, manager_comment, submitted_at`,
    [timesheetId, manager_comment || null],
  );

  if (!updated.rows[0]) {
    return res.status(400).json({ message: "Only submitted timesheets can be rejected." });
  }

  return res.json({ timesheet: updated.rows[0] });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
