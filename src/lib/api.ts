export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

/** Optional; only used for admin routes when backend has ADMIN_API_TOKEN set. */
export const ADMIN_API_TOKEN =
  typeof process.env.NEXT_PUBLIC_ADMIN_API_TOKEN === "string"
    ? process.env.NEXT_PUBLIC_ADMIN_API_TOKEN.trim()
    : "";
