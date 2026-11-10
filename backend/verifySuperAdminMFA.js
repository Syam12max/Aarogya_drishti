
require("dotenv").config();

const readline = require("readline");
const { verify } = require("otplib");
const { pool } = require("./db");
const { decryptSecret } = require("./mfaEncryption");

async function verifySuperAdminMFA() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const result = await pool.query(
      `SELECT id, mfa_secret_encrypted, mfa_enabled
       FROM tbl_users
       WHERE username = $1
       AND deleted_at IS NULL`,
      ["superadmin"]
    );

    if (result.rowCount === 0) {
      throw new Error("Super Admin account not found.");
    }

    const user = result.rows[0];

    if (user.mfa_enabled) {
      console.log("MFA is already enabled.");
      return;
    }

    if (!user.mfa_secret_encrypted) {
      throw new Error("MFA secret not found. Generate a new QR code.");
    }

    const encryptedData =
      JSON.parse(user.mfa_secret_encrypted);

    const secret = decryptSecret(encryptedData);

    const token = await new Promise((resolve) => {
      rl.question(
        "Enter the 6-digit code from Google Authenticator: ",
        resolve
      );
    });

    if (!/^\d{6}$/.test(token.trim())) {
      console.log("Invalid OTP format.");
      return;
    }

    const verification = await verify({
      secret,
      token: token.trim(),
    });

    if (!verification.valid) {
      console.log("Invalid OTP. MFA is not enabled.");
      return;
    }

    await pool.query(
      `UPDATE tbl_users
       SET mfa_enabled = TRUE
       WHERE id = $1`,
      [user.id]
    );

    console.log("MFA enabled successfully!");
    console.log("Super Admin MFA verification completed.");

  } catch (error) {
    console.error("MFA Verification Error:", error.message);
  } finally {
    rl.close();
    await pool.end();
  }
}

verifySuperAdminMFA();
