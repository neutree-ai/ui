import type { HttpError } from "@refinedev/core";
import type { AuthError } from "@supabase/auth-js";
import type { PostgrestError } from "@supabase/postgrest-js";

export const handleError = (error: PostgrestError | AuthError) => {
  let message = error.message;

  if ("hint" in error) {
    message += `: ${error.hint}`;
  }

  const customError: HttpError = {
    ...error,
    message,
    statusCode: Number.parseInt(error.code || ""),
  };
  return Promise.reject(customError);
};
