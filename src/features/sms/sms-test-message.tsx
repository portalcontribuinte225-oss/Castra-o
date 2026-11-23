import { Button } from "../../components/button";
import { IntegrationCard, integrationActionFieldStyle } from "../../components/integration-card";
import { ConfigField } from "../../components/ui";
import { formatPhone } from "../../utils";
import type { SmsTestOutcome } from "./sms-types";
import type { useSmsSettings } from "./use-sms-settings";

type SmsState = ReturnType<typeof useSmsSettings>;

// "Sent" is only the provider taking the message, so the text sends the user to the phone to confirm it arrived.
function testText({ sent, reason, detail, providerMessageId }: SmsTestOutcome) {
  if (!sent) return `Não enviado: ${reason}${detail ? ` Detalhe: ${detail}.` : ""}`;
  return `Teste enviado ao provedor${providerMessageId ? ` (código ${providerMessageId})` : ""}. Confira se chegou ao celular: a entrega depende da operadora.`;
}

// One real SMS through the platform's account to the number the master types; the token stays in the server's variables.
export function SmsTestMessage({ state }: { state: SmsState }) {
  const busy = state.loading || state.saving || state.sendingTest;
  return (
    <IntegrationCard title="Teste de envio">
      <div className={integrationActionFieldStyle}>
        <ConfigField label="Número" type="tel" autoComplete="tel" value={state.testPhone} placeholder="(00) 00000-0000" onChange={(value) => state.setTestPhone(formatPhone(value))} />
        <Button onClick={state.sendTest} disabled={busy || !state.config.integrated}>
          {state.sendingTest ? "Enviando..." : "Enviar teste"}
        </Button>
      </div>
      {state.testOutcome && <p className={state.testOutcome.sent ? "sms-status confirmed" : "sms-status"}>{testText(state.testOutcome)}</p>}
    </IntegrationCard>
  );
}
