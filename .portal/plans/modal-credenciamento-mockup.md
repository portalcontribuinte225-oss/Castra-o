# Plano de Implementação: Restilização do Modal de Credenciamento

## Origem

- Arquivo de especificação: nenhum `.md` foi fornecido — a especificação usada foi um mockup HTML ("Modal Credenciados standalone") compartilhado diretamente no chat.
- Data do planejamento: 2026-07-23
- Classificação: `frontend-only`

## Resumo

O modal de credenciamento (`PublicAccessRequestModal`, `src/App.tsx`) já existe e já é estruturalmente quase idêntico ao mockup: mesmos campos principais (Organização, Responsável, Email, Telefone, CPF/CNPJ, Cidade, UF), mesmo seletor ONG/Protetor (`accessRequesterTypes` em `domain.ts`), e já submete para um handler real (`onAccessRequest`). O trabalho é majoritariamente de restilização para bater com a paleta verde/creme já adotada no redesign da home v4, mais a remoção de um campo que não existe no mockup.

## Escopo

### Dentro do escopo

- Restilizar `.access-modal`, `.access-type-picker`/`.access-type-card`/`.access-type-icon` (cores verde/creme em vez de teal/azul)
- Restilizar `.access-field input/textarea` (borda creme, radius maior, sem fundo azulado)
- Ajustar cabeçalho do modal (remover ícone `Shield`, header não-sticky, botão fechar circular) apenas para este modal, via seletor escopado (`.access-modal .modal-header`), sem tocar no componente `ModalHeader` compartilhado
- Restilizar botão de submit (`.access-modal > .primary-action`) para verde sólido — já existe um seletor escopado para isso no CSS (~L20481/20779), só trocar a cor
- Remover o campo "Como pretende auxiliar" (label + textarea + estado `intendedUse`) do formulário, já que não existe no mockup e o backend trata `intended_use` como opcional (default `""`)

### Fora do escopo

- Qualquer mudança em `ModalHeader`, `.modal-header`, `.modal-header-close`, `.primary-action` fora do escopo de `.access-modal` (usados em dezenas de outros modais do app)
- Lógica de submissão/validação do formulário (já funciona)
- Backend/API de credenciamento
- Ícones do seletor ONG/Protetor (mantidos: `Building2`/`HeartHandshake`)

## Leitura de contexto

- `/AGENT.md`
- Mockup HTML fornecido no chat (bundle "Modal Credenciados standalone")
- `src/App.tsx` — `PublicAccessRequestModal` (~L2333-2477)
- `src/domain.ts` (~L66-69) — `accessRequesterTypes`
- `src/components/ui.tsx` (~L86-104) — `ModalHeader`, componente compartilhado por dezenas de modais
- `src/styles.css` — `.access-modal*` (~L1040-1246), `.modal-header*` (~L3212-3300, já com padrão existente de override escopado por modal em `.config-modal > .modal-header` etc.), `.primary-action` (múltiplos pontos de cascata, incluindo `.access-modal > .primary-action` já existente em ~L20481/20779), `.access-form-label` (~L17482, já usa uppercase — só precisa ajuste de cor)
- `backend/src/routes/accessRequests.js` (~L83-99) — confirma que `intended_use` é opcional (`String(body.intended_use || body.intendedUse || "").trim()`)
- `src/features/accessRequests.tsx` (~L301) — confirma que a tela admin já esconde a linha "Finalidade" quando `intendedUse` está vazio (`{item.intendedUse && ...}`)

## Impacto por área

### Frontend

- `src/App.tsx`: no `PublicAccessRequestModal`, remover o campo/estado `intendedUse` (label, textarea, `patch`, envio no `onSubmit`); remover `icon={Shield}` do `ModalHeader` neste call site
- `src/styles.css`: restilizar as classes listadas acima; nenhuma classe nova necessária (a estrutura de classes já cobre o mockup)
- Sem novos componentes, sem novos hooks, sem novas query keys (projeto não usa React Query — chamadas via `api.*` diretamente)
- Testes: verificação manual em browser (não há suíte de testes de frontend automatizada identificada para esta tela)

### Backend

Sem impacto esperado — `onAccessRequest` já existe e já funciona; `intended_use` já é tratado como opcional no backend, então removê-lo do form não quebra nada.

### Banco de dados

Sem impacto esperado.

Atenção: este plano não autoriza executar migrations automaticamente (não aplicável aqui, mas mantido por padrão do template).

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` (componente `PublicAccessRequestModal`)
- `src/styles.css` (blocos `.access-*` e overrides escopados de `.modal-header`/`.primary-action` para `.access-modal`)

## Estratégia de implementação

1. Em `PublicAccessRequestModal`: remover do estado inicial `intendedUse: ""`, remover o `<label className="access-form-label">` com a textarea correspondente, remover `intended_use: form.intendedUse` do payload de `onSubmit`.
2. Remover `icon={Shield}` da chamada de `ModalHeader` deste modal.
3. Restilizar `.access-modal` (fundo branco, radius 22px, box-shadow mais suave, padding 32px).
4. Ajustar `.access-modal .modal-header` para não-sticky/sem gradiente e `.access-modal .modal-header-close` para círculo 34px `#f3f0ea`.
5. Restilizar `.access-type-card`/`.access-type-icon` (selecionado = verde `#1f8a5f`/`#eaf3ee`; não selecionado = borda creme `#e6ddc9`).
6. Restilizar `.access-field input/textarea` (borda creme, radius 10px, cor de texto `#2b2420`).
7. Ajustar cor de `.access-form-label > span` para `#93887a`.
8. Trocar cor de `.access-modal > .primary-action` para verde `#1f8a5f`/hover `#156b48`.
9. Rodar `npm run typecheck` e `npm run build`.
10. Verificação visual via screenshot (abrir modal a partir do link "Credenciamento" no topbar), em pelo menos desktop e mobile.

## Regras de negócio identificadas

- Fluxo de submissão e validação (responsável + email obrigatórios) permanece igual.
- Setor atribuído (`assigned_sector`) continua vindo de `accessRequesterTypes` conforme já implementado.
- `intended_use` deixa de ser preenchido pelo usuário e sempre chega vazio ao backend — comportamento já suportado nativamente (default `""`), sem quebra em nenhuma tela que consome esse campo.

## Regras multi-tenant e segurança

- Nenhuma mudança em autenticação/autorização.
- Nenhum dado sensível novo, nenhum endpoint novo.

## Validações necessárias

Nenhuma validação de formulário nova — apenas remoção de um campo opcional já tratado como tal no backend.

## Testes necessários

### Frontend

- Verificação manual em browser: abrir modal via "Credenciamento" no topbar → alternar ONG/Protetor → preencher campos → enviar → confirmar tela de sucesso → responsivo mobile.

### Backend

- Não aplicável (sem impacto esperado).

### E2E

- Não há suíte E2E identificada neste projeto.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- `ModalHeader` e `.primary-action` são compartilhados por dezenas de modais no app — todo ajuste deve ser feito via seletor escopado a `.access-modal`, nunca alterando a regra base (já existe precedente disso no CSS atual, ex. `.config-modal > .modal-header`, `.access-modal > .primary-action`).
- Push para `origin/main` segue bloqueado por permissão (pendência de sessões anteriores, não relacionada a este plano).

## Perguntas em aberto

Todas resolvidas com o usuário em 2026-07-23:

1. Campo "Como pretende auxiliar": **remover**, seguindo o mockup à risca.
2. Ícones do seletor ONG/Protetor: **manter os atuais** (`Building2`/`HeartHandshake`).
3. Paleta de cores: **usar o verde já adotado no redesign da home v4** (`#1f8a5f`).

Nenhuma pergunta em aberto restante.

## Critérios de aceite do plano

- Modal renderiza com a estrutura e paleta do mockup, mantendo o fluxo de submissão real (`onAccessRequest`) intacto.
- Campo "Como pretende auxiliar" removido do formulário sem quebrar a tela admin de credenciamentos.
- `npm run typecheck` e `npm run build` passam sem novos erros.
- Nenhuma alteração vaza para `ModalHeader`/`.primary-action` fora do escopo de `.access-modal`.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto. Todas as decisões já foram confirmadas com o usuário (ver seção "Perguntas em aberto") — não reabrir essas decisões sem motivo novo.
- Toda restilização de `ModalHeader`/`.modal-header-close`/`.primary-action` deve ser feita via seletor escopado a `.access-modal`, seguindo o padrão já existente no CSS (ex. `.config-modal > .modal-header`, `.access-modal > .primary-action`) — nunca alterar a regra base compartilhada.
- Manter as alterações em `App.tsx` restritas ao componente `PublicAccessRequestModal`.
- Seguir o fluxo real de git deste projeto (commit direto em `main`, sem `staging`/PR).
- Rodar `npm run typecheck` e `npm run build` antes de considerar a implementação concluída.
