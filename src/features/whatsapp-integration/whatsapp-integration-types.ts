// One row of the template table, already judged by the server: what the template serves, why it does not fit, whether it is on.
export interface WhatsappTemplateRow {
  name: string;
  language: string;
  status: string;
  category: string;
  label: string;
  uses: string[];
  variables: string[];
  reason: string;
  active: boolean;
  canActivate: boolean;
}

export interface WhatsappTemplateList {
  syncedAt: string;
  templates: WhatsappTemplateRow[];
}

export const emptyTemplateList: WhatsappTemplateList = { syncedAt: "", templates: [] };
