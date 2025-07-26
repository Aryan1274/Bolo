// client/src/utils/api.js
import axios from "axios";

// 🌐 Replace this with your actual Render backend URL once deployed
const BASE_URL = "https://bolo-6by1.onrender.com"; // or "https://your-backend.onrender.com"

export const loginToBackend = async (data) => {
  try {
    const response = await axios.post(`${BASE_URL}/api/login`, data);
    return response.data;
  } catch (error) {
    console.error("API error:", error.response?.data || error.message);
    throw error;
  }
};
