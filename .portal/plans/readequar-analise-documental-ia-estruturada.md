# Plano de Implementacao: Readequar Analise Documental por IA Estruturada

## Origem

- Arquivo de especificacao: `C:\Users\rodri\.codex\attachments\fa659355-472d-486e-b076-133594b1e342\pasted-text.txt`
- Contexto complementar: conversa sobre analise de documentos comprobatórios por IA, LGPD, uso de GPT e criterios por tipo de documento
- Data do planejamento: `2026-07-25`
- Classificacao: `frontend + backend`

## Resumo

Evoluir a validacao documental por IA ja existente para usar uma estrutura unica e definitiva de criterios por tipo de documento. A implementacao nao deve criar um fluxo paralelo, endpoint V2, componente duplicado ou compatibilidade eterna.

Hoje o sistema usa campos livres como `modelHint`, `aiCriteria` e `rejectionRules`, enviados para `/api/ai/validate`. O objetivo e migrar essa configuracao para um modelo estruturado de analise, no qual cada tipo de documento define criterios, campos esperados, regras de recusa, regras de revisao e resultado esperado sem expor dados pessoais extraidos.

## Escopo

### Dentro do escopo

- Refatorar o cadastro atual de tipos de documento para suportar modelo estruturado de analise.
- Reaproveitar a rota atual `/api/ai/validate`.
- Reaproveitar o fluxo atual de upload e validacao documental.
- Substituir os campos livres legados por uma fonte unica de verdade para criterios.
- Fazer a IA retornar decisao/checklist sem devolver dados pessoais extraidos.
- Preservar dados historicos necessarios, migrando o conteudo antigo para a nova estrutura quando aplicavel.
- Remover codigo, campos e referencias obsoletas depois da migracao.
- Garantir comportamento multi-tenant por municipio.

### Fora do escopo

- Integrar Google Document AI, AWS Textract, Azure Document Intelligence ou outro OCR especializado.
- Criar endpoint paralelo como `/api/ai/validate-v2`.
- Criar nova tela paralela de documentos.
- Treinar modelo proprietario.
- Executar migrations automaticamente.
- Alterar `.env`, CI/CD ou infraestrutura de deploy sem confirmacao explicita.

## Leitura de contexto

- `/AGENT.md`
- `C:\Users\rodri\.codex\attachments\fa659355-472d-486e-b076-133594b1e342\pasted-text.txt`
- `backend/src/routes/ai.js`
- `backend/src/routes/config.js`
- `backend/src/server.js`
- `src/domain.ts`
- `src/api.ts`
- `src/App.tsx`

Observacao: `frontend/AGENT.md` e `backend/AGENT.md` nao foram encontrados no repositorio durante o planejamento.

## Impacto por area

### Frontend

Alteracoes esperadas:

- Evoluir o modal atual de documentos em `src/App.tsx`, mantendo o padrao visual existente.
- Refatorar `newDocument` para usar uma estrutura unica, por exemplo `analysisRules`.
- Atualizar `openDocumentModal` e `createDocumentType` para trabalhar com a estrutura nova.
- Atualizar `normalizeDocumentType` em `src/domain.ts`.
- Atualizar `validateDocumentWithAI` para enviar a nova estrutura para o backend.
- Remover, ao final, leituras e escritas permanentes de `modelHint`, `aiCriteria` e `rejectionRules`.
- Exibir resultado da validacao como parecer/checklist, sem campos pessoais extraidos.
- Garantir estados de loading, erro, documento recusado, documento aprovado e revisao manual.

### Backend

Alteracoes esperadas:

- Refatorar `backend/src/routes/ai.js`, mantendo `/api/ai/validate`.
- Atualizar `buildPrompt` para usar criterios estruturados.
- Expandir `validationSchema` para retorno com checklist, decisao, confianca e motivos genericos.
- Garantir que o prompt instrua a IA a nao devolver dados pessoais extraidos.
- Atualizar `normalizeAiResult` para preservar o resultado estruturado necessario.
- Reforcar validacoes de payload.
- Avaliar validacao estrutural de `castragestao:document-types` em `backend/src/routes/config.js`.
- Garantir que payloads sensiveis nao sejam logados.

### Banco de dados

Sem migration obrigatoria esperada, pois tipos de documento ja sao armazenados como JSON em `config.value` na chave `castragestao:document-types`.

Mesmo sem migration fisica, ha uma migracao logica dos dados:

- Campos atuais como `modelHint`, `aiCriteria` e `rejectionRules` devem ser convertidos para a nova estrutura.
- A arquitetura final nao deve depender de fallback permanente para campos antigos.
- Se for necessario manter campos antigos temporariamente para uma migration intermediaria, isso deve ser documentado e removido ao final.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado em deploy.

Possiveis cuidados:

- Nenhuma alteracao em `.env`.
- Nenhuma nova dependencia sem necessidade.
- A integracao com provedores de IA deve continuar usando configuracao existente.
- Manter limite de payload e evitar logs com documento/base64.

## Arquivos provavelmente afetados

- `src/domain.ts`
- `src/App.tsx`
- `src/api.ts`
- `backend/src/routes/ai.js`
- `backend/src/routes/config.js`

## Estrategia de implementacao

1. Fazer busca global por campos e estruturas atuais:
   - `modelHint`
   - `aiCriteria`
   - `rejectionRules`
   - `validateDocumentWithAI`
   - `validateDocumentLocally`
   - `/api/ai/validate`

2. Classificar estruturas existentes:
   - REAPROVEITAR: rota atual `/api/ai/validate`, fluxo de upload, `api.validateDocument`, config JSON de documentos.
   - REFATORAR: prompt, schema de resposta, modal de documento, normalizacao.
   - MIGRAR: campos livres antigos para `analysisRules`.
   - REMOVER: leituras/escritas antigas apos a migracao.

3. Definir a estrutura final de `analysisRules`, por exemplo:
   - `expectedDocument`
   - `requiredCriteria`
   - `rejectionCriteria`
   - `manualReviewCriteria`
   - `matchRules`
   - `minimumConfidence`
   - `allowAutomaticApproval`
   - `allowAutomaticRejection`

4. Atualizar `normalizeDocumentType` para normalizar somente a estrutura definitiva.

5. Atualizar o modal de documento para editar criterios estruturados usando componentes existentes.

6. Atualizar o payload enviado ao backend para usar a estrutura nova.

7. Refatorar `buildPrompt` para orientar a IA a:
   - analisar o documento completo;
   - verificar se condiz com os criterios;
   - nao devolver dados pessoais extraidos;
   - devolver apenas flags, checklist, motivos genericos e confianca.

8. Atualizar o JSON schema da resposta para algo como:
   - `status`
   - `message`
   - `confidence`
   - `criteriaResults`
   - `rejectionReasons`
   - `manualReviewReasons`
   - `provider`

9. Garantir que o sistema trate:
   - aprovado;
   - recusado;
   - revisao manual;
   - erro de IA;
   - IA inativa.

10. Remover codigo legado substituido:
   - campos antigos no estado do modal;
   - envio dos campos antigos para backend;
   - leitura dos campos antigos no prompt;
   - exibicoes antigas sem uso.

11. Rodar busca global final por referencias antigas e remover codigo morto.

12. Validar typecheck/build/testes aplicaveis.

## Regras de negocio identificadas

- Cada tipo de documento deve possuir uma unica fonte de verdade para criterios de analise.
- A IA deve verificar se o documento condiz com os criterios cadastrados.
- A IA nao deve retornar dados pessoais extraidos do documento.
- O resultado deve ser um parecer/checklist, nao uma copia dos dados lidos.
- Quando a confianca for baixa ou houver ambiguidade, o documento deve seguir para revisao manual.
- Documentos obrigatorios devem bloquear envio quando nao estiverem aprovados ou aceitos conforme regra do fluxo atual.
- A analise por IA deve continuar opcional conforme configuracao.
- A implementacao antiga nao deve permanecer em paralelo.

## Regras multi-tenant e seguranca

- Configuracoes de tipos de documento devem respeitar municipio/tenant.
- Configuracao de IA deve respeitar o escopo definido pelo sistema atual.
- Nao misturar criterios entre municipios.
- Nao expor token de IA no frontend.
- Nao registrar em logs:
  - base64 do arquivo;
  - documento bruto;
  - prompt completo com dados pessoais;
  - resposta com dados pessoais.
- A IA externa tera acesso ao documento bruto durante a analise; portanto o fluxo deve manter transparencia ao usuario e controle por municipio.
- O resultado salvo deve conter somente dados minimos de auditoria: status, criterios, motivos genericos, confianca, provedor/modelo e data.

## Validacoes necessarias

- Validar tipo e tamanho do arquivo antes de chamar IA.
- Validar estrutura de `analysisRules`.
- Validar se criterios obrigatorios possuem identificador/nome.
- Validar limites de texto dos criterios.
- Validar `minimumConfidence`.
- Validar flags de aprovacao/recusa automatica.
- Validar payload de `/api/ai/validate`.
- Validar que resposta da IA segue schema.
- Validar que dados pessoais extraidos nao sao persistidos como campos estruturados.

## Testes necessarios

### Frontend

- Criar/editar tipo de documento com criterios estruturados.
- Migrar documento antigo para nova estrutura no carregamento/salvamento.
- Upload com IA inativa.
- Upload com IA ativa e retorno aprovado.
- Upload com IA ativa e retorno recusado.
- Upload com IA ativa e retorno revisao manual.
- Confirmar que documentos obrigatorios respeitam status aceitos.
- Busca global confirma ausencia de campos legados como fonte principal.

### Backend

- `/api/ai/validate` rejeita payload invalido.
- `buildPrompt` usa `analysisRules`.
- Resposta da IA e normalizada corretamente.
- Baixa confianca gera revisao manual.
- Erro do provedor gera fallback seguro.
- Dados pessoais extraidos nao sao retornados quando o provedor incluir indevidamente.
- Config de documentos invalida e rejeitada se a validacao for adicionada em `config.js`.

### E2E

- Fluxo publico completo com documento aprovado.
- Fluxo publico com documento pendente de revisao.
- Fluxo publico com documento recusado.
- Validacao multi-tenant: documentos/criterios de um municipio nao aparecem em outro.

## Comandos de validacao sugeridos

```bash
npm run typecheck
npm run build
node --env-file=.env --test
```

Se houver testes especificos adicionados:

```bash
npm test
npm run test:backend
```

## Riscos e pontos de atencao

- Risco LGPD por envio de documento bruto para IA externa.
- Risco de falso positivo/falso negativo em documento sensivel.
- Risco de manter compatibilidade antiga indefinidamente.
- Risco de quebrar documentos ja cadastrados se a migracao logica for incompleta.
- Risco de payload grande por base64.
- Risco de logar dados sensiveis em erro/provider response.
- Risco multi-tenant se configuracoes forem buscadas sem escopo correto.
- Risco operacional se API externa ficar indisponivel.

## Perguntas em aberto

- A IA pode reprovar automaticamente ou deve encaminhar divergencias para revisao manual?
- A estrutura nova deve remover os campos antigos ja nesta entrega final, ou havera etapa intermediaria controlada?
- O parecer detalhado da IA aparece para o solicitante ou apenas para usuarios internos?
- A ativacao da IA sera global ou por municipio?

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- Existe uma unica estrutura definitiva para criterios de analise documental.
- O fluxo atual foi refatorado sem criar fluxo paralelo.
- `/api/ai/validate` continua sendo a rota unica de validacao por IA.
- A IA retorna parecer/checklist sem dados pessoais extraidos.
- Campos livres antigos deixam de ser fonte principal de verdade.
- Codigo legado substituido e removido ou justificado temporariamente.
- A busca global por estruturas antigas foi executada e documentada.
- Typecheck e build passam.
- Relatorio final informa o que foi reaproveitado, refatorado, criado, migrado e removido.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Seguir `/AGENT.md`.
- Nao criar endpoint, componente, service ou schema paralelo.
- Nao usar sufixos `V2`, `New`, `Legacy` como arquitetura permanente.
- Nao executar migrations sem confirmacao explicita.
- Reaproveitar o fluxo atual de documentos e IA.
- Remover codigo morto ao final.
- Nao alterar `.env`.
- Nao logar dados sensiveis.
- Preservar dados historicos necessarios.
- Entregar relatorio final de limpeza com:
  - REAPROVEITADO;
  - REFATORADO;
  - CRIADO;
  - MIGRADO;
  - REMOVIDO;
  - estruturas legadas remanescentes e justificativa, se houver.
