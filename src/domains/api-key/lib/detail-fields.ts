import type { ApiKey } from "@/domains/api-key/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";

const description: DetailField<ApiKey> = field(
  "api_keys.fields.description",
  (key) => key.spec.description,
);

export const apiKeyHeaderFields = (key: ApiKey): DetailField<ApiKey>[] => [
  field("common.fields.workspace", (current) => current.metadata.workspace),
  ...(key.spec.description ? [description] : []),
  field("api_keys.fields.usage", (current) => current.status?.usage),
];
