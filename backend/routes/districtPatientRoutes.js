
const express = require("express");
const { pool } = require("../db");

const {
  authenticateToken,
  requireDistrictAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ========================================
// GET DISTRICT ID FROM LOGGED-IN ADMIN
// ========================================

const getAdminDistrict = async (userId) => {
  const result = await pool.query(
    `SELECT DISTINCT f.district_id
     FROM tbl_user_facility_assignments ufa
     INNER JOIN mst_facilities f
       ON f.id = ufa.facility_id
     WHERE ufa.user_id = $1
       AND f.facility_type = 'DISTRICT_OFFICE'
       AND f.is_active = TRUE
       AND ufa.is_primary = TRUE
       AND ufa.valid_from <= CURRENT_DATE
       AND (ufa.valid_to IS NULL OR ufa.valid_to >= CURRENT_DATE)`,
    [userId]
  );

  if (result.rowCount !== 1) {
    throw new Error(
      "District Admin must have exactly one active primary District Office assignment."
    );
  }

  return result.rows[0].district_id;
};

// ========================================
// GET: DISTRICT PATIENT RECORDS
// ========================================

router.get(
  "/",
  authenticateToken,
  requireDistrictAdmin,
  async (req, res) => {
    try {
      const districtId = await getAdminDistrict(req.user.userId);

      const search =
        typeof req.query.search === "string"
          ? req.query.search.trim()
          : "";

      if (search.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Search text is too long.",
        });
      }

      const result = await pool.query(
        `SELECT
           p.id,
           p.patient_code,
           p.full_name,
           p.sex,
           p.age_years,
           p.date_of_birth,
           p.contact_phone,
           p.habitation,
           p.address_line,
           p.created_at,
           v.name_en AS village_name,
           gp.name_en AS gram_panchayat_name,
           m.name_en AS mandal_name,
           d.name_en AS district_name,
           f.name_en AS registered_facility
         FROM tbl_patients p
         INNER JOIN mst_villages v
           ON v.id = p.village_id
         LEFT JOIN mst_gram_panchayats gp
           ON gp.id = v.gram_panchayat_id
         INNER JOIN mst_mandals m
           ON m.id = v.mandal_id
         INNER JOIN mst_districts d
           ON d.id = m.district_id
         LEFT JOIN mst_facilities f
           ON f.id = p.registered_facility_id
         WHERE d.id = $1
           AND p.deleted_at IS NULL
           AND (
             $2 = ''
             OR p.patient_code ILIKE $3
             OR p.full_name ILIKE $3
             OR p.contact_phone ILIKE $3
           )
         ORDER BY p.created_at DESC
         LIMIT 100`,
        [
          districtId,
          search,
          `%${search}%`,
        ]
      );

      return res.status(200).json({
        success: true,
        districtId,
        count: result.rowCount,
        patients: result.rows,
        message: "District patient records loaded successfully.",
      });
    } catch (error) {
      console.error("District patient records error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load district patient records.",
      });
    }
  }
);

// ========================================
// GET: DISTRICT PATIENT PROFILE
// ========================================

router.get(
  "/profile/:id",
  authenticateToken,
  requireDistrictAdmin,
  async (req, res) => {
    try {
      const patientId = req.params.id;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(patientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid patient ID.",
        });
      }

      const districtId = await getAdminDistrict(req.user.userId);

      const patientResult = await pool.query(
        `SELECT
           p.id,
           p.patient_code,
           p.full_name,
           p.sex,
           p.age_years,
           p.date_of_birth,
           p.contact_phone,
           p.village_id,
           p.habitation,
           p.address_line,
           p.preferred_language_id,
           p.phc_id,
           p.created_at,
           v.name_en AS village_name,
           gp.name_en AS gram_panchayat_name,
           m.name_en AS mandal_name,
           d.name_en AS district_name,
           f.name_en AS registered_facility
         FROM tbl_patients p
         INNER JOIN mst_villages v
           ON v.id = p.village_id
         LEFT JOIN mst_gram_panchayats gp
           ON gp.id = v.gram_panchayat_id
         INNER JOIN mst_mandals m
           ON m.id = v.mandal_id
         INNER JOIN mst_districts d
           ON d.id = m.district_id
         LEFT JOIN mst_facilities f
           ON f.id = p.registered_facility_id
         WHERE p.id = $1
           AND d.id = $2
           AND p.deleted_at IS NULL`,
        [patientId, districtId]
      );

      if (patientResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Patient not found in your district.",
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
      console.error("District patient profile error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load patient profile.",
      });
    }
  }
);

// ========================================
// GET: DISTRICT PATIENT SCREENING HISTORY
// ========================================

router.get(
  "/screening-history/:id",
  authenticateToken,
  requireDistrictAdmin,
  async (req, res) => {
    try {
      const patientId = req.params.id;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(patientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid patient ID.",
        });
      }

      // Verify logged-in District Admin's district
      const districtId = await getAdminDistrict(req.user.userId);

      // Verify patient belongs to this district
      const patientResult = await pool.query(
        `SELECT
           p.id,
           p.patient_code,
           p.full_name
         FROM tbl_patients p
         INNER JOIN mst_villages v
           ON v.id = p.village_id
         LEFT JOIN mst_gram_panchayats gp
           ON gp.id = v.gram_panchayat_id
         INNER JOIN mst_mandals m
           ON m.id = v.mandal_id
         INNER JOIN mst_districts d
           ON d.id = m.district_id
         WHERE p.id = $1
           AND d.id = $2
           AND p.deleted_at IS NULL`,
        [patientId, districtId]
      );

      if (patientResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Patient not found in your district.",
        });
      }

      // Fetch screening records
      const screeningResult = await pool.query(
        `SELECT
           s.id AS screening_id,
           s.patient_id,
           s.examiner_id,
           s.facility_id,
           s.screening_site_id,
           s.screening_date,
           s.case_state,
           s.clinical_exam_done,
           s.tobacco_current,
           s.chief_complaint,
           s.notes,
           s.consent_id,
           s.version,
           s.created_at
         FROM tbl_screenings s
         WHERE s.patient_id = $1
         ORDER BY s.screening_date DESC, s.created_at DESC`,
        [patientId]
      );

      const screeningIds = screeningResult.rows.map(
        (screening) => screening.screening_id
      );

      // No screening records
      if (screeningIds.length === 0) {
        return res.status(200).json({
          success: true,
          patient: patientResult.rows[0],
          count: 0,
          screenings: [],
          findings: [],
          photographs: [],
          aiAssessments: [],
          clinicalReviews: [],
          message: "No screening history found for this patient.",
        });
      }

      // Fetch findings, photographs, AI assessments and clinical reviews
      const [
        findingResult,
        photoResult,
        aiResult,
        reviewResult,
      ] = await Promise.all([
        pool.query(
          `SELECT
             id,
             screening_id,
             finding_kind,
             symptom_id,
             oral_site,
             description,
             duration_days,
             recorded_by,
             recorded_at
           FROM tbl_screening_findings
           WHERE screening_id = ANY($1::uuid[])
           ORDER BY recorded_at DESC`,
          [screeningIds]
        ),

        pool.query(
          `SELECT
             ph.id,
             ph.screening_id,
             ph.view_type,
             ph.annotation_site,
             ph.status,
             ph.mime_type,
             ph.size_bytes,
             ph.width_px,
             ph.height_px,
             ph.metadata_stripped,
             ph.captured_at,
             q.status AS quality_status,
             q.reason AS quality_reason,
             q.blur_score,
             q.brightness_mean,
             q.glare_ratio
           FROM tbl_screening_photos ph
           LEFT JOIN LATERAL (
             SELECT
               status,
               reason,
               blur_score,
               brightness_mean,
               glare_ratio
             FROM tbl_image_quality_results
             WHERE photo_id = ph.id
             ORDER BY checked_at DESC
             LIMIT 1
           ) q ON TRUE
           WHERE ph.screening_id = ANY($1::uuid[])
           ORDER BY ph.captured_at DESC`,
          [screeningIds]
        ),

        pool.query(
          `SELECT
             id,
             screening_id,
             photo_id,
             model_provider,
             model_version,
             status,
             result_label,
             image_quality_status,
             clinical_use,
             requires_clinician_review,
             warning,
             error_code,
             requested_at,
             completed_at
           FROM tbl_ai_assessments
           WHERE screening_id = ANY($1::uuid[])
           ORDER BY requested_at DESC`,
          [screeningIds]
        ),

        pool.query(
          `SELECT
             id,
             screening_id,
             finding,
             impression,
             ai_assessment_id,
             ai_agreement,
             ai_discrepancy_note,
             decision,
             followup_instructions,
             referral_reason,
             request_note,
             version,
             signed_at
           FROM tbl_clinical_reviews
           WHERE screening_id = ANY($1::uuid[])
           ORDER BY signed_at DESC`,
          [screeningIds]
        ),
      ]);

      return res.status(200).json({
        success: true,
        patient: patientResult.rows[0],
        count: screeningResult.rowCount,
        screenings: screeningResult.rows,
        findings: findingResult.rows,
        photographs: photoResult.rows,
        aiAssessments: aiResult.rows,
        clinicalReviews: reviewResult.rows,
        message: "Patient screening history loaded successfully.",
      });

    } catch (error) {
      console.error("District patient screening history error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load patient screening history.",
      });
    }
  }
);

module.exports = router;
