const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const bookingController = require("../controllers/bookingController");

const router = express.Router();

router.use(authMiddleware);
router.post("/", bookingController.createBooking);
router.get("/my", bookingController.getMyBookings);
router.get("/:id", bookingController.getBooking);
router.put("/:id/cancel", bookingController.cancelBooking);

module.exports = router;
