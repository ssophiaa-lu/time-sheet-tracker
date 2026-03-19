import { useEffect, useState } from "react";
import api from "./api";
import LoginPage from "./pages/LoginPage";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function handleLoggedIn(loggedInUser) {
    localStorage.setItem("wttsUser", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  }

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await api.get("/auth/me");
        handleLoggedIn(response.data.user);
      } catch (_error) {
        localStorage.removeItem("wttsUser");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadCurrentUser();
  }, []);

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch (_error) {
      // If the server session already expired, still log out locally.
    }
    localStorage.removeItem("wttsUser");
    setUser(null);
  }

  if (loading) {
    return <div className="page-center">Loading...</div>;
  }

  if (!user) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  if (user.role === "manager") {
    return <ManagerDashboard user={user} onLogout={handleLogout} />;
  }

  return <EmployeeDashboard user={user} onLogout={handleLogout} />;
}

export default App;
