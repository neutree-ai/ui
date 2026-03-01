import type { PostgrestError } from "@supabase/postgrest-js";
import { describe, expect, it } from "vitest";
import { handleError } from "./handle-error";

describe("handleError", () => {
  it("rejects with message and statusCode", async () => {
    const error: PostgrestError = {
      name: "PostgrestError",
      message: "Not found",
      code: "404",
      details: "",
      hint: "",
    };
    await expect(handleError(error)).rejects.toMatchObject({
      message: "Not found",
      statusCode: 404,
    });
  });

  it("appends hint to message when present", async () => {
    const error: PostgrestError = {
      name: "PostgrestError",
      message: "Failed",
      code: "400",
      details: "",
      hint: "check input",
    };
    await expect(handleError(error)).rejects.toMatchObject({
      message: "Failed: check input",
    });
  });

  it("handles non-numeric code", async () => {
    const error: PostgrestError = {
      name: "PostgrestError",
      message: "Error",
      code: "PGRST",
      details: "",
      hint: "",
    };
    await expect(handleError(error)).rejects.toMatchObject({
      statusCode: Number.NaN,
    });
  });

  it("handles AuthError without hint", async () => {
    const error = { message: "Auth error", code: "", status: 401 };
    await expect(
      handleError(error as unknown as PostgrestError),
    ).rejects.toMatchObject({
      message: "Auth error",
    });
  });
});
