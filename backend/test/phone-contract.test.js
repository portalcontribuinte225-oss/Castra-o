import test from "node:test";
import assert from "node:assert/strict";
import { MOBILE_PHONE_MESSAGE, isMobilePhone, onlyPhoneDigits } from "../../shared/phone-contract.js";

test("a mobile is eleven digits with the area code and a 9 right after it, written however the person typed it", () => {
  for (const good of ["48999991234", "(48) 99999-1234", "48 9 9999 1234", "(11) 91234-5678", "99 9 8888 7777", " (48)99999-1234 "]) assert.equal(isMobilePhone(good), true, good);
});

test("a landline, a number without the 9 or the area code, an invalid area code and anything else is not a mobile", () => {
  for (const bad of ["(48) 3333-4444", "4833334444", "(48) 8999-1234", "(48) 99999-123", "(48) 99999-12345", "999991234", "(00) 99999-1234", "(10) 99999-1234",
    "(48) 29999-1234", "5548999991234", "", "   ", "abc", undefined, null, 48999991234.5, {}, []]) assert.equal(isMobilePhone(bad), false, String(bad));
  assert.equal(isMobilePhone(48999991234), true, "a number typed without any mask");
});

test("the digits are what is left after the mask, and the message shows the way to write it", () => {
  assert.equal(onlyPhoneDigits("(48) 99999-1234"), "48999991234");
  assert.equal(onlyPhoneDigits(undefined), "");
  assert.equal(onlyPhoneDigits(null), "");
  assert.match(MOBILE_PHONE_MESSAGE, /celular completo.*\(00\) 00000-0000/);
});
