
import React, { useState } from "react";
import "./SuperAdminLogin.css";
import SuperAdminDashboard from "./SuperAdminDashboard";

function SuperAdminLogin({ language = "en" }) {
  const isTelugu = language === "te";

  const [formData, setFormData] = useState({
    username: "superadmin",
    password: "",
    otp: "",
  });

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const [loggedIn, setLoggedIn] = useState(() => {
    const token = sessionStorage.getItem("adminToken");

    try {
      const user = JSON.parse(
        sessionStorage.getItem("adminUser") || "{}"
      );

      if (token && user.role === "SYSTEM_ADMIN") {
        return true;
      }
    } catch (error) {
      console.error("Invalid admin session");
    }

    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminUser");

    return false;
  });

  const t = {
    title: isTelugu ? "అడ్మిన్ పోర్టల్" : "Admin Portal",
    username: isTelugu ? "యూజర్ పేరు" : "Username",
    password: isTelugu ? "పాస్‌వర్డ్" : "Password",
    otp: isTelugu ? "ఆథెంటికేటర్ OTP" : "Authenticator OTP",
    passwordPlaceholder: isTelugu
      ? "మీ పాస్‌వర్డ్ నమోదు చేయండి"
      : "Enter your password",
    otpPlaceholder: isTelugu
      ? "6 అంకెల OTP నమోదు చేయండి"
      : "Enter 6-digit OTP",
    login: isTelugu ? "సురక్షిత లాగిన్" : "Secure Login",
    verifying: isTelugu ? "ధృవీకరిస్తోంది..." : "Verifying...",
    failed: isTelugu ? "లాగిన్ విఫలమైంది." : "Login failed.",
    invalidOtp: isTelugu
      ? "సరైన 6 అంకెల OTP నమోదు చేయండి."
      : "Please enter a valid 6-digit OTP.",
    wrongRole: isTelugu
      ? "ఈ ఖాతాకు Super Admin అనుమతి లేదు."
      : "This account is not authorized as Super Admin.",
    protected: isTelugu
      ? "రెండు-దశల భద్రత ద్వారా రక్షించబడింది"
      : "Protected by Two-Factor Authentication",
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: name === "otp" ? value.replace(/\D/g, "") : value,
    }));
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminUser");

    setLoggedIn(false);

    setFormData({
      username: "superadmin",
      password: "",
      otp: "",
    });

    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!/^\d{6}$/.test(formData.otp)) {
      setMessage(t.invalidOtp);
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/login",
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

      if (!data.user || data.user.role !== "SYSTEM_ADMIN") {
        throw new Error(t.wrongRole);
      }

      sessionStorage.setItem("adminToken", data.token);

      sessionStorage.setItem(
        "adminUser",
        JSON.stringify(data.user)
      );

      setLoggedIn(true);

      setFormData({
        username: "superadmin",
        password: "",
        otp: "",
      });

    } catch (error) {
      setMessage(error.message || t.failed);
    } finally {
      setLoading(false);
    }
  };

  if (loggedIn) {
    return (
      <SuperAdminDashboard
        language={language}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="superadmin-login-page">
      <div className="superadmin-login-card">

        <div className="superadmin-login-icon">
          🛡️
        </div>

        <h1>{t.title}</h1>

        <p className="superadmin-login-brand">
          Aarogya Drishti
        </p>

        <form onSubmit={handleSubmit}>

          <label>{t.username}</label>

          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
            required
          />

          <label>{t.password}</label>

          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={t.passwordPlaceholder}
            autoComplete="current-password"
            required
          />

          <label>{t.otp}</label>

          <input
            type="text"
            name="otp"
            value={formData.otp}
            onChange={handleChange}
            placeholder={t.otpPlaceholder}
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? t.verifying : t.login}
          </button>

        </form>

        {message && (
          <div className="superadmin-login-message">
            {message}
          </div>
        )}

        <small>
          🔒 {t.protected}
        </small>

      </div>
    </div>
  );
}

export default SuperAdminLogin;
