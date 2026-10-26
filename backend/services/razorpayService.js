const crypto = require("crypto");

const RAZORPAY_API = "https://api.razorpay.com/v1";

function getTestCredentials() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        const error = new Error("Razorpay test credentials are not configured");
        error.status = 503;
        throw error;
    }
    // Do not allow this application to issue real payment orders.
    if (!keyId.startsWith("rzp_test_")) {
        const error = new Error("Razorpay Test Mode credentials are required");
        error.status = 503;
        throw error;
    }
    return { keyId, keySecret };
}

function authorizationHeader(keyId, keySecret) {
    return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

async function razorpayRequest(endpoint, { method = "GET", body } = {}) {
    const { keyId, keySecret } = getTestCredentials();
    const response = await fetch(`${RAZORPAY_API}${endpoint}`, {
        method,
        headers: {
            Authorization: authorizationHeader(keyId, keySecret),
            "Content-Type": "application/json"
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error("Razorpay could not process the test payment request");
        error.status = response.status >= 500 ? 502 : 400;
        error.providerStatus = response.status;
        error.providerCode = typeof result?.error?.code === "string" ? result.error.code : "UNKNOWN";
        error.providerDescription = typeof result?.error?.description === "string"
            ? result.error.description
            : "No provider description returned";
        throw error;
    }
    return result;
}

async function createOrder({ amountPaise, currency, receipt, notes }) {
    const order = await razorpayRequest("/orders", {
        method: "POST",
        body: { amount: amountPaise, currency, receipt, notes, partial_payment: false }
    });
    return order;
}

async function fetchPayment(paymentId) {
    return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
}

async function refundPayment(paymentId, amountPaise) {
    return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: "POST",
        body: { amount: amountPaise }
    });
}

function verifySignature(orderId, paymentId, suppliedSignature) {
    const { keySecret } = getTestCredentials();
    if (typeof suppliedSignature !== "string" || !/^[a-f0-9]{64}$/i.test(suppliedSignature)) return false;
    const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest();
    const supplied = Buffer.from(suppliedSignature, "hex");
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

module.exports = { getTestCredentials, createOrder, fetchPayment, refundPayment, verifySignature };
