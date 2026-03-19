import { useEffect, useMemo, useState } from "react";
import api from "../api";
import StatusBadge from "../components/StatusBadge";
import { formatDate } from "../utils/date";

function ManagerDashboard({ user, onLogout }) {
  const [timesheets, setTimesheets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [rejectionComment, setRejectionComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTimesheets();
  }, [statusFilter]);

  useEffect(() => {
    if (selectedId) {
      loadTimesheetDetails(selectedId);
    }
  }, [selectedId]);

  async function loadTimesheets() {
    setError("");
    try {
      const response = await api.get("/manager/timesheets", { params: { status: statusFilter } });
      setTimesheets(response.data.timesheets);
      if (!response.data.timesheets.some((sheet) => sheet.id === selectedId)) {
        setSelectedId(response.data.timesheets[0]?.id || null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to load timesheets.");
    }
  }

  async function loadTimesheetDetails(id) {
    setError("");
    try {
      const response = await api.get(`/manager/timesheets/${id}`);
      setSelectedSheet(response.data.timesheet);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to load timesheet details.");
    }
  }

  async function approve() {
    if (!selectedId) return;
    setError("");
    setMessage("");
    try {
      await api.post(`/manager/timesheets/${selectedId}/approve`);
      setMessage("Timesheet approved.");
      await loadTimesheets();
      setSelectedSheet(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to approve timesheet.");
    }
  }

  async function reject() {
    if (!selectedId) return;
    setError("");
    setMessage("");
    try {
      await api.post(`/manager/timesheets/${selectedId}/reject`, { manager_comment: rejectionComment });
      setMessage("Timesheet rejected.");
      setRejectionComment("");
      await loadTimesheets();
      setSelectedSheet(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to reject timesheet.");
    }
  }

  const selectedTotal = useMemo(() => Number(selectedSheet?.total_hours || 0).toFixed(2), [selectedSheet]);

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <h2>Manager Dashboard</h2>
          <p className="muted">Welcome, {user.username}</p>
        </div>
        <button onClick={onLogout}>Logout</button>
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="manager-grid">
        <section className="card">
          <div className="row-between">
            <h3>Timesheets</h3>
            <label>
              Filter
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Week</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {timesheets.map((sheet) => (
                <tr key={sheet.id} onClick={() => setSelectedId(sheet.id)} className={selectedId === sheet.id ? "row-active" : ""}>
                  <td>{sheet.employee_name}</td>
                  <td>{formatDate(sheet.week_start)}</td>
                  <td>{Number(sheet.total_hours).toFixed(2)}</td>
                  <td><StatusBadge status={sheet.status} /></td>
                </tr>
              ))}
              {timesheets.length === 0 && (
                <tr>
                  <td colSpan="4" className="muted">No timesheets for this status.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h3>Details</h3>
          {!selectedSheet && <p className="muted">Select a timesheet to review.</p>}
          {selectedSheet && (
            <>
              <p><strong>Employee:</strong> {selectedSheet.employee_name}</p>
              <p><strong>Week start:</strong> {formatDate(selectedSheet.week_start)}</p>
              <p><strong>Status:</strong> <StatusBadge status={selectedSheet.status} /></p>
              <p><strong>Total hours:</strong> {selectedTotal}</p>
              <p><strong>Comment:</strong> {selectedSheet.manager_comment || "-"}</p>

              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Hours</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSheet.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.work_date)}</td>
                      <td>{entry.project_name}</td>
                      <td>{entry.hours}</td>
                      <td>{entry.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedSheet.status === "submitted" && (
                <div className="stack">
                  <textarea
                    placeholder="Optional rejection comment"
                    value={rejectionComment}
                    onChange={(event) => setRejectionComment(event.target.value)}
                  />
                  <div className="button-row">
                    <button onClick={approve}>Approve</button>
                    <button className="secondary" onClick={reject}>Reject</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default ManagerDashboard;
