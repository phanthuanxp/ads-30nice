const state = {
  accounts: [],
  campaigns: [],
  recommendations: [],
  plans: [],
  session: null
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  $("#metaStatus").textContent = meta.configured ? "Meta API đã cấu hình" : "Đang dùng dữ liệu mẫu";
  $("#accountGrid").innerHTML = state.accounts
    .map(
      (account) => `
        <article class="account-card">
          <strong>${escapeHtml(account.name)}</strong>
          <div class="account-meta">
            <span>${escapeHtml(account.id)}</span>
            <span>${escapeHtml(account.currency || "VND")}</span>
          </div>
          <div class="account-meta">
            <span>${escapeHtml(account.timezone_name || "Asia/Ho_Chi_Minh")}</span>
            <span>${account.source === "meta" ? "Meta" : "Sample"}</span>
          </div>
        </article>
      `
    )
    .join("");

  $("#accountSelect").innerHTML = state.accounts
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
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
          <td>${escapeHtml(campaign.name)}</td>
          <td><span class="status ${campaign.status === "PAUSED" ? "paused" : ""}">${escapeHtml(campaign.effective_status || campaign.status)}</span></td>
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
          <h3>${escapeHtml(note.title)}</h3>
          <p><strong>${escapeHtml(note.campaign)}</strong></p>
          <p>${escapeHtml(note.action)}</p>
        </article>
      `
    )
    .join("");
}

function renderPlans() {
  if (!state.plans.length) {
    $("#plansList").innerHTML = `<p>Chưa có kế hoạch nào được lưu.</p>`;
    return;
  }

  $("#plansList").innerHTML = state.plans
    .map((plan) => {
      const output = plan.output || {};
      const budget = output.budget?.daily ? formatSpend(output.budget.daily) : "Chưa đặt";
      return `
        <article class="plan-item">
          <div>
            <h3>${escapeHtml(output.name || plan.input?.industry || "Kế hoạch mới")}</h3>
            <p>${escapeHtml(output.objective || "")} · ${escapeHtml(budget)} · ${escapeHtml(plan.status)}</p>
            <p class="plan-meta">Tạo lúc ${escapeHtml(new Date(plan.createdAt).toLocaleString("vi-VN"))}</p>
          </div>
          <button class="secondary" data-plan-id="${escapeHtml(plan.id)}">Xem JSON</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-plan-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const plan = state.plans.find((item) => item.id === button.dataset.planId);
      $("#planPreview").textContent = JSON.stringify(plan?.output || plan, null, 2);
      location.hash = "#planner";
    });
  });
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

async function loadPlans() {
  const payload = await api("/api/plans");
  state.plans = payload.data;
  renderPlans();
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
  $("#previewUpdated").textContent = `Cập nhật lúc ${new Date().toLocaleTimeString("vi-VN")}`;
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
  toast("Đã lưu kế hoạch chiến dịch.");
  await loadPlans();
});

$("#refreshPlans").addEventListener("click", () => loadPlans().catch((error) => toast(error.message)));

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api("/api/login", {
    method: "POST",
    body: JSON.stringify({
      username: form.get("username"),
      password: form.get("password")
    })
  });
  $("#loginScreen").hidden = true;
  toast("Đăng nhập thành công.");
  await boot();
});

$("#logoutButton").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  location.reload();
});

async function boot() {
  const session = await api("/api/session");
  state.session = session.data;
  $("#loginScreen").hidden = state.session.authenticated;
  if (!state.session.authenticated) return;

  await loadAccounts();
  await loadPlans();
  await previewPlan();
}

boot().catch((error) => {
  $("#loginScreen").hidden = false;
  toast(error.message);
});
