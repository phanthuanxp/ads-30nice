import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadDotEnv() {
  const envPath = path.join(rootDir, ".env");
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
  adminKey: process.env.ADMIN_KEY || ""
};

export function hasMetaConfig() {
  return Boolean(config.meta.businessId && config.meta.accessToken);
}
