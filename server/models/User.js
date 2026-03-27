const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true }, // Firebase UID
    email: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "Hey there! I am using Bolo Chat." },
    customStatus: { type: String, enum: ["Online", "Away", "Do Not Disturb"], default: "Online" },
    lastSeen: { type: Number, default: Date.now },
    isOnline: { type: Boolean, default: false },
    friends: [{ type: String }], // Array of UIDs
    friendRequests: [{ type: String }], // Array of UIDs
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
