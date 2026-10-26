const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "admin-route-test-secret-only";

const User = require("../models/User");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Vehicle = require("../models/Vehicle");
const ChargingStation = require("../models/ChargingStation");

const adminId = new mongoose.Types.ObjectId();
const riderId = new mongoose.Types.ObjectId();
const driverId = new mongoose.Types.ObjectId();
const targetId = new mongoose.Types.ObjectId();
const users = new Map([
    [String(adminId), { _id: adminId, name: "Admin Test", email: "admin@test.invalid", role: "admin", isActive: true }],
    [String(riderId), { _id: riderId, name: "Rider Test", email: "rider@test.invalid", role: "rider", isActive: true }],
    [String(driverId), { _id: driverId, name: "Driver Test", email: "driver@test.invalid", role: "driver", isActive: true }],
    [String(targetId), { _id: targetId, name: "Target Test", email: "target@test.invalid", role: "rider", isActive: true }]
]);

function project(row, fields) {
    if (!fields || !row || typeof row !== "object") return row;
    const allowed = new Set(["_id", ...fields.split(/\s+/).filter(Boolean).filter((field) => !field.startsWith("-"))]);
    return Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key)));
}

function query(value) {
    let selection;
    const q = {
        select(fields) { selection = fields; return q; },
        sort() { return q; },
        populate() { return q; },
        then(resolve, reject) {
            const result = Array.isArray(value)
                ? value.map((row) => project(row, selection))
                : project(value, selection);
            return Promise.resolve(result).then(resolve, reject);
        }
    };
    return q;
}

User.findById = async (id) => users.get(String(id)) || null;
User.find = () => query([
    { ...users.get(String(adminId)), password: "must-not-appear" },
    users.get(String(riderId)),
    users.get(String(driverId)),
    users.get(String(targetId))
]);
User.countDocuments = async (filter = {}) => filter.role ? [...users.values()].filter((user) => user.role === filter.role).length : users.size;
User.exists = async () => null;
User.create = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data, createdAt: new Date() });
User.findOne = () => ({
    select: async () => ({
        ...users.get(String(riderId)),
        async comparePassword(candidate) { return candidate === "test-password"; }
    })
});
const userFindById = User.findById;
User.findById = async (id) => {
    const user = users.get(String(id));
    return user ? { ...user, async save() { users.set(String(this._id), this); return this; } } : null;
};

Ride.find = () => query([{ _id: new mongoose.Types.ObjectId(), pickup: "A", destination: "B", driver: { name: "Driver Test", email: "driver@test.invalid" }, status: "scheduled" }]);
Ride.countDocuments = async () => 1;
Booking.find = () => query([{ _id: new mongoose.Types.ObjectId(), status: "confirmed", passenger: { name: "Rider Test", email: "rider@test.invalid" } }]);
Booking.countDocuments = async () => 1;
Payment.find = () => query([{
    _id: new mongoose.Types.ObjectId(), amountPaise: 10000, currency: "INR", status: "captured",
    cardNumber: "must-not-appear", cvv: "must-not-appear", razorpaySecret: "must-not-appear", jwt: "must-not-appear"
}]);
Payment.countDocuments = async (filter = {}) => filter.status ? 1 : 2;
Vehicle.find = () => query([{ _id: new mongoose.Types.ObjectId(), make: "Example", model: "EV", owner: { name: "Driver Test", email: "driver@test.invalid" } }]);
ChargingStation.find = () => query([{ _id: new mongoose.Types.ObjectId(), name: "Station", status: "active", createdBy: { name: "Driver Test", email: "driver@test.invalid" } }]);
ChargingStation.countDocuments = async () => 1;

const app = express();
app.use(express.json());
app.use("/api/auth", require("../routes/authRoutes"));
app.use("/api/admin", require("../routes/adminRoutes"));
const server = app.listen(0, "127.0.0.1");
const serverReady = new Promise((resolve) => server.once("listening", resolve));
async function origin() {
    await serverReady;
    return `http://127.0.0.1:${server.address().port}`;
}
const tokenFor = (id) => jwt.sign({ id: String(id) }, process.env.JWT_SECRET);
const adminHeaders = { authorization: `Bearer ${tokenFor(adminId)}` };

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    User.findById = userFindById;
});

test("admin can access every admin collection and statistics", async () => {
    for (const path of ["stats", "users", "rides", "bookings", "payments", "vehicles", "charging-stations"]) {
        const response = await fetch(`${await origin()}/api/admin/${path}`, { headers: adminHeaders });
        assert.equal(response.status, 200, path);
    }
    const stats = await (await fetch(`${await origin()}/api/admin/stats`, { headers: adminHeaders })).json();
    assert.equal(stats.stats.totalUsers, 4);
    assert.equal(stats.stats.successfulPayments, 1);
});

test("admin collection responses omit credentials and secrets", async () => {
    const userResponse = await fetch(`${await origin()}/api/admin/users`, { headers: adminHeaders });
    const userBody = JSON.stringify(await userResponse.json());
    assert.doesNotMatch(userBody, /must-not-appear|password|jwt/i);
    const paymentResponse = await fetch(`${await origin()}/api/admin/payments`, { headers: adminHeaders });
    const paymentBody = JSON.stringify(await paymentResponse.json());
    assert.doesNotMatch(paymentBody, /must-not-appear|razorpaySecret|cardNumber|cvv|jwt/i);
});

test("riders, drivers, and unauthenticated requests cannot access admin routes", async () => {
    assert.equal((await fetch(`${await origin()}/api/admin/stats`)).status, 401);
    for (const id of [riderId, driverId]) {
        assert.equal((await fetch(`${await origin()}/api/admin/stats`, { headers: { authorization: `Bearer ${tokenFor(id)}` } })).status, 403);
    }
});

test("public registration ignores a requested admin role", async () => {
    const response = await fetch(`${await origin()}/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Public Test", email: "public@test.invalid", password: "password123", role: "admin" })
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.user.role, "rider");
    assert.equal("password" in body.user, false);
});

test("login issues a usable expiring JWT for an active user", async () => {
    const response = await fetch(`${await origin()}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "rider@test.invalid", password: "test-password" })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.user.role, "rider");
    assert.equal("password" in body.user, false);
    const tokenPayload = jwt.verify(body.token, process.env.JWT_SECRET);
    assert.equal(typeof tokenPayload.exp, "number");
    const me = await fetch(`${await origin()}/api/auth/me`, { headers: { authorization: `Bearer ${body.token}` } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.email, "rider@test.invalid");
});

test("admin cannot deactivate self; admin can deactivate and reactivate a user", async () => {
    const ownResponse = await fetch(`${await origin()}/api/admin/users/${adminId}/status`, {
        method: "PATCH", headers: { ...adminHeaders, "content-type": "application/json" }, body: JSON.stringify({ isActive: false })
    });
    assert.equal(ownResponse.status, 400);
    const uppercaseSelfResponse = await fetch(`${await origin()}/api/admin/users/${String(adminId).toUpperCase()}/status`, {
        method: "PATCH", headers: { ...adminHeaders, "content-type": "application/json" }, body: JSON.stringify({ isActive: false })
    });
    assert.equal(uppercaseSelfResponse.status, 400);
    const invalidResponse = await fetch(`${await origin()}/api/admin/users/not-an-id/status`, {
        method: "PATCH", headers: { ...adminHeaders, "content-type": "application/json" }, body: JSON.stringify({ isActive: false })
    });
    assert.equal(invalidResponse.status, 400);
    const deactivate = await fetch(`${await origin()}/api/admin/users/${targetId}/status`, {
        method: "PATCH", headers: { ...adminHeaders, "content-type": "application/json" }, body: JSON.stringify({ isActive: false })
    });
    assert.equal(deactivate.status, 200);
    assert.equal((await deactivate.json()).user.isActive, false);
    assert.equal((await fetch(`${await origin()}/api/admin/stats`, { headers: { authorization: `Bearer ${tokenFor(targetId)}` } })).status, 403);
    const reactivate = await fetch(`${await origin()}/api/admin/users/${targetId}/status`, {
        method: "PATCH", headers: { ...adminHeaders, "content-type": "application/json" }, body: JSON.stringify({ isActive: true })
    });
    assert.equal(reactivate.status, 200);
    assert.equal((await reactivate.json()).user.isActive, true);
});
