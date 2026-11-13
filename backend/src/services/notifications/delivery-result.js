import { DeliveryCode } from "../../../../shared/notification-contract.js";

const deliveryCodeLabels = Object.freeze({
  [DeliveryCode.NOT_CONFIGURED]: "Credenciais ou template do canal incompletos.",
  [DeliveryCode.INVALID_RECIPIENT]: "Contato de destino ausente ou inválido.",
  [DeliveryCode.RATE_LIMITED]: "Limite de envio atingido. Tente novamente mais tarde.",
  [DeliveryCode.PROVIDER_REJECTED]: "O provedor recusou o envio da mensagem.",
  [DeliveryCode.TIMEOUT]: "O prazo disponível para envio foi excedido.",
  [DeliveryCode.TRANSPORT_FAILED]: "Não foi possível conectar ao provedor de mensagens.",
  [DeliveryCode.PREPARATION_FAILED]: "Não foi possível preparar o envio da mensagem.",
  [DeliveryCode.CHANNEL_DISABLED]: "Canal desativado para o município.",
  [DeliveryCode.QUOTA_UNAVAILABLE]: "Envio indisponível por contrato ou cota municipal.",
});

export function knownDeliveryCode(code) {
  return typeof code === "string" && Object.hasOwn(deliveryCodeLabels, code);
}

export function deliveryFailure(status, code) {
  const safeCode = knownDeliveryCode(code) ? code : DeliveryCode.TRANSPORT_FAILED;
  return { status, code: safeCode, reason: deliveryCodeLabels[safeCode] };
}
