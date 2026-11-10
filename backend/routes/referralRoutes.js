
const express = require("express");
const { pool } = require("../db");

const {
  authenticateToken,
  requireDistrictAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ========================================
// GET LOGGED-IN DISTRICT ADMIN'S DISTRICT
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
// UUID VALIDATION
// ========================================

const isValidUUID = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

// ========================================
// GET: REFERRAL MASTER DATA
// ========================================

router.get(
  "/meta",
  authenticateToken,
  requireDistrictAdmin,
  async (req, res) => {
    try {
      const districtId = await getAdminDistrict(req.user.userId);

      const [hospitalResult, specialtyResult, priorityResult] =
        await Promise.all([
          pool.query(
            `SELECT id, code, name_en, name_te, level
             FROM mst_hospitals
             WHERE district_id = $1
               AND is_active = TRUE
             ORDER BY name_en`,
            [districtId]
          ),

          pool.query(
            `SELECT id, code, name_en, name_te
             FROM mst_specialties
             WHERE is_active = TRUE
             ORDER BY name_en`
          ),

          pool.query(
            `SELECT id, code, name_en, name_te,
                    priority_rank, target_days
             FROM mst_referral_priorities
             WHERE is_active = TRUE
             ORDER BY priority_rank`
          ),
        ]);

      return res.status(200).json({
        success: true,
        hospitals: hospitalResult.rows,
        specialties: specialtyResult.rows,
        priorities: priorityResult.rows,
      });
    } catch (error) {
      console.error("Referral master data error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load referral master data.",
      });
    }
  }
);

// ========================================
// GET: DISTRICT REFERRALS
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
           r.id,
           r.referral_code,
           r.patient_id,
           p.patient_code,
           p.full_name AS patient_name,
           p.contact_phone,
           r.review_id,
           cr.decision AS clinical_decision,
           cr.signed_at AS review_signed_at,
           r.from_facility_id,
           source_facility.name_en AS source_facility,
           r.to_hospital_id,
           h.name_en AS hospital_name,
           h.name_te AS hospital_name_te,
           r.specialty_id,
           sp.name_en AS specialty_name,
           sp.name_te AS specialty_name_te,
           r.priority_id,
           rp.name_en AS priority_name,
           rp.name_te AS priority_name_te,
           rp.priority_rank,
           r.mode,
           r.status,
           r.reason,
           r.created_at,
           r.updated_at
         FROM tbl_referrals r
         INNER JOIN tbl_patients p
           ON p.id = r.patient_id
         INNER JOIN tbl_clinical_reviews cr
           ON cr.id = r.review_id
          AND cr.patient_id = r.patient_id
         INNER JOIN mst_facilities source_facility
           ON source_facility.id = r.from_facility_id
         INNER JOIN mst_hospitals h
           ON h.id = r.to_hospital_id
         INNER JOIN mst_specialties sp
           ON sp.id = r.specialty_id
         INNER JOIN mst_referral_priorities rp
           ON rp.id = r.priority_id
         WHERE source_facility.district_id = $1
           AND p.deleted_at IS NULL
           AND (
             $2 = ''
             OR r.referral_code ILIKE $3
             OR p.patient_code ILIKE $3
             OR p.full_name ILIKE $3
             OR h.name_en ILIKE $3
           )
         ORDER BY r.created_at DESC
         LIMIT 200`,
        [districtId, search, `%${search}%`]
      );

      return res.status(200).json({
        success: true,
        count: result.rowCount,
        referrals: result.rows,
      });
    } catch (error) {
      console.error("District referrals error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load district referrals.",
      });
    }
  }
);

// ========================================
// GET: DISTRICT APPOINTMENTS
// ========================================

router.get(
  "/appointments",
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
           a.id AS appointment_id,
           a.referral_id,
           r.referral_code,
           a.patient_id,
           p.patient_code,
           p.full_name AS patient_name,
           a.hospital_id,
           h.name_en AS hospital_name,
           a.specialty_id,
           sp.name_en AS specialty_name,
           a.assigned_service,
           a.location_note,
           a.scheduled_at,
           a.status_id,
           ast.code AS appointment_status,
           ast.name_en AS appointment_status_name,
           ast.name_te AS appointment_status_name_te,
           ast.is_terminal,
           a.attendance,
           a.attended_at,
           a.missed_reason_id,
           a.missed_reason_text,
           a.cancel_reason,
           a.clinician_outcome,
           a.confirmed_at,
           a.created_at,
           a.updated_at
         FROM tbl_hospital_appointments a
         INNER JOIN tbl_referrals r
           ON r.id = a.referral_id
          AND r.patient_id = a.patient_id
         INNER JOIN tbl_patients p
           ON p.id = a.patient_id
         INNER JOIN mst_facilities source_facility
           ON source_facility.id = r.from_facility_id
         INNER JOIN mst_hospitals h
           ON h.id = a.hospital_id
         INNER JOIN mst_specialties sp
           ON sp.id = a.specialty_id
         INNER JOIN mst_appointment_statuses ast
           ON ast.id = a.status_id
         WHERE source_facility.district_id = $1
           AND p.deleted_at IS NULL
           AND (
             $2 = ''
             OR r.referral_code ILIKE $3
             OR p.patient_code ILIKE $3
             OR p.full_name ILIKE $3
             OR h.name_en ILIKE $3
           )
         ORDER BY a.scheduled_at DESC
         LIMIT 200`,
        [districtId, search, `%${search}%`]
      );

      return res.status(200).json({
        success: true,
        count: result.rowCount,
        appointments: result.rows,
      });
    } catch (error) {
      console.error("District appointments error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load district appointments.",
      });
    }
  }
);

// ========================================
// GET: REFERRAL DETAILS
// ========================================

router.get(
  "/:id",
  authenticateToken,
  requireDistrictAdmin,
  async (req, res) => {
    try {
      const referralId = req.params.id;

      if (!isValidUUID(referralId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral ID.",
        });
      }

      const districtId = await getAdminDistrict(req.user.userId);

      const referralResult = await pool.query(
        `SELECT
           r.id,
           r.referral_code,
           r.patient_id,
           p.patient_code,
           p.full_name AS patient_name,
           p.sex,
           p.age_years,
           p.contact_phone,
           r.review_id,
           cr.decision AS clinical_decision,
           cr.finding,
           cr.impression,
           cr.referral_reason AS clinical_referral_reason,
           cr.followup_instructions,
           cr.signed_at AS review_signed_at,
           r.from_facility_id,
           source_facility.name_en AS source_facility,
           r.to_hospital_id,
           h.name_en AS hospital_name,
           h.name_te AS hospital_name_te,
           r.specialty_id,
           sp.name_en AS specialty_name,
           r.priority_id,
           rp.name_en AS priority_name,
           rp.priority_rank,
           rp.target_days,
           r.mode,
           r.status,
           r.reason,
           r.assigned_specialist_id,
           r.assigned_navigator_id,
           r.assessment_completed_at,
           r.cancel_reason,
           r.created_at,
           r.updated_at
         FROM tbl_referrals r
         INNER JOIN tbl_patients p
           ON p.id = r.patient_id
         INNER JOIN tbl_clinical_reviews cr
           ON cr.id = r.review_id
          AND cr.patient_id = r.patient_id
         INNER JOIN mst_facilities source_facility
           ON source_facility.id = r.from_facility_id
         INNER JOIN mst_hospitals h
           ON h.id = r.to_hospital_id
         INNER JOIN mst_specialties sp
           ON sp.id = r.specialty_id
         INNER JOIN mst_referral_priorities rp
           ON rp.id = r.priority_id
         WHERE r.id = $1
           AND source_facility.district_id = $2
           AND p.deleted_at IS NULL`,
        [referralId, districtId]
      );

      if (referralResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Referral not found in your district.",
        });
      }

      const appointmentResult = await pool.query(
        `SELECT
           a.id,
           a.scheduled_at,
           a.hospital_id,
           h.name_en AS hospital_name,
           a.specialty_id,
           sp.name_en AS specialty_name,
           a.assigned_service,
           a.location_note,
           a.status_id,
           ast.code AS appointment_status,
           ast.name_en AS appointment_status_name,
           a.attendance,
           a.attended_at,
           a.missed_reason_text,
           a.cancel_reason,
           a.clinician_outcome,
           a.confirmed_at,
           a.created_at
         FROM tbl_hospital_appointments a
         INNER JOIN mst_hospitals h
           ON h.id = a.hospital_id
         INNER JOIN mst_specialties sp
           ON sp.id = a.specialty_id
         INNER JOIN mst_appointment_statuses ast
           ON ast.id = a.status_id
         WHERE a.referral_id = $1
           AND a.patient_id = $2
         ORDER BY a.scheduled_at DESC`,
        [
          referralId,
          referralResult.rows[0].patient_id,
        ]
      );

      return res.status(200).json({
        success: true,
        referral: referralResult.rows[0],
        appointments: appointmentResult.rows,
      });
    } catch (error) {
      console.error("Referral details error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load referral details.",
      });
    }
  }
);

module.exports = router;
