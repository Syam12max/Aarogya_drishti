import React, { useEffect, useRef, useState } from "react";
import "./LoginPage.css";

const API = "http://localhost:5000/api";

function PatientProfile({ patient, language = "en", onBack }) {
  const te = language === "te";
  const patientId = patient?.id;

  const storageKey = name => `${name}_${patientId}`;

  const readStorage = (name, fallback) => {
    try {
      const value = sessionStorage.getItem(storageKey(name));
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const [profile, setProfile] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Page restoration
  const [showConsent, setShowConsent] = useState(
    () => sessionStorage.getItem(`patientPage_${patientId}`) === "consent"
  );

  const [showScreening, setShowScreening] = useState(
    () => sessionStorage.getItem(`patientPage_${patientId}`) === "screening"
  );

  // Consent
  const [consents, setConsents] = useState([]);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [savingPurpose, setSavingPurpose] = useState(null);
  const [consentMethod, setConsentMethod] = useState("CHECKBOX");
  const [witnessName, setWitnessName] = useState("");
  const [confirmations, setConfirmations] = useState({});

  // Screening
  const [screening, setScreening] = useState(
    () => readStorage("patientScreening", null)
  );

  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningMessage, setScreeningMessage] = useState("");

  // AI demonstration assessment
  const [aiLoadingPhotoId, setAiLoadingPhotoId] = useState(null);
  const [aiAssessments, setAiAssessments] = useState({});
  const [aiError, setAiError] = useState("");

  const [tobaccoCurrent, setTobaccoCurrent] = useState(
    () => readStorage("screeningForm", {}).tobaccoCurrent || "unknown"
  );

  const [chiefComplaint, setChiefComplaint] = useState(
    () => readStorage("screeningForm", {}).chiefComplaint || ""
  );

  const [screeningNotes, setScreeningNotes] = useState(
    () => readStorage("screeningForm", {}).screeningNotes || ""
  );

  // Findings
  const [findingKind, setFindingKind] = useState(
    () => readStorage("screeningForm", {}).findingKind || "SYMPTOM"
  );

  const [findingDescription, setFindingDescription] = useState(
    () => readStorage("screeningForm", {}).findingDescription || ""
  );

  const [findingDuration, setFindingDuration] = useState(
    () => readStorage("screeningForm", {}).findingDuration || "14"
  );

  const [oralSite, setOralSite] = useState(
    () => readStorage("screeningForm", {}).oralSite || ""
  );

  const [findingLoading, setFindingLoading] = useState(false);

  const [savedFindings, setSavedFindings] = useState(
    () => readStorage("savedFindings", [])
  );

  // Photograph capture
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoView, setPhotoView] = useState("CHEEK_LINING");
  const [annotationSite, setAnnotationSite] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [savedPhotos, setSavedPhotos] = useState(
    () => readStorage("screeningPhotos", [])
  );
  const [retakePhotoId, setRetakePhotoId] = useState(null);

  const getToken = () => {
    const value = sessionStorage.getItem("workerToken");

    if (!value) {
      throw new Error(te ? "మళ్లీ Login చేయండి." : "Please login again.");
    }

    return value;
  };

  const historyLabels = {
    CONDITION: te ? "లక్షణాలు" : "Symptoms",
    EXPOSURE: te ? "పొగాకు / ఇతర అలవాట్లు" : "Exposure History",
    PRIOR_SCREENING: te ? "మునుపటి స్క్రీనింగ్" : "Previous Screening",
    PRIOR_REFERRAL: te ? "మునుపటి రిఫరల్" : "Previous Referral"
  };

  const oralSites = [
    ["CHEEK_LINING", "Cheek lining", "చెంప లోపలి భాగం"],
    ["TONGUE", "Tongue", "నాలుక"],
    ["PALATE", "Palate", "అంగిలి"],
    ["GUMS", "Gums", "చిగుళ్లు"],
    ["FLOOR_OF_MOUTH", "Floor of mouth", "నోటి అడుగు భాగం"],
    ["OTHER", "Other", "ఇతర"]
  ];

  const t = {
    profile: te ? "రోగి పూర్తి వివరాలు" : "Patient Profile",
    personal: te ? "వ్యక్తిగత వివరాలు" : "Personal Information",
    history: te ? "వైద్య చరిత్ర" : "Medical History",
    consent: te ? "సమ్మతి నిర్వహణ" : "Consent Management",
    back: te ? "వెనక్కి వెళ్లండి" : "Back to Search",
    screening: te ? "నోటి ఆరోగ్య పరీక్ష" : "Oral Screening",
    start: te ? "స్క్రీనింగ్ ప్రారంభించండి" : "Start Oral Screening",
    complaint: te ? "ప్రధాన సమస్య" : "Chief Complaint",
    tobacco: te ? "ప్రస్తుత పొగాకు వినియోగం" : "Current Tobacco Use",
    notes: te ? "పరీక్ష గమనికలు" : "Screening Notes",
    symptom: te ? "లక్షణం" : "Symptom",
    examination: te ? "నోటి పరీక్ష ఫలితం" : "Examination Finding",
    description: te ? "వివరణ" : "Description",
    duration: te ? "వ్యవధి (రోజులు)" : "Duration (Days)",
    oralSite: te ? "నోటి భాగం" : "Oral Site",
    saveFinding: te ? "ఫలితాన్ని సేవ్ చేయండి" : "Save Finding",
    saved: te ? "నమోదైన వివరాలు" : "Saved Findings",
    loading: te ? "లోడ్ అవుతోంది..." : "Loading..."
  };

  // Stop camera safely
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Restore current page
  useEffect(() => {
    if (!patientId) return;

    const page = showConsent
      ? "consent"
      : showScreening
        ? "screening"
        : "profile";

    sessionStorage.setItem(`patientPage_${patientId}`, page);
  }, [patientId, showConsent, showScreening]);

  // Persist screening
  useEffect(() => {
    if (!patientId) return;

    sessionStorage.setItem(
      storageKey("patientScreening"),
      JSON.stringify(screening)
    );
  }, [screening, patientId]);

  // Persist screening form
  useEffect(() => {
    if (!patientId) return;

    sessionStorage.setItem(
      storageKey("screeningForm"),
      JSON.stringify({
        tobaccoCurrent,
        chiefComplaint,
        screeningNotes,
        findingKind,
        findingDescription,
        findingDuration,
        oralSite
      })
    );
  }, [
    patientId,
    tobaccoCurrent,
    chiefComplaint,
    screeningNotes,
    findingKind,
    findingDescription,
    findingDuration,
    oralSite
  ]);

  useEffect(() => {
    if (!patientId) return;

    sessionStorage.setItem(
      storageKey("savedFindings"),
      JSON.stringify(savedFindings)
    );
  }, [savedFindings, patientId]);

  useEffect(() => {
    if (!patientId) return;

    sessionStorage.setItem(
      storageKey("screeningPhotos"),
      JSON.stringify(savedPhotos)
    );
  }, [savedPhotos, patientId]);

  // Load profile
  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      try {
        const response = await fetch(
          `${API}/patients/profile/${patientId}`,
          {
            headers: {
              Authorization: `Bearer ${getToken()}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load profile.");
        }

        if (active) {
          setProfile(data.patient);
          setMedicalHistory(data.medicalHistory || []);
        }
      } catch (error) {
        if (active) setMessage(error.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (patientId) {
      fetchProfile();
    } else {
      setLoading(false);
      setMessage("Patient ID not available.");
    }

    return () => {
      active = false;
    };
  }, [patientId]);

  // Consent API
  const fetchConsents = async () => {
    try {
      setConsentLoading(true);
      setConsentError("");

      const response = await fetch(
        `${API}/patients/${patientId}/consents`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load consent details.");
      }

      setConsents(data.consents || []);
    } catch (error) {
      setConsentError(error.message);
    } finally {
      setConsentLoading(false);
    }
  };

  useEffect(() => {
    if (showConsent && patientId) fetchConsents();
  }, [showConsent, patientId]);

  // Save consent
  const saveConsent = async (purpose, granted) => {
    try {
      setSavingPurpose(purpose.purpose_id);
      setConsentError("");

      if (granted && !confirmations[purpose.purpose_id]) {
        throw new Error(
          te
            ? "రోగి అంగీకారాన్ని ముందుగా నిర్ధారించండి."
            : "Confirm that the patient has actually agreed before recording consent."
        );
      }

      if (
        consentMethod === "VERBAL_WITNESSED" &&
        !witnessName.trim()
      ) {
        throw new Error(te ? "సాక్షి పేరు నమోదు చేయండి." : "Enter witness name.");
      }

      const response = await fetch(
        `${API}/patients/${patientId}/consents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            purpose_id: purpose.purpose_id,
            language_id: te ? 2 : 1,
            granted,
            confirmed: true,
            method: consentMethod,
            witness_name:
              consentMethod === "VERBAL_WITNESSED"
                ? witnessName.trim()
                : null
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save consent.");
      }

      setConfirmations(previous => ({
        ...previous,
        [purpose.purpose_id]: false
      }));

      setWitnessName("");
      await fetchConsents();

      setConsentError(data.message || "Consent recorded successfully.");
    } catch (error) {
      setConsentError(error.message);
    } finally {
      setSavingPurpose(null);
    }
  };

  // Start screening
  const startScreening = async () => {
    try {
      setScreeningLoading(true);
      setScreeningMessage("");

      const response = await fetch(
        `${API}/screenings/${patientId}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            idempotency_key: crypto.randomUUID(),
            tobacco_current:
              tobaccoCurrent === "unknown"
                ? null
                : tobaccoCurrent === "yes",
            chief_complaint: chiefComplaint.trim(),
            notes: screeningNotes.trim()
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to start screening.");
      }

      setScreening(data.screening);

      setScreeningMessage(
        te ? "స్క్రీనింగ్ ప్రారంభమైంది." : "Screening started successfully."
      );
    } catch (error) {
      setScreeningMessage(error.message);
    } finally {
      setScreeningLoading(false);
    }
  };

  // Save finding
  const saveFinding = async event => {
    event.preventDefault();

    if (!screening?.id) {
      setScreeningMessage("Start screening first.");
      return;
    }

    if (!findingDescription.trim()) {
      setScreeningMessage("Enter a finding description.");
      return;
    }

    if (
      findingKind === "SYMPTOM" &&
      (
        findingDuration === "" ||
        !Number.isInteger(Number(findingDuration)) ||
        Number(findingDuration) < 0
      )
    ) {
      setScreeningMessage("Enter a valid symptom duration.");
      return;
    }

    try {
      setFindingLoading(true);
      setScreeningMessage("");

      const response = await fetch(
        `${API}/screenings/${screening.id}/findings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            finding_kind: findingKind,
            symptom_id: null,
            oral_site: oralSite || null,
            description: findingDescription.trim(),
            duration_days:
              findingKind === "SYMPTOM"
                ? Number(findingDuration)
                : null
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save finding.");
      }

      setSavedFindings(previous => [...previous, data.finding]);

      setFindingDescription("");
      setFindingDuration("");
      setOralSite("");

      setScreeningMessage(
        te
          ? "వివరాలు విజయవంతంగా సేవ్ అయ్యాయి."
          : "Finding saved successfully."
      );
    } catch (error) {
      setScreeningMessage(error.message);
    } finally {
      setFindingLoading(false);
    }
  };

  // Start in-app camera
  const startCamera = async () => {
    try {
      setCameraError("");
      setPhotoMessage("");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera is unavailable. Use localhost or HTTPS and allow camera access."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });

      streamRef.current = stream;
      setCameraOpen(true);

      // Attach stream after React renders the video element.
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (error) {
      setCameraError(
        error.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access in your browser settings."
          : error.message || "Unable to open camera."
      );
    }
  };

  // Capture photo from camera
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth) {
      setCameraError("Camera is not ready. Please try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) {
        setCameraError("Unable to capture photograph.");
        return;
      }

      const file = new File(
        [blob],
        `oral-photo-${Date.now()}.jpg`,
        { type: "image/jpeg" }
      );

      setCapturedPhoto({
        file,
        preview: URL.createObjectURL(blob)
      });

      setCameraError("");
      stopCamera();
    }, "image/jpeg", 0.92);
  };

  // Select a photo using device camera or file picker
  const handlePhotoFile = event => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoMessage("Select a JPEG, PNG or WEBP photograph.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPhotoMessage("Photograph must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (capturedPhoto?.preview) {
      URL.revokeObjectURL(capturedPhoto.preview);
    }

    setCapturedPhoto({
      file,
      preview: URL.createObjectURL(file)
    });

    setCameraError("");
    setPhotoMessage("");
  };

  // Retake photograph
  const retakePhoto = () => {
    if (capturedPhoto?.preview) {
      URL.revokeObjectURL(capturedPhoto.preview);
    }

    setCapturedPhoto(null);
    setPhotoMessage("");
    startCamera();
  };

  // Upload photograph to private backend storage
  const uploadPhoto = async () => {
    if (!screening?.id || !capturedPhoto?.file) {
      setPhotoMessage("Start screening and capture a photograph first.");
      return;
    }

    try {
      setPhotoUploading(true);
      setPhotoMessage("");

      const formData = new FormData();

      formData.append("photo", capturedPhoto.file);
      formData.append("view_type", photoView);
      formData.append("annotation_site", annotationSite.trim());

      if (retakePhotoId) {
        formData.append("supersedes_photo_id", retakePhotoId);
      }

      const response = await fetch(
        `${API}/screenings/${screening.id}/photos`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`
          },
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Photo upload failed.");
      }

      setSavedPhotos(previous => [
        ...previous,
        {
          id: data.photo.id,
          view_type: data.photo.view_type,
          status: data.photo.status,
          quality: data.quality
        }
      ]);

      setPhotoMessage(
        data.quality.status === "ACCEPTABLE"
          ? "Photograph saved. Technical quality check passed."
          : `Photograph saved, but recapture is recommended: ${data.quality.reason}.`
      );

      URL.revokeObjectURL(capturedPhoto.preview);
      setCapturedPhoto(null);
      setRetakePhotoId(null);
      setAnnotationSite("");

    } catch (error) {
      setPhotoMessage(error.message);
    } finally {
      setPhotoUploading(false);
    }
  };

  // Request AI demonstration assessment
  const requestAIAssessment = async photo => {
    if (!screening?.id) {
      setAiError("Start screening first.");
      return;
    }

    if (
      photo?.quality?.status !== "ACCEPTABLE" ||
      photo?.status !== "ACCEPTED"
    ) {
      setAiError(
        "AI demonstration assessment is available only for photos marked ACCEPTABLE."
      );
      return;
    }

    try {
      setAiLoadingPhotoId(photo.id);
      setAiError("");

      const response = await fetch(
        `${API}/screenings/${screening.id}/ai-assessments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },
          body: JSON.stringify({ photo_id: photo.id })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to create AI demonstration assessment."
        );
      }

      setAiAssessments(previous => ({
        ...previous,
        [photo.id]: data
      }));
    } catch (error) {
      setAiError(error.message || "AI demonstration assessment failed.");
    } finally {
      setAiLoadingPhotoId(null);
    }
  };

  const getPurposeName = purpose =>
    te && purpose.name_te ? purpose.name_te : purpose.name_en;

  const getPurposeText = purpose =>
    te && purpose.text_te ? purpose.text_te : purpose.text_en;

  // Loading screen
  if (loading) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h2>{t.loading}</h2>
        </div>
      </div>
    );
  }

  // Error screen
  if (message) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h2>{message}</h2>
          <button type="button" onClick={onBack}>
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // CONSENT MANAGEMENT PAGE
  // ========================================

  if (showConsent) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h1>
            {te ? "రోగి సమ్మతి నిర్వహణ" : "Patient Consent Management"}
          </h1>

          <p>Aarogya Drishti</p>

          <h3>{profile?.full_name}</h3>

          <p>
            <strong>Patient ID:</strong> {profile?.patient_code}
          </p>

          <hr />

          <h3>{te ? "సమ్మతి పద్ధతి" : "Consent Method"}</h3>

          <select
            value={consentMethod}
            onChange={event => setConsentMethod(event.target.value)}
          >
            <option value="CHECKBOX">Checkbox</option>
            <option value="VERBAL_WITNESSED">Verbal Witnessed</option>
            <option value="SIGNATURE">Signature</option>
            <option value="THUMBPRINT">Thumbprint</option>
          </select>

          {consentMethod === "VERBAL_WITNESSED" && (
            <>
              <label>
                {te ? "సాక్షి పేరు" : "Witness Name"}
              </label>

              <input
                value={witnessName}
                onChange={event => setWitnessName(event.target.value)}
                placeholder="Enter witness name"
              />
            </>
          )}

          <hr />

          <h3>
            {te ? "సమ్మతి ప్రయోజనాలు" : "Consent Purposes"}
          </h3>

          {consentLoading && <p>{t.loading}</p>}

          {consentError && (
            <p style={{ color: "red" }}>{consentError}</p>
          )}

          {consents.map(purpose => (
            <div
              key={purpose.purpose_id}
              className="patient-result-card"
              style={{
                marginBottom: 16,
                padding: 15,
                textAlign: "left"
              }}
            >
              <h3>{getPurposeName(purpose)}</h3>

              <p>{getPurposeText(purpose)}</p>

              <p>
                <strong>
                  {te ? "అవసరమైన సమ్మతి" : "Required"}:
                </strong>{" "}
                {purpose.is_required ? "Yes" : "Optional"}
              </p>

              <p>
                <strong>
                  {te ? "ప్రస్తుత స్థితి" : "Current Status"}:
                </strong>{" "}
                {purpose.granted === true
                  ? "Granted"
                  : purpose.granted === false
                    ? "Not Granted"
                    : "Not Recorded"}
              </p>

              {purpose.captured_at && (
                <p>
                  <strong>Recorded At:</strong>{" "}
                  {new Date(purpose.captured_at).toLocaleString()}
                </p>
              )}

              {/* CONSENT CONFIRMATION CHECKBOX */}
              <label style={{ display: "block", margin: "12px 0" }}>
                <input
                  type="checkbox"
                  checked={!!confirmations[purpose.purpose_id]}
                  onChange={event =>
                    setConfirmations(previous => ({
                      ...previous,
                      [purpose.purpose_id]: event.target.checked
                    }))
                  }
                />{" "}
                {te
                  ? "రోగి ఈ ప్రయోజనానికి అంగీకరించారని నిర్ధారిస్తున్నాను."
                  : "I confirm that the patient has actually agreed to this purpose."}
              </label>

              {/* GRANTED BUTTON - CHECKBOX REQUIRED */}
              <button
                type="button"
                disabled={
                  savingPurpose !== null ||
                  !confirmations[purpose.purpose_id]
                }
                onClick={() => saveConsent(purpose, true)}
              >
                {savingPurpose === purpose.purpose_id
                  ? "Saving..."
                  : "Record Granted"}
              </button>

              {/* NOT GRANTED BUTTON */}
              <button
                type="button"
                disabled={savingPurpose !== null}
                onClick={() => saveConsent(purpose, false)}
              >
                Record Not Granted
              </button>
            </div>
          ))}

          {!consentLoading &&
            consents.length === 0 &&
            !consentError && (
              <p>No consent purposes available.</p>
            )}

          <button
            type="button"
            onClick={() => setShowConsent(false)}
          >
            {te
              ? "రోగి వివరాలకు తిరిగి వెళ్ళండి"
              : "Back to Patient Profile"}
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // ORAL SCREENING PAGE
  // ========================================

  if (showScreening) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card screening-card">
          <h1>{t.screening}</h1>

          <p>Aarogya Drishti</p>

          <h3>
            {profile?.full_name} ({profile?.patient_code})
          </h3>

          <hr />

          {!screening && (
            <>
              <h3>
                {te ? "స్క్రీనింగ్ వివరాలు" : "Screening Details"}
              </h3>

              <label>{t.complaint}</label>

              <textarea
                value={chiefComplaint}
                onChange={event =>
                  setChiefComplaint(event.target.value)
                }
                placeholder="Enter patient's chief complaint"
                rows={3}
              />

              <label>{t.tobacco}</label>

              <select
                value={tobaccoCurrent}
                onChange={event =>
                  setTobaccoCurrent(event.target.value)
                }
              >
                <option value="unknown">Not recorded</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>

              <label>{t.notes}</label>

              <textarea
                value={screeningNotes}
                onChange={event =>
                  setScreeningNotes(event.target.value)
                }
                rows={3}
              />

              <button
                type="button"
                disabled={screeningLoading}
                onClick={startScreening}
              >
                {screeningLoading ? "Starting..." : t.start}
              </button>
            </>
          )}

          {screening && (
            <>
              <p style={{ color: "green", fontWeight: 600 }}>
                {te ? "స్క్రీనింగ్ ప్రారంభమైంది" : "Screening Started"}
              </p>

              <p>
                <strong>Screening ID:</strong> {screening.id}
              </p>

              <p>
                <strong>Case State:</strong> {screening.case_state}
              </p>

              <hr />

              <h3>
                {te
                  ? "లక్షణాలు / పరీక్ష ఫలితాలు"
                  : "Symptoms / Examination Findings"}
              </h3>

              <form onSubmit={saveFinding}>
                <label>
                  {te ? "ఫలితం రకం" : "Finding Type"}
                </label>

                <select
                  value={findingKind}
                  onChange={event =>
                    setFindingKind(event.target.value)
                  }
                >
                  <option value="SYMPTOM">{t.symptom}</option>
                  <option value="EXAM">{t.examination}</option>
                </select>

                <label>{t.description}</label>

                <textarea
                  value={findingDescription}
                  onChange={event =>
                    setFindingDescription(event.target.value)
                  }
                  placeholder="Describe the symptom or examination finding"
                  rows={3}
                  required
                />

                {findingKind === "SYMPTOM" && (
                  <>
                    <label>{t.duration}</label>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={findingDuration}
                      onChange={event =>
                        setFindingDuration(event.target.value)
                      }
                      required
                    />
                  </>
                )}

                <label>{t.oralSite}</label>

                <select
                  value={oralSite}
                  onChange={event =>
                    setOralSite(event.target.value)
                  }
                >
                  <option value="">Select oral site</option>

                  {oralSites.map(site => (
                    <option key={site[0]} value={site[0]}>
                      {te ? site[2] : site[1]}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={findingLoading}
                >
                  {findingLoading ? "Saving..." : t.saveFinding}
                </button>
              </form>

              <hr />

              <h3>{t.saved}</h3>

              {savedFindings.length === 0 ? (
                <p>
                  {te
                    ? "ఇంకా వివరాలు నమోదు కాలేదు."
                    : "No findings recorded yet."}
                </p>
              ) : (
                savedFindings.map((finding, index) => (
                  <div
                    className="patient-result-card"
                    key={finding.id || index}
                  >
                    <p>
                      <strong>{finding.finding_kind}</strong>
                    </p>

                    <p>{finding.description}</p>

                    {finding.duration_days !== null && (
                      <p>
                        Duration: {finding.duration_days} days
                      </p>
                    )}

                    {finding.oral_site && (
                      <p>Site: {finding.oral_site}</p>
                    )}
                  </div>
                ))
              )}

              <hr />

              {/* PHOTOGRAPH CAPTURE */}
              <section className="photo-capture-section">
                <h3>
                  {te
                    ? "నోటి ఫోటో క్యాప్చర్"
                    : "Oral Photograph Capture"}
                </h3>

                <p>
                  {te
                    ? "ఫోటో తీయడానికి ముందు IMAGE_CAPTURE సమ్మతి తప్పనిసరిగా ఉండాలి."
                    : "IMAGE_CAPTURE consent must be granted before taking photographs."}
                </p>

                <label>
                  {te ? "నోటి భాగం ఎంచుకోండి" : "Select Oral View"}
                </label>

                <select
                  value={photoView}
                  onChange={event =>
                    setPhotoView(event.target.value)
                  }
                  disabled={cameraOpen || !!capturedPhoto}
                >
                  {oralSites.map(site => (
                    <option key={site[0]} value={site[0]}>
                      {te ? site[2] : site[1]}
                    </option>
                  ))}
                </select>

                <label>
                  {te
                    ? "అదనపు గుర్తింపు (ఐచ్ఛికం)"
                    : "Body-site Annotation (Optional)"}
                </label>

                <input
                  type="text"
                  value={annotationSite}
                  onChange={event =>
                    setAnnotationSite(event.target.value)
                  }
                  maxLength={200}
                  placeholder="Optional annotation"
                  disabled={!!capturedPhoto}
                />

                {!cameraOpen && !capturedPhoto && (
                  <div style={{ marginTop: 15 }}>
                    <button
                      type="button"
                      onClick={startCamera}
                    >
                      {te ? "కెమెరా తెరవండి" : "Open Camera"}
                    </button>

                    <p>OR</p>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {te
                        ? "ఫోటో ఎంచుకోండి"
                        : "Choose / Capture Photo"}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={handlePhotoFile}
                      style={{ display: "none" }}
                    />
                  </div>
                )}

                {cameraOpen && (
                  <div style={{ marginTop: 15 }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: "100%",
                        maxWidth: 500,
                        borderRadius: 12,
                        background: "#111"
                      }}
                    />

                    <canvas
                      ref={canvasRef}
                      style={{ display: "none" }}
                    />

                    <div>
                      <button
                        type="button"
                        onClick={capturePhoto}
                      >
                        {te
                          ? "ఫోటో తీయండి"
                          : "Capture Photograph"}
                      </button>

                      <button
                        type="button"
                        onClick={stopCamera}
                      >
                        {te
                          ? "కెమెరా మూసివేయండి"
                          : "Close Camera"}
                      </button>
                    </div>
                  </div>
                )}

                {capturedPhoto && (
                  <div style={{ marginTop: 15 }}>
                    <h4>
                      {te ? "ఫోటో ప్రివ్యూ" : "Photograph Preview"}
                    </h4>

                    <img
                      src={capturedPhoto.preview}
                      alt="Captured oral screening preview"
                      style={{
                        width: "100%",
                        maxWidth: 500,
                        borderRadius: 12,
                        display: "block"
                      }}
                    />

                    <p>
                      {capturedPhoto.file.name} —{" "}
                      {(capturedPhoto.file.size / 1024).toFixed(1)} KB
                    </p>

                    <button
                      type="button"
                      disabled={photoUploading}
                      onClick={retakePhoto}
                    >
                      {te
                        ? "మళ్లీ ఫోటో తీయండి"
                        : "Retake Photograph"}
                    </button>

                    <button
                      type="button"
                      disabled={photoUploading}
                      onClick={uploadPhoto}
                    >
                      {photoUploading
                        ? "Uploading..."
                        : te
                          ? "ఫోటో సేవ్ చేయండి"
                          : "Upload Photograph"}
                    </button>
                  </div>
                )}

                {cameraError && (
                  <p style={{ color: "red" }}>{cameraError}</p>
                )}

                {photoMessage && (
                  <p style={{ color: "#176b37", fontWeight: 600 }}>
                    {photoMessage}
                  </p>
                )}

                <hr />

                <h4>
                  {te ? "సేవ్ చేసిన ఫోటోలు" : "Saved Photographs"}
                </h4>

                {savedPhotos.length === 0 ? (
                  <p>
                    {te
                      ? "ఇంకా ఫోటోలు సేవ్ కాలేదు."
                      : "No photographs uploaded yet."}
                  </p>
                ) : (
                  savedPhotos.map(photo => (
                    <div
                      className="patient-result-card"
                      key={photo.id}
                      style={{
                        marginBottom: 12,
                        padding: 12
                      }}
                    >
                      <p>
                        <strong>View:</strong> {photo.view_type}
                      </p>

                      <p>
                        <strong>Status:</strong> {photo.status}
                      </p>

                      <p>
                        <strong>Quality:</strong>{" "}
                        {photo.quality?.status || "Recorded"}
                      </p>

                      {photo.quality?.reason && (
                        <p>
                          Quality note: {photo.quality.reason}
                        </p>
                      )}

                      {/* AI ASSESSMENT BUTTON */}
                      <button
                        type="button"
                        disabled={
                          aiLoadingPhotoId !== null ||
                          photo.status !== "ACCEPTED" ||
                          photo.quality?.status !== "ACCEPTABLE"
                        }
                        onClick={() => requestAIAssessment(photo)}
                      >
                        {aiLoadingPhotoId === photo.id
                          ? "Processing demo assessment..."
                          : "AI Assessment (Demo)"}
                      </button>

                      {/* AI ASSESSMENT RESULT */}
                      {aiAssessments[photo.id] && (
                        <div
                          className="patient-result-card"
                          style={{
                            marginTop: 12,
                            padding: 12,
                            textAlign: "left"
                          }}
                        >
                          <h4>AI Demonstration Result</h4>

                          <p>
                            <strong>Assessment:</strong>{" "}
                            {aiAssessments[photo.id].displayLabel ||
                              aiAssessments[photo.id].assessment?.result_label ||
                              "Not available"}
                          </p>

                          <p>
                            <strong>Status:</strong>{" "}
                            {aiAssessments[photo.id].assessment?.status ||
                              "Not available"}
                          </p>

                          <p>
                            <strong>Provider:</strong>{" "}
                            {aiAssessments[photo.id].assessment?.model_provider ||
                              "Not available"}
                          </p>

                          <p>
                            <strong>Model version:</strong>{" "}
                            {aiAssessments[photo.id].assessment?.model_version ||
                              "Not available"}
                          </p>

                          <p
                            style={{
                              color: "#a12622",
                              fontWeight: 700
                            }}
                          >
                            {aiAssessments[photo.id].warning ||
                              "NOT FOR CLINICAL USE"}
                          </p>

                          <p>
                            This is a fixed mock demonstration output.
                            The photograph was not analysed by a real AI
                            model. A Medical Officer must review the case.
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={photoUploading || !!capturedPhoto}
                        onClick={() => {
                          setRetakePhotoId(photo.id);
                          setPhotoView(photo.view_type);
                          setPhotoMessage("");
                          startCamera();
                        }}
                      >
                        Retake This View
                      </button>
                    </div>
                  ))
                )}

                {aiError && (
                  <p style={{ color: "red", fontWeight: 600 }}>
                    {aiError}
                  </p>
                )}

                <p style={{ fontSize: 13 }}>
                  Photos are stored privately on the server. Quality
                  checks are technical hints only and do not provide
                  a diagnosis.
                </p>
              </section>
            </>
          )}

          {screeningMessage && (
            <p style={{ color: "green" }}>{screeningMessage}</p>
          )}

          <button
            type="button"
            onClick={() => {
              stopCamera();
              setShowScreening(false);
              setScreeningMessage("");
            }}
          >
            {te
              ? "రోగి వివరాలకు తిరిగి వెళ్ళండి"
              : "Back to Patient Profile"}
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // PATIENT PROFILE PAGE
  // ========================================

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>{t.profile}</h1>

        <p>Aarogya Drishti</p>

        <h2>{profile?.full_name}</h2>

        <hr />

        <h3>{t.personal}</h3>

        <p>
          <strong>Patient ID:</strong> {profile?.patient_code}
        </p>

        <p>
          <strong>{te ? "పేరు" : "Name"}:</strong> {profile?.full_name}
        </p>

        <p>
          <strong>{te ? "వయస్సు" : "Age"}:</strong>{" "}
          {profile?.age_years ?? "N/A"}
        </p>

        <p>
          <strong>{te ? "లింగం" : "Sex"}:</strong> {profile?.sex}
        </p>

        <p>
          <strong>{te ? "ఫోన్" : "Phone"}:</strong>{" "}
          {profile?.contact_phone || "N/A"}
        </p>

        <p>
          <strong>{te ? "గ్రామం ID" : "Village ID"}:</strong>{" "}
          {profile?.village_id ?? "N/A"}
        </p>

        <p>
          <strong>{te ? "నివాస ప్రాంతం" : "Habitation"}:</strong>{" "}
          {profile?.habitation || "N/A"}
        </p>

        <p>
          <strong>PHC ID:</strong> {profile?.phc_id ?? "N/A"}
        </p>

        <p>
          <strong>{te ? "చిరునామా" : "Address"}:</strong>{" "}
          {profile?.address_line || "N/A"}
        </p>

        <hr />

        <h3>{t.history}</h3>

        {medicalHistory.length === 0 ? (
          <p>
            {te
              ? "వైద్య చరిత్ర నమోదు కాలేదు."
              : "No medical history recorded."}
          </p>
        ) : (
          medicalHistory.map((history, index) => (
            <div
              key={`${history.history_kind}-${index}`}
              className="patient-result-card"
            >
              <h4>
                {historyLabels[history.history_kind] ||
                  history.history_kind}
              </h4>

              {history.condition_text && (
                <p>{history.condition_text}</p>
              )}

              {history.exposure_type_id && (
                <p>
                  <strong>Exposure Type ID:</strong>{" "}
                  {history.exposure_type_id}
                </p>
              )}

              {history.duration_years !== null &&
                history.duration_years !== undefined && (
                  <p>
                    <strong>Duration (Years):</strong>{" "}
                    {history.duration_years}
                  </p>
                )}

              {history.is_current !== null &&
                history.is_current !== undefined && (
                  <p>
                    <strong>Current Usage:</strong>{" "}
                    {history.is_current ? "Yes" : "No"}
                  </p>
                )}

              <p>
                <strong>Recorded Date:</strong>{" "}
                {history.recorded_at
                  ? new Date(history.recorded_at).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          ))
        )}

        <hr />

        <button
          type="button"
          onClick={() => {
            setShowConsent(false);
            setShowScreening(true);
          }}
        >
          {t.start}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowScreening(false);
            setShowConsent(true);
          }}
        >
          {t.consent}
        </button>

        <button type="button" onClick={onBack}>
          {t.back}
        </button>
      </div>
    </div>
  );
}

export default PatientProfile;