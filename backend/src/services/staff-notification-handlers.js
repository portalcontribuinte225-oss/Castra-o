import { withAuthTransaction } from "../repositories/auth-users.js";
import { loadDocumentReviewSettings } from "../repositories/request-settings.js";
import { isUuid } from "../repositories/request-tracking.js";
import { countUnreadStaffNotifications, listStaffNotifications, markStaffNotificationRead } from "../repositories/staff-notifications.js";
import { isGlobalUser, isInternalUser, pickMunicipalityId } from "../tenant.js";
import { authError } from "./auth/auth-security.js";
import { readMunicipalityPermissions, requestsMenuAllowed } from "./config-permission.js";
import { decorateRequestDocuments } from "./documents/document-reviews.js";
import { visibleRequest } from "./request-visibility.js";

const PAGE_SIZE = 20;
const BIGINT_MAX = 9223372036854775807n;
const validNotificationId = (value) => typeof value === "string" && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BIGINT_MAX;
const notificationUnavailable = () => authError(404, "Notificação ou solicitação indisponível.");

async function notificationScope(req) {
  const user = req.user;
  const denied = () => authError(403, "Acesso restrito à equipe com permissão de Solicitações.");
  if (!isInternalUser(user)) throw denied();
  const global = isGlobalUser(user);
  const municipalityId = global ? req.query.municipalityId || null : pickMunicipalityId(req);
  if (!global && !municipalityId) throw denied();
  if (municipalityId !== null && !isUuid(municipalityId)) throw authError(400, "Selecione um município válido.");
  if (!global && !requestsMenuAllowed(user, await readMunicipalityPermissions(municipalityId))) throw denied();
  return { userId: user.id, municipalityId };
}

function eventView(row) {
  return {
    id: String(row.id), type: row.event_type, protocol: row.protocol || "", createdAt: row.created_at,
    read: row.read, municipalityId: row.municipality_id, requestId: row.request_id,
  };
}

export async function listNotifications(req, res) {
  const scope = await notificationScope(req);
  const cursor = req.query.cursor ?? null;
  if (cursor !== null && !validNotificationId(cursor)) throw authError(400, "Página de notificações inválida.");
  const [page, unreadCount] = await Promise.all([
    listStaffNotifications({ ...scope, cursor, limit: PAGE_SIZE }),
    countUnreadStaffNotifications(scope),
  ]);
  res.json({ items: page.rows.map(eventView), unreadCount, nextCursor: page.nextCursor });
}

export async function openNotification(req, res) {
  const scope = await notificationScope(req);
  const id = req.params.id;
  if (!validNotificationId(id)) throw notificationUnavailable();
  const result = await withAuthTransaction(async (client) => {
    const row = await markStaffNotificationRead(client, { ...scope, id });
    if (!row) throw notificationUnavailable();
    let request = visibleRequest(row, req.user);
    if (request.documents?.length) {
      const catalogs = await loadDocumentReviewSettings([request.municipality_id], client);
      request = decorateRequestDocuments(request, catalogs.get(request.municipality_id));
    }
    const unreadCount = await countUnreadStaffNotifications(scope, client);
    return { request, unreadCount };
  });
  res.json(result);
}
