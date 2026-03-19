import { useEffect, useMemo, useState } from "react";
import api from "../api";
import StatusBadge from "../components/StatusBadge";
import { formatDate, getWeekStart, toISODate } from "../utils/date";

function EmployeeDashboard({ user, onLogout }) {
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [timesheet, setTimesheet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [entryForm, setEntryForm] = useState({ project_name: "", hours: "", notes: "" });
  const [editRowId, setEditRowId] = useState(null);
  const [editForm, setEditForm] = useState({ work_date: "", project_name: "", hours: "", notes: "" });

  const weekStart = useMemo(() => toISODate(getWeekStart(selectedDate)), [selectedDate]);
  const weeklyTotal = useMemo(() => entries.reduce((sum, item) => sum + Number(item.hours), 0), [entries]);

  useEffect(() => {
    loadEmployeeData();
  }, [weekStart]);

  useEffect(() => {
    if (!timesheet) return;
    if (!["submitted", "approved"].includes(timesheet.status)) return;

    const nextWeek = new Date(weekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekIso = toISODate(nextWeek);

    if (nextWeekIso !== weekStart) {
      setSelectedDate(nextWeekIso);
      setMessage("Switched to next editable week so you can add entries.");
    }
  }, [timesheet, weekStart]);

  async function loadEmployeeData() {
    setError("");
    setMessage("");
    try {
      const [timesheetResult, entriesResult, listResult] = await Promise.all([
        api.post("/timesheets/week", { week_start: weekStart }),
        api.get("/time-entries", { params: { weekStart } }),
        api.get("/timesheets"),
      ]);
      setTimesheet(timesheetResult.data.timesheet);
      setEntries(entriesResult.data.entries);
      setTimesheets(listResult.data.timesheets);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to load data.");
    }
  }

  async function handleAddEntry() {
    setError("");
    setMessage("");

    if (isLockedWeek) {
      setError("This week is submitted/approved. Select another week to add entries.");
      return;
    }

    if (!selectedDate || !entryForm.project_name || !entryForm.hours) {
      setError("Date, Project/Client, and Hours are required.");
      return;
    }

    const parsedHours = Number(entryForm.hours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      setError("Hours must be greater than 0 and up to 24.");
      return;
    }

    try {
      await api.post("/time-entries", { ...entryForm, work_date: selectedDate, hours: parsedHours });
      setEntryForm({ project_name: "", hours: "", notes: "" });
      setMessage("Entry added.");
      await loadEmployeeData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to add entry.");
    }
  }

  function startEdit(entry) {
    setEditRowId(entry.id);
    setEditForm({
      work_date: toISODate(entry.work_date),
      project_name: entry.project_name,
      hours: entry.hours,
      notes: entry.notes || "",
    });
  }

  async function saveEdit(entryId) {
    setError("");
    try {
      await api.put(`/time-entries/${entryId}`, { ...editForm, hours: Number(editForm.hours) });
      setEditRowId(null);
      await loadEmployeeData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to update entry.");
    }
  }

  async function removeEntry(entryId) {
    setError("");
    try {
      await api.delete(`/time-entries/${entryId}`);
      await loadEmployeeData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to delete entry.");
    }
  }

  async function submitTimesheet() {
    if (!timesheet) {
      setError("No timesheet found for this week.");
      return;
    }

    if (entries.length === 0) {
      setError("Cannot submit an empty timesheet.");
      return;
    }

    setError("");
    setMessage("");
    try {
      await api.post(`/timesheets/${timesheet.id}/submit`);
      setMessage("Timesheet submitted for manager review.");
      await loadEmployeeData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to submit timesheet.");
    }
  }

  const isLockedWeek = timesheet ? ["submitted", "approved"].includes(timesheet.status) : false;
  const canEditEntries = !isLockedWeek;

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <h2>Employee Dashboard</h2>
          <p className="muted">Welcome, {user.username}</p>
        </div>
        <button onClick={onLogout}>Logout</button>
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <section className="card">
        <div className="row-between">
          <h3>Weekly Summary</h3>
          <label>
            Select week
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
        </div>
        {timesheet && (
          <div className="summary-grid">
            <p>Week start: {formatDate(timesheet.week_start)}</p>
            <p>Status: <StatusBadge status={timesheet.status} /></p>
            <p>Total hours: {weeklyTotal.toFixed(2)}</p>
          </div>
        )}
        <button disabled={isLockedWeek || entries.length === 0} onClick={submitTimesheet}>
          Submit Timesheet
        </button>
      </section>

      <section className="card">
        <h3>Add Time Entry</h3>
        {isLockedWeek && (
          <p className="muted">This week is submitted/approved. Select another week to add entries.</p>
        )}
        <div className="grid-form">
          <label>
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          <label>
            Project/Client
            <input
              value={entryForm.project_name}
              onChange={(event) => setEntryForm((prev) => ({ ...prev, project_name: event.target.value }))}
            />
          </label>
          <label>
            Hours
            <input
              type="number"
              min="0.25"
              max="24"
              step="0.25"
              value={entryForm.hours}
              onChange={(event) => setEntryForm((prev) => ({ ...prev, hours: event.target.value }))}
            />
          </label>
          <label className="full-width">
            Notes
            <textarea
              value={entryForm.notes}
              onChange={(event) => setEntryForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>
          <button type="button" onClick={handleAddEntry}>Add Entry</button>
        </div>
      </section>

      <section className="card">
        <h3>Entries for Week</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Project</th>
              <th>Hours</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{editRowId === entry.id ? <input type="date" value={editForm.work_date} onChange={(e) => setEditForm((p) => ({ ...p, work_date: e.target.value }))} /> : formatDate(entry.work_date)}</td>
                <td>{editRowId === entry.id ? <input value={editForm.project_name} onChange={(e) => setEditForm((p) => ({ ...p, project_name: e.target.value }))} /> : entry.project_name}</td>
                <td>{editRowId === entry.id ? <input type="number" min="0.25" max="24" step="0.25" value={editForm.hours} onChange={(e) => setEditForm((p) => ({ ...p, hours: e.target.value }))} /> : entry.hours}</td>
                <td>{editRowId === entry.id ? <input value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} /> : entry.notes}</td>
                <td>
                  {canEditEntries && editRowId !== entry.id && <button onClick={() => startEdit(entry)}>Edit</button>}
                  {canEditEntries && editRowId === entry.id && <button onClick={() => saveEdit(entry.id)}>Save</button>}
                  {canEditEntries && editRowId === entry.id && <button onClick={() => setEditRowId(null)}>Cancel</button>}
                  {canEditEntries && <button onClick={() => removeEntry(entry.id)}>Delete</button>}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan="5" className="muted">No entries yet for this week.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>My Timesheets</h3>
        <table>
          <thead>
            <tr>
              <th>Week Start</th>
              <th>Status</th>
              <th>Total Hours</th>
              <th>Manager Comment</th>
            </tr>
          </thead>
          <tbody>
            {timesheets.map((sheet) => (
              <tr key={sheet.id}>
                <td>{formatDate(sheet.week_start)}</td>
                <td><StatusBadge status={sheet.status} /></td>
                <td>{Number(sheet.total_hours).toFixed(2)}</td>
                <td>{sheet.manager_comment || "-"}</td>
              </tr>
            ))}
            {timesheets.length === 0 && (
              <tr>
                <td colSpan="4" className="muted">No timesheets yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default EmployeeDashboard;
