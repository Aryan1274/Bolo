import React from "react";

const EMOJI_PICKER = [
  "😀", "😂", "😅", "😊", "😍", "😎", "😢", "😡", "👍", "🙏",
  "🎉", "💔", "🔥", "❤️", "🤔", "😴", "🤩", "😱", "👏", "🙌",
];

export default function EmojiPicker({ onSelectEmoji }) {
  return (
    <div
      className="emoji-picker"
      style={{
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "10px",
        maxWidth: "280px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: "8px",
        userSelect: "none",
      }}
    >
      {EMOJI_PICKER.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelectEmoji(emoji)}
          className="emoji-picker-btn"
          type="button"
          style={{
            fontSize: "1.5rem",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: "5px",
          }}
          aria-label={`Add ${emoji} emoji`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
