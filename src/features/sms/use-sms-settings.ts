import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api } from "../../api";
import { createSmsSettingsController } from "./sms-settings-controller";

export function useSmsSettings(municipalityId: string, canManage: boolean) {
  const controller = useMemo(() => createSmsSettingsController(api, municipalityId, canManage), [municipalityId, canManage]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void controller.load(); return controller.cancel; }, [controller]);
  return { ...state, retry: controller.load, setToken: controller.setToken, setConfirmingRemoval: controller.setConfirmingRemoval,
    saveToken: controller.saveToken, toggleActive: controller.toggleActive, removeToken: controller.removeToken,
    setUseActive: controller.setUseActive, testConnection: controller.testConnection, setTestPhone: controller.setTestPhone, sendTest: controller.sendTest };
}
