export function normalizeCpf(cpf = "") {
  return String(cpf || "").replace(/\D/g, "");
}

export function normalizeCnpj(cnpj = "") {
  return String(cnpj || "").replace(/\D/g, "");
}

export function isValidCpf(value = "") {
  const digits = normalizeCpf(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calcCheckDigit(9) === Number(digits[9]) && calcCheckDigit(10) === Number(digits[10]);
}

export function isValidCnpj(value = "") {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const calcCheckDigit = (length) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * weights[i];
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calcCheckDigit(12) === Number(digits[12]) && calcCheckDigit(13) === Number(digits[13]);
}

export function isValidCpfOrCnpj(value = "") {
  const digits = normalizeCpf(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export function isValidPhone(value = "") {
  const digits = normalizeCpf(value);
  return digits.length === 10 || digits.length === 11;
}
