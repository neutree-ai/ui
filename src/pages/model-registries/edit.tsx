import { Form } from "@/components/theme";
import { useModelRegistryForm } from "./use-model-registry-form";

export const ModelRegistriesEdit = () => {
	const { form, metadataFields, specFields } = useModelRegistryForm({
		action: "edit",
	});

	return (
		<Form {...form}>
			{metadataFields}
			{specFields}
		</Form>
	);
};
