import React, { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function OnlineUsers({
  onlineUsers,
  allUsers,
  authUser,
  currentUsername,
  selectedUser,
  selectedGroup,
  onSelectItem,
  unreadCounts,
  onLogout,
  fetchAllUsers,
  groups,
  fetchAllGroups,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("friends");

  const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);
  const myDbUser = allUsers.find(u => u.uid === authUser?.uid);

  const friendsIds = myDbUser?.friends || [];
  const requestIds = myDbUser?.friendRequests || [];

  // Group Users
  const friendsList = allUsers.filter(u => friendsIds.includes(u.uid));
  const requestsList = allUsers.filter(u => requestIds.includes(u.uid));
  const findList = allUsers.filter(
    u => u.uid !== authUser?.uid && !friendsIds.includes(u.uid)
  );

  const handleSendRequest = async (targetUid) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${targetUid}/friend-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterUid: authUser.uid }),
      });
      if (res.ok) {
        toast.success("Friend request sent!");
        fetchAllUsers();
      }
    } catch (err) {
      toast.error("Error sending request");
    }
  };

  const handleAcceptRequest = async (requesterUid) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${authUser.uid}/friend-accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterUid }),
      });
      if (res.ok) {
        toast.success("Friend added!");
        fetchAllUsers();
      }
    } catch (err) {
      toast.error("Error accepting request");
    }
  };

  const handleRejectRequest = async (requesterUid) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${authUser.uid}/friend-reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterUid }),
      });
      if (res.ok) {
        toast.success("Request rejected");
        fetchAllUsers();
      }
    } catch (err) {
      toast.error("Error rejecting request");
    }
  };

  const handleUnfriend = async (friendUid) => {
    if (!window.confirm("Are you sure you want to remove this friend?")) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${authUser.uid}/friend-remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendUid }),
      });
      if (res.ok) {
        toast.success("Friend removed");
        fetchAllUsers();
      }
    } catch (err) {
      toast.error("Error removing friend");
    }
  };

  // Helper to merge online status from socket with DB users
  const getRenderUser = (u) => {
    const isOnline = onlineUsers.some(ou => ou.username === u.displayName);
    return { ...u, isOnline };
  };

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((v) => !v)}
      >
        <span className="sidebar-toggle-icon">☰</span>
        {totalUnread > 0 && <span className="sidebar-toggle-badge">{totalUnread}</span>}
      </button>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className={`online-users ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-tabs">
          <button className={activeTab === "friends" ? "active" : ""} onClick={() => setActiveTab("friends")}>Friends</button>
          <button className={activeTab === "groups" ? "active" : ""} onClick={() => setActiveTab("groups")}>Groups</button>
          <button className={activeTab === "requests" ? "active" : ""} onClick={() => setActiveTab("requests")}>
            Req {requestIds.length > 0 && <span className="tab-badge">{requestIds.length}</span>}
          </button>
          <button className={activeTab === "find" ? "active" : ""} onClick={() => setActiveTab("find")}>Find</button>
        </div>

        <ul className="sidebar-user-list">
          {activeTab === "friends" && (
            <>
              {friendsList.length === 0 ? (
                <li className="no-users-msg">No friends yet. Go to Find!</li>
              ) : (
                friendsList.map(u => {
                  const renderU = getRenderUser(u);
                  return (
                    <li
                      key={renderU.uid}
                      onClick={() => {
                        onSelectItem(renderU.displayName, "private");
                        setSidebarOpen(false);
                      }}
                      className={renderU.displayName === selectedUser ? "selected" : ""}
                    >
                      <span className="avatar-icon">{renderU.avatarUrl ? <img src={renderU.avatarUrl} alt="" className="mini-avatar" /> : renderU.displayName[0]?.toUpperCase()}</span>
                      {renderU.isOnline && <span className="online-dot"></span>}
                      <span className="username-text">{renderU.displayName}</span>
                      {unreadCounts[renderU.displayName] > 0 && (
                        <span className="unread-badge">{unreadCounts[renderU.displayName]}</span>
                      )}
                      
                      <button 
                        className="unfriend-icon" 
                        title="Remove Friend"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnfriend(renderU.uid);
                        }}
                      >
                        ✕
                      </button>
                    </li>
                  );
                })
              )}
            </>
          )}

          {activeTab === "groups" && (
            <>
              <button 
                className="create-group-btn"
                onClick={() => {
                  const name = window.prompt("Enter Group Name:");
                  if (name) {
                    fetch(`${API_URL}/api/groups/create`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ 
                        name, 
                        adminUid: authUser.uid,
                        members: [authUser.uid] 
                      })
                    }).then(() => fetchAllGroups());
                  }
                }}
              >
                + Create New Group
              </button>
              {groups.length === 0 ? (
                <li className="no-users-msg">No groups joined.</li>
              ) : (
                groups.map(g => (
                  <li
                    key={g._id}
                    onClick={() => {
                      onSelectItem(g, "group");
                      setSidebarOpen(false);
                    }}
                    className={selectedGroup?._id === g._id ? "selected" : ""}
                  >
                    <span className="avatar-icon">{g.avatarUrl ? <img src={g.avatarUrl} alt="" className="mini-avatar" /> : "👥"}</span>
                    <span className="username-text group-name">{g.name}</span>
                    <span className="member-count">{g.members?.length || 0}m</span>
                  </li>
                ))
              )}
            </>
          )}

          {activeTab === "requests" && (
            <>
              {requestsList.length === 0 ? (
                <li className="no-users-msg">No friend requests.</li>
              ) : (
                requestsList.map(u => (
                  <li key={u.uid} className="request-item">
                    <div className="request-info">
                      <span className="avatar-icon">{u.avatarUrl ? <img src={u.avatarUrl} alt="" className="mini-avatar"/> : u.displayName[0]?.toUpperCase()}</span>
                      <span className="username-text">{u.displayName}</span>
                    </div>
                    <div className="request-actions">
                      <button className="req-btn accept" onClick={() => handleAcceptRequest(u.uid)}>✓</button>
                      <button className="req-btn reject" onClick={() => handleRejectRequest(u.uid)}>✕</button>
                    </div>
                  </li>
                ))
              )}
            </>
          )}

          {activeTab === "find" && (
            <>
              {findList.length === 0 ? (
                <li className="no-users-msg">No more users to add.</li>
              ) : (
                findList.map(u => {
                  const hasSentReq = u.friendRequests?.includes(authUser?.uid);
                  return (
                    <li key={u.uid} className="find-item">
                      <div className="find-info">
                        <span className="avatar-icon">{u.avatarUrl ? <img src={u.avatarUrl} alt="" className="mini-avatar"/> : u.displayName[0]?.toUpperCase()}</span>
                        <span className="username-text">{u.displayName}</span>
                      </div>
                      <button 
                        className="add-btn" 
                        disabled={hasSentReq}
                        onClick={() => handleSendRequest(u.uid)}
                      >
                        {hasSentReq ? "Sent" : "Add"}
                      </button>
                    </li>
                  );
                })
              )}
            </>
          )}
        </ul>

        <div className="sidebar-footer">
          <Link to="/profile" className="current-user" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="avatar-icon">
              {myDbUser?.avatarUrl ? <img src={myDbUser.avatarUrl} alt="" className="mini-avatar"/> : (currentUsername[0]?.toUpperCase() || "👤")}
            </span>
            <span>{currentUsername}</span>
          </Link>
          <button className="logout-btn" onClick={onLogout} title="Sign out">
            ⎋ Logout
          </button>
        </div>
      </div>
    </>
  );
}
