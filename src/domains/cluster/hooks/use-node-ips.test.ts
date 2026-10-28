import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockValue: { head_ip: string; worker_ips: string[] } = {
  head_ip: "",
  worker_ips: [],
};
const mockOnChange = vi.fn((val: typeof mockValue) => {
  mockValue = val;
});
let mockFormError: { message?: string } | undefined;
let mockIsSubmitted = false;

vi.mock("react-hook-form", async () => {
  const actual = await vi.importActual("react-hook-form");
  return {
    ...actual,
    useController: () => ({
      field: { value: mockValue, onChange: mockOnChange },
      fieldState: { error: mockFormError },
    }),
    useFormState: () => ({ isSubmitted: mockIsSubmitted }),
  };
});

const makeChangeEvent = (value: string) =>
  ({ target: { value } }) as React.ChangeEvent<HTMLInputElement>;

const makeKeyEvent = (key: string) => {
  const prevented = { current: false };
  return {
    event: {
      key,
      preventDefault: () => {
        prevented.current = true;
      },
    } as unknown as React.KeyboardEvent<HTMLInputElement>,
    prevented,
  };
};

async function setup(initial?: typeof mockValue) {
  if (initial) mockValue = initial;
  const { useNodeIps } = await import("./use-node-ips");
  return renderHook(() => useNodeIps({ control: {} as any, name: "p" as any }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValue = { head_ip: "", worker_ips: [] };
  mockFormError = undefined;
  mockIsSubmitted = false;
});

describe("useNodeIps", () => {
  it("initializes from form value", async () => {
    const { result } = await setup({
      head_ip: "10.0.0.1",
      worker_ips: ["10.0.0.2", "10.0.0.3"],
    });
    expect(result.current.headIp).toBe("10.0.0.1");
    expect(result.current.workerIps).toEqual(["10.0.0.2", "10.0.0.3"]);
    expect(result.current.workerCount).toBe(2);
  });

  it.each([
    { ip: "10.0.0.1", error: "" },
    { ip: "999.999", error: "clusters.validation.invalidIPAddress" },
    { ip: "", error: "clusters.validation.ipRequired" },
  ])("head IP '$ip' -> error '$error'", async ({ ip, error }) => {
    const { result } = await setup();
    act(() => result.current.handleHeadIpChange(makeChangeEvent(ip)));
    expect(mockValue.head_ip).toBe(ip);
    expect(result.current.headIp).toBe(ip);
    expect(result.current.headIpError).toBe(error);
  });

  it.each([
    { ip: "10.0.0.2", error: "", canAdd: true },
    {
      ip: "10.0.0.1",
      error: "clusters.validation.ipDuplicated",
      canAdd: false,
    },
    { ip: "", error: "", canAdd: false },
  ])(
    "new worker IP '$ip' -> error '$error', can add: $canAdd",
    async ({ ip, error, canAdd }) => {
      const { result } = await setup({ head_ip: "10.0.0.1", worker_ips: [] });
      act(() => result.current.handleNewWorkerIpChange(makeChangeEvent(ip)));
      expect(result.current.newWorkerIp).toBe(ip);
      expect(result.current.newWorkerIpError).toBe(error);
      expect(result.current.canAddWorkerIp).toBe(canAdd);
    },
  );

  it("adds valid IP to worker list and clears input", async () => {
    const { result } = await setup({ head_ip: "10.0.0.1", worker_ips: [] });
    act(() =>
      result.current.handleNewWorkerIpChange(makeChangeEvent("10.0.0.2")),
    );
    act(() => result.current.addWorkerIp());
    expect(mockValue.worker_ips).toEqual(["10.0.0.2"]);
    expect(result.current.workerIps).toEqual(["10.0.0.2"]);
    expect(result.current.newWorkerIp).toBe("");
    expect(result.current.workerCount).toBe(1);
  });

  it.each(["", "invalid"])("does not add worker input '%s'", async (ip) => {
    const { result } = await setup();
    act(() => result.current.handleNewWorkerIpChange(makeChangeEvent(ip)));
    act(() => result.current.addWorkerIp());
    expect(result.current.workerIps).toEqual([]);
  });

  it("removes IP from worker list", async () => {
    const { result } = await setup({
      head_ip: "10.0.0.1",
      worker_ips: ["10.0.0.2", "10.0.0.3"],
    });
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;
    act(() => result.current.removeWorkerIp("10.0.0.2")(event));
    expect(result.current.workerIps).toEqual(["10.0.0.3"]);
    expect(result.current.workerCount).toBe(1);
  });

  it.each([
    { key: "Enter", added: ["10.0.0.2"], prevented: true },
    { key: "Tab", added: [], prevented: false },
  ])(
    "$key in the worker input adds: $added",
    async ({ key, added, prevented }) => {
      const { result } = await setup({ head_ip: "10.0.0.1", worker_ips: [] });
      act(() =>
        result.current.handleNewWorkerIpChange(makeChangeEvent("10.0.0.2")),
      );
      const keyEvent = makeKeyEvent(key);
      act(() => result.current.handleNewWorkerIpKeyDown(keyEvent.event));
      expect(result.current.workerIps).toEqual(added);
      expect(keyEvent.prevented.current).toBe(prevented);
    },
  );

  describe("headIpError", () => {
    it.each([
      { submitted: true, error: "server error" },
      { submitted: false, error: "" },
    ])(
      "shows the form error when submitted: $submitted",
      async ({ submitted, error }) => {
        mockFormError = { message: "server error" };
        mockIsSubmitted = submitted;
        const { result } = await setup();
        expect(result.current.headIpError).toBe(error);
      },
    );

    it("prefers internal error over form error", async () => {
      mockFormError = { message: "server error" };
      mockIsSubmitted = true;
      const { result } = await setup();
      act(() => result.current.handleHeadIpChange(makeChangeEvent("bad")));
      expect(result.current.headIpError).toBe(
        "clusters.validation.invalidIPAddress",
      );
    });
  });
});
