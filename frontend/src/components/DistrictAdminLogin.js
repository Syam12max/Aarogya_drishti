
import React, { useState } from "react";
import "./DistrictAdminLogin.css";

function DistrictAdminLogin({ language = "en" }) {
  const isTelugu = language === "te";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = { username, password };

      if (showOtp) {
        body.otp = otp;
      }

      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (
        response.status === 403 &&
        data.message?.includes("MFA setup")
      ) {
        setShowOtp(true);
        setError(
          isTelugu
            ? "మీ ఖాతాకు MFA అవసరం. ముందుగా MFA Setup చేయాలి."
            : "MFA is required. Please complete MFA setup first."
        );
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed.");
      }

      if (data.user?.role !== "DISTRICT_ADMIN") {
        throw new Error("This account is not a District Admin.");
      }

      localStorage.setItem("aarogyaToken", data.token);
      localStorage.setItem(
        "aarogyaUser",
        JSON.stringify(data.user)
      );

      window.location.href = "/district-dashboard";
    } catch (err) {
      setError(err.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="district-login-container">
      <div className="district-login-card">
        <div className="district-login-icon">🏢</div>

        <h2>
          {isTelugu ? "జిల్లా అడ్మిన్ లాగిన్" : "District Admin Login"}
        </h2>

        <p>
          {isTelugu
            ? "జిల్లా నిర్వహణ వ్యవస్థలోకి స్వాగతం"
            : "Access your district management portal"}
        </p>

        <form onSubmit={handleLogin}>
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />

          {showOtp && (
            <>
              <label>Authenticator OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 6-digit OTP"
                inputMode="numeric"
                maxLength={6}
                required
              />
            </>
          )}

          {error && <div className="district-login-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : isTelugu
              ? "లాగిన్ చేయండి"
              : "Login"}
          </button>
        </form>

        <div className="district-login-footer">
          Aarogya Drishti · District Administration
        </div>
      </div>
    </div>
  );
}

export default DistrictAdminLogin;
