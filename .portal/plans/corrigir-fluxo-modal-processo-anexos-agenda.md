# Plano de Implementacao: Corrigir Fluxo do Modal de Processo, Anexos e Agenda

## Origem

- Arquivo de especificacao: conversa e prints do modal de processo enviados pelo usuario
- Data do planejamento: 2026-07-28
- Classificacao: `frontend-only`

## Resumo

Corrigir o modal de analise do processo para respeitar o fluxo operacional correto: documentos aprovados pela IA ja devem ser tratados como aprovados, sem exigir aprovacao manual do usuario; processos novos devem focar em anexos e confirmacao de agenda; campos de procedimento, saude e historico so devem aparecer depois da agenda confirmada. Tambem sera removido o botao isolado `Salvar dados do animal` e consolidado o CSS dos botoes e anexos do modal, reduzindo sobreposicoes.

## Escopo

### Dentro do escopo

- Ajustar o `RequestPreviewModal` para identificar documentos aceitos automaticamente pela IA.
- Remover botoes manuais de aprovar/recusar documento quando o documento ja estiver aprovado pela IA ou nao exigir validacao.
- Bloquear `Confirmar Agenda` quando houver documento obrigatorio pendente, ausente ou recusado.
- Fazer processo `NOVA` abrir/focar somente em `Anexos`.
- Liberar abas operacionais apenas quando o processo estiver `AGENDADA`.
- Remover o botao `Salvar dados do animal` e o estado/funcao associados.
- Persistir dados clinicos do animal junto ao fluxo correto de atendimento, quando aplicavel.
- Padronizar botoes do modal de processo.
- Consolidar CSS duplicado relacionado a `.prm-modal`, `process-attachment-*`, `doc-decision-btn`, `prm-pdf-btn`, `prm-close-btn` e `prm-action-btn`.

### Fora do escopo

- Criar novos endpoints.
- Alterar banco de dados ou migrations.
- Alterar a rotina de IA externa ou o provedor Anthropic.
- Alterar geracao de PDF do relatorio processual.
- Mudar regras de permissao no backend.
- Reestruturar completamente `src/App.tsx`.
- Fazer commit, push ou deploy.

## Leitura de contexto

- `/AGENT.md`
- `frontend/AGENT.md`: nao existe no repositorio atual
- `src/App.tsx`
- `src/styles.css`
- `src/features/request-actions.ts`
- `src/features/agenda.tsx`, identificado como consumidor indireto do mesmo modal/acoes

## Impacto por area

### Frontend

Havera impacto no modal `RequestPreviewModal`, hoje definido em `src/App.tsx`.

Alteracoes esperadas:

- Criar helpers locais ou proximos ao modal para classificar anexos:
  - documento aceito automaticamente;
  - documento pendente;
  - documento recusado;
  - documento ausente;
  - documento sem validacao necessaria.
- Remover ou reduzir o uso de `docDecisions`, que hoje e apenas estado visual local.
- Ajustar renderizacao de acoes por anexo:
  - aprovado por IA: sem botoes manuais, apenas visualizar/baixar;
  - requerimento do sistema: sem botoes manuais;
  - foto do animal: sem botoes manuais;
  - documento pendente que exige validacao: permitir acao manual somente se isso permanecer no escopo funcional.
- Ajustar regra da aba ativa:
  - `NOVA`: iniciar em `anexos` e nao renderizar formulario de procedimento/saude;
  - `AGENDADA`: liberar abas operacionais;
  - demais status: manter visualizacao adequada sem acoes pendentes.
- Remover `Salvar dados do animal` e salvar dados clinicos junto ao fluxo de atendimento, se os campos forem editaveis em `AGENDADA`.
- Padronizar os botoes de cabecalho e rodape do modal.
- Limpar CSS empilhado no `src/styles.css`, preferindo regras especificas sob `.prm-modal`.

Estados de loading/error/empty:

- Preservar loading de relatorio, preview e download.
- Preservar estado vazio de anexos.
- Adicionar feedback simples quando `Confirmar Agenda` estiver bloqueado por documentos.

Testes/validacao visual:

- Processo `NOVA` com documentos aprovados por IA.
- Processo `NOVA` com documento pendente.
- Processo `NOVA` com documento ausente.
- Processo `AGENDADA` com campos operacionais liberados.
- Modal aberto pelo dashboard e pela agenda.

### Backend

Sem impacto esperado.

O backend ja permite atualizar status via `patchRequest`, e `approveRequest` em `src/features/request-actions.ts` ja aplica `status: "AGENDADA"`. A confirmacao de atendimento tambem ja passa por `confirmAttendanceFromProcess`.

Se durante a implementacao for decidido persistir decisoes manuais por documento, o escopo deve ser reavaliado, pois pode exigir alteracao de contrato e validacao backend.

### Banco de dados

Sem impacto esperado.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado.

Nao alterar `.env`, Render, comandos de build, jobs, workers, storage ou CI/CD.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`
- `src/features/request-actions.ts`
- `src/features/agenda.tsx`, apenas para validar compatibilidade do modal/acoes compartilhadas

## Estrategia de implementacao

1. Mapear no `RequestPreviewModal` os status usados pelos anexos.
2. Criar helpers com nomes em ingles para evitar regras espalhadas:
   - `isSystemDocument`
   - `isAnimalPhotoAttachment`
   - `isAttachmentAiApproved`
   - `isAttachmentAccepted`
   - `isAttachmentBlockingSchedule`
   - `requiresManualDocumentDecision`
3. Substituir a condicao atual que exibe aprovar/recusar documento, hoje baseada apenas em `canAnalyze`.
4. Calcular `blockingAttachments` e `canConfirmSchedule`.
5. Usar `canConfirmSchedule` para habilitar/desabilitar `Confirmar Agenda`.
6. Ajustar `modalTab`:
   - inicializar em `anexos` quando `request.status === "NOVA"`;
   - impedir clique/render de abas operacionais enquanto o processo nao estiver agendado;
   - usar `useEffect` se necessario para corrigir aba ao trocar de processo.
7. Separar visualmente as abas liberadas apos agenda:
   - minimo aceitavel: `Procedimento` e `Anexos`, com saude dentro de procedimento apenas se mantido compacto;
   - preferivel: `Procedimento`, `Saude` e `Anexos`, se a alteracao ficar pequena e clara.
8. Remover `savingAnimalData`, `saveAnimalData` e o bloco `prm-animal-save-row`.
9. Ajustar `confirmAttendanceFromProcess` para receber dados clinicos do animal junto com os dados de atendimento, preservando animais existentes.
10. Consolidar estilos:
    - manter botoes do modal sob `.prm-modal`;
    - tornar `prm-pdf-btn` neutro;
    - manter `prm-close-btn` vermelho;
    - normalizar altura, raio, borda e pesos dos botoes do rodape;
    - remover regras duplicadas ou sem uso apos busca com `rg`.
11. Validar desktop e mobile basico.
12. Rodar comandos de validacao.

## Regras de negocio identificadas

- Documento aprovado pela IA nao precisa de aprovacao manual do usuario.
- Documento sem validacao necessaria, como foto do animal, nao deve bloquear agenda.
- Requerimento municipal gerado pelo sistema nao deve exigir analise manual.
- Processo novo deve focar em conferencia documental e confirmacao de agenda.
- Dados de procedimento, saude e historico so devem ser preenchidos depois que a agenda estiver confirmada.
- O botao `Salvar dados do animal` nao deve existir nesse modal.
- A confirmacao de agenda deve ser bloqueada se documentos obrigatorios estiverem ausentes, recusados ou pendentes.
- Botoes do mesmo modal devem seguir padrao visual unico.

## Regras multi-tenant e seguranca

- Nao alterar origem de `municipalityId` ou tenant.
- Nao alterar endpoints nem autorizacoes backend.
- Preservar `patchRequest`, que ja respeita escopo de prefeitura no backend.
- Nao expor documentos entre prefeituras.
- Nao alterar relatorio processual ou preview de documento alem dos botoes/fluxo visual.
- Se a implementacao tocar persistencia de decisao manual por documento, reavaliar backend e escopo multi-tenant antes de codar.

## Validacoes necessarias

- Validar que `Confirmar Agenda` fica desabilitado quando:
  - documento obrigatorio esta ausente;
  - documento obrigatorio esta recusado;
  - documento obrigatorio esta pendente e exige validacao.
- Validar que `Confirmar Agenda` fica habilitado quando:
  - todos os documentos obrigatorios estao aprovados por IA ou aceitos;
  - documentos do sistema/foto nao bloqueiam.
- Validar que processo `NOVA` nao mostra campos de saude/procedimento antes da agenda.
- Validar que processo `AGENDADA` mostra campos operacionais.
- Validar que `Relatorio` nao usa visual vermelho de fechamento.
- Validar que `X` de fechar permanece vermelho.
- Validar que nao ha botoes de aprovacao manual em anexo ja aprovado por IA.

## Testes necessarios

### Frontend

- Teste manual ou automatizado de `RequestPreviewModal` com processo `NOVA` e anexos aprovados por IA.
- Teste de processo `NOVA` com anexo pendente.
- Teste de processo `NOVA` com anexo ausente.
- Teste de processo `AGENDADA` com campos de atendimento liberados.
- Teste de botoes do rodape em desktop e mobile.

### Backend

- Sem testes backend esperados.

Se a implementacao passar a persistir decisoes manuais de documentos, adicionar testes para o endpoint de patch de requests.

### E2E

- Abrir processo novo, conferir anexos, confirmar agenda.
- Abrir processo agendado, preencher atendimento e confirmar.
- Abrir modal pela agenda e garantir que o mesmo fluxo funciona.

## Comandos de validacao sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

Se houver testes disponiveis aplicaveis:

```bash
npm test
```

## Riscos e pontos de atencao

- `RequestPreviewModal` esta em `src/App.tsx`, arquivo grande e sensivel.
- O modal e usado por mais de uma tela, incluindo dashboard e agenda.
- `docDecisions` hoje nao persiste; remover ou alterar esse comportamento pode mudar expectativa operacional.
- CSS de botoes esta empilhado em varias partes de `src/styles.css`; limpar sem mapear pode quebrar outros botoes.
- Regras globais com `!important` podem interferir no visual do modal.
- Alteracoes em atendimento devem preservar os dados existentes do animal.
- Ha risco de misturar este plano com alteracoes pendentes nao relacionadas no worktree; implementar deve preservar mudancas do usuario.

## Perguntas em aberto

- Aprovacao/recusa manual de documento pendente deve ser persistida no processo ou deve ser removida por completo?
- Para documento sem IA e pendente, o operador ainda pode aprovar manualmente antes de confirmar agenda?
- As abas apos agenda devem ser `Procedimento`, `Saude`, `Historico` e `Anexos`, ou manter menos abas para reduzir escopo?

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- Processo `NOVA` exibir somente area de anexos/conferencia documental.
- Processo `NOVA` nao exibir campos de procedimento, saude ou historico antes da agenda confirmada.
- Documento aprovado pela IA nao mostrar botoes manuais de aprovar/recusar.
- `Confirmar Agenda` respeitar documentos obrigatorios pendentes, ausentes ou recusados.
- Processo `AGENDADA` liberar areas operacionais.
- Botao `Salvar dados do animal` for removido do JSX e CSS associado.
- Botoes do modal tiverem padrao visual consistente.
- CSS duplicado/empilhado do modal for reduzido sem criar novo override final.
- `git diff --check`, `npm run typecheck` e `npm run build` passarem.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao alterar backend, banco, migrations, `.env`, CI/CD ou deploy sem nova confirmacao.
- Seguir `/AGENT.md`.
- `frontend/AGENT.md` foi citado pelo AGENT raiz, mas nao existe no workspace atual.
- Manter alteracoes pequenas e focadas em `RequestPreviewModal`, `request-actions` e estilos do modal.
- Antes de remover CSS, buscar usos com `rg`.
- Nao aplicar gambiarra com novo bloco final se for possivel consolidar a regra existente.
- Preservar alteracoes pendentes do usuario no worktree.
