/**
 * Email Privacy Masking Utility
 * Masks email addresses for privacy in UI while keeping them accessible via tooltip
 */

/**
 * Mask email address for display
 * Example: user@example.com -> u***@e***.com
 * @param {string} email - The email address to mask
 * @returns {string} - Masked email address
 */
export function maskEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return email;
  }

  const [local, domain] = email.split("@");
  if (!domain) return email;

  // Mask local part (keep first char + asterisks)
  const maskedLocal = local.length > 2
    ? local[0] + "*".repeat(Math.min(local.length - 1, 5))
    : local[0] + "*";

  // Mask domain (keep first char of each part + TLD)
  const domainParts = domain.split(".");
  const maskedDomain = domainParts.map((part, i) => {
    if (i === domainParts.length - 1) return part; // Keep TLD (.com, .org, etc)
    return part[0] + "*".repeat(Math.min(part.length - 1, 3));
  }).join(".");

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Check if email should be masked based on settings
 * @param {object} settings - Application settings
 * @returns {boolean}
 */
export function shouldMaskEmail(settings) {
  // Always mask emails by default for privacy
  return settings?.maskEmails !== false;
}
