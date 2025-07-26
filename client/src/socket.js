// src/socket.js
import { io } from "socket.io-client";

const socket = io("https://bolo-6by1.onrender.com"); // backend server URL

export default socket;
