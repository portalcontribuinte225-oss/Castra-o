import { describe, expect, it } from "vitest";
import { RequestOrigin } from "../../../shared/request-contract.js";
import { RequestAcceptance, requestAcceptance } from "./request-acceptance";

const signedAt = "2026-11-16T12:00:00.000Z";
const createdAt = "2026-11-16T11:59:00.000Z";

describe("how the request document records the tutor's agreement", () => {
  it("a public request carries the electronic acceptance, at the moment it was signed", () => {
    expect(requestAcceptance({ origin: RequestOrigin.PUBLIC, signedAt, createdAt })).toEqual({ kind: RequestAcceptance.ELECTRONIC, at: signedAt });
    expect(requestAcceptance({ origin: RequestOrigin.PUBLIC, signed_at: signedAt, created_at: createdAt })).toEqual({ kind: RequestAcceptance.ELECTRONIC, at: signedAt });
    expect(requestAcceptance({ signedAt }).kind).toBe(RequestAcceptance.ELECTRONIC);
  });

  it("a request made at the counter has no electronic acceptance: it is registered by the staff, whatever signature date it carries", () => {
    expect(requestAcceptance({ origin: RequestOrigin.INTERNAL, createdAt })).toEqual({ kind: RequestAcceptance.COUNTER, at: createdAt });
    expect(requestAcceptance({ origin: RequestOrigin.INTERNAL, signedAt, created_at: createdAt })).toEqual({ kind: RequestAcceptance.COUNTER, at: createdAt });
  });

  it("falls back to the registration when the signature has no date, and to nothing when the request has no date yet", () => {
    expect(requestAcceptance({ origin: RequestOrigin.PUBLIC, signedAt: "", createdAt })).toEqual({ kind: RequestAcceptance.ELECTRONIC, at: createdAt });
    expect(requestAcceptance({ origin: RequestOrigin.INTERNAL })).toEqual({ kind: RequestAcceptance.COUNTER, at: "" });
    expect(requestAcceptance()).toEqual({ kind: RequestAcceptance.ELECTRONIC, at: "" });
  });
});
