
import React, { useState, useEffect } from "react";
import "./LoginPage.css";

function HealthWorkerRegistration({
  language = "en",
  initialRole = "HEALTH_WORKER",
}) {
  const te = language === "te";

  const initialForm = {
    fullName: "",
    username: "",
    phone: "",
    email: "",
    requestedRole: initialRole,
    designation: "ASHA",
    employeeRef: "",
    facilityId: "",
    languageId: "",
    password: "",
    termsAccepted: false,
  };

  const [formData, setFormData] = useState(initialForm);
  const [facilities, setFacilities] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const isHealthWorker = initialRole === "HEALTH_WORKER";

  const roleName = {
    HEALTH_WORKER: te ? "హెల్త్ వర్కర్" : "Health Worker",
    MEDICAL_OFFICER: te ? "మెడికల్ ఆఫీసర్" : "Medical Officer",
    DISTRICT_ADMIN: te ? "జిల్లా అడ్మిన్" : "District Admin",
    SPECIALIST: te ? "స్పెషలిస్ట్" : "Specialist",
    NAVIGATOR: te ? "నావిగేటర్" : "Navigator",
    HOSPITAL_STAFF: te ? "హాస్పిటల్ స్టాఫ్" : "Hospital Staff",
  };

  const t = {
    fullName: te ? "పూర్తి పేరు" : "Full Name",
    username: te ? "యూజర్ పేరు" : "Username",
    phone: te ? "ఫోన్ నంబర్" : "Phone Number",
    email: te ? "ఈమెయిల్" : "Email",
    designation: te ? "హోదా" : "Designation",
    employeeRef: te ? "ఉద్యోగి రిఫరెన్స్" : "Employee Reference",
    facility: te ? "ఆరోగ్య కేంద్రం" : "Facility",
    selectFacility: te ? "ఆరోగ్య కేంద్రాన్ని ఎంచుకోండి" : "Select Facility",
    language: te ? "భాష" : "Language",
    selectLanguage: te ? "భాషను ఎంచుకోండి" : "Select Language",
    password: te ? "పాస్‌వర్డ్" : "Password",
    terms: te ? "నిబంధనలు మరియు షరతులకు అంగీకరిస్తున్నాను" : "I accept Terms and Conditions",
    register: te ? "నమోదు చేయండి" : "Register",
    submitting: te ? "సమర్పిస్తోంది..." : "Submitting...",
    other: te ? "ఇతర" : "Other",
    loading: te ? "లోడ్ అవుతోంది..." : "Loading...",
    noFacilities: te ? "ఆరోగ్య కేంద్రాలు అందుబాటులో లేవు" : "No facilities available",
    noLanguages: te ? "భాషలు అందుబాటులో లేవు" : "No languages available",
    retry: te ? "మళ్లీ ప్రయత్నించండి" : "Retry",
  };

  const loadOptions = async () => {
    setOptionsLoading(true);
    setMessage("");

    try {
      const [facilityRes, languageRes] = await Promise.all([
        fetch("http://localhost:5000/api/auth/facilities"),
        fetch("http://localhost:5000/api/auth/languages"),
      ]);

      if (!facilityRes.ok || !languageRes.ok) {
        throw new Error("Unable to load registration options.");
      }

      const facilityData = await facilityRes.json();
      const languageData = await languageRes.json();

      if (!facilityData.success || !languageData.success) {
        throw new Error("Unable to load registration options.");
      }

      setFacilities(
        Array.isArray(facilityData.facilities)
          ? facilityData.facilities
          : []
      );

      setLanguages(
        Array.isArray(languageData.languages)
          ? languageData.languages
          : []
      );
    } catch (error) {
      console.error("Options loading error:", error);
      setFacilities([]);
      setLanguages([]);
      setMessage(
        te
          ? "ఆరోగ్య కేంద్రాలు లేదా భాషలను లోడ్ చేయలేకపోయాము."
          : "Unable to load facilities or languages."
      );
      setMessageType("error");
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    if (!formData.termsAccepted) {
      setMessage(
        te
          ? "దయచేసి నిబంధనలను అంగీకరించండి."
          : "Please accept Terms and Conditions."
      );
      setMessageType("error");
      return;
    }

    if (!formData.facilityId || !formData.languageId) {
      setMessage(
        te
          ? "దయచేసి ఆరోగ్య కేంద్రం మరియు భాషను ఎంచుకోండి."
          : "Please select a facility and language."
      );
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            (te ? "రిజిస్ట్రేషన్ విఫలమైంది." : "Registration failed.")
        );
      }

      setMessage(
        data.message ||
          (te
            ? "రిజిస్ట్రేషన్ విజయవంతమైంది. అడ్మిన్ అనుమతి కోసం వేచి ఉండండి."
            : "Registration submitted successfully. Awaiting Admin Approval.")
      );

      setMessageType("success");

      setFormData({
        ...initialForm,
        requestedRole: initialRole,
      });
    } catch (error) {
      console.error("Registration error:", error);
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>
          {roleName[initialRole] || "Registration"} Registration
        </h1>

        <p>Aarogya Drishti</p>

        <form onSubmit={handleSubmit}>
          <label>Registration Role</label>
          <input
            type="text"
            value={roleName[initialRole] || initialRole}
            readOnly
          />

          <label>{t.fullName}</label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
          />

          <label>{t.username}</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />

          <label>{t.phone}</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
          />

          <label>{t.email}</label>
          <input
            type="email"
            name="email"
            value={formData.email}
          onChange={handleChange}
          />

          {isHealthWorker && (
            <>
              <label>{t.designation}</label>
              <select
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                required
              >
                <option value="ASHA">ASHA</option>
                <option value="ANM">ANM</option>
                <option value="CHO">CHO</option>
                <option value="OTHER">{t.other}</option>
              </select>
            </>
          )}

          <label>{t.employeeRef}</label>
          <input
            type="text"
            name="employeeRef"
            value={formData.employeeRef}
            onChange={handleChange}
          />

          <label>{t.facility}</label>
          <select
            name="facilityId"
            value={formData.facilityId}
            onChange={handleChange}
            required
            disabled={optionsLoading || facilities.length === 0}
          >
            <option value="">
              {optionsLoading
                ? t.loading
                : facilities.length > 0
                  ? t.selectFacility
                  : t.noFacilities}
            </option>

            {facilities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name_en || item.name || `Facility ${item.id}`}
              </option>
            ))}
          </select>

          <label>{t.language}</label>
          <select
            name="languageId"
            value={formData.languageId}
            onChange={handleChange}
            required
            disabled={optionsLoading || languages.length === 0}
          >
            <option value="">
              {optionsLoading
                ? t.loading
                : languages.length > 0
                  ? t.selectLanguage
                  : t.noLanguages}
            </option>

            {languages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.native_name || item.name_en || `Language ${item.id}`}
              </option>
            ))}
          </select>

          {!optionsLoading &&
            (facilities.length === 0 || languages.length === 0) && (
              <button
                type="button"
                onClick={loadOptions}
                style={{ marginTop: "8px" }}
              >
                {t.retry}
              </button>
            )}

          <label>{t.password}</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            minLength="8"
            required
          />

          <label>
            <input
              type="checkbox"
              name="termsAccepted"
              checked={formData.termsAccepted}
              onChange={handleChange}
              required
            />
            {t.terms}
          </label>

          <button
            type="submit"
            disabled={
              loading ||
              optionsLoading ||
              facilities.length === 0 ||
              languages.length === 0
            }
          >
            {loading ? t.submitting : t.register}
          </button>
        </form>

        {message && (
          <div
            className="admin-login-message"
            style={{
              color: messageType === "error" ? "red" : "green",
              marginTop: "15px",
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default HealthWorkerRegistration;
