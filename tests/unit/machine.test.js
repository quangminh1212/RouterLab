import { describe, it, expect, vi, afterEach } from "vitest";
import { getProviderMachineId } from "@/shared/utils/machineId";

describe("getProviderMachineId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ưu tiên machineId từ providerSpecificData", () => {
    vi.stubEnv("XLABROUTER_MACHINE_ID", "env-machine-id");

    expect(getProviderMachineId({ machineId: "provider-machine-id" })).toBe("provider-machine-id");
  });

  it("fallback sang env khi providerSpecificData không có machineId", () => {
    vi.stubEnv("XLABROUTER_MACHINE_ID", "env-machine-id");

    expect(getProviderMachineId({})).toBe("env-machine-id");
  });

  it("fallback sang default khi không có cấu hình nào", () => {
    vi.stubEnv("XLABROUTER_MACHINE_ID", "");

    expect(getProviderMachineId(null)).toBe("D2B607D9-D9A2-447D-9F87-E3E0BE2C7C3D");
  });
});