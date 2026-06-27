export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 120000;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function generateTaskId() {
  return `music-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
