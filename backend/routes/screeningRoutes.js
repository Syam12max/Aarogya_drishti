const express = require("express");
const { pool } = require("../db");
const { authenticateToken } = require("../middleware/authMiddleware");

const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_ORAL_SITES = [
  "CHEEK_LINING",
  "TONGUE",
  "PALATE",
  "GUMS",
  "FLOOR_OF_MOUTH",
  "OTHER"
];

const PRIVATE_UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "private_uploads"
);

fs.mkdirSync(PRIVATE_UPLOAD_DIR, {
  recursive: true,
  mode: 0o700
});

const QUALITY_LIMITS = {
  blurMin: Number(process.env.PHOTO_BLUR_MIN || 35),
  brightnessMin: Number(process.env.PHOTO_BRIGHTNESS_MIN || 45),
  brightnessMax: Number(process.env.PHOTO_BRIGHTNESS_MAX || 210),
  glareMax: Number(process.env.PHOTO_GLARE_MAX || 0.08)
};

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error("Only JPEG, PNG and WEBP images are allowed.")
      );
    }

    cb(null, true);
  }
});

/* ========================================
   IMAGE QUALITY CHECK
======================================== */

function calculatePhotoQuality(raw, width, height) {
  const pixels = width * height;

  let brightnessTotal = 0;
  let glarePixels = 0;

  for (let i = 0; i < pixels; i++) {
    const value = raw[i];

    brightnessTotal += value;

    if (value >= 245) {
      glarePixels++;
    }
  }

  const brightnessMean =
    pixels > 0 ? brightnessTotal / pixels : 0;

  const glareRatio =
    pixels > 0 ? glarePixels / pixels : 0;

  let laplacianTotal = 0;
  let laplacianSquaredTotal = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;

      const laplacian =
        -4 * raw[index] +
        raw[index - 1] +
        raw[index + 1] +
        raw[index - width] +
        raw[index + width];

      laplacianTotal += laplacian;
      laplacianSquaredTotal += laplacian * laplacian;

      count++;
    }
  }

  const average =
    count > 0 ? laplacianTotal / count : 0;

  const blurScore =
    count > 0
      ? Math.max(
          0,
          laplacianSquaredTotal / count - average * average
        )
      : 0;

  let reason = null;

  if (blurScore < QUALITY_LIMITS.blurMin) {
    reason = "blurry";
  } else if (brightnessMean < QUALITY_LIMITS.brightnessMin) {
    reason = "underexposed";
  } else if (brightnessMean > QUALITY_LIMITS.brightnessMax) {
    reason = "overexposed";
  } else if (glareRatio > QUALITY_LIMITS.glareMax) {
    reason = "glare";
  }

  return {
    status: reason ? "RECAPTURE" : "ACCEPTABLE",
    reason,
    blurScore,
    brightnessMean,
    glareRatio
  };
}

/* ========================================
   POST: START ORAL SCREENING
======================================== */

router.post("/:patientId/start", authenticateToken, async (req, res) => {
  let client;

  try {
    if (req.user.role !== "HEALTH_WORKER") {
      return res.status(403).json({
        success: false,
        message: "Only Health Workers can start screening."
      });
    }

    const { patientId } = req.params;

    const {
      idempotency_key,
      screening_site_id,
      tobacco_current,
      chief_complaint,
      notes
    } = req.body;

    if (!UUID_PATTERN.test(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID."
      });
    }

    if (
      typeof idempotency_key !== "string" ||
      !idempotency_key.trim() ||
      idempotency_key.trim().length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid idempotency key is required."
      });
    }

    if (
      tobacco_current !== undefined &&
      tobacco_current !== null &&
      typeof tobacco_current !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid tobacco exposure value."
      });
    }

    if (
      chief_complaint !== undefined &&
      (typeof chief_complaint !== "string" ||
        chief_complaint.length > 2000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid chief complaint."
      });
    }

    if (
      notes !== undefined &&
      (typeof notes !== "string" || notes.length > 5000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid screening notes."
      });
    }

    let siteId = null;

    if (
      screening_site_id !== undefined &&
      screening_site_id !== null &&
      screening_site_id !== ""
    ) {
      siteId = Number(screening_site_id);

      if (!Number.isSafeInteger(siteId) || siteId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid screening site."
        });
      }
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const assignment = await client.query(
      `SELECT a.facility_id
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
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "No active facility assigned to this user."
      });
    }

    const facilityId = assignment.rows[0].facility_id;

    const access = await client.query(
      `SELECT fn_user_has_patient_access($1, $2) AS allowed`,
      [req.user.userId, patientId]
    );

    if (!access.rows[0]?.allowed) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "You do not have access to this patient."
      });
    }

    // Normal and synthetic patients are both allowed.
    // Facility and deleted-patient checks are retained.
    const patient = await client.query(
      `SELECT id, patient_code, full_name
       FROM tbl_patients
       WHERE id = $1
         AND registered_facility_id = $2
         AND deleted_at IS NULL
       FOR SHARE`,
      [patientId, facilityId]
    );

    if (patient.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Patient not found in your assigned facility."
      });
    }

    const consent = await client.query(
      `SELECT c.id, c.granted
       FROM tbl_patient_consents c
       JOIN mst_consent_purposes p ON p.id = c.purpose_id
       WHERE c.patient_id = $1
         AND p.code = 'SCREENING'
         AND p.is_active = TRUE
       ORDER BY c.consent_seq DESC
       LIMIT 1`,
      [patientId]
    );

    if (
      consent.rowCount === 0 ||
      consent.rows[0].granted !== true
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "Screening consent is not currently granted.",
        requiredConsent: "SCREENING"
      });
    }

    const consentId = consent.rows[0].id;
    const requestKey = idempotency_key.trim();

    const existing = await client.query(
      `SELECT id, patient_id, case_state, screening_date
       FROM tbl_screenings
       WHERE examiner_id = $1
         AND idempotency_key = $2`,
      [req.user.userId, requestKey]
    );

    if (existing.rowCount > 0) {
      const previous = existing.rows[0];

      if (previous.patient_id !== patientId) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "This request key was already used for another patient."
        });
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        alreadyExists: true,
        screening: previous,
        message: "This screening request was already processed."
      });
    }

    const created = await client.query(
      `INSERT INTO tbl_screenings (
         patient_id,
         examiner_id,
         facility_id,
         screening_site_id,
         screening_date,
         case_state,
         clinical_exam_done,
         tobacco_current,
         chief_complaint,
         notes,
         idempotency_key,
         client_created_at
       )
       VALUES (
         $1, $2, $3, $4, CURRENT_DATE,
         'DRAFT', FALSE, $5, $6, $7, $8, NOW()
       )
       RETURNING id, patient_id, examiner_id,
                 facility_id, screening_date, case_state,
                 clinical_exam_done, created_at`,
      [
        patientId,
        req.user.userId,
        facilityId,
        siteId,
        tobacco_current ?? null,
        chief_complaint?.trim() || null,
        notes?.trim() || null,
        requestKey
      ]
    );

    const screeningId = created.rows[0].id;

    const updated = await client.query(
      `UPDATE tbl_screenings
       SET consent_id = $1,
           case_state = 'CONSENTED',
           version = version + 1
       WHERE id = $2
       RETURNING id, patient_id, examiner_id,
                 facility_id, screening_date, case_state,
                 consent_id, clinical_exam_done,
                 version, created_at`,
      [consentId, screeningId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Oral screening started successfully.",
      patient: patient.rows[0],
      screening: updated.rows[0]
    });

  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Screening rollback error:", rollbackError.message);
      }
    }

    console.error("Start screening error:", error);

    if (error.code === "23503" || error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid patient, user, facility, consent or screening reference."
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Duplicate screening request. Please check existing screenings."
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        success: false,
        message: "Database screening validation failed.",
        detail: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to start oral screening."
    });

  } finally {
    if (client) client.release();
  }
});

/* ========================================
   POST: SAVE ORAL SCREENING FINDING
======================================== */

router.post("/:screeningId/findings", authenticateToken, async (req, res) => {
  let client;

  try {
    if (req.user.role !== "HEALTH_WORKER") {
      return res.status(403).json({
        success: false,
        message: "Only Health Workers can record screening findings."
      });
    }

    const { screeningId } = req.params;

    const {
      finding_kind,
      symptom_id,
      oral_site,
      description,
      duration_days
    } = req.body;

    if (!UUID_PATTERN.test(screeningId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screening ID."
      });
    }

    if (!["SYMPTOM", "EXAM"].includes(finding_kind)) {
      return res.status(400).json({
        success: false,
        message: "Finding type must be SYMPTOM or EXAM."
      });
    }

    if (
      oral_site !== undefined &&
      oral_site !== null &&
      !VALID_ORAL_SITES.includes(oral_site)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid oral examination site."
      });
    }

    let symptomId = null;

    if (
      symptom_id !== undefined &&
      symptom_id !== null &&
      symptom_id !== ""
    ) {
      symptomId = Number(symptom_id);

      if (!Number.isSafeInteger(symptomId) || symptomId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid symptom ID."
        });
      }
    }

    const cleanDescription =
      typeof description === "string" ? description.trim() : "";

    if (cleanDescription.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Finding description is too long."
      });
    }

    if (!symptomId && !cleanDescription) {
      return res.status(400).json({
        success: false,
        message: "Provide a symptom ID or finding description."
      });
    }

    let durationDays = null;

    if (
      duration_days !== undefined &&
      duration_days !== null &&
      duration_days !== ""
    ) {
      durationDays = Number(duration_days);

      if (
        !Number.isSafeInteger(durationDays) ||
        durationDays < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Duration must be a non-negative whole number of days."
        });
      }
    }

    if (finding_kind === "SYMPTOM" && durationDays === null) {
      return res.status(400).json({
        success: false,
        message: "Symptom duration is required."
      });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const screeningResult = await client.query(
      `SELECT id, patient_id, case_state, consent_id
       FROM tbl_screenings
       WHERE id = $1
       FOR UPDATE`,
      [screeningId]
    );

    if (screeningResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Screening record not found."
      });
    }

    const screening = screeningResult.rows[0];

    const access = await client.query(
      `SELECT fn_user_has_patient_access($1, $2) AS allowed`,
      [req.user.userId, screening.patient_id]
    );

    if (!access.rows[0]?.allowed) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "You do not have access to this patient."
      });
    }

    if (screening.case_state !== "CONSENTED") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Findings can only be recorded for a consented screening."
      });
    }

    const consentResult = await client.query(
      `SELECT c.id, c.granted
       FROM tbl_patient_consents c
       JOIN mst_consent_purposes p ON p.id = c.purpose_id
       WHERE c.patient_id = $1
         AND p.code = 'SCREENING'
         AND p.is_active = TRUE
       ORDER BY c.consent_seq DESC
       LIMIT 1`,
      [screening.patient_id]
    );

    if (
      consentResult.rowCount === 0 ||
      consentResult.rows[0].granted !== true ||
      consentResult.rows[0].id !== screening.consent_id
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "Current screening consent is unavailable or has changed."
      });
    }

    const inserted = await client.query(
      `INSERT INTO tbl_screening_findings (
         screening_id,
         finding_kind,
         symptom_id,
         oral_site,
         description,
         duration_days,
         recorded_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, screening_id, finding_kind,
                 symptom_id, oral_site, description,
                 duration_days, recorded_by, recorded_at`,
      [
        screeningId,
        finding_kind,
        symptomId,
        oral_site || null,
        cleanDescription || null,
        durationDays,
        req.user.userId
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Screening finding saved successfully.",
      finding: inserted.rows[0]
    });

  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Finding rollback error:", rollbackError.message);
      }
    }

    console.error("Save screening finding error:", error);

    if (
      error.code === "23503" ||
      error.code === "22P02" ||
      error.code === "23514"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid screening, symptom, oral site or user reference."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to save screening finding."
    });

  } finally {
    if (client) client.release();
  }
});
/* ========================================
   POST: UPLOAD SCREENING PHOTOGRAPH
======================================== */

router.post(
  "/:screeningId/photos",
  authenticateToken,
  (req, res, next) => {
    photoUpload.single("photo")(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message || "Photo upload failed."
        });
      }
      next();
    });
  },
  async (req, res) => {
    let client;
    let savedFilePath = null;

    try {
      if (req.user.role !== "HEALTH_WORKER") {
        return res.status(403).json({
          success: false,
          message: "Only Health Workers can upload screening photographs."
        });
      }

      const { screeningId } = req.params;
      const { view_type, annotation_site, supersedes_photo_id } = req.body;

      if (!UUID_PATTERN.test(screeningId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screening ID."
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Select a photograph."
        });
      }

      if (!VALID_ORAL_SITES.includes(view_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid oral photograph view."
        });
      }

      if (
        annotation_site !== undefined &&
        annotation_site !== null &&
        (typeof annotation_site !== "string" ||
          annotation_site.length > 200)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid annotation site."
        });
      }

      if (
        supersedes_photo_id &&
        !UUID_PATTERN.test(supersedes_photo_id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid previous photograph reference."
        });
      }

      const metadata = await sharp(req.file.buffer, {
        failOn: "error",
        limitInputPixels: 40000000
      }).metadata();

      if (
        !["jpeg", "png", "webp"].includes(metadata.format) ||
        !metadata.width ||
        !metadata.height
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid or unsupported image file."
        });
      }

      const normalized = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 3000,
          height: 3000,
          fit: "inside",
          withoutEnlargement: true
        })
        .toFormat(metadata.format, {
          quality: 90
        })
        .toBuffer({
          resolveWithObject: true
        });

      const outputBuffer = normalized.data;
      const outputMetadata = normalized.info;

      if (
        outputBuffer.length === 0 ||
        outputBuffer.length > 10 * 1024 * 1024
      ) {
        return res.status(400).json({
          success: false,
          message: "Processed photograph is empty or exceeds 10 MB."
        });
      }

      const grayResult = await sharp(outputBuffer)
        .resize({
          width: 256,
          height: 256,
          fit: "inside"
        })
        .greyscale()
        .raw()
        .toBuffer({
          resolveWithObject: true
        });

      const quality = calculatePhotoQuality(
        grayResult.data,
        grayResult.info.width,
        grayResult.info.height
      );

      const checksum = crypto
        .createHash("sha256")
        .update(outputBuffer)
        .digest("hex");

      const extension = {
        jpeg: "jpg",
        png: "png",
        webp: "webp"
      }[metadata.format];

      const filename = `${crypto.randomUUID()}.${extension}`;
      const privateKey = `private_uploads/${filename}`;

      const mimeType = {
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp"
      }[metadata.format];

      client = await pool.connect();
      await client.query("BEGIN");

      const screeningResult = await client.query(
        `SELECT id, patient_id, case_state, consent_id
         FROM tbl_screenings
         WHERE id = $1
         FOR UPDATE`,
        [screeningId]
      );

      if (screeningResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Screening record not found."
        });
      }

      const screening = screeningResult.rows[0];

      const access = await client.query(
        `SELECT fn_user_has_patient_access($1, $2) AS allowed`,
        [req.user.userId, screening.patient_id]
      );

      if (!access.rows[0]?.allowed) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "You do not have access to this patient."
        });
      }

      if (screening.case_state !== "CONSENTED") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Photographs can only be added to a consented screening."
        });
      }

      const screeningConsent = await client.query(
        `SELECT c.id, c.granted
         FROM tbl_patient_consents c
         JOIN mst_consent_purposes p ON p.id = c.purpose_id
         WHERE c.patient_id = $1
           AND p.code = 'SCREENING'
           AND p.is_active = TRUE
         ORDER BY c.consent_seq DESC
         LIMIT 1`,
        [screening.patient_id]
      );

      if (
        screeningConsent.rowCount === 0 ||
        screeningConsent.rows[0].granted !== true ||
        screeningConsent.rows[0].id !== screening.consent_id
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Current screening consent is unavailable."
        });
      }

      const imageConsent = await client.query(
        `SELECT c.granted
         FROM tbl_patient_consents c
         JOIN mst_consent_purposes p ON p.id = c.purpose_id
         WHERE c.patient_id = $1
           AND p.code = 'IMAGE_CAPTURE'
           AND p.is_active = TRUE
         ORDER BY c.consent_seq DESC
         LIMIT 1`,
        [screening.patient_id]
      );

      if (
        imageConsent.rowCount === 0 ||
        imageConsent.rows[0].granted !== true
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Image capture consent is not currently granted.",
          requiredConsent: "IMAGE_CAPTURE"
        });
      }

      if (supersedes_photo_id) {
        const previousPhoto = await client.query(
          `SELECT id, status
           FROM tbl_screening_photos
           WHERE id = $1
             AND screening_id = $2
             AND patient_id = $3
           FOR UPDATE`,
          [
            supersedes_photo_id,
            screeningId,
            screening.patient_id
          ]
        );

        if (previousPhoto.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            message: "Previous photograph does not belong to this screening."
          });
        }
      }

      savedFilePath = path.join(PRIVATE_UPLOAD_DIR, filename);

      await fs.promises.writeFile(
        savedFilePath,
        outputBuffer,
        {
          flag: "wx",
          mode: 0o600
        }
      );

      if (supersedes_photo_id) {
        await client.query(
          `UPDATE tbl_screening_photos
           SET status = 'SUPERSEDED'
           WHERE id = $1`,
          [supersedes_photo_id]
        );
      }

      const photoStatus =
        quality.status === "ACCEPTABLE"
          ? "ACCEPTED"
          : "QUALITY_FAILED";

      const photoResult = await client.query(
        `INSERT INTO tbl_screening_photos (
           screening_id,
           patient_id,
           view_type,
           annotation_site,
           private_key,
           checksum_sha256,
           mime_type,
           size_bytes,
           width_px,
           height_px,
           metadata_stripped,
           status,
           supersedes_photo_id,
           captured_by,
           captured_at,
           idempotency_key
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, TRUE, $11, $12,
           $13, NOW(), $14
         )
         RETURNING
           id, screening_id, patient_id, view_type,
           annotation_site, mime_type, size_bytes,
           width_px, height_px, metadata_stripped,
           status, captured_at`,
        [
          screeningId,
          screening.patient_id,
          view_type,
          annotation_site || null,
          privateKey,
          checksum,
          mimeType,
          outputBuffer.length,
          outputMetadata.width,
          outputMetadata.height,
          photoStatus,
          supersedes_photo_id || null,
          req.user.userId,
          crypto.randomUUID()
        ]
      );

      const photo = photoResult.rows[0];

      await client.query(
        `INSERT INTO tbl_image_quality_results (
           photo_id,
           checker_version,
           status,
           reason,
           blur_score,
           brightness_mean,
           glare_ratio,
           checked_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          photo.id,
          "basic-quality-1.0",
          quality.status,
          quality.reason,
          quality.blurScore,
          quality.brightnessMean,
          quality.glareRatio
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message:
          quality.status === "ACCEPTABLE"
            ? "Photograph uploaded. Technical quality check passed."
            : "Photograph uploaded but needs recapture.",
        photo,
        quality: {
          status: quality.status,
          reason: quality.reason,
          blur_score: quality.blurScore,
          brightness_mean: quality.brightnessMean,
          glare_ratio: quality.glareRatio
        },
        nextAction:
          quality.status === "ACCEPTABLE"
            ? "CONTINUE"
            : "RECAPTURE"
      });

    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Photo rollback error:",
            rollbackError.message
          );
        }
      }

      if (savedFilePath) {
        try {
          await fs.promises.unlink(savedFilePath);
        } catch (fileError) {
          if (fileError.code !== "ENOENT") {
            console.error(
              "Private photo cleanup error:",
              fileError.message
            );
          }
        }
      }

      console.error("Screening photo upload error:", error);

      if (
        error.code === "23503" ||
        error.code === "22P02" ||
        error.code === "23514"
      ) {
        return res.status(400).json({
          success: false,
          message: "Photo database validation failed.",
          detail: error.message
        });
      }

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This photograph has already been recorded."
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to upload screening photograph."
      });

    } finally {
      if (client) client.release();
    }
  }
);

/* ========================================
   TASK 4: AI-ASSISTED DEMONSTRATION ASSESSMENT
======================================== */

router.post(
  "/:screeningId/ai-assessments",
  authenticateToken,
  async (req, res) => {
    let client;

    try {
      if (req.user.role !== "HEALTH_WORKER") {
        return res.status(403).json({
          success: false,
          message: "Only Health Workers can request AI assessment."
        });
      }

      const { screeningId } = req.params;
      const { photo_id } = req.body;

      if (
        !UUID_PATTERN.test(screeningId) ||
        !UUID_PATTERN.test(photo_id || "")
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid screening or photo ID."
        });
      }

      client = await pool.connect();
      await client.query("BEGIN");

      const screeningResult = await client.query(
        `SELECT id, patient_id, case_state
         FROM tbl_screenings
         WHERE id = $1
         FOR SHARE`,
        [screeningId]
      );

      if (screeningResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Screening not found."
        });
      }

      const screening = screeningResult.rows[0];

      if (screening.case_state !== "CONSENTED") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Screening consent is required."
        });
      }

      const access = await client.query(
        `SELECT fn_user_has_patient_access($1, $2) AS allowed`,
        [req.user.userId, screening.patient_id]
      );

      if (!access.rows[0]?.allowed) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Patient access denied."
        });
      }

      const consentResult = await client.query(
        `SELECT p.code, c.granted
         FROM tbl_patient_consents c
         JOIN mst_consent_purposes p ON p.id = c.purpose_id
         WHERE c.patient_id = $1
           AND p.code IN ('SCREENING', 'IMAGE_CAPTURE')
         ORDER BY c.consent_seq DESC`,
        [screening.patient_id]
      );

      const latestConsents = {};

      for (const row of consentResult.rows) {
        if (!(row.code in latestConsents)) {
          latestConsents[row.code] = row.granted;
        }
      }

      if (
        latestConsents.SCREENING !== true ||
        latestConsents.IMAGE_CAPTURE !== true
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Screening and image capture consent are required."
        });
      }

      const photoResult = await client.query(
        `SELECT p.id, p.status, q.status AS quality_status
         FROM tbl_screening_photos p
         LEFT JOIN LATERAL (
           SELECT status
           FROM tbl_image_quality_results
           WHERE photo_id = p.id
           ORDER BY checked_at DESC
           LIMIT 1
         ) q ON TRUE
         WHERE p.id = $1
           AND p.screening_id = $2
           AND p.patient_id = $3
         FOR SHARE OF p`,
        [photo_id, screeningId, screening.patient_id]
      );

      if (photoResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Photo not found for this screening."
        });
      }

      const photo = photoResult.rows[0];

      const modelResult = await client.query(
        `SELECT id, provider, model_version
         FROM mst_ai_models
         WHERE is_active = TRUE
           AND clinical_use = FALSE
           AND is_research_only = TRUE
         ORDER BY id
         LIMIT 1`
      );

      if (modelResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(503).json({
          success: false,
          message: "Demo AI model is not configured."
        });
      }

      const model = modelResult.rows[0];

      const suitable =
        photo.status === "ACCEPTED" &&
        photo.quality_status === "ACCEPTABLE";

      const resultLabel = suitable
        ? "SUSPICIOUS_FOR_CLINICAL_REVIEW"
        : "IMAGE_INSUFFICIENT";

      const assessmentResult = await client.query(
        `INSERT INTO tbl_ai_assessments (
           screening_id,
           photo_id,
           ai_model_id,
           model_provider,
           model_version,
           status,
           result_label,
           image_quality_status,
           clinical_use,
           requires_clinician_review,
           warning,
           requested_by,
           requested_at,
           completed_at
         )
         VALUES (
           $1, $2, $3, $4, $5,
           'COMPLETED', $6, $7, FALSE, TRUE,
           'NOT FOR CLINICAL USE - FIXED MOCK DEMONSTRATION OUTPUT',
           $8, NOW(), NOW()
         )
         RETURNING *`,
        [
          screeningId,
          photo_id,
          model.id,
          model.provider,
          model.model_version,
          resultLabel,
          suitable ? "ACCEPTABLE" : "RECAPTURE",
          req.user.userId
        ]
      );

      const assessment = assessmentResult.rows[0];

      await client.query(
        `INSERT INTO tbl_ai_assessment_logs (
           assessment_id,
           event,
           http_status,
           latency_ms
         )
         VALUES ($1, $2, $3, $4)`,
        [
          assessment.id,
          "MOCK_DEMONSTRATION_COMPLETED",
          200,
          0
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        assessment,
        displayLabel: suitable
          ? "Suspicious Finding for Clinical Review"
          : "Image Insufficient",
        warning: "NOT FOR CLINICAL USE",
        limitations: [
          "This is a fixed mock demonstration output.",
          "The image was not analysed by a real AI model.",
          "A Medical Officer must review the case."
        ]
      });

    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(rollbackError.message);
        }
      }

      console.error("AI assessment error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to complete AI demonstration assessment."
      });

    } finally {
      if (client) client.release();
    }
  }
);
/* ========================================
   TASK 5: MEDICAL OFFICER PENDING REVIEW QUEUE
======================================== */

router.get(
  "/medical-officer/pending-reviews",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "MEDICAL_OFFICER") {
        return res.status(403).json({
          success: false,
          message: "Medical Officer access only."
        });
      }

      const result = await pool.query(
        `SELECT
           s.id AS screening_id,
           s.patient_id,
           s.screening_date,
           s.case_state,
           s.created_at,
           p.patient_code,
           p.full_name AS patient_name,

           (
             SELECT COUNT(*)
             FROM tbl_screening_photos ph
             WHERE ph.screening_id = s.id
               AND ph.status <> 'SUPERSEDED'
           ) AS photo_count,

           (
             SELECT COUNT(*)
             FROM tbl_screening_findings sf
             WHERE sf.screening_id = s.id
           ) AS finding_count,

           ai.result_label AS ai_result,
           ai.model_provider,
           ai.model_version,
           ai.status AS ai_status,
           ai.warning AS ai_warning,

           cr.id AS clinical_review_id,
           cr.signed_at AS review_signed_at

         FROM tbl_case_assignments ca

         JOIN tbl_patients p
           ON p.id = ca.patient_id

         JOIN tbl_screenings s
           ON s.patient_id = ca.patient_id

         LEFT JOIN tbl_clinical_reviews cr
           ON cr.screening_id = s.id

         LEFT JOIN LATERAL (
           SELECT
             a.result_label,
             a.model_provider,
             a.model_version,
             a.status,
             a.warning
           FROM tbl_ai_assessments a
           WHERE a.screening_id = s.id
           ORDER BY a.requested_at DESC
           LIMIT 1
         ) ai ON TRUE

         WHERE ca.user_id = $1
           AND ca.valid_from <= NOW()
           AND (ca.valid_to IS NULL OR ca.valid_to >= NOW())
           AND s.case_state = 'CONSENTED'
           AND p.deleted_at IS NULL
           AND cr.signed_at IS NULL

         ORDER BY s.created_at ASC`,
        [req.user.userId]
      );

      return res.status(200).json({
        success: true,
        count: result.rowCount,
        reviews: result.rows
      });

    } catch (error) {
      console.error("Medical Officer pending queue error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load pending review queue."
      });
    }
  }
);


/* ========================================
   TASK 5: MEDICAL OFFICER CASE DETAILS
======================================== */

router.get(
  "/medical-officer/reviews/:screeningId",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.user.role !== "MEDICAL_OFFICER") {
        return res.status(403).json({
          success: false,
          message: "Medical Officer access only."
        });
      }

      const { screeningId } = req.params;

      if (!UUID_PATTERN.test(screeningId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screening ID."
        });
      }

      const caseResult = await pool.query(
        `SELECT
           s.id AS screening_id,
           s.patient_id,
           s.screening_date,
           s.case_state,
           s.chief_complaint,
           s.tobacco_current,
           s.notes,
           s.created_at,
           p.patient_code,
           p.full_name AS patient_name

         FROM tbl_screenings s

         JOIN tbl_patients p
           ON p.id = s.patient_id

         WHERE s.id = $1
           AND s.case_state = 'CONSENTED'
           AND p.deleted_at IS NULL

           AND EXISTS (
             SELECT 1
             FROM tbl_case_assignments ca
             WHERE ca.patient_id = s.patient_id
               AND ca.user_id = $2
               AND ca.valid_from <= NOW()
               AND (
                 ca.valid_to IS NULL
                 OR ca.valid_to >= NOW()
               )
           )

         LIMIT 1`,
        [screeningId, req.user.userId]
      );

      if (caseResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Assigned patient case not found."
        });
      }

      const patientId = caseResult.rows[0].patient_id;

      const [
        consentResult,
        findingResult,
        photoResult,
        aiResult,
        reviewResult
      ] = await Promise.all([

        pool.query(
          `SELECT
             p.code AS purpose,
             c.granted,
             c.consent_seq
           FROM tbl_patient_consents c
           JOIN mst_consent_purposes p ON p.id = c.purpose_id
           WHERE c.patient_id = $1
           ORDER BY p.code, c.consent_seq DESC`,
          [patientId]
        ),

        pool.query(
          `SELECT
             id,
             finding_kind,
             symptom_id,
             oral_site,
             description,
             duration_days,
             recorded_by,
             recorded_at
           FROM tbl_screening_findings
           WHERE screening_id = $1
           ORDER BY recorded_at`,
          [screeningId]
        ),

        pool.query(
          `SELECT
             ph.id,
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
           WHERE ph.screening_id = $1
           ORDER BY ph.captured_at`,
          [screeningId]
        ),

        pool.query(
          `SELECT
             id,
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
           WHERE screening_id = $1
           ORDER BY requested_at DESC`,
          [screeningId]
        ),

        pool.query(
          `SELECT
             id,
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
           WHERE screening_id = $1
           ORDER BY version DESC`,
          [screeningId]
        )
      ]);

      const latestConsents = {};

      for (const consent of consentResult.rows) {
        if (!latestConsents[consent.purpose]) {
          latestConsents[consent.purpose] = consent;
        }
      }

      return res.status(200).json({
        success: true,

        patient: {
          patient_id: patientId,
          patient_code: caseResult.rows[0].patient_code,
          patient_name: caseResult.rows[0].patient_name
        },

        screening: caseResult.rows[0],
        consents: Object.values(latestConsents),
        findings: findingResult.rows,
        photographs: photoResult.rows,
        aiAssessments: aiResult.rows,
        clinicalReviews: reviewResult.rows,

        limitations: [
          "Photographs are not included as public URLs.",
          "AI output is advisory demonstration data only.",
          "Clinical decisions must be made by the Medical Officer."
        ]
      });

    } catch (error) {
      console.error("Medical Officer case details error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load patient case details."
      });
    }
  }
);


/* ========================================
   TASK 5: SIGN AND SUBMIT CLINICAL REVIEW
======================================== */

router.post(
  "/medical-officer/reviews/:screeningId/submit",
  authenticateToken,
  async (req, res) => {
    let client;

    try {
      if (req.user.role !== "MEDICAL_OFFICER") {
        return res.status(403).json({
          success: false,
          message: "Medical Officer access only."
        });
      }

      const { screeningId } = req.params;

      if (!UUID_PATTERN.test(screeningId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screening ID."
        });
      }

      const {
        finding,
        impression,
        ai_agreement,
        ai_discrepancy_note,
        decision,
        followup_instructions,
        referral_reason,
        request_note
      } = req.body;

      const validAgreements = [
        "NOT_AVAILABLE",
        "AGREE",
        "DISAGREE",
        "DEFER"
      ];

      const validDecisions = [
        "NO_ACTION",
        "ROUTINE_FOLLOW_UP",
        "RESCREEN",
        "REQUEST_RECAPTURE",
        "REQUEST_MORE_INFO",
        "SPECIALIST_REVIEW",
        "URGENT_REFERRAL"
      ];

      if (
        typeof finding !== "string" ||
        !finding.trim() ||
        finding.trim().length > 5000
      ) {
        return res.status(400).json({
          success: false,
          message: "Clinical findings are required (maximum 5000 characters)."
        });
      }

      if (
        impression !== undefined &&
        impression !== null &&
        (
          typeof impression !== "string" ||
          impression.length > 5000
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid clinical impression."
        });
      }

      if (!validAgreements.includes(ai_agreement)) {
        return res.status(400).json({
          success: false,
          message: "Select a valid AI agreement option."
        });
      }

      if (!validDecisions.includes(decision)) {
        return res.status(400).json({
          success: false,
          message: "Select a valid clinical decision."
        });
      }

      if (
        ai_agreement === "DISAGREE" &&
        (
          typeof ai_discrepancy_note !== "string" ||
          !ai_discrepancy_note.trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Explain why you disagree with the AI output."
        });
      }

      if (
        ["REQUEST_RECAPTURE", "REQUEST_MORE_INFO"].includes(decision) &&
        (
          typeof request_note !== "string" ||
          !request_note.trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "A request note is required for this decision."
        });
      }

      for (const [field, value] of Object.entries({
        ai_discrepancy_note,
        followup_instructions,
        referral_reason,
        request_note
      })) {
        if (
          value !== undefined &&
          value !== null &&
          (
            typeof value !== "string" ||
            value.length > 5000
          )
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field}.`
          });
        }
      }

      client = await pool.connect();
      await client.query("BEGIN");

      const caseResult = await client.query(
        `SELECT
           s.id,
           s.patient_id,
           s.case_state
         FROM tbl_screenings s
         JOIN tbl_patients p ON p.id = s.patient_id
         WHERE s.id = $1
           AND s.case_state = 'CONSENTED'
           AND p.deleted_at IS NULL
           AND EXISTS (
             SELECT 1
             FROM tbl_case_assignments ca
             WHERE ca.patient_id = s.patient_id
               AND ca.user_id = $2
               AND ca.valid_from <= NOW()
               AND (
                 ca.valid_to IS NULL
                 OR ca.valid_to >= NOW()
               )
           )
         FOR UPDATE OF s`,
        [screeningId, req.user.userId]
      );

      if (caseResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Assigned screening case not found."
        });
      }

      const patientId = caseResult.rows[0].patient_id;

      const consentResult = await client.query(
        `SELECT c.granted
         FROM tbl_patient_consents c
         JOIN mst_consent_purposes p ON p.id = c.purpose_id
         WHERE c.patient_id = $1
           AND p.code = 'SCREENING'
           AND p.is_active = TRUE
         ORDER BY c.consent_seq DESC
         LIMIT 1`,
        [patientId]
      );

      if (
        consentResult.rowCount === 0 ||
        consentResult.rows[0].granted !== true
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Current screening consent is not granted."
        });
      }

      const existingReview = await client.query(
        `SELECT id, signed_at
         FROM tbl_clinical_reviews
         WHERE screening_id = $1
         FOR UPDATE`,
        [screeningId]
      );

      if (existingReview.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "A clinical review already exists. Do not overwrite it.",
          review: existingReview.rows[0]
        });
      }

      const aiResult = await client.query(
        `SELECT id
         FROM tbl_ai_assessments
         WHERE screening_id = $1
         ORDER BY requested_at DESC
         LIMIT 1`,
        [screeningId]
      );

      const aiAssessmentId =
        aiResult.rowCount > 0
          ? aiResult.rows[0].id
          : null;

      if (ai_agreement !== "NOT_AVAILABLE" && !aiAssessmentId) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "No AI assessment is available for this screening."
        });
      }

      const signedTimeResult = await client.query(
        "SELECT NOW() AS signed_at"
      );

      const signedAt = signedTimeResult.rows[0].signed_at;

      const signaturePayload = {
        screeningId,
        patientId,
        doctorId: req.user.userId,
        finding: finding.trim(),
        impression: impression?.trim() || null,
        aiAssessmentId,
        aiAgreement: ai_agreement,
        aiDiscrepancyNote: ai_discrepancy_note?.trim() || null,
        decision,
        followupInstructions: followup_instructions?.trim() || null,
        referralReason: referral_reason?.trim() || null,
        requestNote: request_note?.trim() || null,
        signedAt
      };

      const signatureHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(signaturePayload))
        .digest("hex");

      const reviewResult = await client.query(
        `INSERT INTO tbl_clinical_reviews (
           screening_id,
           patient_id,
           doctor_id,
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
           signed_at,
           signature_hash
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12, 1, $13, $14
         )
         RETURNING
           id,
           screening_id,
           patient_id,
           doctor_id,
           finding,
           impression,
           ai_assessment_id,
           ai_agreement,
           decision,
           followup_instructions,
           referral_reason,
           request_note,
           version,
           signed_at`,
        [
          screeningId,
          patientId,
          req.user.userId,
          finding.trim(),
          impression?.trim() || null,
          aiAssessmentId,
          ai_agreement,
          ai_discrepancy_note?.trim() || null,
          decision,
          followup_instructions?.trim() || null,
          referral_reason?.trim() || null,
          request_note?.trim() || null,
          signedAt,
          signatureHash
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Clinical review signed and submitted successfully.",
        review: reviewResult.rows[0],
        signatureHash,
        limitations: [
          "This SHA-256 hash is an integrity check, not a legally certified digital signature.",
          "AI output remains separate from the Medical Officer's clinical decision."
        ]
      });

    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Review rollback error:",
            rollbackError.message
          );
        }
      }

      console.error("Clinical review submission error:", error);

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "A review already exists for this screening."
        });
      }

      if (
        ["23503", "22P02", "23514", "23502"].includes(error.code)
      ) {
        return res.status(400).json({
          success: false,
          message: "Clinical review validation failed.",
          detail: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to submit clinical review."
      });

    } finally {
      if (client) client.release();
    }
  }
);


/* ========================================
   EXPORT ROUTER
======================================== */

module.exports = router;