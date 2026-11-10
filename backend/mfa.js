
require("dotenv").config();

const { generateSecret, generateURI } = require("otplib");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const { pool } = require("./db");
const { encryptSecret } = require("./mfaEncryption");

async function setupMFA() {
  try {
    const username = "superadmin";

    // 1. Find Super Admin account
    const result = await pool.query(
      `SELECT id, mfa_enabled
       FROM tbl_users
       WHERE LOWER(username) = LOWER($1)
       AND deleted_at IS NULL`,
      [username]
    );

    if (result.rowCount === 0) {
      throw new Error("Super Admin account not found.");
    }

    const user = result.rows[0];

    if (user.mfa_enabled) {
      throw new Error("MFA is already enabled.");
    }

    // 2. Generate a new MFA secret
    const secret = generateSecret();

    // 3. Generate Google Authenticator URI
    const uri = generateURI({
      issuer: "Aarogya Drishti",
      label: username,
      secret,
    });

    // 4. Encrypt the secret
    const encryptedData = encryptSecret(secret);

    // 5. Save encrypted secret in database
    await pool.query(
      `UPDATE tbl_users
       SET mfa_secret_encrypted = $1,
           mfa_enabled = FALSE
       WHERE id = $2`,
      [JSON.stringify(encryptedData), user.id]
    );

    // 6. Generate QR code as PNG image
    const qrPath = path.join(
      __dirname,
      "superadmin-mfa.png"
    );

    await QRCode.toFile(qrPath, uri, {
      width: 350,
      margin: 2,
    });

    console.log("\nMFA QR image generated successfully!");
    console.log("Image location:");
    console.log(qrPath);

    console.log(
      "\nMFA is NOT enabled yet. OTP verification is required."
    );
  } catch (error) {
    console.error("MFA Setup Error:", error.message);
  } finally {
    await pool.end();
  }
}

setupMFA();
