import crypto from 'node:crypto';
import os from 'node:os';
import { machineIdSync } from 'node-machine-id';

let cachedConsistentMachineIdPromise = null;
let cachedRawMachineId = null;
let loggedFallbackWarning = false;

function ensureWindowsEnv() {
  if (process.platform !== 'win32') return;
  if (!process.env.windir && process.env.WINDIR) {
    process.env.windir = process.env.WINDIR;
  }
  if (!process.env.windir) {
    process.env.windir = 'C:\\Windows';
  }
}

function getStableFallbackRawMachineId() {
  if (cachedRawMachineId) return cachedRawMachineId;

  const seed = [
    os.hostname(),
    os.platform(),
    os.arch(),
    String(os.cpus()?.length || 0),
  ].join('|');

  cachedRawMachineId = crypto.createHash('sha256').update(seed).digest('hex');
  return cachedRawMachineId;
}

const MACHINE_ID_OVERRIDE = process.env.XLABROUTER_MACHINE_ID || '';

function getRawMachineIdFast() {
  ensureWindowsEnv();
  try {
    const value = machineIdSync();
    cachedRawMachineId = value;
    return value;
  } catch (error) {
    if (!loggedFallbackWarning) {
      console.log('Machine ID fallback enabled:', error?.message || error);
      loggedFallbackWarning = true;
    }
    return getStableFallbackRawMachineId();
  }
}

/**
 * Get consistent machine ID using node-machine-id with salt
 * This ensures the same physical machine gets the same ID across runs
 *
 * @param {string} salt - Optional salt to use (defaults to environment variable)
 * @returns {Promise<string>} Machine ID (16-character base32)
 */
export async function getConsistentMachineId(salt = null) {
  if (!salt && cachedConsistentMachineIdPromise) {
    return cachedConsistentMachineIdPromise;
  }

  const computePromise = Promise.resolve().then(() => {
    if (MACHINE_ID_OVERRIDE) {
      return MACHINE_ID_OVERRIDE;
    }
    const saltValue = salt || process.env.MACHINE_ID_SALT || 'endpoint-proxy-salt';
    const rawMachineId = getRawMachineIdFast();
    const hashedMachineId = crypto
      .createHash('sha256')
      .update(rawMachineId + saltValue)
      .digest('hex');

    return hashedMachineId.substring(0, 16);
  });

  if (!salt) {
    cachedConsistentMachineIdPromise = computePromise;
  }

  return computePromise;
}

/**
 * Get raw machine ID without hashing (for debugging purposes)
 * @returns {Promise<string>} Raw machine ID
 */
export async function getRawMachineId() {
  return Promise.resolve(getRawMachineIdFast());
}

/**
 * Check if we're running in browser or server environment
 * @returns {boolean} True if in browser, false if in server
 */
export function isBrowser() {
  return typeof window !== 'undefined';
}

