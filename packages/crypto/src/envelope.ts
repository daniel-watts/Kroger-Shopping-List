import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const NONCE_LEN = 12;
const TAG_LEN = 16;

export type EncryptedBlob = {
  ciphertext: string;
  nonce: string;
};

let cachedKey: Buffer | null = null;

const getMasterKey = (): Buffer => {
  if (cachedKey) return cachedKey;
  const raw = process.env.MASTER_KEY;
  if (!raw) {
    throw new Error("MASTER_KEY env var not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `MASTER_KEY must decode to 32 bytes, got ${key.length}. Generate with: openssl rand -base64 32`,
    );
  }
  cachedKey = key;
  return key;
};

export const encrypt = (plaintext: string): EncryptedBlob => {
  const key = getMasterKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv(ALGO, key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([ct, tag]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
};

export const decrypt = (blob: EncryptedBlob): string => {
  const key = getMasterKey();
  const nonce = Buffer.from(blob.nonce, "base64");
  const data = Buffer.from(blob.ciphertext, "base64");
  if (data.length < TAG_LEN) {
    throw new Error("ciphertext too short to contain auth tag");
  }
  const ct = data.subarray(0, data.length - TAG_LEN);
  const tag = data.subarray(data.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
};

// Convenience: pack into a single string for storage in a single column.
export const encryptToString = (plaintext: string): string => {
  const { ciphertext, nonce } = encrypt(plaintext);
  return `${nonce}:${ciphertext}`;
};

export const decryptFromString = (packed: string): string => {
  const idx = packed.indexOf(":");
  if (idx < 0) throw new Error("invalid packed ciphertext");
  return decrypt({
    nonce: packed.slice(0, idx),
    ciphertext: packed.slice(idx + 1),
  });
};
