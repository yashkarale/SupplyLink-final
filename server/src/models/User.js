
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 16,
    },
    emailVerified: {
      type: Boolean,
      // Legacy accounts remain usable; new registrations explicitly set false.
      default: true,
    },
    emailVerificationTokenHash: {
      type: String,
      default: null,
      select: false,
      index: true,
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["customer", "seller", "admin"],
      default: "seller"
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
