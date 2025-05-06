import type { Role } from "@/types";

import type React from "react";
import { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Eye,
  Plus,
  Pencil,
  Trash,
  Database,
  Users,
  Box,
  Server,
  Cpu,
  HardDrive,
  Layers,
  FileText,
  UserCheck,
  LayoutTemplate,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const actionIcons: Record<string, React.ReactNode> = {
  read: <Eye className="h-4 w-4" />,
  create: <Plus className="h-4 w-4" />,
  update: <Pencil className="h-4 w-4" />,
  delete: <Trash className="h-4 w-4" />,
};

const resourceIcons: Record<string, React.ReactNode> = {
  workspace: <LayoutTemplate className="h-5 w-5" />,
  role: <UserCheck className="h-5 w-5" />,
  role_assignment: <FileText className="h-5 w-5" />,
  endpoint: <Server className="h-5 w-5" />,
  image_registry: <Database className="h-5 w-5" />,
  model_registry: <Layers className="h-5 w-5" />,
  engine: <Cpu className="h-5 w-5" />,
  cluster: <HardDrive className="h-5 w-5" />,
};

const parsePermissionsToTree = (permissions: string[]) => {
  const tree: Record<string, string[]> = {};

  permissions.forEach((permission) => {
    const [resource, action] = permission.split(":");

    if (!tree[resource]) {
      tree[resource] = [];
    }

    if (!tree[resource].includes(action)) {
      tree[resource].push(action);
    }
  });

  return tree;
};

const PermissionsTree = ({
  permissions,
}: Pick<Role["spec"], "permissions">) => {
  const permissionTree = useMemo(
    () => parsePermissionsToTree(permissions),
    [permissions]
  );
  const sortedResources = useMemo(
    () => Object.keys(permissionTree).sort(),
    [permissionTree]
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
  const [isOpen, setIsOpen] = useState(true);
  const sortedActions = actions.sort();
  const resourceIcon = resourceIcons[resource] || <Box className="h-5 w-5" />;

  const formatResourceName = (name: string) => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

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
          {sortedActions.length} permissions
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
  const actionIcon = actionIcons[action] || <Eye className="h-4 w-4" />;
  const fullPermission = `${resource}:${action}`;

  return (
    <div className="flex items-center p-2 rounded bg-card border border-border hover:bg-accent text-card-foreground">
      <div className="mr-2">{actionIcon}</div>

      <div className="text-xs ml-1 text-muted-foreground font-mono">
        {fullPermission}
      </div>
    </div>
  );
};

export default PermissionsTree;
