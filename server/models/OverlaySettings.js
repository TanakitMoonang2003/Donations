const mongoose = require("mongoose");

const overlaySettingsSchema = new mongoose.Schema(
  {
    streamerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    overlayToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    backgroundColor: { type: String, default: "#17172b" },
    textColor: { type: String, default: "#ffffff" },
    fontFamily: { type: String, default: "system-ui, sans-serif" },
    fontSize: { type: Number, default: 28, min: 12, max: 96 },
    messageTemplate: {
      type: String,
      default: "{name} donate {amount} บาท",
      maxlength: 200,
    },
    mediaUrl: { type: String, default: "", maxlength: 500 },
    soundUrl: { type: String, default: "", maxlength: 500 },
    speechEnabled: { type: Boolean, default: true },
    speechTemplate: {
      type: String,
      default: "{name} บริจาค {amount} บาท {message}",
      maxlength: 300,
    },
    speechRate: { type: Number, default: 1, min: 0.5, max: 2 },
    duration: { type: Number, default: 6, min: 1, max: 20 },
    enterAnimation: {
      type: String,
      enum: ["fade", "slide-up", "pop", "none"],
      default: "slide-up",
    },
    exitAnimation: {
      type: String,
      enum: ["fade", "slide-down", "shrink", "none"],
      default: "fade",
    },
    minimumAmount: { type: Number, default: 1, min: 0, max: 50000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OverlaySettings", overlaySettingsSchema);
