import { DeliveryStatus, NotificationChannel, NotificationEvent } from "../../../shared/notification-contract.js";
import { buildAccessUrl } from "../../../shared/request-access-contract.js";
import { pool } from "../db/index.js";
import { tutorAccountExists } from "../repositories/request-access.js";
import { dispatchNotification } from "./notifications/dispatch-notification.js";
import { readPublicUrl } from "./public-url.js";
import { recordNotificationResults } from "./request-change-notifications.js";

// The link to "Acompanhar solicitação" exists only when the request has a tutor (a CPF) and the system has its public address. It
// also says whether that tutor still has to create the password.
export async function loadAccessLink(request, database = pool, env = process.env) {
  if (!request.cpf) return null;
  const municipality = await database.query("SELECT slug FROM municipalities WHERE id = $1", [request.municipality_id]);
  const url = buildAccessUrl({ publicUrl: readPublicUrl(env).url, slug: municipality.rows[0]?.slug });
  if (!url) return null;
  return { url, accountExists: Boolean(request.tutor_id) || await tutorAccountExists(request.municipality_id, request.cpf, database) };
}

// "Solicitação registrada": sent once the request is saved and answered, public or at the counter, with or without a tutor, to
// whoever accepted the notices. Without the link the notice still goes; a channel that fails never touches the request.
export async function notifyRequestRegistered(request, { appendHistory, dispatch = dispatchNotification, accessLink = loadAccessLink }) {
  if (request.workflow_data?.followUp?.enabled !== true) return [];
  const event = NotificationEvent.REQUEST_REGISTERED;
  let results;
  try {
    const link = await accessLink(request).catch(() => null);
    results = await dispatch({ event, request: { ...request, access_link: link } });
  } catch {
    results = [{ event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.FAILED, reason: "Não foi possível preparar a notificação." }];
  }
  return recordNotificationResults(results, request, { appendHistory });
}
