
import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/database.js";

process.env.MONGODB_URI ||= "mongodb://localhost:27017/supplylink";
process.env.JWT_SECRET ||= "supplylink-dev-secret-change-me";
process.env.PORT ||= "5000";
process.env.CLIENT_URL ||= "http://localhost:5173";

const PORT = Number(process.env.PORT || 5000);

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Supply Link API listening on port ${PORT}`);
    });

    const shutdown = () => {
      server.close(() => {
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
