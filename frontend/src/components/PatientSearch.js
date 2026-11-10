
import React, { useState, useEffect } from "react";
import "./LoginPage.css";
import PatientProfile from "./PatientProfile";
import PatientRegistration from "./PatientRegistration";

function PatientSearch({ language = "en", onBack }) {
  const te = language === "te";

  const [searchValue, setSearchValue] = useState(
    () => sessionStorage.getItem("patientSearchValue") || ""
  );

  const [patients, setPatients] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("selectedPatient") || "null"
      );
    } catch {
      return null;
    }
  });

  const [showRegistration, setShowRegistration] = useState(
    () => sessionStorage.getItem("patientSearchPage") === "registration"
  );

  // Restore search results after refresh
  useEffect(() => {
    try {
      const savedPatients = JSON.parse(
        sessionStorage.getItem("patientSearchResults") || "[]"
      );
      setPatients(savedPatients);
    } catch {
      setPatients([]);
    }
  }, []);

  const openPatient = (patient) => {
    sessionStorage.setItem("selectedPatient", JSON.stringify(patient));
    sessionStorage.setItem("patientSearchPage", "profile");
    setSelectedPatient(patient);
    setShowRegistration(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();

    const value = searchValue.trim();

    if (!value) {
      setMessage(te ? "రోగి వివరాలు నమోదు చేయండి." : "Please enter patient details.");
      setPatients([]);
      return;
    }

    if (value.length < 2) {
      setMessage(te ? "కనీసం 2 అక్షరాలు నమోదు చేయండి." : "Enter at least 2 characters.");
      setPatients([]);
      return;
    }

    const token = sessionStorage.getItem("workerToken");

    if (!token) {
      setMessage(te ? "దయచేసి మళ్లీ Login చేయండి." : "Please login again.");
      setPatients([]);
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setPatients([]);

      sessionStorage.setItem("patientSearchValue", value);
      sessionStorage.setItem("patientSearchPage", "search");
      sessionStorage.removeItem("selectedPatient");

      setSelectedPatient(null);
      setShowRegistration(false);

      const response = await fetch(
        `http://localhost:5000/api/patients/search?q=${encodeURIComponent(value)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setMessage(
          te
            ? "మీ Login గడువు ముగిసింది. మళ్లీ Login చేయండి."
            : "Your login session expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setMessage(data.message || "Patient search failed.");
        return;
      }

      const results = data.patients || [];

      setPatients(results);
      sessionStorage.setItem(
        "patientSearchResults",
        JSON.stringify(results)
      );

      setMessage(
        results.length > 0
          ? ""
          : te
          ? "రోగి వివరాలు కనబడలేదు."
          : "No patients found."
      );
    } catch (error) {
      console.error("Patient Search Error:", error);
      setMessage(
        te
          ? "Server తో కనెక్షన్ కాలేదు."
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  // Patient Registration
  if (showRegistration) {
    return (
      <PatientRegistration
        language={language}
        onBack={() => {
          sessionStorage.setItem("patientSearchPage", "search");
          setShowRegistration(false);
        }}
      />
    );
  }

  // Patient Profile
  if (selectedPatient) {
    return (
      <PatientProfile
        patient={selectedPatient}
        language={language}
        onBack={() => {
          sessionStorage.removeItem("selectedPatient");
          sessionStorage.removeItem(
            `patientPage_${selectedPatient.id}`
          );
          sessionStorage.setItem("patientSearchPage", "search");
          setSelectedPatient(null);
        }}
      />
    );
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>{te ? "రోగిని వెతకండి" : "Search Patient"}</h1>

        <p>Aarogya Drishti</p>

        <form onSubmit={handleSearch}>
          <label>
            {te
              ? "రోగి పేరు / ఫోన్ / Patient ID"
              : "Patient Name / Phone / Patient ID"}
          </label>

          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={
              te
                ? "రోగి వివరాలు నమోదు చేయండి"
                : "Enter patient details"
            }
          />

          <button type="submit" disabled={loading}>
            {loading
              ? te
                ? "వెతుకుతున్నాం..."
                : "Searching..."
              : te
              ? "వెతకండి"
              : "Search"}
          </button>
        </form>

        {message && (
          <div className="admin-login-message">{message}</div>
        )}

        {patients.length > 0 && (
          <div className="patient-search-results">
            <h3>{te ? "రోగుల వివరాలు" : "Search Results"}</h3>

            {patients.map((patient) => (
              <div key={patient.id} className="patient-result-card">
                <h4
                  onClick={() => openPatient(patient)}
                  style={{ cursor: "pointer", color: "#2563eb" }}
                >
                  {patient.full_name}
                </h4>

                <p>
                  <strong>Patient ID:</strong>{" "}
                  <span
                    onClick={() => openPatient(patient)}
                    style={{ cursor: "pointer", color: "#2563eb" }}
                  >
                    {patient.patient_code}
                  </span>
                </p>

                <p>
                  <strong>{te ? "వయస్సు" : "Age"}:</strong>{" "}
                  {patient.age_years ?? "N/A"}
                </p>

                <p>
                  <strong>{te ? "లింగం" : "Sex"}:</strong>{" "}
                  {patient.sex}
                </p>

                <p>
                  <strong>{te ? "ఫోన్" : "Phone"}:</strong>{" "}
                  {patient.contact_phone || "N/A"}
                </p>

                <button
                  type="button"
                  onClick={() => openPatient(patient)}
                >
                  {te ? "పూర్తి వివరాలు చూడండి" : "View Patient Profile"}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem("patientSearchPage", "registration");
            setShowRegistration(true);
          }}
        >
          {te ? "కొత్త రోగిని నమోదు చేయండి" : "Register New Patient"}
        </button>

        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("patientSearchPage");
            onBack();
          }}
        >
          {te ? "వెనక్కి వెళ్లండి" : "Back to Dashboard"}
        </button>
      </div>
    </div>
  );
}

export default PatientSearch;
