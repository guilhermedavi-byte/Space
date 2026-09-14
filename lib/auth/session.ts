import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
const COOKIE = "space_sales_session";
function secret() { const value = process.env.SPACE_SALES_AUTH_SECRET; if (!value || value.length < 32) throw new Error("SPACE_SALES_AUTH_SECRET must contain at least 32 characters"); return value; }
function sign(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
export async function createAdminSession() { const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url"); (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 }); }
export function validateAccessToken(value: string) { const expected = process.env.SPACE_SALES_ACCESS_TOKEN ?? ""; if (!expected || value.length !== expected.length) return false; return timingSafeEqual(Buffer.from(value), Buffer.from(expected)); }
