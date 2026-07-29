# Plano de Implementação: Reorganizar etapas do cadastro no modal de tipo de solicitação

## Origem

- Arquivo de especificação: conversa com o usuário (screenshot do modal "Editar tipo de solicitação" + descrição do pedido), sem `.md` de feature associado
- Data do planejamento: 2026-07-29
- Classificação: `frontend-only`

---

## Resumo

O modal "Editar/Criar tipo de solicitação" (Configurações → Tipos de solicitação) tem uma seção "Etapas do cadastro" com 3 toggles (Dados do tutor, Agenda, Documentos) posicionados abaixo do seletor de documentos vinculados, lado a lado. O pedido é:

1. Mover os 3 toggles para cima do campo "Nome" (logo abaixo dos toggles Ativo/Cobrar taxa/Sobrepor limite).
2. Exibir um toggle por linha (não lado a lado), com texto deixando claro que desativar oculta a etapa do cadastro público.
3. Remover o toggle "Documentos" das etapas configuráveis — essa etapa contém a declaração de responsabilidade e a geração do requerimento, portanto não deve ser desativável.
4. Revisar as validações do formulário público (`NewRequest`) para confirmar que, quando uma etapa está desativada, os campos dessa etapa não são exigidos para finalizar a solicitação.

Investigação já confirmou que as validações (item 4) **já funcionam corretamente hoje** para as 3 etapas — não é necessário alterar a lógica de validação, só garantir que `stepDocuments` deixe de poder ser configurado como `false` (já que o toggle sai da UI).

---

## Escopo

### Dentro do escopo

- Reposicionar o bloco "Etapas do cadastro" no JSX do modal, para ficar entre os 3 toggles do topo e o campo "Nome".
- Alterar o layout de "Etapas do cadastro" de linha (lado a lado) para coluna (um toggle por linha), com texto de apoio abaixo de cada label explicando que desativar oculta a etapa no cadastro público.
- Remover o toggle "Documentos" das etapas configuráveis do modal.
- Corrigir `createRequestType` para persistir `stepTutor`/`stepAgenda`/`stepDocuments` ao criar um novo tipo (hoje só `patchRequestType`, usado na edição, persiste esses campos corretamente — achado durante a investigação, correlato à área mexida).
- Ajustar CSS (`.request-type-steps-toggles` ou equivalente) para layout em coluna.

### Fora do escopo

- `DocumentButtonPicker` (seleção de quais documentos ficam vinculados ao tipo) — outra seção do mesmo modal, não mexida.
- Lógica de geração de requerimento/declaração em si.
- Migração de dados existentes com `stepDocuments: false` já salvos — o código passa a tratar esse campo como sempre ativo, sem migração automática de registros antigos.
- Qualquer mudança nos toggles "Ativo", "Cobrar taxa", "Sobrepor limite" (topo do modal).

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- `src/App.tsx` (modal de tipo de solicitação, linhas ~9781-9866; `createRequestType`/`patchRequestType`, linhas ~7266-7409; validações de `NewRequest`, linhas ~3465-3638)
- Conversa com o usuário (screenshot + descrição do pedido)

Não há `frontend/AGENT.md`/`backend/AGENT.md` separados neste projeto — a raiz `/AGENT.md` cobre o monorepo inteiro.

---

## Impacto por área

### Frontend

- **Modal "Editar/Criar tipo de solicitação"** ([App.tsx:9781-9866](../../src/App.tsx#L9781-L9866)):
  - Mover o bloco `<div className="request-type-steps-section">` (linhas 9831-9862) para logo após os 3 toggles do topo (`config-modal-options`, linhas 9785-9808) e antes do `<Field label="Nome" .../>` (linha 9809).
  - Trocar o layout de `.request-type-steps-toggles` de linha para coluna (um toggle por linha).
  - Adicionar um texto de apoio (ex.: `<small>` ou `<span>` secundário) abaixo de cada label de etapa, explicando que desativar oculta a etapa no cadastro público.
  - Remover o toggle "Documentos" (linhas 9852-9860) do bloco de etapas.
- **`createRequestType`** ([App.tsx:7266-7287](../../src/App.tsx#L7266-L7287)): incluir `stepTutor`, `stepAgenda`, `stepDocuments` (sempre `true` para este último) no objeto retornado, para persistir corretamente ao criar um tipo novo — hoje esses campos são perdidos na criação (só funcionam ao editar via `patchRequestType`).
- **`emptyRequestType`** ([App.tsx:6970](../../src/App.tsx#L6970)): já tem os 3 campos com default `true` — sem mudança necessária aqui.
- **Validações em `NewRequest`** ([App.tsx:3469-3471](../../src/App.tsx#L3469-L3471), [3589-3610](../../src/App.tsx#L3589-L3610), [3612-3638](../../src/App.tsx#L3612-L3638)): já gateiam corretamente por `typeStepTutor`/`typeStepAgenda`/`typeStepDocuments` — nenhuma mudança de lógica necessária. Após a remoção do toggle "Documentos" do modal, `typeStepDocuments` sempre será `true` na prática (a menos que exista dado legado com `false`), então o código de validação existente (`typeStepDocuments && ...`) continua funcionando sem alteração.
- Estados de loading/error/empty: não aplicável (mudança é só de layout + persistência de config).
- Testes: não há suíte de testes frontend configurada neste projeto (sem `npm run test` no `package.json`).

### Backend

Sem impacto esperado — `requestTypes` é gerenciado inteiramente no estado do frontend (via `setRequestTypes`), sem rota de backend dedicada encontrada para esses campos.

### Banco de dados

Sem impacto esperado — não há schema/migration para `request_types` identificado no backend; a estrutura de tipos de solicitação parece ser mantida como configuração client-side.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `src/App.tsx` — JSX do modal (linhas ~9781-9866) e `createRequestType` (linhas ~7266-7287)
- `src/styles.css` — layout de `.request-type-steps-section`/`.request-type-steps-toggles` (linha para coluna)

---

## O que será removido

- O toggle "Documentos" das etapas do modal ([App.tsx:9852-9860](../../src/App.tsx#L9852-L9860)) — deletado do JSX, não ocultado/comentado.

Nenhuma outra remoção prevista. O campo `stepDocuments` permanece no schema/objeto (não é removido do tipo `AnyRecord`/payload) para não quebrar tipos já configurados no passado — apenas deixa de ser setável como `false` pela UI.

---

## Estratégia de implementação

1. No JSX do modal ([App.tsx:9781-9866](../../src/App.tsx#L9781-L9866)), mover o bloco `request-type-steps-section` para entre `config-modal-options` (linha 9808) e o `<Field label="Nome" .../>` (linha 9809).
2. Remover o toggle "Documentos" (linhas 9852-9860) do bloco de etapas.
3. Reestruturar os 2 toggles restantes (Dados do tutor, Agenda) para um por linha, cada um com um texto de apoio abaixo explicando o efeito de desativar (ex.: "Oculta esta etapa no cadastro público").
4. Ajustar CSS de `.request-type-steps-toggles` (ou criar variante) para `flex-direction: column` / `display: grid` com uma coluna, gap adequado entre os toggles.
5. Em `createRequestType` ([App.tsx:7266-7287](../../src/App.tsx#L7266-L7287)), adicionar `stepTutor: payload.stepTutor !== false, stepAgenda: payload.stepAgenda !== false, stepDocuments: true` ao objeto retornado.
6. Rodar grep por `stepDocuments`/`typeStepDocuments` no arquivo inteiro para confirmar que nenhuma lógica de validação quebra com a remoção do toggle (checklist anti-duplicação da skill `implementar`).
7. `npm run typecheck` e `npm run build`.
8. Sem verificação visual do resultado final, a menos que o usuário peça explicitamente (preferência já registrada nesta conversa em interações anteriores).

---

## Regras de negócio identificadas

- A etapa "Documentos" é obrigatória em todo tipo de solicitação porque contém a declaração de responsabilidade e a geração do requerimento — não pode ser desativada pelo gestor.
- As etapas "Dados do tutor" e "Agenda" continuam configuráveis (podem ser ocultadas do cadastro público por tipo de solicitação).
- Quando uma etapa está desativada, nenhum campo dela deve ser exigido para finalizar a solicitação (comportamento já implementado corretamente para as 3 etapas).

---

## Regras multi-tenant e segurança

- `requestTypes` já é filtrado por escopo de município via `matchesScopedConfigItem`/`configMunicipalityScopeId` — não alterado por este plano.
- Sem impacto em permissões, autorização ou relatórios/PDFs.

---

## Validações necessárias

- Confirmar que o formulário público (`NewRequest`) continua funcionando corretamente para tipos com "Dados do tutor" ou "Agenda" desativados (já validado por leitura de código — sem necessidade de nova lógica).
- Confirmar que criar um novo tipo de solicitação com "Dados do tutor" ou "Agenda" desativados persiste corretamente esse estado (corrigido pelo item 5 da estratégia).

---

## Testes necessários

### Frontend

- Não há suíte de testes automatizados configurada no projeto para este fluxo; validação será manual (leitura de código + typecheck/build).

### Backend

- Sem impacto esperado.

### E2E

- Não aplicável — sem infraestrutura de Playwright configurada para este fluxo específico.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

(O projeto não usa `frontend/`/`backend/` como subpacotes npm separados para lint/test; scripts únicos na raiz.)

---

## Riscos e pontos de atenção

- Baixo risco geral — mudança isolada ao modal de configuração e à função de criação de tipo.
- Tipos de solicitação já existentes com `stepDocuments: false` salvo (se houver, criados antes desta mudança) passarão a ter a etapa de documentos sempre ativa — comportamento pretendido pelo pedido, mas vale registrar como mudança de comportamento para dados legados.
- Risco de afetar produção: commit/push são feitos direto em `main`, sem `staging`.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- Os toggles de etapas (Dados do tutor, Agenda) aparecem acima do campo "Nome", um por linha, com texto explicando o efeito de desativar.
- O toggle "Documentos" não existe mais no modal.
- Criar um novo tipo de solicitação com "Dados do tutor" ou "Agenda" desativados persiste esse estado corretamente (bug de `createRequestType` corrigido).
- `npm run typecheck` e `npm run build` passam sem erros.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não há migrations neste projeto para este fluxo — nada a executar.
- Manter a alteração pequena e focada: só o modal, `createRequestType` e o CSS relacionado.
- Deletar o toggle "Documentos" do JSX — não ocultar com `display:none` ou flag.
- Sem testes automatizados a atualizar (não existem para este fluxo).
