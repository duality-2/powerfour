const axios = require("axios");

const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Market salary ranges by role in INR (Indian Rupees) - Annual
const MARKET_SALARY_RANGES = {
  intern: { min: 180000, mid: 300000, max: 480000 },
  junior: { min: 360000, mid: 500000, max: 700000 },
  developer: { min: 600000, mid: 1000000, max: 1800000 },
  engineer: { min: 600000, mid: 1000000, max: 1800000 },
  "senior developer": { min: 1200000, mid: 1800000, max: 2800000 },
  "senior engineer": { min: 1200000, mid: 1800000, max: 2800000 },
  lead: { min: 1500000, mid: 2200000, max: 3500000 },
  manager: { min: 1200000, mid: 1800000, max: 3000000 },
  "senior manager": { min: 1800000, mid: 2500000, max: 4000000 },
  director: { min: 2500000, mid: 4000000, max: 6000000 },
  sales: { min: 400000, mid: 800000, max: 1500000 },
  unknown: { min: 400000, mid: 700000, max: 1200000 },
};

// Currency formatting helper for INR
function formatINR(amount) {
  return new Intl.NumberFormat("en-IN").format(amount);
}

// Calculate suggested salary based on multiple factors
function calculateSuggestedSalary(emp, budget, totalEmployees = 1) {
  const role = (emp.role || "unknown").toLowerCase();
  const perfRaw = emp.performance;
  let perfScore = 5;
  if (typeof perfRaw === "number")
    perfScore = Math.max(0, Math.min(10, perfRaw));
  else if (typeof perfRaw === "string") {
    const s = perfRaw.toLowerCase();
    if (s.includes("excel") || s.includes("ex")) perfScore = 9;
    else if (s.includes("good")) perfScore = 7;
    else if (s.includes("avg") || s.includes("average")) perfScore = 5;
    else if (s.includes("poor") || s.includes("low")) perfScore = 2;
  }

  const experience = Number(emp.experience) || 0;
  const currentSalary = emp.salary || 0;
  const revenue = emp.revenue || 0;

  // Get market range for role
  const marketRange =
    MARKET_SALARY_RANGES[role] || MARKET_SALARY_RANGES["unknown"];

  // Calculate base suggested salary from market range based on experience
  // 0-2 years: min-mid range, 3-5 years: mid range, 6+ years: mid-max range
  let baseSalary;
  if (experience <= 2) {
    baseSalary =
      marketRange.min + (marketRange.mid - marketRange.min) * (experience / 2);
  } else if (experience <= 5) {
    baseSalary =
      marketRange.mid +
      (marketRange.max - marketRange.mid) * ((experience - 2) / 3) * 0.5;
  } else {
    baseSalary =
      marketRange.mid +
      (marketRange.max - marketRange.mid) * Math.min(1, (experience - 2) / 8);
  }

  // Performance multiplier (0.8x to 1.2x based on performance 0-10)
  const perfMultiplier = 0.8 + (perfScore / 10) * 0.4;

  // Revenue-based adjustment: if employee generates high revenue, they deserve more
  // Target: salary should be 30-50% of revenue generated (profit margin consideration)
  let revenueBasedSalary = 0;
  if (revenue > 0) {
    const profitMarginTarget = 0.4; // Company wants 60% profit margin on employee
    revenueBasedSalary = revenue * (1 - profitMarginTarget);
  }

  // Budget constraint factor
  let budgetFactor = 1;
  if (budget && totalEmployees > 0) {
    const avgBudgetPerEmployee = budget / totalEmployees;
    if (avgBudgetPerEmployee < baseSalary * 0.8) {
      budgetFactor = 0.85; // Tight budget, reduce suggested salary
    } else if (avgBudgetPerEmployee > baseSalary * 1.5) {
      budgetFactor = 1.1; // Generous budget, can afford more
    }
  }

  // Combine all factors
  let suggestedSalary;
  if (revenueBasedSalary > 0) {
    // Weight: 40% market-based, 60% revenue-based
    suggestedSalary =
      baseSalary * perfMultiplier * 0.4 + revenueBasedSalary * 0.6;
  } else {
    suggestedSalary = baseSalary * perfMultiplier;
  }

  // Apply budget constraint
  suggestedSalary = suggestedSalary * budgetFactor;

  // Round to nearest 1000
  suggestedSalary = Math.round(suggestedSalary / 1000) * 1000;

  // Ensure within market bounds (with some flexibility)
  suggestedSalary = Math.max(
    marketRange.min * 0.9,
    Math.min(marketRange.max * 1.2, suggestedSalary)
  );

  // Calculate difference from current salary
  const salaryDifference =
    currentSalary > 0 ? suggestedSalary - currentSalary : 0;
  const salaryDifferencePercent =
    currentSalary > 0
      ? Math.round((salaryDifference / currentSalary) * 100)
      : 0;

  return {
    suggestedSalary: Math.round(suggestedSalary),
    salaryDifference,
    salaryDifferencePercent,
    marketRange,
    factors: {
      baseSalary: Math.round(baseSalary),
      perfMultiplier: Number(perfMultiplier.toFixed(2)),
      revenueBasedSalary: Math.round(revenueBasedSalary),
      budgetFactor: Number(budgetFactor.toFixed(2)),
    },
  };
}

// Simple heuristic fallback when OpenAI key is missing or to provide baseline
function heuristicAnalysis(emp, budget, totalEmployees = 1) {
  const role = (emp.role || "unknown").toLowerCase();
  const perfRaw = emp.performance;
  let perfScore = 5;
  if (typeof perfRaw === "number")
    perfScore = Math.max(0, Math.min(10, perfRaw));
  else if (typeof perfRaw === "string") {
    const s = perfRaw.toLowerCase();
    if (s.includes("excel") || s.includes("ex")) perfScore = 9;
    else if (s.includes("good")) perfScore = 7;
    else if (s.includes("avg") || s.includes("average")) perfScore = 5;
    else if (s.includes("poor") || s.includes("low")) perfScore = 2;
  }

  const experience = Number(emp.experience) || 0;
  const currentSalary = emp.salary || 0;

  // Get market range for role
  const marketRange =
    MARKET_SALARY_RANGES[role] || MARKET_SALARY_RANGES["unknown"];
  const estimatedSalary = currentSalary || marketRange.mid;

  // Estimated revenue contribution per year by role (in INR)
  const roleRevenue = {
    engineer: 2000000,
    developer: 2000000,
    "senior developer": 3500000,
    manager: 4000000,
    sales: 5000000,
    intern: 200000,
    unknown: 1200000,
  };
  const estimatedRevenue =
    emp.revenue || roleRevenue[role] || roleRevenue["unknown"];

  // Compute profitability
  const profit = estimatedRevenue - estimatedSalary;
  const profitPerSalary = profit / Math.max(1, estimatedSalary);

  // Budget factor
  const budgetFactor = budget ? (budget > 0 ? 1 : 0.5) : 1;

  // Combine factors
  const score =
    (profitPerSalary * 5 +
      (perfScore - 5) * 0.5 +
      Math.min(experience, 10) * 0.1) *
    budgetFactor;

  // Decision thresholds
  let action = "NO_CHANGE";
  if (perfScore <= 3 || profit < -0.2 * estimatedSalary) action = "FIRE";
  else if (
    perfScore >= 8 &&
    profit > 0.2 * estimatedSalary &&
    (!budget || budget > estimatedSalary * 0.1)
  )
    action = "PROMOTE";
  else if (profit < 0.05 * estimatedSalary || (budget && budget < 0))
    action = "DECREASE_SALARY";

  const confidence = Math.min(0.95, Math.max(0.2, 0.5 + Math.abs(score) / 10));

  // Calculate suggested salary
  const salaryAnalysis = calculateSuggestedSalary(emp, budget, totalEmployees);

  return {
    action,
    confidence: Number(confidence.toFixed(2)),
    reason: `Heuristic: revenue=Rs ${formatINR(
      estimatedRevenue
    )}, salary=Rs ${formatINR(estimatedSalary)}, profit=Rs ${formatINR(
      profit
    )}, perf=${perfScore}/10, exp=${experience} yrs, budget=${
      budget ? "Rs " + formatINR(budget) : "N/A"
    }`,
    recommended_change_percent:
      action === "PROMOTE" ? 10 : action === "DECREASE_SALARY" ? -10 : 0,
    currentSalary: currentSalary || estimatedSalary,
    suggestedSalary: salaryAnalysis.suggestedSalary,
    salaryDifference: salaryAnalysis.salaryDifference,
    salaryDifferencePercent: salaryAnalysis.salaryDifferencePercent,
    marketSalaryRange: salaryAnalysis.marketRange,
    salaryFactors: salaryAnalysis.factors,
    estimatedRevenue,
    profit,
  };
}

async function callOpenAI(employee, budget, totalEmployees = 1) {
  // Pre-calculate salary suggestion to include in prompt context
  const salaryAnalysis = calculateSuggestedSalary(
    employee,
    budget,
    totalEmployees
  );
  const marketRange =
    MARKET_SALARY_RANGES[(employee.role || "unknown").toLowerCase()] ||
    MARKET_SALARY_RANGES["unknown"];

  const systemPrompt = `You are a corporate financial analyst AI that helps Indian companies make data-driven HR decisions. 
You analyze employee data against company budget and profitability metrics. All amounts are in Indian Rupees (INR/Rs).

Your task: 
1. Recommend ONE action for the employee: FIRE, PROMOTE, DECREASE_SALARY, or NO_CHANGE
2. Suggest the DESERVED SALARY this employee should earn based on their value to the company

Consider these factors for action recommendation:
- Performance rating (higher = better)
- Experience (more experience = more valuable)
- Role and position (different roles have different revenue potential)
- Salary vs Revenue generated (profitability = revenue - salary)
- Company budget constraints

Consider these factors for salary suggestion:
- Market salary range for the role in India
- Employee's performance (high performers deserve more)
- Experience level (more experience = higher salary)
- Revenue generated (employees generating high revenue deserve proportionally more)
- Company budget (can the company afford it?)
- Profitability target (company should make ~60% profit margin on employee)

Return ONLY a JSON object with these exact keys:
{
  "action": "FIRE|PROMOTE|DECREASE_SALARY|NO_CHANGE",
  "confidence": 0.0-1.0,
  "reason": "Brief explanation for the action",
  "recommended_change_percent": integer (positive for raise, negative for cut, 0 for none),
  "suggestedSalary": integer (the full numeric amount in INR, e.g., 1200000 for Rs 12 Lakhs, NOT 12 or 12L),
  "salaryReason": "Brief explanation for why this salary is appropriate"
}

IMPORTANT: For suggestedSalary, return the FULL integer value. Example: Rs 12 Lakhs should be 1200000, NOT 12.`;

  const userPrompt = `Company Total Budget for Salaries: Rs ${
    budget ? formatINR(budget) : "Not specified"
  }
Total Employees Being Analyzed: ${totalEmployees}
Average Budget Per Employee: Rs ${
    budget ? formatINR(Math.round(budget / totalEmployees)) : "N/A"
  }

Market Salary Range for ${employee.role || "this role"} (Annual, INR):
- Minimum: Rs ${formatINR(marketRange.min)}
- Midpoint: Rs ${formatINR(marketRange.mid)}  
- Maximum: Rs ${formatINR(marketRange.max)}

Employee Data:
- SSID: ${employee.ssid}
- Name: ${employee.name || "N/A"}
- Role: ${employee.role || "N/A"}
- Performance: ${
    employee.performance || "N/A"
  } (scale: 0-10, where 10 is exceptional)
- Experience: ${employee.experience || "N/A"} years
- Current Salary: Rs ${
    employee.salary ? formatINR(employee.salary) : "Not specified"
  }
- Revenue Generated: Rs ${
    employee.revenue ? formatINR(employee.revenue) : "Not specified"
  }
- Profit Contribution: Rs ${
    employee.revenue && employee.salary
      ? formatINR(employee.revenue - employee.salary)
      : "N/A"
  }
- Status: ${employee.status || "ACTIVE"}

Reference calculation (you may adjust based on your analysis):
- Calculated suggested salary: Rs ${formatINR(salaryAnalysis.suggestedSalary)}

Analyze this employee and provide your recommendation as JSON only.`;

  const resp = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 600,
      temperature: 0.3,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const text = resp.data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");

  // Extract JSON from response
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  const jsonText =
    firstBrace >= 0 && lastBrace >= 0
      ? text.slice(firstBrace, lastBrace + 1)
      : text;

  const parsed = JSON.parse(jsonText);

  // Add market range context to response
  parsed.marketSalaryRange = marketRange;
  parsed.currentSalary = employee.salary || 0;

  // Validate suggestedSalary - if it seems too low (AI might return in lakhs), use our calculated value
  if (parsed.suggestedSalary && parsed.suggestedSalary < 10000) {
    // AI likely returned value in lakhs (e.g., 12 instead of 1200000)
    // Fall back to our calculated salary
    parsed.suggestedSalary = salaryAnalysis.suggestedSalary;
    parsed.salaryReason =
      (parsed.salaryReason || "") +
      " (Salary calculated using market analysis)";
  }

  if (parsed.suggestedSalary && employee.salary) {
    parsed.salaryDifference = parsed.suggestedSalary - employee.salary;
    parsed.salaryDifferencePercent = Math.round(
      (parsed.salaryDifference / employee.salary) * 100
    );
  }

  return parsed;
}

async function analyzeEmployee(employee, budget, totalEmployees = 1) {
  const heuristic = heuristicAnalysis(employee, budget, totalEmployees);

  if (!OPENAI_KEY) {
    return { ...heuristic, using: "heuristic" };
  }

  try {
    const aiResp = await callOpenAI(employee, budget, totalEmployees);
    if (aiResp && aiResp.action) {
      return { ...aiResp, using: "openai" };
    }
    return { ...heuristic, using: "heuristic" };
  } catch (e) {
    console.warn("OpenAI call failed, using heuristic:", e.message);
    return { ...heuristic, using: "heuristic" };
  }
}

async function analyzeAllEmployees(employees, budget) {
  const totalEmployees = employees.length;
  const results = [];

  for (const emp of employees) {
    const analysis = await analyzeEmployee(emp, budget, totalEmployees);
    results.push({
      ssid: emp.ssid,
      name: emp.name,
      role: emp.role,
      currentSalary: emp.salary,
      suggestion: analysis,
    });
  }

  // Calculate summary statistics
  const summary = {
    totalEmployees,
    companyBudget: budget,
    totalCurrentSalaries: employees.reduce(
      (sum, e) => sum + (e.salary || 0),
      0
    ),
    totalSuggestedSalaries: results.reduce(
      (sum, r) => sum + (r.suggestion.suggestedSalary || 0),
      0
    ),
    totalRevenue: employees.reduce((sum, e) => sum + (e.revenue || 0), 0),
    actionBreakdown: {
      FIRE: results.filter((r) => r.suggestion.action === "FIRE").length,
      PROMOTE: results.filter((r) => r.suggestion.action === "PROMOTE").length,
      DECREASE_SALARY: results.filter(
        (r) => r.suggestion.action === "DECREASE_SALARY"
      ).length,
      NO_CHANGE: results.filter((r) => r.suggestion.action === "NO_CHANGE")
        .length,
    },
  };

  summary.projectedSavings =
    summary.totalCurrentSalaries - summary.totalSuggestedSalaries;
  summary.currentProfitMargin =
    summary.totalRevenue > 0
      ? Math.round(
          (1 - summary.totalCurrentSalaries / summary.totalRevenue) * 100
        )
      : 0;
  summary.projectedProfitMargin =
    summary.totalRevenue > 0
      ? Math.round(
          (1 - summary.totalSuggestedSalaries / summary.totalRevenue) * 100
        )
      : 0;

  return { results, summary };
}

module.exports = {
  analyzeEmployee,
  analyzeAllEmployees,
  calculateSuggestedSalary,
  MARKET_SALARY_RANGES,
  formatINR,
};
