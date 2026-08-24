import type { HttpError } from "@refinedev/core";
import type { AuthError } from "@supabase/auth-js";
import type { PostgrestError } from "@supabase/postgrest-js";

export const handleError = (error: PostgrestError | AuthError) => {
  let message = error.message;

  if ("hint" in error && error.hint) {
    message += `: ${error.hint}`;
  }

  // Reject with a real Error instance: catch blocks routinely narrow with
  // `error instanceof Error`, and a plain object falls through that check and
  // renders as "[object Object]".
  const customError: HttpError = Object.assign(new Error(message), error, {
    message,
    statusCode: Number.parseInt(error.code || "", 10),
  });
  return Promise.reject(customError);
};
