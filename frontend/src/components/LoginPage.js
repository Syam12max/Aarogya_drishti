
import React, { useState, useEffect } from "react";
import "./LoginPage.css";

import SpecialistLogin from "./SpecialistLogin";
import NavigatorLogin from "./NavigatorLogin";
import SuperAdminLogin from "./SuperAdminLogin";
import DistrictAdminLogin from "./DistrictAdminLogin";
import HealthWorkerLogin from "./HealthWorkerLogin";
import HealthWorkerRegistration from "./HealthWorkerRegistration";
import MedicalOfficerLogin from "./MedicalOfficerLogin";
import MedicalOfficerRegistration from "./MedicalOfficerRegistration";
import AdditionalRoleLogin from "./AdditionalRoleLogin";

function LoginPage() {
  const [page, setPage] = useState(
    () => sessionStorage.getItem("aarogyaPage") || "home"
  );

  const [selectedRole, setSelectedRole] = useState(
    () => sessionStorage.getItem("aarogyaSelectedRole") || ""
  );

  const [language, setLanguage] = useState(
    () => localStorage.getItem("aarogyaLanguage") || "en"
  );

  const te = language === "te";

  useEffect(() => {
    sessionStorage.setItem("aarogyaPage", page);
    sessionStorage.setItem("aarogyaSelectedRole", selectedRole);
  }, [page, selectedRole]);

  useEffect(() => {
    localStorage.setItem("aarogyaLanguage", language);
  }, [language]);

  const goHome = () => {
    setPage("home");
    setSelectedRole("");
    sessionStorage.removeItem("aarogyaPage");
    sessionStorage.removeItem("aarogyaSelectedRole");
  };

  const goBack = () => {
    const previousPages = {
      registration: "registrationRoles",
      medicalOfficerRegistration: "registrationRoles",
      registrationPending: "registrationRoles",
      medicalOfficer: "loginRoles",
      worker: "loginRoles",
      districtAdmin: "loginRoles",
      additionalLogin: "loginRoles",
      admin: "home",
      registrationRoles: "home",
      loginRoles: "home",
    };

    const previousPage = previousPages[page] || "home";

    setPage(previousPage);

    if (
      previousPage === "home" ||
      previousPage === "registrationRoles" ||
      previousPage === "loginRoles"
    ) {
      setSelectedRole("");
    }
  };

  const roles = [
    { id: "DISTRICT_ADMIN", name: "District Admin", icon: "🏢" },
    { id: "MEDICAL_OFFICER", name: "Medical Officer", icon: "🩺" },
    { id: "HEALTH_WORKER", name: "Health Worker", icon: "👨‍⚕️" },
    { id: "SPECIALIST", name: "Specialist", icon: "⚕️" },
    { id: "NAVIGATOR", name: "Navigator", icon: "🧭" },
    { id: "HOSPITAL_STAFF", name: "Hospital Staff", icon: "🏥" },
  ];

  // Login navigation
  const openLogin = (role) => {
    setSelectedRole(role);

    const pages = {
      DISTRICT_ADMIN: "districtAdmin",
      MEDICAL_OFFICER: "medicalOfficer",
      HEALTH_WORKER: "worker",
    };

    setPage(pages[role] || "additionalLogin");
  };

  // Registration navigation
  // All roles except Medical Officer use the shared registration form.
  const openRegistration = (role) => {
    setSelectedRole(role);

    if (role === "MEDICAL_OFFICER") {
      setPage("medicalOfficerRegistration");
    } else {
      setPage("registration");
    }
  };

  const backButton = (
    <button
      type="button"
      className="back-home-btn"
      onClick={goBack}
    >
      ← {te ? "వెనక్కి" : "Back"}
    </button>
  );

  // Super Admin Login
  if (page === "admin") {
    return (
      <div className="auth-page">
        {backButton}
        <SuperAdminLogin language={language} />
      </div>
    );
  }

  // District Admin Login
  if (page === "districtAdmin") {
    return (
      <div className="auth-page">
        {backButton}
        <DistrictAdminLogin language={language} />
      </div>
    );
  }

  // Health Worker Login
  if (page === "worker") {
    return (
      <div className="auth-page">
        {backButton}
        <HealthWorkerLogin language={language} />
      </div>
    );
  }

  // Medical Officer Login
  if (page === "medicalOfficer") {
    return (
      <div className="auth-page">
        {backButton}
        <MedicalOfficerLogin language={language} />
      </div>
    );
  }

  // Specialist, Navigator and Hospital Staff Login
  if (page === "additionalLogin") {
    return (
      <div className="auth-page">
        {backButton}

        {selectedRole === "SPECIALIST" && (
          <SpecialistLogin language={language} />
        )}

        {selectedRole === "NAVIGATOR" && (
          <NavigatorLogin language={language} />
        )}

        {selectedRole === "HOSPITAL_STAFF" && (
          <AdditionalRoleLogin
            language={language}
            role="HOSPITAL_STAFF"
          />
        )}
      </div>
    );
  }

  // Shared Registration Form
  if (page === "registration") {
    return (
      <div className="auth-page">
        {backButton}

        <HealthWorkerRegistration
          language={language}
          initialRole={selectedRole}
        />
      </div>
    );
  }

  // Medical Officer Registration
  if (page === "medicalOfficerRegistration") {
    return (
      <div className="auth-page">
        {backButton}

        <MedicalOfficerRegistration language={language} />
      </div>
    );
  }

  // Registration Roles
  if (page === "registrationRoles") {
    return (
      <main className="role-page">
        {backButton}

        <div className="role-container">
          <h1>
            {te ? "కొత్త రిజిస్ట్రేషన్" : "New Registration"}
          </h1>

          <p>
            {te
              ? "మీ రోల్ ఎంచుకొని రిజిస్ట్రేషన్ కొనసాగించండి"
              : "Select your role to continue registration"}
          </p>

          <div className="role-grid">
            {roles.map((role) => (
              <button
                type="button"
                className="role-card"
                key={role.id}
                onClick={() => openRegistration(role.id)}
              >
                <span className="role-icon">{role.icon}</span>
                <span>{role.name}</span>
                <span className="role-arrow">›</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Login Roles
  if (page === "loginRoles") {
    return (
      <main className="role-page">
        {backButton}

        <div className="role-container">
          <h1>
            {te ? "లాగిన్" : "Select Your Role"}
          </h1>

          <p>
            {te
              ? "మీ ఖాతా రోల్ ఎంచుకోండి"
              : "Choose your account to continue"}
          </p>

          <div className="role-grid">
            {roles.map((role) => (
              <button
                type="button"
                className="role-card"
                key={role.id}
                onClick={() => openLogin(role.id)}
              >
                <span className="role-icon">{role.icon}</span>
                <span>{role.name}</span>
                <span className="role-arrow">›</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Registration Pending - retained for compatibility
  if (page === "registrationPending") {
    return (
      <main className="role-page">
        {backButton}

        <div className="role-container pending-container">
          <div className="pending-icon">📝</div>

          <h1>{selectedRole.replaceAll("_", " ")}</h1>

          <p>
            {te
              ? "ఈ రిజిస్ట్రేషన్ ఫారం త్వరలో జోడించబడుతుంది."
              : "This registration form will be added in the next step."}
          </p>
        </div>
      </main>
    );
  }

  // Premium Home Page
  return (
    <main className="premium-home">
      {/* LEFT HOSPITAL IMAGE */}
      <section className="hospital-visual">
        <img
          src="/hospital-hero.png"
          alt="Aarogya Drishti healthcare centre"
          className="hospital-image"
        />

        <div className="hospital-image-overlay">
          <div className="image-brand">
            <span className="image-brand-icon">✚</span>
            <span>Aarogya Drishti</span>
          </div>

          <div className="image-caption">
            <span className="caption-tag">
              HEALTHCARE FOR EVERYONE
            </span>

            <h1>
              {te
                ? "ప్రతి ఒక్కరికీ మెరుగైన ఆరోగ్య సేవలు"
                : "Better Healthcare for Every Community"}
            </h1>

            <p>
              {te
                ? "ఆరోగ్యకరమైన సమాజం కోసం సాంకేతికతతో కూడిన వైద్య సేవలు."
                : "Connecting communities with accessible, intelligent and reliable healthcare."}
            </p>
          </div>

          <div className="image-bottom-label">
            <span>✚</span> Primary Healthcare • AI Assisted Screening
          </div>
        </div>
      </section>

      {/* RIGHT ACCESS PANEL */}
      <section className="access-panel">
        <div className="top-language">
          <span>🌐</span>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Select language"
          >
            <option value="en">English</option>
            <option value="te">తెలుగు</option>
          </select>
        </div>

        <div className="access-content">
          <div className="main-brand">
            <div className="brand-symbol">
              <span>✚</span>
            </div>

            <h1>
              Aarogya <span>Drishti</span>
            </h1>

            <div className="brand-underline"></div>

            <p>
              {te
                ? "ఆరోగ్యకరమైన సమాజం – మెరుగైన భవిష్యత్తు"
                : "Healthy Communities, Brighter Futures"}
            </p>
          </div>

          <div className="access-actions">
            <button
              type="button"
              className="access-card registration-card"
              onClick={() => setPage("registrationRoles")}
            >
              <span className="access-icon">♙+</span>

              <span className="access-text">
                <strong>
                  {te ? "కొత్త రిజిస్ట్రేషన్" : "New Registration"}
                </strong>

                <small>
                  {te
                    ? "కొత్త ఖాతాను నమోదు చేయండి"
                    : "Register for a new account"}
                </small>
              </span>

              <span className="access-arrow">›</span>
            </button>

            <button
              type="button"
              className="access-card login-card"
              onClick={() => setPage("loginRoles")}
            >
              <span className="access-icon">♙</span>

              <span className="access-text">
                <strong>{te ? "లాగిన్" : "Login"}</strong>

                <small>
                  {te
                    ? "మీ ఖాతాలోకి ప్రవేశించండి"
                    : "Access your account"}
                </small>
              </span>

              <span className="access-arrow">›</span>
            </button>

            <button
              type="button"
              className="access-card super-card"
              onClick={() => {
                setSelectedRole("SUPER_ADMIN");
                setPage("admin");
              }}
            >
              <span className="access-icon">🛡</span>

              <span className="access-text">
                <strong>
                  {te ? "సూపర్ అడ్మిన్ లాగిన్" : "Super Admin Login"}
                </strong>

                <small>
                  {te
                    ? "అధీకృత నిర్వాహకులకు మాత్రమే"
                    : "Authorized administrators only"}
                </small>
              </span>

              <span className="access-arrow">›</span>
            </button>
          </div>

          <div className="access-footer">
            <span>SECURE HEALTHCARE PLATFORM</span>
            <p>© {new Date().getFullYear()} Aarogya Drishti</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
