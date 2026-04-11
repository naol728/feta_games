import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  // Telegram Identity
  telegramId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  username: {
    type: String,
    default: null,
  },

  firstName: {
    type: String,
    required: true,
  },

  lastName: {
    type: String,
    default: null,
  },

  avatar: {
    type: String,
    default: null,
  },

  // Wallet
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },

  lockedBalance: {
    type: Number,
    default: 0,
    min: 0,
  },

  // Status
  online: {
    type: Boolean,
    default: false,
  },

  socketId: {
    type: String,
    default: null,
  },

  // Player Stats
  totalGames: {
    type: Number,
    default: 0,
  },

  totalWins: {
    type: Number,
    default: 0,
  },

  totalLosses: {
    type: Number,
    default: 0,
  },

  // Safety & Control
  isBanned: {
    type: Boolean,
    default: false,
  },

  banReason: {
    type: String,
    default: null,
  },

  // Audit
  createdAt: {
    type: Date,
    default: Date.now,
  },

  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.index({ telegramId: 1 });
UserSchema.index({ balance: 1 });

export default mongoose.model("User", UserSchema);
