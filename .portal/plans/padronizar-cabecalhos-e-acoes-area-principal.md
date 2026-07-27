# Plano de Implementação: Padronizar Cabeçalhos e Ações na Área Principal

## Origem

- Arquivo de especificação: `conversa do usuário em 2026-07-27; sem arquivo .md em disco`
- Data do planejamento: `2026-07-27`
- Classificação: `frontend-only`

## Resumo

Padronizar a estrutura das telas internas para que todos os cabeçalhos apareçam dentro da área principal conforme a navegação. O cabeçalho de página deve conter somente título e subtítulo. Ações específicas da tela, como abas, filtros, botões, busca local, período e alternância de visualização, devem ficar em uma faixa separada logo abaixo do cabeçalho.

A solução deve reutilizar estilos estruturais globais para reduzir duplicidade, mas sem padronizar globalmente o visual interno de botões, abas ou segmentos de cada tela. Dashboard e Agenda devem manter seus estilos próprios de controles.

## Escopo

### Dentro do escopo

- Criar ou ajustar classes globais estruturais para cabeçalho de página.
- Criar ou ajustar uma classe estrutural para a faixa de ações abaixo do cabeçalho.
- Separar visualmente, em cada tela principal:
  - cabeçalho da página;
  - ações e controles da tela;
  - conteúdo principal.
- Aplicar o padrão nas telas operacionais principais:
  - Dashboard;
  - Solicitações;
  - Agenda;
  - Relatórios;
  - Credenciamentos;
  - Adoção.
- Garantir que o cabeçalho contenha apenas título e subtítulo.
- Garantir que ações, abas, filtros e botões fiquem abaixo do cabeçalho.
- Preservar o estilo próprio dos controles de Dashboard e Agenda.
- Evitar que classes globais de cabeçalho vazem estilos para botões, abas ou segmentos específicos.
- Revisar responsividade em desktop, notebook e mobile até 640px.

### Fora do escopo

- Alterar regras de negócio.
- Alterar cálculos, métricas, filtros ou estados funcionais.
- Alterar endpoints, permissões, roles ou isolamento multi-tenant.
- Alterar backend.
- Alterar banco de dados ou migrations.
- Alterar topbar, sidebar ou shell global além do necessário para compatibilidade visual.
- Criar novas dependências.
- Criar componente React obrigatório nesta etapa.
- Fazer limpeza ampla de CSS antigo que não esteja diretamente envolvido no padrão.

## Leitura de contexto

- `/AGENT.md`
- `package.json`
- `src/styles.css`
- `src/App.tsx`
- `src/features/dashboard.tsx`
- `src/features/agenda.tsx`
- `src/features/reports.tsx`
- `src/features/accessRequests.tsx`
- Conversa do usuário sobre:
  - cabeçalho correto como título e subtítulo;
  - main shell/topbar como estrutura geral;
  - ações abaixo do cabeçalho;
  - reutilização de estilos sem forçar controles iguais.

Observação: não foram encontrados `frontend/AGENT.md` ou `backend/AGENT.md` neste repositório.

## Impacto por área

### Frontend

A mudança é restrita ao frontend.

Impactos esperados:

- `src/styles.css`:
  - consolidar classes globais para estrutura de cabeçalho;
  - consolidar classe estrutural para faixa de ações;
  - remover ou reduzir estilos globais que formatam botões, abas e segmentos de forma genérica demais;
  - escopar regras para impedir interferência em Agenda e Dashboard;
  - manter responsividade sem scroll horizontal indevido.

- `src/features/dashboard.tsx`:
  - manter o cabeçalho dentro da área principal;
  - garantir que ele tenha só título e subtítulo;
  - manter abas e filtro de período em uma faixa de ações abaixo;
  - preservar classes e estilos próprios `opdash-*` para controles.

- `src/features/agenda.tsx`:
  - manter o cabeçalho dentro da área principal;
  - garantir que ele tenha só título e subtítulo/período textual;
  - manter navegação anterior/hoje/próximo e visões em faixa abaixo;
  - preservar classes e estilos próprios `ag-*` para controles.

- `src/features/reports.tsx`:
  - separar título/subtítulo de busca, filtros e botões;
  - manter comportamento de busca, limpar, exportar e prontuário.

- `src/features/accessRequests.tsx`:
  - separar título/subtítulo de estatísticas e filtros;
  - manter contadores, filtro de status e revisão.

- `src/App.tsx`:
  - ajustar Solicitações e Adoção no mesmo padrão estrutural;
  - preservar ações e handlers existentes.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css`
- `src/App.tsx`
- `src/features/dashboard.tsx`
- `src/features/agenda.tsx`
- `src/features/reports.tsx`
- `src/features/accessRequests.tsx`

## Estratégia de implementação

1. Mapear a estrutura atual dos cabeçalhos nas seis telas principais.
2. Definir o padrão final de layout:
   - cabeçalho de página com título e subtítulo;
   - faixa de ações abaixo;
   - conteúdo principal em seguida.
3. Revisar as classes globais atuais de `page-header`, `page-header-main`, `page-title`, `page-subtitle`, `page-controls`, `page-tabs`, `page-segment` e `page-actions`.
4. Manter ou renomear as classes globais que servem apenas para estrutura de cabeçalho.
5. Remover do padrão global qualquer estilo que formate botões, abas ou segmentos de forma universal.
6. Criar ou ajustar uma classe estrutural de ações que controle somente:
   - posição abaixo do cabeçalho;
   - espaçamento entre grupos;
   - alinhamento;
   - quebra responsiva.
7. Ajustar Dashboard:
   - cabeçalho com título e subtítulo somente;
   - controles em faixa separada;
   - estilos próprios `opdash-*` preservados.
8. Ajustar Agenda:
   - cabeçalho com título e subtítulo/período textual somente;
   - controles em faixa separada;
   - estilos próprios `ag-*` preservados.
9. Ajustar Solicitações, Relatórios, Credenciamentos e Adoção para o mesmo padrão estrutural.
10. Remover seletor global que alcance diretamente controles específicos como `ag-header-row` ou `opdash-controls-row`.
11. Validar responsividade e ausência de texto cortado.
12. Rodar validações do projeto.

## Regras de negócio identificadas

- O cabeçalho de página muda conforme a navegação atual.
- O cabeçalho representa apenas o contexto da tela.
- Ações e controles pertencem à tela, mas não fazem parte do cabeçalho conceitual.
- Cada tela mantém seu comportamento atual.
- Cada tela pode manter identidade visual própria nos controles.
- O padrão global deve padronizar estrutura, não comportamento nem estilo específico de controles.

## Regras multi-tenant e segurança

Sem impacto direto esperado.

Cuidados:

- Não alterar filtros de município.
- Não alterar permissões por role.
- Não alterar escopo de dados visíveis.
- Não alterar endpoints ou payloads.
- Não alterar relatórios/PDFs além da posição visual dos controles na tela.

## Validações necessárias

- Dashboard:
  - cabeçalho aparece na área principal;
  - cabeçalho contém somente título e subtítulo;
  - abas e período ficam abaixo;
  - abas e período continuam funcionando.

- Agenda:
  - cabeçalho aparece na área principal;
  - cabeçalho contém somente título e subtítulo/período textual;
  - navegação e visões ficam abaixo;
  - anterior, hoje, próximo e visões continuam funcionando.

- Solicitações:
  - cabeçalho contém somente título e subtítulo;
  - criar solicitação, abas e filtro Hoje ficam abaixo;
  - filtros e criação continuam funcionando.

- Relatórios:
  - cabeçalho contém somente título e subtítulo;
  - busca, filtros e botões ficam abaixo;
  - buscar, limpar, exportar e prontuário continuam funcionando.

- Credenciamentos:
  - cabeçalho contém somente título e subtítulo;
  - estatísticas e filtros ficam abaixo;
  - revisão e filtros continuam funcionando.

- Adoção:
  - cabeçalho contém somente título e subtítulo;
  - estatísticas e ações ficam abaixo;
  - cadastro, filtros e fluxo de adoção continuam funcionando.

- Responsivo:
  - desktop largo;
  - notebook;
  - mobile até 640px;
  - sem texto cortado;
  - sem scroll horizontal na página inteira.

## Testes necessários

### Frontend

- Teste manual visual das seis telas principais.
- Teste manual de navegação entre telas para confirmar troca correta do cabeçalho.
- Teste manual de ações principais de cada tela.
- Teste responsivo em desktop, notebook e mobile.
- Se houver navegador automatizado disponível, capturar estado visual após abrir cada tela.

### Backend

Sem impacto esperado.

### E2E

- Abrir o app autenticado.
- Navegar por Dashboard, Solicitações, Agenda, Relatórios, Credenciamentos e Adoção.
- Confirmar que cada tela exibe cabeçalho correto na área principal.
- Confirmar que ações aparecem logo abaixo do cabeçalho.
- Confirmar que controles continuam clicáveis.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
git diff --check
```

Observação: `package.json` não possui scripts `lint` ou `test`; não inventar comandos inexistentes.

## Riscos e pontos de atenção

- `src/styles.css` possui várias camadas históricas de CSS; uma regra global ampla pode causar regressão visual em telas específicas.
- Dashboard e Agenda têm controles próprios e não devem herdar estilos globais de botões/abas.
- Separar cabeçalho e ações pode alterar espaçamentos verticais; validar principalmente em mobile.
- Algumas telas atuais ainda usam classes antigas como `workspace-heading`, `reports-toolbar`, `cr-toolbar`, `adoption-command-header`; remover só quando estiver comprovadamente sem uso.
- O repositório possui mudanças locais recentes e commit local não enviado ao remoto; a implementação deve trabalhar com o estado atual sem reverter tarefas anteriores.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- Todos os cabeçalhos das telas principais aparecerem dentro da área principal conforme navegação.
- Cada cabeçalho contiver somente título e subtítulo.
- Ações, filtros, abas e botões estiverem em faixa separada abaixo do cabeçalho.
- Estilos estruturais forem reutilizados.
- Botões, abas e segmentos específicos não forem padronizados globalmente.
- Dashboard e Agenda preservarem seus estilos próprios de controles.
- Nenhuma regra de negócio, permissão, endpoint ou dado for alterado.
- `npm run typecheck` passar.
- `npm run build` passar.
- `git diff --check` passar.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não alterar backend.
- Não executar migrations.
- Não instalar dependências.
- Não transformar a padronização em componente React obrigatório nesta etapa.
- Manter alterações pequenas e focadas.
- Reutilizar estilos estruturais, não estilos internos de controles.
- Preservar classes específicas de cada tela quando elas forem necessárias para identidade visual ou comportamento.
- Validar UTF-8 dos textos visíveis após qualquer edição.