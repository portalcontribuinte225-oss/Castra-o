// The tutor's phone is how the municipality reaches them by SMS and WhatsApp, so it must be a mobile number with the area code:
// 11 digits, area code 11 to 99 and a 9 right after it (the same rule the SMS sending applies).
const MOBILE_PHONE_PATTERN = /^[1-9][1-9]9\d{8}$/;

export const MOBILE_PHONE_MESSAGE = "Informe o celular completo, com DDD e o 9: (00) 00000-0000.";

export const onlyPhoneDigits = (value) => String(value ?? "").replace(/\D/g, "");

export function isMobilePhone(value) {
  return MOBILE_PHONE_PATTERN.test(onlyPhoneDigits(value));
}
