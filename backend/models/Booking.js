const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    ride: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ride",
        required: true
    },
    passenger: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    seatsBooked: {
        type: Number,
        required: true,
        min: 1,
        validate: Number.isInteger
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ["confirmed", "cancelled"],
        default: "confirmed"
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

// A passenger can have only one active booking per ride.
bookingSchema.index(
    { ride: 1, passenger: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "confirmed" },
        name: "one_confirmed_booking_per_passenger_and_ride"
    }
);

module.exports = mongoose.model("Booking", bookingSchema);
