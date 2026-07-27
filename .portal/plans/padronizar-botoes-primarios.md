# Plano de Implementacao: Padronizar Botoes Primarios

## Origem

- Arquivo de especificacao: `conversa do usuario`
- Data do planejamento: `2026-07-27`
- Classificacao: `frontend-only`

## Resumo

Padronizar formato, cores e posicionamento dos botoes primarios do sistema, incluindo Configuracoes, para reduzir variacoes visuais acumuladas e alinhar a interface ao estilo do botao "Entrar".

O foco e criar uma linguagem unica para acoes principais como criar, cadastrar, salvar, buscar, solicitar e confirmar, preservando filtros, abas e acoes secundarias com visual mais leve.

## Escopo

### Dentro do escopo

- Padronizar botoes primarios internos usando uma base visual comum.
- Usar o estilo do botao "Entrar" preenchido como referencia para cor de acao primaria.
- Ajustar botao criar/cadastrar para ficar no canto direito da linha de acoes da tela.
- Ajustar Configuracoes, especialmente os botoes renderizados por `ConfigSectionHeader`.
- Consolidar regras CSS duplicadas de botoes primarios e secundarias relacionadas.
- Preservar comportamento atual dos botoes, eventos, permissoes e estados.
- Validar telas operacionais principais e Configuracoes.

### Fora do escopo

- Alterar backend, endpoints, banco de dados ou permissoes.
- Alterar fluxos de negocio.
- Redesenhar tabelas, cards ou formularios inteiros.
- Criar nova dependencia visual.
- Trocar icones ou nomenclatura de botoes, salvo ajustes minimos de consistencia.
- Padronizar todos os botoes publicos que nao sejam acoes primarias.

## Leitura de contexto

- `/AGENT.md`
- `src/App.tsx`
- `src/components/ui.tsx`
- `src/features/reports.tsx`
- `src/styles.css`
- `frontend/AGENT.md`: nao encontrado no projeto atual.

## Impacto por area

### Frontend

Havera impacto visual e estrutural leve no frontend.

Areas afetadas:

- Dashboard, quando houver acoes primarias futuras ou botoes herdados.
- Solicitacoes, especialmente botao "Criar Solicitacao".
- Agenda, para manter coerencia entre acoes e navegacao.
- Adocao, especialmente botao "Cadastrar animal" e modais.
- Relatorios, especialmente botoes "Buscar", "Limpar" e exportacoes.
- Credenciamentos, se houver acoes primarias ou filtros com visual conflitando.
- Configuracoes, incluindo botoes "Criar tipo", "Criar agenda", "Criar setor", "Criar grupo", "Criar usuario", "Criar documento", "Salvar configuracao", "Salvar credenciais" e similares.
- Area publica apenas quando o mesmo padrao de acao primaria for usado de forma intencional.

Componentes e classes relevantes:

- `ConfigSectionHeader`
- `ModalHeader`
- `primary-action`
- `secondary-action`
- `config-create-action`
- `adoption-create-button`
- `ai-save-key-action`
- `page-actions`
- `public-topbar-enter`

Estados a preservar:

- `disabled`
- `loading`
- `hover`
- foco via teclado
- responsivo mobile

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css`
- `src/App.tsx`
- `src/components/ui.tsx`
- `src/features/reports.tsx`
- `src/features/accessRequests.tsx`
- `src/features/agenda.tsx`

## Estrategia de implementacao

1. Inventariar todas as ocorrencias de botoes primarios e secundarios no frontend.
2. Definir a base visual unica para acao primaria:
   - cor inspirada no botao "Entrar" preenchido;
   - texto branco;
   - borda na mesma familia da cor de fundo;
   - hover um pouco mais escuro;
   - raio consistente;
   - altura e padding consistentes;
   - peso de fonte moderado.
3. Separar semanticamente os tipos de botao:
   - acao primaria preenchida;
   - acao secundaria clara;
   - filtros/abas em formato chip;
   - botoes destrutivos;
   - botoes somente icone.
4. Consolidar o CSS para que `.primary-action` seja a fonte principal do estilo primario.
5. Remover ou reduzir overrides repetidos de `.primary-action`, `.config-create-action`, `.adoption-create-button` e variacoes equivalentes.
6. Ajustar `ConfigSectionHeader` para manter filtros/conteudo auxiliar e botao criar na mesma faixa, com o botao alinhado ao canto direito quando houver espaco.
7. Ajustar linhas de acoes das telas operacionais para que botoes criar/cadastrar fiquem no canto direito da linha, nao acima ou abaixo sem necessidade.
8. Revisar modais e formularios para que botoes salvar/confirmar fiquem no rodape ou area final do formulario com alinhamento consistente.
9. Garantir que botoes publicos nao sejam afetados indevidamente, preservando diferenca entre area publica e area interna.
10. Rodar validacoes e revisar responsivo.

## Regras de negocio identificadas

- Nenhuma regra de negocio deve ser alterada.
- Permissoes atuais de exibir ou ocultar botoes devem ser preservadas.
- Acoes atuais de criar, salvar, buscar, confirmar, solicitar e cadastrar devem continuar chamando os mesmos handlers.
- Botoes destrutivos nao devem herdar estilo verde/teal de acao primaria.

## Regras multi-tenant e seguranca

- Sem alteracao esperada em multi-tenant.
- Nao alterar origem de municipio, usuario, role ou permissoes.
- Nao alterar endpoints ou payloads.
- Nao expor acoes que atualmente ficam ocultas por permissao.
- Nao modificar relatorios, PDFs ou regras de acesso.

## Validacoes necessarias

- Confirmar que botoes primarios continuam clicaveis e com estados `disabled` corretos.
- Confirmar que botoes de criar/cadastrar aparecem no canto direito da linha de acoes quando houver espaco.
- Confirmar que no mobile as acoes quebram linha sem scroll horizontal.
- Confirmar que filtros/abas nao viraram botoes primarios preenchidos.
- Confirmar que botoes destrutivos continuam visualmente distintos.
- Confirmar que Configuracoes manteve filtros e botoes de criar no layout correto.
- Confirmar que o botao "Entrar" nao foi quebrado na area publica nem no modal.

## Testes necessarios

### Frontend

- Validacao manual das telas afetadas.
- Checagem visual de hover, disabled e foco em botoes primarios.
- Checagem responsiva em desktop largo, notebook e mobile ate 640px.

### Backend

- Sem testes backend esperados.

### E2E

- Solicitar criacao de uma solicitacao, ou ao menos abrir o modal pelo botao primario.
- Abrir Configuracoes e validar botoes criar/salvar principais.
- Abrir Adoção e validar "Cadastrar animal".
- Abrir Relatorios e validar "Buscar" e "Limpar".

## Comandos de validacao sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

## Riscos e pontos de atencao

- O CSS atual possui varios blocos empilhados para `.primary-action`; adicionar mais override sem consolidar pode manter o problema.
- O sistema usa a mesma classe `primary-action` em area publica e interna; e preciso evitar quebrar telas publicas.
- O usuario citou "botao Entrar", mas existem duas referencias visuais: o botao claro do topo publico e o botao preenchido do modal. Este plano assume o botao preenchido como referencia para acao primaria.
- Botoes destrutivos com classe primaria ou estilo inline podem precisar de tratamento separado.
- Configuracoes concentra muitos botoes e pode revelar desalinhamentos em secoes especificas.
- O projeto tem alteracoes nao relacionadas ja presentes no worktree; a implementacao deve preservar tudo que nao fizer parte deste plano.

## Perguntas em aberto

- Confirmar durante a revisao visual se o "Entrar" de referencia deve ser o botao preenchido do modal ou o botao claro do topo publico. A recomendacao deste plano e usar o preenchido para acoes primarias e o claro para secundarias/outline.

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- Botoes primarios principais usam o mesmo formato, cor, borda, hover, altura e peso de fonte.
- Botoes criar/cadastrar ficam no canto direito da linha de acoes nas telas aplicaveis.
- Configuracoes segue o mesmo padrao visual e de posicionamento.
- Acoes secundarias, filtros e abas continuam com visual leve.
- Botoes destrutivos continuam distintos.
- Nao ha scroll horizontal ou texto cortado em mobile ate 640px.
- `git diff --check`, `npm run typecheck` e `npm run build` passam.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao alterar backend, banco, permissoes ou regras de negocio.
- Nao executar migrations.
- Priorizar consolidacao de CSS em vez de adicionar novos overrides no fim do arquivo.
- Evitar criar componente React novo se a padronizacao puder ser feita com classes existentes.
- Preservar alteracoes existentes no worktree que nao fazem parte deste plano.
- Se a padronizacao gerar CSS empilhado, usar a skill `limpar` em seguida para consolidar.
