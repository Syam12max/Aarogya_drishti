const express = require("express");
const { pool } = require("../db");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

// ========================================
// GET: SEARCH PATIENTS
// ========================================

router.get("/search", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "HEALTH_WORKER") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const searchValue =
      typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (searchValue.length < 2 || searchValue.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Enter at least 2 characters.",
      });
    }

    const assignment = await pool.query(
      `SELECT facility_id
       FROM tbl_user_facility_assignments
       WHERE user_id = $1
       AND is_primary = TRUE
       AND valid_from <= CURRENT_DATE
       AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
       ORDER BY valid_from DESC
       LIMIT 1`,
      [req.user.userId]
    );

    if (assignment.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: "No active facility assigned.",
      });
    }

    const result = await pool.query(
      `SELECT
          id,
          patient_code,
          full_name,
          sex,
          age_years,
          date_of_birth,
          contact_phone,
          village_id,
          habitation,
          preferred_language_id,
          phc_id,
          created_at
       FROM tbl_patients
       WHERE registered_facility_id = $1
       AND deleted_at IS NULL
       AND (
         patient_code ILIKE $2
         OR full_name ILIKE $2
         OR contact_phone ILIKE $2
       )
       ORDER BY full_name ASC
       LIMIT 20`,
      [assignment.rows[0].facility_id, `%${searchValue}%`]
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      patients: result.rows,
      message:
        result.rowCount > 0
          ? "Patients found."
          : "No patients found.",
    });
  } catch (error) {
    console.error("Patient search error:", error);

    return res.status(500).json({
      success: false,
      message: "Patient search failed.",
    });
  }
});

// ========================================
// POST: REGISTER NEW PATIENT
// ========================================

router.post("/register", authenticateToken, async (req, res) => {
  let client;

  try {
    if (req.user.role !== "HEALTH_WORKER") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const {
      full_name,
      sex,
      age_years,
      date_of_birth,
      contact_phone,
      village_id,
      habitation,
      address_line,
      preferred_language_id,
      idempotency_key,
      client_created_at,
      symptoms,
      symptom_duration,
      tobacco_exposure_type_id,
      tobacco_duration_years,
      previous_screening,
      previous_referral,
    } = req.body;

    // Validate patient name
    if (
      typeof full_name !== "string" ||
      full_name.trim().length < 2 ||
      full_name.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid patient name.",
      });
    }

    // Validate sex
    const allowedSex = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"];
    const patientSex = sex || "UNDISCLOSED";

    if (!allowedSex.includes(patientSex)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sex value.",
      });
    }

    // Validate age
    let patientAge = null;

    if (
      age_years !== undefined &&
      age_years !== null &&
      age_years !== ""
    ) {
      patientAge = Number(age_years);

      if (
        !Number.isInteger(patientAge) ||
        patientAge < 0 ||
        patientAge > 120
      ) {
        return res.status(400).json({
          success: false,
          message: "Age must be between 0 and 120.",
        });
      }
    }

    // Validate date of birth
    const patientDOB = date_of_birth || null;

    if (patientDOB && !/^\d{4}-\d{2}-\d{2}$/.test(patientDOB)) {
      return res.status(400).json({
        success: false,
        message: "Date of birth must use YYYY-MM-DD format.",
      });
    }

    if (!patientDOB && patientAge === null) {
      return res.status(400).json({
        success: false,
        message: "Enter either age or date of birth.",
      });
    }

    // Validate phone number
    if (
      contact_phone &&
      !/^[0-9+\-\s]{7,20}$/.test(contact_phone)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid contact phone number.",
      });
    }

    // Validate village ID
    const villageId =
      village_id === undefined ||
      village_id === null ||
      village_id === ""
        ? null
        : Number(village_id);

    if (
      villageId !== null &&
      (!Number.isSafeInteger(villageId) || villageId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid village.",
      });
    }

    // Validate language ID
    const languageId =
      preferred_language_id === undefined ||
      preferred_language_id === null ||
      preferred_language_id === ""
        ? null
        : Number(preferred_language_id);

    if (
      languageId !== null &&
      (!Number.isSafeInteger(languageId) || languageId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid preferred language.",
      });
    }

    // Validate tobacco exposure ID
    const exposureId =
      tobacco_exposure_type_id === undefined ||
      tobacco_exposure_type_id === null ||
      tobacco_exposure_type_id === ""
        ? null
        : Number(tobacco_exposure_type_id);

    const exposureDuration =
      tobacco_duration_years === undefined ||
      tobacco_duration_years === null ||
      tobacco_duration_years === ""
        ? null
        : Number(tobacco_duration_years);

    if (
      exposureId !== null &&
      (!Number.isSafeInteger(exposureId) || exposureId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid exposure type.",
      });
    }

    if (
      exposureDuration !== null &&
      (!Number.isFinite(exposureDuration) || exposureDuration < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid exposure duration.",
      });
    }

    // Validate idempotency key
    const idempotencyKey =
      typeof idempotency_key === "string" && idempotency_key.trim()
        ? idempotency_key.trim()
        : null;

    if (idempotencyKey && idempotencyKey.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration request key.",
      });
    }

    // Validate offline registration time
    let clientCreatedAt = null;

    if (client_created_at !== undefined && client_created_at !== null) {
      const parsedDate = new Date(client_created_at);

      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid client registration date.",
        });
      }

      clientCreatedAt = parsedDate.toISOString();
    }

    // Database connection
    client = await pool.connect();

    // Next part continues here
        const assignment = await client.query(
      `SELECT a.facility_id, f.phc_id
       FROM tbl_user_facility_assignments a
       JOIN mst_facilities f ON f.id = a.facility_id
       WHERE a.user_id = $1
       AND a.is_primary = TRUE
       AND a.valid_from <= CURRENT_DATE
       AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
       AND f.is_active = TRUE
       ORDER BY a.valid_from DESC
       LIMIT 1`,
      [req.user.userId]
    );

    if (assignment.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: "No active facility assigned.",
      });
    }

    const facilityId = assignment.rows[0].facility_id;
    const phcId = assignment.rows[0].phc_id;

    await client.query("BEGIN");

    // Check previous offline sync request
    if (idempotencyKey) {
      const existingRequest = await client.query(
        `SELECT id, patient_code, full_name
         FROM tbl_patients
         WHERE registered_by = $1
         AND idempotency_key = $2`,
        [req.user.userId, idempotencyKey]
      );

      if (existingRequest.rowCount > 0) {
        await client.query("COMMIT");

        return res.status(200).json({
          success: true,
          patient: existingRequest.rows[0],
          message: "Patient was already registered.",
        });
      }
    }

    // Check duplicate patients
    const duplicate = await client.query(
      `SELECT id, patient_code, full_name,
              contact_phone, age_years
       FROM tbl_patients
       WHERE registered_facility_id = $1
       AND deleted_at IS NULL
       AND (
         ($2::text IS NOT NULL AND contact_phone = $2)
         OR
         (
           LOWER(full_name) = LOWER($3)
           AND (
             ($4::date IS NOT NULL AND date_of_birth = $4::date)
             OR
             (
               $4::date IS NULL
               AND $5::smallint IS NOT NULL
               AND age_years = $5
             )
           )
         )
       )
       LIMIT 5`,
      [
        facilityId,
        contact_phone || null,
        full_name.trim(),
        patientDOB,
        patientAge,
      ]
    );

    if (duplicate.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        possibleDuplicates: duplicate.rows,
        message: "Possible duplicate patient found. Review existing records.",
      });
    }

    // Save real patient
    const result = await client.query(
      `INSERT INTO tbl_patients (
        full_name,
        sex,
        age_years,
        date_of_birth,
        contact_phone,
        village_id,
        habitation,
        address_line,
        preferred_language_id,
        phc_id,
        registered_facility_id,
        registered_by,
        idempotency_key,
        client_created_at,
        is_synthetic
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, FALSE
      )
      RETURNING
        id,
        patient_code,
        full_name,
        sex,
        age_years,
        date_of_birth,
        contact_phone,
        village_id,
        habitation,
        preferred_language_id,
        phc_id,
        created_at,
        client_created_at,
        is_synthetic`,
      [
        full_name.trim(),
        patientSex,
        patientAge,
        patientDOB,
        contact_phone || null,
        villageId,
        habitation || null,
        address_line || null,
        languageId,
        phcId,
        facilityId,
        req.user.userId,
        idempotencyKey,
        clientCreatedAt,
      ]
    );

    const patient = result.rows[0];

    // Save symptoms
    if (symptoms && String(symptoms).trim()) {
      const conditionText = symptom_duration
        ? `Symptoms: ${String(symptoms).trim()}. Duration: ${String(symptom_duration).trim()}.`
        : `Symptoms: ${String(symptoms).trim()}.`;

      await client.query(
        `INSERT INTO tbl_patient_medical_histories
         (patient_id, history_kind, condition_text, recorded_by)
         VALUES ($1, 'CONDITION', $2, $3)`,
        [patient.id, conditionText, req.user.userId]
      );
    }

    // Save tobacco exposure
    if (exposureId !== null) {
      await client.query(
        `INSERT INTO tbl_patient_medical_histories
         (
           patient_id,
           history_kind,
           exposure_type_id,
           duration_years,
           is_current,
           recorded_by
         )
         VALUES ($1, 'EXPOSURE', $2, $3, TRUE, $4)`,
        [
          patient.id,
          exposureId,
          exposureDuration,
          req.user.userId,
        ]
      );
    }

    // Save previous screening
    if (previous_screening) {
      await client.query(
        `INSERT INTO tbl_patient_medical_histories
         (patient_id, history_kind, condition_text, recorded_by)
         VALUES ($1, 'PRIOR_SCREENING', $2, $3)`,
        [
          patient.id,
          `Previous screening: ${String(previous_screening).trim()}`,
          req.user.userId,
        ]
      );
    }

    // Save previous referral
    if (previous_referral) {
      await client.query(
        `INSERT INTO tbl_patient_medical_histories
         (patient_id, history_kind, condition_text, recorded_by)
         VALUES ($1, 'PRIOR_REFERRAL', $2, $3)`,
        [
          patient.id,
          `Previous referral: ${String(previous_referral).trim()}`,
          req.user.userId,
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      patient,
      message: "Patient registered successfully.",
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError.message);
      }
    }

    console.error("Patient registration error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This patient registration may already exist. Search before trying again.",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid village, language, or exposure selection.",
      });
    }

    if (error.code === "23514" || error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Some patient details are invalid.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Patient registration failed.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// ========================================
// GET: PATIENT PROFILE WITH MEDICAL HISTORY
// ========================================

router.get("/profile/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "HEALTH_WORKER") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const patientId = req.params.id;

    const assignment = await pool.query(
      `SELECT facility_id
       FROM tbl_user_facility_assignments
       WHERE user_id = $1
       AND is_primary = TRUE
       AND valid_from <= CURRENT_DATE
       AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
       ORDER BY valid_from DESC
       LIMIT 1`,
      [req.user.userId]
    );

    if (assignment.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: "No active facility assigned.",
      });
    }

    const patientResult = await pool.query(
      `SELECT
         id,
         patient_code,
         full_name,
         sex,
         age_years,
         date_of_birth,
         contact_phone,
         village_id,
         habitation,
         address_line,
         preferred_language_id,
         phc_id,
         created_at
       FROM tbl_patients
       WHERE id = $1
       AND registered_facility_id = $2
       AND deleted_at IS NULL`,
      [patientId, assignment.rows[0].facility_id]
    );

    if (patientResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Patient not found.",
      });
    }

    const historyResult = await pool.query(
      `SELECT
         history_kind,
         condition_text,
         exposure_type_id,
         duration_years,
         is_current,
         recorded_at
       FROM tbl_patient_medical_histories
       WHERE patient_id = $1
       ORDER BY recorded_at DESC`,
      [patientId]
    );

    return res.status(200).json({
      success: true,
      patient: patientResult.rows[0],
      medicalHistory: historyResult.rows,
    });
  } catch (error) {
    console.error("Patient profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load patient profile.",
    });
  }
});

// ========================================
// GET: PATIENT CONSENTS
// ========================================
router.get("/:patientId/consents", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "HEALTH_WORKER") {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const access = await pool.query(
      `SELECT fn_user_has_patient_access($1, $2) AS allowed`,
      [req.user.userId, req.params.patientId]
    );

    if (!access.rows[0]?.allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this patient.",
      });
    }

    const result = await pool.query(
      `SELECT
         p.id AS purpose_id,
         p.code,
         p.name_en,
         p.name_te,
         p.text_en,
         p.text_te,
         p.version,
         p.is_required,
         latest.granted,
         latest.method,
         latest.captured_at,
         latest.witness_name,
         latest.language_id
       FROM mst_consent_purposes p
       LEFT JOIN LATERAL (
         SELECT
           c.granted,
           c.method,
           c.captured_at,
           c.witness_name,
           c.language_id
         FROM tbl_patient_consents c
         WHERE c.patient_id = $1
         AND c.purpose_id = p.id
         ORDER BY c.consent_seq DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE p.is_active = TRUE
       ORDER BY p.id`,
      [req.params.patientId]
    );

    return res.status(200).json({
      success: true,
      consents: result.rows,
    });
  } catch (error) {
    console.error("Get patient consents error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load patient consents.",
    });
  }
});

// ========================================
// POST: RECORD PATIENT CONSENT
// ========================================

router.post("/:patientId/consents", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "HEALTH_WORKER") {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const {
      purpose_id,
      language_id,
      granted,
      confirmed,
      method,
      witness_name,
      device_id,
      notes,
    } = req.body;

    if (
      !Number.isSafeInteger(Number(purpose_id)) ||
      Number(purpose_id) <= 0 ||
      !Number.isSafeInteger(Number(language_id)) ||
      Number(language_id) <= 0 ||
      typeof granted !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "Purpose, language and consent decision are required.",
      });
    }

    if (granted === true && confirmed !== true) {
      return res.status(400).json({
        success: false,
        message: "Explicit patient consent confirmation is required.",
      });
    }

    const allowedMethods = [
      "CHECKBOX",
      "VERBAL_WITNESSED",
      "SIGNATURE",
      "THUMBPRINT",
    ];

    const consentMethod = method || "CHECKBOX";

    if (!allowedMethods.includes(consentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid consent method.",
      });
    }

    if (
      consentMethod === "VERBAL_WITNESSED" &&
      (typeof witness_name !== "string" || !witness_name.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Witness name is required for verbal consent.",
      });
    }

    const access = await pool.query(
      `SELECT fn_user_has_patient_access($1, $2) AS allowed`,
      [req.user.userId, req.params.patientId]
    );

    if (!access.rows[0]?.allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this patient.",
      });
    }

    const purposeResult = await pool.query(
      `SELECT id, version
       FROM mst_consent_purposes
       WHERE id = $1
       AND is_active = TRUE`,
      [Number(purpose_id)]
    );

    if (purposeResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive consent purpose.",
      });
    }

    const languageResult = await pool.query(
      `SELECT id
       FROM mst_languages
       WHERE id = $1
       AND is_active = TRUE`,
      [Number(language_id)]
    );

    if (languageResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive language.",
      });
    }

    const result = await pool.query(
      `INSERT INTO tbl_patient_consents (
         patient_id,
         purpose_id,
         language_id,
         consent_version,
         method,
         granted,
         captured_by,
         witness_name,
         device_id,
         notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING
         id,
         patient_id,
         purpose_id,
         language_id,
         consent_version,
         method,
         granted,
         captured_by,
         witness_name,
         captured_at`,
      [
        req.params.patientId,
        Number(purpose_id),
        Number(language_id),
        purposeResult.rows[0].version,
        consentMethod,
        granted,
        req.user.userId,
        witness_name?.trim() || null,
        device_id || null,
        notes || null,
      ]
    );

    return res.status(201).json({
      success: true,
      consent: result.rows[0],
      message: granted
        ? "Consent recorded successfully."
        : "Consent refusal or withdrawal recorded successfully.",
    });
  } catch (error) {
    console.error("Record patient consent error:", error);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid patient, purpose, language or user reference.",
      });
    }

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID or consent value.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to record patient consent.",
    });
  }
});

module.exports = router;