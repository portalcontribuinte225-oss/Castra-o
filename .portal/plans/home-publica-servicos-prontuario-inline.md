# Plano de Implementacao: Home Publica com Servicos do Prontuario Inline

## Origem

- Arquivo de especificacao: `conversa: mover servicos do prontuario para o cabecalho e abrir fluxos dentro da home`
- Data do planejamento: `2026-07-25`
- Classificacao: `frontend-only`

## Resumo

Implementar uma melhoria na home publica para que os servicos do prontuario sejam acessados pelo cabecalho e abertos dentro da propria home, sem redirecionar para uma tela isolada. Quando um servico estiver ativo, a home deve ocultar a area de adocao, compactar o banner e exibir o fluxo selecionado ao lado.

## Escopo

### Dentro do escopo

- Adicionar entrada agrupada de prontuario no cabecalho publico.
- Permitir acesso a `Consultar prontuario`, `Solicitar procedimento`, `Troca de tutor` e `Registrar obito`.
- Criar estado de servico publico ativo na home.
- Renderizar os fluxos de prontuario inline na home publica.
- Ocultar estatisticas/adocao/conteudo publico secundario enquanto houver servico ativo.
- Reaproveitar os fluxos existentes de identificacao, consulta, transferencia e obito.
- Criar layout responsivo com banner compacto e area de servico.
- Garantir botao de voltar/fechar para restaurar a home normal.

### Fora do escopo

- Alteracoes de backend.
- Alteracoes de banco de dados.
- Novos endpoints.
- Alteracoes em permissao, autenticacao ou tenant.
- Alteracoes no fluxo administrativo interno.
- Refatoracao ampla de `src/App.tsx`.
- Mudancas no banner alem do modo compacto necessario para a tela de servico.

## Leitura de contexto

- `/AGENT.md`
- `frontend/AGENT.md`: nao existe no repositorio.
- `src/App.tsx`
- `src/styles.css`
- Contexto da conversa com o usuario.

## Impacto por area

### Frontend

Alteracoes esperadas:

- Ajustar `LoginView`/home publica para suportar um estado de servico ativo.
- Alterar o cabecalho publico em `.public-topbar-nav` para expor os servicos do prontuario.
- Reaproveitar `ValidationKeyConsultation` e seus fluxos existentes.
- Adaptar `ValidationKeyConsultation` para renderizacao inline, evitando modal/tela separada quando acionada pela home.
- Adicionar/ajustar classes CSS para:
  - menu/dropdown de prontuario no cabecalho;
  - layout dividido da home em modo servico;
  - banner compacto;
  - area principal do servico;
  - responsividade mobile.
- Preservar os estados existentes de loading, erro, sucesso e empty dos fluxos de consulta.

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

1. Mapear o fluxo atual da home publica:
   - `LoginView`;
   - `PetWelcomeArt`;
   - `ValidationKeyConsultation`;
   - `PublicCastrationForm`;
   - callbacks `onPublicRequest`, `onPublicConsult` e `onRequestProcedure`.

2. Criar estado local na home publica:
   - `activePublicService`;
   - valores esperados: `null`, `prontuario`, `procedure`, `transfer`, `death`.

3. Ajustar o cabecalho publico:
   - manter os itens existentes;
   - transformar `Prontuario` em menu agrupado ou dropdown;
   - cada opcao deve setar `activePublicService`;
   - manter `Solicitacoes`, `Credenciamento`, `Denunciar` e `Entrar`.

4. Criar o modo de home com servico ativo:
   - quando `activePublicService === null`, renderizar home atual;
   - quando houver servico ativo, renderizar layout dividido;
   - ocultar estatisticas e adocao nesse modo.

5. Adaptar `ValidationKeyConsultation`:
   - permitir receber um servico inicial;
   - permitir abrir direto o fluxo selecionado sem exibir o grid central de cards;
   - permitir modo inline sem `modal-backdrop`, caso necessario;
   - manter o comportamento atual quando usada em tela de consulta isolada, se ainda existir.

6. Integrar `Solicitar procedimento`:
   - manter a regra atual que identifica tutor/animal e chama `onRequestProcedure`;
   - abrir o cadastro de solicitacao dentro da area principal quando aplicavel.

7. Ajustar CSS:
   - criar layout desktop com duas colunas;
   - criar layout mobile em coluna unica;
   - criar banner compacto sem quebrar o banner principal;
   - criar menu/dropdown do prontuario no cabecalho;
   - garantir que textos e botoes nao sobreponham.

8. Remover ou esconder o grid central de cards quando a home ja estiver em modo servico, evitando duplicidade de navegacao.

9. Validar navegacao:
   - abrir cada servico pelo cabecalho;
   - voltar para a home;
   - abrir cadastro normal por `Solicitacoes`;
   - abrir credenciamento;
   - conferir mobile.

## Regras de negocio identificadas

- Os servicos do prontuario devem ficar acessiveis no cabecalho publico.
- Ao acessar um servico, a home nao deve redirecionar para uma pagina isolada.
- A home deve se dividir visualmente: banner compacto + conteudo do servico.
- A pagina/area de adocao deve ficar oculta enquanto um servico estiver ativo.
- `Solicitar procedimento` deve continuar vinculado ao tutor identificado quando esse fluxo exigir identificacao.
- `Registrar obito` deve manter destaque visual de atencao.
- Fechar/voltar deve restaurar a home publica normal.

## Regras multi-tenant e seguranca

- O municipio selecionado deve continuar vindo do estado confiavel ja usado na home publica.
- Os fluxos devem continuar recebendo `municipalityId` correto.
- Nao criar novo caminho que permita consultar dados de outro municipio.
- Nao alterar validacoes backend existentes.
- Nao alterar autenticacao, roles ou permissoes.
- Nao alterar relatorios/PDFs.

## Validacoes necessarias

- Se nenhum municipio estiver selecionado, manter a solicitacao de selecionar municipio antes de iniciar fluxos dependentes dele.
- Garantir que `activePublicService` invalido volte para `null` ou seja ignorado.
- Garantir que o fluxo de `procedure` preserve `procedurePrefill`.
- Garantir que fechar servico limpe apenas estado visual do servico, sem apagar estado global indevido.
- Garantir que mobile nao tenha overflow horizontal.

## Testes necessarios

### Frontend

- Testar abertura de cada servico pelo cabecalho.
- Testar voltar/fechar servico e restaurar home normal.
- Testar `Solicitacoes` abrindo cadastro publico normal.
- Testar `Solicitar procedimento` vindo do prontuario.
- Testar `Troca de tutor` e `Registrar obito` com estados de erro/loading.
- Testar responsividade desktop e mobile.

### Backend

- Sem testes backend esperados.

### E2E

- Fluxo publico: abrir home, selecionar municipio, abrir `Consultar prontuario`, fechar e voltar para home.
- Fluxo publico: abrir `Solicitar procedimento`, identificar tutor, seguir para cadastro.
- Fluxo publico: abrir `Troca de tutor` e validar campos obrigatorios.
- Fluxo publico: abrir `Registrar obito` e validar destaque/confirmacao.

## Comandos de validacao sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atencao

- `src/App.tsx` e um arquivo grande; manter mudancas pequenas e focadas.
- Evitar duplicar os fluxos de prontuario em vez de reaproveitar `ValidationKeyConsultation`.
- Evitar quebrar o fluxo atual `screen === "consulta"` caso ele ainda seja usado em algum caminho.
- Risco de regressao mobile no cabecalho se os servicos forem todos exibidos diretamente.
- Risco de poluir o cabecalho; dropdown agrupado em `Prontuario` tende a ser mais seguro.
- Risco operacional: o projeto tem fluxo direto sensivel em `main`; nao fazer commit/push durante implementacao sem instrucao adequada.

## Perguntas em aberto

- Confirmar se o menu deve ser dropdown em `Prontuario` ou quatro botoes visiveis no cabecalho.
- Confirmar se o caminho antigo `Prontuario` como tela separada deve ser mantido como fallback ou substituido totalmente pelo modo inline.
- Confirmar se `Solicitar procedimento` deve sempre exigir CPF/chave antes de abrir cadastro, ou se pode abrir cadastro direto em alguns casos.

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- Os servicos do prontuario estiverem acessiveis pelo cabecalho publico.
- Clicar em um servico abrir o fluxo dentro da home, sem tela isolada.
- A home em modo servico ocultar estatisticas/adocao/conteudo secundario.
- O banner aparecer compacto ao lado do servico no desktop.
- No mobile, o banner compacto aparecer acima do servico.
- O usuario conseguir voltar para a home normal.
- Os fluxos existentes de prontuario, procedimento, troca de tutor e obito continuarem funcionando.
- `npm run typecheck` e `npm run build` passarem.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao executar migrations.
- Nao alterar `.env`.
- Nao adicionar dependencias.
- Seguir `/AGENT.md`.
- Manter alteracoes pequenas e focadas em `src/App.tsx` e `src/styles.css`.
- Reaproveitar `ValidationKeyConsultation` e estilos existentes sempre que possivel.
- Nao fazer commit/push sem autorizacao explicita do usuario.
