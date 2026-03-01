import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let mockValue: { head_ip: string; worker_ips: string[] } = {
  head_ip: "",
  worker_ips: [],
};
const mockOnChange = vi.fn((val: typeof mockValue) => {
  mockValue = val;
});
let mockFormError: { message?: string } | undefined = undefined;
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
  // biome-ignore lint/suspicious/noExplicitAny: mock control/name for testing
  return renderHook(() => useNodeIps({ control: {} as any, name: "p" as any }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValue = { head_ip: "", worker_ips: [] };
  mockFormError = undefined;
  mockIsSubmitted = false;
});

describe("useNodeIps", () => {
  describe("initialization", () => {
    it("starts with empty state", async () => {
      const { result } = await setup();
      expect(result.current.headIp).toBe("");
      expect(result.current.workerIps).toEqual([]);
      expect(result.current.newWorkerIp).toBe("");
      expect(result.current.workerCount).toBe(0);
      expect(result.current.canAddWorkerIp).toBe(false);
    });

    it("initializes from form value", async () => {
      const { result } = await setup({
        head_ip: "10.0.0.1",
        worker_ips: ["10.0.0.2", "10.0.0.3"],
      });
      expect(result.current.headIp).toBe("10.0.0.1");
      expect(result.current.workerIps).toEqual(["10.0.0.2", "10.0.0.3"]);
      expect(result.current.workerCount).toBe(2);
    });
  });

  describe("handleHeadIpChange", () => {
    it("updates headIp and clears error for valid IP", async () => {
      const { result } = await setup();
      act(() => result.current.handleHeadIpChange(makeChangeEvent("10.0.0.1")));
      expect(result.current.headIp).toBe("10.0.0.1");
      expect(result.current.headIpError).toBe("");
    });

    it("sets error for invalid IP", async () => {
      const { result } = await setup();
      act(() => result.current.handleHeadIpChange(makeChangeEvent("999.999")));
      expect(result.current.headIpError).toBe(
        "clusters.validation.invalidIPAddress",
      );
    });

    it("sets error for empty IP (required)", async () => {
      const { result } = await setup();
      act(() => result.current.handleHeadIpChange(makeChangeEvent("")));
      expect(result.current.headIpError).toBe("clusters.validation.ipRequired");
    });
  });

  describe("handleNewWorkerIpChange", () => {
    it("updates newWorkerIp for valid IP", async () => {
      const { result } = await setup({
        head_ip: "10.0.0.1",
        worker_ips: [],
      });
      act(() =>
        result.current.handleNewWorkerIpChange(makeChangeEvent("10.0.0.2")),
      );
      expect(result.current.newWorkerIp).toBe("10.0.0.2");
      expect(result.current.newWorkerIpError).toBe("");
      expect(result.current.canAddWorkerIp).toBe(true);
    });

    it("sets error for invalid IP", async () => {
      const { result } = await setup();
      act(() => result.current.handleNewWorkerIpChange(makeChangeEvent("abc")));
      expect(result.current.newWorkerIpError).toBe(
        "clusters.validation.invalidIPAddress",
      );
      expect(result.current.canAddWorkerIp).toBe(false);
    });

    it("sets error for duplicate IP (matches head)", async () => {
      const { result } = await setup({
        head_ip: "10.0.0.1",
        worker_ips: [],
      });
      act(() =>
        result.current.handleNewWorkerIpChange(makeChangeEvent("10.0.0.1")),
      );
      expect(result.current.newWorkerIpError).toBe(
        "clusters.validation.ipDuplicated",
      );
    });

    it("allows empty input without error (not required)", async () => {
      const { result } = await setup();
      act(() => result.current.handleNewWorkerIpChange(makeChangeEvent("")));
      expect(result.current.newWorkerIpError).toBe("");
      expect(result.current.canAddWorkerIp).toBe(false);
    });
  });

  describe("addWorkerIp", () => {
    it("adds valid IP to worker list and clears input", async () => {
      const { result } = await setup({
        head_ip: "10.0.0.1",
        worker_ips: [],
      });
      act(() =>
        result.current.handleNewWorkerIpChange(makeChangeEvent("10.0.0.2")),
      );
      act(() => result.current.addWorkerIp());
      expect(result.current.workerIps).toEqual(["10.0.0.2"]);
      expect(result.current.newWorkerIp).toBe("");
      expect(result.current.workerCount).toBe(1);
    });

    it("does nothing when input is empty", async () => {
      const { result } = await setup();
      act(() => result.current.addWorkerIp());
      expect(result.current.workerIps).toEqual([]);
    });

    it("does nothing when there is a validation error", async () => {
      const { result } = await setup();
      act(() =>
        result.current.handleNewWorkerIpChange(makeChangeEvent("invalid")),
      );
      act(() => result.current.addWorkerIp());
      expect(result.current.workerIps).toEqual([]);
    });
  });

  describe("removeWorkerIp", () => {
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
  });

  describe("handleNewWorkerIpKeyDown", () => {
    it("adds worker on Enter key", async () => {
      const { result } = await setup({
        head_ip: "10.0.0.1",
        worker_ips: [],
      });
      act(() =>
        result.current.handleNewWorkerIpChange(makeChangeEvent("10.0.0.2")),
      );
      const { event } = makeKeyEvent("Enter");
      act(() => result.current.handleNewWorkerIpKeyDown(event));
      expect(result.current.workerIps).toEqual(["10.0.0.2"]);
    });

    it("ignores non-Enter keys", async () => {
      const { result } = await setup({
        head_ip: "10.0.0.1",
        worker_ips: [],
      });
      act(() =>
        result.current.handleNewWorkerIpChange(makeChangeEvent("10.0.0.2")),
      );
      const { event, prevented } = makeKeyEvent("Tab");
      act(() => result.current.handleNewWorkerIpKeyDown(event));
      expect(result.current.workerIps).toEqual([]);
      expect(prevented.current).toBe(false);
    });
  });

  describe("headIpError", () => {
    it("shows form error after submission when no internal error", async () => {
      mockFormError = { message: "server error" };
      mockIsSubmitted = true;
      const { result } = await setup();
      expect(result.current.headIpError).toBe("server error");
    });

    it("does not show form error before submission", async () => {
      mockFormError = { message: "server error" };
      mockIsSubmitted = false;
      const { result } = await setup();
      expect(result.current.headIpError).toBe("");
    });

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

  describe("form sync", () => {
    it("calls onChange when headIp changes", async () => {
      const { result } = await setup();
      act(() => result.current.handleHeadIpChange(makeChangeEvent("10.0.0.1")));
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ head_ip: "10.0.0.1" }),
      );
    });

    it("calls onChange when workerIps change", async () => {
      const { result } = await setup({
        head_ip: "10.0.0.1",
        worker_ips: [],
      });
      act(() =>
        result.current.handleNewWorkerIpChange(makeChangeEvent("10.0.0.2")),
      );
      act(() => result.current.addWorkerIp());
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ worker_ips: ["10.0.0.2"] }),
      );
    });
  });
});
