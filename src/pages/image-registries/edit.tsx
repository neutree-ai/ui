import { Form } from "@/components/theme";
import { useImageRegistryForm } from "./use-image-registry-form";

export const ImageRegistriesEdit = () => {
	const { form, metadataFields, specFields } = useImageRegistryForm({
		action: "edit",
	});

	return (
		<Form {...form}>
			{metadataFields}
			{specFields}
		</Form>
	);
};
