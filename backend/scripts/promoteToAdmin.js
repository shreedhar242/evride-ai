const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const User = require("../models/User");

async function promoteToAdmin() {
    const email = process.argv[2];
    if (!email || !email.includes("@")) {
        console.error("Usage: node scripts/promoteToAdmin.js user@example.com");
        process.exitCode = 1;
        return;
    }
    if (!process.env.MONGO_URI) {
        console.error("MONGO_URI is not configured");
        process.exitCode = 1;
        return;
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            console.error("User not found");
            process.exitCode = 1;
            return;
        }
        user.role = "admin";
        await user.save();
        console.log("User promoted successfully. Role: admin");
    } catch (_error) {
        console.error("Unable to promote user");
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

promoteToAdmin();
