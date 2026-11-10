
import React, { useState } from "react";
import "./AdditionalRoleLogin.css";

function AdditionalRoleLogin({ language = "en", role = "SPECIALIST" }) {
  const te = language === "te";

  const roleDetails = {
    SPECIALIST: {
      title: "Specialist",
      subtitle: "Specialist Healthcare Portal",
      icon: "🩺",
      tokenKey: "specialistToken",
      userKey: "specialistUser",
    },
    NAVIGATOR: {
      title: "Navigator",
      subtitle: "Healthcare Navigation Portal",
      icon: "🧭",
      tokenKey: "navigatorToken",
      userKey: "navigatorUser",
    },
    HOSPITAL_STAFF: {
      title: "Hospital Staff",
      subtitle: "Hospital Management Portal",
      icon: "🏥",
      tokenKey: "hospitalStaffToken",
      userKey: "hospitalStaffUser",
    },
  };

  const currentRole = roleDetails[role];

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [loggedIn, setLoggedIn] = useState(
    () =>
      !!currentRole &&
      !!sessionStorage.getItem(currentRole.tokenKey)
  );

  const [user, setUser] = useState(() => {
    if (!currentRole) return {};

    try {
      return JSON.parse(
        sessionStorage.getItem(currentRole.userKey) || "{}"
      );
    } catch {
      return {};
    }
  });

  if (!currentRole) {
    return <div>Invalid user role.</div>;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success || !data.token) {
        throw new Error(data.message || "Login failed.");
      }

      if (data.user?.role !== role) {
        throw new Error(
          `This account does not belong to ${currentRole.title}.`
        );
      }

      sessionStorage.setItem(currentRole.tokenKey, data.token);
      sessionStorage.setItem(
        currentRole.userKey,
        JSON.stringify(data.user)
      );

      setUser(data.user);
      setLoggedIn(true);
      setUsername("");
      setPassword("");
    } catch (error) {
      setMessage(error.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(currentRole.tokenKey);
    sessionStorage.removeItem(currentRole.userKey);

    setUser({});
    setLoggedIn(false);
    setMessage("");
  };

  // TEMPORARY DASHBOARD VIEW
  if (loggedIn) {
    return (
      <div className="additional-role-page">
        <div className="additional-role-card">
          <div className="additional-role-logo">✚</div>

          <div className="additional-role-brand">
            AAROGYA <span>DRISHTI</span>
          </div>

          <div className="additional-role-icon">
            {currentRole.icon}
          </div>

          <h1>
            {currentRole.title} Dashboard
          </h1>

          <p className="additional-role-subtitle">
            {te ? "స్వాగతం" : "Welcome"}, {user.fullName || user.username}
          </p>

          <div className="additional-role-success">
            <span>✓</span>
            {te ? "లాగిన్ విజయవంతమైంది" : "Login Successful"}
          </div>

          <p className="additional-role-note">
            {te
              ? "డ్యాష్‌బోర్డ్ మాడ్యూల్స్ తదుపరి దశలో జోడిస్తాము."
              : "Dashboard modules will be connected in the next step."}
          </p>

          <button
            className="additional-role-submit"
            onClick={handleLogout}
          >
            {te ? "లాగ్అవుట్" : "Logout"}
          </button>
        </div>
      </div>
    );
  }

  // PREMIUM LOGIN PAGE
  return (
    <div className="additional-role-page">
      <div className="additional-role-card">

        <div className="additional-role-logo">✚</div>

        <div className="additional-role-brand">
          AAROGYA <span>DRISHTI</span>
        </div>

        <div className="additional-role-icon">
          {currentRole.icon}
        </div>

        <h1>
          {te
            ? `${currentRole.title} లాగిన్`
            : `${currentRole.title} Login`}
        </h1>

        <p className="additional-role-subtitle">
          {currentRole.subtitle}
        </p>

        <div className="additional-role-divider"></div>

        <form onSubmit={handleLogin}>

          <label>
            {te ? "యూజర్ పేరు" : "Username"}
          </label>

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={
              te ? "యూజర్ పేరు నమోదు చేయండి" : "Enter your username"
            }
            autoComplete="username"
            required
          />

          <label>
            {te ? "పాస్‌వర్డ్" : "Password"}
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              te ? "పాస్‌వర్డ్ నమోదు చేయండి" : "Enter your password"
            }
            autoComplete="current-password"
            required
          />

          {message && (
            <div className="additional-role-error">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="additional-role-submit"
            disabled={loading}
          >
            {loading
              ? te
                ? "ధృవీకరిస్తోంది..."
                : "Verifying..."
              : te
              ? "లాగిన్ చేయండి"
              : "Login to Portal"}
          </button>
        </form>

        <div className="additional-role-security">
          <span>🔒</span>
          {te
            ? "సురక్షిత ఆరోగ్య సేవల వేదిక"
            : "Secure Healthcare Access"}
        </div>

        <div className="additional-role-footer">
          © {new Date().getFullYear()} Aarogya Drishti
        </div>

      </div>
    </div>
  );
}

export default AdditionalRoleLogin;
