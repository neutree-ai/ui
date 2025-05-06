import { useList } from "@refinedev/core";
import { ShowButton } from "../theme";
import type { UserProfile } from "@/types";

const UserCell = ({ id }: { id: string }) => {
	const { data } = useList<UserProfile>({
		resource: "user_profiles",
		filters: [
			{
				field: "id",
				operator: "eq",
				value: id,
			},
		],
	});

	if (!data?.data[0]?.metadata) {
		return null;
	}

	const { name, workspace } = data.data[0].metadata;

	return (
		<ShowButton
			recordItemId={name}
			meta={{
				workspace,
			}}
			resource="user_profiles"
			variant="link"
		>
			{name}
		</ShowButton>
	);
};

export default UserCell;
