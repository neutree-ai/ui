import { Card, CardContent } from "@/components/ui/card";
import { ShowButton, ShowPage } from "@/components/theme";
import Timestamp from "./Timestamp";
import { useTranslation } from "@refinedev/core";
import type { Metadata } from "@/types";

type MetadataCardProps = {
	metadata: Metadata;
};

export default function MetadataCard({ metadata }: MetadataCardProps) {
	const { translate } = useTranslation();

	return (
		<Card>
			<CardContent>
				{metadata.workspace && (
					<div className="flex">
						<ShowPage.Row
							title={translate("table.column.workspace")}
							children={
								<ShowButton
									recordItemId={metadata.workspace}
									meta={{}}
									variant="link"
									resource="workspaces"
								>
									{metadata.workspace}
								</ShowButton>
							}
						/>
					</div>
				)}
				<div className="grid grid-cols-4 gap-8">
					<ShowPage.Row
						title={translate("table.column.creation_timestamp")}
						children={<Timestamp timestamp={metadata.creation_timestamp} />}
					/>
					<ShowPage.Row
						title={translate("table.column.update_timestamp")}
						children={<Timestamp timestamp={metadata.update_timestamp} />}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
