import { Form } from "@/components/theme";
import { useRoleAssignmentForm } from "./use-role-assignment-form";

export const RoleAssignmentsCreate = () => {
	const { form, metadataFields, specFields } = useRoleAssignmentForm({
		action: "create",
	});

	return (
		<Form {...form}>
			{metadataFields}
			{specFields}
		</Form>
	);
};
