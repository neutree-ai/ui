import { useWorkspace } from "@/components/theme/hooks";
import { useForm } from "@refinedev/react-hook-form";
import { Field, Select } from "@/components/theme";
import type { ImageRegistry } from "@/types";
import FormCardGrid from "@/components/business/FormCardGrid";
import { Input } from "@/components/ui/input";
import WorkspaceField from "@/components/business/WorkspaceField";
import { Textarea } from "@/components/ui/textarea";

export const useImageRegistryForm = ({
	action,
}: {
	action: "create" | "edit";
}) => {
	const { current: currentWorkspace } = useWorkspace();
	const form = useForm<ImageRegistry>({
		mode: "all",
		defaultValues: {
			api_version: "v1",
			kind: "ImageRegistry",
			metadata: {
				name: "",
				workspace: currentWorkspace,
			},
			spec: {
				url: "",
				repository: "",
				authconfig: {
					username: "",
					password: "",
					auth: "",
				},
				ca: "",
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
					<Input placeholder="Image Registry Name" disabled={isEdit} />
				</Field>
				<Field {...form} name="metadata.workspace" label="Workspace">
					<WorkspaceField disabled={isEdit} />
				</Field>
			</FormCardGrid>
		),
		specFields: (
			<>
				<FormCardGrid title="Image Registry">
					<Field {...form} name="spec.url" label="URL">
						<Input placeholder="e.g https://index.docker.io/v1" />
					</Field>
					<Field {...form} name="spec.repository" label="Repository">
						<Input />
					</Field>
					<div className="col-span-2" />
					<Field
						{...form}
						name="spec.ca"
						label="Certificate Authority"
						description="CA certificate for a self-signed registry"
						className="col-span-2"
					>
						<Textarea />
					</Field>
				</FormCardGrid>
				<FormCardGrid title="Authentication">
					<Field {...form} name="spec.authconfig.username" label="Username">
						<Input />
					</Field>
					<Field {...form} name="spec.authconfig.password" label="Password">
						<Input type="password" />
					</Field>
					<div className="col-span-2" />

					<Field
						{...form}
						name="spec.authconfig.auth"
						label="Base64 Auth"
						description="Base64 encoded username:password"
						className="col-span-4"
					>
						<Input type="password" />
					</Field>
				</FormCardGrid>
			</>
		),
	};
};
