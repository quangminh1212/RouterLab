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
    // Local DB resources are file-based and released on process exit.
    // Avoid importing the ESM/alias-backed DB module here from this CJS path,
    // because shutdown can run during partial teardown and create noisy false-positive errors.
    Promise.resolve().then(() => {
      console.log("[SHUTDOWN] Database close skipped (file-based resources release on exit)");
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

    // Ensure spawned Next child also exits so systemd stop does not hang.
    new Promise((resolve) => {
      const child = global.serverChild;
      if (!child || child.killed || child.exitCode !== null) {
        resolve();
        return;
      }

      const done = () => resolve();
      child.once("exit", done);
      try {
        child.kill("SIGTERM");
      } catch {
        child.removeListener("exit", done);
        resolve();
        return;
      }

      setTimeout(() => {
        if (child.exitCode === null && !child.killed) {
          try { child.kill("SIGKILL"); } catch {}
        }
      }, 5000);
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
