import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();

const providerEnvKeys = {
  OpenAI: "OPENAI_API_KEY",
  Anthropic: "ANTHROPIC_API_KEY",
  Gemini: "GEMINI_API_KEY",
};

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
      return res.status(400).json({ error: "Arquivo inválido para análise." });
    }

    const result = await validateWithProvider(provider, { apiKey, model, document, file });
    res.json({ ...result, model });
  } catch (err) {
    console.error("Erro na validação por IA:", err);
    res.status(err.status || 502).json({ error: err.message || "Não foi possível validar o documento com IA." });
  }
});

async function resolveAiSettings(requestSettings = {}) {
  const { rows } = await pool.query("SELECT value FROM config WHERE key=$1", ["ai"]);
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

function buildPrompt(document = {}, file = {}) {
  const rules = [
    document.modelHint && `Descrição esperada: ${document.modelHint}`,
    document.aiCriteria && `Critérios cadastrados pelo administrador: ${document.aiCriteria}`,
    document.rejectionRules && `Recuse apenas nestes casos ou em falhas equivalentes: ${document.rejectionRules}`,
  ].filter(Boolean).join("\n");

  return `
Você é um validador documental para um sistema municipal de castração animal.
Analise o arquivo anexado e responda somente em JSON válido.
Use os critérios cadastrados como fonte principal da decisão.
Considere o documento aprovado quando o conteúdo visível atende aos critérios exigidos, mesmo que a digitalização esteja rotacionada, tenha fundo simples, seja PDF escaneado ou tenha pequenas imperfeições que não impeçam a leitura.
Não recuse por excesso de rigor, por ausência de campos que não foram exigidos, por diferença de formatação, ou por não conseguir validar autenticidade oficial do documento.
Recuse somente quando houver evidência clara de documento errado, ilegível, cortado de forma crítica, vencido quando validade for exigida, ou sem uma informação obrigatória cadastrada.
Se o arquivo estiver legível mas você não conseguir confirmar todos os critérios com segurança, use status "needs_review" em vez de "rejected".

Documento solicitado: ${document.name || "Documento"}
Arquivo: ${file.name || "arquivo"} (${file.type || "tipo desconhecido"})
${rules || "Regra: validar se o arquivo parece legível e compatível com o documento solicitado."}

Formato obrigatório:
{"status":"approved|rejected|needs_review","message":"explicação curta em português","confidence":0.0}
`.trim();
}

const validationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["approved", "rejected", "needs_review"] },
    message: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["status", "message", "confidence"],
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
  return normalizeAiResult(text, "Gemini");
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
  return normalizeAiResult(text, "OpenAI");
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
      max_tokens: 600,
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
  return normalizeAiResult(text, "Anthropic");
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

function normalizeAiResult(text, provider) {
  const parsed = parseJsonFromText(text);
  const normalizedStatus = normalizeStatus(parsed.status);
  const confidence = clampConfidence(parsed.confidence);
  if (normalizedStatus === "approved") {
    return {
      status: "approved",
      message: parsed.message || `Documento aprovado por ${provider}.`,
      confidence,
      provider,
    };
  }

  if (normalizedStatus === "needs_review" || confidence < 0.55) {
    return {
      status: "attached",
      message: parsed.message || `O ${provider} não confirmou todos os critérios com segurança. Documento encaminhado para conferência manual.`,
      confidence,
      provider,
    };
  }

  return {
    status: "rejected",
    message: parsed.message || `Documento recusado por ${provider}: critério obrigatório não atendido.`,
    confidence,
    provider,
  };
}

function normalizeStatus(status = "") {
  const value = String(status).trim().toLowerCase();
  if (["approved", "approve", "aprovado", "aprovada", "valid", "válido", "valido"].includes(value)) return "approved";
  if (["needs_review", "review", "manual_review", "inconclusive", "inconclusivo", "revisao", "revisão"].includes(value)) return "needs_review";
  if (["rejected", "reject", "recusado", "recusada", "invalid", "inválido", "invalido"].includes(value)) return "rejected";
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
