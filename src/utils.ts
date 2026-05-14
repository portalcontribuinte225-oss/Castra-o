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

export function maskCpf(value = "") {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return value || "Nao informado";
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
