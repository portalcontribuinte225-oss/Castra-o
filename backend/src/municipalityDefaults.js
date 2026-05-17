export const DEFAULT_MUNICIPALITY_SECTOR_ID = "setor_gestao_municipal";
export const DEFAULT_MUNICIPALITY_SECTOR_NAME = "Gestão Municipal";
export const DEFAULT_PERMISSION_GROUP_ID = "grupo_acesso_total";

/**
 * Grupo de permissão padrão — acesso total ao município.
 * Aplicado ao admin_municipal criado automaticamente.
 * Não inclui "municipalities" (gestão de outros municípios, restrito a globais).
 */
export function buildDefaultPermissionGroup() {
  return {
    id: DEFAULT_PERMISSION_GROUP_ID,
    name: "Acesso total",
    active: true,
    allowedMenuItems: ["dashboard", "admin", "credenciamento", "agenda", "adocao", "relatorios", "config"],
    allowedConfigItems: ["environment", "users", "sectors", "permissions"],
  };
}

/**
 * Grupo de permissão operacional — analistas e servidores.
 * Pode visualizar e processar solicitações mas não acessa configuração estrutural.
 */
export function buildOperationalPermissionGroup() {
  return {
    id: "grupo_operacional",
    name: "Operacional",
    active: true,
    allowedMenuItems: ["dashboard", "admin", "agenda", "adocao"],
    allowedConfigItems: [],
  };
}

/**
 * Grupo de permissão para credenciados (ONG / protetor).
 * Acesso restrito ao painel de solicitações e agenda.
 */
export function buildCredenciatedPermissionGroup() {
  return {
    id: "grupo_credenciado",
    name: "Credenciado",
    active: true,
    allowedMenuItems: ["dashboard", "admin"],
    allowedConfigItems: [],
  };
}

export function buildDefaultSector() {
  return {
    id: DEFAULT_MUNICIPALITY_SECTOR_ID,
    name: DEFAULT_MUNICIPALITY_SECTOR_NAME,
    active: true,
    defaultMunicipalitySector: true,
  };
}

export function buildDefaultTeamUser(user = {}, municipalityId = "") {
  return {
    id: user.id,
    name: user.name || "Administrador municipal",
    email: user.email || "",
    defaultMunicipalityUser: true,
    sectorIds: [DEFAULT_MUNICIPALITY_SECTOR_ID],
    sectorId: DEFAULT_MUNICIPALITY_SECTOR_ID,
    municipalityId: user.municipality_id || user.municipalityId || municipalityId,
    role: "admin_municipal",
    matricula: "",
    cargo: "Administrador municipal",
    active: true,
    permissionGroupId: DEFAULT_PERMISSION_GROUP_ID,
  };
}

export function buildMunicipalityDefaultConfigs(municipality = {}, defaultUser = {}) {
  const municipalityId = municipality.id || "";
  const municipalityName = [municipality.name, municipality.state].filter(Boolean).join("/");
  const defaultSector = buildDefaultSector();
  const defaultPermissionGroup = buildDefaultPermissionGroup();
  const operationalGroup = buildOperationalPermissionGroup();
  const credenciatedGroup = buildCredenciatedPermissionGroup();
  const defaultTeamUser = buildDefaultTeamUser(defaultUser, municipalityId);
  const currentYear = new Date().getFullYear();

  return {
    "castragestao:document-types": [
      {
        id: "comprovante_residencia",
        name: "Comprovante de Residência",
        required: true,
        active: true,
        accept: ["image/jpeg", "image/png", "application/pdf"],
        maxSizeMb: 5,
        modelHint: "Comprovante recente com nome, endereço completo, cidade e data de emissão legíveis.",
        aiCriteria: "Nome; endereço completo; cidade; data de emissão recente; documento legível.",
        rejectionRules: "Endereço incompleto; cidade divergente; imagem ilegível; comprovante antigo.",
      },
    ],
    "castragestao:request-types": [
      {
        id: "castracao",
        name: "Castração",
        fee: "Gratuito",
        charged: false,
        billingDescription: "",
        billingAmount: "",
        billingDueDate: "",
        active: true,
        overrideDailyLimit: false,
        documents: [
          {
            id: "comprovante_residencia",
            name: "Comprovante de Residência",
            required: true,
            active: true,
            accept: ["image/jpeg", "image/png", "application/pdf"],
            maxSizeMb: 5,
          },
        ],
      },
    ],
    "castragestao:species": [
      { id: "canino", name: "Canino", active: true },
      { id: "felino", name: "Felino", active: true },
    ],
    "castragestao:sizes": [
      { id: "pequeno", name: "Pequeno", weightStart: "0", weightEnd: "5", weightUnit: "kg", description: "0-5 kg", active: true },
      { id: "medio", name: "Médio", weightStart: "5", weightEnd: "12", weightUnit: "kg", description: "5-12 kg", active: true },
      { id: "grande", name: "Grande", weightStart: "12", weightEnd: "", weightUnit: "kg", description: "A partir de 12 kg", active: true },
    ],
    "castragestao:teams": {
      sectors: [defaultSector],
      users: [defaultTeamUser],
    },
    // Três grupos de permissão de partida — admin pode personalizar depois
    "permission_groups": [defaultPermissionGroup, operationalGroup, credenciatedGroup],
    "castragestao:schedule-rules": [
      {
        id: `agenda_padrao_${municipalityId || Date.now()}`,
        description: "Agenda padrão",
        createdAt: new Date().toLocaleString("pt-BR"),
        active: true,
        unavailable: false,
        type: "Recorrência",
        kind: "Agenda",
        repeatEvery: 1,
        weekdays: [1, 2, 3, 4, 5],
        start: `01/01/${currentYear}`,
        end: `31/12/${currentYear}`,
        time: "08:00",
        vacancies: 10,
        slots: [{ time: "08:00", vacancies: 10 }],
        municipalityId,
        municipalityName,
        locationName: "",
        addressUrl: "",
        latitude: "",
        longitude: "",
      },
    ],
  };
}

export async function upsertMunicipalityDefaultConfigs(client, municipality = {}, defaultUser = {}) {
  const configs = buildMunicipalityDefaultConfigs(municipality, defaultUser);
  for (const [key, value] of Object.entries(configs)) {
    await client.query(
      `INSERT INTO config (key, municipality_id, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
       DO UPDATE SET value=$3, updated_at=NOW()`,
      [key, municipality.id, JSON.stringify(value)],
    );
  }

  return {
    defaultSector: configs["castragestao:teams"].sectors[0],
    defaultTeamUser: configs["castragestao:teams"].users[0],
    defaultScheduleRule: configs["castragestao:schedule-rules"][0],
  };
}
