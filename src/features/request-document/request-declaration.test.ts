import { describe, expect, it } from "vitest";
import { declarationIntro, renderDeclaration } from "./request-declaration";

const declarationText = (municipalityName?: string) => renderDeclaration({ municipalityName }).groups.flatMap(({ items }) => items).join("\n");

describe("the declaration of the request", () => {
  it("names the municipality of the request in the clause about residents", () => {
    const declaration = renderDeclaration({ municipalityName: "  Test   Town  " });
    expect(declaration.groups.map(({ items }) => items.length)).toEqual([4, 5]);
    expect(declarationText("  Test   Town  ")).toMatch(/não residentes no município de Test Town/);
    expect(declarationText()).toMatch(/não residentes no município, nem cobrarei/);
    expect(declarationText("Test Town")).not.toMatch(/Içara|\{municipality\}/);
    expect(declaration.recommendations.join("\n")).toMatch(/Jejum e demais cuidados devem seguir a orientação individual/);
  });

  it("limits a very long name and writes a name once and literally", () => {
    expect(declarationText("M".repeat(500))).not.toMatch(/M{121}/);
    expect(declarationText("{municipality} $&")).toMatch(/município de \{municipality\} \$&/);
  });

  it("gives each rendering its own copy of the groups and recommendations", () => {
    const declaration = renderDeclaration();
    declaration.groups[0].items.pop();
    declaration.recommendations.pop();
    const next = renderDeclaration();
    expect(next.groups[0].items).toHaveLength(4);
    expect(next.recommendations).toHaveLength(1);
  });

  it("opens with the tutor's name, or without a name when there is none", () => {
    expect(declarationIntro("Camila Andrade")).toBe("Eu, Camila Andrade, na condição de tutor(a) ou responsável pelos animais identificados neste requerimento, declaro, para os devidos fins, que:");
    expect(declarationIntro("  ")).toMatch(/^Eu, na condição de tutor\(a\)/);
  });
});
