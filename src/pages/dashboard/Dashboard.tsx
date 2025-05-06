import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useList } from "@refinedev/core";
import { HardDrive, Server } from "lucide-react";

type Counter = {
  count: number;
};

const COUNT_FN = "count()";

export default function Dashboard() {
  const { data: clusterCountData, isLoading: isClusterCountLoading } =
    useList<Counter>({
      resource: "clusters",
      meta: {
        select: COUNT_FN,
      },
    });

  const { data: endpointCountData, isLoading: isEndpointCountLoading } =
    useList<Counter>({
      resource: "endpoints",
      meta: {
        select: COUNT_FN,
      },
    });

  return (
    <div className="flex flex-col h-screen space-y-4">
      <h2 className="text-2xl font-bold leading-7 text-black dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
        Dashboard
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HardDrive className="w-4 h-4 mr-2" />
              Clusters
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isClusterCountLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              clusterCountData?.data[0].count
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Server className="w-4 h-4 mr-2" />
              Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEndpointCountLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              endpointCountData?.data[0].count
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
