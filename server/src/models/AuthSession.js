import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, maxlength: 100 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("AuthSession", authSessionSchema);
