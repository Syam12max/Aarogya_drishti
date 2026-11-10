
import React, { useState } from "react";
import "./LoginPage.css";

const API = "http://localhost:5000/api";

function HealthWorkerDashboard({
  language = "en",
  onRegister,
  onPatientSelect
}) {
  const te = language === "te";

  const [activePage, setActivePage] = useState("dashboard");
  const [searchValue, setSearchValue] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Search patients
  const searchPatients = async (e) => {
    e.preventDefault();

    const query = searchValue.trim();

    if (query.length < 2) {
      setMessage(
        te
          ? "కనీసం 2 అక్షరాలు నమోదు చేయండి."
          : "Enter at least 2 characters."
      );
      return;
    }

    const token = sessionStorage.getItem("workerToken");

    if (!token) {
      setMessage(
        te ? "దయచేసి మళ్లీ Login చేయండి." : "Please login again."
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setPatients([]);
      setSelectedPatient(null);

      const response = await fetch(
        `${API}/patients/search?q=${encodeURIComponent(query)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to search patients."
        );
      }

      setPatients(data.patients || []);

      if (!data.patients || data.patients.length === 0) {
        setMessage(
          te ? "రోగుల వివరాలు కనుగొనబడలేదు." : "No patients found."
        );
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Select patient
  const openPatient = (patient) => {
    setSelectedPatient(patient);

    if (typeof onPatientSelect === "function") {
      onPatientSelect(patient);
    }
  };

  // Return to dashboard
  const goBack = () => {
    setActivePage("dashboard");
    setSearchValue("");
    setPatients([]);
    setMessage("");
    setSelectedPatient(null);
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">

        {activePage === "dashboard" && (
          <>
            <h1>
              {te
                ? "హెల్త్ వర్కర్ డాష్‌బోర్డ్"
                : "Health Worker Dashboard"}
            </h1>

            <p>
              {te
                ? "ఆరోగ్య దృష్టికి స్వాగతం"
                : "Welcome to Aarogya Drishti"}
            </p>

            <button type="button" onClick={onRegister}>
              {te
                ? "రోగిని నమోదు చేయండి / వెతకండి"
                : "Register / Search Patient"}
            </button>

            <button
              type="button"
              onClick={() => setActivePage("patients")}
            >
              {te ? "రోగుల వివరాలు" : "Patient Records"}
            </button>

            <button
              type="button"
              onClick={() => setActivePage("followups")}
            >
              {te ? "ఫాలో-అప్ వివరాలు" : "Follow-up Records"}
            </button>
          </>
        )}

        {activePage === "patients" && (
          <div style={{ width: "100%" }}>
            <h2>
              {te ? "రోగుల వివరాలు" : "Patient Records"}
            </h2>

            <p>
              {te
                ? "Patient ID, పేరు లేదా Phone Number ద్వారా వెతకండి."
                : "Search by Patient ID, Name or Phone Number."}
            </p>

            <form onSubmit={searchPatients}>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={
                  te
                    ? "రోగి వివరాలు నమోదు చేయండి"
                    : "Enter Patient ID / Name / Phone"
                }
                style={{
                  width: "100%",
                  padding: 12,
                  marginBottom: 12,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  boxSizing: "border-box"
                }}
              />

              <button type="submit" disabled={loading}>
                {loading
                  ? te ? "వెతుకుతోంది..." : "Searching..."
                  : te ? "వెతకండి" : "Search Patients"}
              </button>
            </form>

            {message && (
              <p style={{ color: "#b45309", marginTop: 12 }}>
                {message}
              </p>
            )}

            {patients.map((patient) => (
              <div
                key={patient.id}
                style={{
                  textAlign: "left",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 14,
                  marginTop: 12,
                  background: "#fff"
                }}
              >
                <h3>{patient.full_name}</h3>

                <p>
                  <strong>Patient ID:</strong>{" "}
                  {patient.patient_code}
                </p>

                <p>
                  <strong>Age:</strong>{" "}
                  {patient.age_years ?? "N/A"}
                </p>

                <p>
                  <strong>Gender:</strong>{" "}
                  {patient.sex || "N/A"}
                </p>

                <p>
                  <strong>Phone:</strong>{" "}
                  {patient.contact_phone || "N/A"}
                </p>

                <button
                  type="button"
                  onClick={() => openPatient(patient)}
                >
                  {te ? "రోగి వివరాలు తెరవండి" : "View Patient"}
                </button>
              </div>
            ))}

            {selectedPatient && (
              <div
                style={{
                  textAlign: "left",
                  marginTop: 15,
                  padding: 14,
                  border: "1px solid #198754",
                  borderRadius: 10
                }}
              >
                <h3>
                  {te ? "ఎంచుకున్న రోగి" : "Selected Patient"}
                </h3>
                <p>{selectedPatient.full_name}</p>
                <p>{selectedPatient.patient_code}</p>
              </div>
            )}

            <button
              type="button"
              onClick={goBack}
              style={{ marginTop: 20 }}
            >
              {te ? "వెనక్కి వెళ్లండి" : "Back to Dashboard"}
            </button>
          </div>
        )}

        {activePage === "followups" && (
          <div style={{ width: "100%" }}>
            <h2>
              {te ? "ఫాలో-అప్ వివరాలు" : "Follow-up Records"}
            </h2>

            <p>
              {te
                ? "ఈ విభాగాన్ని తదుపరి దశలో అభివృద్ధి చేస్తాము."
                : "We will develop this section in the next step."}
            </p>

            <button type="button" onClick={goBack}>
              {te ? "వెనక్కి వెళ్లండి" : "Back to Dashboard"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default HealthWorkerDashboard;
