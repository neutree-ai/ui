import { useForm } from "@refinedev/react-hook-form";
import { Field } from "@/components/theme";
import type { Role } from "@/types";
import FormCardGrid from "@/components/business/FormCardGrid";
import { Input } from "@/components/ui/input";
import PermissionsTreeField from "@/components/business/PermissionsTreeField";

export const useRoleForm = ({ action }: { action: "create" | "edit" }) => {
	const form = useForm<Role>({
		mode: "all",
		defaultValues: {
			api_version: "v1",
			kind: "Role",
			metadata: {
				name: "",
			},
			spec: {
				preset_key: null,
				permissions: [],
			},
		},
		refineCoreProps: {
			autoSave: {
				enabled: true,
			},
		},
		warnWhenUnsavedChanges: true,
	});

	const isEdit = action === "edit";

	return {
		form,
		metadataFields: (
			<FormCardGrid title="Basic Information">
				<Field {...form} name="metadata.name" label="Name">
					<Input placeholder="Role Name" disabled={isEdit} />
				</Field>
			</FormCardGrid>
		),
		specFields: (
			<FormCardGrid title="Permissions">
				<Field {...form} name="spec.permissions" className="col-span-4">
					<PermissionsTreeField />
				</Field>
			</FormCardGrid>
		),
	};
};
