const mongoose = require("mongoose");

const marketRangeSchema = new mongoose.Schema(
  {
    min: Number,
    mid: Number,
    max: Number,
  },
  { _id: false }
);

const salaryFactorsSchema = new mongoose.Schema(
  {
    baseSalary: Number,
    perfMultiplier: Number,
    revenueBasedSalary: Number,
    budgetFactor: Number,
  },
  { _id: false }
);

const suggestionSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["FIRE", "PROMOTE", "DECREASE_SALARY", "NO_CHANGE"],
    },
    confidence: Number,
    reason: String,
    recommended_change_percent: Number,
    // Salary suggestion fields
    currentSalary: Number,
    suggestedSalary: Number,
    salaryDifference: Number,
    salaryDifferencePercent: Number,
    salaryReason: String,
    marketSalaryRange: marketRangeSchema,
    salaryFactors: salaryFactorsSchema,
    // Other fields
    estimatedRevenue: Number,
    profit: Number,
    using: String,
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    ssid: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    performance: { type: mongoose.Schema.Types.Mixed }, // number or string
    experience: { type: Number },
    role: { type: String },
    salary: { type: Number },
    revenue: { type: Number },
    status: { type: String, default: "ACTIVE" },
    suggestion: suggestionSchema,
    lastAnalyzed: { type: Date },
    lastPromotedAt: { type: Date },
    terminatedAt: { type: Date },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Employee", employeeSchema);
