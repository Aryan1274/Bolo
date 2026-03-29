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
  const [activeTab, setActiveTab] = useState("all");

  const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);
  const myDbUser = allUsers.find(u => u.uid === authUser?.uid);

  const friendsIds = myDbUser?.friends || [];
  const requestIds = myDbUser?.friendRequests || [];

  const friendsList = allUsers.filter(u => friendsIds.includes(u.uid));
  const requestsList = allUsers.filter(u => requestIds.includes(u.uid));
  const findList = allUsers.filter(u => u.uid !== authUser?.uid && !friendsIds.includes(u.uid));

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

  const getRenderUser = (u) => {
    const isOnline = onlineUsers.some(ou => ou.username === u.displayName);
    return { ...u, isOnline };
  };

  return (
    <div className={`online-users ${(selectedUser || selectedGroup) ? "active-chat-mode" : ""}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="header-top">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Search" className="search-input" />
          </div>
          <Link to="/profile" className="self-avatar-link">
             {myDbUser?.avatarUrl ? <img src={myDbUser.avatarUrl} alt="" className="self-avatar" /> : <div className="self-avatar-placeholder">{currentUsername[0]}</div>}
          </Link>
        </div>
        
        <div className="sidebar-tabs">
          <button className={`tab-link ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>All</button>
          <button className={`tab-link ${activeTab === "groups" ? "active" : ""}`} onClick={() => setActiveTab("groups")}>Groups</button>
          <button className={`tab-link ${activeTab === "requests" ? "active" : ""}`} onClick={() => setActiveTab("requests")}>
            Req {requestIds.length > 0 && <span className="tab-dot"></span>}
          </button>
          <button className={`tab-link ${activeTab === "find" ? "active" : ""}`} onClick={() => setActiveTab("find")}>Find</button>
        </div>
      </div>

      {/* User List */}
      <div className="user-list-container">
        <ul className="user-list">
          {activeTab === "all" && (
            friendsList.length === 0 ? (
              <li className="empty-msg">No conversations yet.</li>
            ) : (
              friendsList.map(u => {
                const renderU = getRenderUser(u);
                return (
                  <li
                    key={renderU.uid}
                    onClick={() => onSelectItem(renderU.displayName, "private")}
                    className={`user-item ${renderU.displayName === selectedUser ? "selected" : ""}`}
                  >
                    <div className="avatar-box">
                      {renderU.avatarUrl ? <img src={renderU.avatarUrl} alt="" className="user-avatar" /> : <div className="avatar-placeholder">{renderU.displayName[0]}</div>}
                      {renderU.isOnline && <span className="online-status-dot"></span>}
                    </div>
                    <div className="user-info">
                      <div className="user-top">
                        <span className="user-name">{renderU.displayName}</span>
                        <span className="last-time">13:30</span>
                      </div>
                      <div className="user-bottom">
                         <span className="last-msg">Tap to chat...</span>
                         {unreadCounts[renderU.displayName] > 0 && <span className="unread-count">{unreadCounts[renderU.displayName]}</span>}
                      </div>
                    </div>
                  </li>
                );
              })
            )
          )}

          {activeTab === "groups" && (
            <>
              <button 
                className="create-btn"
                onClick={() => {
                  const name = window.prompt("Enter Group Name:");
                  if (name) {
                    fetch(`${API_URL}/api/groups/create`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, adminUid: authUser.uid, members: [authUser.uid] })
                    }).then(() => fetchAllGroups());
                  }
                }}
              >
                + Create Group
              </button>
              {groups.map(g => (
                <li
                  key={g._id}
                  onClick={() => onSelectItem(g, "group")}
                  className={`user-item ${selectedGroup?._id === g._id ? "selected" : ""}`}
                >
                  <div className="avatar-box">
                    {g.avatarUrl ? <img src={g.avatarUrl} alt="" className="user-avatar" /> : <div className="avatar-placeholder group">👥</div>}
                  </div>
                  <div className="user-info">
                    <div className="user-top">
                      <span className="user-name">{g.name}</span>
                      <span className="last-time">Mon</span>
                    </div>
                    <div className="user-bottom">
                      <span className="last-msg">Group active</span>
                      {unreadCounts[g.name] > 0 && <span className="unread-count">{unreadCounts[g.name]}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </>
          )}

          {activeTab === "requests" && (
            requestsList.map(u => (
              <li key={u.uid} className="req-item">
                <div className="req-avatar">
                   {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="user-avatar" /> : <div className="avatar-placeholder">{u.displayName[0]}</div>}
                </div>
                <div className="req-details">
                  <span className="user-name">{u.displayName}</span>
                  <div className="req-btns">
                    <button className="btn-ok" onClick={() => handleAcceptRequest(u.uid)}>Accept</button>
                    <button className="btn-no" onClick={() => handleRejectRequest(u.uid)}>Deny</button>
                  </div>
                </div>
              </li>
            ))
          )}

          {activeTab === "find" && (
            findList.map(u => {
              const hasSentReq = u.friendRequests?.includes(authUser?.uid);
              return (
                <li key={u.uid} className="find-item">
                  <div className="avatar-box">
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="user-avatar" /> : <div className="avatar-placeholder">{u.displayName[0]}</div>}
                  </div>
                  <div className="find-right">
                    <span className="user-name">{u.displayName}</span>
                    <button className="add-btn" disabled={hasSentReq} onClick={() => handleSendRequest(u.uid)}>
                      {hasSentReq ? "Pending" : "+ Add"}
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="sidebar-footer-new">
         <button className="logout-btn-new" onClick={onLogout}>Sign Out</button>
      </div>
    </div>
  );
}
