const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const recommendationController = require("../controllers/recommendationController");

const router = express.Router();

router.use(authMiddleware);
router.get("/rides", recommendationController.getRideRecommendations);
router.get("/charging-stations", recommendationController.getChargingStationRecommendations);

module.exports = router;
