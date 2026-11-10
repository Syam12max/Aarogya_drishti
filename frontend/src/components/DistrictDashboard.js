import React, { useEffect, useState } from "react";
import "./DistrictDashboard.css";

function DistrictDashboard() {
  const [activePage, setActivePage] = useState(
    window.location.hash.replace("#", "") || "dashboard"
  );

  const [stats, setStats] = useState({
    health_workers: 0,
    medical_officers: 0,
    pending_approvals: 0,
    total_facilities: 0,
  });

  const [registrations, setRegistrations] = useState([]);
  const [patients, setPatients] = useState([]);

  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientProfileLoading, setPatientProfileLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [patientsError, setPatientsError] = useState("");
  const [patientProfileError, setPatientProfileError] = useState("");

  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);

  // SCREENING HISTORY
  const [screeningHistory, setScreeningHistory] = useState(null);
  const [screeningHistoryLoading, setScreeningHistoryLoading] =
    useState(false);
  const [screeningHistoryError, setScreeningHistoryError] = useState("");

  // REFERRALS & APPOINTMENTS
  const [referrals, setReferrals] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [referralSearch, setReferralSearch] = useState("");
  const [referralTab, setReferralTab] = useState("referrals");
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState("");
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [referralDetailsLoading, setReferralDetailsLoading] = useState(false);

  // REJECTION MODAL
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionModalError, setRejectionModalError] = useState("");

  const [language, setLanguage] = useState(
    localStorage.getItem("aarogyaLanguage") || "en"
  );

  const isTe = language === "te";
  const API = "http://localhost:5000/api/auth";
  const PATIENT_API = "http://localhost:5000/api/district/patients";
  const REFERRAL_API = "http://localhost:5000/api/district/referrals";

  const token = () => localStorage.getItem("aarogyaToken");

  // COMMON API RESPONSE HANDLER
  const readApiResponse = async (response) => {
    const responseText = await response.text();

    let data;

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      throw new Error(
        `Invalid server response. Status: ${response.status}. URL: ${response.url}`
      );
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed: ${response.status}`);
    }

    return data;
  };

  const t = (english, telugu) => (isTe ? telugu : english);

  const menuItems = [
    { id: "dashboard", icon: "▦", en: "District dashboard", te: "జిల్లా డాష్‌బోర్డ్" },
    { id: "review", icon: "◷", en: "Review queue", te: "రివ్యూ క్యూ" },
    { id: "consults", icon: "▣", en: "Video consults", te: "వీడియో కన్సల్టేషన్స్" },
    { id: "referrals", icon: "↗", en: "Referrals & appointments", te: "రిఫరల్స్ మరియు అపాయింట్‌మెంట్స్" },
    { id: "investigations", icon: "✚", en: "Investigations", te: "పరీక్షలు" },
    { id: "followups", icon: "✓", en: "Navigator follow-ups", te: "ఫాలో-అప్స్" },
    { id: "patients", icon: "♙", en: "Patient records", te: "రోగుల వివరాలు" },
    { id: "notifications", icon: "♧", en: "Notifications", te: "నోటిఫికేషన్స్" },
    { id: "users", icon: "♧", en: "Users & roles", te: "యూజర్స్ మరియు రోల్స్" },
    { id: "audit", icon: "▤", en: "Audit trail", te: "ఆడిట్ ట్రైల్" },
    { id: "demo", icon: "▣", en: "Demo data", te: "డెమో డేటా" },
  ];

  // DASHBOARD STATISTICS
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError("");

      if (!token()) {
        throw new Error("Login session not found. Please login again.");
      }

      const response = await fetch(`${API}/district-dashboard/stats`, {
        headers: {
          Authorization: `Bearer ${token()}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load dashboard.");
      }

      setStats((previous) => ({
        ...previous,
        ...(data.stats || {}),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // PENDING REGISTRATIONS
  const fetchPendingRegistrations = async () => {
    try {
      setReviewLoading(true);
      setReviewError("");

      const response = await fetch(
        `${API}/district-dashboard/pending-registrations`,
        {
          headers: {
            Authorization: `Bearer ${token()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load registrations.");
      }

      setRegistrations(data.registrations || []);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  // APPROVE REGISTRATION
  const approveRegistration = async (registrationId) => {
    try {
      setActionLoading(registrationId);
      setReviewError("");
      setReviewMessage("");

      const response = await fetch(
        `${API}/district-dashboard/registrations/${registrationId}/approve`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to approve registration.");
      }

      setReviewMessage("Registration approved successfully.");
      await fetchPendingRegistrations();
      await fetchDashboardStats();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  // OPEN REJECTION MODAL
  const openRejectModal = (registration) => {
    setSelectedRegistration(registration);
    setRejectionReason("");
    setRejectionModalError("");
    setRejectModalOpen(true);
  };

  // REJECT REGISTRATION
  const rejectRegistration = async () => {
    if (!selectedRegistration || !rejectionReason.trim()) {
      setRejectionModalError("Please enter rejection reason.");
      return;
    }

    try {
      setActionLoading(selectedRegistration.id);
      setRejectionModalError("");

      const response = await fetch(
        `${API}/district-dashboard/registrations/${selectedRegistration.id}/reject`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`,
          },
          body: JSON.stringify({
            reason: rejectionReason.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to reject registration.");
      }

      setRejectModalOpen(false);
      setSelectedRegistration(null);
      setRejectionReason("");
      setReviewMessage("Registration rejected successfully.");

      await fetchPendingRegistrations();
      await fetchDashboardStats();
    } catch (err) {
      setRejectionModalError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  // FETCH PATIENTS
  const fetchPatients = async () => {
    try {
      setPatientsLoading(true);
      setPatientsError("");

      if (!token()) {
        throw new Error("Login session not found. Please login again.");
      }

      const response = await fetch(
        `${PATIENT_API}?search=${encodeURIComponent(patientSearch)}`,
        {
          headers: {
            Authorization: `Bearer ${token()}`,
          },
        }
      );

      const data = await readApiResponse(response);

      setPatients(data.patients || []);
    } catch (err) {
      setPatientsError(err.message);
    } finally {
      setPatientsLoading(false);
    }
  };

  // FETCH PATIENT PROFILE
  const fetchPatientProfile = async (patientId) => {
    try {
      setPatientProfileLoading(true);
      setPatientProfileError("");
      setSelectedPatient(null);
      setMedicalHistory([]);
      setScreeningHistory(null);

      if (!token()) {
        throw new Error("Login session not found. Please login again.");
      }

      const response = await fetch(
        `${PATIENT_API}/profile/${patientId}`,
        {
          headers: {
            Authorization: `Bearer ${token()}`,
          },
        }
      );

      const data = await readApiResponse(response);

      setSelectedPatient(data.patient || data);
      setMedicalHistory(
        data.medicalHistory ||
        data.medical_history ||
        []
      );
    } catch (err) {
      setPatientProfileError(err.message);
    } finally {
      setPatientProfileLoading(false);
    }
  };

  // FETCH SCREENING HISTORY
  const fetchScreeningHistory = async (patientId) => {
    try {
      setScreeningHistoryLoading(true);
      setScreeningHistoryError("");

      const response = await fetch(
        `${PATIENT_API}/screening-history/${patientId}`,
        {
          headers: {
            Authorization: `Bearer ${token()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load screening history.");
      }

      setScreeningHistory(data);
    } catch (err) {
      setScreeningHistoryError(err.message);
    } finally {
      setScreeningHistoryLoading(false);
    }
  };

  // FETCH REFERRALS
  const fetchReferrals = async () => {
    try {
      setReferralLoading(true);
      setReferralError("");

      const response = await fetch(
        `${REFERRAL_API}?search=${encodeURIComponent(referralSearch)}`,
        {
          headers: {
            Authorization: `Bearer ${token()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load referrals.");
      }

      setReferrals(data.referrals || []);
    } catch (err) {
      setReferralError(err.message);
    } finally {
      setReferralLoading(false);
    }
  };

  // FETCH APPOINTMENTS
  const fetchAppointments = async () => {
    try {
      setReferralLoading(true);
      setReferralError("");

      const response = await fetch(
        `${REFERRAL_API}/appointments?search=${encodeURIComponent(referralSearch)}`,
        {
          headers: {
            Authorization: `Bearer ${token()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load appointments.");
      }

      setAppointments(data.appointments || []);
    } catch (err) {
      setReferralError(err.message);
    } finally {
      setReferralLoading(false);
    }
  };

  // FETCH REFERRAL DETAILS
  const fetchReferralDetails = async (referralId) => {
    try {
      setReferralDetailsLoading(true);
      setReferralError("");
      setSelectedReferral(null);

      const response = await fetch(
        `${REFERRAL_API}/${referralId}`,
        {
          headers: {
            Authorization: `Bearer ${token()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load referral details.");
      }

      setSelectedReferral(data);
    } catch (err) {
      setReferralError(err.message);
    } finally {
      setReferralDetailsLoading(false);
    }
  };

  // NAVIGATION
  const handleNavigation = (page) => {
    setActivePage(page);
    window.location.hash = page;

    if (page === "review") {
      fetchPendingRegistrations();
    }

    if (page === "patients") {
      fetchPatients();
    }

    if (page === "referrals") {
      setSelectedReferral(null);
      fetchReferrals();
    }
  };

  // INITIAL DASHBOARD LOAD
  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // LOAD REFERRAL TAB DATA
  useEffect(() => {
    if (activePage === "referrals") {
      if (referralTab === "referrals") {
        fetchReferrals();
      } else {
        fetchAppointments();
      }
    }
  }, [activePage, referralTab]);

  // SEARCH PATIENTS
  useEffect(() => {
    if (activePage === "patients") {
      fetchPatients();
    }
  }, [patientSearch]);

  // SEARCH REFERRALS AND APPOINTMENTS
  useEffect(() => {
    if (activePage === "referrals") {
      if (referralTab === "referrals") {
        fetchReferrals();
      } else {
        fetchAppointments();
      }
    }
  }, [referralSearch]);

  // LANGUAGE
  const changeLanguage = (value) => {
    setLanguage(value);
    localStorage.setItem("aarogyaLanguage", value);
  };

  // DASHBOARD PAGE
  const renderDashboard = () => (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <h1>{t("District Dashboard", "జిల్లా డాష్‌బోర్డ్")}</h1>
          <p>
            {t(
              "District overview and performance",
              "జిల్లా పనితీరు వివరాలు"
            )}
          </p>
        </div>

        <button onClick={fetchDashboardStats} className="refresh-btn">
          ↻ {t("Refresh", "రిఫ్రెష్")}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <span>{t("Health Workers", "హెల్త్ వర్కర్స్")}</span>
          <h2>{loading ? "..." : stats.health_workers || 0}</h2>
        </div>

        <div className="stat-card">
          <span>{t("Medical Officers", "మెడికల్ ఆఫీసర్స్")}</span>
          <h2>{loading ? "..." : stats.medical_officers || 0}</h2>
        </div>

        <div className="stat-card">
          <span>{t("Pending Approvals", "పెండింగ్ అప్రూవల్స్")}</span>
          <h2>{loading ? "..." : stats.pending_approvals || 0}</h2>
        </div>

        <div className="stat-card">
          <span>{t("Total Facilities", "మొత్తం కేంద్రాలు")}</span>
          <h2>{loading ? "..." : stats.total_facilities || 0}</h2>
        </div>
      </div>

      <div className="dashboard-panel">
        <h2>{t("Quick Actions", "త్వరిత చర్యలు")}</h2>

        <div className="quick-actions">
          <button onClick={() => handleNavigation("review")}>
            {t("Review Registrations", "రిజిస్ట్రేషన్లు పరిశీలించండి")}
          </button>

          <button onClick={() => handleNavigation("patients")}>
            {t("Patient Records", "రోగుల వివరాలు")}
          </button>

          <button onClick={() => handleNavigation("referrals")}>
            {t("Referrals & Appointments", "రిఫరల్స్ మరియు అపాయింట్‌మెంట్స్")}
          </button>
        </div>
      </div>
    </div>
  );

  // REVIEW QUEUE PAGE
  const renderReviewQueue = () => (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <h1>{t("Registration Review Queue", "రిజిస్ట్రేషన్ రివ్యూ క్యూ")}</h1>
          <p>
            {t(
              "Review pending staff registrations",
              "పెండింగ్ రిజిస్ట్రేషన్లను పరిశీలించండి"
            )}
          </p>
        </div>

        <button onClick={fetchPendingRegistrations} className="refresh-btn">
          ↻ {t("Refresh", "రిఫ్రెష్")}
        </button>
      </div>

      {reviewError && <div className="error-message">{reviewError}</div>}
      {reviewMessage && <div className="success-message">{reviewMessage}</div>}

      {reviewLoading ? (
        <p>{t("Loading registrations...", "రిజిస్ట్రేషన్లు లోడ్ అవుతున్నాయి...")}</p>
      ) : registrations.length === 0 ? (
        <div className="empty-state">
          {t("No pending registrations found.", "పెండింగ్ రిజిస్ట్రేషన్లు లేవు.")}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t("Name", "పేరు")}</th>
                <th>{t("Email", "ఈమెయిల్")}</th>
                <th>{t("Role", "పాత్ర")}</th>
                <th>{t("Date", "తేదీ")}</th>
                <th>{t("Actions", "చర్యలు")}</th>
              </tr>
            </thead>

            <tbody>
              {registrations.map((item) => (
                <tr key={item.id}>
                  <td>{item.full_name || item.name || "-"}</td>
                  <td>{item.email || "-"}</td>
                  <td>{item.role_name || item.role || "-"}</td>
                  <td>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="action-buttons">
                    <button
                      disabled={!!actionLoading}
                      onClick={() => approveRegistration(item.id)}
                    >
                      {actionLoading === item.id
                        ? t("Please wait...", "వేచి ఉండండి...")
                        : t("Approve", "ఆమోదించండి")}
                    </button>

                    <button
                      className="reject-btn"
                      disabled={!!actionLoading}
                      onClick={() => openRejectModal(item)}
                    >
                      {t("Reject", "తిరస్కరించండి")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>{t("Reject Registration", "రిజిస్ట్రేషన్ తిరస్కరణ")}</h2>

            <p>
              {selectedRegistration?.full_name ||
                selectedRegistration?.name}
            </p>

            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder={t(
                "Enter rejection reason",
                "తిరస్కరణ కారణం నమోదు చేయండి"
              )}
            />

            {rejectionModalError && (
              <div className="error-message">{rejectionModalError}</div>
            )}

            <div className="modal-actions">
              <button onClick={() => setRejectModalOpen(false)}>
                {t("Cancel", "రద్దు")}
              </button>

              <button
                className="reject-btn"
                disabled={!!actionLoading}
                onClick={rejectRegistration}
              >
                {t("Confirm Reject", "నిర్ధారించండి")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // PATIENT RECORDS PAGE
  const renderPatients = () => (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <h1>{t("Patient Records", "రోగుల వివరాలు")}</h1>
          <p>{t("Search and view district patients", "జిల్లా రోగుల వివరాలు చూడండి")}</p>
        </div>

        <button onClick={fetchPatients} className="refresh-btn">
          ↻ {t("Refresh", "రిఫ్రెష్")}
        </button>
      </div>

      <input
        className="search-input"
        value={patientSearch}
        onChange={(event) => setPatientSearch(event.target.value)}
        placeholder={t(
          "Search patient name or code...",
          "రోగి పేరు లేదా కోడ్ వెతకండి..."
        )}
      />

      {patientsError && <div className="error-message">{patientsError}</div>}

      {patientsLoading ? (
        <p>{t("Loading patients...", "రోగుల వివరాలు లోడ్ అవుతున్నాయి...")}</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t("Patient Code", "రోగి కోడ్")}</th>
                <th>{t("Patient Name", "రోగి పేరు")}</th>
                <th>{t("Village", "గ్రామం")}</th>
                <th>{t("Action", "చర్య")}</th>
              </tr>
            </thead>

            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td>{patient.patient_code || "-"}</td>
                  <td>{patient.full_name || patient.patient_name || "-"}</td>
                  <td>{patient.village_name || "-"}</td>
                  <td>
                    <button onClick={() => fetchPatientProfile(patient.id)}>
                      {t("View Profile", "ప్రొఫైల్ చూడండి")}
                    </button>
                  </td>
                </tr>
              ))}

              {patients.length === 0 && (
                <tr>
                  <td colSpan="4">
                    {t("No patients found.", "రోగులు కనబడలేదు.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {patientProfileLoading && (
        <p>{t("Loading profile...", "ప్రొఫైల్ లోడ్ అవుతోంది...")}</p>
      )}

      {patientProfileError && (
        <div className="error-message">{patientProfileError}</div>
      )}

      {selectedPatient && (
        <div className="dashboard-panel">
          <div className="page-heading">
            <h2>{t("Patient Profile", "రోగి ప్రొఫైల్")}</h2>

            <button onClick={() => setSelectedPatient(null)}>
              {t("Close", "మూసివేయండి")}
            </button>
          </div>

          <p>
            <strong>{t("Name", "పేరు")}:</strong>{" "}
            {selectedPatient.full_name ||
              selectedPatient.patient_name ||
              "-"}
          </p>

          <p>
            <strong>{t("Patient Code", "రోగి కోడ్")}:</strong>{" "}
            {selectedPatient.patient_code || "-"}
          </p>

          <p>
            <strong>{t("Phone", "ఫోన్")}:</strong>{" "}
            {selectedPatient.phone ||
              selectedPatient.mobile_number ||
              "-"}
          </p>

          <p>
            <strong>{t("Village", "గ్రామం")}:</strong>{" "}
            {selectedPatient.village_name || "-"}
          </p>

          <h3>{t("Medical History", "వైద్య చరిత్ర")}</h3>

          {medicalHistory.length > 0 ? (
            medicalHistory.map((item, index) => (
              <p key={item.id || index}>
                {item.condition_name ||
                  item.diagnosis ||
                  item.notes ||
                  JSON.stringify(item)}
              </p>
            ))
          ) : (
            <p>
              {t(
                "No medical history available.",
                "వైద్య చరిత్ర అందుబాటులో లేదు."
              )}
            </p>
          )}

          <h3>{t("Screening History", "స్క్రీనింగ్ చరిత్ర")}</h3>

          <button
            onClick={() => fetchScreeningHistory(selectedPatient.id)}
          >
            {t("Load Screening History", "స్క్రీనింగ్ చరిత్ర చూడండి")}
          </button>

          {screeningHistoryLoading && (
            <p>{t("Loading...", "లోడ్ అవుతోంది...")}</p>
          )}

          {screeningHistoryError && (
            <div className="error-message">{screeningHistoryError}</div>
          )}

          {screeningHistory && (
            <div>
              <p>
                {t("Total screenings", "మొత్తం స్క్రీనింగ్స్")}:{" "}
                {screeningHistory.count || 0}
              </p>

              {(screeningHistory.screenings || []).map((item, index) => (
                <div className="history-item" key={item.id || index}>
                  <p>
                    <strong>
                      {item.screening_date || item.created_at || "-"}
                    </strong>
                  </p>
                  <p>
                    {item.finding || item.result || item.status || "-"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // REFERRALS AND APPOINTMENTS PAGE
  const renderReferrals = () => (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <h1>
            {t(
              "Referrals & Appointments",
              "రిఫరల్స్ మరియు అపాయింట్‌మెంట్స్"
            )}
          </h1>
          <p>
            {t(
              "Monitor patient referrals and hospital appointments",
              "రోగుల రిఫరల్స్ మరియు హాస్పిటల్ అపాయింట్‌మెంట్స్ పరిశీలించండి"
            )}
          </p>
        </div>

        <button
          className="refresh-btn"
          onClick={
            referralTab === "referrals"
              ? fetchReferrals
              : fetchAppointments
          }
        >
          ↻ {t("Refresh", "రిఫ్రెష్")}
        </button>
      </div>

      <input
        className="search-input"
        value={referralSearch}
        onChange={(event) => setReferralSearch(event.target.value)}
        placeholder={t(
          "Search referral or patient...",
          "రిఫరల్ లేదా రోగిని వెతకండి..."
        )}
      />

      <div className="tab-buttons">
        <button
          className={referralTab === "referrals" ? "active" : ""}
          onClick={() => {
            setReferralTab("referrals");
            setSelectedReferral(null);
          }}
        >
          {t("Referrals", "రిఫరల్స్")}
        </button>

        <button
          className={referralTab === "appointments" ? "active" : ""}
          onClick={() => {
            setReferralTab("appointments");
            setSelectedReferral(null);
          }}
        >
          {t("Appointments", "అపాయింట్‌మెంట్స్")}
        </button>
      </div>

      {referralError && (
        <div className="error-message">{referralError}</div>
      )}

      {referralLoading && (
        <p>{t("Loading...", "లోడ్ అవుతోంది...")}</p>
      )}

      {!referralLoading && referralTab === "referrals" && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t("Referral Code", "రిఫరల్ కోడ్")}</th>
                <th>{t("Patient", "రోగి")}</th>
                <th>{t("Hospital", "హాస్పిటల్")}</th>
                <th>{t("Specialty", "విభాగం")}</th>
                <th>{t("Priority", "ప్రాధాన్యత")}</th>
                <th>{t("Status", "స్థితి")}</th>
                <th>{t("Action", "చర్య")}</th>
              </tr>
            </thead>

            <tbody>
              {referrals.map((item) => (
                <tr key={item.id}>
                  <td>{item.referral_code || "-"}</td>
                  <td>{item.patient_name || item.patient_code || "-"}</td>
                  <td>{item.hospital_name || "-"}</td>
                  <td>{item.specialty_name || "-"}</td>
                  <td>{item.priority_name || "-"}</td>
                  <td>{item.status || "-"}</td>
                  <td>
                    <button onClick={() => fetchReferralDetails(item.id)}>
                      {t("Details", "వివరాలు")}
                    </button>
                  </td>
                </tr>
              ))}

              {referrals.length === 0 && (
                <tr>
                  <td colSpan="7">
                    {t("No referrals found.", "రిఫరల్స్ లేవు.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!referralLoading && referralTab === "appointments" && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t("Referral Code", "రిఫరల్ కోడ్")}</th>
                <th>{t("Patient", "రోగి")}</th>
                <th>{t("Hospital", "హాస్పిటల్")}</th>
                <th>{t("Specialty", "విభాగం")}</th>
                <th>{t("Scheduled At", "షెడ్యూల్ సమయం")}</th>
                <th>{t("Status", "స్థితి")}</th>
                <th>{t("Attendance", "హాజరు")}</th>
              </tr>
            </thead>

            <tbody>
              {appointments.map((item) => (
                <tr key={item.appointment_id || item.id}>
                  <td>{item.referral_code || "-"}</td>
                  <td>{item.patient_name || item.patient_code || "-"}</td>
                  <td>{item.hospital_name || "-"}</td>
                  <td>{item.specialty_name || "-"}</td>
                  <td>
                    {item.scheduled_at
                      ? new Date(item.scheduled_at).toLocaleString()
                      : "-"}
                  </td>
                  <td>
                    {item.appointment_status_name ||
                      item.appointment_status ||
                      "-"}
                  </td>
                  <td>{item.attendance || "-"}</td>
                </tr>
              ))}

              {appointments.length === 0 && (
                <tr>
                  <td colSpan="7">
                    {t("No appointments found.", "అపాయింట్‌మెంట్స్ లేవు.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {referralDetailsLoading && (
        <p>
          {t(
            "Loading referral details...",
            "రిఫరల్ వివరాలు లోడ్ అవుతున్నాయి..."
          )}
        </p>
      )}

      {selectedReferral && (
        <div className="dashboard-panel">
          <div className="page-heading">
            <h2>{t("Referral Details", "రిఫరల్ వివరాలు")}</h2>

            <button onClick={() => setSelectedReferral(null)}>
              {t("Close", "మూసివేయండి")}
            </button>
          </div>

          <pre>{JSON.stringify(selectedReferral, null, 2)}</pre>
        </div>
      )}
    </div>
  );

  // OTHER PLACEHOLDER PAGES
  const renderPlaceholder = (title) => (
    <div className="dashboard-content">
      <div className="page-heading">
        <h1>{title}</h1>
      </div>

      <div className="empty-state">
        {t(
          "This module is not available yet.",
          "ఈ మాడ్యూల్ ఇంకా అందుబాటులో లేదు."
        )}
      </div>
    </div>
  );

  // MAIN RETURN
  return (
    <div className="district-dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">✚</div>

          <div>
            <h2>Aarogya Drishti</h2>
            <span>
              {t("District Administration", "జిల్లా పరిపాలన")}
            </span>
          </div>
        </div>

        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={
                activePage === item.id
                  ? "menu-item active"
                  : "menu-item"
              }
              onClick={() => handleNavigation(item.id)}
            >
              <span className="menu-icon">{item.icon}</span>
              <span>{isTe ? item.te : item.en}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button onClick={() => changeLanguage(isTe ? "en" : "te")}>
            {isTe ? "English" : "తెలుగు"}
          </button>

          <button
            onClick={() => {
              localStorage.removeItem("aarogyaToken");
              window.location.href = "/";
            }}
          >
            {t("Logout", "లాగ్ అవుట్")}
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <span>{t("Welcome", "స్వాగతం")}</span>
            <strong>{t("District Admin", "జిల్లా అడ్మిన్")}</strong>
          </div>
        </header>

        {activePage === "dashboard" && renderDashboard()}
        {activePage === "review" && renderReviewQueue()}
        {activePage === "patients" && renderPatients()}
        {activePage === "referrals" && renderReferrals()}

        {activePage === "consults" &&
          renderPlaceholder(t("Video Consults", "వీడియో కన్సల్టేషన్స్"))}

        {activePage === "investigations" &&
          renderPlaceholder(t("Investigations", "పరీక్షలు"))}

        {activePage === "followups" &&
          renderPlaceholder(t("Navigator Follow-ups", "ఫాలో-అప్స్"))}

        {activePage === "notifications" &&
          renderPlaceholder(t("Notifications", "నోటిఫికేషన్స్"))}

        {activePage === "users" &&
          renderPlaceholder(t("Users & Roles", "యూజర్స్ మరియు రోల్స్"))}

        {activePage === "audit" &&
          renderPlaceholder(t("Audit Trail", "ఆడిట్ ట్రైల్"))}

        {activePage === "demo" &&
          renderPlaceholder(t("Demo Data", "డెమో డేటా"))}
      </main>
    </div>
  );
}

export default DistrictDashboard;