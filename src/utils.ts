import type { AnyRecord } from "./types";

export function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isGlobalRole(role = "") {
  return ["master", "suporte"].includes(normalizeText(role));
}

export function normalizeSearchKey(value = "") {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

export function onlyDigits(value = "") {
  return value.replace(/\D/g, "");
}

export function formatCpf(value = "") {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function isValidCpf(value = "") {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calcCheckDigit(9) === Number(digits[9]) && calcCheckDigit(10) === Number(digits[10]);
}

export function isValidCnpj(value = "") {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const calcCheckDigit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * weights[i];
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calcCheckDigit(12) === Number(digits[12]) && calcCheckDigit(13) === Number(digits[13]);
}

export function isValidCpfOrCnpj(value = "") {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export function formatCnpj(value = "") {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatCpfOrCnpj(value = "") {
  const digits = onlyDigits(value);
  return digits.length > 11 ? formatCnpj(digits) : formatCpf(digits);
}

export function isValidPhone(value = "") {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
}

export function maskCpf(value = "") {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return value || "Não informado";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function formatDateTime(value = "") {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value || new Date().toLocaleString("pt-BR");
  return date.toLocaleString("pt-BR");
}

export function formatCep(value = "") {
  return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export function getDataUrlMimeType(dataUrl = "") {
  const match = String(dataUrl).match(/^data:([^;,]+)[;,]/);
  return match?.[1] || "";
}

export function getDocumentPreviewSource(document: AnyRecord = {}) {
  const raw = document.dataUrl
    || document.data_url
    || document.previewUrl
    || document.preview_url
    || document.url
    || document.content
    || "";
  if (!raw) return "";
  if (String(raw).startsWith("data:") || String(raw).startsWith("blob:") || String(raw).startsWith("http")) return raw;

  const mimeType = document.fileType || document.type || document.mimeType || "application/pdf";
  return `data:${mimeType};base64,${raw}`;
}

export function isRequestDocumentAttachment(document: AnyRecord = {}) {
  return document?.documentId?.startsWith?.("requerimento-")
    || document?.documentName === "Requerimento municipal";
}

export function getUserUploadedProcessDocuments(documents = []) {
  return (Array.isArray(documents) ? documents : []).filter((document) => !isRequestDocumentAttachment(document));
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function dataUrlToUint8Array(dataUrl = "") {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType = "application/pdf") {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}
