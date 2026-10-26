const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Ride = require("../models/Ride");

const rideDetails = {
    path: "ride",
    select: "pickup destination date time price status driver",
    populate: { path: "driver", select: "name" }
};
const passengerDetails = { path: "passenger", select: "name" };

class BookingError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function validId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function formatBooking(booking) {
    return booking.populate([rideDetails, passengerDetails]);
}

// Used only after the payment controller has verified a captured payment.
exports.createPaidBooking = async ({ rideId, seatsBooked, passengerId, session }) => {
    const ride = await Ride.findById(rideId).session(session);
    if (!ride) throw new BookingError(404, "Ride not found");
    if (ride.driver.toString() === passengerId.toString()) {
        throw new BookingError(403, "Drivers cannot book their own ride");
    }
    if (ride.status !== "scheduled") {
        throw new BookingError(409, "This ride is not available for booking");
    }

    const existingBooking = await Booking.findOne({
        ride: ride._id,
        passenger: passengerId,
        status: "confirmed"
    }).session(session);
    if (existingBooking) throw new BookingError(409, "You already have an active booking for this ride");
    if (seatsBooked > ride.availableSeats) throw new BookingError(409, "Not enough seats are available");

    const rideUpdate = { $inc: { availableSeats: -seatsBooked } };
    if (ride.availableSeats === seatsBooked) rideUpdate.$set = { status: "full" };
    const updatedRide = await Ride.findOneAndUpdate(
        { _id: ride._id, status: "scheduled", availableSeats: { $gte: seatsBooked } },
        rideUpdate,
        { new: true, session, runValidators: true }
    );
    if (!updatedRide) throw new BookingError(409, "Not enough seats are available");

    const [createdBooking] = await Booking.create([{
        ride: ride._id,
        passenger: passengerId,
        seatsBooked,
        totalPrice: ride.price * seatsBooked,
        status: "confirmed"
    }], { session });
    return createdBooking;
};

exports.createBooking = async (req, res) => {
    return res.status(402).json({
        success: false,
        message: "Payment is required to confirm a booking. Create a payment order first."
    });
};

exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ passenger: req.user._id })
            .populate(rideDetails)
            .sort({ createdAt: -1 });
        return res.json({ success: true, count: bookings.length, bookings });
    } catch (error) {
        console.error("Get bookings failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve bookings" });
    }
};

exports.getBooking = async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid booking ID" });
        }
        const booking = await Booking.findById(req.params.id)
            .populate(rideDetails)
            .populate(passengerDetails);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

        const isPassenger = booking.passenger?._id.toString() === req.user._id.toString();
        const isDriver = booking.ride?.driver?._id.toString() === req.user._id.toString();
        if (!isPassenger && !isDriver) {
            return res.status(403).json({ success: false, message: "You are not allowed to view this booking" });
        }
        return res.json({ success: true, booking });
    } catch (error) {
        console.error("Get booking failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve booking" });
    }
};

exports.cancelBooking = async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const session = await mongoose.startSession();
    let cancelledBooking;
    try {
        await session.withTransaction(async () => {
            const booking = await Booking.findById(req.params.id).session(session);
            if (!booking) throw new BookingError(404, "Booking not found");
            if (booking.passenger.toString() !== req.user._id.toString()) {
                throw new BookingError(403, "Only the passenger who made this booking can cancel it");
            }
            if (booking.status !== "confirmed") {
                throw new BookingError(409, "This booking has already been cancelled");
            }

            booking.status = "cancelled";
            await booking.save({ session });
            const rideBeforeRestore = await Ride.findById(booking.ride).session(session);
            if (!rideBeforeRestore) throw new BookingError(404, "Ride for this booking was not found");
            const rideUpdate = { $inc: { availableSeats: booking.seatsBooked } };
            if (rideBeforeRestore.status === "full") {
                rideUpdate.$set = { status: "scheduled" };
            }
            const ride = await Ride.findByIdAndUpdate(
                booking.ride,
                rideUpdate,
                { new: true, session, runValidators: true }
            );
            if (!ride) throw new BookingError(404, "Ride for this booking was not found");
            cancelledBooking = booking;
        });

        await formatBooking(cancelledBooking);
        return res.json({ success: true, message: "Booking cancelled", booking: cancelledBooking });
    } catch (error) {
        if (error instanceof BookingError) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        console.error("Cancel booking failed.");
        return res.status(500).json({ success: false, message: "Unable to cancel booking" });
    } finally {
        await session.endSession();
    }
};
