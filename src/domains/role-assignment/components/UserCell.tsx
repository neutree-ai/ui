import { useList } from "@refinedev/core";
import { ShowButton } from "@/foundation/components/ShowButton";
import { profileDisplayName } from "@/foundation/lib/user-identity";
import type { Metadata } from "@/foundation/types/basic-types";

const UserCell = ({ id }: { id: string }) => {
  const { data } = useList<{ metadata: Metadata }>({
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

  const { metadata } = data.data[0];
  const { name, workspace } = metadata;

  return (
    <ShowButton
      recordItemId={name}
      meta={{
        workspace,
      }}
      resource="user_profiles"
      variant="link"
    >
      {profileDisplayName(metadata)}
    </ShowButton>
  );
};

export default UserCell;
