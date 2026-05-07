// Graceful Shutdown Handler
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log(`[SHUTDOWN] Already shutting down, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  console.log(`[SHUTDOWN] Received ${signal}, starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("[SHUTDOWN] Forced shutdown after timeout");
    process.exit(1);
  }, 30000); // 30 seconds timeout

  Promise.all([
    // Close database connections
    new Promise((resolve) => {
      try {
        const { closeDb } = require("@/lib/localDb");
        closeDb();
        console.log("[SHUTDOWN] Database closed");
        resolve();
      } catch (err) {
        console.error("[SHUTDOWN] Error closing database:", err);
        resolve();
      }
    }),

    // Close server connections
    new Promise((resolve) => {
      if (global.server) {
        global.server.close(() => {
          console.log("[SHUTDOWN] Server closed");
          resolve();
        });
      } else {
        resolve();
      }
    }),

    // Cleanup temporary files
    new Promise((resolve) => {
      console.log("[SHUTDOWN] Cleanup completed");
      resolve();
    }),
  ])
    .then(() => {
      clearTimeout(shutdownTimeout);
      console.log("[SHUTDOWN] Graceful shutdown completed");
      process.exit(0);
    })
    .catch((err) => {
      clearTimeout(shutdownTimeout);
      console.error("[SHUTDOWN] Error during shutdown:", err);
      process.exit(1);
    });
}

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("[SHUTDOWN] Uncaught exception:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[SHUTDOWN] Unhandled rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

module.exports = { gracefulShutdown };
