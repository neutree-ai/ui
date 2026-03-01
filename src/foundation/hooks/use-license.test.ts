import type { License } from "@/foundation/types/license";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Module mocks ---

const mockRefetch = vi.fn();
const mockMutate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

let mockLicenseData: { data: License } | undefined = undefined;
let mockIsLoading = false;
let mockError: { statusCode?: number; message?: string } | null = null;

vi.mock("@refinedev/core", () => ({
  useCustom: () => ({
    data: mockLicenseData,
    refetch: mockRefetch,
    isLoading: mockIsLoading,
    error: mockError,
  }),
  useCustomMutation: () => ({
    mutate: mockMutate,
    isLoading: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

// --- Helpers ---

function makeLicense(workspaceLimit?: number): { data: License } {
  return {
    data: {
      id: 1,
      api_version: "v1",
      kind: "License",
      metadata: {
        name: "default",
        workspace: "",
        creation_timestamp: "",
        update_timestamp: "",
        deletion_timestamp: null,
        labels: {},
        annotations: {},
      },
      spec: { code: "test-code" },
      status: {
        last_transition_time: "2024-01-01T00:00:00Z",
        phase: "Active",
        info: {
          edition: "enterprise",
          vendor: "neutree",
          sign_date: 0,
          license_type: "subscription",
          period: -1,
          max_gpus: -1,
          serial: "abc",
        },
        usage:
          workspaceLimit !== undefined
            ? { Workspace: { used: 1, limit: workspaceLimit } }
            : undefined,
      },
    },
  };
}

async function licenseHook() {
  const { useLicense } = await import("./use-license");
  return renderHook(() => useLicense());
}

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();
  mockLicenseData = undefined;
  mockIsLoading = false;
  mockError = null;
});

// --- Tests ---

describe("useLicense", () => {
  describe("supportMultiWorkspace", () => {
    it("returns false when license data is undefined", async () => {
      const { result } = await licenseHook();

      expect(result.current.supportMultiWorkspace).toBe(false);
    });

    it("returns false when Workspace usage is not present", async () => {
      mockLicenseData = makeLicense();
      const { result } = await licenseHook();

      expect(result.current.supportMultiWorkspace).toBe(false);
    });

    it("returns false when workspace limit is 1", async () => {
      mockLicenseData = makeLicense(1);
      const { result } = await licenseHook();

      expect(result.current.supportMultiWorkspace).toBe(false);
    });

    it("returns true when workspace limit is greater than 1", async () => {
      mockLicenseData = makeLicense(5);
      const { result } = await licenseHook();

      expect(result.current.supportMultiWorkspace).toBe(true);
    });

    it("returns true when workspace limit is MAX_UNLIMITED (-1)", async () => {
      mockLicenseData = makeLicense(-1);
      const { result } = await licenseHook();

      expect(result.current.supportMultiWorkspace).toBe(true);
    });
  });

  describe("licenseNotAvailable", () => {
    it("returns true when error statusCode is 404", async () => {
      mockError = { statusCode: 404 };
      const { result } = await licenseHook();

      expect(result.current.licenseNotAvailable).toBe(true);
    });

    it("returns false when no error", async () => {
      const { result } = await licenseHook();

      expect(result.current.licenseNotAvailable).toBe(false);
    });

    it("returns false for non-404 errors", async () => {
      mockError = { statusCode: 500 };
      const { result } = await licenseHook();

      expect(result.current.licenseNotAvailable).toBe(false);
    });
  });

  describe("updateLicense", () => {
    it("shows error toast for empty code", async () => {
      const { result } = await licenseHook();

      result.current.updateLicense("  ");

      expect(mockToastError).toHaveBeenCalledWith("license.errors.emptyCode");
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it("calls mutate with correct arguments", async () => {
      const { result } = await licenseHook();

      result.current.updateLicense("new-license-code");

      expect(mockMutate).toHaveBeenCalledWith(
        {
          url: "/license",
          method: "PATCH",
          values: { code: "new-license-code" },
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });

    it("shows success toast and refetches on success", async () => {
      const onSuccess = vi.fn();
      const { result } = await licenseHook();

      result.current.updateLicense("code", { onSuccess });

      // Invoke the onSuccess callback
      const mutateCall = mockMutate.mock.calls[0];
      const callbacks = mutateCall[1];
      callbacks.onSuccess();

      expect(mockToastSuccess).toHaveBeenCalledWith("license.success.updated");
      expect(mockRefetch).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });

    it("shows error toast on mutation error", async () => {
      const onError = vi.fn();
      const { result } = await licenseHook();

      result.current.updateLicense("code", { onError });

      // Invoke the onError callback
      const mutateCall = mockMutate.mock.calls[0];
      const callbacks = mutateCall[1];
      callbacks.onError({ message: "invalid license" });

      expect(mockToastError).toHaveBeenCalledWith("invalid license");
      expect(onError).toHaveBeenCalledWith({ message: "invalid license" });
    });

    it("falls back to i18n key when error has no message", async () => {
      const { result } = await licenseHook();

      result.current.updateLicense("code");

      const callbacks = mockMutate.mock.calls[0][1];
      callbacks.onError({});

      expect(mockToastError).toHaveBeenCalledWith(
        "license.errors.updateFailed",
      );
    });
  });
});
