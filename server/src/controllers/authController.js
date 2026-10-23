
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { createEmailVerificationToken, hashEmailVerificationToken, isEmailVerificationToken } from "../utils/emailVerification.js";
import { sendVerificationEmail } from "../services/emailService.js";
import User from "../models/User.js";
import AuthSession from "../models/AuthSession.js";

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "Enter a name, valid email, and password of at least 8 characters"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_BASE_URL) {
      return res.status(503).json({
        message: "Email verification is not configured yet. Please try again later.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const verificationToken = createEmailVerificationToken();
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationTokenHash: hashEmailVerificationToken(verificationToken),
      emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const emailResult = await sendVerificationEmail({ to: normalizedEmail, token: verificationToken });
    if (emailResult.status !== "accepted") {
      await User.deleteOne({ _id: user._id, emailVerified: false });
      return res.status(503).json({
        message: "We could not send the verification email. Check the email service settings and try again.",
      });
    }

    return res.status(201).json({
      success: true,
      verificationRequired: true,
      message: "We sent a verification link to your email. Verify it before signing in.",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists"
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Unable to register account"
    });
  }
};

export const verifyEmail = async (req, res) => {
  const token = req.body?.token;
  if (!isEmailVerificationToken(token)) {
    return res.status(400).json({ success: false, message: "This verification link is invalid or expired." });
  }

  try {
    const user = await User.findOne({
      emailVerificationTokenHash: hashEmailVerificationToken(token),
      emailVerificationExpiresAt: { $gt: new Date() },
      emailVerified: false,
    }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

    if (!user) {
      return res.status(400).json({ success: false, message: "This verification link is invalid or expired." });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();

    return res.status(200).json({ success: true, message: "Your email is verified. You can sign in now." });
  } catch (error) {
    console.error("Verify email error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to verify this email right now." });
  }
};

export const resendVerificationEmail = async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Enter the email address used to create your account." });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_BASE_URL) {
    return res.status(503).json({ success: false, message: "Email verification is not configured yet. Please try again later." });
  }

  try {
    const user = await User.findOne({ email }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");
    if (!user || user.emailVerified !== false) {
      return res.status(200).json({ success: true, message: "If this account needs verification, a new link will be sent to its email address." });
    }

    const verificationToken = createEmailVerificationToken();
    const emailResult = await sendVerificationEmail({ to: email, token: verificationToken });
    if (emailResult.status !== "accepted") {
      return res.status(503).json({ success: false, message: "We could not send the verification email. Please try again later." });
    }

    user.emailVerificationTokenHash = hashEmailVerificationToken(verificationToken);
    user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    return res.status(200).json({ success: true, message: "If this account needs verification, a new link will be sent to its email address." });
  } catch (error) {
    console.error("Resend verification error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to resend the verification email right now." });
  }
};


export const login = async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "Verify your email using the link we sent before signing in.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
        emailVerified: true,
        jti: sessionId,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
      }
    );
    const decodedToken = jwt.decode(token);
    await AuthSession.create({
      sessionId,
      userId: user._id,
      expiresAt: new Date(decodedToken.exp * 1000),
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Unable to log in"
    });
  }
};

export const logout = async (req, res) => {
  try {
    await AuthSession.deleteOne({ sessionId: req.user.sessionId, userId: req.user.userId });
    return res.status(200).json({ success: true, message: "Session revoked." });
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to revoke this session." });
  }
};


export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Get profile error:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve profile"
    });
  }
};
