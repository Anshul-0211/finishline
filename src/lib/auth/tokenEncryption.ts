import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

// Derive encryption key from environment variable or use a fallback for local development/scaffold
const getEncryptionKey = (): Buffer => {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    console.warn("WARNING: TOKEN_ENCRYPTION_KEY environment variable is not set. Using fallback key for build/dev.");
    return crypto.scryptSync("fallback-dev-secret", "finishline-salt", 32);
  }
  return crypto.scryptSync(secret, "finishline-salt", 32);
};

export function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string): string {
  if (!text || text === "false") return "";
  if (!text.includes(":")) return text;
  try {
    const textParts = text.split(":");
    const ivHex = textParts.shift();
    if (!ivHex) return "";
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Token decryption failed:", error);
    return "";
  }
}
