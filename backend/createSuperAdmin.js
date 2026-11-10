require("dotenv").config();

const bcrypt = require("bcryptjs");
const { pool } = require("./db");

async function createSuperAdmin() {
  try {
    const username = "superadmin";
    const fullName = "System Administrator";
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!password || password.length < 12) {
      throw new Error("Set a password of at least 12 characters in .env");
    }

    const roleResult = await pool.query(
      `SELECT id, mfa_required
       FROM mst_roles
       WHERE code = 'SYSTEM_ADMIN'
       AND is_active = TRUE`
    );

    if (roleResult.rowCount === 0) {
      throw new Error("SYSTEM_ADMIN role not found");
    }

    if (!roleResult.rows[0].mfa_required) {
      throw new Error("MFA requirement is not enabled");
    }

    const existing = await pool.query(
      `SELECT id FROM tbl_users
       WHERE LOWER(username) = LOWER($1)
       AND deleted_at IS NULL`,
      [username]
    );

    if (existing.rowCount > 0) {
      console.log("Super Admin already exists");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO tbl_users
       (username, password_hash, full_name, role_id,
        status, mfa_enabled, must_change_password, is_synthetic)
       VALUES ($1, $2, $3, $4, 'ACTIVE', FALSE, TRUE, TRUE)`,
      [username, passwordHash, fullName, roleResult.rows[0].id]
    );

    console.log("Super Admin account created successfully!");
    console.log("Username: superadmin");
    console.log("MFA enrollment is required before login.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await pool.end();
  }
}

createSuperAdmin();