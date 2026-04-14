/**
 * Runtime API configuration.
 * Set NEXT_PUBLIC_API_BASE_URL in .env.local for local dev.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
