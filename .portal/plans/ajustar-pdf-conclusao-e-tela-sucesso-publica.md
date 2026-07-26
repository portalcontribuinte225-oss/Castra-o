# Plano de Implementação: Ajustar PDF de conclusão e tela de sucesso do fluxo público

## Origem

- Arquivo de especificação: nenhum (spec descrita em conversa pelo usuário, sem arquivo `.md` em disco)
- Data do planejamento: 2026-07-26
- Classificação: `frontend-only`

## Resumo

O fluxo público de solicitação (cadastro de procedimento) tem três problemas reportados pelo usuário na tela final ("Solicitação enviada!", com protocolo e chave de validação):

1. O PDF de conclusão do cadastro (gerado ao clicar em "Ler declaração completa" durante o preenchimento, via impressão do navegador) está saindo com páginas em branco desnecessárias. Deveria ter exatamente 2 páginas: dados do cadastro (todos os campos, inclusive os não preenchidos) e a declaração de responsabilidade.
2. A tela de sucesso está com layout desorganizado: o botão "Voltar ao início" fica colado/pouco espaçado em relação à caixa da chave de validação, e sobra bastante espaço em branco não utilizado abaixo do card.
3. Essa mesma tela de sucesso não oferece nenhuma forma de baixar o documento de requerimento — só o botão "Voltar ao início".

Todos os três pontos vivem inteiramente no frontend: a geração de PDF já é 100% client-side (impressão via iframe oculto e `pdf-lib` rodando no navegador), sem endpoint de backend envolvido.

## Escopo

### Dentro do escopo

- Corrigir a paginação do PDF de impressão (`buildDeclarationPdfHtml` + `PDF_BASE_STYLES`) para sair sempre com exatamente 2 páginas físicas, sem página em branco extra, independentemente de os campos estarem preenchidos ou não.
- Reorganizar o CSS da tela de sucesso pública (`.public-inline-success`, `.public-service-success-card`) para eliminar o espaço vazio excessivo e dar respiro adequado ao botão "Voltar ao início".
- Adicionar um botão de download do requerimento na tela de sucesso, reaproveitando o gerador `createRequestPdfDataUrl` (via `pdf-lib`, já usado internamente como anexo "Requerimento municipal"), seguindo o padrão existente de download por `<a download>` já usado em outras partes do arquivo (ex.: `handleRelatorioProcessual`).

### Fora do escopo

- Qualquer alteração no gerador `createRequestPdfDataUrl` em si (conteúdo/layout do PDF pdf-lib) além do necessário para expô-lo como download nessa tela.
- Qualquer alteração no fluxo de geração de PDF do lado do backend (não existe hoje, e não será criado).
- Qualquer refatoração não relacionada em `LoginView`, `NewRequest` ou nos demais geradores de PDF do arquivo (prontuário, relatório processual, receita, etc.).
- Migração de bancos de dados (não há impacto de schema neste plano).

## Leitura de contexto

- `/AGENT.md` (regras globais do monorepo — lido; a seção de git flow/staging/PR não se aplica a este projeto, que trabalha direto em `main`, conforme convenção já estabelecida nas skills `implementar`/`finalizar` deste mesmo repositório).
- Não existem `frontend/AGENT.md` nem `backend/AGENT.md` neste repositório (confirmado — o projeto não segue essa divisão de pastas).
- Investigação direta do código-fonte: `src/App.tsx` (`buildDeclarationPdfHtml`, `printHtmlViaIframe`, `PDF_BASE_STYLES`, `createRequestPdfDataUrl`, JSX da tela de sucesso em `LoginView`, padrão de download via `<a download>` em `handleRelatorioProcessual`) e `src/styles.css` (`.public-inline-success`, `.public-service-success-card`, `.public-service-panel`).

## Impacto por área

### Frontend

- **PDF de impressão (páginas em branco)**: `PDF_BASE_STYLES` (`src/App.tsx`, função `buildDeclarationPdfHtml`, ~linha 10474) define `.pdf-page { page-break-after: always; min-height: 267mm; }` com `body { padding: 28px; }`. A suspeita (a confirmar durante a implementação com um print real) é que a soma de `min-height` + padding do `body` + padding interno das seções ultrapassa a altura útil de uma página A4 (297mm − 24mm de margem = 273mm), vazando um resto quase vazio para uma página extra a cada seção. Ajustar o box model (reduzir/remover o `min-height` fixo e/ou mover o padding do `body` para dentro de cada `.pdf-page`) mantendo `page-break-after: always` / `:last-child { page-break-after: auto; }` para garantir exatamente 2 páginas.
- **Layout da tela de sucesso**: revisar `.public-inline-success` e `.public-service-success-card` (`src/styles.css`, ~linha 22715-22752), hoje com `min-height` fixo dentro de um `.public-service-panel` mais alto, sobrando espaço em branco abaixo do card. Ajustar para o card ocupar o espaço disponível de forma equilibrada (ex.: centralizar verticalmente dentro do painel) e dar espaçamento adequado entre a caixa da chave de validação e o botão "Voltar ao início".
- **Botão de download do requerimento**: adicionar um botão na tela de sucesso (JSX em `LoginView`, ~linha 2241-2276) que chama `createRequestPdfDataUrl(publicServiceDone)` e dispara o download via elemento `<a>` (`href` = data URL, `download` = nome do arquivo), replicando o padrão já usado em `handleRelatorioProcessual`/outros pontos de download do arquivo. Estado de loading simples (ex.: desabilitar o botão durante a geração) seguindo o padrão já usado em outros downloads do arquivo (`downloadLoadingId`/`bundleLoading`).
- Sem novos hooks, sem novas query keys, sem chamadas de API novas — tudo client-side com dados já disponíveis em `publicServiceDone`.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` (`PDF_BASE_STYLES`, `buildDeclarationPdfHtml`, JSX da tela de sucesso dentro de `LoginView`)
- `src/styles.css` (`.public-inline-success`, `.public-service-success-card`, possivelmente `.public-service-panel`)

## Estratégia de implementação

1. Ajustar `PDF_BASE_STYLES`/`buildDeclarationPdfHtml`: corrigir o box model de `.pdf-page` (min-height e padding) para eliminar o vazamento de página em branco, mantendo a estrutura de exatamente 2 seções (dados + declaração).
2. Validar a correção gerando o print real (ex.: via Playwright, Chrome print-to-PDF) e contando as páginas físicas resultantes, com e sem campos preenchidos, confirmando exatamente 2 páginas em ambos os casos.
3. Ajustar o CSS da tela de sucesso (`.public-inline-success`, `.public-service-success-card`) para eliminar o espaço em branco excessivo e dar respiro ao botão "Voltar ao início", validando visualmente com screenshot.
4. Adicionar o botão "Baixar requerimento" na tela de sucesso, chamando `createRequestPdfDataUrl(publicServiceDone)` e disparando o download, com estado de loading e tratamento de erro (`try/catch` + `console.error`, seguindo o padrão existente).
5. Rodar `npm run typecheck` e `npm run build`.
6. Validar visualmente via Playwright: fluxo completo de submissão pública até a tela de sucesso, clicar no novo botão de download e confirmar que o arquivo é gerado corretamente.

## Regras de negócio identificadas

- O PDF de conclusão deve ter exatamente 2 páginas: dados do cadastro (todos os campos, inclusive vazios, exibidos com placeholder) e declaração de responsabilidade.
- O botão de download do requerimento deve estar disponível assim que a solicitação for enviada com sucesso, usando os dados já retornados pela criação da solicitação (sem nova chamada ao backend).

## Regras multi-tenant e segurança

- Nenhuma alteração em autenticação, autorização ou contexto de tenant.
- O botão de download usa exclusivamente o `request` que o próprio cidadão acabou de submeter (`publicServiceDone`, já passado por `normalizeRequest`), sem acesso a dados de outras solicitações ou de outras prefeituras — não há risco de vazamento cross-tenant.
- Nenhuma chamada nova ao backend é introduzida; a superfície de ataque não muda.

## Validações necessárias

- Nenhuma validação de formulário nova (não há novos inputs de usuário).
- Validar que `createRequestPdfDataUrl` lida bem com um `request` contendo campos vazios/opcionais não preenchidos (ex.: sem CPF, sem animais detalhados) sem quebrar o layout do PDF.

## Testes necessários

### Frontend

- Verificação manual/visual (Playwright): tela de sucesso após submissão pública, com e sem o novo botão de download, em desktop e em viewport estreito.

### Backend

Sem impacto — nenhum teste de backend necessário.

### E2E

- Fluxo completo: preencher solicitação pública → chegar na tela de sucesso → clicar em "Baixar requerimento" → confirmar que o download dispara com um PDF de 2 páginas coerente com os dados enviados.
- Geração do PDF de impressão via "Ler declaração completa": confirmar exatamente 2 páginas físicas no print, com campos preenchidos e com campos vazios.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- `buildDeclarationPdfHtml`/`PDF_BASE_STYLES` é usado apenas neste único lugar do sistema (botão "Ler declaração completa"), então o risco de regressão cruzada é baixo — mas a correção precisa ser validada com um print real antes/depois, para não trocar "páginas em branco" por "conteúdo cortado" no rodapé da página 1 ou no meio da declaração.
- `createRequestPdfDataUrl` foi escrito originalmente para uso interno (equipe/prontuário); reaproveitá-lo no fluxo público exige confirmar que nenhum dado sensível além do que o próprio cidadão já viu na tela é exposto no PDF (ex.: campos internos como "veterinário responsável"/"unidade responsável" que talvez ainda não estejam preenchidos nesse momento do processo — devem aparecer como "-", não quebrar o layout).
- Mudança de CSS na tela de sucesso é puramente visual/reversível, risco baixo.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. Assunção registrada e aceita pelo usuário: "PDF de conclusão" refere-se ao gerador de impressão (`buildDeclarationPdfHtml`, acessado via "Ler declaração completa"); o botão de download novo na tela de sucesso usará o gerador `pdf-lib` (`createRequestPdfDataUrl`), por ser estruturalmente mais robusto contra páginas em branco.

## Critérios de aceite do plano

- O PDF de impressão (declaração) sai com exatamente 2 páginas físicas, com e sem campos preenchidos.
- A tela de sucesso não tem mais espaço em branco excessivo abaixo do card, e o botão "Voltar ao início" tem respiro visual adequado.
- A tela de sucesso oferece um botão de download do requerimento, funcional, usando os dados da solicitação recém-criada.
- `npm run typecheck` e `npm run build` aprovados sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Este projeto não usa `staging` nem branch por feature — trabalho é feito direto em `main`, sem criar branch nova (conforme convenção já estabelecida nas skills `implementar`/`finalizar` deste repositório, que sobrepõe a seção de git flow do `/AGENT.md` genérico).
- Não fazer commit/push sem solicitação explícita do usuário — isso é responsabilidade da skill `finalizar`.
- Validar a correção de páginas em branco com um print/PDF real antes de considerar concluído — não confiar apenas na leitura do CSS.
- Manter as alterações restritas aos três pontos deste plano; não aproveitar para refatorar outros geradores de PDF ou outras telas do fluxo público.
