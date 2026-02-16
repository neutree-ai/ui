import MetadataCard from "@/components/business/MetadataCard";
import PermissionsTree from "@/components/business/PermissionsTree";
import { ShowPage } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Role } from "@/types";
import { useShow, useTranslation } from "@refinedev/core";

export const RolesShow = () => {
  const { translate } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<Role>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{translate("pages.error.notFound")}</div>;
  }

  const isPreset = Boolean(record.spec.preset_key);

  return (
    <ShowPage record={record} canDelete={!isPreset} canEdit={!isPreset}>
      <div className="h-full overflow-auto">
        <MetadataCard metadata={record.metadata} />
        <Card className="mt-4" data-testid="permissions-card">
          <CardHeader>
            <CardTitle>{translate("common.fields.permissions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PermissionsTree permissions={record.spec.permissions} />
          </CardContent>
        </Card>
      </div>
    </ShowPage>
  );
};
