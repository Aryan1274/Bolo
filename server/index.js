// === Core dependencies ===
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

// === Database ===
const mongoose = require("mongoose");
const Message = require("./models/Message");
const User = require("./models/User");
const Group = require("./models/Group");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// === Cloudinary & file upload ===
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// === Configure Cloudinary ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === Allowed origins ===
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",");

// === Initialize Express + HTTP server ===
const app = express();
const server = http.createServer(app);

// === Middleware ===
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, mobile apps) or from allowed list
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: origin ${origin} not allowed`));
    }
  },
  methods: ["GET", "POST"],
}));
app.use(express.json());

// === Multer: memory storage with file size & type validation ===
const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/plain",
  "video/mp4", "video/webm",
];
const MAX_FILE_SIZE_MB = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed.`), false);
    }
  },
});

// === File Upload Endpoint ===
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const streamUpload = () =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "chat_images",
          resource_type: "auto", // auto-detect image vs video vs raw
        },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

  streamUpload()
    .then((result) =>
      res.json({ imageUrl: result.secure_url, fileName: result.original_filename })
    )
    .catch((err) => {
      console.error("Upload error:", err);
      res.status(500).json({ error: "File upload failed" });
    });
});

// === Multer error handler ===
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: `File too large. Max size is ${MAX_FILE_SIZE_MB}MB.` });
  }
  if (err.message && err.message.includes("not allowed")) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// === REST API: Users & Profiles ===

// Sync user from Firebase on login
app.post("/api/users/sync", async (req, res) => {
  try {
    const { uid, email, displayName, avatarUrl } = req.body;
    if (!uid || !email) return res.status(400).json({ error: "Missing required fields" });

    // Upsert user
    const user = await User.findOneAndUpdate(
      { uid },
      { 
        $set: { email, isOnline: true },
        // Only set these on insert, don't overwrite if user customized them later
        $setOnInsert: { displayName, avatarUrl, bio: "Hey there! I am using Bolo Chat." } 
      },
      { new: true, upsert: true }
    );
    res.json(user);
  } catch (error) {
    console.error("User sync error:", error);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

// Get user profile
app.get("/api/users/:uid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Update user profile
app.put("/api/users/:uid", async (req, res) => {
  try {
    const { displayName, bio, customStatus, avatarUrl } = req.body;
    const updateData = {};
    if (displayName) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (customStatus) updateData.customStatus = customStatus;
    if (avatarUrl) updateData.avatarUrl = avatarUrl;
    
    const user = await User.findOneAndUpdate(
      { uid: req.params.uid },
      updateData,
      { new: true }
    );
    
    // Broadcast profile update if online
    const onlineEntry = Object.entries(onlineUsers).find(([name, data]) => data.uid === req.params.uid || name === user.displayName);
    if (onlineEntry) {
      if (avatarUrl) onlineUsers[onlineEntry[0]].avatar = avatarUrl;
      io.emit("online_users", Object.entries(onlineUsers).map(([name, data]) => ({
        username: name,
        avatar: data.avatar,
        status: user.customStatus
      })));
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Fetch all users (for friends/search feature later)
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "uid displayName avatarUrl customStatus isOnline lastSeen bio friends friendRequests");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Send friend request
app.post("/api/users/:uid/friend-request", async (req, res) => {
  try {
    const targetUid = req.params.uid;
    const { requesterUid } = req.body;
    if (!requesterUid) return res.status(400).json({ error: "Missing requester ID" });

    await User.findOneAndUpdate(
      { uid: targetUid },
      { $addToSet: { friendRequests: requesterUid } }
    );

    // Notify target user via socket
    const targetSocket = getSocketByUid(targetUid);
    if (targetSocket) {
      io.to(targetSocket).emit("friend_update", { type: "request_received", from: requesterUid });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to send request" });
  }
});

// Accept friend request
app.post("/api/users/:uid/friend-accept", async (req, res) => {
  try {
    const targetUid = req.params.uid; // The user who accepted
    const { requesterUid } = req.body; // The user who sent the request

    // Remove from requests, add to friends (for target)
    await User.findOneAndUpdate(
      { uid: targetUid },
      { 
        $pull: { friendRequests: requesterUid },
        $addToSet: { friends: requesterUid }
      }
    );
    // Add to friends (for requester)
    await User.findOneAndUpdate(
      { uid: requesterUid },
      { $addToSet: { friends: targetUid } }
    );

    // Notify requester user via socket
    const requesterSocket = getSocketByUid(requesterUid);
    if (requesterSocket) {
      io.to(requesterSocket).emit("friend_update", { type: "request_accepted", from: targetUid });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to accept request" });
  }
});

// Reject or Cancel friend request
app.post("/api/users/:uid/friend-reject", async (req, res) => {
  try {
    const targetUid = req.params.uid;
    const { requesterUid } = req.body;

    await User.findOneAndUpdate(
      { uid: targetUid },
      { $pull: { friendRequests: requesterUid } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject request" });
  }
});

// Remove friend
app.post("/api/users/:uid/friend-remove", async (req, res) => {
  try {
    const targetUid = req.params.uid;
    const { friendUid } = req.body;

    await User.findOneAndUpdate(
      { uid: targetUid },
      { $pull: { friends: friendUid } }
    );
    await User.findOneAndUpdate(
      { uid: friendUid },
      { $pull: { friends: targetUid } }
    );

    // Notify both users via socket
    const targetSocket = getSocketByUid(targetUid);
    const friendSocket = getSocketByUid(friendUid);
    if (targetSocket) io.to(targetSocket).emit("friend_update", { type: "friend_removed", target: friendUid });
    if (friendSocket) io.to(friendSocket).emit("friend_update", { type: "friend_removed", target: targetUid });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

// === REST API: Groups ===

// Create a new group
app.post("/api/groups/create", async (req, res) => {
  try {
    const { name, description, avatarUrl, adminUid, members } = req.body;
    if (!name || !adminUid) return res.status(400).json({ error: "Missing required fields" });

    const newGroup = new Group({
      name,
      description,
      avatarUrl,
      admin: adminUid,
      members: Array.from(new Set([...(members || []), adminUid])),
    });
    const savedGroup = await newGroup.save();
    res.json(savedGroup);
  } catch (error) {
    res.status(500).json({ error: "Failed to create group" });
  }
});

// Get all groups for a specific user
app.get("/api/groups/user/:uid", async (req, res) => {
  try {
    const groups = await Group.find({ members: req.params.uid });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Add member to group
app.post("/api/groups/:id/add-member", async (req, res) => {
  try {
    const { memberUid } = req.body;
    const group = await Group.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: memberUid } },
      { new: true }
    );
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: "Failed to add member" });
  }
});

// === REST API: Messages ===

// Fetch chat history between two users (paginated)
// Query params: ?limit=50&before=<timestamp>
app.get("/api/messages/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before) : null;

    const filter = {
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 },
      ],
    };

    // If `before` is provided, only fetch messages older than that timestamp
    if (before) {
      filter.timestamp = { $lt: before };
    }

    // Fetch limit+1 to check if there are more messages beyond this page
    const messages = await Message.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const trimmed = hasMore ? messages.slice(0, limit) : messages;

    // Return in ascending order so client can render chronologically
    trimmed.reverse();

    res.json({ messages: trimmed, hasMore });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Fetch group chat history
app.get("/api/messages/group/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before) : null;

    const filter = { to: groupId, type: "group" };
    if (before) filter.timestamp = { $lt: before };

    const messages = await Message.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const trimmed = hasMore ? messages.slice(0, limit) : messages;
    trimmed.reverse();

    res.json({ messages: trimmed, hasMore });
  } catch (error) {
    res.status(500).json({ error: "Group history error" });
  }
});

// Fetch unread counts for a specific user
app.get("/api/messages/unread/:user", async (req, res) => {
  try {
    const { user } = req.params;
    // Aggregate to count unread messages grouped by sender
    const unreadCounts = await Message.aggregate([
      { $match: { to: user, seen: false } },
      { $group: { _id: "$from", count: { $sum: 1 } } },
    ]);
    
    // Format as { "SenderName": count }
    const formatted = {};
    unreadCounts.forEach((record) => {
      formatted[record._id] = record.count;
    });
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch unread counts" });
  }
});

// Edit a message
app.put("/api/messages/:id", async (req, res) => {
  try {
    const { message } = req.body;
    const msg = await Message.findByIdAndUpdate(req.params.id, { message }, { new: true });
    if (msg) {
      // Broadcast edit to both participants
      const editPayload = { messageId: req.params.id, message };
      const fromUser = onlineUsers[msg.from];
      const toUser = onlineUsers[msg.to];
      if (fromUser) io.to(fromUser.socketId).emit("message_edited", editPayload);
      if (toUser) io.to(toUser.socketId).emit("message_edited", editPayload);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to edit message" });
  }
});

// Soft-delete a message
app.put("/api/messages/:id/delete", async (req, res) => {
  try {
    const msg = await Message.findByIdAndUpdate(req.params.id, { message: "[deleted]" }, { new: true });
    if (msg) {
      // Broadcast delete to both participants
      const deletePayload = { messageId: req.params.id };
      const fromUser = onlineUsers[msg.from];
      const toUser = onlineUsers[msg.to];
      if (fromUser) io.to(fromUser.socketId).emit("message_deleted", deletePayload);
      if (toUser) io.to(toUser.socketId).emit("message_deleted", deletePayload);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// Toggle reaction
app.put("/api/messages/:id/react", async (req, res) => {
  try {
    const { emoji, username } = req.body;
    const msg = await Message.findById(req.params.id);
    if (!msg || msg.message === "[deleted]") return res.status(400).json({ error: "Invalid message" });

    // Initialize map if it doesn't exist
    if (!msg.reactions) msg.reactions = new Map();
    
    // Get array of users for this emoji
    const currentUsers = msg.reactions.get(emoji) || [];
    const alreadyReacted = currentUsers.includes(username);

    if (alreadyReacted) {
      msg.reactions.set(emoji, currentUsers.filter((u) => u !== username));
    } else {
      msg.reactions.set(emoji, [...currentUsers, username]);
    }

    await msg.save();

    // Convert Map to plain object for socket broadcast
    const reactionsObj = {};
    msg.reactions.forEach((val, key) => { reactionsObj[key] = val; });

    // Broadcast the reaction update to both users in the conversation
    const fromUser = onlineUsers[msg.from];
    const toUser = onlineUsers[msg.to];
    const reactionPayload = { messageId: req.params.id, reactions: reactionsObj };
    if (fromUser) io.to(fromUser.socketId).emit("reaction_update", reactionPayload);
    if (toUser) io.to(toUser.socketId).emit("reaction_update", reactionPayload);

    res.json({ success: true, reactions: reactionsObj });
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
});

// === Socket.IO ===
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

let onlineUsers = {}; // username -> { socketId, avatar, uid }

function getSocketByUid(uid) {
  const entry = Object.entries(onlineUsers).find(([name, data]) => data.uid === uid);
  return entry ? entry[1].socketId : null;
}

// === Socket.IO Events ===
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("set_username", async ({ username, avatar, uid }) => {
    onlineUsers[username] = { socketId: socket.id, avatar: avatar || "👤", uid };
    
    // Update DB status directly
    if (uid) {
      await User.findOneAndUpdate({ uid }, { isOnline: true });
    }

    // Optional: Include custom status in online users list directly if needed
    io.emit(
      "online_users",
      Object.entries(onlineUsers).map(([name, data]) => ({
        username: name,
        avatar: data.avatar,
      }))
    );
  });

  socket.on("join_group", (groupId) => {
    socket.join(groupId);
    console.log(`👤 User ${socket.id} joined group: ${groupId}`);
  });

  const handleSendMessage = async ({ to, from, message, timestamp, imageUrl, type = "private", repliedToId, senderName, senderAvatar }) => {
    try {
      const dbMessage = new Message({
        from,
        to,
        message: message || undefined,
        imageUrl: imageUrl || undefined,
        timestamp,
        type,
        repliedTo: repliedToId || undefined,
        senderName,
        senderAvatar
      });
      const savedMsg = await dbMessage.save();

      let populatedMsg = savedMsg.toObject();
      if (repliedToId) {
        populatedMsg = await Message.findById(savedMsg._id).populate("repliedTo").lean();
      }
      const newMessage = { ...populatedMsg, key: savedMsg._id.toString() };

      if (type === "group") {
        // Broadcast to everyone in the room
        io.to(to).emit("receive_message", newMessage);
      } else {
        // Individual logic
        const toUser = onlineUsers[to];
        if (toUser) io.to(toUser.socketId).emit("receive_message", newMessage);
      }

      // Delivery ack to sender
      const fromUser = onlineUsers[from];
      if (fromUser) {
        io.to(fromUser.socketId).emit("message_delivered", {
          tempKey: `temp_${timestamp}`,
          key: savedMsg._id.toString(),
          to,
          timestamp,
        });
      }
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  };

  socket.on("send_message", handleSendMessage);
  socket.on("private_message", handleSendMessage); // fallback for older clients

  socket.on("typing", ({ to, from, isTyping, isGroup = false }) => {
    if (isGroup) {
      socket.to(to).emit("typing", { from, isTyping, isGroup: true });
    } else {
      const toUser = onlineUsers[to];
      if (toUser) io.to(toUser.socketId).emit("typing", { from, isTyping });
    }
  });

  // === Read Receipt ===
  socket.on("message_seen", async ({ from, to }) => {
    try {
      // Mark all unread messages from 'from' to 'to' as seen in MongoDB
      await Message.updateMany(
        { from: from, to: to, seen: false },
        { $set: { seen: true } }
      );

      const toUser = onlineUsers[to];
      if (toUser) {
        // Notify the original sender that their messages were seen
        io.to(toUser.socketId).emit("messages_seen_ack", { seenFrom: from });
      }
    } catch (err) {
      console.error("Failed to update seen status:", err);
    }
  });

  socket.on("disconnect", async () => {
    const username = Object.keys(onlineUsers).find(
      (key) => onlineUsers[key].socketId === socket.id
    );
    if (username) {
      const userData = onlineUsers[username];
      const uid = userData.uid;
      
      delete onlineUsers[username];
      
      // Mark offline in DB and set lastSeen
      if (uid) {
        await User.findOneAndUpdate({ uid }, { isOnline: false, lastSeen: Date.now() });
      }

      io.emit(
        "online_users",
        Object.entries(onlineUsers).map(([name, data]) => ({
          username: name,
          avatar: data.avatar,
        }))
      );
    }
    console.log("🔴 User disconnected:", socket.id);
  });
});

// === Health Check ===
app.get("/", (req, res) => {
  res.send("✅ Server is running");
});

// === Start Server ===
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
