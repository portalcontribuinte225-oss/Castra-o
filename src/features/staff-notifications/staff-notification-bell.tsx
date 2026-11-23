import { useRef } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { StaffNotificationType } from "../../../shared/staff-notifications-contract.js";
import { Button } from "../../components/button";
import { SidePanel } from "../../components/side-panel";
import type { AnyRecord } from "../../types";
import { formatDateTime } from "../../utils";
import type { StaffNotificationPage } from "./staff-notification-types";
import { useStaffNotifications } from "./use-staff-notifications";

const notificationTitle = {
  [StaffNotificationType.REQUEST_CREATED]: "Nova solicitação",
  [StaffNotificationType.REQUEST_ASSIGNED]: "Processo atribuído a você",
};

type PanelProps = StaffNotificationPage & {
  loading: boolean;
  openingId: string;
  error: string;
  returnFocus: HTMLElement | null;
  close: () => void;
  openNotification: (id: string) => void;
  reload: () => void;
  loadMore: () => void;
};

function unreadLabel(count: number) {
  return `${count} ${count === 1 ? "notificação não lida" : "notificações não lidas"}`;
}

export function StaffNotificationPanel({ items, unreadCount, nextCursor, loading, openingId, error, returnFocus, close, openNotification, reload, loadMore }: PanelProps) {
  const busy = loading || Boolean(openingId);
  return (
    <SidePanel title="Notificações" label={unreadLabel(unreadCount)} closeLabel="Fechar notificações" onClose={close} returnFocus={returnFocus}>
      <div className="tw:grid tw:content-start tw:gap-3" aria-busy={busy}>
        {error && (
          <div className="tw:grid tw:justify-items-start tw:gap-2">
            <p role="alert" className="tw:m-0 tw:text-sm tw:text-ui-danger">{error}</p>
            <Button variant="outline" disabled={busy} onClick={reload}>Atualizar notificações</Button>
          </div>
        )}
        {loading && items.length === 0 && <p role="status" className="tw:m-0 tw:text-sm tw:text-ui-muted">Carregando notificações...</p>}
        {!loading && !error && items.length === 0 && <p className="tw:m-0 tw:text-sm tw:text-ui-muted">Nenhuma notificação.</p>}
        {items.length > 0 && (
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0">
            {items.map((item) => (
              <li key={item.id} className="tw:min-w-0">
                <Button
                  variant="custom"
                  className="tw:min-h-16 tw:w-full tw:min-w-0 tw:justify-between tw:gap-3 tw:rounded-xl tw:border-card-border tw:bg-card-surface tw:px-3 tw:py-2 tw:text-left tw:text-ui-text tw:enabled:hover:bg-card-page tw:data-[unread=true]:bg-ui-accent-soft"
                  data-unread={!item.read}
                  disabled={busy}
                  onClick={() => openNotification(item.id)}
                >
                  <span className="tw:grid tw:min-w-0 tw:gap-1">
                    <strong className="tw:font-semibold">{notificationTitle[item.type]}</strong>
                    <span className="tw:text-xs tw:break-all tw:text-ui-muted">Protocolo {item.protocol}</span>
                    <time dateTime={item.createdAt} className="tw:text-xs tw:text-ui-muted">{formatDateTime(item.createdAt)}</time>
                  </span>
                  {openingId === item.id ? <span className="tw:text-xs">Abrindo...</span> : !item.read && (
                    <span className="tw:shrink-0 tw:text-xs tw:font-semibold tw:text-ui-accent-strong">Não lida</span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {nextCursor && (
          <Button variant="outline" className="tw:justify-self-center" disabled={busy} onClick={loadMore}>
            {loading ? "Carregando..." : "Carregar mais"}
          </Button>
        )}
      </div>
    </SidePanel>
  );
}

export function StaffNotificationBell({ municipalityId, onOpenRequest }: { municipalityId: string; onOpenRequest: (request: AnyRecord) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const notifications = useStaffNotifications(municipalityId, onOpenRequest);
  const { unreadCount } = notifications;
  return (
    <>
      <Button
        ref={trigger}
        variant="outline"
        className="tw:relative tw:w-10 tw:shrink-0 tw:px-0"
        aria-label={unreadCount ? `Notificações, ${unreadLabel(unreadCount)}` : "Notificações"}
        aria-expanded={notifications.open}
        aria-haspopup="dialog"
        onClick={notifications.show}
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="tw:absolute tw:-top-1 tw:-right-1 tw:min-w-4 tw:rounded-full tw:bg-ui-accent-strong tw:px-1 tw:py-0.5 tw:text-center tw:text-[0.625rem] tw:font-semibold tw:leading-none tw:text-white" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>
      {notifications.open && createPortal(<StaffNotificationPanel {...notifications} returnFocus={trigger.current} />, document.body)}
    </>
  );
}
