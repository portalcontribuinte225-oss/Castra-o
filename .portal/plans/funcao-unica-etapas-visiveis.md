# Plano de Implementação: Função única de etapas visíveis do cadastro de solicitação

## Origem

- Arquivo de especificação: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md` (fase 1 do roadmap)
- Data do planejamento: `2026-11-12`
- Classificação: `frontend-only`

Motivo da classificação: a mudança fica em `NewRequest` (`src/App.tsx`) e em um módulo novo de lógica pura. Nenhuma rota, schema, permissão ou regra de tenant é alterada. Os tipos de solicitação continuam persistidos como configuração (`castragestao:request-types`), pelo mesmo caminho de hoje.

---

## Resumo

A visibilidade das etapas do formulário `NewRequest` está espalhada: três constantes (`typeStepTutor`, `typeStepAgenda`, `typeStepDocuments`), um ternário aninhado com quatro `.filter` que monta `formSteps`, guardas repetidas em `getRequestValidationIssues` e `getStepIssues`, e números mágicos (`formStep === 0/1/2/3`) no JSX.

Esta fase extrai uma função pura e testada, `getVisibleSteps`, em módulo próprio. Ela recebe uma **lista de configurações** (`configs`) e aplica a "regra de combinação" do spec: a etapa só aparece se **todas** as configurações permitirem. Hoje a lista terá só o tipo de solicitação; a fase 2 acrescenta o tipo de identificação sem refatorar de novo. O comportamento do fluxo público e do interno permanece o mesmo, com uma única correção: a declaração (`accepted`) deixa de ser exigida quando a etapa Documentos não existe (hoje isso gera um beco sem saída).

### Correções em relação ao texto do spec (estado do código conferido em 2026-11-12)

- O "bug" de `createRequestType` **já está corrigido**: ele persiste `stepTutor`, `stepAgenda` e `stepDocuments` (`src/App.tsx:7224-7226`).
- O plano `.portal/plans/reorganizar-etapas-tipo-solicitacao.md` **já foi implementado** (commit `8185937`): toggles acima do campo Nome, um por linha, e toggle "Documentos" removido do modal. Não há nada a absorver.
- Existe suíte de testes: `vitest` (`npm test`), com testes em `src/features/request-filters/`. O plano antigo afirmava que não havia.

---

## Escopo

### Dentro do escopo

- Novo módulo `src/features/request-steps/` com `RequestStep` (enum), `StepToggles`, `requestStepLabels` e `getVisibleSteps`, mais testes unitários.
- `NewRequest`: substituir as três constantes `typeStep*` e a cadeia de filtros de `formSteps` pela chamada a `getVisibleSteps`; derivar um `hasStep(step)` local para as guardas de validação.
- Trocar os literais numéricos de etapa (`formStep === 0/1/2/3`, `useState(internalSimple ? 0 : 1)`, `getStepIssues`) por `RequestStep.*`.
- Corrigir a exigência de `accepted` em `getRequestValidationIssues` para valer só quando a etapa Documentos existe.
- Remover o item morto `{ step: 3, label: "Finalização" }` da lista do fluxo interno (sempre filtrado hoje).

### Fora do escopo

- Tipo de identificação, combinação real com um segundo cadastro, textos de ajuda e resumo "Etapas desta solicitação: ..." (fase 2).
- Raças, canais de notificação, acesso do tutor, tela de entrada e remoção da chave de validação (fases 3 a 7).
- Modal de tipo de solicitação e CSS (já reorganizados no commit `8185937`).
- O `stepDocuments: true` forçado ao salvar (`src/App.tsx:7226` em `createRequestType` e `src/App.tsx:9714` no submit do modal): permanece como está. A fase 2 decide onde fica o controle da etapa Documentos.
- Migração de dados legados de tipos de solicitação.
- Backend, banco de dados e infra.
- O fluxo interno (`internalSimple`) continua ignorando as configurações de etapa, como hoje.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md` (único AGENT.md do projeto: não existem `frontend/AGENT.md` nem `backend/AGENT.md`)
- `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md`
- `.portal/plans/reorganizar-etapas-tipo-solicitacao.md`
- `src/App.tsx` (trechos de `NewRequest`: estado e etapas ~3330-3480, validações ~3561-3649, `submit` ~3759-3782, stepper ~3926-3949, JSX das etapas ~4010-4416; `createRequestType` ~7205-7229; `patchRequestType` ~7335; modal de tipo ~9707-9779)
- `src/features/request-filters/request-stage.ts` e `request-filters.test.ts` (padrão de enum, labels e testes)
- `package.json`, `tsconfig.json` (`strict: false`, `isolatedModules: true`), `src/types.ts` (`AnyRecord`)
- `backend/src/routes/config.js` (persistência de configuração, sem alteração)

---

## Impacto por área

### Frontend

**Novo módulo `src/features/request-steps/request-steps.ts`** (sem React, sem importar `App.tsx`; segue o padrão de `request-filters/request-stage.ts`):

```ts
export enum RequestStep {
  TUTOR = 0,
  ANIMAL = 1,
  SCHEDULE = 2,
  DOCUMENTS = 3,
}

export const requestStepLabels: Record<RequestStep, string> = {
  [RequestStep.TUTOR]: "Tutor",
  [RequestStep.ANIMAL]: "Animal",
  [RequestStep.SCHEDULE]: "Agenda",
  [RequestStep.DOCUMENTS]: "Documentos",
};

// Chaves persistidas em dados existentes (legado): não renomear.
export interface StepToggles {
  stepTutor?: boolean;
  stepAgenda?: boolean;
  stepDocuments?: boolean;
}

export interface RequestStepItem {
  step: RequestStep;
  label: string;
}

export interface VisibleStepsInput {
  internal: boolean;
  skipTutor: boolean;
  configs: Array<StepToggles | null | undefined>;
}

export function getVisibleSteps(input: VisibleStepsInput): RequestStepItem[];
```

Regras de `getVisibleSteps`:

| Situação | Etapas, na ordem |
|---|---|
| `internal: true` | TUTOR → ANIMAL → SCHEDULE (ignora `configs` e `skipTutor`, como hoje) |
| Público | ANIMAL → TUTOR → SCHEDULE → DOCUMENTS |

- ANIMAL sempre aparece.
- TUTOR sai se `skipTutor` for verdadeiro **ou** se algum config tiver `stepTutor === false`.
- SCHEDULE sai se algum config tiver `stepAgenda === false`.
- DOCUMENTS sai se algum config tiver `stepDocuments === false`.
- Só o valor estritamente `false` oculta: flag ausente, `undefined` e config `null`/`undefined` contam como "permite" (mesma semântica do `!== false` atual).
- Os rótulos permanecem exatamente os de hoje: "Tutor", "Animal", "Agenda", "Documentos".

**`NewRequest` em `src/App.tsx`** (números de linha no momento do planejamento; vão deslocar):

- Importar `getVisibleSteps` e `RequestStep`.
- Remover `typeStepTutor`, `typeStepAgenda`, `typeStepDocuments` (`~3441-3443`).
- Substituir a montagem de `formSteps` (`~3456-3477`) por `getVisibleSteps({ internal: internalSimple, skipTutor: skipTutorStep, configs: [selectedRequestType] })`. Manter `currentStepIndex`.
- Criar `const hasStep = (step: RequestStep) => formSteps.some((item) => item.step === step);` logo após `formSteps`.
- `getRequestValidationIssues` (`~3561-3582`): trocar `typeStepAgenda` por `hasStep(RequestStep.SCHEDULE)` e `typeStepDocuments` por `hasStep(RequestStep.DOCUMENTS)`, **mantendo** os `!internalSimple &&` das guardas (o fluxo interno não muda). Correção: `!internalSimple && hasStep(RequestStep.DOCUMENTS) && !accepted` (hoje é só `!internalSimple && !accepted`).
- `getStepIssues` (`~3584-3610`): usar `RequestStep.*` nas comparações. Em DOCUMENTS, remover as guardas `typeStepDocuments &&`, que ficam redundantes: a função só é chamada com etapas vindas de `formSteps` (`navigateToStep`, `submit` e stepper).
- `useState` de `formStep` (`~3413`): `useState<RequestStep>(internalSimple ? RequestStep.TUTOR : RequestStep.ANIMAL)`.
- JSX: trocar `formStep === 0/1/2/3` por `RequestStep.TUTOR/ANIMAL/SCHEDULE/DOCUMENTS` nos blocos das etapas (`~4010`, `~4134`, `~4291`, `~4312`) e no botão "Adicionar animal" (`~4391`).

Estados de loading/error/empty: não se aplica (lógica de visibilidade, sem nova UI). Sem alteração de textos, CSS ou componentes.

### Backend

Sem impacto esperado. Nenhuma rota, service ou repository é alterado, e o que o formulário envia ao backend não muda para os mesmos inputs.

### Banco de dados

Sem impacto esperado. Nenhuma tabela, coluna, índice ou migration.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `src/features/request-steps/request-steps.ts` (novo)
- `src/features/request-steps/request-steps.test.ts` (novo)
- `src/App.tsx` (apenas `NewRequest`)
- Após o commit, pelo `/finalizar`: `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md` (status da fase, link deste plano, correção do texto desatualizado)

---

## O que será removido

Cada item deve ser **deletado** — não comentado, não envolto em `if (false)`, não ocultado:

- As constantes `typeStepTutor`, `typeStepAgenda` e `typeStepDocuments` em `NewRequest`.
- O ternário aninhado e a cadeia de `.filter` que montam `formSteps` (substituídos por `getVisibleSteps`).
- O item `{ step: 3, label: "Finalização" }` da lista do fluxo interno (código morto: sempre filtrado por `internalSimple && item.step === 3`).
- As guardas redundantes `typeStepDocuments &&` dentro de `getStepIssues`.
- Os literais numéricos de etapa em `NewRequest` (substituídos por `RequestStep.*`).

Nada de CSS, rotas, tipos exportados, colunas ou tabelas é removido.

> **Atenção para a skill `implementar`:** se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Criar `src/features/request-steps/request-steps.ts` conforme a seção "Frontend" (enum em MAIÚSCULAS como `RequestStage`, mapa de labels, função pura). Estimativa: bem abaixo de 150 linhas.
2. Criar `src/features/request-steps/request-steps.test.ts` com os casos da seção "Testes necessários" (nomes e textos de teste em inglês).
3. Em `NewRequest`: adicionar o import, remover as três constantes `typeStep*`, substituir a montagem de `formSteps` pela chamada a `getVisibleSteps` e criar `hasStep`.
4. Atualizar `getRequestValidationIssues` (trocar as constantes por `hasStep`, manter `!internalSimple &&`, e aplicar a correção do `accepted`).
5. Atualizar `getStepIssues` (enum + remoção das guardas redundantes de DOCUMENTS).
6. Trocar os literais numéricos de etapa no `useState` e no JSX por `RequestStep.*`.
7. Checklist anti-duplicação: `grep` por `typeStepTutor|typeStepAgenda|typeStepDocuments` e por `formStep === [0-3]` em `src/App.tsx` deve retornar zero ocorrências; confirmar que não restou o item "Finalização" na lista do fluxo interno.
8. Rodar `npm run typecheck`, `npm test` e `npm run build` **uma vez**, ao final.
9. Sem verificação visual por padrão. Informar ao usuário o que conferir na tela (ver "Critérios de aceite").
10. Pelo `/finalizar`, depois do commit: atualizar o spec (marcar a fase 1 como `[x]` com data e hash, preencher o link deste plano na tabela, corrigir a linha do texto de estado do código que diz que `createRequestType` não persiste as flags e registrar que `reorganizar-etapas-tipo-solicitacao.md` já estava implementado).

---

## Regras de negócio identificadas

- Uma etapa aparece se **todas** as configurações envolvidas permitirem (regra de combinação do spec). Sem bloqueio nem validação de conflito.
- `stepTutor` do tipo de solicitação permanece; uma função única calcula as etapas visíveis.
- Tutor logado com perfil completo não vê a etapa Tutor (`skipTutor`). A fase 6 ("Animal já cadastrado") reaproveita esse mesmo parâmetro para pular a etapa Tutor.
- O fluxo interno (`internalSimple`) tem etapas fixas (Tutor, Animal, Agenda) e ignora as configurações.
- Ordem no fluxo público: Animal → Tutor → Agenda → Documentos.
- A declaração (`accepted`) só é exigida quando a etapa Documentos existe, pois é nela que a declaração é exibida e aceita.
- Quando uma etapa está oculta, seus campos não são exigidos para concluir (comportamento já existente para Tutor e Agenda; Documentos passa a seguir a mesma regra de forma consistente).

---

## Regras multi-tenant e segurança

- Sem impacto: nenhuma mudança em autenticação, autorização, permissões, tenant, relatórios, PDFs, exportações ou storage.
- As flags de etapa continuam vindo de `requestTypes`, já escopado por município (`scopeConfigItems` / `matchesScopedConfigItem`); nada novo trafega entre o frontend e o backend.
- A visibilidade de etapas é comportamento de UX do formulário; esta fase não adiciona nem remove nenhuma validação de segurança do lado do servidor.

---

## Validações necessárias

- `getVisibleSteps` aplica estritamente `=== false` para ocultar (flag ausente, `undefined` e config nulo = permite).
- `getRequestValidationIssues` e `getStepIssues` passam a depender de `hasStep(...)`, sem alterar as mensagens de erro existentes.
- Nenhuma nova validação de input, params, query string ou payload.

---

## Testes necessários

### Frontend

Testes unitários (vitest) em `src/features/request-steps/request-steps.test.ts`:

- Público sem configs (lista vazia): 4 etapas, ordem ANIMAL, TUTOR, SCHEDULE, DOCUMENTS, com os rótulos "Animal", "Tutor", "Agenda", "Documentos".
- `stepTutor: false` remove só TUTOR; `stepAgenda: false` remove só SCHEDULE; `stepDocuments: false` remove só DOCUMENTS.
- As três flags `false`: sobra apenas ANIMAL.
- `skipTutor: true` remove TUTOR (ordem ANIMAL, SCHEDULE, DOCUMENTS), inclusive com o config permitindo Tutor.
- Fluxo interno: sempre TUTOR, ANIMAL, SCHEDULE, mesmo com flags `false` nos configs e com `skipTutor: true`.
- Regra de combinação: com dois configs, um `false` esconde a etapa mesmo que o outro permita; com ambos permitindo, a etapa aparece.
- Configs `null` e `undefined` na lista são ignorados; objeto vazio e flag `undefined` contam como "permite".

Não há infraestrutura de teste de componente para `NewRequest` (`App.tsx` não é testado unitariamente); a integração em `App.tsx` é validada por typecheck, build e conferência manual descrita nos critérios de aceite.

### Backend

Sem impacto esperado.

### E2E

Não aplicável.

---

## Comandos de validação sugeridos

O projeto usa scripts únicos na raiz (não há subpacotes `frontend/` e `backend/` separados para o frontend, e não há script de lint):

```bash
npm run typecheck
npm test
npm run build
```

---

## Riscos e pontos de atenção

- `NewRequest` é o miolo do cadastro público, dentro de um `App.tsx` de ~12 mil linhas. O refactor preserva o comportamento e a lógica nova fica isolada e testada; o código de cola em `App.tsx` é pequeno. Risco geral: baixo.
- **Mudança de comportamento (única):** tipos legados salvos com `stepDocuments: false` deixam de travar o envio por causa de `accepted`, mas passam a poder ser enviados sem declaração aceita (a etapa que a exibe não existe nesses tipos). Hoje a UI não permite criar esse estado, então só afeta dados antigos, se existirem.
- As chaves `stepTutor`, `stepAgenda` e `stepDocuments` são dados persistidos: **não renomear**. A fase 2 deve reutilizar esses nomes no tipo de identificação (ou adaptar por um mapeamento explícito).
- O working tree já tinha alterações não relacionadas no momento do planejamento (`.claude/skills/*`, `AGENT.md`, `.claude/skills/rodar/`, `.portal/plans/reorganizar-documentos-pdf.md` e `.portal/specs/` não versionados). Não devem entrar no commit desta fase.
- Risco de afetar produção: commit/push direto em `main`, sem `staging`.

---

## Perguntas em aberto

1. **Tipo legado com `stepDocuments: false` (decisão assumida neste plano).** A função honra a flag e o `accepted` só é exigido quando a etapa Documentos existe; o `stepDocuments: true` forçado ao salvar permanece. A alternativa descartada seria ignorar a flag e deixar Documentos sempre visível, mais simples, mas a fase 2 teria de reintroduzi-la. Se preferir a alternativa, avisar antes do `/implementar`.
2. **Anotação para a fase 2 (não decidir agora).** O spec diz que o tipo de identificação controla a etapa Documentos, mas o plano antigo retirou esse toggle do tipo de solicitação porque a etapa contém a declaração de responsabilidade e o requerimento. Definir na fase 2 se "Animal sem Tutor" dispensa a declaração (mesma pendência de "documentos de tutor para animal sem tutor" do spec).

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- `getVisibleSteps` é o único lugar que decide quais etapas existem; `typeStepTutor`, `typeStepAgenda`, `typeStepDocuments` e a cadeia de `.filter` não existem mais; não há literais numéricos de etapa em `NewRequest`.
- Os testes novos passam e `npm run typecheck`, `npm test` e `npm run build` terminam sem erros novos.
- Comportamento preservado, conferido por leitura de código e, se o usuário quiser, manualmente na tela:
  - público sem flags: stepper com Animal, Tutor, Agenda, Documentos;
  - tipo com Tutor desligado, ou com Agenda desligada: a etapa correspondente some e o envio não a exige;
  - tutor logado com perfil completo: Animal, Agenda, Documentos;
  - fluxo interno: Tutor, Animal, Agenda.
- Um tipo com `stepDocuments: false` não bloqueia mais o envio por falta de `accepted`.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não há migrations nesta fase; nada a executar.
- Seguir `/AGENT.md` (código novo em inglês, enum para valores finitos, um arquivo por responsabilidade).
- Manter a alteração pequena e focada: módulo novo + testes + `NewRequest`. Não mexer no modal de tipo de solicitação, em CSS, nem no `stepDocuments: true` forçado ao salvar.
- Deletar tudo que está em "O que será removido" — não ocultar.
- Não incluir no commit os arquivos já alterados/não versionados que não pertencem a esta fase (ver "Riscos"). O `.portal/specs/` está fora do controle de versão; atualizar o status da fase no arquivo local, e o usuário decide se o versiona.
- Sem verificação visual (navegador/CDP/screenshots) a menos que o usuário peça.
