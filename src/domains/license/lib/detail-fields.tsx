import type { TFunction } from "i18next";
import { LicenseSerial } from "@/domains/license/components/LicenseSerial";
import Timestamp, { formatTimestamp } from "@/foundation/role/Timestamp";
import { type DetailField, field } from "@/foundation/scene/detail-field";
import { type LicenseStatus, MAX_UNLIMITED } from "@/foundation/types/license";

type LicenseInfo = LicenseStatus["info"];
type LicenseUsage = NonNullable<LicenseStatus["usage"]>;

const DAY_SECONDS = 60 * 60 * 24;
const DATE_FORMAT = "YYYY-MM-DD";

const limit = (value: number, t: TFunction) =>
  value === MAX_UNLIMITED ? t("license.unlimited") : value;

const days = (count: number, t: TFunction) =>
  `${count} ${t("license.fields.days")}`;

/** Whole days until the license ends, counting a started day; 0 once expired. */
export const remainingDays = (info: LicenseInfo, nowMs = Date.now()) =>
  Math.max(
    0,
    Math.ceil(
      (info.sign_date + info.period - Math.floor(nowMs / 1000)) / DAY_SECONDS,
    ),
  );

const expiration = (info: LicenseInfo, t: TFunction) =>
  `${formatTimestamp(info.sign_date + info.period, DATE_FORMAT)} (${days(remainingDays(info), t)})`;

export const licenseInfoFields: DetailField<LicenseInfo>[] = [
  field("license.fields.edition", (info, t) =>
    t(`license.edition.${info.edition.toLowerCase()}`),
  ),
  field("license.fields.vendor", (info) => info.vendor),
  field("license.fields.licenseType", (info, t) =>
    t(`license.licenseType.${info.license_type.toLowerCase()}`),
  ),
  field("license.fields.signDate", {
    render: (info) => (
      <Timestamp timestamp={info.sign_date} format={DATE_FORMAT} />
    ),
  }),
  field("license.fields.period", (info, t) =>
    info.period === MAX_UNLIMITED
      ? t("license.permanent")
      : days(Math.floor(info.period / DAY_SECONDS), t),
  ),
  field("license.fields.expirationDate", (info, t) =>
    info.period === MAX_UNLIMITED
      ? t("license.permanent")
      : expiration(info, t),
  ),
  field("license.fields.maxGpus", (info, t) => limit(info.max_gpus, t)),
  field("license.fields.serial", {
    render: (info) => <LicenseSerial serial={info.serial} />,
  }),
];

const usage = (type: keyof LicenseUsage) => (all: LicenseUsage, t: TFunction) =>
  `${all[type]?.used ?? 0} / ${limit(all[type]?.limit ?? 0, t)}`;

/** One field per resource type the license reports usage for. */
export const licenseUsageFields = (
  reported: LicenseUsage,
): DetailField<LicenseUsage>[] => [
  ...(reported.GPU ? [field("common.fields.gpu", usage("GPU"))] : []),
  ...(reported.Workspace
    ? [field("common.fields.workspace", usage("Workspace"))]
    : []),
];
