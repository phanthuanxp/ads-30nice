import { config, hasMetaConfig } from "./config.js";
import { sampleAdAccounts, sampleCampaigns } from "./sample-data.js";

function graphBase(apiVersion = config.meta.apiVersion) {
  return `https://graph.facebook.com/${apiVersion}`;
}

function normalizeAccountId(accountId) {
  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

async function graphGet(pathname, params = {}) {
  if (!hasMetaConfig()) {
    const error = new Error("Meta API is not configured.");
    error.statusCode = 412;
    throw error;
  }

  const url = new URL(`${graphBase()}/${pathname.replace(/^\//, "")}`);
  url.searchParams.set("access_token", config.meta.accessToken);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Meta API request failed.");
    error.statusCode = response.status;
    error.details = payload?.error;
    throw error;
  }

  return payload;
}

async function collectPaged(pathname, params) {
  const first = await graphGet(pathname, params);
  const rows = [...(first.data || [])];
  let nextUrl = first.paging?.next;

  while (nextUrl && rows.length < 500) {
    const response = await fetch(nextUrl);
    const payload = await response.json();
    if (!response.ok) break;
    rows.push(...(payload.data || []));
    nextUrl = payload.paging?.next;
  }

  return rows;
}

export async function getAdAccounts() {
  if (!hasMetaConfig()) return sampleAdAccounts;

  const fields = [
    "id",
    "name",
    "account_status",
    "currency",
    "timezone_name",
    "amount_spent",
    "balance"
  ].join(",");

  const [owned, client] = await Promise.all([
    collectPaged(`${config.meta.businessId}/owned_ad_accounts`, { fields, limit: 100 }),
    collectPaged(`${config.meta.businessId}/client_ad_accounts`, { fields, limit: 100 })
  ]);

  const byId = new Map();
  for (const account of [...owned, ...client]) {
    byId.set(account.id, { ...account, source: "meta" });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function validateMetaCredentials({ apiVersion, businessId, accessToken }) {
  const fields = [
    "id",
    "name",
    "account_status",
    "currency",
    "timezone_name"
  ].join(",");
  async function fetchAccounts(edge) {
    const url = new URL(`${graphBase(apiVersion)}/${String(businessId).trim()}/${edge}`);
    url.searchParams.set("access_token", String(accessToken).trim());
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "25");

    const response = await fetch(url);
    const payload = await response.json();

    if (!response.ok) {
      const error = new Error(payload?.error?.message || "Không thể kết nối Meta API.");
      error.statusCode = response.status;
      error.details = payload?.error;
      throw error;
    }

    return payload.data || [];
  }

  const [owned, client] = await Promise.all([
    fetchAccounts("owned_ad_accounts"),
    fetchAccounts("client_ad_accounts")
  ]);

  const accounts = [...new Map([...owned, ...client].map((account) => [account.id, account])).values()];

  return {
    accountCount: accounts.length,
    accounts
  };
}

function pickActionCount(actions = [], keys) {
  for (const key of keys) {
    const match = actions.find((action) => action.action_type === key);
    if (match) return Number(match.value || 0);
  }
  return 0;
}

function normalizeCampaign(campaign) {
  const insight = campaign.insights?.data?.[0] || {};
  const spend = Number(insight.spend || 0);
  const impressions = Number(insight.impressions || 0);
  const clicks = Number(insight.clicks || 0);
  const reach = Number(insight.reach || 0);
  const results = pickActionCount(insight.actions, [
    "lead",
    "onsite_conversion.messaging_conversation_started_7d",
    "purchase",
    "complete_registration",
    "link_click"
  ]);

  return {
    id: campaign.id,
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.status,
    effective_status: campaign.effective_status,
    spend,
    impressions,
    reach,
    clicks,
    ctr: Number(insight.ctr || 0),
    cpc: Number(insight.cpc || 0),
    cpm: Number(insight.cpm || 0),
    results,
    costPerResult: results > 0 ? spend / results : 0,
    frequency: reach > 0 ? impressions / reach : 0
  };
}

export async function getCampaigns(accountId, datePreset = "last_7d") {
  if (!hasMetaConfig()) return sampleCampaigns;

  const fields = [
    "id",
    "name",
    "objective",
    "status",
    "effective_status",
    `insights.date_preset(${datePreset}){spend,impressions,reach,clicks,ctr,cpc,cpm,actions}`
  ].join(",");

  const rows = await collectPaged(`${normalizeAccountId(accountId)}/campaigns`, {
    fields,
    limit: 100
  });

  return rows.map(normalizeCampaign);
}

export function getMetaHealth() {
  return {
    configured: hasMetaConfig(),
    apiVersion: config.meta.apiVersion,
    businessId: config.meta.businessId ? "configured" : "missing",
    accessToken: config.meta.accessToken ? "configured" : "missing"
  };
}
