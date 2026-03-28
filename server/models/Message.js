const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    message: { type: String },
    imageUrl: { type: String },
    repliedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    type: { type: String, enum: ["private", "group"], default: "private" },
    senderName: { type: String }, // denormalized for group chats
    senderAvatar: { type: String }, // denormalized for group chats
    timestamp: { type: Number, default: Date.now },
    delivered: { type: Boolean, default: true },
    seen: { type: Boolean, default: false },
    reactions: {
      type: Map,
      of: [String], // Array of usernames who reacted with this emoji
      default: {},
    },
  },
  { timestamps: true }
);

// Compound indexes
messageSchema.index({ from: 1, to: 1, timestamp: 1 });
messageSchema.index({ to: 1, timestamp: 1 }); // index for group messages by groupId (to)
messageSchema.index({ message: "text" }); // text index for search

module.exports = mongoose.model("Message", messageSchema);
