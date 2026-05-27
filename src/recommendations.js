export function buildOptimizationNotes(campaigns) {
  const notes = [];

  for (const campaign of campaigns) {
    if (campaign.status !== "ACTIVE") continue;

    if (campaign.spend > 0 && campaign.results === 0) {
      notes.push({
        priority: "high",
        title: "Spend co ket qua bang 0",
        campaign: campaign.name,
        action: "Tam dung hoac doi objective/creative truoc khi tang ngan sach."
      });
    }

    if (campaign.ctr > 0 && campaign.ctr < 1.2) {
      notes.push({
        priority: "medium",
        title: "CTR thap",
        campaign: campaign.name,
        action: "Tao 3-5 bien the hook va creative moi, uu tien message dau tien ro hon."
      });
    }

    if (campaign.frequency >= 2.6 && campaign.ctr < 2) {
      notes.push({
        priority: "medium",
        title: "Dau hieu lap tan suat",
        campaign: campaign.name,
        action: "Mo rong audience hoac refresh creative de tranh giam hieu qua."
      });
    }

    if (campaign.results >= 30 && campaign.costPerResult > 0 && campaign.ctr >= 2.5) {
      notes.push({
        priority: "low",
        title: "Co the scale co kiem soat",
        campaign: campaign.name,
        action: "Tang budget 15-25% va theo doi CPA trong 24-48 gio."
      });
    }
  }

  if (notes.length === 0) {
    notes.push({
      priority: "low",
      title: "Chua co canh bao lon",
      campaign: "Tong quan",
      action: "Tiep tuc gom du lieu, uu tien A/B test offer va creative moi."
    });
  }

  return notes;
}

export function buildCampaignPlan(input) {
  const objectiveMap = {
    leads: "OUTCOME_LEADS",
    messages: "OUTCOME_ENGAGEMENT",
    sales: "OUTCOME_SALES",
    traffic: "OUTCOME_TRAFFIC",
    awareness: "OUTCOME_AWARENESS"
  };

  const channels = input.channels?.length ? input.channels : ["facebook", "instagram"];
  const dailyBudget = Number(input.dailyBudget || 0);

  return {
    name: `${input.industry || "General"} - ${input.offer || "Core offer"} - ${input.location || "VN"}`,
    objective: objectiveMap[input.goal] || "OUTCOME_LEADS",
    budget: {
      daily: dailyBudget,
      testPhaseDays: 5,
      scaleRule: "Tang 15-25% khi CPA on dinh va co it nhat 30 ket qua."
    },
    structure: {
      campaigns: 1,
      adSets: [
        {
          name: "Broad + Advantage",
          audience: `${input.location || "Viet Nam"}, age ${input.ageMin || 22}-${input.ageMax || 55}`,
          budgetShare: "40%"
        },
        {
          name: "Interest Stack",
          audience: input.audience || "Nhom quan tam chinh theo nganh",
          budgetShare: "35%"
        },
        {
          name: "Remarketing",
          audience: "Nguoi da tuong tac page/video/website 30-180 ngay",
          budgetShare: "25%"
        }
      ],
      adsPerAdSet: 3,
      placements: channels
    },
    creatives: [
      {
        angle: "Pain point",
        hook: `Van de lon nhat cua khach hang khi can ${input.offer || "giai phap"} la gi?`,
        format: "Short video or image proof"
      },
      {
        angle: "Offer",
        hook: `${input.offer || "Uu dai"} voi loi ich ro trong 1 cau dau tien.`,
        format: "Static image with clear CTA"
      },
      {
        angle: "Trust",
        hook: "Bang chung ket qua, review, quy trinh hoac cam ket dich vu.",
        format: "UGC/review style"
      }
    ],
    tracking: {
      utm_source: "facebook",
      utm_medium: "paid_social",
      utm_campaign: "{{campaign.name}}",
      requiredEvents: ["lead", "message", "purchase"]
    },
    launchStatus: "PAUSED"
  };
}
