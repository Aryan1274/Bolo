// server/routes/auth.js
const express = require("express");
const router = express.Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Simple example validation logic
  if (email && password) {
    res.status(200).json({
      message: "Login success",
      user: { email },
    });
  } else {
    res.status(400).json({
      message: "Invalid credentials",
    });
  }
});

module.exports = router;
