import { createHash } from "node:crypto";
import { MAX_REQUEST_JSON_BYTES } from "../../../../shared/document-reuse-contract.js";

export function documentError(message, status = 400) { return Object.assign(new Error(message), { status }); }

function sniffContentType(bytes) {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString())) return "image/gif";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return "";
}

export function decodeDocumentContent(document, definition = {}) {
  const raw = document?.dataUrl || document?.data_url || document?.content;
  if (typeof raw !== "string" || raw.length > MAX_REQUEST_JSON_BYTES) throw documentError("Anexo ausente ou acima do limite permitido.");
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(raw);
  if (!match || !match[2] || match[2].length % 4 !== 0) throw documentError("Envie um arquivo PDF ou imagem válido; links externos não são aceitos.");
  const bytes = Buffer.from(match[2], "base64");
  const contentType = sniffContentType(bytes);
  const allowed = Array.isArray(definition.accept) && definition.accept.length ? definition.accept : ["application/pdf", "image/png", "image/jpeg"];
  const maxBytes = (Number(definition.maxSizeMb) > 0 ? Math.min(Number(definition.maxSizeMb), 12) : 5) * 1024 * 1024;
  if (!contentType || contentType !== match[1].toLowerCase() || !allowed.includes(contentType) || bytes.toString("base64") !== match[2]) {
    throw documentError("O conteúdo do anexo não corresponde a um formato permitido.");
  }
  if (bytes.length > maxBytes) throw documentError("O anexo ultrapassa o tamanho permitido.");
  return { bytes, contentType, size: bytes.length, hash: createHash("sha256").update(bytes).digest("hex"), dataUrl: `data:${contentType};base64,${match[2]}` };
}

export function assertMaterializedRequestSize(value) {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_REQUEST_JSON_BYTES) {
    throw documentError("Os anexos e dados do pedido ultrapassam 16 MB. Reduza os arquivos e tente novamente.", 413);
  }
}
