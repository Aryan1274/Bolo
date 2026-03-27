import React, { useState } from "react";

const EMOJI_CATEGORIES = {
  "Smileys": ["😀", "😂", "😅", "😊", "😍", "😎", "🥳", "😜", "🤗", "😇", "🤩", "😏", "😌", "🥺", "😢", "😡", "😱", "🤔", "😴", "🙄"],
  "Gestures": ["👍", "👎", "👏", "🙏", "🤝", "✌️", "🤞", "💪", "👋", "🫡"],
  "Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "💖", "💝"],
  "Objects": ["🎉", "🔥", "⭐", "💯", "✅", "❌", "💡", "📌", "🎯", "🏆"],
};

export default function EmojiPicker({ onSelectEmoji }) {
  const [activeCategory, setActiveCategory] = useState("Smileys");

  return (
    <div className="emoji-picker">
      {/* Category tabs */}
      <div className="emoji-category-tabs">
        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
          <button
            key={cat}
            className={`emoji-cat-btn ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
            type="button"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="emoji-grid">
        {EMOJI_CATEGORIES[activeCategory].map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelectEmoji(emoji)}
            className="emoji-picker-btn"
            type="button"
            aria-label={`Add ${emoji} emoji`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
