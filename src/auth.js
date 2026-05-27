import crypto from "node:crypto";
import { config, hasAuthConfig } from "./config.js";

const sessionTtlMs = 1000 * 60 * 60 * 12;

function parseCookies(cookieHeader = "") {
  const cookies = {};
  for (const item of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
  }
  return cookies;
}

function sign(value) {
  return crypto.createHmac("sha256", config.auth.sessionSecret).update(value).digest("base64url");
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function getAuthStatus(request) {
  if (!hasAuthConfig()) {
    return {
      enabled: false,
      authenticated: true,
      user: "development"
    };
  }

  const cookies = parseCookies(request.headers.cookie);
  const session = cookies[config.auth.cookieName];
  if (!session) {
    return { enabled: true, authenticated: false };
  }

  const [payload, signature] = session.split(".");
  if (!payload || !signature || !constantTimeEqual(sign(payload), signature)) {
    return { enabled: true, authenticated: false };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.exp < Date.now()) {
      return { enabled: true, authenticated: false };
    }
    return {
      enabled: true,
      authenticated: true,
      user: decoded.sub
    };
  } catch {
    return { enabled: true, authenticated: false };
  }
}

export function assertAuthenticated(request) {
  const status = getAuthStatus(request);
  if (!status.authenticated) {
    const error = new Error("Unauthorized.");
    error.statusCode = 401;
    throw error;
  }
  return status;
}

export function createSessionCookie(username) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      exp: Date.now() + sessionTtlMs
    })
  ).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  return `${config.auth.cookieName}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}`;
}

export function clearSessionCookie() {
  return `${config.auth.cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function validateCredentials(username, password) {
  if (!hasAuthConfig()) return true;
  return (
    constantTimeEqual(username, config.auth.username) &&
    constantTimeEqual(password, config.auth.password)
  );
}
