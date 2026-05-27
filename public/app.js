const state = {
  accounts: [],
  campaigns: [],
  recommendations: []
};

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

const number = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2
});

function $(selector) {
  return document.querySelector(selector);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function formatSpend(value) {
  return money.format(Number(value || 0));
}

function renderAccounts(meta) {
  $("#metaStatus").textContent = meta.configured ? "Meta API da cau hinh" : "Dang dung du lieu mau";
  $("#accountGrid").innerHTML = state.accounts
    .map(
      (account) => `
        <article class="account-card">
          <strong>${account.name}</strong>
          <div class="account-meta">
            <span>${account.id}</span>
            <span>${account.currency || "VND"}</span>
          </div>
          <div class="account-meta">
            <span>${account.timezone_name || "Asia/Ho_Chi_Minh"}</span>
            <span>${account.source === "meta" ? "Meta" : "Sample"}</span>
          </div>
        </article>
      `
    )
    .join("");

  $("#accountSelect").innerHTML = state.accounts
    .map((account) => `<option value="${account.id}">${account.name}</option>`)
    .join("");
}

function renderMetrics() {
  const totals = state.campaigns.reduce(
    (acc, campaign) => {
      acc.spend += Number(campaign.spend || 0);
      acc.impressions += Number(campaign.impressions || 0);
      acc.clicks += Number(campaign.clicks || 0);
      acc.results += Number(campaign.results || 0);
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, results: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpa = totals.results > 0 ? totals.spend / totals.results : 0;

  $("#metricRow").innerHTML = [
    ["Spend", formatSpend(totals.spend)],
    ["Impressions", number.format(totals.impressions)],
    ["Clicks", number.format(totals.clicks)],
    ["CTR", `${number.format(ctr)}%`],
    ["CPA", formatSpend(cpa)]
  ]
    .map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderCampaigns() {
  $("#campaignRows").innerHTML = state.campaigns
    .map(
      (campaign) => `
        <tr>
          <td>${campaign.name}</td>
          <td><span class="status ${campaign.status === "PAUSED" ? "paused" : ""}">${campaign.effective_status || campaign.status}</span></td>
          <td>${formatSpend(campaign.spend)}</td>
          <td>${number.format(campaign.ctr || 0)}%</td>
          <td>${formatSpend(campaign.cpc)}</td>
          <td>${number.format(campaign.results || 0)}</td>
          <td>${formatSpend(campaign.costPerResult)}</td>
          <td>${number.format(campaign.frequency || 0)}</td>
        </tr>
      `
    )
    .join("");
}

function renderRecommendations() {
  $("#recommendations").innerHTML = state.recommendations
    .map(
      (note) => `
        <article class="note ${note.priority}">
          <h3>${note.title}</h3>
          <p><strong>${note.campaign}</strong></p>
          <p>${note.action}</p>
        </article>
      `
    )
    .join("");
}

async function loadAccounts() {
  const payload = await api("/api/ad-accounts");
  state.accounts = payload.data;
  renderAccounts(payload.meta);
  if (state.accounts.length) {
    $("#accountSelect").value = state.accounts[0].id;
    await loadCampaigns(state.accounts[0].id);
  }
}

async function loadCampaigns(accountId) {
  const payload = await api(`/api/ad-accounts/${encodeURIComponent(accountId)}/campaigns`);
  state.campaigns = payload.data;
  state.recommendations = payload.recommendations;
  renderMetrics();
  renderCampaigns();
  renderRecommendations();
}

function formPayload() {
  const form = new FormData($("#plannerForm"));
  return {
    industry: form.get("industry"),
    offer: form.get("offer"),
    location: form.get("location"),
    goal: form.get("goal"),
    dailyBudget: Number(form.get("dailyBudget") || 0),
    ageMin: Number(form.get("ageMin") || 22),
    ageMax: Number(form.get("ageMax") || 55),
    audience: form.get("audience"),
    channels: ["facebook", "instagram"]
  };
}

async function previewPlan() {
  const payload = await api("/api/plan-preview", {
    method: "POST",
    body: JSON.stringify(formPayload())
  });
  $("#planPreview").textContent = JSON.stringify(payload.data, null, 2);
  $("#previewUpdated").textContent = `Cap nhat luc ${new Date().toLocaleTimeString("vi-VN")}`;
}

$("#refreshAccounts").addEventListener("click", () => loadAccounts().catch((error) => toast(error.message)));
$("#accountSelect").addEventListener("change", (event) =>
  loadCampaigns(event.target.value).catch((error) => toast(error.message))
);
$("#previewButton").addEventListener("click", (event) => {
  event.preventDefault();
  previewPlan().catch((error) => toast(error.message));
});
$("#plannerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = await api("/api/plans", {
    method: "POST",
    body: JSON.stringify(formPayload())
  });
  $("#planPreview").textContent = JSON.stringify(payload.data.output, null, 2);
  toast("Da luu ke hoach chien dich.");
});

loadAccounts()
  .then(previewPlan)
  .catch((error) => toast(error.message));
