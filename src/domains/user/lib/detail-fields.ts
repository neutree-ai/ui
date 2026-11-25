import type { UserProfile } from "@/domains/user/types";
import {
  profileEmail,
  profileIdentitySourceName,
} from "@/foundation/role/user-identity";
import { type DetailField, field } from "@/foundation/scene/detail-field";

export const userHeaderFields: DetailField<UserProfile>[] = [
  field("common.fields.name", (user) => user.metadata.name),
  field("common.fields.email", (user) => profileEmail(user)),
  field(
    "user_profiles.fields.identitySource",
    (user, t) =>
      profileIdentitySourceName(user.metadata) ||
      t("user_profiles.values.local"),
  ),
];
