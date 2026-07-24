import { describe, it, expect, afterEach } from "vitest";
import net from "net";
import {
  startRedisUsageQueue,
  stopRedisUsageQueue,
  publishUsageEvent,
  getRedisUsageQueueStatus,
} from "../../open-sse/services/redisUsageQueue.js";

function onceData(socket, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout waiting for data")), timeoutMs);
    socket.once("data", (buf) => {
      clearTimeout(t);
      resolve(buf.toString("utf8"));
    });
  });
}

describe("redis RESP usage queue (CLIProxyAPI parity)", () => {
  afterEach(() => {
    stopRedisUsageQueue();
  });

  it("starts, answers PING, and delivers SUBSCRIBE usage", async () => {
    // pick an ephemeral port
    const port = 46379;
    await startRedisUsageQueue(port);
    expect(getRedisUsageQueueStatus().enabled).toBe(true);

    const socket = net.connect(port, "127.0.0.1");
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });

    socket.write("*1\r\n$4\r\nPING\r\n");
    const pong = await onceData(socket);
    expect(pong).toContain("PONG");

    socket.write("*2\r\n$9\r\nSUBSCRIBE\r\n$5\r\nusage\r\n");
    const subAck = await onceData(socket);
    expect(subAck.toLowerCase()).toContain("subscribe");

    publishUsageEvent({ model: "qwencoder/gpt-5.6-sol", tokens: 12 });
    const msg = await onceData(socket);
    expect(msg).toContain("message");
    expect(msg).toContain("qwencoder/gpt-5.6-sol");

    socket.end();
  }, 10000);
});
