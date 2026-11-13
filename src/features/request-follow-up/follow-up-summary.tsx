import React from "react";
import { maskFollowUpEmail, maskFollowUpPhone } from "./follow-up";

export function FollowUpSummary({ value }: { value?: { enabled: boolean; email?: string; phone?: string } }) {
  if (typeof value?.enabled !== "boolean") return null;
  if (!value.enabled) return <p>Você escolheu não receber avisos. Guarde seu protocolo.</p>;
  const contacts = [maskFollowUpEmail(value.email || ""), maskFollowUpPhone(value.phone || "")].filter(Boolean);
  return <p>Contatos para receber atualizações: <strong>{contacts.join(" · ")}</strong>.</p>;
}
