const mongoose = require("mongoose");

const currentYear = new Date().getFullYear();

const vehicleSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: {
        type: Number,
        required: true,
        min: 1886,
        max: currentYear + 1,
        validate: Number.isInteger
    },
    registrationNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        match: /^[A-Z0-9 -]{4,15}$/
    },
    batteryCapacity: { type: Number, required: true, min: 0.1 },
    batteryPercentage: { type: Number, required: true, min: 0, max: 100 },
    estimatedRange: { type: Number, required: true, min: 0 },
    chargingStatus: {
        type: String,
        enum: ["not_charging", "charging", "fully_charged"],
        default: "not_charging"
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

module.exports = mongoose.model("Vehicle", vehicleSchema);
