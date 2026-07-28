# Plano de Implementacao: Unificar Modal de Processo, Agenda e Anexos

## Origem

- Arquivo de especificacao: conversa com o usuario e prints do modal de processo
- Data do planejamento: 2026-07-28
- Classificacao: `frontend-only`

## Resumo

Unificar a experiencia do modal de processo para que processos `NOVA` e `AGENDADA` usem a mesma estrutura visual. Antes da agenda confirmada, o modal deve abrir em `Anexos`, manter a aba `Procedimento e saude` visivel mas bloqueada, e expor as acoes de atribuicao, indeferimento e confirmacao de agenda. Depois da agenda confirmada, o mesmo modal libera a aba de procedimento/saude e as acoes de atendimento.

A mudanca evita duas telas diferentes para o mesmo processo e torna claro que a validacao de anexos/deferimento documental vem antes da execucao do atendimento.

## Escopo

### Dentro do escopo

- Ajustar `RequestPreviewModal` para sempre renderizar as abas `Procedimento e saude` e `Anexos` quando o modal nao estiver em modo de reagendamento.
- Para processo `NOVA`, abrir em `Anexos` e deixar `Procedimento e saude` desabilitada.
- Para processo `AGENDADA`, abrir em `Procedimento e saude` e manter `Anexos` disponivel para consulta.
- Bloquear acoes de atendimento antes da agenda confirmada: `Nao compareceu`, `Reagendar`, `Emitir receita` e `Confirmar atendimento`.
- Manter acoes de analise antes da agenda: `Atribuir`, `Indeferir` e `Confirmar agenda`.
- Manter documentos aprovados pela IA como aceitos automaticamente, sem exigir aprovacao manual.
- Manter documentos obrigatorios ausentes, pendentes ou recusados bloqueando a confirmacao da agenda.
- Permitir indeferimento por anexo problemático e indeferimento em lote quando houver anexos obrigatorios bloqueando a agenda.
- Reaproveitar helpers atuais de anexos sempre que possivel, especialmente `blockingAttachments`, `isAttachmentBlockingSchedule`, `requiresManualDocumentDecision` e `docDecisions`.
- Ajustar CSS das abas/botoes somente onde necessario para estado desabilitado e leitura visual consistente.

### Fora do escopo

- Criar ou alterar endpoints.
- Alterar banco de dados, migrations, schemas ou contratos persistidos.
- Alterar provedor de IA externa ou regras de chamada da IA.
- Alterar PDF/requerimento fora do que ja estiver pendente nesta sessao.
- Refatorar completamente `src/App.tsx`.
- Criar nova arquitetura de tabs ou modal.
- Fazer commit, push ou deploy.

## Leitura de contexto

- `/AGENT.md`
- `frontend/AGENT.md`: nao existe no repositorio atual
- `backend/AGENT.md`: nao existe no repositorio atual
- `src/App.tsx`
- `src/styles.css`
- Estado atual do git: ha alteracoes pendentes em `src/App.tsx` e `src/styles.css`; a implementacao deve trabalhar com elas sem reverter trabalho anterior do usuario.

## Impacto por area

### Frontend

Impacto esperado em `RequestPreviewModal`, no fluxo de abas, rodape de acoes e lista de anexos.

Alteracoes principais:

- Centralizar estado de etapa do modal com helpers legiveis, por exemplo:
  - `isScheduleConfirmed`
  - `canUseProcedureTab`
  - `procedureTabBlockReason`
  - `canUseAttendanceActions`
- Remover condicional que esconde totalmente a aba `Procedimento e saude` em processos `NOVA`.
- Desabilitar a aba clinica quando a agenda ainda nao foi confirmada.
- Impedir troca para aba clinica quando bloqueada.
- Manter `Anexos` como aba ativa em `NOVA`.
- Manter `Procedimento e saude` como aba ativa em `AGENDADA`.
- Ajustar rodape conforme etapa operacional.
- Ajustar acoes/documentos para permitir indeferimento individual ou em lote por anexo solicitado.
- Atualizar CSS existente para estado disabled de aba, evitando CSS empilhado no fim do arquivo.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estrategia de implementacao

1. Revisar o estado atual de `RequestPreviewModal` em `src/App.tsx`, especialmente `canAnalyze`, `canRecordAttendance`, `modalTab`, `blockingAttachments`, `confirmSchedule`, `confirmRejectInline` e renderizacao do footer.
2. Criar helpers locais para deixar explicitas as permissões por etapa:
   - `isScheduleConfirmed`: verdadeiro para `AGENDADA` ou status posteriores que possam consultar atendimento, conforme padrao atual.
   - `canUseProcedureTab`: verdadeiro quando a agenda estiver confirmada.
   - `procedureTabBlockReason`: texto curto para tooltip quando bloqueada.
   - `canUseAttendanceActions`: verdadeiro quando as acoes de atendimento podem aparecer/funcionar.
3. Alterar a inicializacao e o `useEffect` de `modalTab`:
   - `NOVA` deve forcar `anexos`.
   - `AGENDADA` deve permitir `procedimento`.
   - Se a aba ativa ficar invalida apos mudanca de status/request, corrigir automaticamente para aba permitida.
4. Renderizar sempre as duas abas no modal normal:
   - `Procedimento e saude` com `disabled`, `aria-disabled` e `title` quando bloqueada.
   - `Anexos` sempre clicavel.
5. Renderizar o conteudo de `Procedimento e saude` somente quando a aba estiver ativa e liberada.
6. Para tentativa de acesso bloqueado, manter comportamento simples: nao trocar de aba e explicar por `title`/estado visual, sem modal extra.
7. Manter a lista de anexos como tela operacional de validacao antes da agenda.
8. Ajustar indeferimento:
   - Para anexo obrigatorio problemático, adicionar ou reaproveitar acao individual de recusa quando aplicavel.
   - Para lote, usar `blockingAttachments` para preencher/sugerir motivo documental no painel de indeferimento geral.
   - Evitar duplicar a regra de bloqueio; toda decisao deve passar pelos helpers existentes.
9. Ajustar o footer:
   - `NOVA`: `Atribuir`, `Indeferir`, `Confirmar agenda`.
   - `AGENDADA`: `Nao compareceu`, `Reagendar`, `Emitir receita`, `Confirmar atendimento`.
10. Atualizar `src/styles.css` no bloco existente de `.prm-tab`/`.prm-action-btn` para suportar estado disabled sem criar override solto no fim.
11. Remover codigo morto ou condicionais antigas que deixarem de ser usadas.
12. Rodar validacoes e revisar diff.

## Regras de negocio identificadas

- O modal deve ser visualmente o mesmo antes e depois da agenda confirmada.
- Antes da agenda confirmada, o processo deve focar em validacao documental/anexos.
- A aba `Procedimento e saude` deve ficar visivel mas bloqueada antes da confirmacao da agenda.
- Acoes clinicas/atendimento so devem ser liberadas apos deferimento e confirmacao da agenda.
- Documento aprovado pela IA conta como aprovado e nao precisa de aprovacao manual.
- Documento obrigatorio ausente, pendente ou recusado bloqueia `Confirmar agenda`.
- Indeferimento pode ocorrer por anexo solicitado individualmente ou em lote quando os anexos bloquearem o processo.
- Documento de sistema e foto do animal nao devem bloquear a agenda.

## Regras multi-tenant e seguranca

- Sem mudanca backend ou banco, portanto sem novo risco direto de isolamento multi-tenant.
- Preservar as callbacks existentes (`onApprove`, `onReject`, `onAssign`, `onAttendance`, `patchRequest`) para manter o fluxo atual de permissao e persistencia.
- Nao criar novas rotas nem confiar em dados livres de tenant no frontend.
- Nao alterar `.env`, CI/CD ou configuracoes de deploy.

## Validacoes necessarias

- Processo `NOVA`:
  - abre em `Anexos`;
  - mostra `Procedimento e saude` desabilitada;
  - nao permite acessar procedimento antes da agenda;
  - mostra acoes `Atribuir`, `Indeferir`, `Confirmar agenda`;
  - `Confirmar agenda` so libera quando anexos obrigatorios estiverem resolvidos.
- Processo `AGENDADA`:
  - abre em `Procedimento e saude`;
  - permite alternar para `Anexos`;
  - mostra acoes de atendimento;
  - nao mostra acoes de confirmacao de agenda.
- Anexos:
  - aprovado por IA nao pede decisao manual;
  - ausente/pendente/recusado bloqueia agenda;
  - indeferimento individual/lote usa os anexos bloqueadores.
- Acessibilidade basica:
  - botao de aba bloqueada deve usar `disabled` ou `aria-disabled` com `title` explicativo.

## Testes necessarios

### Frontend

- Se houver infraestrutura de testes disponivel, cobrir:
  - `NOVA` renderiza abas iguais, com procedimento bloqueado.
  - `AGENDADA` libera procedimento e acoes de atendimento.
  - anexos aprovados por IA liberam confirmacao de agenda.
  - anexos bloqueadores impedem confirmacao e alimentam motivo de indeferimento.

### Backend

- Sem testes backend esperados.

### E2E

- Opcional/manual: abrir modal de processo `NOVA`, validar anexos, confirmar agenda e verificar que a aba `Procedimento e saude` fica liberada apos atualizar status.

## Comandos de validacao sugeridos

```bash
npm run typecheck
npm run build
git diff --check
```

Observacao: o `package.json` atual nao possui scripts `lint` nem `test`.

## Riscos e pontos de atencao

- Risco de liberar a aba clinica cedo demais se a regra de status for ampla.
- Risco de confundir `Confirmar agenda` com `Confirmar atendimento`; manter acoes separadas por status.
- Risco de duplicar regra documental; preferir reaproveitar helpers ja existentes.
- Risco de conflitar com alteracoes pendentes em `src/App.tsx`/`src/styles.css`; nao reverter mudancas do usuario.
- Commit/push sao responsabilidade da skill `finalizar`; este plano nao deve gerar commit.

## Perguntas em aberto

- Confirmado pelo usuario: o modal desejado e o mesmo do status `AGENDADA`, porem com opcoes de agendamento e validacao de anexos enquanto ainda esta `NOVA`.
- Interpretacao adotada: `deferimento por anexo solicitado ou em lote` significa indeferimento/recusa da solicitacao por problema documental, individualmente por anexo ou em lote pelos anexos bloqueadores.

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- O modal de processo `NOVA` e `AGENDADA` usar a mesma estrutura visual de abas.
- `Procedimento e saude` estiver visivel e bloqueado antes da confirmacao de agenda.
- `Anexos` continuar sendo a area principal de validacao antes da agenda.
- As acoes do rodape mudarem corretamente por etapa.
- Anexos obrigatorios pendentes/ausentes/recusados bloquearem `Confirmar agenda`.
- Anexos aprovados pela IA nao exigirem aprovacao manual.
- Indeferimento por anexo/lote estiver disponivel sem duplicar regras.
- `npm run typecheck`, `npm run build` e `git diff --check` passarem.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao executar migrations.
- Nao alterar backend, banco, env, CI/CD ou deploy.
- Nao criar branch, commit ou push durante `implementar`.
- Trabalhar com as alteracoes pendentes existentes em `src/App.tsx` e `src/styles.css`, sem revertê-las.
- Manter mudancas pequenas e focadas no modal de processo.