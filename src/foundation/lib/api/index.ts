import { PostgrestClient } from "@supabase/postgrest-js";
import type { Database } from "./api-gen";

export const REST_URL = `${location.protocol}//${location.host}/api/v1`;

export const clientPostgrest = new PostgrestClient<Database, "api">(REST_URL, {
  schema: "api",
  headers: {},
});
