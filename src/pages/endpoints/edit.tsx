import { Form } from "@/components/theme";
import { useEndpointForm } from "./use-endpoint-form";

export const EndpointsEdit = () => {
	const {
		form,
		metadataFields,
		modelFields,
		resourceFields,
		engineFields,
		replicaFields,
		advancedFields,
	} = useEndpointForm({
		action: "edit",
	});

	return (
		<Form {...form}>
			{metadataFields}
			{modelFields}
			{resourceFields}
			{engineFields}
			{replicaFields}
			{advancedFields}
		</Form>
	);
};
