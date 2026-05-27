import fs from "node:fs";

const required = [
  "PUBLIC_BASE_URL",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "SESSION_SECRET",
  "META_BUSINESS_ID",
  "META_ACCESS_TOKEN"
];

function loadEnvFile() {
  if (!fs.existsSync(".env")) return;
  const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const missing = required.filter((key) => !process.env[key]);
const weak = [];

if ((process.env.ADMIN_PASSWORD || "").length < 12) {
  weak.push("ADMIN_PASSWORD should be at least 12 characters.");
}

if ((process.env.SESSION_SECRET || "").length < 32) {
  weak.push("SESSION_SECRET should be at least 32 characters.");
}

if (missing.length || weak.length) {
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}`);
  }
  for (const item of weak) {
    console.error(item);
  }
  process.exit(1);
}

console.log("Environment looks ready for production.");
