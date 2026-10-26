const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const paymentController = require("../controllers/paymentController");
const { paymentLimiter } = require("../middlewares/rateLimiters");

const router = express.Router();
router.use(authMiddleware);
router.post("/demo", paymentLimiter, paymentController.createDemoPayment);
router.post("/create-order", paymentLimiter, paymentController.createOrder);
router.post("/verify", paymentLimiter, paymentController.verifyPayment);
router.post("/failure", paymentLimiter, paymentController.markFailed);
router.post("/cancel", paymentLimiter, paymentController.cancelOrder);
router.get("/my", paymentController.getMyPayments);

module.exports = router;
