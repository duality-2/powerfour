const express = require("express");
const router = express.Router();
const ai = require("./ai");
const Employee = require("./models/Employee");
const Action = require("./models/Action");

// Helper to format amount in INR with Rs prefix
const formatRs = (amount) => {
  if (amount === null || amount === undefined) return null;
  return `Rs ${ai.formatINR(amount)}`;
};

// Helper to add formatted currency fields to employee object
const addFormattedFields = (emp) => {
  if (!emp) return emp;
  const formatted = { ...emp };
  formatted.salaryFormatted = formatRs(emp.salary);
  formatted.revenueFormatted = formatRs(emp.revenue);
  if (emp.salary && emp.revenue) {
    formatted.profitFormatted = formatRs(emp.revenue - emp.salary);
  }
  if (emp.suggestion) {
    formatted.suggestion = { ...emp.suggestion };
    if (emp.suggestion.suggestedSalary) {
      formatted.suggestion.suggestedSalaryFormatted = formatRs(
        emp.suggestion.suggestedSalary
      );
    }
    if (emp.suggestion.currentSalary) {
      formatted.suggestion.currentSalaryFormatted = formatRs(
        emp.suggestion.currentSalary
      );
    }
    if (emp.suggestion.salaryDifference) {
      formatted.suggestion.salaryDifferenceFormatted = formatRs(
        Math.abs(emp.suggestion.salaryDifference)
      );
    }
    if (emp.suggestion.marketSalaryRange) {
      formatted.suggestion.marketSalaryRangeFormatted = {
        min: formatRs(emp.suggestion.marketSalaryRange.min),
        mid: formatRs(emp.suggestion.marketSalaryRange.mid),
        max: formatRs(emp.suggestion.marketSalaryRange.max),
      };
    }
  }
  return formatted;
};

// List all employees and actions
router.get("/employees", async (req, res, next) => {
  try {
    const employees = await Employee.find().lean();
    const actions = await Action.find().sort({ appliedAt: -1 }).lean();
    res.json({
      employees: employees.map(addFormattedFields),
      actions: actions.map((a) => ({
        ...a,
        detailsFormatted: a.details
          ? {
              ...a.details,
              previousSalaryFormatted: a.details.previousSalary
                ? formatRs(a.details.previousSalary)
                : null,
              newSalaryFormatted: a.details.newSalary
                ? formatRs(a.details.newSalary)
                : null,
              salaryFormatted: a.details.salary
                ? formatRs(a.details.salary)
                : null,
            }
          : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Get single employee by ssid
router.get("/employees/:ssid", async (req, res, next) => {
  try {
    const emp = await Employee.findOne({ ssid: req.params.ssid }).lean();
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    const actions = await Action.find({ ssid: req.params.ssid })
      .sort({ appliedAt: -1 })
      .lean();
    res.json({
      employee: addFormattedFields(emp),
      actions: actions.map((a) => ({
        ...a,
        detailsFormatted: a.details
          ? {
              previousSalaryFormatted: a.details.previousSalary
                ? formatRs(a.details.previousSalary)
                : null,
              newSalaryFormatted: a.details.newSalary
                ? formatRs(a.details.newSalary)
                : null,
            }
          : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Add or update employee in database
router.post("/employees", async (req, res, next) => {
  try {
    const { ssid, name, performance, experience, role, salary, revenue } =
      req.body;
    if (!ssid) return res.status(400).json({ error: "ssid is required" });

    const updateData = {
      ssid,
      name,
      performance,
      experience,
      role,
      salary,
      revenue,
      status: "ACTIVE",
    };
    const emp = await Employee.findOneAndUpdate(
      { ssid },
      { $set: updateData },
      { upsert: true, new: true, runValidators: true }
    );
    const empObj = emp.toObject();
    res.json({
      ok: true,
      employee: addFormattedFields(empObj),
    });
  } catch (err) {
    next(err);
  }
});

// Bulk add employees
router.post("/employees/bulk", async (req, res, next) => {
  try {
    const employees = req.body;
    if (!Array.isArray(employees))
      return res.status(400).json({ error: "Expected array of employees" });

    const results = [];
    for (const emp of employees) {
      if (!emp.ssid) {
        results.push({ ssid: null, error: "Missing ssid" });
        continue;
      }
      const updated = await Employee.findOneAndUpdate(
        { ssid: emp.ssid },
        { $set: { ...emp, status: emp.status || "ACTIVE" } },
        { upsert: true, new: true, runValidators: true }
      );
      results.push({ ssid: emp.ssid, ok: true });
    }
    res.json({ ok: true, results });
  } catch (err) {
    next(err);
  }
});

// ANALYZE: Fetch employees from DB and analyze with AI using company budget
// POST /api/analyze
// Body: { budget: number, ssids?: string[] }
// - budget: company's available budget for salary adjustments
// - ssids: optional array of employee ssids to analyze (if omitted, analyzes all)
router.post("/analyze", async (req, res, next) => {
  try {
    const { budget, ssids } = req.body;

    if (budget === undefined || budget === null) {
      return res
        .status(400)
        .json({ error: "budget is required (company's available budget)" });
    }

    // Fetch employees from database
    let query = { status: { $ne: "FIRED" } }; // Don't analyze fired employees
    if (ssids && Array.isArray(ssids) && ssids.length > 0) {
      query.ssid = { $in: ssids };
    }

    const employees = await Employee.find(query).lean();

    if (employees.length === 0) {
      return res.status(404).json({ error: "No employees found to analyze" });
    }

    // Analyze all employees with AI (now returns { results, summary })
    const analysis = await ai.analyzeAllEmployees(employees, budget);

    // Save suggestions back to database
    for (const result of analysis.results) {
      await Employee.findOneAndUpdate(
        { ssid: result.ssid },
        { $set: { suggestion: result.suggestion, lastAnalyzed: new Date() } }
      );
    }

    res.json({
      budget,
      budgetFormatted: formatRs(budget),
      employeesAnalyzed: employees.length,
      summary: {
        ...analysis.summary,
        companyBudgetFormatted: formatRs(analysis.summary.companyBudget),
        totalCurrentSalariesFormatted: formatRs(
          analysis.summary.totalCurrentSalaries
        ),
        totalSuggestedSalariesFormatted: formatRs(
          analysis.summary.totalSuggestedSalaries
        ),
        totalRevenueFormatted: formatRs(analysis.summary.totalRevenue),
        projectedSavingsFormatted: formatRs(
          Math.abs(analysis.summary.projectedSavings)
        ),
        projectedSavingsType:
          analysis.summary.projectedSavings >= 0 ? "savings" : "increase",
      },
      results: analysis.results.map((r) => ({
        ...r,
        currentSalaryFormatted: formatRs(r.currentSalary),
        suggestion: {
          ...r.suggestion,
          suggestedSalaryFormatted: r.suggestion.suggestedSalary
            ? formatRs(r.suggestion.suggestedSalary)
            : null,
          currentSalaryFormatted: r.suggestion.currentSalary
            ? formatRs(r.suggestion.currentSalary)
            : null,
          salaryDifferenceFormatted: r.suggestion.salaryDifference
            ? formatRs(Math.abs(r.suggestion.salaryDifference))
            : null,
          salaryChangeType:
            r.suggestion.salaryDifference >= 0 ? "increase" : "decrease",
          marketSalaryRangeFormatted: r.suggestion.marketSalaryRange
            ? {
                min: formatRs(r.suggestion.marketSalaryRange.min),
                mid: formatRs(r.suggestion.marketSalaryRange.mid),
                max: formatRs(r.suggestion.marketSalaryRange.max),
              }
            : null,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
});

// APPLY ACTION: Human confirms action, system applies it automatically
// POST /api/action
// Body: { ssid: string, action: string, note?: string, changePercent?: number }
router.post("/action", async (req, res, next) => {
  try {
    const { ssid, action, note, changePercent } = req.body;

    if (!ssid || !action) {
      return res.status(400).json({ error: "ssid and action are required" });
    }

    const validActions = ["FIRE", "PROMOTE", "DECREASE_SALARY", "NO_CHANGE"];
    if (!validActions.includes(action)) {
      return res
        .status(400)
        .json({ error: `action must be one of: ${validActions.join(", ")}` });
    }

    const emp = await Employee.findOne({ ssid });
    if (!emp) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Determine salary change percentage
    const salaryChangePercent =
      changePercent !== undefined
        ? changePercent
        : emp.suggestion?.recommended_change_percent ||
          (action === "PROMOTE" ? 10 : action === "DECREASE_SALARY" ? -10 : 0);

    const previousSalary = emp.salary || emp.suggestion?.estimatedSalary || 0;
    let newSalary = previousSalary;
    let actionDetails = {};

    // Apply action automatically
    switch (action) {
      case "FIRE":
        emp.status = "FIRED";
        emp.terminatedAt = new Date();
        actionDetails = {
          effect: "Employee terminated",
          previousStatus: "ACTIVE",
          newStatus: "FIRED",
        };
        break;

      case "PROMOTE":
        emp.status = "ACTIVE";
        newSalary = Math.round(
          previousSalary * (1 + salaryChangePercent / 100)
        );
        emp.salary = newSalary;
        emp.lastPromotedAt = new Date();
        actionDetails = {
          effect: "Salary increased",
          previousSalary,
          newSalary,
          changePercent: salaryChangePercent,
        };
        break;

      case "DECREASE_SALARY":
        emp.status = "ACTIVE";
        newSalary = Math.round(
          previousSalary * (1 + salaryChangePercent / 100)
        ); // changePercent is negative
        emp.salary = newSalary;
        actionDetails = {
          effect: "Salary decreased",
          previousSalary,
          newSalary,
          changePercent: salaryChangePercent,
        };
        break;

      case "NO_CHANGE":
        emp.status = "ACTIVE";
        actionDetails = {
          effect: "No changes made",
          salary: previousSalary,
        };
        break;
    }

    // Save employee changes
    await emp.save();

    // Record the action in history
    const actionRecord = await Action.create({
      ssid,
      action,
      note: note || null,
      details: actionDetails,
      appliedAt: new Date(),
    });

    res.json({
      ok: true,
      message: `Action ${action} applied successfully`,
      applied: actionRecord.toObject(),
      employee: addFormattedFields(emp.toObject()),
      actionDetails,
      actionDetailsFormatted: {
        effect: actionDetails.effect,
        previousSalaryFormatted: actionDetails.previousSalary
          ? formatRs(actionDetails.previousSalary)
          : null,
        newSalaryFormatted: actionDetails.newSalary
          ? formatRs(actionDetails.newSalary)
          : null,
        salaryFormatted: actionDetails.salary
          ? formatRs(actionDetails.salary)
          : null,
        changePercent: actionDetails.changePercent,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get action history for an employee
router.get("/actions/:ssid", async (req, res, next) => {
  try {
    const actions = await Action.find({ ssid: req.params.ssid })
      .sort({ appliedAt: -1 })
      .lean();
    res.json({ ssid: req.params.ssid, actions });
  } catch (err) {
    next(err);
  }
});

// Get all pending suggestions (employees with suggestions but no recent action)
router.get("/pending", async (req, res, next) => {
  try {
    const employees = await Employee.find({
      suggestion: { $exists: true },
      status: { $ne: "FIRED" },
    }).lean();

    res.json({
      count: employees.length,
      employees: employees.map((e) => ({
        ssid: e.ssid,
        name: e.name,
        role: e.role,
        salary: e.salary,
        salaryFormatted: formatRs(e.salary),
        suggestion: e.suggestion,
        suggestionFormatted: e.suggestion
          ? {
              suggestedSalaryFormatted: e.suggestion.suggestedSalary
                ? formatRs(e.suggestion.suggestedSalary)
                : null,
              salaryDifferenceFormatted: e.suggestion.salaryDifference
                ? formatRs(Math.abs(e.suggestion.salaryDifference))
                : null,
              salaryChangeType:
                e.suggestion.salaryDifference >= 0 ? "increase" : "decrease",
            }
          : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
