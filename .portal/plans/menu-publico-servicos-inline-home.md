# Plano de Implementacao: Menu Publico de Servicos Inline na Home

## Origem

- Arquivo de especificacao: `solicitacao via chat`
- Data do planejamento: `2026-07-26`
- Classificacao: `frontend-only`

## Resumo

Readequar a home publica para que o menu principal apresente diretamente os servicos publicos disponiveis e todos abram dentro da propria home, sem modal e sem navegacao para outra pagina.

O fluxo de cadastro de solicitacoes deve passar a ser apresentado como `Solicitar Procedimento`, com estilo adequado para a home publica. A area de conteudo deve seguir o padrao ja iniciado: banner lateral compacto e painel de servico inline.

## Escopo

### Dentro do escopo

- Trocar o menu publico para os itens:
  - `Consultar Prontuario`
  - `Solicitar Procedimento`
  - `Trocar Tutor`
  - `Registrar Obito`
  - `Credenciamento`
  - `Denunciar`
- Remover a entrada separada `Solicitacoes` do topo publico.
- Remover o dropdown atual de `Prontuario`.
- Abrir todos os servicos dentro da home publica.
- Manter o banner compacto lateral quando um servico estiver ativo.
- Ocultar a area de adocao/listagens da home enquanto um servico estiver ativo.
- Reaproveitar o fluxo existente de prontuario para:
  - consulta de prontuario
  - troca de tutor
  - registro de obito
- Reaproveitar e reestilizar o cadastro existente de solicitacao como `Solicitar Procedimento`.
- Converter o credenciamento publico para uso inline, sem modal.
- Criar uma area inline para `Denunciar`, respeitando o que ja existir de fluxo no projeto.
- Garantir responsividade do menu e dos paineis em telas menores.

### Fora do escopo

- Criar nova regra de negocio backend para denuncia, caso ela ainda nao exista.
- Criar novas tabelas ou migrations.
- Alterar regras de IA documental.
- Alterar o fluxo administrativo interno.
- Alterar credenciais, `.env`, deploy, CI/CD ou infraestrutura.
- Fazer commit, push ou finalizar implementacao.

## Leitura de contexto

Arquivos e contexto lidos/consultados:

- `/AGENT.md`
- `.agents/skills/planejar/SKILL.md`
- `src/App.tsx`
- `src/styles.css`
- `src/api.ts`
- `src/features/accessRequests.tsx`
- `backend/src/routes/accessRequests.js`

Observacoes encontradas:

- A home publica ja possui `public-service-workspace`, `public-service-rail` e `public-service-panel`.
- O topo publico ainda possui `Solicitacoes`, dropdown de `Prontuario`, `Credenciamento` em modal e `Denunciar` sem fluxo aparente.
- `ValidationKeyConsultation` ja aceita uso embedded com servico inicial.
- `PublicAccessRequestModal` existe e pode ser convertido/adaptado para uso inline.
- O cadastro publico de solicitacao existe em `PublicCastrationForm` e `NewRequest`.
- Nao foi encontrado fluxo persistente evidente para `Denunciar`; portanto a implementacao deve tratar isso com cuidado e nao criar backend sem nova aprovacao.

## Impacto por area

### Frontend

Impacto esperado no frontend.

Alteracoes previstas:

- Reorganizar a navegacao publica em `LoginView`.
- Substituir o estado atual de dropdown por um estado unico de servico ativo.
- Criar lista unica de servicos publicos com id, label, icone e renderizador.
- Renderizar `Consultar Prontuario`, `Trocar Tutor` e `Registrar Obito` via `ValidationKeyConsultation` em modo embedded.
- Renderizar `Solicitar Procedimento` usando o fluxo de cadastro de solicitacao, sem redirecionamento.
- Adaptar o formulario de solicitacao para encaixar no painel da home.
- Converter o credenciamento de modal para painel inline.
- Implementar painel inline para denuncia, aproveitando fluxo existente se houver.
- Ajustar estados de voltar, fechar, loading, erro e sucesso conforme cada servico.
- Ajustar CSS do menu superior, workspace inline e responsividade.

### Backend

Sem impacto esperado para a reorganizacao de UI.

Atencao: se for decidido que `Denunciar` deve persistir dados em backend e nao existir rota atual, isso deixa de ser frontend-only e exige novo planejamento ou aprovacao explicita para escopo fullstack.

### Banco de dados

Sem impacto esperado.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

Possiveis arquivos afetados somente se a implementacao identificar acoplamento forte:

- `src/features/accessRequests.tsx`
- `src/api.ts`
- `src/domain.ts`

## Estrategia de implementacao

1. Mapear o estado atual da home publica em `LoginView`.
2. Criar uma configuracao unica para o menu publico com os seis servicos solicitados.
3. Remover a entrada antiga `Solicitacoes` do topo.
4. Remover o dropdown visual de `Prontuario`.
5. Trocar a navegacao para botoes diretos no cabecalho em desktop.
6. Em mobile, usar quebra responsiva ou menu compacto para evitar estouro horizontal.
7. Consolidar `activePublicService` como fonte unica de verdade para o servico aberto.
8. Manter o layout `public-service-workspace` quando houver servico ativo.
9. Ajustar o painel de titulo para refletir o servico selecionado.
10. Conectar `Consultar Prontuario` a `ValidationKeyConsultation` com `initialService: "record"`.
11. Conectar `Trocar Tutor` a `ValidationKeyConsultation` com o servico correspondente.
12. Conectar `Registrar Obito` a `ValidationKeyConsultation` com o servico correspondente.
13. Conectar `Solicitar Procedimento` ao fluxo de cadastro de solicitacao dentro do painel inline.
14. Reestilizar o cadastro de solicitacao para parecer parte da home publica, sem visual de tela separada.
15. Converter `PublicAccessRequestModal` em componente reutilizavel ou criar variante inline para `Credenciamento`.
16. Tratar `Denunciar` como painel inline:
    - se ja existir fluxo persistente, reaproveitar;
    - se nao existir, implementar apenas UI local/informativa ou parar para confirmar novo escopo backend.
17. Garantir que `Voltar ao inicio` limpe o servico ativo e restaure a home normal.
18. Revisar CSS para manter o banner lateral bonito, sem mexer desnecessariamente no enquadramento ja aprovado.
19. Testar manualmente todos os itens do menu.
20. Rodar validacoes do projeto.

## Regras de negocio identificadas

- O menu publico deve conter exatamente os seis servicos definidos pelo usuario.
- Servicos publicos devem abrir inline na home.
- Servicos publicos nao devem abrir modal.
- Servicos publicos nao devem redirecionar para outra pagina.
- O cadastro de solicitacao passa a ser tratado como `Solicitar Procedimento`.
- A home deve esconder a area de adocao/listagens durante um servico ativo.
- O banner compacto deve permanecer como apoio visual lateral.
- Fluxos ja existentes devem ser reaproveitados sempre que possivel.

## Regras multi-tenant e seguranca

- Manter o municipio selecionado como origem do contexto publico.
- Nao vazar dados entre municipios.
- Formularios publicos devem continuar enviando o municipio correto.
- Consulta de prontuario deve manter os requisitos de identificacao/validacao existentes.
- Credenciamento deve continuar usando o endpoint publico ja existente de access requests.
- Denuncia nao deve criar persistencia improvisada sem regra clara de municipio, auditoria e destino.
- Nenhuma alteracao de credenciais ou `.env` deve ser feita.

## Validacoes necessarias

- Verificar se cada item do menu abre o servico correto.
- Verificar se `Voltar ao inicio` restaura a home.
- Verificar se `Solicitar Procedimento` cria solicitacao como antes.
- Verificar se anexos/documentos do procedimento continuam obedecendo a regra atual de analise documental.
- Verificar se `Credenciamento` envia dados pelo mesmo caminho atual.
- Verificar comportamento de `Denunciar` conforme fluxo existente ou limitacao confirmada.
- Verificar responsividade em desktop e mobile.
- Verificar que nenhum servico abre modal.
- Verificar que nenhum servico redireciona para outra tela.

## Testes necessarios

### Frontend

- Testar renderizacao do menu publico com os seis itens.
- Testar abertura inline de cada servico.
- Testar retorno para a home.
- Testar cadastro de solicitacao pelo novo item `Solicitar Procedimento`.
- Testar credenciamento inline.
- Testar responsividade do topo e do workspace.

### Backend

- Sem testes backend esperados neste escopo.

### E2E

- Fluxo publico: abrir home, clicar `Consultar Prontuario`, voltar.
- Fluxo publico: abrir home, clicar `Solicitar Procedimento`, preencher cadastro ate etapa de documentos.
- Fluxo publico: abrir home, clicar `Credenciamento`, enviar solicitacao de acesso.
- Fluxo publico: alternar entre servicos sem reload da pagina.

## Comandos de validacao sugeridos

```bash
npm run typecheck
npm run build
```

Se houver testes frontend configurados:

```bash
npm test
```

## Riscos e pontos de atencao

- `Solicitar Procedimento` pode estar acoplado ao fluxo antigo de pagina/tela; a implementacao deve evitar duplicar estado ou quebrar criacao de solicitacoes.
- `PublicAccessRequestModal` pode ter logica misturada com layout de modal; ao converter para inline, separar somente o necessario.
- `Denunciar` nao aparenta ter fluxo completo; nao criar backend sem confirmacao explicita.
- O menu com seis itens pode ficar largo em telas pequenas; precisa fallback responsivo.
- Evitar mexer no enquadramento do banner alem do necessario, pois o visual atual foi aprovado apos varias iteracoes.
- O projeto esta com alteracoes locais ja existentes; nao reverter mudancas nao relacionadas.

## Perguntas em aberto

- `Denunciar` deve ser apenas uma area informativa/formulario visual nesta etapa ou precisa registrar uma denuncia real no backend?
- Em mobile, o menu deve virar botao compacto/mais servicos ou pode quebrar em duas linhas?

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- O cabecalho publico exibir `Consultar Prontuario`, `Solicitar Procedimento`, `Trocar Tutor`, `Registrar Obito`, `Credenciamento` e `Denunciar`.
- Nao existir mais dropdown de `Prontuario`.
- Nao existir mais item separado `Solicitacoes`.
- Todos os servicos abrirem dentro da home publica.
- Nenhum dos servicos abrir modal.
- Nenhum dos servicos redirecionar para outra pagina.
- `Solicitar Procedimento` exibir o cadastro de solicitacao reestilizado para a home.
- `Credenciamento` abrir inline.
- Os servicos de prontuario continuarem funcionais.
- O banner lateral compacto continuar visualmente correto.
- `npm run typecheck` e `npm run build` passarem.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao implementar backend para `Denunciar` sem confirmacao explicita.
- Nao executar migrations.
- Nao alterar `.env`.
- Nao mexer no enquadramento do banner salvo se a mudanca de layout exigir ajuste minimo.
- Manter alteracoes pequenas e focadas em `src/App.tsx` e `src/styles.css` sempre que possivel.
- Respeitar alteracoes locais existentes e nao reverter trabalho nao relacionado.
- Rodar validacoes antes de concluir.
