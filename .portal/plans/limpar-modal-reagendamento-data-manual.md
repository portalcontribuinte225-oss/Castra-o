# Plano de Implementacao: Limpar Modal de Reagendamento com Data Manual

## Origem

- Arquivo de especificacao: `solicitacao inline no chat`
- Data do planejamento: `2026-07-28`
- Classificacao: `frontend-only`

## Resumo

Limpar visualmente o modo de reagendamento dentro do modal de processo, removendo camadas e textos redundantes, otimizando o espaco util e adicionando uma opcao para informar data especifica no formato `dd/mm/aaaa`.

## Escopo

### Dentro do escopo

- Simplificar a estrutura JSX do painel de reagendamento.
- Remover descricoes visiveis desnecessarias do painel.
- Adicionar campo de data manual `dd/mm/aaaa`.
- Manter selecao pelas datas existentes da agenda.
- Ajustar estilos para reduzir fundos duplicados e aproveitar melhor o modal.
- Padronizar botoes e botao de fechar dentro do padrao atual.

### Fora do escopo

- Alterar backend, banco de dados, migrations ou contratos de API.
- Alterar regras gerais de agenda fora do modal.
- Alterar relatorios ou PDF.
- Criar novas dependencias.

## Leitura de contexto

- `/AGENT.md`
- `frontend/AGENT.md`: nao encontrado no workspace
- `src/App.tsx`
- `src/styles.css`
- `src/features/request-actions.ts`
- `src/features/agenda.tsx`

## Impacto por area

### Frontend

Impacto no `RequestPreviewModal`, especificamente no modo `activePanel === "reschedule"`.

Alteracoes previstas:

- Remover wrapper visual redundante `prm-inline-panel-wrap` quando nao for necessario.
- Manter apenas uma superficie visual principal para o painel.
- Remover os textos visiveis `Escolha uma nova data para a agenda.` e `Motivo do reagendamento`.
- Manter acessibilidade com `aria-label` nos campos sem label visual.
- Criar input de data especifica com placeholder `dd/mm/aaaa`.
- Permitir que a data digitada alimente `selectedRescheduleDate` em formato compativel com o fluxo atual.
- Ajustar CSS escopado em `.prm-modal--reschedule`.

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

1. Revisar o JSX atual de `renderInlineReschedule`.
2. Remover os textos auxiliares visiveis solicitados.
3. Adicionar estado/handler para data manual se o estado existente nao for suficiente.
4. Converter `dd/mm/aaaa` para o formato atualmente usado por `selectedRescheduleDate`.
5. Garantir que selecionar um card de agenda e digitar data manual nao deixem estados conflitantes.
6. Simplificar a renderizacao em modo reagendamento, removendo wrapper redundante quando possivel.
7. Consolidar estilos existentes de `.prm-modal--reschedule`, `.prm-inline-panel`, `.reschedule-grid` e botoes relacionados.
8. Rodar validacoes.

## Regras de negocio identificadas

- O reagendamento continua exigindo uma nova data antes de confirmar.
- O motivo continua opcional, mantendo o comportamento atual.
- Datas sem vaga nos cards continuam desabilitadas.
- A data manual deve aceitar apenas valor valido em `dd/mm/aaaa`.
- A confirmacao deve chamar `onReschedule` com a data final selecionada/digitada.

## Regras multi-tenant e seguranca

Sem mudanca de autorizacao, tenant ou backend.

Cuidados:

- Nao alterar origem dos dados da agenda.
- Nao alterar payload alem do valor de data ja enviado pelo fluxo atual.
- Nao criar bypass de permissao no frontend.

## Validacoes necessarias

- Validar data manual em formato `dd/mm/aaaa`.
- Impedir confirmacao sem data valida.
- Manter selecao por card funcionando.
- Garantir que cancelar limpe data, motivo e painel ativo.
- Conferir responsividade em desktop e mobile.

## Testes necessarios

### Frontend

- Validar typecheck do modal apos novos props/handlers.
- Testar manualmente abrir reagendamento, selecionar card e confirmar.
- Testar manualmente digitar data especifica e confirmar.
- Testar data invalida mantendo botao desabilitado.

### Backend

- Sem testes backend esperados.

### E2E

- Nao obrigatorio para este ajuste visual, mas desejavel em fluxo futuro de atendimento/agendamento.

## Comandos de validacao sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

## Riscos e pontos de atencao

- O arquivo `src/styles.css` possui regras acumuladas; remover seletor errado pode afetar outros modais.
- O formato interno de data precisa permanecer compativel com `rescheduleFromPreview`.
- Se a data manual nao existir em `scheduleDays`, a UI nao deve prometer vaga automaticamente.
- Existem alteracoes pendentes no worktree; preservar mudancas nao relacionadas.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Criterios de aceite do plano

- Modal de reagendamento sem fundos brancos duplicados aparentes.
- Textos `Escolha uma nova data para a agenda.` e `Motivo do reagendamento` removidos da tela.
- Campo de motivo mantido com placeholder.
- Campo `dd/mm/aaaa` funcional para data especifica.
- Cards de agenda continuam funcionando.
- Botoes ficam visualmente padronizados.
- `git diff --check`, `npm run typecheck` e `npm run build` passam.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao alterar backend, banco ou migrations.
- Nao empilhar CSS novo no fim se for possivel consolidar/remover regras antigas.
- Preservar mudancas pendentes nao relacionadas no worktree.
- Manter a implementacao pequena e focada no modal de reagendamento.
