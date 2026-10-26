const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/authorizeRoles");
const adminController = require("../controllers/adminController");

const router = express.Router();
router.use(authMiddleware, authorizeRoles("admin"));

router.get("/stats", adminController.getStats);
router.get("/users", adminController.getUsers);
router.get("/rides", adminController.getRides);
router.get("/bookings", adminController.getBookings);
router.get("/payments", adminController.getPayments);
router.get("/vehicles", adminController.getVehicles);
router.get("/charging-stations", adminController.getChargingStations);
router.patch("/users/:id/status", adminController.updateUserStatus);

module.exports = router;
