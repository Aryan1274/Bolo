import React from "react";

export default function OnlineUsers({
  onlineUsers,
  currentUsername,
  selectedUser,
  onSelectUser,
  unreadCounts
}) {
  return (
    <div className="online-users">
      <h3>Online Users</h3>
      <ul>
        {onlineUsers
          .filter((u) => u.username !== currentUsername)
          .map((user) => (
            <li
              key={user.username}
              onClick={() => onSelectUser(user.username)}
              className={user.username === selectedUser ? "selected" : ""}
              style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <span className="avatar-icon">{user.avatar}</span>
              <span className="online-dot"></span>&nbsp;
              <span>{user.username}</span>
              {unreadCounts[user.username] > 0 && (
                <span className="unread-badge">
                  {unreadCounts[user.username]}
                </span>
              )}
            </li>
          ))}
      </ul>
      <div className="current-user">
        Logged in as:{" "}
        {onlineUsers.find((u) => u.username === currentUsername)?.avatar || ""}{" "}
        {currentUsername}
      </div>
    </div>
  );
}
