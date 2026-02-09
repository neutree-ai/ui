import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getResourcePlural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Box,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  Download,
  Eye,
  FileText,
  HardDrive,
  Layers,
  Lock,
  Package,
  Pencil,
  Plus,
  Server,
  Settings,
  Square,
  Trash,
  Upload,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePermissionDependencies } from "./use-permission-dependencies";

const actionIcons: Record<string, React.ReactNode> = {
  read: <Eye className="h-4 w-4" />,
  create: <Plus className="h-4 w-4" />,
  update: <Pencil className="h-4 w-4" />,
  delete: <Trash className="h-4 w-4" />,
  push: <Upload className="h-4 w-4" />,
  pull: <Download className="h-4 w-4" />,
};

const resourceIcons: Record<string, React.ReactNode> = {
  workspace: <Box className="h-5 w-5" />,
  role: <Users className="h-5 w-5" />,
  role_assignment: <FileText className="h-5 w-5" />,
  endpoint: <Server className="h-5 w-5" />,
  image_registry: <Database className="h-5 w-5" />,
  model_registry: <Layers className="h-5 w-5" />,
  model: <Package className="h-5 w-5" />,
  engine: <Cpu className="h-5 w-5" />,
  cluster: <HardDrive className="h-5 w-5" />,
  model_catalog: <BookOpen className="h-5 w-5" />,
  system: <Settings className="h-5 w-5" />,
  user_profile: <Users className="h-5 w-5" />,
};

type PermissionsTreeFieldProps = {
  value?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
};

const PermissionsTreeField = React.forwardRef<
  HTMLDivElement,
  PermissionsTreeFieldProps
>(({ value = [], onChange, disabled = false, className }, ref) => {
  const {
    permissionTree,
    sortedResources,
    togglePermission,
    toggleAllResourcePermissions,
    getActionDependents,
  } = usePermissionDependencies({
    value,
    onChange,
  });

  return (
    <div className={cn("w-full max-w-3xl mx-auto", className)} ref={ref}>
      <div className="space-y-2">
        {sortedResources.map((resource) => (
          <ResourceNode
            key={resource}
            resource={resource}
            resourceData={permissionTree[resource]}
            togglePermission={togglePermission}
            toggleAllResourcePermissions={toggleAllResourcePermissions}
            getActionDependents={getActionDependents}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
});

const ResourceNode = ({
  resource,
  resourceData,
  togglePermission,
  toggleAllResourcePermissions,
  getActionDependents,
  disabled,
}: {
  resource: string;
  resourceData: { actions: string[]; selectedActions: string[] };
  togglePermission: (resource: string, action: string) => void;
  toggleAllResourcePermissions: (resource: string, selectAll: boolean) => void;
  getActionDependents: (resource: string, action: string) => string[];
  disabled?: boolean;
}) => {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(true);
  const { actions, selectedActions } = resourceData;
  const sortedActions = [...actions].sort();
  const resourceIcon = resourceIcons[resource] || <Box className="h-5 w-5" />;

  const allSelected = sortedActions.length === selectedActions.length;
  const someSelected = selectedActions.length > 0 && !allSelected;

  const formatResourceName = (name: string) => {
    const plural = getResourcePlural(name);
    return t(`${plural}.title`);
  };

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center p-2 bg-secondary text-secondary-foreground">
        <div
          className="cursor-pointer flex items-center"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <ChevronDown className="h-5 w-5 mr-1" />
          ) : (
            <ChevronRight className="h-5 w-5 mr-1" />
          )}
        </div>

        <div
          className="flex items-center flex-1 cursor-pointer"
          onClick={
            disabled
              ? undefined
              : () => toggleAllResourcePermissions(resource, !allSelected)
          }
        >
          <span className="mr-2 flex items-center justify-center w-5 h-5">
            {allSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : someSelected ? (
              <span className="relative">
                <Square className="h-4 w-4" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary" />
                </span>
              </span>
            ) : (
              <Square className="h-4 w-4" />
            )}
          </span>

          <div className="mr-2">{resourceIcon}</div>

          <h3 className="font-medium">{formatResourceName(resource)}</h3>

          <Badge variant="outline" className="ml-2">
            {selectedActions.length}/{sortedActions.length}{" "}
            {t("common.fields.permissions")}
          </Badge>
        </div>
      </div>

      {isOpen && (
        <div className="p-1 bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {sortedActions.map((action) => {
              const dependents = getActionDependents(resource, action);
              return (
                <ActionNode
                  key={`${resource}:${action}`}
                  action={action}
                  resource={resource}
                  isSelected={selectedActions.includes(action)}
                  dependents={dependents}
                  onToggle={() => togglePermission(resource, action)}
                  disabled={disabled}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const ActionNode = ({
  action,
  resource,
  isSelected,
  dependents,
  onToggle,
  disabled,
}: {
  action: string;
  resource: string;
  isSelected: boolean;
  dependents: string[];
  onToggle: () => void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();

  const actionIcon = actionIcons[action] || <Eye className="h-4 w-4" />;

  const plural = getResourcePlural(resource);
  const fullPermission = ["system"].includes(resource)
    ? t(`permissions.${resource}_${action}`)
    : `${t(`${plural}.title`)}:${t(`permissions.${action}`)}`;

  const locked = dependents.length > 0;
  const isDisabled = disabled || (locked && isSelected);

  const node = (
    <div
      className={`flex items-center p-2 rounded border cursor-pointer
        ${isSelected ? "bg-accent border-primary" : "bg-card border-border"}
        ${isDisabled ? "opacity-60 cursor-not-allowed" : "hover:bg-accent"}`}
      onClick={isDisabled ? undefined : onToggle}
    >
      <div className="mr-2 flex items-center justify-center w-5 h-5">
        {isSelected ? (
          <CheckSquare className="h-4 w-4 text-accent-foreground" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </div>

      <div className="mr-2">{actionIcon}</div>

      <div className="text-xs ml-1 font-mono">{fullPermission}</div>

      {locked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
    </div>
  );

  if (locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-popover text-popover-foreground border shadow-sm"
        >
          {t("permissions.requiredBy", {
            actions: dependents
              .map((perm) => {
                const [res, act] = perm.split(":");
                const p = getResourcePlural(res);
                return `${t(`${p}.title`)}:${t(`permissions.${act}`)}`;
              })
              .join(", "),
          })}
        </TooltipContent>
      </Tooltip>
    );
  }

  return node;
};

PermissionsTreeField.displayName = "PermissionsTreeField";

export default PermissionsTreeField;
