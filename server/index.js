// === Core dependencies ===
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config();

// === Firebase setup ===
const { ref, push } = require("firebase/database");
const db = require("./firebase"); // Your firebase.js file

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

// === Initialize Express + HTTP server
const app = express();
const server = http.createServer(app);

// === Middleware
app.use(cors());
app.use(express.json());

// === Multer: memory storage for Cloudinary streaming
const upload = multer({ storage: multer.memoryStorage() });

// === File Upload Endpoint ===
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const streamUpload = () =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "chat_images",
          resource_type: "raw", // <-- this is important for non-images
         },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

  streamUpload()
    .then((result) => res.json({ imageUrl: result.secure_url, fileName: result.original_filename  }))
    .catch((err) => {
      console.error("Upload error:", err);
      res.status(500).json({ error: "file upload failed" });
    });
});

// === MongoDB (optional)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// === Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"], // Update if frontend runs elsewhere
    methods: ["GET", "POST"],
  },
});

let onlineUsers = {}; // username -> { socketId, avatar }

// === Socket.IO Events
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("set_username", ({ username, avatar }) => {
    onlineUsers[username] = { socketId: socket.id, avatar };
    io.emit(
      "online_users",
      Object.entries(onlineUsers).map(([name, data]) => ({
        username: name,
        avatar: data.avatar,
      }))
    );
  });

  socket.on("private_message", ({ to, from, message, timestamp, imageUrl }) => {
    const newMessage = {
      from,
      to,
      timestamp,
    };

    if (imageUrl) {
      newMessage.imageUrl = imageUrl;
    } else {
      newMessage.message = message;
    }

    // Save to Firebase
    push(ref(db, "messages/"), newMessage);

    // Emit to recipient
    const toUser = onlineUsers[to];
    if (toUser) {
      io.to(toUser.socketId).emit("receive_message", newMessage);
    }

    // Emit back to sender for acknowledgment
    const fromUser = onlineUsers[from];
    if (fromUser) {
      io.to(fromUser.socketId).emit("message_delivered", { to, timestamp });
    }
  });

  socket.on("typing", ({ to, from, isTyping }) => {
    const toUser = onlineUsers[to];
    if (toUser) {
      io.to(toUser.socketId).emit("typing", { from, isTyping });
    }
  });

  socket.on("message_read", ({ from, to }) => {
    const toUser = onlineUsers[to];
    if (toUser) {
      io.to(toUser.socketId).emit("message_read", { from });
    }
  });

  socket.on("disconnect", () => {
    const username = Object.keys(onlineUsers).find(
      (key) => onlineUsers[key].socketId === socket.id
    );
    if (username) {
      delete onlineUsers[username];
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

// === Health Check Endpoint
app.get("/", (req, res) => {
  res.send("✅ Server is running");
});

// === Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
