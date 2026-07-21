# Plano de Implementacao: Modernizacao de Solicitacoes e Modal de Procedimento

## Origem

- Arquivo de especificacao: `conversa com o usuario; sem arquivo .md externo fornecido`
- Data do planejamento: `2026-06-18`
- Classificacao: `frontend-only`

## Resumo

Modernizar visualmente a tela de Solicitacoes e o modal de procedimento/atendimento, mantendo o dominio atual do sistema e sem copiar textos, fluxo de negocio ou funcionalidades do exemplo visual enviado.

A mudanca deve melhorar hierarquia, densidade, legibilidade, responsividade e acabamento institucional da UI, preservando comportamento, calculos, contratos de dados, permissoes e integracoes existentes.

## Escopo

### Dentro do escopo

- Modernizar o topo da tela de Solicitacoes.
- Melhorar a apresentacao das abas de status: `Novas`, `Em analise`, `Agendadas`, `Reagendadas`, `Realizadas`, `Canceladas`, `Todas`.
- Manter o filtro `Hoje`.
- Restilizar os cards/lista de solicitacoes.
- Modernizar o modal de procedimento, com foco em:
  - cabecalho com protocolo, status e acoes;
  - resumo de tipo, agenda e responsavel;
  - dados de tutor, animal e microchip;
  - lista de documentos;
  - secao de procedimento;
  - rodape com acoes de atendimento.
- Melhorar comportamento responsivo em desktop e mobile.
- Usar classes e estrutura existentes sempre que possivel.

### Fora do escopo

- Alterar backend, APIs, rotas, banco de dados ou permissoes.
- Alterar `.env`.
- Adicionar dependencia, hook, enum, rota, migration ou abstracao nova.
- Criar novo fluxo de negocio.
- Alterar regras de status, atribuicao, atendimento, receita ou reagendamento.
- Alterar payloads ou contratos de dados.
- Criar campos obrigatorios novos.
- Refatorar amplamente `src/App.tsx`.
- Copiar textos, descricoes ou modelo de negocio do exemplo visual.

## Leitura de contexto

- `/AGENT.md`
- `.agents/skills/planejar/SKILL.md`
- `src/App.tsx`
- `src/styles.css`

Observacao: nao existe `frontend/AGENT.md` neste repositorio.

## Impacto por area

### Frontend

Impacto esperado apenas em UI.

Telas e componentes afetados:

- Tela administrativa de Solicitacoes dentro de `AdminDashboard`.
- Cards/lista de solicitacoes.
- Navegacao por abas de status.
- Filtro `Hoje`.
- Modal de procedimento identificado pelas classes `prm-*`, incluindo `prm-modal` e `prm-section--procedure`.

Hooks, query keys e contratos:

- Sem alteracao esperada.
- Manter `useState`, `useMemo`, handlers e props existentes.
- Nao alterar contratos de `patchRequest`, `createRequest`, `scheduleDays`, `teams` ou `requests`.

Estados:

- Preservar empty state atual.
- Preservar abertura do modal por card.
- Preservar estados condicionais de acoes por status, atribuicao e permissao.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado.

Nao alterar env vars, Render, build commands, jobs, workers, storage, filas ou timeouts.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estrategia de implementacao

1. Inspecionar os trechos atuais de `AdminDashboard` e do modal `prm-modal`.
2. Fazer ajustes pequenos e localizados no JSX somente onde a estrutura visual exigir.
3. Manter textos do dominio atual do sistema.
4. Reutilizar classes existentes como `clean-requests-workspace`, `request-filter-tabs`, `triage-card`, `tc-*` e `prm-*`.
5. Evitar criar novos componentes ou abstracoes.
6. Ajustar a tela de Solicitacoes para uma apresentacao mais institucional:
   - topo mais claro;
   - acao principal alinhada;
   - abas compactas;
   - cards brancos com bordas suaves;
   - status e contadores discretos.
7. Ajustar o modal de procedimento:
   - melhorar cabecalho;
   - reforcar resumo operacional;
   - organizar dados principais;
   - refinar documentos;
   - destacar secao de procedimento;
   - manter rodape de acoes claro e responsivo.
8. Adicionar ou ajustar CSS de forma escopada, preferencialmente no final de `src/styles.css`, para reduzir conflito com regras antigas.
9. Verificar responsividade em desktop e mobile.
10. Rodar validacoes.

## Regras de negocio identificadas

- As abas filtram solicitacoes por status e tags atuais.
- O filtro `Hoje` usa a agenda do dia.
- Cards de solicitacao continuam abrindo o modal correspondente.
- O modal preserva acoes condicionais:
  - atribuir ou reatribuir;
  - indeferir;
  - confirmar agenda;
  - registrar nao comparecimento;
  - reagendar;
  - emitir receita;
  - confirmar atendimento.
- Confirmar atendimento continua dependendo das regras atuais de atribuicao.
- Documentos continuam exibindo status, acoes e mensagens atuais.
- O procedimento continua registrando microchip e observacao conforme estado atual.

## Regras multi-tenant e seguranca

Como a mudanca e frontend-only e visual, nao ha alteracao esperada em isolamento multi-tenant, permissao ou origem confiavel de tenant.

Mesmo assim, a implementacao deve:

- nao alterar payloads enviados ao backend;
- nao alterar regras de permissao ou atribuicao;
- nao expor dados adicionais;
- nao modificar relatorios, PDFs ou exports;
- nao alterar fluxo de autenticacao ou selecao de municipio.

## Validacoes necessarias

- Garantir que nenhum input novo obrigatorio seja criado.
- Garantir que os campos existentes do procedimento continuem editaveis quando o estado permitir.
- Garantir que botoes desabilitados continuem respeitando `blockWithoutAssignment`.
- Garantir que textos longos de tutor, animal, responsavel e protocolo nao quebrem o layout.
- Garantir que a lista de documentos continue funcionando com anexos presentes, pendentes ou ausentes.
- Garantir que o modal continue rolavel sem perder o rodape de acoes.

## Testes necessarios

### Frontend

- Validar manualmente a tela de Solicitacoes com dados.
- Validar manualmente a tela de Solicitacoes sem dados.
- Alternar todas as abas.
- Ativar e desativar filtro `Hoje`.
- Abrir cards de diferentes status.
- Conferir modal de procedimento com documentos e sem documentos.
- Conferir modal com acoes de atendimento disponiveis.
- Conferir modal quando acoes estiverem bloqueadas por falta de atribuicao.
- Conferir desktop sem overflow horizontal.
- Conferir mobile com abas e acoes rolaveis/empilhadas sem sobreposicao.

### Backend

- Sem testes backend esperados.

### E2E

- Sem E2E obrigatorio nesta etapa.
- Validacao manual em `http://localhost:3002` e suficiente para este escopo visual.

## Comandos de validacao sugeridos

```bash
npm run typecheck
npm run build
```

Opcional:

```bash
git diff --check -- src/App.tsx src/styles.css
```

## Riscos e pontos de atencao

- `src/App.tsx` e um arquivo grande; a mudanca deve ser pequena e focada.
- `src/styles.css` possui varias camadas antigas para os mesmos componentes; usar CSS escopado para evitar regressao.
- O modal possui muitas acoes condicionais; nao alterar regras de renderizacao ou handlers.
- Mobile pode sofrer com excesso de acoes no rodape; testar empilhamento e quebra de linha.
- Evitar introduzir gradientes, sombras pesadas ou estetica distante do dashboard atualizado.
- Nao alterar arquivos nao relacionados ou lockfiles.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- a tela de Solicitacoes estiver visualmente mais moderna e alinhada ao dashboard atualizado;
- o modal de procedimento estiver mais claro, organizado e responsivo;
- todas as abas e filtros continuarem funcionando;
- as acoes do modal preservarem comportamento atual;
- nao houver alteracao em backend, banco, `.env`, dependencias ou contratos de dados;
- `npm run typecheck` passar;
- `npm run build` passar;
- nao houver overflow horizontal evidente em desktop;
- mobile nao apresentar sobreposicao de textos ou botoes.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Seguir `/AGENT.md`.
- Nao alterar `.env`.
- Nao adicionar dependencias.
- Nao criar enums, hooks, rotas, migrations ou abstracoes sem necessidade real.
- Manter mudancas pequenas e focadas em `src/App.tsx` e `src/styles.css`.
- Preservar comportamento e contratos existentes.
- Preferir ajustes CSS escopados a reestruturacoes amplas.
- Rodar `npm run typecheck` e `npm run build` antes de finalizar.
