const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters"],
        select: false
    },
    phone: {
        type: String,
        trim: true,
        default: ""
    },
    role: {
        type: String,
        enum: ["rider", "driver", "admin"],
        default: "rider"
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
        transform(_doc, result) {
            delete result.password;
            delete result.__v;
            return result;
        }
    }
});

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
