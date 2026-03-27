const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    admin: { type: String, required: true }, // UID of the creator
    members: [{ type: String }], // Array of UIDs
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);
