import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function RelativeTimestamp({ timestamp }: { timestamp: string }) {
  return <span title={dayjs(timestamp).format("YYYY-MM-DD HH:mm")}>{dayjs(timestamp).fromNow()}</span>;
}
