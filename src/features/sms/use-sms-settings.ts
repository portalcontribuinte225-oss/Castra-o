import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api } from "../../api";
import { createSmsSettingsController } from "./sms-settings-controller";

export function useSmsSettings(municipalityId: string, master: boolean, canManage: boolean) {
  const controller = useMemo(() => createSmsSettingsController(api, municipalityId, master, canManage), [municipalityId, master, canManage]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void controller.load(); return controller.cancel; }, [controller]);
  return { ...state, retry: controller.load, setUseActive: controller.setUseActive, setTestPhone: controller.setTestPhone, sendTest: controller.sendTest };
}
