// Test-only bridge: invoke installed production handlers inside the child.
// Windows child.kill() forcibly terminates; it cannot test graceful Ctrl+C.
process.once("message", (message) => {
  if (message?.testSignal !== "SIGTERM" && message?.testSignal !== "SIGINT")
    return;
  if (!process.listenerCount(message.testSignal))
    throw new Error("Shutdown handler was not installed");
  process.emit(message.testSignal);
  process.disconnect();
});
// Do not keep failed startup alive merely because the test IPC channel exists.
process.channel?.unref();
