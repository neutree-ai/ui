import type { TFunction } from "i18next";
import { LicenseSerial } from "@/domains/license/components/LicenseSerial";
import Timestamp, { formatTimestamp } from "@/foundation/role/Timestamp";
import type { DetailField } from "@/foundation/scene/DetailFields";
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

export const licenseInfoFields: DetailField<LicenseInfo>[] = [
  {
    key: "edition",
    label: "license.fields.edition",
    value: (info, t) => t(`license.edition.${info.edition.toLowerCase()}`),
  },
  {
    key: "vendor",
    label: "license.fields.vendor",
    value: (info) => info.vendor,
  },
  {
    key: "licenseType",
    label: "license.fields.licenseType",
    value: (info, t) =>
      t(`license.licenseType.${info.license_type.toLowerCase()}`),
  },
  {
    key: "signDate",
    label: "license.fields.signDate",
    render: (info) => (
      <Timestamp timestamp={info.sign_date} format={DATE_FORMAT} />
    ),
  },
  {
    key: "period",
    label: "license.fields.period",
    value: (info, t) =>
      info.period === MAX_UNLIMITED
        ? t("license.permanent")
        : days(Math.floor(info.period / DAY_SECONDS), t),
  },
  {
    key: "expirationDate",
    label: "license.fields.expirationDate",
    value: (info, t) =>
      info.period === MAX_UNLIMITED
        ? t("license.permanent")
        : `${formatTimestamp(info.sign_date + info.period, DATE_FORMAT)} (${days(remainingDays(info), t)})`,
  },
  {
    key: "maxGpus",
    label: "license.fields.maxGpus",
    value: (info, t) => limit(info.max_gpus, t),
  },
  {
    key: "serial",
    label: "license.fields.serial",
    render: (info) => <LicenseSerial serial={info.serial} />,
  },
];

const USAGE_LABELS = {
  GPU: "common.fields.gpu",
  Workspace: "common.fields.workspace",
} as const;

/** One field per resource type the license reports usage for. */
export const licenseUsageFields = (
  usage: LicenseUsage,
): DetailField<LicenseUsage>[] =>
  (["GPU", "Workspace"] as const)
    .filter((type) => usage[type])
    .map((type) => ({
      key: type,
      label: USAGE_LABELS[type],
      value: (current, t) =>
        `${current[type]?.used ?? 0} / ${limit(current[type]?.limit ?? 0, t)}`,
    }));
