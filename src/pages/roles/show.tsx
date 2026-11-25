import { useShow } from "@refinedev/core";
import PermissionsTree from "@/domains/role/components/PermissionsTree";
import {
  isPresetRole,
  roleHeaderFields,
} from "@/domains/role/lib/detail-fields";
import type { Role } from "@/domains/role/types";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { DetailFields } from "@/foundation/scene/DetailFields";
import { MetadataTimestampMeta } from "@/foundation/scene/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/scene/ShowPage";

export const RolesShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<Role>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const isPreset = isPresetRole(record);

  return (
    <ShowPage
      record={record}
      canDelete={!isPreset}
      canEdit={!isPreset}
      showCurrentBreadcrumb={false}
    >
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <DetailFields inline fields={roleHeaderFields} record={record} />
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <ShowPage.Section
          title={t("common.fields.permissions")}
          data-testid="permissions-card"
        >
          <PermissionsTree permissions={record.spec.permissions} />
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
