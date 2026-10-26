const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
    seatsBooked: { type: Number, required: true, min: 1, validate: Number.isInteger },
    // Razorpay represents INR amounts in paise.
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    currency: { type: String, required: true, enum: ["INR"], default: "INR" },
    provider: { type: String, required: true, enum: ["razorpay", "demo"], default: "razorpay" },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, sparse: true, unique: true },
    signatureVerified: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ["created", "pending", "paid", "captured", "failed", "cancelled", "refund_pending", "refunded"],
        default: "created"
    },
    refundId: { type: String },
    refundStatus: { type: String }
}, {
    timestamps: { createdAt: true, updatedAt: true },
    toJSON: {
        transform(_doc, result) {
            delete result.__v;
            return result;
        }
    }
});

module.exports = mongoose.model("Payment", paymentSchema);
