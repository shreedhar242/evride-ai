const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const pricingController = require("../controllers/pricingController");

const router = express.Router();

router.post("/ev-fare", authMiddleware, pricingController.calculateEVFare);

module.exports = router;
