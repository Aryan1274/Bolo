import { useEffect, useState, useRef } from "react";
// import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, push, update } from "firebase/database";
// import db from "./firebase";
import { db, auth } from "./firebase"; // ✅ Named import
import io from "socket.io-client";

import LoginPage from "./components/LoginPage";
import OnlineUsers from "./components/OnlineUsers";
import ChatArea from "./components/ChatArea";

import "./App.css";

const socket = io("http://localhost:5000");

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});

  const messageInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // 🔁 Watch Firebase Auth
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    setAuthUser(user);
    if (user) {
      socket.emit("set_username", { username: user.displayName });
    }
  });
  return () => unsubscribe();
}, []);


  useEffect(() => {
    socket.on("online_users", (users) => {
      setOnlineUsers(users);
    });

    socket.on("typing", ({ from, isTyping }) => {
      setTypingUsers((prev) => ({ ...prev, [from]: isTyping }));
    });

    socket.on("messages_seen_ack", ({ seenFrom }) => {
      setChat((prev) =>
        prev.map((msg) =>
          msg.from === authUser?.displayName && msg.to === seenFrom
            ? { ...msg, seen: true }
            : msg
        )
      );

      chat.forEach((msg) => {
        if (msg.from === authUser?.displayName && msg.to === seenFrom && !msg.seen) {
          const msgRef = ref(db, `messages/${msg.key}`);
          update(msgRef, { seen: true });
        }
      });
    });

    const messagesRef = ref(db, "messages");
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      const counts = {};
      if (data && authUser?.displayName) {
        Object.values(data).forEach((msg) => {
          if (msg.to === authUser.displayName && !msg.seen) {
            counts[msg.from] = (counts[msg.from] || 0) + 1;
          }
        });
      }
      setUnreadCounts(counts);
    });

    return () => {
      socket.off("online_users");
      socket.off("typing");
      socket.off("messages_seen_ack");
    };
  }, [chat, authUser]);

  function sendMessage() {
    if (!message.trim() || !selectedUser) return;

    const timestamp = Date.now();
    const newMessage = {
      from: authUser.displayName,
      to: selectedUser,
      message,
      timestamp,
      delivered: true,
      seen: false
    };

    push(ref(db, "messages"), newMessage);
    setMessage("");
  }

  function handleUserSelect(user) {
    setSelectedUser(user);
    const messagesRef = ref(db, "messages");

    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const filtered = Object.entries(data)
          .filter(([_, msg]) =>
            (msg.from === authUser.displayName && msg.to === user) ||
            (msg.from === user && msg.to === authUser.displayName)
          )
          .map(([key, msg]) => ({ key, ...msg }));

        setChat(filtered);

        filtered.forEach((msg) => {
          if (msg.from === user && msg.to === authUser.displayName && !msg.seen) {
            update(ref(db, `messages/${msg.key}`), { seen: true });
          }
        });

        socket.emit("message_seen", { from: user, to: authUser.displayName });
      } else {
        setChat([]);
      }
    });
  }

  function startEditing(msg) {
    setEditingMessageId(msg.key);
    setEditingMessageText(msg.message);
  }

  function cancelEditing() {
    setEditingMessageId(null);
    setEditingMessageText("");
  }

  function saveEditedMessage() {
    if (!editingMessageText.trim() || !editingMessageId) return;
    const msgRef = ref(db, `messages/${editingMessageId}`);
    update(msgRef, { message: editingMessageText });
    cancelEditing();
  }

  function deleteMessage(msg) {
    const msgRef = ref(db, `messages/${msg.key}`);
    update(msgRef, { message: "[deleted]" });
  }

  function toggleReaction(msg, emoji) {
    const msgRef = ref(db, `messages/${msg.key}`);
    const currentReactions = msg.reactions || {};
    const users = currentReactions[emoji] || [];

    const alreadyReacted = users.includes(authUser.displayName);
    const updatedUsers = alreadyReacted
      ? users.filter((u) => u !== authUser.displayName)
      : [...users, authUser.displayName];

    const updatedReactions = {
      ...currentReactions,
      [emoji]: updatedUsers
    };

    update(msgRef, { reactions: updatedReactions });
  }

  function addEmojiToMessage(emoji) {
    setMessage((prev) => prev + emoji);
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target) &&
        event.target !== messageInputRef.current &&
        event.target.getAttribute("id") !== "emoji-toggle-btn"
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="app">
      {!authUser ? (
        authMode === "signup" ? (
          <SignupPage onSignupSuccess={() => setAuthMode("login")} />
        ) : (
          <LoginPage onLoginSuccess={(user) => setAuthUser(user)} />

        )
      ) : (
        <div className="flex">
          <OnlineUsers
            onlineUsers={onlineUsers}
            currentUsername={authUser.displayName}
            selectedUser={selectedUser}
            onSelectUser={handleUserSelect}
            unreadCounts={unreadCounts}
          />
          <ChatArea
            chat={chat}
            selectedUser={selectedUser}
            username={authUser.displayName}
            editingMessageId={editingMessageId}
            editingMessageText={editingMessageText}
            setEditingMessageText={setEditingMessageText}
            startEditing={startEditing}
            cancelEditing={cancelEditing}
            saveEditedMessage={saveEditedMessage}
            deleteMessage={deleteMessage}
            toggleReaction={toggleReaction}
            message={message}
            setMessage={setMessage}
            sendMessage={sendMessage}
            typingUsers={typingUsers}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            addEmojiToMessage={addEmojiToMessage}
            messageInputRef={messageInputRef}
            emojiPickerRef={emojiPickerRef}
          />
        </div>
      )}
      
    </div>
  );
}

export default App;
