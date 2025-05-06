import React, { useState, useMemo } from "react";
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
	CheckSquare,
	Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ALL_PERMISSIONS } from "@/types";
import { cn } from "@/lib/utils";

const actionIcons: Record<string, React.ReactNode> = {
	read: <Eye className="h-4 w-4" />,
	create: <Plus className="h-4 w-4" />,
	update: <Pencil className="h-4 w-4" />,
	delete: <Trash className="h-4 w-4" />,
};

const resourceIcons: Record<string, React.ReactNode> = {
	workspace: <Box className="h-5 w-5" />,
	role: <Users className="h-5 w-5" />,
	role_assignment: <FileText className="h-5 w-5" />,
	endpoint: <Server className="h-5 w-5" />,
	image_registry: <Database className="h-5 w-5" />,
	model_registry: <Layers className="h-5 w-5" />,
	engine: <Cpu className="h-5 w-5" />,
	cluster: <HardDrive className="h-5 w-5" />,
};

type PermissionsTreeData = Record<
	string,
	{ actions: string[]; selectedActions: string[] }
>;

const parsePermissionsToTree = (permissions: string[]) => {
	const tree: PermissionsTreeData = {};

	for (const permission of ALL_PERMISSIONS) {
		const [resource, action] = permission.split(":");

		if (!tree[resource]) {
			tree[resource] = {
				actions: [],
				selectedActions: [],
			};
		}

		tree[resource].actions.push(action);
	}

	for (const permission of permissions) {
		const [resource, action] = permission.split(":");
		if (tree[resource] && !tree[resource].selectedActions.includes(action)) {
			tree[resource].selectedActions.push(action);
		}
	}

	return tree;
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
	const permissionTree = useMemo(() => {
		return parsePermissionsToTree(value);
	}, [value]);

	const sortedResources = useMemo(
		() => Object.keys(permissionTree).sort(),
		[permissionTree],
	);

	const updatePermissions = (newTree: PermissionsTreeData) => {
		const newPermissions: string[] = [];

		for (const [resource, data] of Object.entries(newTree)) {
			for (const action of data.selectedActions) {
				newPermissions.push(`${resource}:${action}`);
			}
		}

		onChange?.(newPermissions);
	};

	const togglePermission = (resource: string, action: string) => {
		if (disabled) {
			return;
		}

		const newTree = { ...permissionTree };
		const isSelected = newTree[resource].selectedActions.includes(action);

		if (isSelected) {
			newTree[resource].selectedActions = newTree[
				resource
			].selectedActions.filter((a) => a !== action);
		} else {
			newTree[resource].selectedActions.push(action);
		}

		updatePermissions(newTree);
	};

	const toggleAllResourcePermissions = (
		resource: string,
		selectAll: boolean,
	) => {
		if (disabled) {
			return;
		}

		const newTree = { ...permissionTree };

		if (selectAll) {
			newTree[resource].selectedActions = [...newTree[resource].actions];
		} else {
			newTree[resource].selectedActions = [];
		}

		updatePermissions(newTree);
	};

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
	disabled,
}: {
	resource: string;
	resourceData: { actions: string[]; selectedActions: string[] };
	togglePermission: (resource: string, action: string) => void;
	toggleAllResourcePermissions: (resource: string, selectAll: boolean) => void;
	disabled?: boolean;
}) => {
	const [isOpen, setIsOpen] = useState(true);
	const { actions, selectedActions } = resourceData;
	const sortedActions = [...actions].sort();
	const resourceIcon = resourceIcons[resource] || <Box className="h-5 w-5" />;

	const allSelected = sortedActions.length === selectedActions.length;
	const someSelected = selectedActions.length > 0 && !allSelected;

	const formatResourceName = (name: string) => {
		return name
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
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
					onClick={() => toggleAllResourcePermissions(resource, !allSelected)}
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
						{selectedActions.length}/{sortedActions.length} permissions
					</Badge>
				</div>
			</div>

			{isOpen && (
				<div className="p-1 bg-background">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-1">
						{sortedActions.map((action) => (
							<ActionNode
								key={`${resource}:${action}`}
								action={action}
								resource={resource}
								isSelected={selectedActions.includes(action)}
								onToggle={() => togglePermission(resource, action)}
								disabled={disabled}
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
	isSelected,
	onToggle,
	disabled,
}: {
	action: string;
	resource: string;
	isSelected: boolean;
	onToggle: () => void;
	disabled?: boolean;
}) => {
	const actionIcon = actionIcons[action] || <Eye className="h-4 w-4" />;
	const fullPermission = `${resource}:${action}`;

	return (
		<div
			className={`flex items-center p-2 rounded border cursor-pointer
        ${isSelected ? "bg-accent border-primary" : "bg-card border-border"}
        ${disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-accent"}`}
			onClick={disabled ? undefined : onToggle}
		>
			<div className="mr-2 flex items-center justify-center w-5 h-5">
				{isSelected ? (
					<CheckSquare className="h-4 w-4 text-primary" />
				) : (
					<Square className="h-4 w-4" />
				)}
			</div>

			<div className="mr-2">{actionIcon}</div>

			<div className="text-xs ml-1 font-mono">{fullPermission}</div>
		</div>
	);
};

PermissionsTreeField.displayName = "PermissionsTreeField";

export default PermissionsTreeField;
