import React from "react";
import { ConfigActiveToggle } from "../../components/ui";
import { useNotificationSettings } from "./use-notification-settings";

const LABEL = "Enviar o mesmo aviso por mais de um canal";

// Off: the notices of a request go by e-mail only. On: they also go by WhatsApp, when it is active and the citizen gave a phone.
export function MultiChannelSwitch({ municipalityId }: { municipalityId: string }) {
  const settings = useNotificationSettings(municipalityId);
  const busy = !settings.ready || settings.loading || settings.saving;
  return (
    <div>
      <ConfigActiveToggle checked={settings.value.multiChannel} onChange={(checked: boolean) => { if (!busy) void settings.setMultiChannel(checked); }} onText={LABEL} offText={LABEL} />
      <p className="whatsapp-note">Desligado: os avisos da solicitação saem só por e-mail. Ligado: saem por e-mail e também por WhatsApp, quando o WhatsApp do município está ativo e o solicitante informou telefone.</p>
      {settings.loading && <p role="status">Carregando a opção de canais...</p>}
      {settings.error && <div role="alert"><p className="form-error">{settings.error}</p><button type="button" className="ghost-button" onClick={settings.retry}>Carregar novamente</button></div>}
    </div>
  );
}
