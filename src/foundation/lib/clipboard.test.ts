import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockWriteText, mockSuccess, mockError } = vi.hoisted(() => ({
  mockWriteText: vi.fn(),
  mockSuccess: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock("clipboard-polyfill", () => ({ writeText: mockWriteText }));
vi.mock("sonner", () => ({
  toast: { success: mockSuccess, error: mockError },
}));

import { copyToClipboard } from "./clipboard";

describe("copyToClipboard", () => {
  beforeEach(() => vi.clearAllMocks());

  const options = {
    successMessage: "Copied!",
    errorMessage: "Failed!",
  };

  it("returns true and shows success toast on success", async () => {
    mockWriteText.mockResolvedValueOnce(undefined);

    const result = await copyToClipboard("hello", options);

    expect(result).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith("hello");
    expect(mockSuccess).toHaveBeenCalledWith("Copied!", {
      description: undefined,
    });
  });

  it("passes successDescription to toast", async () => {
    mockWriteText.mockResolvedValueOnce(undefined);

    await copyToClipboard("hello", {
      ...options,
      successDescription: "Details",
    });

    expect(mockSuccess).toHaveBeenCalledWith("Copied!", {
      description: "Details",
    });
  });

  it("returns false and shows error toast on failure", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("denied"));

    const result = await copyToClipboard("hello", options);

    expect(result).toBe(false);
    expect(mockError).toHaveBeenCalledWith("Failed!");
    expect(mockSuccess).not.toHaveBeenCalled();
  });
});
