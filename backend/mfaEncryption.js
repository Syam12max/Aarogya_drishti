
require("dotenv").config();

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const keyHex = process.env.MFA_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid MFA encryption key configuration.");
  }

  return Buffer.from(keyHex, "hex");
}

function encryptSecret(secret) {
  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("Invalid MFA secret.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decryptSecret(data) {
  if (
    !data ||
    !data.encrypted ||
    !data.iv ||
    !data.authTag
  ) {
    throw new Error("Invalid encrypted MFA data.");
  }

  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(data.iv, "hex")
  );

  decipher.setAuthTag(
    Buffer.from(data.authTag, "hex")
  );

  let decrypted = decipher.update(
    data.encrypted,
    "hex",
    "utf8"
  );

  decrypted += decipher.final("utf8");

  return decrypted;
}

module.exports = {
  encryptSecret,
  decryptSecret,
};
