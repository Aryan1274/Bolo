import { useEffect, useState, useRef, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import socket from "./socket";
import toast, { Toaster } from "react-hot-toast";
import Peer from "simple-peer";

import { Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import OnlineUsers from "./components/OnlineUsers";
import ChatArea from "./components/ChatArea";
import ProfilePage from "./components/ProfilePage";
import CallOverlay from "./components/CallOverlay";

import "./App.css";

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // WebRTC States
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  const connectionRef = useRef();
  const messageInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const chatListenerRef = useRef(null);
  const seenKeysRef = useRef(new Set());
  const selectedUserRef = useRef(selectedUser);

  // Keep ref in sync
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Derive a reliable username that won't suddenly be undefined or mismatched.
  const currentUsername = authUser ? (authUser.displayName || authUser.email?.split("@")[0] || authUser.uid).trim() : "";

  const fetchAllUsers = useCallback(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/users`)
      .then(res => res.json())
      .then(setAllUsers)
      .catch(console.error);
  }, []);

  const fetchAllGroups = useCallback(() => {
    if (!authUser?.uid) return;
    fetch(`${import.meta.env.VITE_API_URL}/api/groups/user/${authUser.uid}`)
      .then(res => res.json())
      .then(setGroups)
      .catch(console.error);
  }, [authUser]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (user) {
        const name = (user.displayName || user.email?.split("@")[0] || user.uid).trim();
        const avatar = user.photoURL || name[0]?.toUpperCase() || "👤";
        
        // Sync user to MongoDB
        fetch(`${import.meta.env.VITE_API_URL}/api/users/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: name,
            avatarUrl: user.photoURL || "",
          }),
        }).catch(console.error);

        socket.emit("set_username", { username: name, avatar, uid: user.uid });
        // Also fetch all users and groups from DB
        fetchAllUsers();
        fetchAllGroups();
      }
    });
    return () => unsub();
  }, [fetchAllUsers, fetchAllGroups]);

  // ── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    socket.on("online_users", (users) => setOnlineUsers(users));

    socket.on("typing", ({ from, isTyping, isGroup, to }) => {
      if (isGroup) {
        setTypingUsers((prev) => ({ ...prev, [`${to}_${from}`]: isTyping }));
      } else {
        setTypingUsers((prev) => ({ ...prev, [from]: isTyping }));
      }
    });

    // Delivery acknowledgement helps us update the temp UI key to the real DB _id
    socket.on("message_delivered", ({ tempKey, key, to }) => {
      setChat((prev) =>
        prev.map((msg) =>
          msg.key === tempKey ? { ...msg, key } : msg
        )
      );
    });

    // Peer has seen our messages → update seen ticks
    socket.on("messages_seen_ack", ({ seenFrom }) => {
      setChat((prev) =>
        prev.map((msg) =>
          msg.from === currentUsername && msg.to === seenFrom
            ? { ...msg, seen: true }
            : msg
        )
      );
    });

    // Real-time reaction updates from server
    socket.on("reaction_update", ({ messageId, reactions }) => {
      setChat((prev) =>
        prev.map((msg) =>
          msg.key === messageId ? { ...msg, reactions } : msg
        )
      );
    });

    // Real-time message edit from server
    socket.on("message_edited", ({ messageId, message }) => {
      setChat((prev) =>
        prev.map((msg) =>
          msg.key === messageId ? { ...msg, message } : msg
        )
      );
    });

    // Real-time message delete from server
    socket.on("message_deleted", ({ messageId }) => {
      setChat((prev) =>
        prev.map((msg) =>
          msg.key === messageId ? { ...msg, message: "[deleted]" } : msg
        )
      );
    });

    // Real-time delivery from peer
    socket.on("receive_message", (newMessage) => {
      // If the message is from the currently selected user, add it to chat
      if (newMessage.from === selectedUserRef.current) {
        setChat((prev) => {
          const alreadyExists = prev.some(
            (m) => m.timestamp === newMessage.timestamp && m.from === newMessage.from
          );
          if (alreadyExists) return prev;
          
          return [...prev, { key: `temp_${newMessage.timestamp}`, ...newMessage }].sort(
            (a, b) => a.timestamp - b.timestamp
          );
        });
      } else {
        // Message from someone else → increment unread count
        setUnreadCounts((prev) => ({
          ...prev,
          [newMessage.from]: (prev[newMessage.from] || 0) + 1,
        }));
      }
    });

    // Real-time friend updates
    socket.on("friend_update", ({ type, from, target }) => {
      fetchAllUsers();
      if (type === "request_received") {
        toast("New friend request received! 👤", { icon: "👋" });
      }
      if (type === "request_accepted") {
        toast.success("Friend request accepted! 🎉");
      }
    });

    socket.on("incoming_call", ({ from, name, signal }) => {
      setReceivingCall(true);
      setCaller(from);
      setCallerSignal(signal);
    });

    return () => {
      socket.off("online_users");
      socket.off("typing");
      socket.off("messages_seen_ack");
      socket.off("receive_message");
      socket.off("reaction_update");
      socket.off("message_edited");
      socket.off("message_deleted");
      socket.off("friend_update");
      socket.off("incoming_call");
    };
  }, [currentUsername]);

  // ── WebRTC Calling Functions ─────────────────────────────────────────────
  const callUser = async (idOfTarget) => {
    try {
      const myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(myStream);

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: myStream,
      });

      peer.on("signal", (data) => {
        socket.emit("call_user", {
          userToCall: idOfTarget,
          signalData: data,
          from: authUser.uid,
          name: currentUsername,
        });
      });

      peer.on("stream", (remStream) => {
        setRemoteStream(remStream);
      });

      socket.on("call_accepted", (signal) => {
        setCallAccepted(true);
        peer.signal(signal);
      });

      connectionRef.current = peer;
    } catch (err) {
      console.error("Camera/Mic access denied:", err);
      toast.error("Please allow camera/microphone access to call.");
    }
  };

  const answerCall = async () => {
    try {
      setCallAccepted(true);
      const myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(myStream);

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: myStream,
      });

      peer.on("signal", (data) => {
        socket.emit("answer_call", { signal: data, to: caller });
      });

      peer.on("stream", (remStream) => {
        setRemoteStream(remStream);
      });

      if (callerSignal) peer.signal(callerSignal);
      connectionRef.current = peer;
    } catch (err) {
      console.error("Camera/Mic access denied:", err);
      toast.error("Camera/Mic access is required to answer.");
      leaveCall();
    }
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setReceivingCall(false);
    setCaller("");
    setCallerSignal(null);
    setCallAccepted(false);
    setCallEnded(false);
    setRemoteStream(null);
    socket.off("call_accepted");
  };

  // ── Unread counts (fetch from REST API) ─────────
  useEffect(() => {
    if (!currentUsername) return;
    
    // Fetch initial on mount
    fetch(`${import.meta.env.VITE_API_URL}/api/messages/unread/${currentUsername}`)
      .then((res) => res.json())
      .then((counts) => setUnreadCounts(counts))
      .catch(console.error);

    // We can update unread counts when receive_message fires for other users
  }, [currentUsername]);

  // ── Mark incoming messages as seen when selectedUser changes ─────────────
  useEffect(() => {
    if (!selectedUser || !currentUsername) return;
    // Re-scan current chat and mark any unread-from-peer as seen in UI
    setChat((prev) => {
      let changed = false;
      const next = prev.map((msg) => {
        if (msg.from === selectedUser && msg.to === currentUsername && !msg.seen) {
          changed = true;
          return { ...msg, seen: true };
        }
        return msg;
      });
      return changed ? next : prev;
    });
    // Tell socket to inform peer + server to update DB
    socket.emit("message_seen", { from: selectedUser, to: currentUsername });
  }, [selectedUser, currentUsername]);

  // ── Select a item (User or Group) ─────────────
  function handleItemSelect(item, type = "private") {
    if (type === "private") {
      setSelectedUser(item);
      setSelectedGroup(null);
    } else {
      setSelectedGroup(item); // item is the group object
      setSelectedUser("");
      socket.emit("join_group", item._id);
    }

    setHasMore(false);

    // Clear unread count for the user we're opening
    if (type === "private") {
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[item];
        return next;
      });
    }

    if (!currentUsername) return;

    // Fetch chat history
    const url = type === "private" 
      ? `${import.meta.env.VITE_API_URL}/api/messages/${currentUsername}/${item}?limit=50`
      : `${import.meta.env.VITE_API_URL}/api/messages/group/${item._id}?limit=50`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const formatted = (data.messages || []).map((msg) => ({ ...msg, key: msg._id }));
        setChat(formatted);
        setHasMore(data.hasMore || false);
      })
      .catch(console.error);
  }

  // ── Load older messages (infinite scroll) ─────────────────────────────────
  async function loadOlderMessages() {
    if (!hasMore || isLoadingMore || (!selectedUser && !selectedGroup) || !currentUsername) return;
    setIsLoadingMore(true);
    try {
      const oldestTimestamp = chat.length > 0 ? chat[0].timestamp : Date.now();
      const baseUrl = selectedGroup 
        ? `${import.meta.env.VITE_API_URL}/api/messages/group/${selectedGroup._id}`
        : `${import.meta.env.VITE_API_URL}/api/messages/${currentUsername}/${selectedUser}`;
      
      const res = await fetch(
        `${baseUrl}?limit=50&before=${oldestTimestamp}`
      );
      const data = await res.json();
      const formatted = (data.messages || []).map((msg) => ({ ...msg, key: msg._id }));
      setChat((prev) => [...formatted, ...prev]);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }

  // ── Send a text message ───────────────────────────────────────────────────
  function sendMessage(imageUrl = null, repliedToId = null) {
    if ((!message.trim() && !imageUrl) || (!selectedUser && !selectedGroup) || !currentUsername) return;

    const timestamp = Date.now();
    const type = selectedGroup ? "group" : "private";
    const to = selectedGroup ? selectedGroup._id : selectedUser;

    const newMessage = {
      from: currentUsername,
      to,
      message: message.trim(),
      timestamp,
      delivered: true,
      seen: false,
      type,
      repliedToId,
      senderName: currentUsername,
      senderAvatar: myDbUser?.avatarUrl || ""
    };
    if (imageUrl) {
      newMessage.imageUrl = imageUrl;
    }

    // Optimistically update UI for the sender (only for private, group waits for broadcast to ensure order)
    if (type === "private") {
      setChat((prev) => [...prev, { key: `temp_${timestamp}`, ...newMessage }]);
    }

    socket.emit("send_message", newMessage);
    if (!imageUrl) setMessage(""); 
  }

  // ── Message editing ───────────────────────────────────────────────────────
  function startEditing(msg) {
    if (msg.key.startsWith("temp_")) return; // can't edit until saved to DB
    setEditingMessageId(msg.key);
    setEditingMessageText(msg.message);
  }
  function cancelEditing() {
    setEditingMessageId(null);
    setEditingMessageText("");
  }
  async function saveEditedMessage() {
    if (!editingMessageText.trim() || !editingMessageId) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/messages/${editingMessageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: editingMessageText.trim() }),
      });
      // Optimistic update
      setChat((prev) => prev.map((msg) => msg.key === editingMessageId ? { ...msg, message: editingMessageText.trim() } : msg));
    } catch (err) {
      console.error(err);
      toast.error("Failed to edit message");
    }
    cancelEditing();
  }

  // ── Soft-delete ───────────────────────────────────────────────────────────
  async function deleteMessage(msg) {
    if (msg.key.startsWith("temp_")) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/messages/${msg.key}/delete`, { method: "PUT" });
      setChat((prev) => prev.map((m) => m.key === msg.key ? { ...m, message: "[deleted]" } : m));
    } catch (err) {
      console.error(err);
    }
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  async function toggleReaction(msg, emoji) {
    if (!currentUsername || msg.message === "[deleted]" || msg.key.startsWith("temp_")) return;
    
    // Optimistic UI toggle
    const current = msg.reactions || {};
    const users = current[emoji] || [];
    const already = users.includes(currentUsername);
    const newReactions = {
      ...current,
      [emoji]: already ? users.filter((u) => u !== currentUsername) : [...users, currentUsername],
    };
    setChat((prev) => prev.map((m) => m.key === msg.key ? { ...m, reactions: newReactions } : m));

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/messages/${msg.key}/react`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, username: currentUsername }),
      });
    } catch (err) {
      console.error(err);
    }
  }

  function addEmojiToMessage(emoji) {
    setMessage((prev) => prev + emoji);
    messageInputRef.current?.focus();
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  function handleLogout() {
    socket.emit("set_username", { username: null, avatar: null }); // signal offline
    signOut(auth).then(() => {
      setAuthUser(null);
      setChat([]);
      setSelectedUser("");
      setOnlineUsers([]);
    });
  }

  // ── Close emoji picker on outside click ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        e.target.getAttribute("id") !== "emoji-toggle-btn"
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!authUser) {
    // Login page: NO height restriction — page can scroll freely
    return <LoginPage onLoginSuccess={(user) => setAuthUser(user)} />;
  }

  // Compute detailed user information for ChatArea
  const selectedUserDetails = selectedGroup ? {
    username: selectedGroup.name,
    isOnline: true, // groups are conceptually "always there"
    customStatus: `${selectedGroup.members?.length || 0} members`,
    avatar: selectedGroup.avatarUrl || "👥",
    isGroup: true
  } : selectedUser ? (() => {
    // Check active sockets first
    const online = onlineUsers.find((u) => u.username === selectedUser);
    // Gather DB extended info
    const dbUser = allUsers.find((u) => u.displayName === selectedUser);
    
    return {
      uid: dbUser?.uid,
      username: selectedUser,
      isOnline: !!online,
      customStatus: online?.status || dbUser?.customStatus || "Online",
      lastSeen: dbUser?.lastSeen || null,
      avatar: online?.avatar || dbUser?.avatarUrl || "👤"
    };
  })() : null;

  const myDbUser = allUsers.find(u => u.uid === authUser?.uid);
  const isFriend = selectedGroup || (selectedUserDetails && myDbUser?.friends?.includes(selectedUserDetails.uid));

  return (
    <div className="app">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#27272a',
            color: '#fafafa',
            borderRadius: '1rem',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9rem',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route
          path="/"
          element={
            <div className="chat-layout">
              <OnlineUsers
                onlineUsers={onlineUsers}
                allUsers={allUsers}
                groups={groups}
                authUser={authUser}
                currentUsername={currentUsername}
                selectedUser={selectedUser}
                selectedGroup={selectedGroup}
                onSelectItem={handleItemSelect}
                unreadCounts={unreadCounts}
                onLogout={handleLogout}
                fetchAllUsers={fetchAllUsers}
                fetchAllGroups={fetchAllGroups}
              />
              <ChatArea
                chat={chat}
                selectedUser={selectedUser || selectedGroup?.name}
                selectedUserDetails={selectedUserDetails}
                selectedGroup={selectedGroup}
                isFriend={!!isFriend}
                username={currentUsername}
                editingMessageId={editingMessageId}
                editingMessageText={editingMessageText}
                setEditingMessageText={setEditingMessageText}
                startEditing={startEditing}
                cancelEditing={cancelEditing}
                saveEditedMessage={saveEditedMessage}
                deleteMessage={deleteMessage}
                toggleReaction={toggleReaction}
                message={message}
                setMessage={setMessage}
                sendMessage={sendMessage}
                typingUsers={typingUsers}
                showEmojiPicker={showEmojiPicker}
                setShowEmojiPicker={setShowEmojiPicker}
                addEmojiToMessage={addEmojiToMessage}
                messageInputRef={messageInputRef}
                emojiPickerRef={emojiPickerRef}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                loadOlderMessages={loadOlderMessages}
                onCall={callUser}
              />
            </div>
          }
        />
        <Route
          path="/profile"
          element={
            <ProfilePage
              authUser={authUser}
              currentUsername={currentUsername}
            />
          }
        />
      </Routes>

      {/* Global Call Overlay */}
      {(receivingCall || (stream && !callEnded)) && (
        <CallOverlay 
          stream={stream}
          remoteStream={remoteStream}
          onHangUp={leaveCall}
          isReceivingCall={receivingCall}
          callerName={caller} // Should ideally map UID to DisplayName
          onAnswer={answerCall}
          callAccepted={callAccepted}
          callEnded={callEnded}
        />
      )}
    </div>
  );
}

export default App;
