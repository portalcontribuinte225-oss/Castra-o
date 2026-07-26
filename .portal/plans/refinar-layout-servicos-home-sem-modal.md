# Plano de Implementacao: Refinar Layout dos Servicos Inline da Home

## Origem

- Arquivo de especificacao: `solicitacao via chat`
- Data do planejamento: `2026-07-26`
- Classificacao: `frontend-only`

## Resumo

Refinar a area de servicos publicos da home para remover aparencia de modal, eliminar botoes de inicio redundantes, ajustar melhor o uso de espaco e corrigir possiveis classes/overlays que estejam desperdicando area ou bloqueando interacoes.

O layout ativo da home deve usar melhor a tela: em desktop, o banner lateral deve ocupar aproximadamente 40% da area e as funcoes/servicos aproximadamente 60%. Em telas menores, o layout deve se adaptar sem sobreposicao, sem scroll horizontal e sem perda de usabilidade.

## Escopo

### Dentro do escopo

- Remover o botao flutuante/interno de inicio que nao tem mais necessidade no novo fluxo.
- Remover aparencia de modal dos servicos inline.
- Ajustar o workspace publico para proporcao aproximada `40% banner / 60% funcao` em telas grandes.
- Fazer os servicos usarem melhor a area disponivel da tela.
- Revisar e remover/sobrescrever classes herdadas que causam:
  - largura maxima pequena demais;
  - padding duplicado;
  - sombras e bordas de modal;
  - comportamento de overlay/dialog;
  - elementos sobrepostos;
  - bloqueio de clique;
  - desperdicio de area util.
- Ajustar `Solicitar Procedimento` para parecer uma secao real da home, nao um modal/card encaixado.
- Ajustar os fluxos de `Consultar Prontuario`, `Trocar Tutor` e `Registrar Obito` para abandonarem visual de modal inline.
- Ajustar `Credenciamento` e `Denunciar` para seguirem o mesmo padrao visual dos demais servicos.
- Garantir responsividade em desktop, tablet e mobile.

### Fora do escopo

- Criar backend novo para denuncias.
- Alterar regras de IA documental.
- Alterar regras de negocio de solicitacao, prontuario, transferencia, obito ou credenciamento.
- Alterar banco de dados ou executar migrations.
- Alterar `.env`, secrets, CI/CD, Render ou infraestrutura.
- Fazer commit ou push.
- Reenquadrar novamente a imagem do banner, salvo ajuste minimo exigido pela nova proporcao.

## Leitura de contexto

Arquivos e contexto lidos/consultados:

- `/AGENT.md`
- `.agents/skills/planejar/SKILL.md`
- `src/App.tsx`
- `src/styles.css`
- `.portal/plans/menu-publico-servicos-inline-home.md`

Observacoes encontradas:

- O fluxo inline atual ainda possui estruturas/classes com origem de modal, como `svc-modal--inline`.
- O cadastro publico usa `nr-shell--public`, que ainda aplica estrutura de bloco encaixado/card.
- Existem botoes internos como `nr-home-btn` e `consultation-home-btn` que podem ter ficado redundantes no novo metodo.
- A area ativa possui `public-service-workspace`, `public-service-rail` e `public-service-panel`, que devem ser o ponto principal de ajuste.
- A proporcao atual favorece um banner estreito e uma funcao com aparencia de card, em vez de uma composicao de pagina.

## Impacto por area

### Frontend

Impacto esperado no frontend.

Alteracoes previstas:

- Ajustar markup e condicoes em `LoginView` para remover controles redundantes de inicio.
- Ajustar `ValidationKeyConsultation` quando usado em modo embedded para nao renderizar estruturas com semantica/aparencia de modal.
- Ajustar `NewRequest` em `publicFlow`/`nr-shell--public` para parecer um formulario integrado na pagina.
- Ajustar ou substituir classes como `svc-modal--inline`, `public-service-panel-header`, `nr-shell--public`, `public-inline-card` e regras relacionadas.
- Revisar `position`, `z-index`, `overflow`, `max-width`, `width`, `height`, `padding`, `margin`, `box-shadow` e `border` nos blocos publicos.
- Criar regras responsivas para desktop, tablet e mobile.

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

1. Inspecionar as classes e componentes que aparecem no fluxo publico ativo:
   - `public-service-workspace`
   - `public-service-rail`
   - `public-service-panel`
   - `public-service-panel-header`
   - `nr-shell--public`
   - `svc-modal--inline`
   - `public-inline-card`
   - `nr-home-btn`
   - `consultation-home-btn`
2. Remover o botao flutuante/interno de inicio que nao e mais necessario.
3. Manter somente uma acao clara de retorno ao inicio dentro do layout do servico, se necessario.
4. Ajustar `public-service-workspace` para desktop com grid aproximado `40% / 60%`.
5. Remover limites de largura que deixam os formularios comprimidos.
6. Remover ou neutralizar sombras, bordas e caixas que fazem o conteudo parecer modal.
7. Transformar o cabecalho do servico em titulo de pagina/secao, nao em card destacado.
8. Ajustar `Solicitar Procedimento` para usar a area completa da coluna de funcao.
9. Ajustar o stepper do procedimento para visual leve de progresso de pagina.
10. Ajustar formularios de prontuario/troca/obito para layout inline sem `dialog`, sem botao `X` e sem rodape de modal.
11. Ajustar `Credenciamento` e `Denunciar` para usar o mesmo visual integrado.
12. Revisar elementos com `position`, `z-index`, `overflow` e `pointer-events` para remover bloqueios invisiveis.
13. Definir responsividade:
    - desktop: banner 40%, funcao 60%;
    - tablet: reduzir/empilhar banner conforme largura;
    - mobile: banner compacto no topo ou ocultacao parcial, funcao 100%.
14. Validar manualmente abertura e troca entre todos os servicos.
15. Rodar `git diff --check`, `npm run typecheck` e `npm run build`.

## Regras de negocio identificadas

- O novo metodo deve manter servicos dentro da home, sem modal e sem pagina separada.
- O botao de inicio/home redundante deve ser removido.
- O menu superior deve continuar sendo o mecanismo principal de troca de servico.
- O banner deve ocupar aproximadamente 40% em telas grandes.
- A funcao ativa deve ocupar aproximadamente 60% em telas grandes.
- A tela deve aproveitar melhor a area disponivel, sem desperdicio visual.
- Nenhum overlay invisivel deve bloquear campos ou botoes.

## Regras multi-tenant e seguranca

- Manter o municipio selecionado como contexto publico.
- Nao alterar chamadas ou payloads que definem municipio/tenant.
- Nao criar persistencia nova para denuncia sem aprovacao especifica.
- Nao alterar validacoes backend.
- Nao alterar `.env` ou credenciais.

## Validacoes necessarias

- Verificar se o botao de inicio redundante desapareceu.
- Verificar se `Voltar ao inicio`, caso mantido, funciona corretamente.
- Verificar se `Solicitar Procedimento` nao parece modal/card centralizado.
- Verificar se prontuario/troca/obito nao usam visual de modal.
- Verificar se credenciamento e denuncia seguem o mesmo padrao visual.
- Verificar se nenhum elemento invisivel bloqueia clique/scroll.
- Verificar se desktop usa aproximadamente `40% / 60%`.
- Verificar se mobile nao possui scroll horizontal nem sobreposicao.
- Verificar se o menu superior segue clicavel em todos os servicos.

## Testes necessarios

### Frontend

- Testar abertura de cada item do menu publico.
- Testar alternancia entre servicos sem reload.
- Testar preenchimento inicial do fluxo de `Solicitar Procedimento`.
- Testar campos e botoes de prontuario/troca/obito.
- Testar envio visual de credenciamento.
- Testar painel de denuncia frontend-only.
- Testar responsividade desktop/tablet/mobile.

### Backend

- Sem testes backend esperados.

### E2E

- Abrir home, clicar `Solicitar Procedimento` e confirmar que o layout usa a pagina sem modal.
- Abrir `Consultar Prontuario` e confirmar que nao ha overlay/dialog bloqueando.
- Alternar para `Credenciamento` e `Denunciar` e confirmar padrao visual consistente.

## Comandos de validacao sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

## Riscos e pontos de atencao

- O CSS publico tem muitas regras acumuladas; remover/sobrescrever classes sem cuidado pode afetar o fluxo administrativo ou telas antigas.
- `NewRequest` e `ValidationKeyConsultation` sao componentes grandes; a implementacao deve ser focada para nao quebrar regra de negocio.
- O ajuste `40% / 60%` deve ser aproximado e responsivo, nao uma trava rigida que quebre em telas menores.
- Elementos com `position: sticky`, `absolute`, `fixed`, `z-index` e `overflow` devem ser revisados com cuidado.
- Nao mexer no enquadramento da imagem do banner alem do necessario.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- O botao de inicio/home redundante nao aparecer mais.
- Nenhum servico inline parecer modal.
- O desktop usar aproximadamente `40% banner / 60% funcao`.
- A area das funcoes aproveitar melhor a largura disponivel.
- Nao houver elementos sobrepostos ou bloqueando interacao.
- `Solicitar Procedimento`, prontuario, troca, obito, credenciamento e denuncia compartilharem um padrao visual coerente.
- O layout funcionar em telas grandes e pequenas.
- `git diff --check`, `npm run typecheck` e `npm run build` passarem.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao criar backend novo para denuncias.
- Nao executar migrations.
- Nao alterar `.env`.
- Manter escopo em `src/App.tsx` e `src/styles.css` sempre que possivel.
- Preservar alteracoes locais existentes e nao reverter trabalho nao relacionado.
- Priorizar limpeza visual e remocao de classes conflitantes sem reescrever regras de negocio.
