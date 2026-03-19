import { useState } from "react";
import api from "../api";

function LoginPage({ onLoggedIn }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", form);
      onLoggedIn(response.data.user);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-center">
      <div className="card login-card">
        <h1>Work Time Sheet Tracker</h1>
        <p className="muted">Sign in with one of the seeded demo users:</p>

        <div className="demo-accounts">
          <p>Demo users (password: password123)</p>
          <ul>
            <li>employee1</li>
            <li>employee2</li>
            <li>manager1</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <label>
            Username
            <input
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
