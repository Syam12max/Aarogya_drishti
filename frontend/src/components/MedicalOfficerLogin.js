import React, { useState, useEffect, useCallback } from "react";

function MedicalOfficerLogin({ language = "en" }) {
  const te = language === "te";

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(
    () => !!sessionStorage.getItem("medicalOfficerToken")
  );

  const [reviews, setReviews] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseDetails, setCaseDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const token = sessionStorage.getItem("medicalOfficerToken");

  const user = (() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("medicalOfficerUser") || "{}"
      );
    } catch {
      return {};
    }
  })();

  const t = {
    title: te ? "మెడికల్ ఆఫీసర్ లాగిన్" : "Medical Officer Login",
    username: te ? "యూజర్ పేరు" : "Username",
    password: te ? "పాస్‌వర్డ్" : "Password",
    login: te ? "లాగిన్" : "Login",
    verifying: te ? "ధృవీకరిస్తోంది..." : "Verifying...",
    failed: te ? "లాగిన్ విఫలమైంది." : "Login failed.",
    logout: te ? "లాగ్అవుట్" : "Logout",
    welcome: te ? "మెడికల్ ఆఫీసర్ డ్యాష్‌బోర్డ్" : "Medical Officer Dashboard",
    queue: te ? "పెండింగ్ రివ్యూ క్యూ" : "Pending Review Queue",
    refresh: te ? "రిఫ్రెష్" : "Refresh",
    loading: te ? "లోడ్ అవుతోంది..." : "Loading...",
    noCases: te ? "పెండింగ్ కేసులు లేవు." : "No pending cases found.",
    patient: te ? "రోగి పేరు" : "Patient Name",
    code: te ? "రోగి కోడ్" : "Patient Code",
    date: te ? "స్క్రీనింగ్ తేదీ" : "Screening Date",
    photos: te ? "ఫోటోలు" : "Photographs",
    findings: te ? "ఫైండింగ్స్" : "Findings",
    ai: te ? "AI ఫలితం" : "AI Result",
    view: te ? "కేసు చూడండి" : "View Case",
    back: te ? "వెనక్కి" : "Back to Queue",
    details: te ? "రోగి కేసు వివరాలు" : "Patient Case Details",
    consent: te ? "కన్సెంట్ వివరాలు" : "Consent Details",
    screeningFindings: te ? "స్క్రీనింగ్ ఫైండింగ్స్" : "Screening Findings",
    photographs: te ? "ఫోటోగ్రాఫ్ వివరాలు" : "Photograph Details",
    aiAssessments: te ? "AI అసెస్‌మెంట్" : "AI Assessments",
    status: te ? "స్టేటస్" : "Status",
    purpose: te ? "పర్పస్" : "Purpose",
    granted: te ? "అనుమతి ఇచ్చారు" : "Granted",
    refused: te ? "అనుమతి ఇవ్వలేదు" : "Not Granted",
    noData: te ? "డేటా అందుబాటులో లేదు." : "No data available.",
    error: te ? "డేటా పొందలేకపోయాము." : "Unable to load data.",
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("medicalOfficerToken");
    sessionStorage.removeItem("medicalOfficerUser");
    setLoggedIn(false);
    setReviews([]);
    setSelectedCase(null);
    setCaseDetails(null);
    setMessage("");
  };

  const loadReviews = useCallback(async () => {
    setLoadingQueue(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/medical-officer/pending-reviews",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setReviews(data.reviews || data.cases || []);
      } else {
        setReviews([]);
        setMessage(data.message || t.error);
      }
    } catch (error) {
      console.error("LOAD REVIEWS ERROR:", error);
      setMessage(t.error);
    } finally {
      setLoadingQueue(false);
    }
  }, [token, t.error]);

  const loadCaseDetails = async (caseId) => {
    setLoadingDetails(true);
    setSelectedCase(caseId);
    setCaseDetails(null);

    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/medical-officer/case/${caseId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setCaseDetails(data.case || data.data || data);
      } else {
        setMessage(data.message || t.error);
      }
    } catch (error) {
      console.error("CASE DETAILS ERROR:", error);
      setMessage(t.error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/medical-officer-login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: formData.username.trim(),
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        const receivedToken =
          data.token || data.accessToken || data.data?.token;

        const receivedUser =
          data.user || data.data?.user || {};

        if (receivedToken) {
          sessionStorage.setItem(
            "medicalOfficerToken",
            receivedToken
          );
        }

        sessionStorage.setItem(
          "medicalOfficerUser",
          JSON.stringify(receivedUser)
        );

        setLoggedIn(true);
        setMessage("");
      } else {
        setMessage(data.message || t.failed);
      }
    } catch (error) {
      console.error("MEDICAL OFFICER LOGIN ERROR:", error);
      setMessage("Unable to connect to server. Please check backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loggedIn) {
      loadReviews();
    }
  }, [loggedIn, loadReviews]);

  if (!loggedIn) {
    return (
      <div style={styles.page}>
        <div style={styles.loginCard}>
          <div style={styles.logo}>🏥</div>

          <h2 style={styles.title}>{t.title}</h2>

          <p style={styles.subtitle}>
            Aarogya Drishti
          </p>

          <form onSubmit={handleSubmit}>
            <div style={styles.field}>
              <label style={styles.label}>
                {t.username}
              </label>

              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username"
                required
                autoComplete="username"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                {t.password}
              </label>

              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                style={styles.input}
              />
            </div>

            {message && (
              <div style={styles.error}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.loginButton,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? t.verifying : t.login}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.headerTitle}>
            🏥 {t.welcome}
          </h2>

          <p style={styles.headerSubtitle}>
            {user.full_name || user.username || "Medical Officer"}
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={styles.logoutButton}
        >
          {t.logout}
        </button>
      </header>

      <main style={styles.main}>
        {message && (
          <div style={styles.error}>
            {message}
          </div>
        )}

        {!selectedCase ? (
          <section>
            <div style={styles.sectionHeader}>
              <h2>{t.queue}</h2>

              <button
                onClick={loadReviews}
                style={styles.refreshButton}
              >
                {t.refresh}
              </button>
            </div>

            {loadingQueue ? (
              <p>{t.loading}</p>
            ) : reviews.length === 0 ? (
              <div style={styles.empty}>
                {t.noCases}
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>{t.patient}</th>
                      <th>{t.code}</th>
                      <th>{t.date}</th>
                      <th>{t.view}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reviews.map((item, index) => (
                      <tr key={item.id || item.case_id || index}>
                        <td>
                          {item.patient_name || item.full_name || "-"}
                        </td>

                        <td>
                          {item.patient_code || item.code || "-"}
                        </td>

                        <td>
                          {item.screening_date
                            ? new Date(item.screening_date).toLocaleDateString()
                            : "-"}
                        </td>

                        <td>
                          <button
                            onClick={() =>
                              loadCaseDetails(
                                item.id || item.case_id
                              )
                            }
                            style={styles.viewButton}
                          >
                            {t.view}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section>
            <button
              onClick={() => {
                setSelectedCase(null);
                setCaseDetails(null);
                setMessage("");
              }}
              style={styles.backButton}
            >
              ← {t.back}
            </button>

            <h2 style={styles.sectionTitle}>
              {t.details}
            </h2>

            {loadingDetails ? (
              <p>{t.loading}</p>
            ) : caseDetails ? (
              <>
                <div style={styles.card}>
                  <h3>{t.patient}</h3>

                  <p>
                    <strong>Name:</strong>{" "}
                    {caseDetails.patient_name ||
                      caseDetails.patient?.full_name ||
                      "-"}
                  </p>

                  <p>
                    <strong>Patient Code:</strong>{" "}
                    {caseDetails.patient_code ||
                      caseDetails.patient?.patient_code ||
                      "-"}
                  </p>

                  <p>
                    <strong>Screening Date:</strong>{" "}
                    {caseDetails.screening_date
                      ? new Date(
                          caseDetails.screening_date
                        ).toLocaleDateString()
                      : "-"}
                  </p>
                </div>

                <div style={styles.card}>
                  <h3>{t.consent}</h3>

                  {caseDetails.consents &&
                  caseDetails.consents.length > 0 ? (
                    caseDetails.consents.map((item, index) => (
                      <div key={item.id || index}>
                        <p>
                          <strong>{t.purpose}:</strong>{" "}
                          {item.purpose || item.consent_purpose || "-"}
                        </p>

                        <p>
                          <strong>{t.status}:</strong>{" "}
                          {item.granted ? t.granted : t.refused}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>{t.noData}</p>
                  )}
                </div>

                <div style={styles.card}>
                  <h3>{t.screeningFindings}</h3>

                  {caseDetails.findings &&
                  caseDetails.findings.length > 0 ? (
                    caseDetails.findings.map((item, index) => (
                      <div key={item.id || index}>
                        <p>
                          <strong>Finding:</strong>{" "}
                          {item.finding || item.symptom || "-"}
                        </p>

                        <p>
                          <strong>Notes:</strong>{" "}
                          {item.notes || "-"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>{t.noData}</p>
                  )}
                </div>

                <div style={styles.card}>
                  <h3>{t.photographs}</h3>

                  {caseDetails.photographs &&
                  caseDetails.photographs.length > 0 ? (
                    caseDetails.photographs.map((item, index) => (
                      <div key={item.id || index}>
                        <p>
                          <strong>Photo:</strong>{" "}
                          {item.file_name || item.file_url || "-"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>{t.noData}</p>
                  )}
                </div>

                <div style={styles.card}>
                  <h3>{t.aiAssessments}</h3>

                  {caseDetails.ai_assessments &&
                  caseDetails.ai_assessments.length > 0 ? (
                    caseDetails.ai_assessments.map((item, index) => (
                      <div key={item.id || index}>
                        <p>
                          <strong>Result:</strong>{" "}
                          {item.result || item.prediction || "-"}
                        </p>

                        <p>
                          <strong>Confidence:</strong>{" "}
                          {item.confidence ?? "-"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>{t.noData}</p>
                  )}
                </div>

                <div style={styles.card}>
                  <h3>Clinical Reviews</h3>

                  {caseDetails.clinical_reviews &&
                  caseDetails.clinical_reviews.length > 0 ? (
                    caseDetails.clinical_reviews.map((item, index) => (
                      <div key={item.id || index}>
                        <p>
                          <strong>Review:</strong>{" "}
                          {item.review_notes || item.notes || "-"}
                        </p>

                        <p>
                          <strong>Decision:</strong>{" "}
                          {item.decision}
                        </p>

                        <p>
                          <strong>Signed:</strong>{" "}
                          {item.signed_at || "Not signed"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>{t.noData}</p>
                  )}
                </div>

                <div
                  style={{
                    ...styles.card,
                    background: "#fff7ed",
                    borderLeft: "4px solid #ea580c",
                  }}
                >
                  <strong>Important:</strong>

                  <p>
                    AI output is demonstration-only and must not be used
                    as a clinical diagnosis. Clinical decision belongs
                    to the Medical Officer.
                  </p>
                </div>
              </>
            ) : (
              <p>{t.noData}</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f1f5f9",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },

  loginCard: {
    width: "100%",
    maxWidth: "420px",
    background: "#ffffff",
    padding: "35px",
    borderRadius: "14px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
  },

  logo: {
    fontSize: "45px",
    textAlign: "center",
    marginBottom: "10px",
  },

  title: {
    textAlign: "center",
    color: "#0f172a",
    marginBottom: "8px",
  },

  subtitle: {
    textAlign: "center",
    color: "#64748b",
    marginBottom: "28px",
  },

  field: {
    marginBottom: "18px",
  },

  label: {
    display: "block",
    fontWeight: "600",
    marginBottom: "8px",
    color: "#334155",
  },

  input: {
    width: "100%",
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    boxSizing: "border-box",
    fontSize: "15px",
    outline: "none",
  },

  loginButton: {
    width: "100%",
    padding: "13px",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "10px",
  },

  error: {
    padding: "12px",
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: "8px",
    marginBottom: "15px",
  },

  dashboard: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "Arial, sans-serif",
  },

  header: {
    background: "#ffffff",
    padding: "18px 30px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    flexWrap: "wrap",
    gap: "12px",
  },

  headerTitle: {
    margin: 0,
    color: "#0f172a",
  },

  headerSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
  },

  logoutButton: {
    padding: "10px 18px",
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },

  main: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "25px",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px",
  },

  sectionTitle: {
    color: "#0f172a",
    marginTop: "20px",
  },

  refreshButton: {
    padding: "10px 18px",
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },

  empty: {
    background: "#ffffff",
    padding: "30px",
    borderRadius: "10px",
    textAlign: "center",
    color: "#64748b",
  },

  tableWrapper: {
    overflowX: "auto",
    background: "#ffffff",
    borderRadius: "10px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },

  viewButton: {
    padding: "8px 14px",
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },

  backButton: {
    padding: "10px 16px",
    background: "#475569",
    color: "#ffffff",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },

  card: {
    background: "#ffffff",
    padding: "22px",
    borderRadius: "10px",
    marginBottom: "18px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
};

export default MedicalOfficerLogin;