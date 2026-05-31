import crypto from "node:crypto";

import { getSettings, updateSettings } from "@/lib/localDb";



const DEFAULT_USERNAME = "admin";

const DEFAULT_PASSWORD = "123456";

const PBKDF2_ITERATIONS = 120000;

const PBKDF2_KEYLEN = 32;

const PBKDF2_DIGEST = "sha256";

const MIN_PASSWORD_LENGTH = 4;



function generateSalt() {

  return crypto.randomBytes(16).toString("hex");

}



function hashPassword(password, saltHex) {

  const salt = Buffer.from(saltHex, "hex");

  return crypto.pbkdf2Sync(String(password), salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");

}



function timingSafeEqualBuf(a, b) {

  const ab = Buffer.from(String(a));

  const bb = Buffer.from(String(b));

  if (ab.length !== bb.length) return false;

  return crypto.timingSafeEqual(ab, bb);

}



function timingSafeEqualHex(a, b) {

  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;

  try {

    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

  } catch {

    return false;

  }

}



export async function getEffectiveUsername() {

  const settings = await getSettings();

  return settings?.adminAuth?.username || process.env.ADMIN_USERNAME || DEFAULT_USERNAME;

}



export async function hasStoredCredentials() {

  const settings = await getSettings();

  return Boolean(settings?.adminAuth?.passwordHash);

}



export async function verifyCredentials(username, password) {

  const settings = await getSettings();

  const stored = settings?.adminAuth;

  const inputUsername = String(username || "").trim();

  const inputPassword = String(password || "");



  if (stored && stored.username && stored.passwordHash && stored.salt) {

    if (!timingSafeEqualBuf(inputUsername, stored.username)) return false;

    const candidate = hashPassword(inputPassword, stored.salt);

    return timingSafeEqualHex(candidate, stored.passwordHash);

  }



  const envUser = process.env.ADMIN_USERNAME || DEFAULT_USERNAME;

  const envPass = process.env.ADMIN_PASSWORD || process.env.INITIAL_PASSWORD || DEFAULT_PASSWORD;

  return timingSafeEqualBuf(inputUsername, envUser) && timingSafeEqualBuf(inputPassword, envPass);

}



export async function setCredentials({ username, password }) {

  const trimmedUser = String(username || "").trim();

  if (!trimmedUser) {

    const err = new Error("Vui lòng nhập tên đăng nhập");

    err.code = "USERNAME_REQUIRED";

    throw err;

  }

  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {

    const err = new Error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`);

    err.code = "PASSWORD_TOO_SHORT";

    throw err;

  }

  const salt = generateSalt();

  const passwordHash = hashPassword(String(password), salt);

  await updateSettings({

    adminAuth: {

      username: trimmedUser,

      passwordHash,

      salt,

      updatedAt: new Date().toISOString(),

    },

  });

  return { username: trimmedUser };

}



