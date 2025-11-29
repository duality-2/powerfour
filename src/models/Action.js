const mongoose = require("mongoose");

const actionSchema = new mongoose.Schema(
  {
    ssid: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ["FIRE", "PROMOTE", "DECREASE_SALARY", "NO_CHANGE"],
      required: true,
    },
    note: { type: String },
    details: {
      effect: String,
      previousSalary: Number,
      newSalary: Number,
      changePercent: Number,
      previousStatus: String,
      newStatus: String,
    },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Action", actionSchema);
