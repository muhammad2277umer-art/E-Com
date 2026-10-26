export const AUTH_COOKIE = "crm_auth";

// The cookie holds a hash of APP_PASSWORD + APP_SECRET, so changing either
// signs everyone out. Uses Web Crypto so it also runs in middleware.
export async function authToken() {
  const data = new TextEncoder().encode(`${process.env.APP_PASSWORD}:${process.env.APP_SECRET}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
