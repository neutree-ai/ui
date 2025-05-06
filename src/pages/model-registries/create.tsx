import { Form } from "@/components/theme";
import { useModelRegistryForm } from "./use-model-registry-form";

export const ModelRegistriesCreate = () => {
	const { form, metadataFields, specFields } = useModelRegistryForm({
		action: "create",
	});

	return (
		<Form {...form}>
			{metadataFields}
			{specFields}
		</Form>
	);
};
