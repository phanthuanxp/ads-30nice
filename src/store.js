import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

const files = {
  plans: path.join(config.dataDir, "plans.json"),
  snapshots: path.join(config.dataDir, "snapshots.json")
};

async function ensureDataDir() {
  await fs.mkdir(config.dataDir, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await ensureDataDir();
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function listPlans() {
  return readJson(files.plans, []);
}

export async function createPlan(input) {
  const plans = await listPlans();
  const now = new Date().toISOString();
  const plan = {
    id: `plan_${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    ...input
  };
  plans.unshift(plan);
  await writeJson(files.plans, plans);
  return plan;
}

export async function listSnapshots() {
  return readJson(files.snapshots, []);
}

export async function saveSnapshot(snapshot) {
  const snapshots = await listSnapshots();
  snapshots.unshift({
    id: `snap_${Date.now()}`,
    capturedAt: new Date().toISOString(),
    ...snapshot
  });
  await writeJson(files.snapshots, snapshots.slice(0, 200));
}
