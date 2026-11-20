import { ClipboardCheck, HeartHandshake, Users } from "lucide-react";
import { Metric } from "../../components/ui";

const metrics = [
  { title: "adotados", icon: HeartHandshake },
  { title: "castrações", icon: ClipboardCheck },
  { title: "ONGs parceiras", icon: Users },
];

export function PublicMetrics() {
  return (
    <div className="tw:mx-auto tw:mt-[clamp(20px,2.5vw,32px)] tw:flex tw:w-[min(1760px,100%_-_24px)] tw:flex-wrap tw:justify-center tw:gap-3 tw:min-[521px]:gap-4">
      {metrics.map(({ title, icon }) => <Metric key={title} title={title} icon={icon} value={0} compact />)}
    </div>
  );
}
