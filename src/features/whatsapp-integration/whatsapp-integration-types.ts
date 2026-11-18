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
  // Whether the templates screen linked it to a notice, which notice, and the field of each numbered variable.
  configured: boolean;
  linkedUse: string;
  fields: string[];
  bodyText: string;
  bodyVariables: number;
  configurable: boolean;
  // Why the template cannot carry a notice at all ("" when its structure fits).
  structureReason: string;
}

export interface WhatsappTemplateList {
  syncedAt: string;
  templates: WhatsappTemplateRow[];
  // What each field shows in the preview of a template being configured.
  fieldSamples: Record<string, string>;
}

export const emptyTemplateList: WhatsappTemplateList = { syncedAt: "", templates: [], fieldSamples: {} };
