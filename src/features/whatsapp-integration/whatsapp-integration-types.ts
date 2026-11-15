export interface CatalogTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  bodyText: string;
  variableCount: number;
  supported: boolean;
  unsupportedReason: string;
}

export interface TemplateCatalog {
  syncedAt: string;
  templates: CatalogTemplate[];
}

export interface MappingItem {
  kind: "field" | "text";
  value: string;
}

export interface EventBinding {
  templateName: string;
  languageCode: string;
  mapping: MappingItem[];
}

export type EventBindings = Record<string, EventBinding | null>;

export const emptyCatalog: TemplateCatalog = { syncedAt: "", templates: [] };
