import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function ProfilePage({ authUser, currentUsername }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    bio: "",
    customStatus: "",
    avatarUrl: "",
  });
  const [isUploading, setIsUploading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    if (!authUser?.uid) return;
    
    // Fetch profile
    fetch(`${API_URL}/api/users/${authUser.uid}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setProfile(data);
          setFormData({
            displayName: data.displayName || "",
            bio: data.bio || "",
            customStatus: data.customStatus || "Online",
            avatarUrl: data.avatarUrl || "",
          });
        }
      })
      .catch(console.error);
  }, [authUser, API_URL]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const uploadData = new FormData();
    uploadData.append("image", file);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: uploadData,
      });
      const data = await res.json();
      if (data.imageUrl) {
        setFormData(prev => ({ ...prev, avatarUrl: data.imageUrl }));
        toast.success("Avatar uploaded! Save changes to finalize.");
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (err) {
      toast.error("Avatar upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/users/${authUser.uid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!data.error) {
        setProfile(data);
        setIsEditing(false);
        toast.success("Profile updated!");
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("Failed to update profile");
    }
  };

  if (!profile) {
    return (
      <div className="profile-container loading">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ← Back to Chat
        </button>
        <h2>Your Profile</h2>
      </div>

      <div className="profile-card">
        <div className="profile-avatar-section">
          <div className={`avatar-large ${isUploading ? 'uploading' : ''}`}>
            {formData.avatarUrl ? (
              <img src={formData.avatarUrl} alt="Avatar" />
            ) : (
              <span>{formData.displayName[0]?.toUpperCase() || "👤"}</span>
            )}
            {isUploading && <div className="avatar-loading-overlay"><div className="loading-spinner mini"></div></div>}
          </div>
          {isEditing && (
            <label className="change-avatar-label">
              <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
              <span>Change Photo</span>
            </label>
          )}
          <div className="status-indicator" data-status={formData.customStatus}></div>
        </div>

        {isEditing ? (
          <form className="profile-form" onSubmit={handleSave}>

            
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                required
                value={formData.displayName}
                onChange={e => setFormData({...formData, displayName: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.customStatus}
                onChange={e => setFormData({...formData, customStatus: e.target.value})}
              >
                <option value="Online">🟢 Online</option>
                <option value="Away">🟡 Away</option>
                <option value="Do Not Disturb">🔴 Do Not Disturb</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Bio</label>
              <textarea
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                rows="3"
                maxLength="120"
              />
              <small>{120 - formData.bio.length} characters left</small>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-info">
            <h3 className="profile-name">{profile.displayName}</h3>
            <p className="profile-email">{profile.email}</p>
            
            <div className="profile-status-badge">
              {profile.customStatus === "Online" && "🟢 Online"}
              {profile.customStatus === "Away" && "🟡 Away"}
              {profile.customStatus === "Do Not Disturb" && "🔴 Do Not Disturb"}
            </div>
            
            <div className="profile-bio-box">
              <h4>Bio</h4>
              <p>{profile.bio}</p>
            </div>
            
            <div className="profile-stats">
              <div className="stat">
                <span className="stat-val">{profile.friends?.length || 0}</span>
                <span className="stat-label">Friends</span>
              </div>
            </div>

            <button className="btn-primary edit-profile-btn" onClick={() => setIsEditing(true)}>
              Edit Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
