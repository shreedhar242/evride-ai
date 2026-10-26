const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const chargingStationController = require("../controllers/chargingStationController");

const router = express.Router();

router.get("/", chargingStationController.getStations);
router.get("/nearby", chargingStationController.getNearbyStations);
router.get("/my", authMiddleware, chargingStationController.getMyStations);
router.get("/:id", chargingStationController.getStation);
router.post("/", authMiddleware, chargingStationController.createStation);
router.put("/:id", authMiddleware, chargingStationController.updateStation);
router.delete("/:id", authMiddleware, chargingStationController.deleteStation);

module.exports = router;
