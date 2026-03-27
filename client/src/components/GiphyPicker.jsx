import React, { useState } from "react";

export default function GiphyPicker({ onSelectGif, onClose }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Note: Standard public API key for testing
  const API_KEY = "dc6zaTOxFJmzC"; 

  const searchGifs = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(
          query
        )}&limit=12`
      );
      const { data } = await res.json();
      setGifs(data || []);
    } catch (err) {
      console.error("Giphy Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="giphy-picker-popup">
      <div className="giphy-header">
        <form onSubmit={searchGifs}>
          <input
            type="text"
            placeholder="Search Giphy..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </form>
        <button className="close-giphy" onClick={onClose}>✕</button>
      </div>

      <div className="giphy-results">
        {loading && <div className="loading-spinner mini"></div>}
        {gifs.map((gif) => (
          <div
            key={gif.id}
            className="gif-item"
            onClick={() => onSelectGif(gif.images.fixed_height.url)}
          >
            <img src={gif.images.fixed_height_small.url} alt={gif.title} />
          </div>
        ))}
        {!loading && gifs.length === 0 && query && (
          <p className="no-results">No GIFs found.</p>
        )}
      </div>
    </div>
  );
}
