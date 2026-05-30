const state = {
  accounts: [],
  campaigns: [],
  recommendations: [],
  plans: [],
  metaConfig: null,
  accountQuery: "",
  selectedAccountId: "",
  datePreset: "last_7d",
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

function accountStatusLabel(status) {
  const labels = {
    1: "Đang hoạt động",
    2: "Đã vô hiệu",
    3: "Chưa thanh toán",
    7: "Đang chờ xét duyệt",
    9: "Đang chờ đóng"
  };
  return labels[Number(status)] || `Trạng thái ${status || "không rõ"}`;
}

function datePresetLabel(value = state.datePreset) {
  const labels = {
    last_7d: "7 ngày gần nhất",
    last_14d: "14 ngày gần nhất",
    last_30d: "30 ngày gần nhất",
    this_month: "Tháng này",
    last_month: "Tháng trước"
  };
  return labels[value] || value;
}

function selectedAccount() {
  return state.accounts.find((account) => account.id === state.selectedAccountId) || state.accounts[0];
}

function renderAccounts(meta) {
  $("#metaStatus").textContent = meta.configured ? "Meta API đã cấu hình" : "Đang dùng dữ liệu mẫu";
  const query = state.accountQuery.trim().toLowerCase();
  const filteredAccounts = state.accounts.filter((account) => {
    if (!query) return true;
    return `${account.name} ${account.id}`.toLowerCase().includes(query);
  });

  $("#summaryAccounts").textContent = number.format(state.accounts.length);
  $("#summaryAccountsMeta").textContent = meta.configured ? "Đã kết nối Meta" : "Dữ liệu mẫu";

  if (!filteredAccounts.length) {
    $("#accountGrid").innerHTML = `<div class="empty-state">Không tìm thấy tài khoản quảng cáo phù hợp.</div>`;
    return;
  }

  $("#accountGrid").innerHTML = filteredAccounts
    .map(
      (account) => `
        <button class="account-card ${account.id === state.selectedAccountId ? "selected" : ""}" data-account-id="${escapeHtml(account.id)}">
          <strong>${escapeHtml(account.name)}</strong>
          <span class="account-status ${Number(account.account_status) === 1 ? "good" : "warn"}">${escapeHtml(accountStatusLabel(account.account_status))}</span>
          <div class="account-meta">
            <span>${escapeHtml(account.id)}</span>
            <span>${escapeHtml(account.currency || "VND")}</span>
          </div>
          <div class="account-meta">
            <span>${escapeHtml(account.timezone_name || "Asia/Ho_Chi_Minh")}</span>
            <span>${account.source === "meta" ? "Meta" : "Sample"}</span>
          </div>
        </button>
      `
    )
    .join("");

  document.querySelectorAll("[data-account-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedAccountId = button.dataset.accountId;
      $("#accountSelect").value = state.selectedAccountId;
      renderAccounts({ configured: state.metaConfig?.configured });
      await loadCampaigns(state.selectedAccountId);
    });
  });

  $("#accountSelect").innerHTML = state.accounts
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
    .join("");
  $("#accountSelect").value = state.selectedAccountId;
}

function renderMetaConfig() {
  const meta = state.metaConfig;
  if (!meta) return;

  $("#metaConfigForm").elements.apiVersion.value = meta.apiVersion || "v25.0";
  $("#metaConfigForm").elements.businessId.value = meta.businessId || "";
  $("#metaConfigForm").elements.accessToken.value = "";
  $("#metaConfigStatus").innerHTML = meta.configured
    ? `Đang kết nối với Business ID <strong>${escapeHtml(meta.businessId)}</strong>. Token hiện tại: <strong>${escapeHtml(meta.accessTokenPreview)}</strong>.`
    : "Chưa cấu hình Meta API. Hệ thống sẽ dùng dữ liệu mẫu cho đến khi anh nhập Business ID và Access Token.";
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
    ["Chi tiêu", formatSpend(totals.spend)],
    ["Hiển thị", number.format(totals.impressions)],
    ["Clicks", number.format(totals.clicks)],
    ["CTR", `${number.format(ctr)}%`],
    ["CPA", formatSpend(cpa)]
  ]
    .map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  $("#summaryActiveCampaigns").textContent = number.format(
    state.campaigns.filter((campaign) => campaign.status === "ACTIVE" || campaign.effective_status === "ACTIVE").length
  );
  $("#summarySpend").textContent = formatSpend(totals.spend);
  $("#summaryDatePreset").textContent = datePresetLabel();
  $("#summaryAlerts").textContent = number.format(state.recommendations.filter((note) => note.priority !== "low").length);
}

function renderCampaigns() {
  if (!state.campaigns.length) {
    $("#campaignRows").innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">Chưa có campaign trong khoảng thời gian đã chọn.</div>
        </td>
      </tr>
    `;
    return;
  }

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

function renderSelectedAccount() {
  const account = selectedAccount();
  if (!account) {
    $("#selectedAccountSummary").innerHTML = "";
    return;
  }

  $("#selectedAccountSummary").innerHTML = `
    <div>
      <span>Tài khoản đang xem</span>
      <strong>${escapeHtml(account.name)}</strong>
    </div>
    <div>
      <span>ID</span>
      <strong>${escapeHtml(account.id)}</strong>
    </div>
    <div>
      <span>Tiền tệ</span>
      <strong>${escapeHtml(account.currency || "VND")}</strong>
    </div>
    <div>
      <span>Trạng thái</span>
      <strong>${escapeHtml(accountStatusLabel(account.account_status))}</strong>
    </div>
  `;
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
  state.selectedAccountId = state.selectedAccountId || state.accounts[0]?.id || "";
  renderAccounts(payload.meta);
  if (state.accounts.length) {
    $("#accountSelect").value = state.selectedAccountId;
    await loadCampaigns(state.selectedAccountId);
  }
}

async function loadMetaConfig() {
  const payload = await api("/api/meta-config");
  state.metaConfig = payload.data;
  renderMetaConfig();
}

async function loadPlans() {
  const payload = await api("/api/plans");
  state.plans = payload.data;
  renderPlans();
}

async function loadCampaigns(accountId) {
  if (!accountId) return;
  $("#campaignRows").innerHTML = `
    <tr>
      <td colspan="8">
        <div class="empty-state">Đang tải dữ liệu campaign...</div>
      </td>
    </tr>
  `;
  renderSelectedAccount();

  const payload = await api(`/api/ad-accounts/${encodeURIComponent(accountId)}/campaigns?date_preset=${encodeURIComponent(state.datePreset)}`);
  state.campaigns = payload.data;
  state.recommendations = payload.recommendations;
  renderSelectedAccount();
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
$("#accountSearch").addEventListener("input", (event) => {
  state.accountQuery = event.target.value;
  renderAccounts({ configured: state.metaConfig?.configured });
});
$("#accountSelect").addEventListener("change", (event) =>
  {
    state.selectedAccountId = event.target.value;
    renderAccounts({ configured: state.metaConfig?.configured });
    loadCampaigns(event.target.value).catch((error) => toast(error.message));
  }
);
$("#datePreset").addEventListener("change", (event) => {
  state.datePreset = event.target.value;
  loadCampaigns(state.selectedAccountId).catch((error) => toast(error.message));
});
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

$("#metaConfigForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const form = new FormData(event.currentTarget);
    $("#metaConfigStatus").textContent = "Đang kiểm tra token với Meta API...";

    const payload = await api("/api/meta-config", {
      method: "POST",
      body: JSON.stringify({
        apiVersion: form.get("apiVersion"),
        businessId: form.get("businessId"),
        accessToken: form.get("accessToken")
      })
    });

    state.metaConfig = payload.data;
    renderMetaConfig();
    toast(`Đã kết nối Meta. Tìm thấy ${payload.validation.accountCount} tài khoản quảng cáo.`);
    await loadAccounts();
  } catch (error) {
    $("#metaConfigStatus").textContent = error.message;
    toast(error.message);
  }
});

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

  await loadMetaConfig();
  await loadAccounts();
  await loadPlans();
  await previewPlan();
}

boot().catch((error) => {
  $("#loginScreen").hidden = false;
  toast(error.message);
});
