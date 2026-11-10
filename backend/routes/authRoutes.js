

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { verify, generateSecret, generateURI } = require("otplib");
const QRCode = require("qrcode");
const { pool } = require("../db");
const { encryptSecret, decryptSecret } = require("../mfaEncryption");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/authMiddleware");

const router = express.Router();

const JWT_ISSUER = "Aarogya Drishti";
const JWT_AUDIENCE = "Aarogya Drishti Application";

const STAFF_ROLES = [
  "HEALTH_WORKER",
  "MEDICAL_OFFICER",
  "SPECIALIST",
  "NAVIGATOR",
  "HOSPITAL_STAFF",
];

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or too short.");
  }
  return secret;
};

const getAdminDistrict = async (userId, client = pool) => {
  const result = await client.query(
    `SELECT DISTINCT f.district_id
     FROM tbl_user_facility_assignments ufa
     INNER JOIN mst_facilities f ON f.id = ufa.facility_id
     WHERE ufa.user_id = $1
       AND f.facility_type = 'DISTRICT_OFFICE'
       AND f.is_active = TRUE
       AND ufa.valid_from <= CURRENT_DATE
       AND (ufa.valid_to IS NULL OR ufa.valid_to >= CURRENT_DATE)`,
    [userId]
  );

  if (result.rowCount !== 1) {
    throw new Error(
      "District Admin must have exactly one active District Office assignment."
    );
  }

  return result.rows[0].district_id;
};

const canReviewRegistration = async (user, registration, client = pool) => {
  if (user.role === "SYSTEM_ADMIN") {
    return ["DISTRICT_ADMIN", "MEDICAL_OFFICER"].includes(
      registration.requested_role
    );
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (
      !STAFF_ROLES.includes(registration.requested_role) ||
      registration.requested_role === "MEDICAL_OFFICER"
    ) {
      return false;
    }

    const adminDistrict = await getAdminDistrict(user.userId, client);

    const facilityResult = await client.query(
      `SELECT district_id
       FROM mst_facilities
       WHERE id = $1 AND is_active = TRUE`,
      [registration.facility_id]
    );

    return (
      facilityResult.rowCount === 1 &&
      String(adminDistrict) ===
        String(facilityResult.rows[0].district_id)
    );
  }

  return false;
};

// ==========================================
// 1. COMMON STAFF SELF REGISTRATION
// ==========================================

const submitStaffRegistration = async (req, res, forcedRole = null) => {
  try {
    const {
      fullName,
      username,
      phone,
      email,
      designation,
      employeeRef,
      facilityId,
      languageId,
      password,
      termsAccepted,
      requestedRole,
    } = req.body;

    const rawRole = forcedRole || requestedRole;
    const role =
      typeof rawRole === "string"
        ? rawRole.trim().toUpperCase().replace(/[\s-]+/g, "_")
        : "";

    const allowedRegistrationRoles = [
      ...STAFF_ROLES,
      "DISTRICT_ADMIN",
    ];

    if (!allowedRegistrationRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration role.",
      });
    }

    if (
      typeof fullName !== "string" ||
      typeof username !== "string" ||
      typeof phone !== "string" ||
      typeof designation !== "string" ||
      typeof password !== "string" ||
      !fullName.trim() ||
      !username.trim() ||
      !phone.trim() ||
      !designation.trim() ||
      !facilityId ||
      !languageId ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    if (!/^[0-9]{10}$/.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number.",
      });
    }

    if (termsAccepted !== true) {
      return res.status(400).json({
        success: false,
        message: "Please accept terms and conditions.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    const duplicate = await pool.query(
      `SELECT id
       FROM tbl_users
       WHERE LOWER(username) = LOWER($1)
         AND deleted_at IS NULL
       UNION ALL
       SELECT id
       FROM tbl_user_registration_requests
       WHERE LOWER(username) = LOWER($1)
         AND status = 'PENDING'
       LIMIT 1`,
      [username.trim()]
    );

    if (duplicate.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Username already exists or is awaiting approval.",
      });
    }

    const roleResult = await pool.query(
      `SELECT id
       FROM mst_roles
       WHERE code = $1
         AND is_active = TRUE`,
      [role]
    );

    if (roleResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Selected registration role is not active.",
      });
    }

    const facilityResult = await pool.query(
      `SELECT id, facility_type
       FROM mst_facilities
       WHERE id = $1
         AND is_active = TRUE`,
      [facilityId]
    );

    if (facilityResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive facility.",
      });
    }

    if (
      role === "DISTRICT_ADMIN" &&
      facilityResult.rows[0].facility_type !== "DISTRICT_OFFICE"
    ) {
      return res.status(400).json({
        success: false,
        message: "District Admin must select the District Office facility.",
      });
    }

    const languageResult = await pool.query(
      `SELECT id
       FROM mst_languages
       WHERE id = $1
         AND is_active = TRUE`,
      [languageId]
    );

    if (languageResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive language.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO tbl_user_registration_requests (
         full_name,
         username,
         phone,
         email,
         designation,
         employee_ref,
         facility_id,
         language_id,
         password_hash,
         requested_role,
         terms_accepted_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       RETURNING id, username, requested_role, status, created_at`,
      [
        fullName.trim(),
        username.trim(),
        phone.trim(),
        email ? String(email).trim() : null,
        designation.trim(),
        employeeRef ? String(employeeRef).trim() : null,
        facilityId,
        languageId,
        passwordHash,
        role,
      ]
    );

    const approvalMessage =
      role === "MEDICAL_OFFICER" || role === "DISTRICT_ADMIN"
        ? "Registration submitted successfully. Awaiting System Admin approval."
        : "Registration submitted successfully. Awaiting District Admin approval.";

    return res.status(201).json({
      success: true,
      message: approvalMessage,
      registration: result.rows[0],
    });
  } catch (error) {
    console.error("STAFF REGISTRATION ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

// Public staff registration endpoint.
// New accounts remain pending until approved.
router.post("/register", (req, res) =>
  submitStaffRegistration(req, res)
);

// Medical Officer registration endpoint retained for compatibility.
router.post("/medical-officer/register", (req, res) =>
  submitStaffRegistration(req, res, "MEDICAL_OFFICER")
);

// ==========================================
// 3. DISTRICT ADMIN MFA SETUP
// ==========================================

router.post("/mfa/setup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.status,
              u.mfa_enabled, r.code AS role_code
       FROM tbl_users u
       INNER JOIN mst_roles r ON r.id = u.role_id
       WHERE LOWER(u.username) = LOWER($1)
         AND u.deleted_at IS NULL`,
      [username.trim()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    if (
      user.status !== "ACTIVE" ||
      user.role_code !== "DISTRICT_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "MFA setup is available only for an active District Admin account.",
      });
    }

    if (user.mfa_enabled === true) {
      return res.status(409).json({
        success: false,
        message: "MFA is already enabled for this account.",
      });
    }

    const secret = generateSecret();

    const otpauthUrl = generateURI({
      issuer: JWT_ISSUER,
      label: user.username,
      secret,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    const encryptedData = encryptSecret(secret);

    await pool.query(
      `UPDATE tbl_users
       SET mfa_secret_encrypted = $1
       WHERE id = $2 AND mfa_enabled = FALSE`,
      [JSON.stringify(encryptedData), user.id]
    );

    return res.status(200).json({
      success: true,
      message:
        "Scan the QR code with your authenticator app, then verify the 6-digit code.",
      qrCodeDataUrl,
      secret,
    });
  } catch (error) {
    console.error("MFA SETUP ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to start MFA setup.",
    });
  }
});

router.post("/mfa/verify-setup", async (req, res) => {
  try {
    const { username, password, otp } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||

      typeof otp !== "string" ||
      !username.trim() ||
      !password ||
      !/^\d{6}$/.test(otp.trim())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Username, password and a valid 6-digit OTP are required.",
      });
    }


    const result = await pool.query(      `SELECT u.id, u.username, u.password_hash, u.status,
              u.mfa_enabled, u.mfa_secret_encrypted,
              r.code AS role_code
       FROM tbl_users u
       INNER JOIN mst_roles r ON r.id = u.role_id
       WHERE LOWER(u.username) = LOWER($1)

         AND u.deleted_at IS NULL`,
      [username.trim()]
    );


    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    if (
      user.status !== "ACTIVE" ||
      user.role_code !== "DISTRICT_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "MFA verification is available only for an active District Admin account.",
      });
    }

    if (user.mfa_enabled === true || !user.mfa_secret_encrypted) {
      return res.status(409).json({
        success: false,
        message: "Start MFA setup first, or MFA is already enabled.",
      });
    }

    const encryptedData =
      typeof user.mfa_secret_encrypted === "string"
        ? JSON.parse(user.mfa_secret_encrypted)
        : user.mfa_secret_encrypted;

    const secret = decryptSecret(encryptedData);

    const verification = await verify({
      secret,
      token: otp.trim(),
    });

    if (!verification || verification.valid !== true) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authenticator code. Try the latest 6-digit code.",
      });
    }

    await pool.query(
      `UPDATE tbl_users
       SET mfa_enabled = TRUE
       WHERE id = $1 AND mfa_enabled = FALSE`,
      [user.id]
    );

    return res.status(200).json({
      success: true,
      message: "District Admin MFA enabled successfully.",
    });
  } catch (error) {
    console.error("MFA VERIFY SETUP ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify MFA setup.",
    });
  }
});

// ==========================================
// 4. COMMON LOGIN
// ==========================================

const loginUser = async (req, res, expectedRole = null) => {
  try {
    const { username, password, otp } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.password_hash,
              u.status, u.mfa_enabled, u.mfa_secret_encrypted,
              u.must_change_password, r.code AS role_code,
              r.mfa_required, current_database() AS database_name
       FROM tbl_users u
       INNER JOIN mst_roles r ON r.id = u.role_id
       WHERE LOWER(u.username) = LOWER($1)
         AND u.deleted_at IS NULL
         AND r.is_active = TRUE`,
      [username.trim()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const user = result.rows[0];

    console.log("LOGIN USER FOUND:", result.rowCount);
    console.log("LOGIN DATABASE:", user.database_name);
    console.log("LOGIN USERNAME:", user.username);
    console.log("LOGIN ROLE:", user.role_code);
    console.log("LOGIN STATUS:", user.status);
    console.log("DATABASE HASH LENGTH:", user.password_hash?.length);
    console.log("DATABASE HASH PREFIX:", user.password_hash?.slice(0, 4));

    if (expectedRole && user.role_code !== expectedRole) {
      return res.status(403).json({
        success: false,
        message: "Please use the correct login.",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message:
          "Your account is not active. Contact administrator.",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    console.log("PASSWORD MATCH:", validPassword);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    if (user.mfa_required === true && user.role_code !== "DISTRICT_ADMIN") {
      if (
        user.mfa_enabled !== true ||
        !user.mfa_secret_encrypted ||
        typeof otp !== "string" ||
        !/^\d{6}$/.test(otp.trim())
      ) {
        return res.status(403).json({
          success: false,
          message:
            "MFA setup and a valid 6-digit OTP are required.",
        });
      }

      const encryptedData =
        typeof user.mfa_secret_encrypted === "string"
          ? JSON.parse(user.mfa_secret_encrypted)
          : user.mfa_secret_encrypted;

      const secret = decryptSecret(encryptedData);

      const verification = await verify({
        secret,
        token: otp.trim(),
      });

      if (!verification || verification.valid !== true) {
        return res.status(401).json({
          success: false,
          message: "Invalid authenticator code.",
        });
      }
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role_code,
      },
      getJwtSecret(),
      {
        expiresIn: "15m",
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }
    );

    await pool.query(
      `UPDATE tbl_users
       SET last_login_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role_code,
        mustChangePassword: user.must_change_password,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login could not be completed.",
    });
  }
};

router.post("/login", (req, res) => loginUser(req, res));

router.post("/worker-login", (req, res) =>
  loginUser(req, res, "HEALTH_WORKER")
);

router.post("/medical-officer-login", (req, res) =>
  loginUser(req, res, "MEDICAL_OFFICER")
);

// ==========================================
// 5. GET PENDING REGISTRATIONS
// ==========================================

router.get(
  "/admin/pending-registrations",
  authenticateToken,
  requireRole("SYSTEM_ADMIN", "DISTRICT_ADMIN"),
  async (req, res) => {
    try {
      let result;

      if (req.user.role === "SYSTEM_ADMIN") {
        result = await pool.query(
          `SELECT rr.id, rr.full_name, rr.username, rr.phone, rr.email,
                  rr.designation, rr.employee_ref, rr.facility_id,
                  rr.language_id, rr.requested_role, rr.status, rr.created_at,
                  f.name_en AS facility_name, f.district_id,
                  d.name_en AS district_name
           FROM tbl_user_registration_requests rr
           INNER JOIN mst_facilities f ON f.id = rr.facility_id
           INNER JOIN mst_districts d ON d.id = f.district_id
           WHERE rr.status = 'PENDING'
             AND rr.requested_role = ANY($1::text[])
           ORDER BY rr.created_at ASC`,
          [["DISTRICT_ADMIN", "MEDICAL_OFFICER"]]
        );
      } else {
        const districtId = await getAdminDistrict(req.user.userId);

        const districtStaffRoles = STAFF_ROLES.filter(
          (role) => role !== "MEDICAL_OFFICER"
        );

        result = await pool.query(
          `SELECT rr.id, rr.full_name, rr.username, rr.phone, rr.email,
                  rr.designation, rr.employee_ref, rr.facility_id,
                  rr.language_id, rr.requested_role, rr.status, rr.created_at,
                  f.name_en AS facility_name, f.district_id,
                  d.name_en AS district_name
           FROM tbl_user_registration_requests rr
           INNER JOIN mst_facilities f ON f.id = rr.facility_id
           INNER JOIN mst_districts d ON d.id = f.district_id
           WHERE rr.status = 'PENDING'
             AND rr.requested_role = ANY($1::text[])
             AND f.district_id = $2
           ORDER BY rr.created_at ASC`,
          [districtStaffRoles, districtId]
        );
      }

      return res.status(200).json({
        success: true,
        registrations: result.rows,
      });
    } catch (error) {
      console.error("PENDING REGISTRATIONS ERROR:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to fetch pending registrations.",
      });
    }
  }
);

// ==========================================
// 6. APPROVE REGISTRATION
// ==========================================

router.post(
  "/admin/approve-registration/:id",
  authenticateToken,
  requireRole("SYSTEM_ADMIN", "DISTRICT_ADMIN"),
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const requestId = req.params.id;

      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          requestId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid registration ID.",
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const requestResult = await client.query(
        `SELECT *
         FROM tbl_user_registration_requests
         WHERE id = $1 AND status = 'PENDING'
         FOR UPDATE`,
        [requestId]
      );

      if (requestResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Pending registration not found.",
        });
      }

      const registration = requestResult.rows[0];

      const allowed = await canReviewRegistration(
        req.user,
        registration,
        client
      );

      if (!allowed) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          success: false,
          message: "You cannot approve this registration.",
        });
      }

      const existingUser = await client.query(
        `SELECT id
         FROM tbl_users
         WHERE LOWER(username) = LOWER($1)
           AND deleted_at IS NULL`,
        [registration.username]
      );

      if (existingUser.rowCount > 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: "This username already exists.",
        });
      }


      const roleResult = await client.query(
        `SELECT id
         FROM mst_roles
         WHERE code = $1 AND is_active = TRUE`,
        [registration.requested_role]
      );


      if (roleResult.rowCount === 0) {        throw new Error("Requested role is not configured.");
      }

      const facilityResult = await client.query(
        `SELECT id, facility_type, district_id
         FROM mst_facilities
         WHERE id = $1 AND is_active = TRUE`,
        [registration.facility_id]
      );

      if (facilityResult.rowCount === 0) {
        throw new Error("Registration facility is invalid.");
      }

      const facility = facilityResult.rows[0];

      if (
        registration.requested_role === "DISTRICT_ADMIN" &&
        facility.facility_type !== "DISTRICT_OFFICE"
      ) {
        throw new Error(
          "District Admin must be assigned to a District Office."
        );
      }

      const userResult = await client.query(
        `INSERT INTO tbl_users (
           username, password_hash, full_name, phone, email,
           designation, employee_ref, role_id, status,
           must_change_password
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',FALSE)
         RETURNING id, username, full_name, status`,
        [
          registration.username,
          registration.password_hash,
          registration.full_name,
          registration.phone,
          registration.email,
          registration.designation,
          registration.employee_ref,
          roleResult.rows[0].id,
        ]
      );

      const newUser = userResult.rows[0];

      await client.query(
        `INSERT INTO tbl_user_facility_assignments (
           user_id, facility_id, is_primary, valid_from
         )
         VALUES ($1,$2,TRUE,CURRENT_DATE)`,
        [newUser.id, registration.facility_id]
      );

      await client.query(
        `UPDATE tbl_user_registration_requests
         SET status = 'APPROVED',
             reviewed_by = $1,
             reviewed_at = NOW(),
             created_user_id = $2
         WHERE id = $3`,
        [req.user.userId, newUser.id, requestId]
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        success: true,
        message:
          `${registration.requested_role} registration approved successfully.`,
        user: {
          ...newUser,
          role: registration.requested_role,
        },
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error("APPROVAL ERROR:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "Username or assignment already exists.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to approve registration.",
      });
    } finally {
      client.release();
    }
  }
);

// ==========================================
// 7. REJECT REGISTRATION
// ==========================================

router.post(
  "/admin/reject-registration/:id",
  authenticateToken,
  requireRole("SYSTEM_ADMIN", "DISTRICT_ADMIN"),
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const requestId = req.params.id;

      const rejectionReason =
        typeof req.body.rejectionReason === "string"
          ? req.body.rejectionReason.trim()
          : "";

      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          requestId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid registration ID.",
        });
      }

      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          message: "Please provide a rejection reason.",
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const requestResult = await client.query(
        `SELECT *
         FROM tbl_user_registration_requests
         WHERE id = $1 AND status = 'PENDING'
         FOR UPDATE`,
        [requestId]
      );

      if (requestResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Pending registration not found.",
        });
      }

      const registration = requestResult.rows[0];

      const allowed = await canReviewRegistration(
        req.user,
        registration,
        client
      );

      if (!allowed) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          success: false,
          message: "You cannot reject this registration.",
        });
      }

      const result = await client.query(
        `UPDATE tbl_user_registration_requests
         SET status = 'REJECTED',
             reviewed_by = $1,
             reviewed_at = NOW(),
             rejection_reason = $2
         WHERE id = $3 AND status = 'PENDING'
         RETURNING id, username, requested_role, status`,
        [req.user.userId, rejectionReason, requestId]
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        success: true,
        message: "Registration rejected successfully.",
        registration: result.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error("REJECTION ERROR:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to reject registration.",
      });
    } finally {
      client.release();
    }
  }
);

// ==========================================
// 8. GET ACTIVE FACILITIES
// ==========================================

router.get("/facilities", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, district_id, code, name_en, name_te, facility_type
       FROM mst_facilities
       WHERE is_active = TRUE
       ORDER BY district_id, id`
    );

    return res.status(200).json({
      success: true,
      facilities: result.rows,
    });
  } catch (error) {
    console.error("FACILITIES ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch facilities.",
    });
  }
});

// ==========================================
// 9. GET ACTIVE LANGUAGES
// ==========================================

router.get("/languages", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, code, name_en, native_name
       FROM mst_languages
       WHERE is_active = TRUE
       ORDER BY id`
    );

    return res.status(200).json({
      success: true,
      languages: result.rows,
    });
  } catch (error) {
    console.error("LANGUAGES ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch languages.",
    });
  }
});

// ==========================================
// 10. GET LOGGED-IN USER PROFILE
// ==========================================

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.status,
              r.code AS role_code, ufa.facility_id,
              f.name_en AS facility_name, f.facility_type,
              f.district_id, d.name_en AS district_name
       FROM tbl_users u
       INNER JOIN mst_roles r ON r.id = u.role_id
       LEFT JOIN tbl_user_facility_assignments ufa
         ON ufa.user_id = u.id
         AND ufa.is_primary = TRUE
         AND ufa.valid_from <= CURRENT_DATE
         AND (ufa.valid_to IS NULL OR ufa.valid_to >= CURRENT_DATE)
       LEFT JOIN mst_facilities f ON f.id = ufa.facility_id
       LEFT JOIN mst_districts d ON d.id = f.district_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [req.user.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (result.rows[0].status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "User account is not active.",
      });
    }

    return res.status(200).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("PROFILE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load user profile.",
    });
  }
});

// ==========================================
// 11. DISTRICT ADMIN DASHBOARD STATISTICS
// ==========================================

router.get(
  "/district-dashboard/stats",
  authenticateToken,
  requireRole("DISTRICT_ADMIN"),
  async (req, res) => {
    try {
      const districtId = await getAdminDistrict(req.user.userId);

      const result = await pool.query(
        `SELECT
          (
            SELECT COUNT(DISTINCT u.id)
            FROM tbl_users u
            INNER JOIN mst_roles r ON r.id = u.role_id
            INNER JOIN tbl_user_facility_assignments ufa
              ON ufa.user_id = u.id
            INNER JOIN mst_facilities f
              ON f.id = ufa.facility_id
            WHERE f.district_id = $1
              AND f.is_active = TRUE
              AND u.status = 'ACTIVE'
              AND u.deleted_at IS NULL
              AND r.code = 'HEALTH_WORKER'
              AND ufa.valid_from <= CURRENT_DATE
              AND (ufa.valid_to IS NULL OR ufa.valid_to >= CURRENT_DATE)
          ) AS health_workers,
          (
            SELECT COUNT(DISTINCT u.id)
            FROM tbl_users u
            INNER JOIN mst_roles r ON r.id = u.role_id
            INNER JOIN tbl_user_facility_assignments ufa
              ON ufa.user_id = u.id
            INNER JOIN mst_facilities f
              ON f.id = ufa.facility_id
            WHERE f.district_id = $1
              AND f.is_active = TRUE
              AND u.status = 'ACTIVE'
              AND u.deleted_at IS NULL
              AND r.code = 'MEDICAL_OFFICER'
              AND ufa.valid_from <= CURRENT_DATE
              AND (ufa.valid_to IS NULL OR ufa.valid_to >= CURRENT_DATE)
          ) AS medical_officers,
          (
            SELECT COUNT(*)
            FROM tbl_user_registration_requests rr
            INNER JOIN mst_facilities f ON f.id = rr.facility_id
            WHERE f.district_id = $1
              AND rr.status = 'PENDING'
              AND rr.requested_role = ANY($2::text[])
          ) AS pending_approvals,
          (
            SELECT COUNT(*)
            FROM mst_facilities
            WHERE district_id = $1
              AND is_active = TRUE
          ) AS total_facilities`,
        [
          districtId,
          [
            "HEALTH_WORKER",
            "MEDICAL_OFFICER",
            "SPECIALIST",
            "NAVIGATOR",
            "HOSPITAL_STAFF",
          ],
        ]
      );

      return res.status(200).json({
        success: true,
        districtId,
        stats: result.rows[0],
      });
    } catch (error) {
      console.error("DISTRICT DASHBOARD ERROR:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to load district dashboard statistics.",
      });
    }
  }
);

// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;
