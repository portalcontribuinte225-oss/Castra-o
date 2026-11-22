import { ConfigActiveToggle } from "../../components/ui";
import type { MessageContract } from "./use-message-contract";

export function MessageServiceToggle({ contract }: { contract: MessageContract }) {
  const { ready, live, saving, setEnabled, serviceStatus } = contract;
  if (!ready || !live?.plan) return null;

  return (
    <div className="tw:grid tw:min-w-0 tw:justify-items-start tw:gap-1">
      <ConfigActiveToggle
        checked={live.enabled !== false}
        onChange={setEnabled}
        onText="Ativo no município"
        offText="Inativo no município"
        disabled={saving}
      />
      {serviceStatus && <p role="status" className="whatsapp-inline-status tw:m-0">{serviceStatus}</p>}
    </div>
  );
}
