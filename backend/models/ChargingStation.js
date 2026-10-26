const mongoose = require("mongoose");

const chargingStationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    chargerType: {
        type: String,
        required: true,
        enum: ["AC", "DC", "fast_charging"]
    },
    totalSlots: { type: Number, required: true, min: 1, validate: Number.isInteger },
    availableSlots: { type: Number, required: true, min: 0, validate: Number.isInteger },
    chargingPrice: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ["active", "inactive", "maintenance"],
        default: "active"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
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

chargingStationSchema.pre("validate", function () {
    if (this.availableSlots > this.totalSlots) {
        this.invalidate("availableSlots", "Available slots cannot exceed total slots");
    }
});

module.exports = mongoose.model("ChargingStation", chargingStationSchema);
