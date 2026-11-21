import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffNotificationType } from "../../../shared/staff-notifications-contract.js";
import { api } from "../../api";
import { StaffNotificationPanel } from "./staff-notification-bell";
import type { StaffNotification } from "./staff-notification-types";

const callbacks = { close: () => {}, openNotification: () => {}, reload: () => {}, loadMore: () => {} };
const emptyPanel = { items: [], unreadCount: 0, nextCursor: null, loading: false, openingId: "", error: "", returnFocus: null, ...callbacks };

describe("notification center", () => {
  it("shows the scoped results as actionable alerts and distinguishes unread items", () => {
    const created: StaffNotification = {
      id: "12", requestId: "request-a", municipalityId: "city-a", protocol: "001/2026",
      type: StaffNotificationType.REQUEST_CREATED, createdAt: "2026-11-20T10:00:00Z", read: false,
    };
    const assigned = { ...created, id: "11", type: StaffNotificationType.REQUEST_ASSIGNED, read: true };
    const html = renderToStaticMarkup(<StaffNotificationPanel {...emptyPanel} items={[created, assigned]} unreadCount={1} nextCursor="11" />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("1 notificação não lida");
    expect(html).toContain("Nova solicitação");
    expect(html).toContain("Processo atribuído a você");
    expect(html).toContain("Protocolo 001/2026");
    expect(html).toMatch(/<time datetime="2026-11-20T10:00:00Z"/i);
    expect(html.match(/data-unread="true"/g)).toHaveLength(1);
    expect(html).toContain("Carregar mais");
  });

  it("offers loading, empty and error feedback", () => {
    expect(renderToStaticMarkup(<StaffNotificationPanel {...emptyPanel} loading />)).toContain("Carregando notificações...");
    expect(renderToStaticMarkup(<StaffNotificationPanel {...emptyPanel} />)).toContain("Nenhuma notificação.");
    const error = renderToStaticMarkup(<StaffNotificationPanel {...emptyPanel} error="Este processo está indisponível." />);
    expect(error).toContain('role="alert"');
    expect(error).toContain("Atualizar notificações");
  });
});

describe("notification API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the scoped page and opens the authorized request by the alert ID", async () => {
    vi.stubGlobal("localStorage", { getItem: () => "staff-session" });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], unreadCount: 1, nextCursor: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ request: { id: "outside-current-filter" }, unreadCount: 0 })));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();

    await expect(api.listStaffNotifications("city-a", "12", { signal: controller.signal })).resolves.toMatchObject({ unreadCount: 1 });
    await expect(api.openStaffNotification("51", "city-a", { signal: controller.signal })).resolves.toEqual({
      request: { id: "outside-current-filter" }, unreadCount: 0,
    });
    expect(fetch.mock.calls[0][0]).toMatch(/\/notifications\?municipalityId=city-a&cursor=12$/);
    expect(fetch.mock.calls[1][0]).toMatch(/\/notifications\/51\/read\?municipalityId=city-a$/);
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: "POST", headers: { Authorization: "Bearer staff-session" }, signal: controller.signal,
    });
  });
});
