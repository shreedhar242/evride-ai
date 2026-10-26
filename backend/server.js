const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
const paymentMode = (process.env.PAYMENT_MODE || "razorpay").trim().toLowerCase();
if (!["development", "test", "production"].includes(process.env.NODE_ENV) ||
    !process.env.MONGO_URI || !process.env.JWT_SECRET || !process.env.FRONTEND_URL || !["demo", "razorpay"].includes(paymentMode)) {
    console.error("Server configuration is incomplete or invalid. Check NODE_ENV, FRONTEND_URL, PAYMENT_MODE, MONGO_URI, and JWT_SECRET.");
    process.exit(1);
}
if (process.env.NODE_ENV === "production" && paymentMode === "demo") {
    console.error("Demo payment mode cannot be used in production.");
    process.exit(1);
}

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const app = express();

const allowedOrigins = new Set(process.env.FRONTEND_URL.split(",").map((value) => {
    try {
        const origin = new URL(value.trim());
        if (!["http:", "https:"].includes(origin.protocol)) return "";
        if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") return "";
        return origin.origin;
    } catch (_error) { return ""; }
}).filter(Boolean));
if (allowedOrigins.size === 0) {
    console.error("FRONTEND_URL must contain at least one valid frontend origin.");
    process.exit(1);
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
    origin(origin, callback) {
        callback(null, Boolean(origin && allowedOrigins.has(origin)));
    },
    credentials: true
}));
app.use(express.json({ limit: "100kb" }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/rides", require("./routes/rideRoutes"));
app.use("/api/bookings", require("./routes/bookingRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/vehicles", require("./routes/vehicleRoutes"));
app.use("/api/pricing", require("./routes/pricingRoutes"));
app.use("/api/charging-stations", require("./routes/chargingStationRoutes"));
app.use("/api/recommendations", require("./routes/recommendationRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

const PORT = Number(process.env.PORT) || 5000;

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "EVRide AI API is working"
    });
});

app.use("/api", (_req, res) => res.status(404).json({ success: false, message: "API endpoint not found" }));
app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error.type === "entity.too.large") {
        return res.status(413).json({ success: false, message: "Request body is too large" });
    }
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "Request body must contain valid JSON" });
    }
    console.error("Request failed.");
    return res.status(500).json({ success: false, message: "Unexpected server error" });
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");

        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    })
    .catch(() => {
        console.error("MongoDB connection failed. Check database configuration and network access.");
    });
