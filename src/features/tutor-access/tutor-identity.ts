export function validateTutorName(name: string): string {
  const length = String(name || "").trim().length;
  return length < 2 || length > 160 ? "Informe o nome do tutor com 2 a 160 caracteres." : "";
}
