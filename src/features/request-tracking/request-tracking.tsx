import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { maskTrackingContact } from "./tracking-contact";
import { TrackingStep } from "./tracking-state";
import { TrackedRequestView } from "./tracked-request-view";
import { useRequestTracking } from "./use-request-tracking";

const fieldLabel = "tw:grid tw:gap-1.5 tw:text-sm tw:font-medium tw:text-ui-ink";

export function RequestTracking({ municipalityId }: { municipalityId: string }) {
  const tracking = useRequestTracking(municipalityId);
  if (!municipalityId) return <p role="status">Selecione o município na página para acompanhar uma solicitação.</p>;
  if (tracking.step === TrackingStep.VIEW && tracking.request) {
    return <TrackedRequestView request={tracking.request} loading={tracking.loading} error={tracking.error} onRefresh={() => void tracking.refresh()} onClose={tracking.restart} />;
  }
  const coding = tracking.step === TrackingStep.CODE;
  const waiting = tracking.clock.retryIn > 0;
  return <form className="tw:grid tw:gap-4" aria-label="Acompanhar solicitação" aria-busy={tracking.loading} onSubmit={(event) => { event.preventDefault(); void (coding ? tracking.open() : tracking.send()); }}>
    {coding && <h3 className="tw:m-0 tw:text-lg tw:font-semibold">Digite o código</h3>}
    {!coding && <>
      <p>Informe o protocolo e o e-mail ou telefone que você cadastrou ao escolher receber avisos. Enviaremos um código a esse contato.</p>
      <label className={fieldLabel}><span>Protocolo<span className="required-asterisk">*</span></span><Input autoComplete="off" maxLength={20} placeholder="000123/2026" required value={tracking.protocol} onChange={(event) => tracking.edit({ protocol: event.target.value })} disabled={tracking.loading} /></label>
      <label className={fieldLabel}><span>E-mail ou telefone do acompanhamento<span className="required-asterisk">*</span></span><Input autoComplete="off" maxLength={254} required value={tracking.contact} onChange={(event) => tracking.edit({ contact: event.target.value })} disabled={tracking.loading} /></label>
      <Button type="submit" className="tw:justify-self-end tw:max-sm:w-full" disabled={tracking.loading || waiting || !tracking.protocol.trim() || !tracking.contact.trim()}>{tracking.loading ? "Enviando..." : waiting ? `Aguarde ${tracking.clock.retryIn}s` : "Enviar código"}</Button>
      <p className="whatsapp-note">Só é possível acompanhar solicitações em que você escolheu receber avisos. Tem acesso de tutor? Use o botão Entrar.</p>
    </>}
    {coding && <>
      <p role="status">Se os dados conferirem, enviamos um código de 6 dígitos para {maskTrackingContact(tracking.contact)}. Ele vale por 10 minutos.</p>
      <label className={fieldLabel}><span>Código recebido</span><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={tracking.code} onChange={(event) => tracking.edit({ code: event.target.value.replace(/\D/g, "") })} disabled={tracking.loading} /></label>
      {tracking.clock.expiresIn === 0 && <p role="status">Código expirado. Peça um novo.</p>}
      <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
        <Button type="submit" disabled={tracking.loading || tracking.clock.expiresIn === 0 || tracking.code.length !== 6}>{tracking.loading ? "Consultando..." : "Consultar solicitação"}</Button>
        <Button variant="outline" disabled={tracking.loading || waiting} onClick={() => void tracking.send()}>{waiting ? `Reenviar em ${tracking.clock.retryIn}s` : "Reenviar código"}</Button>
        <Button variant="outline" disabled={tracking.loading} onClick={tracking.correct}>Corrigir dados</Button>
      </div>
    </>}
    {tracking.error && <p className="form-error" role="alert">{tracking.error}</p>}
  </form>;
}
