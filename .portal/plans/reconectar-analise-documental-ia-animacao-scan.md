# Plano de Implementação: Reconectar Análise Documental por IA + Animação de Digitalização

## Origem

- Solicitação direta do usuário em conversa (sem arquivo `.md` de especificação anexado).
- Contexto complementar: `.portal/plans/readequar-analise-documental-ia-estruturada.md` (plano anterior, de outra sessão/Codex, parcialmente executado — este plano completa o critério de aceite que ficou pendente: "upload com IA ativa retorna aprovado/recusado/revisão manual").
- Data do planejamento: `2026-07-26`
- Classificação: `frontend + backend`

## Resumo

A validação de documentos por IA configurada no modal "Editar documento" nunca chega a rodar de verdade no fluxo de upload do solicitante. O backend (`backend/src/routes/ai.js`) e o cliente `api.validateDocument` (`src/api.ts`) já estão prontos e corretos — recebem `analysisRules` (critérios estruturados), montam um prompt, chamam o provedor de IA (OpenAI/Anthropic/Gemini) e devolvem `status/confidence/criteriaResults/rejectionReasons/manualReviewReasons`. Porém o frontend, no ponto onde o solicitante anexa o arquivo, só faz checagem local de tipo/tamanho (`validateDocumentLocally`) e sempre retorna `"attached"` com mensagem genérica de conferência manual, ignorando os critérios cadastrados.

Rastreei a causa no histórico (`git show 82f0248`): existia uma função `validateDocumentWithAI` que de fato chamava `api.validateDocument(...)`. Ela foi apagada quando o backend foi migrado para o formato estruturado (`analysisRules`) no lugar dos campos livres antigos (`modelHint`/`aiCriteria`/`rejectionRules`) — o contrato do backend foi atualizado, mas o chamador do frontend nunca foi reescrito para o novo formato, e a chamada real ficou perdida no meio da migração.

Além disso, a UI de upload (`DocumentScannerUpload`) já computa `confidence`/`providerLabel`/`criteriaResults` mas nunca renderiza nada disso — está pela metade. E a configuração de IA (`aiSettings`) é carregada do backend mas não existe mais nenhuma tela para ativá-la/configurá-la (removida como código aparentemente órfão numa limpeza anterior, sem se perceber que era a metade que faltava de uma feature incompleta).

Este plano: (1) reconecta a chamada real com o payload estruturado atual, (2) exibe os resultados que já são calculados e nunca aparecem, (3) restaura uma tela mínima para ativar/configurar a IA, e (4) adiciona uma animação de digitalização estilizada durante a análise.

## Escopo

### Dentro do escopo

- Recriar a chamada real ao backend (`api.validateDocument`) a partir do upload do solicitante, usando o payload estruturado atual (`analysisRules`), não o formato antigo.
- Mapear a resposta completa (`status`, `confidence`, `criteriaResults`, `rejectionReasons`, `manualReviewReasons`, `provider`, `model`) para o estado `documentUploads`.
- Fallback local seguro quando a IA estiver desativada, sem chave configurada, ou em caso de erro de rede/provedor — nunca bloquear o envio por falha própria da IA.
- Exibir `criteriaResults`/confiança/provedor em `DocumentScannerUpload` (hoje computados e não renderizados), tanto para o solicitante quanto na revisão da equipe (`RequestPreviewModal`).
- Restaurar uma tela mínima de configuração de IA (ativo/inativo, provedor, modelo, chave), como item de navegação `globalOnly` (mesmo padrão de "Criar Municípios"), já que a config de IA no banco (tabela `config`) é global — sem filtro por município na query atual (`resolveAiSettings`).
- Animação de digitalização estilizada (linha de varredura + marcadores pulsantes) sobre o preview do arquivo durante `status === "checking"`, com duração ligada à chamada real. Decisão já tomada nesta conversa: a animação é decorativa/estilizada, não representa coordenadas literais de campo.
- Busca global por `validateDocumentWithAI`, `aiSettings`, `api.validateDocument` antes de concluir, para não deixar um segundo caminho paralelo nem código morto.

### Fora do escopo

- Integração com OCR especializado (Google Document AI, AWS Textract, Azure Document Intelligence) — herdado do plano anterior.
- Bounding boxes reais retornadas pela IA por critério (decidido nesta conversa: animação é estilizada, não literal — pedir coordenadas ao modelo aumentaria custo/tokens e é pouco confiável para vision LLMs genéricos nessa tarefa).
- Endpoint paralelo (`/ai/validate-v2`) ou componente de upload duplicado.
- Configuração de IA por município (permanece global, como já está hoje no banco) — a menos que surja pedido explícito em outra conversa.
- Mover a chamada de IA para um worker/fila em background — mantém síncrona dentro do request, como já era a intenção original antes da chamada ser removida. Risco documentado abaixo, não resolvido nesta entrega.
- Alterar `.env`, CI/CD ou infraestrutura de deploy sem necessidade explícita.
- Executar migrations.

## Leitura de contexto

- `/AGENT.md` (regras globais — nota: descreve fluxo `staging`/PR que não se aplica a este repositório; o projeto usa commit direto em `main` sem PR, conforme confirmado pelas skills `implementar`/`finalizar` já em uso neste projeto)
- `backend/src/routes/ai.js`
- `src/api.ts`
- `src/domain.ts`
- `src/App.tsx` (`handleDocumentFile`, `validateDocumentLocally`, `DocumentScannerUpload`, `ConfigView`, `RequestPreviewModal`)
- `backend/src/db/migrations.js` (schema da tabela `config`, incluindo `municipality_id`)
- `.portal/plans/readequar-analise-documental-ia-estruturada.md` (plano anterior, referência direta)
- Histórico git (`git show 82f0248`) para entender exatamente onde/como a chamada real foi removida

Observação: `frontend/AGENT.md` e `backend/AGENT.md` não existem neste repositório — apenas `/AGENT.md` na raiz.

## Impacto por área

### Frontend

- `src/App.tsx`:
  - Recriar uma função de validação real (ex.: `validateDocumentWithAI`) que chama `api.validateDocument({ document: { id, name, analysisRules }, file: { name, type, size, dataUrl } })` quando `aiSettings.active` for verdadeiro, com `try/catch` cujo fallback é o comportamento local atual (`validateDocumentLocally`).
  - Atualizar `handleDocumentFile` para usar essa nova função em vez de chamar `validateDocumentLocally` diretamente — `validateDocumentLocally` passa a ser o fallback interno, não o caminho principal.
  - `DocumentScannerUpload`: renderizar `criteriaResults`/confiança/provedor (reaproveitar `showTechnicalDetails`/`hasConfidence`/`providerLabel`, hoje computados e descartados); adicionar overlay de animação de scan quando `status === "checking"`.
  - Novo componente pequeno e local para a animação de scan (CSS puro, sem nova dependência — `lucide-react` já disponível se algum ícone for necessário).
  - `ConfigView`: novo item de navegação `globalOnly: true` ("Inteligência Artificial") com toggle ativo/inativo + campos de provedor/modelo/chave, usando `setAiSettings` (hoje recebido como prop e nunca chamado) e persistindo via rota de config já existente (mesmo padrão usado para outras configs globais).
  - `RequestPreviewModal` (revisão interna pela equipe): exibir os mesmos detalhes técnicos quando disponíveis no documento revisado.
- Sem mudança de contrato entre frontend/backend além do que o backend já aceita hoje — o payload `analysisRules` já é o formato correto.

### Backend

- Nenhuma mudança obrigatória em `backend/src/routes/ai.js` — o contrato (`buildPrompt`, `validationSchema`, `normalizeAiResult`) já suporta o que precisamos.
- `resolveAiSettings` continua buscando `config` global (`key = "ai"`) sem filtro de município — mantido como está, documentado aqui como decisão consciente, não como bug a corrigir nesta entrega.

### Banco de dados

Sem impacto esperado — nenhuma migration necessária.

- A tabela `config` já tem coluna `municipality_id` (nullable). A configuração de IA seguirá salva com `municipality_id = NULL` (global), lida pela query atual sem filtro adicional.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado em deploy/CI.

Dependência operacional a registrar: para a análise funcionar de verdade em produção, alguém precisa configurar uma chave de API real — via a nova tela de configuração, ou via env var (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`) no backend. Hoje não há nenhuma chave configurada em nenhum ambiente conhecido.

## Arquivos provavelmente afetados

- `src/App.tsx` (maior parte do trabalho: função de validação real, `handleDocumentFile`, `DocumentScannerUpload`, `ConfigView`, `RequestPreviewModal`)
- `src/styles.css` (animação de scan, ajustes visuais dos detalhes técnicos exibidos)
- Sem alteração esperada em `backend/src/routes/ai.js`, `src/api.ts`, `src/domain.ts` (contrato já correto)

## Estratégia de implementação

1. Busca global por `validateDocumentWithAI`, `validateDocumentLocally`, `aiSettings`, `api.validateDocument` para mapear todos os pontos de contato antes de editar qualquer coisa.
2. Recriar a função de chamada real usando o payload estruturado atual (`analysisRules`), não o formato antigo (`modelHint`/`aiCriteria`/`rejectionRules`).
3. Atualizar `handleDocumentFile` para usar a nova função, mantendo `validateDocumentLocally` como fallback interno.
4. Renderizar `criteriaResults`/confiança/provedor em `DocumentScannerUpload` e na revisão da equipe (`RequestPreviewModal`).
5. Construir a animação de scan (CSS + pequeno componente local), acoplada ao estado `checking`, com a decisão já tomada de ser estilizada/decorativa (sem coordenadas reais).
6. Restaurar a tela de configuração de IA (`ConfigView` + item de navegação `globalOnly`), ligando `setAiSettings` a uma ação real de salvar.
7. Testar os cenários: IA desativada, aprovado, recusado, revisão manual, erro de rede/provedor.
8. Busca final por código morto/duplicado antes de concluir (garantir que não sobrou um segundo caminho de validação).
9. Rodar `npm run typecheck` e `npm run build`.

## Regras de negócio identificadas

- Documento obrigatório só libera envio com status `approved` ou `attached` (comportamento já existente, preservado — `acceptableUploadStatuses`).
- A IA nunca deve bloquear o envio da solicitação por falha técnica própria (erro de rede, provedor fora do ar, chave inválida) — sempre cai para conferência manual.
- Nenhum dado pessoal extraído deve aparecer na tela (já garantido pelo backend via `sanitizeText`).
- Aprovação/recusa automática continuam controladas por `allowAutomaticApproval`/`allowAutomaticRejection`, já configuráveis por tipo de documento.

## Regras multi-tenant e segurança

- Configuração de IA (ativo/provedor/modelo/chave) permanece global, não por prefeitura — tela restrita a `globalOnly` (mesmo padrão já usado por "Criar Municípios").
- Critérios de documento (`analysisRules`) continuam por tipo de documento, já escopados por município via `documentTypes`.
- Nunca logar base64 do arquivo nem prompt completo com dados pessoais (já é assim no backend hoje — preservar).
- Chave de API nunca é exposta ao frontend — permanece apenas no backend/config, como já acontece.

## Validações necessárias

- Validar que a resposta da IA já normalizada pelo backend (`normalizeAiResult`) é aplicada ao estado sem transformação adicional arriscada no frontend.
- Validar que erro de rede/provedor não trava o formulário nem impede o solicitante de prosseguir (cai para conferência manual).
- Validar tipo/tamanho do arquivo antes de qualquer chamada à IA (comportamento local atual, preservado como primeira barreira).

## Testes necessários

### Frontend

- Upload com IA desativada → comportamento atual preservado (conferência manual).
- Upload com IA ativada → resultado aprovado.
- Upload com IA ativada → resultado recusado.
- Upload com IA ativada → resultado de revisão manual/baixa confiança.
- Erro de rede/provedor durante a chamada → cai para conferência manual sem travar o formulário.
- Animação de scan aparece durante `checking` e desaparece ao concluir.
- Detalhes técnicos (`criteriaResults`/confiança/provedor) aparecem corretamente após aprovado/recusado.

### Backend

- Nenhum teste novo obrigatório (contrato já existente e não alterado nesta entrega).

### E2E

- Fluxo público completo com IA ativa simulada, cobrindo os 3 desfechos (aprovado/recusado/revisão manual) + erro de provedor.
- Verificação em viewport mobile (375px).

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Chamada síncrona a provedor externo dentro do request de upload pode levar alguns segundos (esse já era o comportamento da versão original antes de ser removida) — sem chave configurada, o fluxo permanecerá em fallback local até uma chave real ser fornecida.
- Sem chave de API configurada hoje em nenhum ambiente conhecido — a feature ficará "pronta, mas inativa" até você fornecer credenciais (via a nova tela ou via env var).
- Configuração de IA global, não por prefeitura — se no futuro for necessário uma chave por município, é uma mudança arquitetural separada (mudança na query `resolveAiSettings` + na tela de configuração).
- Risco de custo/latência por chamada de IA externa por documento enviado — mitigado pelo fallback e pelo fato de a IA continuar opcional (`aiSettings.active`).
- Risco de regressão visual ao adicionar a animação de scan sobre o preview existente — mitigado testando em desktop e mobile antes de concluir.

## Perguntas em aberto

- Confirma que a configuração de IA deve continuar global (não por prefeitura)? Assumido "sim" para esta entrega, por ser o comportamento atual do banco.
- Qual provedor/modelo pretende usar em produção quando a chave for configurada (OpenAI, Anthropic ou Gemini)? Não é necessário informar a chave agora — só para saber se a tela de configuração deve vir com algum provedor pré-selecionado por padrão.

Já respondida nesta conversa: a animação de digitalização é estilizada/decorativa (linha de varredura + marcadores pulsantes em posições plausíveis, sincronizada com a duração real da chamada), não representa coordenadas literais retornadas pela IA.

## Critérios de aceite do plano

A implementação deve ser considerada pronta quando:

- Upload real de documento aciona a chamada à IA (quando ativada) e reflete o resultado real na tela, não mais um status genérico fixo.
- Os critérios configurados no modal "Editar documento" (obrigatórios/recusa/revisão manual) realmente influenciam a decisão retornada.
- Existe uma forma de ativar/configurar a IA pela UI (tela `globalOnly`), sem precisar editar o banco diretamente.
- A animação de digitalização aparece durante a análise e desaparece ao concluir.
- Os detalhes técnicos (critérios avaliados, confiança, provedor) aparecem tanto para o solicitante quanto para a equipe.
- Nenhum código duplicado/morto remanescente (nenhuma segunda função de validação "quase igual", nenhum prop não utilizado).
- `npm run typecheck` e `npm run build` passam sem novos erros.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Seguir `/AGENT.md` — mas respeitar o fluxo real deste projeto (commit direto em `main`, sem `staging`/PR, conforme já estabelecido pelas skills `implementar`/`finalizar` locais).
- Não criar endpoint, componente ou fluxo paralelo ao já existente.
- Não alterar `backend/src/routes/ai.js`, `src/api.ts` ou `src/domain.ts` a menos que a implementação revele necessidade real (documentar caso aconteça).
- Não executar migrations.
- Não alterar `.env`.
- Reaproveitar `validateDocumentLocally` como fallback interno, não descartá-lo.
- Ao final, rodar busca global confirmando que não sobrou um segundo caminho de validação nem prop/estado não utilizado (`aiSettings`, `setAiSettings`).
- Manter alterações pequenas e focadas nos itens deste plano.
