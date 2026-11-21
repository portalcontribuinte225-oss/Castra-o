import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type { AnyRecord } from "../../types";
import { useAuthOperation } from "../tutor-access/use-auth-operation";
import type { StaffNotificationPage } from "./staff-notification-types";

const REFRESH_INTERVAL = 60_000;
const EMPTY_PAGE: StaffNotificationPage = { items: [], unreadCount: 0, nextCursor: null };

export function useStaffNotifications(municipalityId: string, onOpenRequest: (request: AnyRecord) => void) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState("");
  const [error, setError] = useState("");
  const { begin, cancel } = useAuthOperation(municipalityId);

  const load = useCallback(async (cursor = "") => {
    const operation = begin();
    setLoading(true);
    setError("");
    try {
      const next = await api.listStaffNotifications(municipalityId, cursor, operation);
      if (!operation.isCurrent()) return;
      setPage((current) => {
        if (!cursor) return next;
        const seen = new Set(current.items.map((item) => item.id));
        return { ...next, items: [...current.items, ...next.items.filter((item) => !seen.has(item.id))] };
      });
    } catch {
      if (operation.isCurrent()) setError("Não foi possível carregar as notificações.");
    } finally {
      if (operation.isCurrent()) setLoading(false);
    }
  }, [begin, municipalityId]);

  useEffect(() => {
    if (open) return;
    const refresh = () => { if (!document.hidden) void load(); };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, REFRESH_INTERVAL);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(interval);
    };
  }, [open, load]);

  function show() {
    setOpen(true);
    void load();
  }

  function close() {
    cancel();
    setLoading(false);
    setOpeningId("");
    setOpen(false);
  }

  async function openNotification(id: string) {
    if (loading || openingId) return;
    const operation = begin();
    setOpeningId(id);
    setError("");
    try {
      const { request, unreadCount } = await api.openStaffNotification(id, municipalityId, operation);
      if (!operation.isCurrent()) return;
      setPage((current) => ({ ...current, unreadCount, items: current.items.map((item) => item.id === id ? { ...item, read: true } : item) }));
      onOpenRequest(request);
      setOpen(false);
    } catch (failure) {
      if (operation.isCurrent()) setError(failure instanceof ApiError && failure.status === 404
        ? "Este processo está indisponível." : "Não foi possível abrir o processo.");
    } finally {
      if (operation.isCurrent()) setOpeningId("");
    }
  }

  return {
    ...page, open, loading, openingId, error, show, close, openNotification,
    reload: () => load(),
    loadMore: () => { if (page.nextCursor && !loading && !openingId) void load(page.nextCursor); },
  };
}
