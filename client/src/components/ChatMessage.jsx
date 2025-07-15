import React from "react";

const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '👏'];

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
}) {
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div key={msg.key} className={`chat-message ${isYou ? "you" : ""}`}>
      {!isYou && <span className="avatar-icon">{msg.avatar}</span>}
      <strong>{isYou ? "You" : msg.from}:</strong>{" "}
      {editingMessageId === msg.key ? (
        <>
          <input
            type="text"
            value={editingMessageText}
            onChange={(e) => setEditingMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEditedMessage();
              if (e.key === "Escape") cancelEditing();
            }}
            autoFocus
          />
          <button onClick={saveEditedMessage} disabled={editingMessageText.trim() === ""}>Save</button>
          <button onClick={cancelEditing}>Cancel</button>
        </>
      ) : (
        <>
          {msg.message}

          {/* ✅ Image Rendering Support */}
          {msg.imageUrl && (
            <div>
              <img
                src={msg.imageUrl}
                alt="uploaded"
                style={{
                  maxWidth: '200px',
                  borderRadius: '0.5rem',
                  marginTop: '0.5rem',
                }}
              />
            </div>
          )}

          {isYou && (
            <>
              <button className="edit-btn" onClick={() => startEditing(msg)} title="Edit message">✏️</button>
              <button
                className="delete-btn"
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this message?")) {
                    deleteMessage(msg);
                  }
                }}
                title="Delete message"
              >
                🗑️
              </button>
            </>
          )}
        </>
      )}

      <span className="timestamp">{time}</span>

      {isYou && !editingMessageId && (
        <span
          className={`delivery-status ${msg.seen ? "seen" : "sent"}`}
          title={msg.seen ? "Seen" : "Sent"}
        >
          {msg.seen ? "✓✓" : "✓"}
        </span>
      )}

      {/* Emoji Reactions */}
      <div className="emoji-reactions">
        {reactionEmojis.map((emoji) => {
          const usersReacted = msg.reactions?.[emoji] || [];
          const reactedByMe = usersReacted.includes(username);
          return (
            <button
              key={emoji}
              className={`emoji-btn ${reactedByMe ? "reacted" : ""}`}
              onClick={() => toggleReaction(msg, emoji)}
              title={`${usersReacted.length} reaction${usersReacted.length !== 1 ? "s" : ""}`}
              type="button"
            >
              {emoji} {usersReacted.length > 0 ? usersReacted.length : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
