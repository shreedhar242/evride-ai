const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const driverMiddleware = require("../middlewares/driverMiddleware");
const rideController = require("../controllers/rideController");

const router = express.Router();

router.get("/", rideController.getRides);
router.get("/my", authMiddleware, driverMiddleware, rideController.getMyRides);
router.get("/:id", rideController.getRide);
router.post("/", authMiddleware, driverMiddleware, rideController.createRide);
router.put("/:id", authMiddleware, driverMiddleware, rideController.updateRide);
router.delete("/:id", authMiddleware, driverMiddleware, rideController.cancelRide);

module.exports = router;
