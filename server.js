import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { config, getPublicMetaConfig, setMetaConfig } from "./src/config.js";
import { createPlan, listPlans } from "./src/store.js";
import { getAdAccounts, getCampaigns, getMetaHealth, validateMetaCredentials } from "./src/meta-client.js";
import { buildCampaignPlan, buildOptimizationNotes } from "./src/recommendations.js";
import {
  assertAuthenticated,
  clearSessionCookie,
  createSessionCookie,
  getAuthStatus,
  validateCredentials
} from "./src/auth.js";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

function sendJsonWithHeaders(response, statusCode, payload, headers) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

function assertAdmin(request) {
  if (!config.adminKey) return;
  const provided = request.headers["x-admin-key"];
  if (provided !== config.adminKey) {
    const error = new Error("Unauthorized.");
    error.statusCode = 401;
    throw error;
  }
}

async function serveStatic(request, response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(config.publicDir, safePath);

  if (!filePath.startsWith(config.publicDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin"
    });
    response.end(content);
  } catch {
    const fallback = await fs.readFile(path.join(config.publicDir, "index.html"));
    response.writeHead(200, {
      "content-type": mimeTypes[".html"],
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin"
    });
    response.end(fallback);
  }
}

async function routeApi(request, response, url) {
  if (url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "ads-30nice",
      meta: getMetaHealth()
    });
    return true;
  }

  if (url.pathname === "/api/session" && request.method === "GET") {
    sendJson(response, 200, { data: getAuthStatus(request) });
    return true;
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    const input = await readBody(request);
    if (!validateCredentials(input.username || "", input.password || "")) {
      sendJson(response, 401, { error: "Sai tai khoan hoac mat khau." });
      return true;
    }

    sendJsonWithHeaders(
      response,
      200,
      {
        data: {
          enabled: true,
          authenticated: true,
          user: input.username || "admin"
        },
        ok: true
      },
      {
        "set-cookie": createSessionCookie(input.username || "admin")
      }
    );
    return true;
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    sendJsonWithHeaders(response, 200, { ok: true }, {
      "set-cookie": clearSessionCookie()
    });
    return true;
  }

  assertAuthenticated(request);

  if (url.pathname === "/api/meta-config" && request.method === "GET") {
    sendJson(response, 200, { data: getPublicMetaConfig() });
    return true;
  }

  if (url.pathname === "/api/meta-config" && request.method === "POST") {
    const input = await readBody(request);
    const apiVersion = input.apiVersion || config.meta.apiVersion || "v25.0";
    const businessId = String(input.businessId || "").trim();
    const accessToken = String(input.accessToken || "").trim();

    if (!businessId || !accessToken) {
      sendJson(response, 400, { error: "Vui lòng nhập Business ID và Access Token." });
      return true;
    }

    const validation = await validateMetaCredentials({ apiVersion, businessId, accessToken });
    setMetaConfig({ apiVersion, businessId, accessToken });

    sendJson(response, 200, {
      data: getPublicMetaConfig(),
      validation
    });
    return true;
  }

  if (url.pathname === "/api/ad-accounts" && request.method === "GET") {
    sendJson(response, 200, { data: await getAdAccounts(), meta: getMetaHealth() });
    return true;
  }

  const campaignMatch = url.pathname.match(/^\/api\/ad-accounts\/([^/]+)\/campaigns$/);
  if (campaignMatch && request.method === "GET") {
    const datePreset = url.searchParams.get("date_preset") || "last_7d";
    const campaigns = await getCampaigns(decodeURIComponent(campaignMatch[1]), datePreset);
    sendJson(response, 200, {
      data: campaigns,
      recommendations: buildOptimizationNotes(campaigns)
    });
    return true;
  }

  if (url.pathname === "/api/plans" && request.method === "GET") {
    sendJson(response, 200, { data: await listPlans() });
    return true;
  }

  if (url.pathname === "/api/plans" && request.method === "POST") {
    assertAdmin(request);
    const input = await readBody(request);
    const plan = await createPlan({
      input,
      output: buildCampaignPlan(input)
    });
    sendJson(response, 201, { data: plan });
    return true;
  }

  if (url.pathname === "/api/plan-preview" && request.method === "POST") {
    const input = await readBody(request);
    sendJson(response, 200, { data: buildCampaignPlan(input) });
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, config.publicBaseUrl);

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await routeApi(request, response, url);
      if (!handled) sendJson(response, 404, { error: "API route not found." });
      return;
    }

    await serveStatic(request, response, url);
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message,
      details: error.details || undefined
    });
  }
});

server.listen(config.port, () => {
  console.log(`Ads 30Nice is running at http://localhost:${config.port}`);
});
