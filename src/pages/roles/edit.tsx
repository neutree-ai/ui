import { Form } from "@/components/theme";
import { useRoleForm } from "./use-role-form";

export const RolesEdit = () => {
	const { form, metadataFields, specFields } = useRoleForm({
		action: "edit",
	});

	return (
		<Form {...form}>
			{metadataFields}
			{specFields}
		</Form>
	);
};
