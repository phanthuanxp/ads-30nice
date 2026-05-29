export function buildOptimizationNotes(campaigns) {
  const notes = [];

  for (const campaign of campaigns) {
    if (campaign.status !== "ACTIVE") continue;

    if (campaign.spend > 0 && campaign.results === 0) {
      notes.push({
        priority: "high",
        title: "Spend có kết quả bằng 0",
        campaign: campaign.name,
        action: "Tạm dừng hoặc đổi objective/creative trước khi tăng ngân sách."
      });
    }

    if (campaign.ctr > 0 && campaign.ctr < 1.2) {
      notes.push({
        priority: "medium",
        title: "CTR thấp",
        campaign: campaign.name,
        action: "Tạo 3-5 biến thể hook và creative mới, ưu tiên message đầu tiên rõ hơn."
      });
    }

    if (campaign.frequency >= 2.6 && campaign.ctr < 2) {
      notes.push({
        priority: "medium",
        title: "Dấu hiệu lặp tần suất",
        campaign: campaign.name,
        action: "Mở rộng audience hoặc refresh creative để tránh giảm hiệu quả."
      });
    }

    if (campaign.results >= 30 && campaign.costPerResult > 0 && campaign.ctr >= 2.5) {
      notes.push({
        priority: "low",
        title: "Có thể scale có kiểm soát",
        campaign: campaign.name,
        action: "Tăng budget 15-25% và theo dõi CPA trong 24-48 giờ."
      });
    }
  }

  if (notes.length === 0) {
    notes.push({
      priority: "low",
      title: "Chưa có cảnh báo lớn",
      campaign: "Tổng quan",
      action: "Tiếp tục gom dữ liệu, ưu tiên A/B test offer và creative mới."
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
      scaleRule: "Tăng 15-25% khi CPA ổn định và có ít nhất 30 kết quả."
    },
    structure: {
      campaigns: 1,
      adSets: [
        {
          name: "Broad + Advantage",
          audience: `${input.location || "Việt Nam"}, age ${input.ageMin || 22}-${input.ageMax || 55}`,
          budgetShare: "40%"
        },
        {
          name: "Interest Stack",
          audience: input.audience || "Nhóm quan tâm chính theo ngành",
          budgetShare: "35%"
        },
        {
          name: "Remarketing",
          audience: "Người đã tương tác page/video/website 30-180 ngày",
          budgetShare: "25%"
        }
      ],
      adsPerAdSet: 3,
      placements: channels
    },
    creatives: [
      {
        angle: "Pain point",
        hook: `Vấn đề lớn nhất của khách hàng khi cần ${input.offer || "giải pháp"} là gì?`,
        format: "Short video or image proof"
      },
      {
        angle: "Offer",
        hook: `${input.offer || "Ưu đãi"} với lợi ích rõ trong 1 câu đầu tiên.`,
        format: "Static image with clear CTA"
      },
      {
        angle: "Trust",
        hook: "Bằng chứng kết quả, review, quy trình hoặc cam kết dịch vụ.",
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
