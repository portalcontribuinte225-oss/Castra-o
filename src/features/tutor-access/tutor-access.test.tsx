import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AuthAudience, validateNewPassword } from "../../../shared/auth-contract.js";
import { SessionBoundary } from "./session-boundary";
import { EnrollmentNotice } from "./enrollment-notice";
import { splitSubmissionEnvelope, stripEphemeralCredentials, stripMunicipalityBootstrap } from "./submission-envelope";
import { validateTutorName } from "./tutor-identity";
import { AuthEntry } from "./auth-entry";
import type { SessionUser } from "./auth-types";
import { challengeWindow } from "./use-auth-challenge-clock";

const user: SessionUser = { id: "tutor-a", name: "Ana", role: AuthAudience.TUTOR, municipalityId: "municipality-a", mustChangePassword: false };
const baseSession = { user: null, ready: true, error: "", accept: vi.fn(), logout: vi.fn(), retry: vi.fn() };

describe("session boundaries", () => {
  it("does not mount any workspace before server session validation finishes", () => {
    const workspace = vi.fn(() => <p>Administrative data</p>);
    const tutor = vi.fn(() => <p>Private tutor data</p>);
    const html = renderToStaticMarkup(<SessionBoundary session={{ ...baseSession, user, ready: false }} renderWorkspace={workspace} renderTutor={tutor} />);
    expect(workspace).not.toHaveBeenCalled(); expect(tutor).not.toHaveBeenCalled();
    expect(html).toContain("Validando sua sessão");
  });

  it("keeps both tutor and staff data outside a mandatory password-change session", () => {
    for (const role of [AuthAudience.TUTOR, "admin_municipal"]) {
      const workspace = vi.fn(() => <p>Administrative data</p>);
      const tutor = vi.fn(() => <p>Private tutor data</p>);
      const html = renderToStaticMarkup(<SessionBoundary session={{ ...baseSession, user: { ...user, role, mustChangePassword: true } }} renderWorkspace={workspace} renderTutor={tutor} />);
      expect(html).toContain("Crie sua senha");
      expect(workspace).not.toHaveBeenCalled(); expect(tutor).not.toHaveBeenCalled();
    }
  });

  it("routes a full tutor session exclusively to its own area", () => {
    const workspace = vi.fn(() => <p>Administrative data</p>);
    const tutor = vi.fn(() => <p>Minhas solicitações</p>);
    renderToStaticMarkup(<SessionBoundary session={{ ...baseSession, user }} renderWorkspace={workspace} renderTutor={tutor} />);
    expect(workspace).not.toHaveBeenCalled(); expect(tutor).toHaveBeenCalledWith(user);
  });

  it("keeps staff login available and gives a safe bootstrap retry state", () => {
    const workspace = vi.fn(() => <p>Workspace</p>);
    const tutor = vi.fn(() => null);
    renderToStaticMarkup(<SessionBoundary session={{ ...baseSession, user: { ...user, role: "analista" } }} renderWorkspace={workspace} renderTutor={tutor} />);
    expect(workspace).toHaveBeenCalled(); expect(tutor).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(<SessionBoundary session={{ ...baseSession, ready: false, error: "offline" }} renderWorkspace={workspace} renderTutor={tutor} />);
    expect(html).toContain("Tentar novamente"); expect(html).toContain("Sair");
  });
});

describe("credential isolation", () => {
  it("keeps the one-time credential outside the request used by global state and PDFs", () => {
    const enrollment = { temporaryPassword: "one-time-secret", cpf: "12345678900", municipalityId: "municipality-a" };
    const split = splitSubmissionEnvelope({ request: { id: "request-a", enrollment, temporaryPassword: "unexpected-secret" }, enrollment });
    expect(split.enrollment).toBe(enrollment);
    expect(split.request).toEqual({ id: "request-a" });
    expect(JSON.stringify(split.request)).not.toContain("secret");
    expect(stripEphemeralCredentials({ id: "access-a", credential: { temporaryPassword: "secret" }, temporary_password: "secret", password: "secret" })).toEqual({ id: "access-a" });
  });

  it("cannot recover an existing account password from a response without enrollment", () => {
    const split = splitSubmissionEnvelope({ request: { id: "request-a" } });
    expect(split.enrollment).toBeUndefined();
    const html = renderToStaticMarkup(<EnrollmentNotice onDismiss={() => {}} onLogin={() => {}} />);
    expect(html).toContain("Se você já possui acesso");
    expect(html).not.toContain("Senha inicial:");
  });

  it("removes municipality-bootstrap credentials before a failed-refresh fallback stores the row", () => {
    const row = stripMunicipalityBootstrap({ id: "municipality-a", name: "Município A", active: true, defaultUser: { email: "admin@example.com", temporaryPassword: "bootstrap-secret" }, credential: { temporaryPassword: "bootstrap-secret" }, defaultSector: { id: "sector-a" } });
    expect(row).toEqual({ id: "municipality-a", name: "Município A", active: true });
    expect(JSON.stringify(row)).not.toContain("bootstrap-secret");
  });

  it("shows a newly issued password only in the explicit conclusion component", () => {
    const html = renderToStaticMarkup(<EnrollmentNotice credential={{ temporaryPassword: "one-time-secret", cpf: "12345678900", municipalityId: "municipality-a" }} onDismiss={() => {}} onLogin={() => {}} />);
    expect(html).toContain("one-time-secret"); expect(html).toContain("somente nesta conclusão"); expect(html).toContain("ocultar senha");
    expect(html).toContain("envio ao contato não foi confirmado");
  });
});

describe("tutor entry and validation", () => {
  it("accepts CPF in the inherited tutor context without audience or municipality selectors", () => {
    const html = renderToStaticMarkup(<AuthEntry audience={AuthAudience.TUTOR} municipalityId="municipality-a" onLogin={() => {}} onClose={() => {}} />);
    expect(html).toContain("CPF ou e-mail"); expect(html).toContain("Entrar como tutor");
    expect(html).toContain('type="text"'); expect(html).toContain("use seu CPF");
    expect(html).not.toContain("<select"); expect(html).not.toContain('type="radio"');
  });

  it("preserves global staff entry without a municipality and blocks missing tutor context", () => {
    const staff = renderToStaticMarkup(<AuthEntry audience={AuthAudience.STAFF} municipalityId="" onLogin={() => {}} onClose={() => {}} />);
    expect(staff).toContain("Entrar como equipe"); expect(staff).toContain("E-mail da equipe"); expect(staff).not.toContain("CPF ou e-mail");
    const tutor = renderToStaticMarkup(<AuthEntry audience={AuthAudience.TUTOR} municipalityId="" onLogin={() => {}} onClose={() => {}} />);
    expect(tutor).toContain("Selecione o município na página"); expect(tutor).not.toContain("<form");
  });

  it("enforces names and password length without artificial composition", () => {
    expect(validateTutorName(" ")).not.toBe(""); expect(validateTutorName("A")).not.toBe("");
    expect(validateTutorName("Ana Maria")).toBe(""); expect(validateTutorName("x".repeat(161))).not.toBe("");
    expect(validateNewPassword("senha com espaços longa")).toBe("");
    expect(validateNewPassword("curta")).not.toBe("");
    for (const password of ["abcdef", "123456", "a b!? "]) expect(validateNewPassword(password)).toBe("");
    expect(validateNewPassword("😀".repeat(19))).not.toBe("");
  });

  it("respects challenge expiry and resend cooldown using elapsed time", () => {
    const challenge = { challengeId: "opaque-id", expiresIn: 600, retryAfter: 60 };
    expect(challengeWindow(challenge, 1000, 61000)).toEqual({ expiresIn: 540, retryIn: 0 });
    expect(challengeWindow(challenge, 1000, 602000)).toEqual({ expiresIn: 0, retryIn: 0 });
    expect(challengeWindow(null, 1000, 1000)).toEqual({ expiresIn: 0, retryIn: 0 });
  });
});
