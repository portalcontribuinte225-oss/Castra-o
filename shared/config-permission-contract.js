import { NotificationChannel } from "./notification-contract.js";
import { EMAIL_SETTINGS_PERMISSION } from "./email-contract.js";

// The items of a permission group that open an integration tab. Whoever has the item may also turn the messages of that channel
// on and off and read its contract counter; the integration itself (credentials, test, contract) is the platform's.
export const IntegrationConfigItem = Object.freeze({
  WHATSAPP: "whatsapp_settings",
  SMS: "sms_settings",
  EMAIL: EMAIL_SETTINGS_PERMISSION,
});

// The item of a permission group that opens "Dados Gerais", where the contact, the address, the department and the coat of arms of the
// municipality are edited.
export const GENERAL_DATA_CONFIG_ITEM = "municipalities";

export const CHANNEL_CONFIG_ITEMS = Object.freeze({
  [NotificationChannel.WHATSAPP]: IntegrationConfigItem.WHATSAPP,
  [NotificationChannel.SMS]: IntegrationConfigItem.SMS,
  [NotificationChannel.EMAIL]: IntegrationConfigItem.EMAIL,
});
