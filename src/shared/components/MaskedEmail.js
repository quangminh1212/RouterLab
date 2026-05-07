"use client";

import { maskEmail } from "@/shared/utils/emailMasking";

/**
 * MaskedEmail Component
 * Displays masked email with full email in tooltip
 */
export default function MaskedEmail({ email, className = "" }) {
  if (!email) return null;

  const masked = maskEmail(email);

  return (
    <span
      className={`cursor-help ${className}`}
      title={email}
      aria-label={`Email: ${email}`}
    >
      {masked}
    </span>
  );
}

/**
 * MaskedEmailWithCopy Component
 * Displays masked email with copy button
 */
export function MaskedEmailWithCopy({ email, className = "" }) {
  if (!email) return null;

  const masked = maskEmail(email);

  const handleCopy = () => {
    navigator.clipboard.writeText(email);
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="cursor-help"
        title={email}
        aria-label={`Email: ${email}`}
      >
        {masked}
      </span>
      <button
        onClick={handleCopy}
        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        title="Copy full email"
        aria-label="Copy email to clipboard"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </button>
    </div>
  );
}
