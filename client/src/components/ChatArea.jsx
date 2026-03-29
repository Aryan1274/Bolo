import { useState, useEffect, useRef, useCallback } from "react";
import ChatMessage from "./ChatMessage";
import EmojiPicker from "./EmojiPicker";
import VoiceRecorder from "./VoiceRecorder";
import GiphyPicker from "./GiphyPicker";
import MediaGallery from "./MediaGallery";
import socket from "../socket";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ChatArea({
  chat,
  selectedUser,
  selectedUserDetails,
  selectedGroup,
  isFriend,
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
  hasMore,
  isLoadingMore,
  loadOlderMessages,
  onCall,
  onBack,
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [lastMessageId, setLastMessageId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [showGiphy, setShowGiphy] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const prevScrollHeightRef = useRef(0);

  // Auto-scroll to latest message (only on new messages, not when loading older)
  useEffect(() => {
    if (chat.length > 0) {
      const latestMsg = chat[chat.length - 1];
      const isNewMessage = latestMsg.key !== lastMessageId;

      if (isNewMessage) {
        // Only auto-scroll if we're near the bottom or it's a new message from us
        const container = messagesContainerRef.current;
        if (container) {
          const isNearBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight < 150;
          if (isNearBottom || latestMsg.from === username) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }
        }

        if (latestMsg.from !== username && document.visibilityState !== "visible") {
          showBrowserNotification(latestMsg.from, latestMsg.message);
        }
        setLastMessageId(latestMsg.key);
      }
    }
  }, [chat]);

  // On initial load, scroll to bottom
  useEffect(() => {
    if (selectedUser) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    }
  }, [selectedUser]);

  // Preserve scroll position after loading older messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container && prevScrollHeightRef.current > 0) {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [chat.length]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Emit typing indicator
  useEffect(() => {
    if (!selectedUser && !selectedGroup) return;
    const to = selectedGroup ? selectedGroup._id : selectedUser;
    const isGroup = !!selectedGroup;
    const isTyping = message.trim().length > 0;
    socket.emit("typing", { to, from: username, isTyping, isGroup });
  }, [message, selectedUser, selectedGroup, username]);

  // Infinite scroll: load older messages when scrolling to top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || isLoadingMore) return;

    if (container.scrollTop < 80) {
      prevScrollHeightRef.current = container.scrollHeight;
      loadOlderMessages();
    }
  }, [hasMore, isLoadingMore, loadOlderMessages]);

  const showBrowserNotification = (sender, text, isGroup) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const title = isGroup ? `New message in group` : `New message from ${sender}`;
      const body = text || "📎 File attachment";
      const icon = "/vite.svg"; // Fallback to app icon
      
      const notification = new Notification(title, {
        body: `${isGroup ? sender + ": " : ""}${body}`,
        icon,
        tag: sender, // Combines multiple messages from same sender
        renotify: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
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
        label = date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(msg);
    });
    return groups;
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadError("");

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleCancelFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setUploadError("");
  };

  const handleSendFile = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        sendMessage(data.imageUrl);
        setSelectedFile(null);
        setFilePreview(null);
        setMessage("");
      } else {
        const err = await response.json();
        setUploadError(err.error || "Upload failed.");
      }
    } catch (error) {
      setUploadError("Network error. Could not upload file.");
      console.error("File upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleVoiceUpload = async (audioBlob) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", audioBlob, "voice_note.webm");

    try {
      const resp = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (data.imageUrl) {
        sendMessage(data.imageUrl); // using same field as images/videos (auto-detect)
      }
    } catch (err) {
      toast.error("Failed to send voice note.");
    } finally {
      setIsUploading(false);
    }
  };
  const handleReply = (msg) => {
    setReplyingTo(msg);
    messageInputRef.current?.focus();
  };

  const handleSend = () => {
    if (selectedFile) return handleSendFile();
    sendMessage(null, replyingTo?._id);
    setReplyingTo(null);
  };

  const handleGifSelect = (gifUrl) => {
    sendMessage(gifUrl, replyingTo?._id);
    setReplyingTo(null);
    setShowGiphy(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const type = selectedGroup ? "group" : "private";
      const to = selectedGroup ? selectedGroup._id : selectedUser;
      const res = await fetch(`${API_URL}/api/messages/search?from=${username}&to=${to}&type=${type}&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data || []);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const closeSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
    setSearchResults([]);
  };
  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        <div className="header-info">
          {(selectedUser || selectedGroup) && (
            <button className="mobile-back-btn" onClick={onBack} title="Back to chats">←</button>
          )}
          <h3>{selectedGroup ? `Group: ${selectedGroup.name}` : selectedUser ? `Chat with ${selectedUser}` : "Bolo Chat"}</h3>
          {selectedUserDetails && (
            <div className="online-status">
              {selectedUserDetails.isOnline ? (
                <>
                  <span className={`dot ${
                    selectedUserDetails.customStatus === "Away" ? "away" : 
                    selectedUserDetails.customStatus === "Do Not Disturb" ? "busy" : "online"
                  }`}>●</span>{" "}
                  {selectedUserDetails.customStatus || "Online"}
                </>
              ) : (
                <>
                  <span className="dot offline">●</span> Last seen:{" "}
                  {selectedUserDetails.lastSeen
                    ? new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                      }).format(new Date(selectedUserDetails.lastSeen))
                    : "recently"}
                </>
              )}
            </div>
          )}
        </div>

        <div className="header-actions">
          {!selectedGroup && selectedUserDetails?.uid && (
            <button className="icon-btn" onClick={() => onCall(selectedUserDetails.uid)} title="Video Call">📞</button>
          )}
          <button className="icon-btn" onClick={() => setIsSearching(true)} title="Search Messages">🔍</button>
          <button className="icon-btn" onClick={() => setShowGallery(!showGallery)} title="Media Gallery">📁</button>
        </div>

        {isSearching && (
          <div className="search-overlay">
            <div className="search-bar-inner">
              <form onSubmit={handleSearch}>
                <input 
                  type="text" 
                  placeholder="Search conversation..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </form>
              <button className="close-search" onClick={closeSearch}>✕</button>
            </div>
            {searchResults.length > 0 && (
              <div className="search-results-popup">
                {searchResults.map(msg => (
                  <div key={msg._id} className="search-result-item" onClick={() => {
                    // Logic to scroll to message could go here
                    closeSearch();
                  }}>
                    <span className="result-sender">{msg.from}:</span>
                    <span className="result-text">{msg.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        className="chat-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {selectedUser ? (
          <>
            {/* Loading indicator for older messages */}
            {isLoadingMore && (
              <div className="loading-more">
                <div className="loading-spinner" />
                <span>Loading older messages…</span>
              </div>
            )}
            {hasMore && !isLoadingMore && (
              <div className="load-more-hint">
                <span>↑ Scroll up for older messages</span>
              </div>
            )}

            {chat.length === 0 ? (
              <div className="empty-chat">
                <span>👋</span>
                <p>No messages yet. Say hi to <strong>{selectedUser}</strong>!</p>
              </div>
            ) : (
              Object.entries(groupMessagesByDate(chat)).map(([label, messages]) => (
                <div key={label}>
                  <div className="date-label">{label}</div>
                  {messages.map((msg) => (
                    <ChatMessage
                      key={msg.key}
                      msg={msg}
                      isYou={msg.from === username}
                      editingMessageId={editingMessageId}
                      editingMessageText={editingMessageText}
                      setEditingMessageText={setEditingMessageText}
                      startEditing={startEditing}
                      cancelEditing={cancelEditing}
                      saveEditedMessage={saveEditedMessage}
                      deleteMessage={deleteMessage}
                      toggleReaction={toggleReaction}
                      username={username}
                      onReply={handleReply}
                    />
                  ))}
                </div>
              ))
            )}
            {selectedGroup ? (
              Object.keys(typingUsers)
                .filter(k => k.startsWith(`${selectedGroup._id}_`) && typingUsers[k])
                .map(k => <div key={k} className="typing-indicator">{k.split("_")[1]} is typing…</div>)
            ) : (
              typingUsers[selectedUser] && (
                <div className="typing-indicator">{selectedUser} is typing…</div>
              )
            )}
          </>
        ) : (
          <div className="empty-chat">
            <span>💬</span>
            <p>Select a user from the sidebar to start chatting.</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!isFriend && selectedUser && (
        <div className="not-friends-msg">
          <p>⚠️ You are not friends with <strong>{selectedUser}</strong> yet.</p>
          <small>Add them from the sidebar to start chatting!</small>
        </div>
      )}

      {/* Media Gallery Sidebar */}
      {showGallery && (
        <MediaGallery 
          from={username}
          to={selectedGroup ? selectedGroup._id : selectedUser}
          type={selectedGroup ? "group" : "private"}
          onClose={() => setShowGallery(false)}
        />
      )}

      {/* File Preview */}
      {selectedFile && (
        <div className="file-preview-bar">
          {filePreview ? (
            <img src={filePreview} alt="preview" className="file-preview-img" />
          ) : (
            <span className="file-preview-name">📎 {selectedFile.name}</span>
          )}
          <span className="file-preview-size">
            ({(selectedFile.size / 1024).toFixed(1)} KB)
          </span>
          <button className="cancel-file-btn" onClick={handleCancelFile} title="Cancel">✕</button>
        </div>
      )}
      {uploadError && <p className="upload-error">{uploadError}</p>}

      {/* Input Bar */}
      {isFriend && (
        <div className="chat-input-wrapper">
          {replyingTo && (
            <div className="reply-bar">
              <div className="reply-content">
                <span className="reply-to-user">Replying to {replyingTo.senderName || replyingTo.from}</span>
                <p className="reply-msg-text">{replyingTo.message || "Image"}</p>
              </div>
              <button className="cancel-reply" onClick={() => setReplyingTo(null)}>✕</button>
            </div>
          )}
          <div className="chat-input-container">
        <input
          ref={messageInputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={selectedFile ? "Add a caption (optional)…" : "Type a message…"}
          disabled={!selectedUser || editingMessageId !== null}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !selectedFile) sendMessage();
          }}
          className="chat-input"
        />

        {/* Emoji toggle */}
        <button
          id="emoji-toggle-btn"
          type="button"
          className="icon-btn"
          onClick={() => setShowEmojiPicker((v) => !v)}
          title="Emoji"
        >
          😊
        </button>

        {/* File attach */}
        <label htmlFor="file-upload" className="icon-btn" title="Attach file">
          <input
            id="file-upload"
            type="file"
            style={{ display: "none" }}
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.txt"
          />
          📎
        </label>

        {/* Voice recorder */}
        <VoiceRecorder onRecordingComplete={handleVoiceUpload} />

        {/* Giphy button */}
        <button
          className="icon-btn"
          onClick={() => setShowGiphy((v) => !v)}
          title="Send GIF"
        >
          🖼️
        </button>

        {/* Emoji picker popup */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="emoji-picker-popup">
            <EmojiPicker onSelectEmoji={addEmojiToMessage} />
          </div>
        )}

        {/* Giphy picker popup */}
        {showGiphy && (
          <GiphyPicker
            onSelectGif={handleGifSelect}
            onClose={() => setShowGiphy(false)}
          />
        )}

        {/* Send / Upload button */}
        {selectedFile ? (
          <button
            onClick={handleSendFile}
            disabled={isUploading || !selectedUser}
            className="send-btn send-file-btn"
          >
            {isUploading ? "Uploading…" : "Send File"}
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!message.trim() || !selectedUser || editingMessageId !== null}
            className="send-btn"
          >
            Send
          </button>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
