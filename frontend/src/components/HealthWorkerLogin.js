
import React, { useState } from "react";
import HealthWorkerDashboard from "./HealthWorkerDashboard";
import PatientSearch from "./PatientSearch";

function HealthWorkerLogin({ language = "en" }) {
  const te = language === "te";

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Restore login session
  const [loggedIn, setLoggedIn] = useState(() => {
    return !!sessionStorage.getItem("workerToken");
  });

  // Restore last visited worker page after refresh
  const [currentPage, setCurrentPage] = useState(() => {
    return sessionStorage.getItem("workerCurrentPage") || "dashboard";
  });

  // Navigate and save current page
  const navigateTo = (page) => {
    sessionStorage.setItem("workerCurrentPage", page);
    setCurrentPage(page);
  };

  const t = {
    title: te ? "హెల్త్ వర్కర్ లాగిన్" : "Health Worker Login",
    username: te ? "యూజర్ పేరు" : "Username",
    password: te ? "పాస్‌వర్డ్" : "Password",
    usernamePlaceholder: te
      ? "యూజర్ పేరును నమోదు చేయండి"
      : "Enter username",
    passwordPlaceholder: te
      ? "పాస్‌వర్డ్ నమోదు చేయండి"
      : "Enter password",
    login: te ? "లాగిన్" : "Login",
    verifying: te ? "ధృవీకరిస్తోంది..." : "Verifying...",
    failed: te ? "లాగిన్ విఫలమైంది." : "Login failed.",
    logout: te ? "లాగ్అవుట్" : "Logout",
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("workerToken");
    sessionStorage.removeItem("workerUser");
    sessionStorage.removeItem("workerCurrentPage");

    setLoggedIn(false);
    setCurrentPage("dashboard");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/worker-login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success || !data.token) {
        throw new Error(data.message || t.failed);
      }

      sessionStorage.setItem("workerToken", data.token);
      sessionStorage.setItem(
        "workerUser",
        JSON.stringify(data.user)
      );

      sessionStorage.setItem("workerCurrentPage", "dashboard");

      setLoggedIn(true);
      setCurrentPage("dashboard");

      setFormData({
        username: "",
        password: "",
      });

    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Logged-in pages
  if (loggedIn) {
    if (currentPage === "patientSearch") {
      return (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "12px 25px",
              background: "#ffffff",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: "#dc2626",
                color: "#ffffff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              {t.logout}
            </button>
          </div>

          <PatientSearch
            language={language}
            onBack={() => navigateTo("dashboard")}
            onRegisterNew={() => {
              alert(
                te
                  ? "Patient Registration form తదుపరి దశలో జోడిస్తాము."
                  : "Patient Registration form will be added in the next step."
              );
            }}
          />
        </div>
      );
    }

    return (
      <>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "12px 25px",
            background: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: "#dc2626",
              color: "#ffffff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            {t.logout}
          </button>
        </div>

        <HealthWorkerDashboard
          language={language}
          onRegister={() => navigateTo("patientSearch")}
        />
      </>
    );
  }

  // Login page
  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-icon">👨‍⚕️</div>

        <h1>{t.title}</h1>
        <p>Aarogya Drishti</p>

        <form onSubmit={handleSubmit}>
          <label>{t.username}</label>

          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder={t.usernamePlaceholder}
            required
          />

          <label>{t.password}</label>

          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={t.passwordPlaceholder}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? t.verifying : t.login}
          </button>
        </form>

        {message && (
          <div className="admin-login-message">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default HealthWorkerLogin;
