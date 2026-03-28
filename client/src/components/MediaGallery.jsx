import React, { useEffect, useState } from "react";

export default function MediaGallery({ from, to, type, onClose }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const res = await fetch(`${API_URL}/api/messages/media?from=${from}&to=${to}&type=${type}`);
        const data = await res.json();
        setMedia(data || []);
      } catch (err) {
        console.error("Gallery fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, [from, to, type, API_URL]);

  return (
    <div className="media-gallery">
      <div className="gallery-header">
        <h4>Shared Media</h4>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="gallery-content">
        {loading ? (
          <div className="loading-spinner mini"></div>
        ) : media.length === 0 ? (
          <p className="no-media">No media shared yet.</p>
        ) : (
          <div className="media-grid">
            {media.map((msg) => (
              <div key={msg._id} className="media-item">
                {msg.imageUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                  <div className="video-thumb">📹</div>
                ) : msg.imageUrl.match(/\.(mp3|wav|ogg|m4a)$/i) ? (
                  <div className="audio-thumb">🎵</div>
                ) : (
                  <img src={msg.imageUrl} alt="Shared" onClick={() => window.open(msg.imageUrl, '_blank')} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
