const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const bookingController = require("./bookingController");
const razorpay = require("../services/razorpayService");

function validObjectId(value) {
    return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

function safeErrorStatus(error) {
    return Number.isInteger(error.status) ? error.status : 502;
}

function demoPaymentEnabled() {
    return process.env.NODE_ENV !== "production" && process.env.PAYMENT_MODE?.trim().toLowerCase() === "demo";
}

exports.createOrder = async (req, res) => {
    if (demoPaymentEnabled()) {
        return res.status(409).json({ success: false, message: "Razorpay checkout is disabled while demo payment mode is active" });
    }
    const { rideId, seatsBooked } = req.body || {};
    if (!validObjectId(rideId)) {
        return res.status(400).json({ success: false, message: "A valid rideId is required" });
    }
    if (!Number.isInteger(seatsBooked) || seatsBooked < 1) {
        return res.status(400).json({ success: false, message: "seatsBooked must be a positive whole number" });
    }

    try {
        const credentials = razorpay.getTestCredentials();
        const ride = await Ride.findById(rideId).select("driver price status availableSeats");
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        if (ride.driver.toString() === req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Drivers cannot book their own ride" });
        }
        if (ride.status !== "scheduled") {
            return res.status(409).json({ success: false, message: "This ride is not available for booking" });
        }
        if (seatsBooked > ride.availableSeats) {
            return res.status(409).json({ success: false, message: "Not enough seats are available" });
        }
        const existingBooking = await Booking.findOne({ ride: ride._id, passenger: req.user._id, status: "confirmed" }).select("_id");
        if (existingBooking) {
            return res.status(409).json({ success: false, message: "You already have an active booking for this ride" });
        }
        const totalRupees = ride.price * seatsBooked;
        const amountPaise = Math.round(totalRupees * 100);
        if (!Number.isFinite(totalRupees) || totalRupees <= 0 || !Number.isSafeInteger(amountPaise) || amountPaise < 1) {
            return res.status(400).json({ success: false, message: "The calculated payment amount is invalid" });
        }

        const payment = new Payment({
            user: req.user._id,
            ride: ride._id,
            seatsBooked,
            amountPaise,
            currency: "INR",
            provider: "razorpay",
            // Allocate an ID before contacting the provider for a unique receipt.
            orderId: `pending_${new mongoose.Types.ObjectId()}`,
            status: "pending"
        });

        const order = await razorpay.createOrder({
            amountPaise,
            currency: "INR",
            receipt: `evride_${payment._id}`,
            notes: { paymentRecordId: payment._id.toString(), rideId: ride._id.toString() }
        });
        if (!order.id || order.amount !== amountPaise || order.currency !== "INR") {
            return res.status(502).json({ success: false, message: "Payment provider returned an invalid order" });
        }

        payment.orderId = order.id;
        payment.status = "created";
        await payment.save();
        return res.status(201).json({
            success: true,
            paymentRecordId: payment._id,
            keyId: credentials.keyId,
            orderId: order.id,
            amount: amountPaise,
            currency: "INR",
            ride: { id: ride._id, price: ride.price },
            seatsBooked
        });
    } catch (error) {
        if (Number.isInteger(error.providerStatus)) {
            console.error("Razorpay provider failure:", {
                httpStatus: error.providerStatus,
                errorCode: error.providerCode,
                errorDescription: error.providerDescription
            });
        } else {
            console.error("Payment order creation failed.");
        }
        return res.status(safeErrorStatus(error)).json({
            success: false,
            message: error.status === 503 ? error.message : "Unable to create a test payment order"
        });
    }
};

exports.createDemoPayment = async (req, res) => {
    if (!demoPaymentEnabled()) {
        return res.status(404).json({ success: false, message: "Demo payments are not enabled" });
    }
    const { rideId, seatsBooked } = req.body || {};
    if (!validObjectId(rideId)) {
        return res.status(400).json({ success: false, message: "A valid rideId is required" });
    }
    if (!Number.isInteger(seatsBooked) || seatsBooked < 1) {
        return res.status(400).json({ success: false, message: "seatsBooked must be a positive whole number" });
    }

    const session = await mongoose.startSession();
    let payment;
    let booking;
    try {
        await session.withTransaction(async () => {
            const ride = await Ride.findById(rideId).session(session);
            if (!ride) throw Object.assign(new Error("Ride not found"), { status: 404 });
            if (ride.driver.toString() === req.user._id.toString()) {
                throw Object.assign(new Error("Drivers cannot book their own ride"), { status: 403 });
            }
            if (ride.status !== "scheduled") {
                throw Object.assign(new Error("This ride is not available for booking"), { status: 409 });
            }
            if (seatsBooked > ride.availableSeats) {
                throw Object.assign(new Error("Not enough seats are available"), { status: 409 });
            }
            const existingBooking = await Booking.findOne({
                ride: ride._id,
                passenger: req.user._id,
                status: "confirmed"
            }).session(session).select("_id");
            if (existingBooking) {
                throw Object.assign(new Error("You already have an active booking for this ride"), { status: 409 });
            }

            const totalRupees = ride.price * seatsBooked;
            const amountPaise = Math.round(totalRupees * 100);
            if (!Number.isFinite(totalRupees) || totalRupees <= 0 || !Number.isSafeInteger(amountPaise) || amountPaise < 1) {
                throw Object.assign(new Error("The calculated payment amount is invalid"), { status: 400 });
            }

            payment = new Payment({
                user: req.user._id,
                ride: ride._id,
                seatsBooked,
                amountPaise,
                currency: "INR",
                provider: "demo",
                orderId: `demo_order_${new mongoose.Types.ObjectId()}`,
                paymentId: `demo_payment_${new mongoose.Types.ObjectId()}`,
                signatureVerified: false,
                status: "captured"
            });
            await payment.save({ session });

            booking = await bookingController.createPaidBooking({
                rideId: ride._id,
                seatsBooked,
                passengerId: req.user._id,
                session
            });
            payment.booking = booking._id;
            await payment.save({ session });
        });

        await booking.populate({
            path: "ride", select: "pickup destination date time price status driver",
            populate: { path: "driver", select: "name" }
        });
        payment = await Payment.findById(payment._id);
        return res.status(201).json({
            success: true,
            message: "Payment successful. Your booking is confirmed.",
            booking,
            payment: publicPayment(payment)
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "You already have an active booking for this ride" });
        }
        if (Number.isInteger(error.status)) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        console.error("Demo payment failed.");
        return res.status(500).json({ success: false, message: "Unable to complete the demo payment" });
    } finally {
        await session.endSession();
    }
};

exports.verifyPayment = async (req, res) => {
    if (demoPaymentEnabled()) {
        return res.status(409).json({ success: false, message: "Razorpay verification is disabled while demo payment mode is active" });
    }
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (typeof orderId !== "string" || orderId.length > 100 || typeof paymentId !== "string" || paymentId.length > 100 ||
        typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
        return res.status(400).json({ success: false, message: "Payment verification details are required" });
    }

    let payment;
    try {
        razorpay.getTestCredentials();
        payment = await Payment.findOne({ orderId, user: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Payment order not found" });
        if (!razorpay.verifySignature(orderId, paymentId, signature)) {
            if (payment.status !== "paid") {
                payment.status = "failed";
                payment.signatureVerified = false;
                await payment.save();
            }
            return res.status(400).json({ success: false, message: "Payment signature is invalid" });
        }
        if (payment.status === "paid" && payment.booking) {
            if (payment.paymentId !== paymentId) {
                return res.status(409).json({ success: false, message: "This order was already verified with a different payment" });
            }
            const booking = await Booking.findById(payment.booking).populate({
                path: "ride", select: "pickup destination date time price status driver",
                populate: { path: "driver", select: "name" }
            });
            return res.json({ success: true, alreadyVerified: true, booking, payment: publicPayment(payment) });
        }
        if (["refund_pending", "refunded"].includes(payment.status)) {
            return res.status(409).json({ success: false, message: "This payment has already been processed for a refund" });
        }

        const providerPayment = await razorpay.fetchPayment(paymentId);
        if (providerPayment.order_id !== payment.orderId ||
            providerPayment.status !== "captured" ||
            providerPayment.amount !== payment.amountPaise ||
            providerPayment.currency !== payment.currency) {
            payment.status = "failed";
            payment.signatureVerified = true;
            await payment.save();
            return res.status(409).json({ success: false, message: "Payment is not captured for the expected amount and order" });
        }

        const session = await mongoose.startSession();
        let booking;
        try {
            await session.withTransaction(async () => {
                const currentPayment = await Payment.findById(payment._id).session(session);
                if (!currentPayment) throw Object.assign(new Error("Payment record not found"), { status: 404 });
                if (currentPayment.status === "paid" && currentPayment.booking) {
                    booking = await Booking.findById(currentPayment.booking).session(session);
                    return;
                }
                booking = await bookingController.createPaidBooking({
                    rideId: currentPayment.ride,
                    seatsBooked: currentPayment.seatsBooked,
                    passengerId: currentPayment.user,
                    session
                });
                currentPayment.paymentId = paymentId;
                currentPayment.signatureVerified = true;
                currentPayment.status = "paid";
                currentPayment.booking = booking._id;
                await currentPayment.save({ session });
            });
        } catch (bookingError) {
            const latestPayment = await Payment.findById(payment._id);
            if (latestPayment?.status === "paid" && latestPayment.booking) {
                booking = await Booking.findById(latestPayment.booking);
            } else {
                payment = latestPayment || payment;
                payment.status = "refund_pending";
                payment.paymentId = paymentId;
                payment.signatureVerified = true;
                payment.refundStatus = "requested";
                await payment.save();
                try {
                    const refund = await razorpay.refundPayment(paymentId, payment.amountPaise);
                    payment.refundId = refund.id;
                    payment.refundStatus = refund.status || "created";
                    payment.status = refund.status === "processed" ? "refunded" : "refund_pending";
                    await payment.save();
                } catch (refundError) {
                    console.error("Payment refund request failed.");
                    payment.refundStatus = "manual_action_required";
                    await payment.save();
                }
                return res.status(409).json({
                    success: false,
                    message: "Payment was captured but the booking could not be confirmed. A refund is being processed.",
                    refundStatus: payment.refundStatus
                });
            }
            throw bookingError;
        } finally {
            await session.endSession();
        }

        await booking.populate({
            path: "ride", select: "pickup destination date time price status driver",
            populate: { path: "driver", select: "name" }
        });
        payment = await Payment.findById(payment._id);
        return res.json({ success: true, booking, payment: publicPayment(payment) });
    } catch (error) {
        console.error("Payment verification failed.");
        return res.status(safeErrorStatus(error)).json({ success: false, message: error.status === 503 ? error.message : "Unable to verify this payment" });
    }
};

function publicPayment(payment) {
    return {
        id: payment._id,
        booking: payment.booking,
        ride: payment.ride,
        seatsBooked: payment.seatsBooked,
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        provider: payment.provider,
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        signatureVerified: payment.signatureVerified,
        status: payment.status,
        refundId: payment.refundId,
        refundStatus: payment.refundStatus,
        createdAt: payment.createdAt
    };
}

exports.markFailed = async (req, res) => {
    const { orderId } = req.body || {};
    if (typeof orderId !== "string" || !orderId.trim() || orderId.length > 100) return res.status(400).json({ success: false, message: "A valid orderId is required" });
    try {
        const payment = await Payment.findOne({ orderId, user: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Payment order not found" });
        if (["paid", "captured", "refunded", "refund_pending"].includes(payment.status)) {
            return res.status(409).json({ success: false, message: "This payment has already been processed" });
        }
        payment.status = "failed";
        await payment.save();
        return res.json({ success: true, payment: publicPayment(payment) });
    } catch (_error) {
        return res.status(500).json({ success: false, message: "Unable to update payment status" });
    }
};

exports.cancelOrder = async (req, res) => {
    const { orderId } = req.body || {};
    if (typeof orderId !== "string" || !orderId.trim() || orderId.length > 100) return res.status(400).json({ success: false, message: "A valid orderId is required" });
    try {
        const payment = await Payment.findOne({ orderId, user: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Payment order not found" });
        if (["paid", "captured", "refunded", "refund_pending"].includes(payment.status)) {
            return res.status(409).json({ success: false, message: "This payment has already been processed" });
        }
        payment.status = "cancelled";
        await payment.save();
        return res.json({ success: true, payment: publicPayment(payment) });
    } catch (_error) {
        return res.status(500).json({ success: false, message: "Unable to cancel payment order" });
    }
};

exports.getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ user: req.user._id })
            .populate("ride", "pickup destination date time price comparableFare discountPercentage")
            .sort({ createdAt: -1 })
            .lean();
        return res.json({
            success: true,
            count: payments.length,
            payments: payments.map((payment) => ({
                id: payment._id,
                booking: payment.booking,
                ride: payment.ride,
                seatsBooked: payment.seatsBooked,
                amountPaise: payment.amountPaise,
                currency: payment.currency,
                provider: payment.provider,
                orderId: payment.orderId,
                paymentId: payment.paymentId,
                signatureVerified: payment.signatureVerified,
                status: payment.status,
                refundId: payment.refundId,
                refundStatus: payment.refundStatus,
                createdAt: payment.createdAt
            }))
        });
    } catch (_error) {
        return res.status(500).json({ success: false, message: "Unable to retrieve your payments" });
    }
};
