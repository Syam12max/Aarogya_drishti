
import React, { useEffect, useState } from "react";

function MedicalOfficerRegistration({ language = "en" }) {
  const [facilities, setFacilities] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const te = language === "te";

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    phone: "",
    email: "",
    designation: "",
    employeeRef: "",
    facilityId: "",
    languageId: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });

  // Load facilities and languages
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [facilityResponse, languageResponse] = await Promise.all([
          fetch("http://localhost:5000/api/auth/facilities"),
          fetch("http://localhost:5000/api/auth/languages"),
        ]);

        const facilityData = await facilityResponse.json();
        const languageData = await languageResponse.json();

        if (!facilityResponse.ok) {
          throw new Error("Unable to load facilities.");
        }

        if (!languageResponse.ok) {
          throw new Error("Unable to load languages.");
        }

        setFacilities(facilityData.facilities || []);
        setLanguages(languageData.languages || []);
      } catch (error) {
        console.error("Dropdown loading error:", error);
        setMessage(error.message || "Unable to load registration options.");
        setMessageType("error");
      } finally {
        setOptionsLoading(false);
      }
    };

    fetchOptions();
  }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Submit registration
  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    if (formData.password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      setMessageType("error");
      return;
    }

    if (!formData.termsAccepted) {
      setMessage("Please accept the terms and conditions.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/medical-officer/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: formData.fullName.trim(),
            username: formData.username.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(),
            designation: formData.designation.trim(),
            employeeRef: formData.employeeRef.trim(),
            facilityId: formData.facilityId,
            languageId: formData.languageId,
            password: formData.password,
            requestedRole: "MEDICAL_OFFICER",
            termsAccepted: formData.termsAccepted,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Registration failed. Please try again."
        );
      }

      setMessage(
        result.message ||
          "Registration submitted successfully. Please wait for System Admin approval."
      );

      setMessageType("success");

      setFormData({
        fullName: "",
        username: "",
        phone: "",
        email: "",
        designation: "",
        employeeRef: "",
        facilityId: "",
        languageId: "",
        password: "",
        confirmPassword: "",
        termsAccepted: false,
      });
    } catch (error) {
      console.error("Registration error:", error);
      setMessage(error.message || "Something went wrong.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">

        <h2>
          {te ? "మెడికల్ ఆఫీసర్ రిజిస్ట్రేషన్" : "Medical Officer Registration"}
        </h2>

        <p>
          {te
            ? "మెడికల్ ఆఫీసర్‌గా నమోదు చేసుకోండి"
            : "Register as a Medical Officer"}
        </p>

        {message && (
          <div
            className={`admin-login-message ${messageType}`}
            role="alert"
          >
            {message}
          </div>
        )}

        {optionsLoading && (
          <p>
            {te ? "వివరాలు లోడ్ అవుతున్నాయి..." : "Loading facilities and languages..."}
          </p>
        )}

        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label>{te ? "పూర్తి పేరు *" : "Full Name *"}</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="form-group">
            <label>{te ? "యూజర్ పేరు *" : "Username *"}</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username"
              required
            />
          </div>

          <div className="form-group">
            <label>{te ? "ఫోన్ నంబర్ *" : "Phone Number *"}</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter 10 digit phone number"
              pattern="[0-9]{10}"
              maxLength="10"
              required
            />
          </div>

          <div className="form-group">
            <label>{te ? "ఈమెయిల్" : "Email"}</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email address"
            />
          </div>

          <div className="form-group">
            <label>{te ? "హోదా *" : "Designation *"}</label>
            <input
              type="text"
              name="designation"
              value={formData.designation}
              onChange={handleChange}
              placeholder="Enter designation"
              required
            />
          </div>

          <div className="form-group">
            <label>
              {te ? "ఉద్యోగి రిఫరెన్స్ ID" : "Employee Reference ID"}
            </label>
            <input
              type="text"
              name="employeeRef"
              value={formData.employeeRef}
              onChange={handleChange}
              placeholder="Enter employee ID"
            />
          </div>

          <div className="form-group">
            <label>{te ? "ఆరోగ్య కేంద్రం *" : "Facility *"}</label>
            <select
              name="facilityId"
              value={formData.facilityId}
              onChange={handleChange}
              required
              disabled={optionsLoading}
            >
              <option value="">
                {te ? "ఆరోగ్య కేంద్రాన్ని ఎంచుకోండి" : "Select Facility"}
              </option>

              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name_en}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{te ? "ప్రాధాన్య భాష *" : "Preferred Language *"}</label>
            <select
              name="languageId"
              value={formData.languageId}
              onChange={handleChange}
              required
              disabled={optionsLoading}
            >
              <option value="">
                {te ? "భాషను ఎంచుకోండి" : "Select Language"}
              </option>

              {languages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name_en || item.native_name || item.code}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{te ? "పాస్‌వర్డ్ *" : "Password *"}</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create password"
              minLength="8"
              required
            />
          </div>

          <div className="form-group">
            <label>{te ? "పాస్‌వర్డ్ నిర్ధారించండి *" : "Confirm Password *"}</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm password"
              minLength="8"
              required
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="termsAccepted"
                checked={formData.termsAccepted}
                onChange={handleChange}
                required
              />
              {" "}
              {te
                ? "నిబంధనలు మరియు షరతులను అంగీకరిస్తున్నాను *"
                : "I accept the Terms and Conditions *"}
            </label>
          </div>

          <button type="submit" disabled={loading || optionsLoading}>
            {loading
              ? "Submitting..."
              : te
              ? "రిజిస్ట్రేషన్ సమర్పించండి"
              : "Submit Registration"}
          </button>

        </form>
      </div>
    </div>
  );
}

export default MedicalOfficerRegistration;
