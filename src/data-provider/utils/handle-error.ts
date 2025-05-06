import type { HttpError } from "@refinedev/core";
import type { AuthError } from "@supabase/auth-js";
import type { PostgrestError } from "@supabase/postgrest-js";

export const handleError = (error: PostgrestError | AuthError) => {
	const customError: HttpError = {
		...error,
		message: error.message,
		statusCode: Number.parseInt(error.code || ""),
	};
	return Promise.reject(customError);
};
