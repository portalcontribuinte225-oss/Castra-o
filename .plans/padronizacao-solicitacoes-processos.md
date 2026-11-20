# Plano de implementação da padronização de Solicitações e Processo

## Origem

- Escopo definido no chat a partir da revisão de Solicitações e do modal Processo.
- Plano preliminar aprovado em 20/11/2026.
- Classificação `frontend-only`.

## Resumo

Aplicar às Solicitações internas e ao modal Processo o padrão visual de Configurações. Migrar a lista e os filtros como piloto, depois o cadastro de balcão e o Processo. Preservar o comportamento dos filtros, os dados e vínculos por município, as permissões e as ações de cada procedimento.

## Escopo

### Dentro do escopo

- **Solicitações** com lista, cards de pedidos e credenciamentos, botão Criar solicitação, filtro Hoje, painel de filtros, busca no painel, chips e estado vazio.
- **Nova solicitação de balcão** com as etapas Você, Animal, Agenda e Documentos, navegação, erros, confirmação e download do requerimento.
- **Processo** com Anexos, Procedimento e saúde, Dados do tutor, cabeçalho, rodapé, estados e variantes de óbito, troca de tutor e denúncia.
- Submodais do Processo para atribuição, indeferimento, conclusão de solicitação especial quando aplicável, reagendamento, receita, prévia e alterações pendentes. Conferir os pontos de entrada por Solicitações e Agenda.

### Fora do escopo

- Redesenho da Agenda, de Credenciamentos, da navegação global, de Configurações ou do portal do cidadão.
- Alterações em contratos da API, permissões, regras de negócio, notificações, conteúdo de PDF, banco ou infraestrutura.
- Replicação de um novo modelo visual de selects antes de sua aprovação específica. Selects e controles de seleção existentes preservam opções, valores e interações.

## Leitura de contexto

- `AGENT.md` e o plano preliminar aprovado no chat.
- `.plans/padronizacao-configuracoes.md` e `.plans/padronizacao-area-externa.md` como referências visuais.
- `.plans/modal-processo-por-procedimento.md` como histórico das regras e dos fluxos do Processo. Usar os componentes e os contratos atuais como referência para o comportamento.
- `src/App.tsx` nos trechos de `AdminDashboard`, `NewRequest` com `internalSimple` e prévia de documento.
- `src/features/request-filters/`, `src/features/process-modal/`, `src/features/tutor-data/` e os trechos de `src/styles.css` que afetam essas telas.

## Impacto por área

### Frontend

Reaproveitar `Card`, `Input`, `Button` e `CloseButton`, com Tailwind no JSX e os tokens do tema. Aplicar aos campos de texto o padrão de fundo branco, 44 px de altura, raio de 14 px e uma borda verde no foco. Preservar tipos, máscaras, estados desabilitado e somente leitura e a altura multilinha das textareas. Os botões usam a geometria em pílula e mantêm a cor de cada ação. Manter a semântica de filtros, abas e seletores de animal e procedimento.

### Backend

Sem impacto esperado. Preservar as chamadas, os payloads, a geração de documentos e a lógica atual de atualização.

### Banco de dados

Sem impacto esperado. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infraestrutura e deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` nos trechos de Solicitações, cadastro interno e prévia do Processo.
- `src/styles.css` e `src/features/request-filters/request-filters.css`.
- Componentes visuais em `src/features/request-filters/`, `src/features/request-steps/`, `src/features/request-requester/` e nos campos do cadastro compartilhado que tenham uma variante interna.
- `src/features/process-modal/`, `src/features/tutor-data/tutor-data-tab.tsx` e `src/features/request-analysis-sections.tsx`.
- Primitivas de interface em `src/components/`, caso um ajuste compartilhado seja necessário, e testes existentes afetados pela marcação.
- `src/features/agenda.tsx` como referência para verificar a integração com o modal compartilhado.

## O que será removido

- A marcação `article` com `role="button"`, `tabIndex` e teclas tratadas manualmente nos cards migrados para botão nativo. Remover também as regras de interação e aparência exclusivas desses cards que perderem uso.
- As variantes legadas de aparência para Hoje, abertura do painel de filtros, busca, chips e ações de limpar e visualizar os resultados, após a substituição pelas primitivas. Preservar as regras do painel de Agenda e de Credenciamentos que ainda tenham consumidores.
- A marcação do X em `.irm-close-btn` e as variantes visuais internas substituídas no formulário de balcão, nos campos e no cartão de confirmação. Preservar os ramos que definem comportamento do cadastro interno.
- O X próprio de `.assign-modal-close` e o da prévia interna substituídos por `CloseButton`. Retirar ramos de `.prm-pdf-btn`, `.prm-action-btn` e estilos legados de campos e foco conforme perderem seus consumidores.
- Imports e contêineres que ficarem sem uso após cada migração. Em seletores agrupados, retirar o ramo substituído e conservar os ramos ainda usados na Agenda, em Credenciamentos ou no portal.

## Estratégia de implementação

1. **Lista e filtros como piloto.** Inventariar as regras efetivas de `.triage-card`, da barra de controles e de `.ag-drawer*`. Aplicar o padrão a Criar solicitação, Hoje, Filtros, busca do painel, chips e ações de limpeza. Usar `Card` como botão nativo na lista, mantendo Protocolo, Tutor, Animal, Tipo, Responsável, Agenda, status e indicação de reagendamento. Preservar o destino dos cards de credenciamento e a leitura das contagens. Completar a contenção de foco no painel e manter Esc e retorno ao acionador.
2. **Nova solicitação de balcão.** Migrar o cabeçalho, as ações, a barra de etapas e os campos das quatro etapas. Usar a apresentação compartilhada nos pontos em que a variante interna coincide com a pública. Preservar o comportamento de `internalSimple`, as observações internas, a duplicação de animal quando disponível, a consulta de vagas, os anexos pendentes, o momento do envio e a confirmação com protocolo e PDF.
3. **Processo e submodais.** Começar pelo cabeçalho, pelas abas e pelo rodapé, mantendo a aba inicial e a navegação por teclado. Migrar os cards de animal e procedimento, os campos de saúde e tutor, as linhas de anexo e os formulários variantes. Nos anexos, conservar ações independentes para visualizar, baixar, anexar ou avaliar conforme as permissões. Padronizar os submodais e a prévia interna, deixando Escape restrito à camada superior e conectado ao mesmo fechamento do X. Manter o aviso e as ações de salvar, descartar ou continuar editando quando houver alterações pendentes.
4. **Remoção e verificação por fluxo.** Eliminar o código e o CSS que perderem uso junto com sua substituição. Conferir foco, seleção, carregamento, erros, êxito e estados vazios nos pontos de entrada atuais. Rodar as validações do projeto ao final e entregar o roteiro de conferência visual ao usuário.

## Regras de negócio identificadas

- Hoje e os filtros de Etapa, Tipo e Responsável combinam seus critérios. As alterações no painel se aplicam ao marcar e desmarcar. A ação de ver o resultado fecha o painel.
- Solicitações de procedimento abrem Processo. Cards de credenciamento abrem a área de Credenciamentos.
- O fluxo de balcão conserva o tratamento atual de documentos pendentes, declaração, observações internas, vagas, anexos, protocolo e download do requerimento.
- O Processo abre em Anexos. O status, a agenda, a execução e os rascunhos são tratados por procedimento de cada animal conforme a implementação atual.
- Preservar as condições de atribuição, de conferência de documentos e de mudança de status, inclusive as ações específicas de óbito, troca de tutor e denúncia.

## Regras multi-tenant e segurança

- Preservar o município de cada solicitação e o recorte por município para responsáveis, usuários, setores, documentos e disponibilidade de agenda.
- Manter os controles existentes por perfil, inclusive o modo somente leitura de Processo, os campos bloqueados de identificação do tutor e as condições de edição de credenciais.
- Preservar a autorização das operações de anexos, geração e download de PDF, reagendamento, atribuição e decisões. Manter os links, os parâmetros e as chamadas existentes.

## Validações necessárias

- **Lista e filtros** com contagens, filtros cumulativos, pesquisa de responsável, limpeza, estado vazio e abertura de pedido e credenciamento. Conferir Enter e Espaço no card, Tab no painel, Esc e retorno do foco.
- **Balcão** com navegação pelas etapas, cadastro com mais de um animal, carregamento e colisão de vaga, validações da variante interna, falha no envio e confirmação com protocolo e requerimento.
- **Processo** aberto pelos dois pontos de entrada, com usuário de edição e de leitura. Conferir mudança entre animais e procedimentos, anexos obrigatórios, atribuição, campos bloqueados, erro de salvamento e ações disponíveis por status.
- **Submodais** com retorno de foco após fechamento, Esc na camada superior, rolagem e acesso ao rodapé. Conferir o aviso ao tentar fechar Processo com rascunhos.

## Testes necessários

### Frontend

- Rodar as suítes existentes de filtros, etapas, cadastro da solicitação, ações de solicitação, Processo, dados do tutor e relatório.
- Atualizar as asserções que dependem da marcação antiga. Acrescentar cobertura quando for necessária para capturar regressão no botão nativo, nos estados de filtro, nos bloqueios ou na proteção de rascunhos.

### Backend

- Rodar a suíte de regressão existente para conferir compatibilidade com as operações afetadas.

### Conferência manual pelo usuário

- Em desktop e celular, conferir a lista, o painel de filtros e o cadastro de balcão, da primeira etapa ao protocolo.
- Abrir Processo por Solicitações e Agenda. Conferir as três abas, ações por perfil, botões do rodapé, Esc e retorno de foco nos submodais.

## Comandos de validação sugeridos

```text
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

## Riscos e pontos de atenção

- Há estilos repetidos de cards e filtros em `src/styles.css`. As regras de `.ag-drawer*`, cards e filtros também atingem Agenda e Credenciamentos.
- Campos do Processo recebem estilos de `.field` em várias camadas. A migração deve tratar os seletores efetivos e conferir o foco, a borda, o fundo e o estado inválido.
- O cadastro interno compartilha o fluxo do cidadão. As divergências legítimas do balcão devem ser preservadas.
- O Processo inclui modais aninhados, botões desabilitados durante operações e salvamento de rascunhos. A gestão de foco precisa respeitar a ordem das camadas e as guardas existentes.

## Perguntas em aberto

- O modelo visual dos selects permanece sujeito a aprovação específica. Os três fluxos podem avançar com os selects atuais.

## Critérios de aceite

- Lista e filtros, Nova solicitação de balcão e Processo reutilizam os componentes e os tokens aprovados dentro do escopo.
- Os fluxos preservam permissões, município, validações, destinos, filtros, bloqueios, rascunhos e ações atuais.
- Cards, filtros, abas e submodais são operáveis por teclado. O foco retorna ao acionador e as mensagens de erro e progresso permanecem acessíveis.
- O CSS substituído que perder consumidores foi deletado. As validações passam e o usuário recebe o roteiro de conferência em desktop e celular.

## Observações para a skill `implementar`

- Usar este plano e `AGENT.md` como referência em uma invocação separada de `/implementar`.
- Aplicar o modelo visual dos selects após a aprovação específica.
- Remover os ramos substituídos junto com a migração e preservar os consumidores compartilhados identificados.
