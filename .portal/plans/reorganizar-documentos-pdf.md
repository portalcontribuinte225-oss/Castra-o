# Plano de Implementação: Reorganizar documentos PDF do processo

## Origem

- Arquivo de especificação: conversa no chat (sem `.md` de feature — escopo definido interativamente com o usuário e validado por investigação read-only do código)
- Data do planejamento: 2026-07-29
- Classificação: `frontend-only`

---

## Resumo

O sistema emite hoje 4 documentos: Requerimento, Receita, Relatório processual e Prontuário. Esta mudança:

1. Corrige uma inconsistência no Requerimento (CPF mascarado só na página 2, texto puro na página 1).
2. Remove completamente o Relatório processual (baixo uso, será substituído pelos documentos abaixo).
3. Cria 3 documentos novos — **Troca de Tutor**, **Registro de Óbito** e **Denúncia** — para os tipos de solicitação `TROCA_TUTOR`, `ANIMAL_OBITO` e `DENUNCIA`, que hoje existem como fluxo completo (backend + telas de abertura/análise) mas não emitem nenhum PDF próprio. Reaproveitam o layout visual já usado no Requerimento (cabeçalho, seções de campos, rodapé), sem a página de declaração/aceite — são registros de dados da solicitação, não termos de responsabilidade.

Motivação: os PDFs de Troca de Tutor/Óbito hoje, quando baixados via Requerimento genérico, saem com o layout de "Declaração de responsabilidade — castração animal", que não faz sentido para esses tipos. A Denúncia nunca teve nenhum PDF.

---

## Escopo

### Dentro do escopo

- Remover `maskCpf` da página 2 do Requerimento.
- Remover `generateRelatorioProcessualPdf`, `generateFallbackBundlePdf` e os 2 botões que os disparam.
- Adicionar normalização dos campos de `TROCA_TUTOR` (`target_tutor_*`), `ANIMAL_OBITO` (`death_date`, `death_cause`) e `DENUNCIA` (dados do denunciante, `notes`, `isConfidential`) em `normalizeRequest` (`src/domain.ts`).
- Criar 3 novas funções de geração de PDF (uma página cada, sem declaração), reaproveitando os helpers de desenho já existentes.
- Adicionar os 3 botões de download no modal de análise do processo (`RequestPreviewModal`, mesma região do botão de Requerimento/Relatório atual), condicionados por `request_type`.
- Corrigir o rótulo de tipo de solicitação usado nesses PDFs para cobrir `DENUNCIA` (hoje `requestTypeLabel` não tem entrada para esse tipo).

### Fora do escopo

- Tratamento de sigilo (`is_confidential`) no PDF de Denúncia — por decisão do usuário, o documento sempre mostra os dados completos do denunciante nesta rodada.
- Qualquer mudança de backend, rota, schema ou banco de dados — todos os dados necessários já existem e chegam via API.
- Mudanças na Receita e no Prontuário.
- Extração das funções de PDF para um arquivo separado (`src/lib/pdf.ts`) — fora do escopo desta mudança, mencionado apenas como possível melhoria futura.

---

## Leitura de contexto

- `/AGENT.md` (lido — é um template genérico do monorepo; este projeto não usa a estrutura `frontend/`/`backend/` nem branch `staging` que o arquivo assume. Seguidas as regras que se aplicam de fato: sem código morto, sem strings mágicas, nomenclatura em inglês para código novo, remoção real em vez de ocultação)
- `src/App.tsx` (funções de PDF, componentes de UI envolvidos)
- `src/domain.ts` (`normalizeRequest`, `RequestType`, `requestTypeLabel`, `requestTypeDomainLabels`)
- `backend/src/routes/animals.js` (rotas `/transfer` e `/death`, para confirmar nomes de coluna)
- `backend/src/routes/requests.js` (aliases camelCase→snake_case do PATCH, coluna `is_confidential`)
- Investigação read-only prévia (2 rodadas de exploração) confirmando: dead code do Relatório, ausência de mascaramento sistemático, existência prévia dos fluxos de Troca de Tutor/Óbito/Denúncia sem PDF próprio.

---

## Impacto por área

### Frontend

**`src/domain.ts`:**
- `normalizeRequest`: adicionar mapeamento explícito para os campos hoje lidos via spread cru:
  - Troca de tutor: `targetTutorName`, `targetTutorCpf`, `targetTutorPhone`, `targetTutorEmail`, `targetTutorAddress`, `targetTutorNeighborhood`, `targetTutorCity`, `targetTutorState`, `targetTutorCep` ← `target_tutor_*`
  - Óbito: `deathDate`, `deathCause` ← `death_date`, `death_cause`
  - Denúncia: já existem `req.tutor`, `req.cpf`, `req.phone`, `req.email`, `req.isConfidential`; adicionar `complaintDescription` ← `request.notes` (nome mais explícito que `notes` cru, já que `notes` é usado de forma genérica em outros tipos)
- Corrigir/confirmar rótulo de tipo para `DENUNCIA`: usar `requestTypeDomainLabels` (que já cobre os 4 tipos) no cabeçalho dos novos PDFs em vez de `requestTypeLabel` (que não tem entrada para `DENUNCIA`).

**`src/App.tsx` — remoção:**
- `generateRelatorioProcessualPdf` (função inteira, ~11457-11566)
- `generateFallbackBundlePdf` (função inteira, ~11568-11585) — usada exclusivamente por `handleRelatorioProcessual`, remover junto
- `downloadRelatorioProcessual` (~3103-3119) e o botão que a chama no `TutorDashboard` (~3196-3204)
- `handleRelatorioProcessual` (~5149-5171) e o botão "Relatório" no `RequestPreviewModal` (~5515-5518)

**`src/App.tsx` — ajuste:**
- Página 2 do Requerimento (`createRequestPdfDataUrl`, ~11770): trocar `maskCpf(req.cpf || "")` por `req.cpf || ""` (mesmo valor já usado na página 1)

**`src/App.tsx` — criação:**
- 3 novas funções, modeladas na página 1 de `createRequestPdfDataUrl` (~11612-11725), usando `createPdfDocContext`, `drawProntuarioHeader`, `drawProntuarioSectionTitle`, `drawProntuarioFields`, `drawRequestPdfFooter`, `importPdfLib`, `uint8ArrayToDataUrl` — sem página 2:
  - `createTutorTransferPdfDataUrl(request)`: seções "DADOS DA SOLICITAÇÃO" (protocolo, data, motivo), "TUTOR ATUAL" (`req.tutor`, `req.cpf`, `req.phone`), "NOVO TUTOR" (`req.targetTutorName`, `req.targetTutorCpf`, `req.targetTutorPhone`, `req.targetTutorEmail`, endereço), "DADOS DO ANIMAL" (nome, microchip).
  - `createDeathRegistrationPdfDataUrl(request)`: seções "DADOS DA SOLICITAÇÃO" (protocolo, data), "DADOS DO ANIMAL" (nome, microchip, tutor), "REGISTRO DE ÓBITO" (`req.deathDate`, `req.deathCause`, observações).
  - `createComplaintPdfDataUrl(request)`: seções "DADOS DA SOLICITAÇÃO" (protocolo, data), "DADOS DO DENUNCIANTE" (`req.tutor`, `req.cpf`, `req.phone`, `req.email`), "RELATO" (`req.complaintDescription`), endereço da ocorrência se houver.
  - Título de documento no cabeçalho (`drawProntuarioHeader`) usando `requestTypeDomainLabels[req.request_type]` como rótulo.

**`src/App.tsx` — novos botões:**
- No `RequestPreviewModal` (mesma região do botão de Requerimento/Relatório removido), renderizar condicionalmente conforme `request_type` do processo:
  - `TROCA_TUTOR` → botão "Baixar documento de troca de tutor" → `createTutorTransferPdfDataUrl`
  - `ANIMAL_OBITO` → botão "Baixar registro de óbito" → `createDeathRegistrationPdfDataUrl`
  - `DENUNCIA` → botão "Baixar documento de denúncia" → `createComplaintPdfDataUrl`
  - `PROCEDURE` (default) → mantém botão "Requerimento" existente (`createRequestPdfDataUrl`)
- Seguir o padrão de download já usado (`anchor.download`, estado de loading) igual ao `downloadPublicServiceRequerimento`/`handleRelatorioProcessual` removidos.

### Backend

Sem impacto esperado — todos os campos (`target_tutor_*`, `death_date`, `death_cause`, dados de denúncia, `is_confidential`) já existem nas colunas de `requests` e já retornam via `RETURNING *`/GET.

### Banco de dados

Sem impacto esperado — nenhuma coluna nova, nenhuma migration.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `src/domain.ts` — `normalizeRequest` (novos campos mapeados)
- `src/App.tsx` — remoção de 4 funções + 2 botões; ajuste do CPF na página 2; criação de 3 funções de PDF + 3 botões condicionais no `RequestPreviewModal`

---

## O que será removido

- `generateRelatorioProcessualPdf` (`src/App.tsx`, função inteira)
- `generateFallbackBundlePdf` (`src/App.tsx`, função inteira — sem outros usos além da função acima)
- `downloadRelatorioProcessual` (`src/App.tsx`, função + botão associado no `TutorDashboard`)
- `handleRelatorioProcessual` (`src/App.tsx`, função + botão "Relatório" associado no `RequestPreviewModal`)
- Chamada a `maskCpf` na página 2 do Requerimento (`src/App.tsx`, `createRequestPdfDataUrl`) — substituída por valor em texto puro

Nenhuma dessas remoções deve ser ocultada (`display:none`, flag desativada, comentário) — são deleções reais de código, já validadas sem outros consumidores na investigação prévia.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado. Se a remoção gerar erro de compilação (ex.: import órfão), corrigir removendo o import — não suprimir com `@ts-ignore`.

---

## Estratégia de implementação

1. `src/domain.ts`: adicionar os novos campos normalizados em `normalizeRequest` (troca de tutor, óbito, denúncia).
2. `src/App.tsx`: remover `generateRelatorioProcessualPdf`, `generateFallbackBundlePdf`, `downloadRelatorioProcessual`, `handleRelatorioProcessual` e os 2 botões associados.
3. `src/App.tsx`: ajustar `createRequestPdfDataUrl` — remover `maskCpf` da página 2.
4. `src/App.tsx`: criar as 3 novas funções de PDF (`createTutorTransferPdfDataUrl`, `createDeathRegistrationPdfDataUrl`, `createComplaintPdfDataUrl`), reaproveitando os helpers existentes, seguindo o modelo da página 1 do Requerimento.
5. `src/App.tsx`: adicionar os 3 botões condicionais no `RequestPreviewModal`, substituindo a lógica do botão único de Requerimento por uma seleção baseada em `request_type`.
6. Rodar `npm run typecheck` e `npm run build` no frontend.
7. Testar manualmente (via skill `rodar` + browser) a geração dos 4 documentos afetados/novos: Requerimento (CPF), Troca de Tutor, Óbito, Denúncia — confirmar que o Relatório processual não aparece mais em nenhum lugar da UI.

---

## Regras de negócio identificadas

- CPF do tutor nunca deve ser mascarado em nenhum documento oficial do sistema (decisão do usuário).
- Relatório processual deixa de existir como documento do sistema.
- Troca de Tutor, Registro de Óbito e Denúncia devem ter documento formal próprio, no mesmo padrão visual dos demais, mas sem página de declaração/termo de responsabilidade (esses fluxos não envolvem aceite de responsabilidade sobre procedimento).
- Sigilo do denunciante (`is_confidential`) não afeta o PDF nesta rodada — decisão explícita de adiar.

---

## Regras multi-tenant e segurança

- Nenhum dado novo é exposto — os PDFs novos usam campos que a tela de análise do processo já exibe para o mesmo usuário autorizado (`ComplaintAnalysisSection`, `TutorTransferAnalysisSection`, `DeathAnalysisSection` já mostram esses dados hoje).
- Geração de PDF continua 100% client-side (pdf-lib no navegador) — sem chamada a rota nova, sem risco de vazamento cross-tenant via backend.

---

## Validações necessárias

- Confirmar que `req.target_tutor_cpf`/`target_tutor_phone` podem vir vazios (solicitação pode não ter todos os campos preenchidos) — usar fallback `"-"` como já é padrão em `drawProntuarioFields`.
- Confirmar que `request_type` está sempre presente no objeto normalizado antes de decidir qual botão/documento exibir no `RequestPreviewModal` — usar `normalizeRequestType` (já existente, com fallback para `PROCEDURE`) em vez de comparação direta de string.

---

## Testes necessários

### Frontend

- Sem suíte de testes automatizados identificada para esses componentes (projeto não possui testes de UI para `App.tsx`) — validação será manual via browser.

### Backend

- Sem impacto, sem testes necessários.

### E2E

- Manual: criar/abrir um processo de cada tipo (`TROCA_TUTOR`, `ANIMAL_OBITO`, `DENUNCIA`, `PROCEDURE`) e confirmar que o botão certo aparece e gera o PDF certo, com os dados corretos.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

---

## Riscos e pontos de atenção

- Risco de regressão visual: os novos PDFs reaproveitam helpers compartilhados (`drawProntuarioHeader`, etc.) — qualquer erro na montagem do `ctx`/`rows` pode gerar PDF malformado; testar visualmente os 4 documentos afetados antes de considerar concluído.
- Risco de campo vazio: `target_tutor_*`/`death_date`/`death_cause` podem estar ausentes em registros antigos criados antes desses campos existirem — usar fallback.
- Risco de afetar produção: projeto não usa `staging`/PR — fluxo é commit direto em `main` (confirmado em memória do projeto). Testar bem antes do commit final.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — todas as decisões (CPF, escopo do Relatório, normalização, local dos botões, sigilo da denúncia) já foram fechadas com o usuário.

---

## Critérios de aceite

- CPF do tutor aparece em texto puro nas duas ocorrências do Requerimento (páginas 1 e 2).
- Relatório processual não existe mais em nenhum lugar do código nem da UI (nenhum botão, nenhuma função).
- Processos do tipo `TROCA_TUTOR` mostram um botão que baixa um PDF de uma página com dados do tutor atual, novo tutor e animal — sem declaração.
- Processos do tipo `ANIMAL_OBITO` mostram um botão que baixa um PDF de uma página com data, causa e dados do animal — sem declaração.
- Processos do tipo `DENUNCIA` mostram um botão que baixa um PDF de uma página com dados do denunciante e relato — sem declaração, sem tratamento de sigilo (dados sempre visíveis).
- Processos do tipo `PROCEDURE` continuam baixando o Requerimento normalmente (comportamento inalterado, exceto o CPF).
- `npm run typecheck` e `npm run build` passam sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Seguir os padrões já existentes em `src/App.tsx` para geração de PDF (não reinventar layout).
- Manter alterações pequenas e focadas — não misturar com a limpeza de PDFs já aplicada anteriormente (constante `A4_PAGE_SIZE`, `createPdfDocContext`, `getPdfColors`), apenas reaproveitar o que já existe.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Projeto não usa `staging`/PR — confirmar com o usuário antes de commit/push, conforme fluxo já estabelecido (skill `finalizar`).
