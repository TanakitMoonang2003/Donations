const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    donorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    message: {
      type: String,
      default: "",
      maxlength: 300,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    slipRef: {
      type: String,
      trim: true,
      default: undefined,
      unique: true,
      sparse: true,
    },
    // ใช้แยก donation ตามสตรีมเมอร์เมื่อขยายเป็น multi-user
    streamerId: {
      type: String,
      default: "default",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Donation", donationSchema);