import mongoose from "mongoose";
import { env } from "./env";
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      autoIndex: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: unknown) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

export default connectDB;
