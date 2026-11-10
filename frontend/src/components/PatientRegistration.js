import React, { useState, useEffect, useCallback, useRef } from "react";
import "./LoginPage.css";

import {
  savePendingPatient,
  getPendingPatients,
  removePendingPatient,
  updatePendingPatientStatus,
} from "./offlinePatientQueue";

const API_URL = "http://localhost:5000/api";

const EMPTY_FORM = {
  full_name: "",
  age_years: "",
  sex: "UNDISCLOSED",
  contact_phone: "",
  village_id: "",
  habitation: "",
  preferred_language_id: "1",
  symptoms: "",
  symptom_duration: "",
  tobacco_exposure_type_id: "",
  tobacco_duration_years: "",
  previous_screening: "",
  previous_referral: "",
};

function PatientRegistration({ language = "en", onBack }) {
  const te = language === "te";

  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);

  const [districtId, setDistrictId] = useState("");
  const [mandalId, setMandalId] = useState("");

  const [districtLoading, setDistrictLoading] = useState(false);
  const [mandalLoading, setMandalLoading] = useState(false);
  const [villageLoading, setVillageLoading] = useState(false);

  const [locationError, setLocationError] = useState("");

  const [formData, setFormData] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [registeredPatient, setRegisteredPatient] = useState(null);

  // Consent states
  const [screeningConsent, setScreeningConsent] = useState("");
  const [imageConsent, setImageConsent] = useState("");
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentMessage, setConsentMessage] = useState("");
  const [consentSaved, setConsentSaved] = useState(false);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const syncingRef = useRef(false);

  // Refresh pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const records = await getPendingPatients();
      setPendingCount(records.length);
      return records;
    } catch (error) {
      console.error("Offline queue error:", error);
      return [];
    }
  }, []);

  // Prepare patient API payload
  const createPatientPayload = (patient) => ({
    ...patient,
    age_years: Number(patient.age_years),
    village_id: Number(patient.village_id),
    preferred_language_id: patient.preferred_language_id
      ? Number(patient.preferred_language_id)
      : null,
    tobacco_exposure_type_id: patient.tobacco_exposure_type_id
      ? Number(patient.tobacco_exposure_type_id)
      : null,
    tobacco_duration_years: patient.tobacco_duration_years
      ? Number(patient.tobacco_duration_years)
      : null,
  });

  // MANUAL SYNC ONLY
  const syncPendingRecords = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncMessage(
        te ? "Internet connection లేదు." : "No network connection."
      );
      return;
    }

    if (syncingRef.current) return;

    const token = sessionStorage.getItem("workerToken");

    if (!token) {
      setSyncMessage(
        te ? "మళ్లీ Login చేయండి." : "Please login again to sync records."
      );
      return;
    }

    syncingRef.current = true;
    setSyncing(true);

    let successCount = 0;
    let failedCount = 0;

    try {
      setSyncMessage(
        te ? "Sync అవుతోంది..." : "Syncing patient records..."
      );

      const records = await getPendingPatients();

      for (const record of records) {
        if (record.status === "SYNCING") {
          await updatePendingPatientStatus(
            record.idempotency_key,
            "PENDING",
            "Previous sync interrupted. Retrying."
          );
        }
      }

      const updatedRecords = await getPendingPatients();

      const pendingRecords = updatedRecords.filter(
        (record) => record.status === "PENDING"
      );

      const reviewRecords = updatedRecords.filter(
        (record) => record.status === "NEEDS_REVIEW"
      );

      if (pendingRecords.length === 0) {
        setSyncMessage(
          reviewRecords.length > 0
            ? `${reviewRecords.length} record(s) need manual review.`
            : "No pending records."
        );
        return;
      }

      for (const record of pendingRecords) {
        try {
          await updatePendingPatientStatus(
            record.idempotency_key,
            "SYNCING"
          );

          const payload = createPatientPayload(record);

          const response = await fetch(
            `${API_URL}/patients/register`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            }
          );

          const data = await response.json();

          if (response.ok && data.success) {
            await removePendingPatient(record.idempotency_key);
            successCount++;
          } else if (
            response.status === 400 ||
            response.status === 409
          ) {
            await updatePendingPatientStatus(
              record.idempotency_key,
              "NEEDS_REVIEW",
              data.message || "Please review patient details."
            );
            failedCount++;
          } else if (
            response.status === 401 ||
            response.status === 403
          ) {
            await updatePendingPatientStatus(
              record.idempotency_key,
              "PENDING",
              "Login expired. Please login again."
            );

            setSyncMessage(
              "Login expired. Please login again and retry."
            );

            failedCount++;
            break;
          } else {
            await updatePendingPatientStatus(
              record.idempotency_key,
              "PENDING",
              data.message || "Server sync failed."
            );
            failedCount++;
          }
        } catch (error) {
          console.error("Sync error:", error);

          await updatePendingPatientStatus(
            record.idempotency_key,
            "PENDING",
            "Network error. Retry when online."
          );

          failedCount++;
        }
      }

      const finalRecords = await refreshPendingCount();

      const remainingPending = finalRecords.filter(
        (record) =>
          record.status === "PENDING" ||
          record.status === "SYNCING"
      ).length;

      const remainingReview = finalRecords.filter(
        (record) => record.status === "NEEDS_REVIEW"
      ).length;

      setSyncMessage(
        `${successCount} synced. ${remainingPending} pending. ${remainingReview} need review.`
      );
    } catch (error) {
      console.error("Sync process error:", error);
      setSyncMessage("Unable to sync records. Please try again.");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshPendingCount();
    }
  }, [te, refreshPendingCount]);

  // Browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncMessage("Connection restored. Click Retry Sync.");
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncMessage("Offline mode. Records will be saved locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load pending count only. No automatic sync.
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Load Districts
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        setDistrictLoading(true);
        setLocationError("");

        const response = await fetch(`${API_URL}/locations/districts`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load districts");
        }

        setDistricts(data.data || []);
      } catch (error) {
        setLocationError(error.message);
      } finally {
        setDistrictLoading(false);
      }
    };

    fetchDistricts();
  }, []);

  // Load Mandals
  useEffect(() => {
    if (!districtId) {
      setMandals([]);
      return;
    }

    const fetchMandals = async () => {
      try {
        setMandalLoading(true);
        setLocationError("");

        const response = await fetch(
          `${API_URL}/locations/mandals/${districtId}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load mandals");
        }

        setMandals(data.data || []);
      } catch (error) {
        setLocationError(error.message);
      } finally {
        setMandalLoading(false);
      }
    };

    fetchMandals();
  }, [districtId]);

  // Load Villages
  useEffect(() => {
    if (!mandalId) {
      setVillages([]);
      return;
    }

    const fetchVillages = async () => {
      try {
        setVillageLoading(true);
        setLocationError("");

        const response = await fetch(
          `${API_URL}/locations/villages/${mandalId}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load villages");
        }

        setVillages(data.data || []);
      } catch (error) {
        setLocationError(error.message);
      } finally {
        setVillageLoading(false);
      }
    };

    fetchVillages();
  }, [mandalId]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleDistrictChange = (e) => {
    setDistrictId(e.target.value);
    setMandalId("");
    setMandals([]);
    setVillages([]);

    setFormData((prev) => ({
      ...prev,
      village_id: "",
    }));
  };

  const handleMandalChange = (e) => {
    setMandalId(e.target.value);
    setVillages([]);

    setFormData((prev) => ({
      ...prev,
      village_id: "",
    }));
  };

  const handleVillageChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      village_id: e.target.value,
    }));
  };

  // Register patient
  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setRegisteredPatient(null);

    const token = sessionStorage.getItem("workerToken");

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    if (!districtId || !mandalId || !formData.village_id) {
      setMessage("Please select district, mandal and village.");
      return;
    }

    if (!formData.full_name.trim() || !formData.age_years) {
      setMessage("Enter patient name and age.");
      return;
    }

    try {
      setLoading(true);

      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `patient-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const patientPayload = createPatientPayload({
        ...formData,
        full_name: formData.full_name.trim(),
        idempotency_key: idempotencyKey,
        client_created_at: new Date().toISOString(),
      });

      if (!navigator.onLine) {
        await savePendingPatient(patientPayload);
        await refreshPendingCount();

        setMessage("Offline: Patient details saved locally.");

        setFormData(EMPTY_FORM);
        setDistrictId("");
        setMandalId("");
        setMandals([]);
        setVillages([]);

        return;
      }

      const response = await fetch(
        `${API_URL}/patients/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patientPayload),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        const patient = data.patient || data.data || data;

        setRegisteredPatient({
          ...patient,
          preferred_language_id:
            patient.preferred_language_id ||
            patient.language_id ||
            patientPayload.preferred_language_id,
        });

        setMessage("Patient registered successfully.");
      } else {
        throw new Error(data.message || "Registration failed.");
      }
    } catch (error) {
      console.error("Patient registration error:", error);

      if (!navigator.onLine || error instanceof TypeError) {
        try {
          const patientPayload = createPatientPayload({
            ...formData,
            full_name: formData.full_name.trim(),
            idempotency_key: `patient-${Date.now()}`,
            client_created_at: new Date().toISOString(),
          });

          await savePendingPatient(patientPayload);
          await refreshPendingCount();

          setMessage(
            "Network error. Patient details saved for later synchronization."
          );
        } catch (queueError) {
          setMessage(queueError.message || "Unable to save patient.");
        }
      } else {
        setMessage(error.message || "Registration failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Save actual consent decisions
  const handleConsentSubmit = async (e) => {
    e.preventDefault();
    setConsentMessage("");

    const token = sessionStorage.getItem("workerToken");
    const patientId =
      registeredPatient?.id || registeredPatient?.patient_id;

    if (!token) {
      setConsentMessage("Please login again.");
      return;
    }

    if (!patientId) {
      setConsentMessage(
        "Patient ID missing from registration response. Please check backend response."
      );
      return;
    }

    if (!screeningConsent || !imageConsent) {
      setConsentMessage("Please record both consent decisions.");
      return;
    }

    try {
      setConsentSaving(true);

      const languageId = Number(
        registeredPatient.preferred_language_id ||
          formData.preferred_language_id ||
          1
      );

      const choices = [
        {
          purpose_id: 1,
          granted: screeningConsent === "yes",
        },
        {
          purpose_id: 2,
          granted: imageConsent === "yes",
        },
      ];

      for (const choice of choices) {
        const response = await fetch(
          `${API_URL}/patients/${patientId}/consents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              purpose_id: choice.purpose_id,
              language_id: languageId,
              granted: choice.granted,
              confirmed: true,
              method: "CHECKBOX",
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to save patient consent."
          );
        }
      }

      setConsentSaved(true);
      setConsentMessage(
        "Patient consent decisions saved successfully."
      );
    } catch (error) {
      console.error("Consent save error:", error);
      setConsentMessage(
        error.message || "Unable to save consent."
      );
    } finally {
      setConsentSaving(false);
    }
  };

  // Registration success and consent form
  if (registeredPatient) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h1>
            {te ? "నమోదు విజయవంతమైంది" : "Registration Successful"}
          </h1>

          <p>{message}</p>

          <h3>
            Patient ID: {registeredPatient.patient_code || "Created"}
          </h3>

          {!consentSaved ? (
            <form onSubmit={handleConsentSubmit}>
              <hr />

              <h2>
                {te ? "రోగి సమ్మతి" : "Patient Consent"}
              </h2>

              <p>
                {te
                  ? "ప్రతి అంశాన్ని రోగికి వివరించి వారి నిజమైన నిర్ణయాన్ని నమోదు చేయండి."
                  : "Explain each purpose to the patient and record their actual decision."}
              </p>

              <label>
                {te ? "సమ్మతి భాష" : "Consent Language"}
              </label>

              <select
                value={
                  registeredPatient.preferred_language_id ||
                  formData.preferred_language_id
                }
                disabled
              >
                <option value="1">English</option>
                <option value="2">తెలుగు (Telugu)</option>
              </select>

              <label>
                {te
                  ? "స్క్రీనింగ్ సమ్మతి (SCREENING)"
                  : "Screening Consent (SCREENING)"}
              </label>

              <select
                value={screeningConsent}
                onChange={(e) => setScreeningConsent(e.target.value)}
                required
              >
                <option value="">
                  {te ? "నిర్ణయం ఎంచుకోండి" : "Select decision"}
                </option>

                <option value="yes">
                  {te ? "అవును — సమ్మతి ఇచ్చారు" : "Yes — Consent granted"}
                </option>

                <option value="no">
                  {te ? "కాదు — సమ్మతి ఇవ్వలేదు" : "No — Consent not granted"}
                </option>
              </select>

              <label>
                {te
                  ? "చిత్రాల సేకరణ సమ్మతి (IMAGE_CAPTURE)"
                  : "Image Capture Consent (IMAGE_CAPTURE)"}
              </label>

              <select
                value={imageConsent}
                onChange={(e) => setImageConsent(e.target.value)}
                required
              >
                <option value="">
                  {te ? "నిర్ణయం ఎంచుకోండి" : "Select decision"}
                </option>

                <option value="yes">
                  {te ? "అవును — సమ్మతి ఇచ్చారు" : "Yes — Consent granted"}
                </option>

                <option value="no">
                  {te ? "కాదు — సమ్మతి ఇవ్వలేదు" : "No — Consent not granted"}
                </option>
              </select>

              <button
                type="submit"
                disabled={consentSaving}
              >
                {consentSaving
                  ? te
                    ? "సేవ్ అవుతోంది..."
                    : "Saving consent..."
                  : te
                    ? "సమ్మతి నిర్ణయాలను సేవ్ చేయండి"
                    : "Save Consent Decisions"}
              </button>
            </form>
          ) : (
            <p>{consentMessage}</p>
          )}

          {consentMessage && (
            <p className="admin-login-message">
              {consentMessage}
            </p>
          )}

          <button
            type="button"
            onClick={onBack}
            disabled={!consentSaved}
          >
            {te
              ? "రోగి శోధనకు తిరిగి వెళ్ళండి"
              : "Back to Patient Search"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>
          {te ? "కొత్త రోగి నమోదు" : "New Patient Registration"}
        </h1>

        <p>Aarogya Drishti</p>

        {/* Online / Offline status */}
        <div
          style={{
            padding: "10px",
            marginBottom: "12px",
            borderRadius: "8px",
            background: isOnline ? "#e8f5e9" : "#fff3cd",
            color: isOnline ? "#1b5e20" : "#856404",
            fontWeight: "bold",
          }}
        >
          {isOnline ? "● Online" : "● Offline Mode"}
        </div>

        {/* Pending records */}
        <div
          style={{
            padding: "10px",
            marginBottom: "12px",
            background: "#eef3ff",
            borderRadius: "8px",
          }}
        >
          <strong>Pending Records: {pendingCount}</strong>

          {syncMessage && (
            <p style={{ marginBottom: "0" }}>{syncMessage}</p>
          )}

          {isOnline && pendingCount > 0 && (
            <button
              type="button"
              onClick={syncPendingRecords}
              disabled={syncing}
              style={{ marginTop: "8px" }}
            >
              {syncing ? "Syncing..." : "Retry Sync"}
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <h3>
            {te ? "వ్యక్తిగత వివరాలు" : "Personal Details"}
          </h3>

          <label>Full Name</label>
          <input
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="Enter patient name"
            minLength={2}
            maxLength={150}
            required
          />

          <label>Age</label>
          <input
            type="number"
            name="age_years"
            value={formData.age_years}
            onChange={handleChange}
            placeholder="Enter age"
            min="0"
            max="120"
            required
          />

          <label>Sex</label>
          <select
            name="sex"
            value={formData.sex}
            onChange={handleChange}
            required
          >
            <option value="UNDISCLOSED">Prefer not to say</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>

          <label>Contact Phone</label>
          <input
            type="tel"
            name="contact_phone"
            value={formData.contact_phone}
            onChange={handleChange}
            placeholder="Enter phone number"
            required
          />

          <hr />

          <h3>
            {te ? "చిరునామా వివరాలు" : "Location Details"}
          </h3>

          <label>District</label>
          <select
            value={districtId}
            onChange={handleDistrictChange}
            required
          >
            <option value="">
              {districtLoading ? "Loading districts..." : "Select District"}
            </option>

            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {te && district.name_te
                  ? district.name_te
                  : district.name_en}
              </option>
            ))}
          </select>

          <label>Mandal</label>
          <select
            value={mandalId}
            onChange={handleMandalChange}
            disabled={!districtId || mandalLoading}
            required
          >
            <option value="">
              {mandalLoading ? "Loading mandals..." : "Select Mandal"}
            </option>

            {mandals.map((mandal) => (
              <option key={mandal.id} value={mandal.id}>
                {te && mandal.name_te
                  ? mandal.name_te
                  : mandal.name_en}
              </option>
            ))}
          </select>

          <label>Village</label>
          <select
            name="village_id"
            value={formData.village_id}
            onChange={handleVillageChange}
            disabled={!mandalId || villageLoading}
            required
          >
            <option value="">
              {villageLoading ? "Loading villages..." : "Select Village"}
            </option>

            {villages.map((village) => (
              <option key={village.id} value={village.id}>
                {te && village.name_te
                  ? village.name_te
                  : village.name_en}
              </option>
            ))}
          </select>

          {locationError && (
            <p className="admin-login-message">
              {locationError}
            </p>
          )}

          <label>Habitation</label>
          <input
            type="text"
            name="habitation"
            value={formData.habitation}
            onChange={handleChange}
            placeholder="Enter habitation"
          />

          <label>Preferred Language</label>
          <select
            name="preferred_language_id"
            value={formData.preferred_language_id}
            onChange={handleChange}
          >
            <option value="1">English</option>
            <option value="2">Telugu</option>
          </select>

          <hr />

          <h3>
            {te ? "వైద్య చరిత్ర" : "Medical History"}
          </h3>

          <label>Symptoms</label>
          <textarea
            name="symptoms"
            value={formData.symptoms}
            onChange={handleChange}
            placeholder="Mouth ulcers, pain, white patches..."
          />

          <label>Symptom Duration</label>
          <input
            type="text"
            name="symptom_duration"
            value={formData.symptom_duration}
            onChange={handleChange}
            placeholder="Example: 2 weeks"
          />

          <label>Tobacco / Exposure Type</label>
          <select
            name="tobacco_exposure_type_id"
            value={formData.tobacco_exposure_type_id}
            onChange={handleChange}
          >
            <option value="">No / Not reported</option>
            <option value="1">Smoked Tobacco</option>
            <option value="2">Smokeless Tobacco</option>
            <option value="3">Gutkha</option>
            <option value="4">Reverse Smoking</option>
            <option value="5">Areca Nut</option>
            <option value="6">Alcohol</option>
          </select>

          <label>Usage Duration (Years)</label>
          <input
            type="number"
            name="tobacco_duration_years"
            value={formData.tobacco_duration_years}
            onChange={handleChange}
            min="0"
            max="120"
            placeholder="Enter years"
          />

          <label>Previous Screening</label>
          <select
            name="previous_screening"
            value={formData.previous_screening}
            onChange={handleChange}
          >
            <option value="">Not reported</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Unknown">Unknown</option>
          </select>

          <label>Previous Referral</label>
          <select
            name="previous_referral"
            value={formData.previous_referral}
            onChange={handleChange}
          >
            <option value="">Not reported</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Unknown">Unknown</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Registering..." : "Register Patient"}
          </button>
        </form>

        {message && (
          <div className="admin-login-message">
            {message}
          </div>
        )}

        <button type="button" onClick={onBack}>
          Back to Patient Search
        </button>
      </div>
    </div>
  );
}

export default PatientRegistration;