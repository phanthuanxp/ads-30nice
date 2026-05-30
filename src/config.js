import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(rootDir, ".env");

function loadDotEnv() {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^"|"$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

export const config = {
  rootDir,
  publicDir: path.join(rootDir, "public"),
  dataDir: process.env.DATA_DIR || path.join(rootDir, "data"),
  port: Number(process.env.PORT || 3010),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:3010",
  meta: {
    apiVersion: process.env.META_API_VERSION || "v25.0",
    businessId: process.env.META_BUSINESS_ID || "",
    accessToken: process.env.META_ACCESS_TOKEN || ""
  },
  auth: {
    username: process.env.ADMIN_USERNAME || "",
    password: process.env.ADMIN_PASSWORD || "",
    sessionSecret: process.env.SESSION_SECRET || "",
    cookieName: "ads30_session"
  },
  adminKey: process.env.ADMIN_KEY || ""
};

export function hasMetaConfig() {
  return Boolean(config.meta.businessId && config.meta.accessToken);
}

export function hasAuthConfig() {
  return Boolean(config.auth.username && config.auth.password && config.auth.sessionSecret);
}

export function getPublicMetaConfig() {
  const token = config.meta.accessToken;

  return {
    configured: hasMetaConfig(),
    apiVersion: config.meta.apiVersion,
    businessId: config.meta.businessId,
    accessTokenSet: Boolean(token),
    accessTokenPreview: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : ""
  };
}

function updateEnvFile(values) {
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const seen = new Set();
  const next = existing.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !line.includes("=")) return line;

    const key = line.split("=", 1)[0];
    if (!Object.prototype.hasOwnProperty.call(values, key)) return line;

    seen.add(key);
    return `${key}=${values[key]}`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) {
      next.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envPath, `${next.filter((line, index) => line || index < next.length - 1).join("\n")}\n`, {
    encoding: "utf8",
    mode: 0o640
  });
}

export function setMetaConfig({ apiVersion, businessId, accessToken }) {
  const nextApiVersion = apiVersion || config.meta.apiVersion || "v25.0";
  const nextBusinessId = String(businessId || "").trim();
  const nextAccessToken = String(accessToken || "").trim();

  config.meta.apiVersion = nextApiVersion;
  config.meta.businessId = nextBusinessId;
  config.meta.accessToken = nextAccessToken;

  process.env.META_API_VERSION = nextApiVersion;
  process.env.META_BUSINESS_ID = nextBusinessId;
  process.env.META_ACCESS_TOKEN = nextAccessToken;

  updateEnvFile({
    META_API_VERSION: nextApiVersion,
    META_BUSINESS_ID: nextBusinessId,
    META_ACCESS_TOKEN: nextAccessToken
  });
}
