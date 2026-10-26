const express = require("express");
const { register, login, getMe } = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const { authLimiter } = require("../middlewares/rateLimiters");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", authMiddleware, getMe);

module.exports = router;
