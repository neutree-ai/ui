import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  permissionActionIcon,
  permissionResourceIcon,
} from "@/domains/role/components/permission-icons";
import {
  formatPermission,
  formatResource,
} from "@/domains/role/lib/format-permission";
import { sortPermissionResources } from "@/domains/role/lib/permission-resource-order";
import type { Role } from "@/domains/role/types";

const hiddenResources = new Set(["static_node_cluster", "static_node"]);

const parsePermissionsToTree = (permissions: string[]) => {
  const tree: Record<string, string[]> = {};

  for (const permission of permissions) {
    const [resource, action] = permission.split(":");

    if (hiddenResources.has(resource)) {
      continue;
    }

    if (!tree[resource]) {
      tree[resource] = [];
    }

    if (!tree[resource].includes(action)) {
      tree[resource].push(action);
    }
  }

  return tree;
};

const PermissionsTree = ({
  permissions,
}: Pick<Role["spec"], "permissions">) => {
  const permissionTree = useMemo(
    () => parsePermissionsToTree(permissions),
    [permissions],
  );
  const sortedResources = useMemo(
    () => sortPermissionResources(Object.keys(permissionTree)),
    [permissionTree],
  );

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="space-y-1">
        {sortedResources.map((resource) => (
          <ResourceNode
            key={resource}
            resource={resource}
            actions={permissionTree[resource]}
          />
        ))}
      </div>
    </div>
  );
};

const ResourceNode = ({
  resource,
  actions,
}: {
  resource: string;
  actions: string[];
}) => {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(true);
  const sortedActions = actions.sort();
  const resourceIcon = permissionResourceIcon(resource);

  const formatResourceName = (name: string) => formatResource(t, name);

  return (
    <div className="border border-border rounded-md mb-2 overflow-hidden">
      <div
        className="flex items-center p-2 cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="h-5 w-5 mr-1" />
        ) : (
          <ChevronRight className="h-5 w-5 mr-1" />
        )}

        <div className="mr-2">{resourceIcon}</div>

        <h3 className="font-medium">{formatResourceName(resource)}</h3>

        <Badge variant="outline" className="ml-2">
          {sortedActions.length} {t("common.fields.permissions")}
        </Badge>
      </div>

      {isOpen && (
        <div className="p-1 bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {sortedActions.map((action) => (
              <ActionNode
                key={`${resource}:${action}`}
                action={action}
                resource={resource}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ActionNode = ({
  action,
  resource,
}: {
  action: string;
  resource: string;
}) => {
  const { t } = useTranslation();

  const actionIcon = permissionActionIcon(action);

  const fullPermission = formatPermission(t, `${resource}:${action}`);

  return (
    <div className="flex items-center p-2 rounded bg-card border border-border text-card-foreground">
      <div className="mr-2">{actionIcon}</div>

      <div className="text-xs ml-1 text-muted-foreground font-mono">
        {fullPermission}
      </div>
    </div>
  );
};

export default PermissionsTree;
