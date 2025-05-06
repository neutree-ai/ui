import FormCardGrid from "@/components/business/FormCardGrid";
import NodeIPsField from "@/components/business/NodeIPsField";
import WorkspaceField from "@/components/business/WorkspaceField";
import { Combobox, Field, Select } from "@/components/theme";
import { useWorkspace } from "@/components/theme/hooks";
import { Input } from "@/components/ui/input";
import type { Cluster, ImageRegistry } from "@/types";
import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

export const useClusterForm = ({ action }: { action: "create" | "edit" }) => {
	const { current: currentWorkspace } = useWorkspace();
	const form = useForm<Cluster>({
		mode: "all",
		defaultValues: {
			api_version: "v1",
			kind: "Cluster",
			metadata: {
				name: "",
				workspace: currentWorkspace,
			},
			spec: {
				image_registry: "",
				type: "local",
				config: {
					provider: {},
					auth: {
						ssh_user: "",
						ssh_private_key: "",
					},
				},
				version: "v15",
			},
		},
	});

	const workspace = form.watch("metadata.workspace");
	const type = form.watch("spec.type");

	const meta = {
		workspace,
	};

	const imageRegistries = useSelect<ImageRegistry>({
		resource: "image_registries",
		meta,
	});

	const isEdit = action === "edit";

	return {
		form,
		metadataFields: (
			<FormCardGrid title="Basic Information">
				<Field {...form} name="metadata.name" label="Name">
					<Input placeholder="Cluster Name" disabled={isEdit} />
				</Field>
				<Field {...form} name="metadata.workspace" label="Workspace">
					<WorkspaceField disabled={isEdit} />
				</Field>
			</FormCardGrid>
		),
		imageRegistryFields: (
			<FormCardGrid>
				<Field {...form} name="spec.image_registry" label="Image Registry">
					<Combobox
						placeholder="Select A Image Registry"
						options={(imageRegistries.query.data?.data || []).map((item) => ({
							label: item.metadata.name,
							value: item.metadata.name,
						}))}
						disabled={imageRegistries.query.isLoading || isEdit}
					/>
				</Field>
			</FormCardGrid>
		),
		providerFields: (
			<FormCardGrid title="Provider">
				<Field {...form} name="spec.type" label="Type">
					<Select
						options={[
							{ label: "Single Local Node", value: "local" },
							{ label: "Multiple Static Nodes", value: "ssh" },
						]}
						onChange={(value) => {
							form.setValue("spec.type", value);
							if (value === "ssh") {
								form.setValue("spec.config.provider", {
									head_ip: "",
									worker_ips: [],
								});
							}
							if (value === "local") {
								form.setValue("spec.config.provider", {});
							}
						}}
						disabled={isEdit}
					/>
				</Field>
				<div className="col-span-3" />
				{type === "ssh" && (
					<Field {...form} name="spec.config.provider" className="col-span-4">
						<NodeIPsField />
					</Field>
				)}
			</FormCardGrid>
		),
		authFields: (
			<FormCardGrid title="Node Authentication">
				<Field {...form} name="spec.config.auth.ssh_user" label="SSH User">
					<Input placeholder="e.g root" />
				</Field>
				<Field
					{...form}
					name="spec.config.auth.ssh_private_key"
					label="SSH Private Key Path"
				>
					<Input placeholder="e.g /root/.ssh/id_rsa" type="password" />
				</Field>
			</FormCardGrid>
		),
	};
};
