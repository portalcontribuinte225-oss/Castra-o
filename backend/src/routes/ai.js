import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();

const providerEnvKeys = {
  OpenAI: "OPENAI_API_KEY",
  Anthropic: "ANTHROPIC_API_KEY",
  Gemini: "GEMINI_API_KEY",
};

export const DEFAULT_MINIMUM_CONFIDENCE = 0.55;

router.post("/validate", async (req, res) => {
  try {
    const { document = {}, file = {}, aiSettings = {} } = req.body || {};
    const settings = await resolveAiSettings(aiSettings);
    const provider = settings.provider;
    const apiKey = settings.apiKey;
    const model = settings.model;

    if (!apiKey) {
      return res.status(400).json({ error: `Informe a chave API para ${provider}.` });
    }
    if (!model) {
      return res.status(400).json({ error: `Informe o modelo para ${provider}.` });
    }
    if (!file.dataUrl || !file.type) {
      return res.status(400).json({ error: "Arquivo invalido para analise." });
    }

    const normalizedDocument = normalizeDocumentPayload(document);
    const result = await validateWithProvider(provider, { apiKey, model, document: normalizedDocument, file });
    res.json({ ...result, model });
  } catch (err) {
    console.error("Erro na validacao por IA:", safeErrorMessage(err));
    res.status(err.status || 502).json({ error: safeErrorMessage(err) || "Nao foi possivel validar o documento com IA." });
  }
});

async function resolveAiSettings(requestSettings = {}) {
  const { rows } = await pool.query("SELECT value FROM config WHERE key=$1 AND municipality_id IS NULL", ["ai"]);
  const savedSettings = rows[0]?.value && typeof rows[0].value === "object" ? rows[0].value : {};
  const merged = { ...savedSettings, ...requestSettings };
  const provider = ["OpenAI", "Anthropic", "Gemini"].includes(merged.provider) ? merged.provider : "OpenAI";
  return {
    provider,
    apiKey: String(requestSettings.apiKey || savedSettings.apiKey || process.env[providerEnvKeys[provider]] || "").trim(),
    model: String(merged.model || "").trim(),
  };
}

async function validateWithProvider(provider, payload) {
  if (provider === "Gemini") return validateWithGemini(payload);
  if (provider === "Anthropic") return validateWithAnthropic(payload);
  return validateWithOpenAI(payload);
}

function normalizeDocumentPayload(document = {}) {
  return {
    id: String(document.id || "").trim(),
    name: String(document.name || "Documento").trim() || "Documento",
    analysisRules: normalizeAnalysisRules(document.analysisRules, document),
  };
}

function normalizeAnalysisRules(rules = {}, document = {}) {
  const minimumConfidence = Number(rules.minimumConfidence);
  return {
    expectedDocument: String(rules.expectedDocument || document.name || "Documento solicitado").trim(),
    requiredCriteria: toStringList(rules.requiredCriteria),
    rejectionCriteria: toStringList(rules.rejectionCriteria),
    manualReviewCriteria: toStringList(rules.manualReviewCriteria),
    matchRules: Array.isArray(rules.matchRules) ? rules.matchRules : [],
    minimumConfidence: Number.isFinite(minimumConfidence)
      ? Math.max(0, Math.min(1, minimumConfidence))
      : DEFAULT_MINIMUM_CONFIDENCE,
    allowAutomaticApproval: rules.allowAutomaticApproval !== false,
    allowAutomaticRejection: rules.allowAutomaticRejection === true,
  };
}

function toStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatRuleList(title, items) {
  if (!items.length) return `${title}: nenhum criterio especifico cadastrado.`;
  return `${title}:\n${items.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function buildPrompt(document = {}, file = {}) {
  const rules = normalizeAnalysisRules(document.analysisRules, document);

  return `
Voce e um validador documental para um sistema municipal de bem-estar animal.
Analise o arquivo anexado e responda somente em JSON valido.
Use exclusivamente o modelo de analise abaixo como fonte da decisao.

Privacidade obrigatoria:
- Nao retorne nome, CPF, RG, endereco, telefone, e-mail, assinatura, numero de documento ou qualquer dado pessoal lido no arquivo.
- Retorne apenas flags, checklist, motivos genericos e confianca.
- Se precisar mencionar divergencia, descreva de forma generica, sem copiar o dado encontrado.

Documento solicitado: ${document.name || "Documento"}
Arquivo: ${file.name || "arquivo"} (${file.type || "tipo desconhecido"})
Documento esperado: ${rules.expectedDocument || document.name || "Documento compatível com a solicitacao"}
Confianca minima configurada: ${rules.minimumConfidence}
Aprovacao automatica permitida: ${rules.allowAutomaticApproval ? "sim" : "nao"}
Recusa automatica permitida: ${rules.allowAutomaticRejection ? "sim" : "nao"}

${formatRuleList("Criterios obrigatorios", rules.requiredCriteria)}
${formatRuleList("Criterios de revisao manual", rules.manualReviewCriteria)}
${formatRuleList("Regras de recusa", rules.rejectionCriteria)}

Decida assim:
- Use "approved" apenas quando o documento condiz com os criterios obrigatorios e nao ha sinal relevante de recusa ou revisao.
- Use "needs_review" quando estiver legivel, mas houver duvida, baixa confianca, criterio parcialmente verificavel ou situacao prevista para revisao manual.
- Use "rejected" apenas quando houver evidencia clara de regra de recusa ou falta de criterio obrigatorio essencial.

Formato obrigatorio sem dados pessoais:
{
  "status":"approved|rejected|needs_review",
  "message":"explicacao curta em portugues, sem dados pessoais",
  "confidence":0.0,
  "criteriaResults":[{"criterion":"nome do criterio","met":true,"reason":"motivo generico"}],
  "rejectionReasons":["motivo generico"],
  "manualReviewReasons":["motivo generico"]
}
`.trim();
}

const validationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["approved", "rejected", "needs_review"] },
    message: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    criteriaResults: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          criterion: { type: "string" },
          met: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["criterion", "met", "reason"],
      },
    },
    rejectionReasons: { type: "array", items: { type: "string" } },
    manualReviewReasons: { type: "array", items: { type: "string" } },
  },
  required: ["status", "message", "confidence", "criteriaResults", "rejectionReasons", "manualReviewReasons"],
};

function splitDataUrl(dataUrl = "") {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Arquivo precisa estar em base64 data URL.");
  return { mediaType: match[1], base64: match[2] };
}

async function validateWithGemini({ apiKey, model, document, file }) {
  const { mediaType, base64 } = splitDataUrl(file.dataUrl);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: buildPrompt(document, file) },
          { inline_data: { mime_type: mediaType, data: base64 } },
        ],
      }],
      generationConfig: {
        temperature: 0,
        response_mime_type: "application/json",
      },
    }),
  });
  const data = await readProviderResponse(response);
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  return normalizeAiResult(text, "Gemini", document.analysisRules);
}

async function validateWithOpenAI({ apiKey, model, document, file }) {
  const isPdf = file.type === "application/pdf";
  const filePart = isPdf
    ? { type: "input_file", filename: file.name || "documento.pdf", file_data: file.dataUrl }
    : { type: "input_image", image_url: file.dataUrl };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "document_validation",
          strict: true,
          schema: validationSchema,
        },
      },
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: buildPrompt(document, file) },
          filePart,
        ],
      }],
    }),
  });
  const data = await readProviderResponse(response);
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n") || "";
  return normalizeAiResult(text, "OpenAI", document.analysisRules);
}

async function validateWithAnthropic({ apiKey, model, document, file }) {
  const { mediaType, base64 } = splitDataUrl(file.dataUrl);
  const isPdf = file.type === "application/pdf";
  const contentFile = isPdf
    ? { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: buildPrompt(document, file) },
          contentFile,
        ],
      }],
    }),
  });
  const data = await readProviderResponse(response);
  const text = data.content?.map((item) => item.text || "").join("\n") || "";
  return normalizeAiResult(text, "Anthropic", document.analysisRules);
}

async function readProviderResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.message || `Erro HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return data;
}

function normalizeAiResult(text, provider, rules = {}) {
  const parsed = parseJsonFromText(text);
  const normalizedStatus = normalizeStatus(parsed.status);
  const confidence = clampConfidence(parsed.confidence);
  const minimumConfidence = Number.isFinite(Number(rules.minimumConfidence)) ? Number(rules.minimumConfidence) : DEFAULT_MINIMUM_CONFIDENCE;
  const criteriaResults = normalizeCriteriaResults(parsed.criteriaResults);
  const rejectionReasons = toSanitizedList(parsed.rejectionReasons);
  const manualReviewReasons = toSanitizedList(parsed.manualReviewReasons);
  const message = sanitizeText(parsed.message || "Documento analisado pela IA.");

  if (normalizedStatus === "approved" && confidence >= minimumConfidence && rules.allowAutomaticApproval !== false) {
    return {
      status: "approved",
      aiVerdict: normalizedStatus,
      message: message || `Documento aprovado por ${provider} conforme os criterios configurados.`,
      confidence,
      provider,
      criteriaResults,
      rejectionReasons: [],
      manualReviewReasons,
    };
  }

  if (normalizedStatus === "rejected" && confidence >= minimumConfidence && rules.allowAutomaticRejection === true) {
    return {
      status: "rejected",
      aiVerdict: normalizedStatus,
      message: message || `Documento recusado por ${provider}: criterio obrigatorio nao atendido.`,
      confidence,
      provider,
      criteriaResults,
      rejectionReasons,
      manualReviewReasons,
    };
  }

  return {
    status: "attached",
    aiVerdict: normalizedStatus,
    message: manualReviewMessage(message, provider, normalizedStatus, confidence, minimumConfidence),
    confidence,
    provider,
    criteriaResults,
    rejectionReasons,
    manualReviewReasons: manualReviewReasons.length ? manualReviewReasons : defaultManualReviewReasons(normalizedStatus, confidence, minimumConfidence),
  };
}

function manualReviewMessage(message, provider, status, confidence, minimumConfidence) {
  if (status === "rejected") return "Documento encaminhado para conferencia manual antes de recusa definitiva.";
  if (confidence < minimumConfidence) return `O ${provider} nao confirmou todos os criterios com seguranca. Documento encaminhado para conferencia manual.`;
  return message || `O ${provider} recomendou conferencia manual do documento.`;
}

function defaultManualReviewReasons(status, confidence, minimumConfidence) {
  if (confidence < minimumConfidence) return ["Confianca abaixo do minimo configurado."];
  if (status === "rejected") return ["Recusa automatica desativada para este documento."];
  return ["Analise automatica inconclusiva."];
}

function normalizeCriteriaResults(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    criterion: sanitizeText(item?.criterion || "Criterio avaliado"),
    met: Boolean(item?.met),
    reason: sanitizeText(item?.reason || ""),
  })).filter((item) => item.criterion);
}

function toSanitizedList(value) {
  return toStringList(value).map(sanitizeText).filter(Boolean);
}

function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[cnpj]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[numero]")
    .slice(0, 260);
}

function safeErrorMessage(err = {}) {
  return sanitizeText(err.message || "Erro desconhecido");
}

function normalizeStatus(status = "") {
  const value = String(status).trim().toLowerCase();
  if (["approved", "approve", "aprovado", "aprovada", "valid", "valido"].includes(value)) return "approved";
  if (["needs_review", "review", "manual_review", "inconclusive", "inconclusivo", "revisao"].includes(value)) return "needs_review";
  if (["rejected", "reject", "recusado", "recusada", "invalid", "invalido"].includes(value)) return "rejected";
  return "needs_review";
}

function parseJsonFromText(text = "") {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.75;
  return Math.max(0, Math.min(1, number));
}

export default router;
