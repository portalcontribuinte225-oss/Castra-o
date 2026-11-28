import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeliveryStatus, NotificationChannel } from "../../../shared/notification-contract.js";
import { ProcedureAction } from "../../../shared/request-procedure-contract.js";
import { ApiError } from "../../api";
import { canEditRequests, useRequestActions } from "./request-actions";

describe("request operation visibility", () => {
  it("allows only global and internal municipal roles to edit requests", () => {
    for (const role of ["master", "suporte", "admin_municipal", "analista", "servidor_publico"]) {
      expect(canEditRequests(role)).toBe(true);
    }
    for (const role of ["tutor", "ong", "protetor", "", "coordenador"]) {
      expect(canEditRequests(role)).toBe(false);
    }
  });
});

function captureActions(options: Parameters<typeof useRequestActions>[0]) {
  let actions: ReturnType<typeof useRequestActions>;
  function Probe() {
    actions = useRequestActions(options);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return actions;
}

it("shows only one notice for the saved action and its partial delivery", async () => {
  const showToast = vi.fn();
  const request = { id: "request", status: "AGENDADA" };
  const actions = captureActions({ currentUser: {}, showToast, runProcedureAction: async () => ({
    ...request, notificationResults: [
      { channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT },
      { channel: NotificationChannel.WHATSAPP, status: DeliveryStatus.SKIPPED },
    ],
  }) });
  await actions.applyProcedureAction(request, { action: ProcedureAction.CONFIRM_SCHEDULE }, "Agendamento confirmado");
  expect(showToast).toHaveBeenCalledTimes(1);
  expect(showToast).toHaveBeenCalledWith({
    title: "Agendamento confirmado", tone: "warning", detail: "Envio aceito por e-mail. Envio indisponível por WhatsApp.",
  });
});

it("returns errors for the modal without creating a second message", async () => {
  const showToast = vi.fn();
  const request = { id: "request" };
  const actions = captureActions({ currentUser: {}, showToast, patchRequest: async () => {
    throw new ApiError("O documento já foi analisado.", 409);
  } });
  await expect(actions.updateDocuments(request, {}, "")).resolves.toMatchObject({
    ok: false, message: "O documento já foi analisado.",
  });
  expect(showToast).not.toHaveBeenCalled();
});

it("describes who receives the process after assigning it", async () => {
  const showToast = vi.fn();
  const request = { id: "request" };
  const teams = { sectors: [{ id: "sector", name: "Atendimento" }], users: [{ id: "me" }, { id: "other" }] };
  const actions = captureActions({ currentUser: { id: "me" }, teams, showToast, patchRequest: async () => request });
  for (const userId of ["me", "other", ""]) await actions.assignFromPreview(request, { sectorId: "sector", userId });
  expect(showToast.mock.calls.map(([notice]) => notice.title)).toEqual([
    "Processo assumido", "Responsável definido", "Processo enviado à fila do setor",
  ]);
});
