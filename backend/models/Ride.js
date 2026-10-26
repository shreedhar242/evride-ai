const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema({
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    vehicle: {
        make: { type: String, required: true, trim: true },
        model: { type: String, required: true, trim: true },
        number: { type: String, required: true, trim: true, uppercase: true }
    },
    pickup: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    // Zero seats is valid for a full ride; creation rules still require seats >= 1.
    availableSeats: { type: Number, required: true, min: 0, validate: Number.isInteger },
    // Optional for legacy rides created before fare integration.
    comparableFare: {
        type: Number,
        validate: {
            validator: (value) => value === undefined || (Number.isFinite(value) && value > 0),
            message: "Comparable fare must be a positive number"
        }
    },
    discountPercentage: { type: Number, min: 0, max: 100 },
    price: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        // Keep "started" for existing records; new transitions use "ongoing".
        enum: ["scheduled", "full", "started", "ongoing", "completed", "cancelled"],
        default: "scheduled"
    }
}, {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
        transform(_doc, result) {
            delete result.__v;
            return result;
        }
    }
});

module.exports = mongoose.model("Ride", rideSchema);
