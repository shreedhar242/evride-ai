// Configure DNS before Mongoose loads SRV connection handling for mongodb+srv URIs.
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Import Mongoose only after DNS and the environment are configured.
const mongoose = require("mongoose");
const User = require("../models/User");

async function promoteToDriver() {
    const email = process.argv[2];
    if (!email || !email.includes("@")) {
        console.error("Usage: node scripts/promoteToDriver.js <user-email>");
        process.exitCode = 1;
        return;
    }
    if (!process.env.MONGO_URI) {
        console.error("MONGO_URI is not configured in backend/.env");
        process.exitCode = 1;
        return;
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            console.error("No user was found for that email address");
            process.exitCode = 1;
            return;
        }
        if (user.role === "admin") {
            console.error("This script cannot change admin accounts");
            process.exitCode = 1;
            return;
        }

        user.role = "driver";
        await user.save();
        console.log(`Driver role assigned to ${user.email}`);
    } catch (error) {
        const code = error.code || error.cause?.code;
        console.error(`Unable to assign driver role${code ? ` (${code})` : ""}`);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

promoteToDriver();
