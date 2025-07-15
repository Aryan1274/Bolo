import React, { useRef, useEffect, useState } from "react";
import ChatMessage from "./ChatMessage";
import EmojiPicker from "./EmojiPicker";
// ChatArea.jsx
import socket from "../socket"; // ✅ Correct for default export


export default function ChatArea({
  chat,
  selectedUser,
  username,
  editingMessageId,
  editingMessageText,
  setEditingMessageText,
  startEditing,
  cancelEditing,
  saveEditedMessage,
  deleteMessage,
  toggleReaction,
  message,
  setMessage,
  sendMessage,
  typingUsers,
  showEmojiPicker,
  setShowEmojiPicker,
  addEmojiToMessage,
  messageInputRef,
  emojiPickerRef,
}) {
  const messagesEndRef = useRef(null);
  const [lastMessageId, setLastMessageId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    if (chat.length > 0) {
      const latestMsg = chat[chat.length - 1];
      const isNewMessage = latestMsg.key !== lastMessageId;

      if (
        isNewMessage &&
        latestMsg.from !== username &&
        document.visibilityState !== "visible"
      ) {
        showBrowserNotification(latestMsg.from, latestMsg.message);
        setLastMessageId(latestMsg.key);
      } else if (isNewMessage) {
        setLastMessageId(latestMsg.key);
      }
    }
  }, [chat, typingUsers]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const showBrowserNotification = (sender, text) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`New message from ${sender}`, {
        body: text,
        icon: "/chat-icon.png",
      });
    }
  };

  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach((msg) => {
      const date = new Date(msg.timestamp);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let label;
      if (date.toDateString() === today.toDateString()) {
        label = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = "Yesterday";
      } else {
        label = date.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(msg);
    });
    return groups;
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };

  const handleSendFile = async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.imageUrl;

        socket.emit("private_message", {
          to: selectedUser,
          from: username,
          message: message || "", // include caption if any
          timestamp: Date.now(),
          imageUrl,
        });

        setSelectedFile(null);
        setMessage("");
      } else {
        console.error("File upload failed:", response.statusText);
      }
    } catch (error) {
      console.error("File upload error:", error);
    }
  };

  return (
    <div
      className="chat-area"
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        maxWidth: "900px",
        backgroundColor: "#ffffff",
        borderRadius: "0.75rem",
        boxShadow: "0 4px 8px rgba(0,0,0,0.05)",
        padding: "1.5rem",
        fontFamily: "'Inter', sans-serif",
        color: "#6b7280",
      }}
    >
      <h3
        style={{
          fontWeight: "700",
          fontSize: "2rem",
          marginBottom: "1rem",
          color: "#111827",
        }}
      >
        Chat with {selectedUser || "..."}
      </h3>

      <div
        className="chat-messages"
        style={{
          flexGrow: 1,
          overflowY: "auto",
          paddingRight: "1rem",
          marginBottom: "1rem",
          maxHeight: "500px",
        }}
      >
        {selectedUser ? (
          <>
            {Object.entries(groupMessagesByDate(chat)).map(([label, messages]) => (
              <div key={label} style={{ marginBottom: "1.5rem" }}>
                <div
                  className="date-label"
                  style={{
                    marginBottom: "0.75rem",
                    fontWeight: "600",
                    color: "#4b5563",
                  }}
                >
                  {label}
                </div>
                {messages.map((msg) => {
                  const isYou = msg.from === username;
                  return (
                    <ChatMessage
                      key={msg.key}
                      msg={msg}
                      isYou={isYou}
                      editingMessageId={editingMessageId}
                      editingMessageText={editingMessageText}
                      setEditingMessageText={setEditingMessageText}
                      startEditing={startEditing}
                      cancelEditing={cancelEditing}
                      saveEditedMessage={saveEditedMessage}
                      deleteMessage={deleteMessage}
                      toggleReaction={toggleReaction}
                      username={username}
                    />
                  );
                })}
              </div>
            ))}
            {selectedUser && typingUsers[selectedUser] && (
              <div
                className="typing-indicator"
                style={{
                  fontStyle: "italic",
                  color: "#9ca3af",
                  paddingTop: "0.5rem",
                }}
              >
                {selectedUser} is typing...
              </div>
            )}
          </>
        ) : (
          <p style={{ fontStyle: "italic", color: "#888" }}>
            Select a user to start chatting
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="chat-input-container"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <input
          ref={messageInputRef}
          value={message}
          onChange={handleTyping}
          placeholder="Type a message"
          disabled={!selectedUser || editingMessageId !== null}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !selectedFile) sendMessage();
          }}
          style={{
            flexGrow: 1,
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            border: "1px solid #d1d5db",
            fontSize: "1rem",
            fontFamily: "'Inter', sans-serif",
            outline: "none",
          }}
        />

        <button
          id="emoji-toggle-btn"
          type="button"
          className="emoji-toggle-btn"
          onClick={() => setShowEmojiPicker((v) => !v)}
          title="Toggle emoji picker"
          style={{
            border: "none",
            background: "transparent",
            fontSize: "1.5rem",
            cursor: "pointer",
            transition: "transform 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          😊
        </button>

        <label
          htmlFor="file-upload"
          className="file-upload-button"
          style={{
            cursor: "pointer",
            fontSize: "1.5rem",
            background: "transparent",
            border: "none",
            userSelect: "none",
          }}
          title="Upload file"
        >
          <input
            id="file-upload"
            type="file"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
          📁
        </label>

        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            style={{
              position: "absolute",
              bottom: "60px",
              right: "0",
              zIndex: 1000,
              boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
              borderRadius: "0.75rem",
              background: "#fff",
            }}
          >
            <EmojiPicker onSelectEmoji={addEmojiToMessage} />
          </div>
        )}

        {!selectedFile && (
          <button
            onClick={sendMessage}
            disabled={
              message.trim() === "" ||
              !selectedUser ||
              editingMessageId !== null
            }
            style={{
              backgroundColor:
                message.trim() === "" ||
                !selectedUser ||
                editingMessageId !== null
                  ? "#9ca3af"
                  : "#111827",
              color: "#fff",
              borderRadius: "0.75rem",
              padding: "0.75rem 1.5rem",
              border: "none",
              cursor:
                message.trim() === "" ||
                !selectedUser ||
                editingMessageId !== null
                  ? "not-allowed"
                  : "pointer",
              fontWeight: "600",
              fontSize: "1rem",
              transition: "background-color 0.3s ease",
            }}
            aria-label="Send message"
          >
            Send
          </button>
        )}

        {selectedFile && (
          <button
            onClick={handleSendFile}
            style={{
              backgroundColor: "#2563eb",
              color: "#fff",
              borderRadius: "0.75rem",
              padding: "0.75rem 1.5rem",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "1rem",
              boxShadow: "0 4px 8px rgba(37, 99, 235, 0.4)",
              transition: "background-color 0.3s ease",
            }}
            aria-label="Send file"
          >
            Send File
          </button>
        )}
      </div>
    </div>
  );
}
