import React, { useState } from "react";

const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "👏"];

// Normalize reactions from MongoDB Map (serialized as object or Map) to a plain JS object
function normalizeReactions(reactions) {
  if (!reactions) return {};
  // If it's already a plain object, return it
  if (typeof reactions === "object" && !Array.isArray(reactions)) {
    // Handle case where MongoDB Map serializes with _type / entries
    if (reactions._type === "Map" && Array.isArray(reactions.entries)) {
      const obj = {};
      reactions.entries.forEach(([key, val]) => { obj[key] = val; });
      return obj;
    }
    return reactions;
  }
  return {};
}

export default function ChatMessage({
  msg,
  isYou,
  editingMessageId,
  editingMessageText,
  setEditingMessageText,
  startEditing,
  cancelEditing,
  saveEditedMessage,
  deleteMessage,
  toggleReaction,
  username,
  onReply,
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isDeleted = msg.message === "[deleted]";
  const reactions = normalizeReactions(msg.reactions);

  // Check if this message has any active reactions (with at least 1 user)
  const hasActiveReactions = Object.values(reactions).some(
    (users) => Array.isArray(users) && users.length > 0
  );

  return (
    <div className={`chat-message ${isYou ? "you" : ""} ${hasActiveReactions ? "has-reactions" : ""}`}>
      {/* Sender Avatar & Name (only for received group/private messages) */}
      {!isYou && (
        <div className="message-sender-info">
          <div className="sender-avatar">
            {msg.senderAvatar ? <img src={msg.senderAvatar} alt="" /> : <span>{(msg.senderName || msg.from)[0]?.toUpperCase()}</span>}
          </div>
          <span className="message-sender">{msg.senderName || msg.from}</span>
        </div>
      )}

      <div className="message-bubble">
        {editingMessageId === msg.key ? (
          /* Edit Mode */
          <>
            <input
              type="text"
              className="edit-input"
              value={editingMessageText}
              onChange={(e) => setEditingMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEditedMessage();
                if (e.key === "Escape") cancelEditing();
              }}
              autoFocus
            />
            <div className="edit-actions">
              <button
                className="save-btn"
                onClick={saveEditedMessage}
                disabled={!editingMessageText.trim()}
              >
                Save
              </button>
              <button className="cancel-btn" onClick={cancelEditing}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          /* View Mode */
          <>
            {/* Replies / Quotes */}
            {msg.repliedTo && (
              <div className="reply-preview">
                <span className="reply-preview-sender">{msg.repliedTo.senderName || msg.repliedTo.from}</span>
                <p className="reply-preview-text">{msg.repliedTo.message || (msg.repliedTo.imageUrl ? "📷 Image" : "Message")}</p>
              </div>
            )}

            {isDeleted ? (
              <span style={{ fontStyle: "italic", opacity: 0.5 }}>🚫 Message deleted</span>
            ) : (
              <>
                {msg.message && <span>{msg.message}</span>}
                {msg.imageUrl && (
                  msg.imageUrl.match(/\.(mp4|webm|ogg)$/i) || msg.imageUrl.includes("/video/") ? (
                    // Check if it's likely an audio file (Cloudinary also uses /video/ for audio)
                    msg.imageUrl.match(/\.(webm|mp3|wav|m4a|ogg)$/i) || msg.imageUrl.includes("voice_note") ? (
                      <audio src={msg.imageUrl} controls className="message-audio" />
                    ) : (
                      <video
                        src={msg.imageUrl}
                        controls
                        className="message-video"
                        style={{ maxWidth: "100%", borderRadius: "0.75rem", marginTop: msg.message ? "0.5rem" : 0 }}
                      />
                    )
                  ) : (
                    <img
                      src={msg.imageUrl}
                      alt="uploaded"
                      className="message-image"
                      onClick={() => window.open(msg.imageUrl, "_blank")}
                    />
                  )
                )}
              </>
            )}

            {/* Edit / Delete (only for sender, only if not deleted) */}
            {isYou && !isDeleted && (
              <div className="message-actions">
                <button
                  className="edit-btn"
                  onClick={() => startEditing(msg)}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  className="delete-btn"
                  onClick={() => {
                    if (window.confirm("Delete this message?")) deleteMessage(msg);
                  }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            )}
            
            {/* Reply Icon (global, only if not deleted) */}
            {!isDeleted && (
              <button
                className="reply-action-btn"
                onClick={() => onReply(msg)}
                title="Reply"
              >
                ↩️
              </button>
            )}
          </>
        )}
      </div>

      {/* Timestamp + delivery status */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span className="timestamp">{time}</span>
        {isYou && !editingMessageId && (
          <span className={`delivery-status ${msg.seen ? "seen" : ""}`}>
            {msg.seen ? "✓✓" : "✓"}
          </span>
        )}
      </div>

      {/* Existing reactions display (always visible when present) */}
      {!isDeleted && hasActiveReactions && (
        <div className="emoji-reactions visible">
          {reactionEmojis.map((emoji) => {
            const usersReacted = reactions[emoji] || [];
            if (usersReacted.length === 0) return null;
            const reactedByMe = usersReacted.includes(username);
            return (
              <button
                key={emoji}
                className={`emoji-btn ${reactedByMe ? "reacted" : ""}`}
                onClick={() => toggleReaction(msg, emoji)}
                title={`${usersReacted.join(", ")} reacted`}
                type="button"
              >
                {emoji}
                <span style={{ fontSize: "0.7rem", marginLeft: "2px" }}>
                  {usersReacted.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Reaction picker toggle (show on hover via CSS) */}
      {!isDeleted && (
        <div className="reaction-picker-toggle">
          <button
            className="add-reaction-btn"
            onClick={() => setShowReactionPicker((v) => !v)}
            title="Add reaction"
            type="button"
          >
            😊+
          </button>
          {showReactionPicker && (
            <div className="reaction-picker-popup">
              {reactionEmojis.map((emoji) => {
                const usersReacted = reactions[emoji] || [];
                const reactedByMe = usersReacted.includes(username);
                return (
                  <button
                    key={emoji}
                    className={`emoji-btn ${reactedByMe ? "reacted" : ""}`}
                    onClick={() => {
                      toggleReaction(msg, emoji);
                      setShowReactionPicker(false);
                    }}
                    type="button"
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
