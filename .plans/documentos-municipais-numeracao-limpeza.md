# Plano de Implementação: documentos municipais no padrão novo, numeração por município e limpeza

## Origem

- Arquivos de especificação: modelos `C:\Users\rodri\Downloads\docs castração\Requerimento.doc` e `C:\Users\rodri\Downloads\docs castração\Receita_Veterinaria.doc`, mais as decisões tomadas no planejamento (abaixo).
- Data do planejamento: `2026-11-22`
- Classificação: `frontend + backend + database`
- Ponto de partida: a árvore de trabalho tem mudanças **não commitadas** do Codex (requerimento e receita em pdf-lib, `src/features/municipal-documents/municipal-pdf.ts`, `src/features/request-document/request-requirement-pdf.ts`, `src/features/process-modal/prescription-pdf.ts`, nova declaração em `shared/request-declaration-contract.js`, `prescription-print.ts` apagado). Elas são a base: reaproveitar o que serve e corrigir o que este plano aponta. O arquivo `escopo-integracoes-notificacoes.md` na raiz (não versionado) não faz parte deste trabalho e não entra em commit.
- Para comparar com os modelos: abrir os `.doc` no Word ou exportá-los para PDF pelo Word (`Documents.Open` + `ExportAsFixedFormat(caminho, 17)` via COM no PowerShell).

---

## Resumo

Hoje o sistema gera 8 tipos de documento em 3 estilos diferentes: o novo do Codex (requerimento e receita), o estilo antigo "prontuário" dentro do `App.tsx` (troca de tutor, registro de óbito, denúncia, prontuário do animal, tramitação do processo e página de anexo sem prévia) e o relatório gerencial impresso pelo navegador. Todos os documentos emitidos passam a seguir **um único padrão municipal**, tirado dos modelos: cabeçalho com brasão, Estado, Prefeitura, secretaria e logo, faixa com protocolo e datas, campos sem caixas, seções "01 TÍTULO" e rodapé "PROTEÇÃO ANIMAL".

Junto com isso: protocolo e receita passam a ser numerados **por município e por ano**, sem prefixo; a data do aceite eletrônico passa a ser gravada só pelo servidor (hoje o navegador consegue enviá-la); o `App.tsx` deixa de gerar PDFs e de exportar código para outros módulos; e sai todo o código e CSS que sobrou. No fim, os bancos local e de produção são zerados (cada um só com ordem explícita do usuário).

---

## Escopo

### Dentro do escopo

- Padrão municipal único para: requerimento (com prévia antes do envio), receita, troca de tutor, registro de óbito, denúncia, prontuário do animal, tramitação do processo e página de anexo sem prévia.
- Numeração por município e por ano para protocolo e receita, no formato `000001/2026`, sem prefixo.
- Aceite eletrônico imutável: `signed_at` só gravado pelo servidor; remoção da assinatura desenhada antiga (`signature_data_url`).
- Remoção da leitura de campos antigos que nada grava mais, nos documentos e telas ligadas a eles.
- Limpeza: código sem uso (frontend, backend, shared, scripts de carga única), CSS sem uso, código fora do lugar, importações circulares com o `App.tsx`.
- Ativar `noUnusedLocals` no `tsconfig.json`.
- Reset dos bancos local e de produção como último passo.

### Fora do escopo

- Relatório gerencial (tela Relatórios, `src/features/reports.tsx` e `report-print.ts`): fica como está. Só o `print-html.ts` muda de pasta.
- **Plano seguinte (recomendado):**
  - Compatibilidade com dados antigos fora dos documentos (cerca de 12 mecanismos): status/tags antigos (`tagsFromLegacyStatus` e o mapeamento em `src/domain.ts`), tipos de pedido em texto livre, aviso antigo do WhatsApp `documents_reviewed` (`LEGACY_DOCUMENTS_REVIEWED`), anexos antigos sem comprovante (`legacyAttachmentId`, ids `legacy-*`), caminho antigo de notificação para pedidos sem `followUp` (`dispatchNotification({ legacy })`), animais criados de pedidos antigos (`ensureAnimalFromLegacyRequest` em `backend/src/routes/animals.js`), segredos de configuração em texto puro (`config-secret-cipher.js`), ocorrência de agenda antiga (`schedule-contract.js`), `legacyId` em `request-procedure-contract.js`, setores em JSON paralelos à tabela.
  - Esquema único do banco: juntar `migrations.js` e os SQL de `backend/src/db/sql/` num esquema final, sem as correções de dados antigos que o boot ainda roda (troca de papel `admin`, migração de status etc.).
  - CSS: regras duplicadas e `!important` (precisa de conferência visual tela a tela).
  - Organizar arquivos soltos em `src/features/` (`reports.tsx`, `agenda.tsx`, `request-actions.ts`, `request-analysis-sections.tsx`).
- Os 94 exports usados só no próprio arquivo (quase todos tipos de assinatura de função): não trazem ganho.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- Os dois modelos `.doc` (convertidos para PDF pelo Word para ver o layout)
- `src/features/municipal-documents/municipal-pdf.ts`, `src/features/request-document/request-requirement-pdf.ts` (+ teste), `src/features/request-document/request-acceptance.ts`, `src/features/process-modal/prescription-pdf.ts`, `prescription-dialog.tsx`, `process-modal.tsx`, `src/features/process-report/process-report.ts`, `print-html.ts`
- `src/App.tsx`: geradores de PDF (≈ linhas 7480–8600: `appendProcessTextPages`, `generateProcessReportPdf`, `prepareProcessDocumentPreview`, `drawProntuario*`, `generateProntuarioPdf`, `createTutorTransferPdfDataUrl`, `createDeathRegistrationPdfDataUrl`, `createComplaintPdfDataUrl`, `createRequestPdfDataUrl`, helpers antigos), `downloadAnimalRecordPdf` (≈ 2297), `TutorDashboard` (≈ 2310–2430), formulário de pedido (`openDeclarationPdf` ≈ 2974, envio ≈ 2958), `DocumentPreviewModal` (≈ 3292)
- `shared/request-declaration-contract.js`, `shared/request-types-contract.js`, `shared/request-access-contract.js`
- `backend/src/db/migrations.js`, `backend/src/db/sql/*.sql`, `backend/src/routes/requests.js`, `backend/src/routes/animals.js`, `backend/src/routes/municipalities.js`, `backend/src/repositories/municipality-identity.js`, `request-access.js`, `request-tracking.js`
- `backend/src/services/procedure-actions/procedure-action-apply.js`, `procedure-action-handler.js`, `procedure-request-state.js`, `backend/src/services/documents/request-documents.js`
- `src/features/municipality-form/municipality-image.ts`, `src/features/registered-animals/use-request-options.ts`, `request-payload.ts`, `src/features/request-access/request-access.tsx`, `src/features/tutor-access/tutor-area.tsx`
- Levantamentos feitos: `tsc --noUnusedLocals` (86 declarações sem uso no frontend), busca de exports sem uso, de arquivos inalcançáveis e de classes CSS sem uso (ver Anexo A).

---

## Impacto por área

### Frontend

**Padrão municipal (base comum em `src/features/municipal-documents/`)**

Página A4 (595,28 × 841,89 pt), Helvetica e Helvetica Bold, paleta `MUNICIPAL_DOCUMENT_THEME` do Codex (ink `#203347`, dark `#143346`, accent `#0B6E73`, muted `#617687`, tint `#F1F7F7`, line `#D8E9EC`). Medidas abaixo são aproximadas; conferir contra o modelo.

- **Cabeçalho (toda página):**
  - Brasão (`municipality.brasao`) num quadro à esquerda e logo do órgão (`municipality.department_logo`) num quadro à direita, cerca de 60 × 60 pt, imagem ajustada sem distorcer. Sem imagem, o espaço fica vazio (sem moldura nem texto).
  - Centro: `ESTADO DE {NOME DO ESTADO}` (pequeno, negrito, cinza, letras espaçadas com o operador `setCharacterSpacing` do pdf-lib); `PREFEITURA MUNICIPAL DE {NOME}` (negrito, maior, dark); `department_name` (negrito, menor, dark). Linha sem dado é omitida.
  - Faixa com fundo tint logo abaixo, com 2 ou 3 colunas separadas por fio: rótulo pequeno em accent (letras espaçadas) e valor em negrito dark.
  - Fio accent grosso (≈ 2 pt) na largura toda, fechando o cabeçalho.
  - Imagens aceitas pelo cadastro: PNG, JPG, WEBP (o WEBP é convertido por canvas, só no navegador).
- **Rodapé (toda página):** `PROTEÇÃO ANIMAL` (negrito, accent) + ` | Emissão eletrônica do sistema` (cinza), à esquerda, sem fio.
- **Blocos:** título centralizado; seção `01` (número pequeno accent) + título (negrito dark); linha de campos sem caixa (rótulo pequeno negrito cinza em maiúsculas, valor em negrito dark, fio fino `line` embaixo); texto que quebra pela largura real da fonte; paginação que repete cabeçalho e rodapé.
- **Faixa por documento:**
  - Requerimento, troca de tutor, óbito, denúncia e tramitação: `PROTOCOLO` e `DATA DE EMISSÃO`.
  - Receita: `PROTOCOLO`, `DATA DE EMISSÃO` e `Nº DO DOCUMENTO` (número da receita).
  - Prontuário: `ANIMAL`, `MICROCHIP` e `DATA DE EMISSÃO`.
- **Data de emissão:** data do registro do pedido (requerimento, troca, óbito, denúncia); `issuedAt` da receita; momento da geração (prontuário, tramitação). Datas e horas no fuso `America/Sao_Paulo`.
- **Nomes dos estados:** tabela nova com as 27 UFs (ex.: `SC` → `SANTA CATARINA`) em `src/features/municipal-documents/`.
- **Nome do arquivo baixado:** sem barra (`Requerimento 000004-2026.pdf`, `Receita 000001-2026.pdf`, `Relatório 000004-2026.pdf`).
- **Import do pdf-lib:** sempre por `importPdfLib()` (o `prescription-pdf.ts` hoje usa `import("pdf-lib")` direto).

**Requerimento (`request-requirement-pdf.ts`)**

- Página 1:
  - Título `REQUERIMENTO`.
  - `01 INFORMAÇÕES DO ATENDIMENTO`: `DATA AGENDADA` e `HORÁRIO` com valor grande (≈ 16 pt); depois, uma linha inteira cada: `LOCAL / POSTO` (`scheduleLocationName`), `ENDEREÇO DO LOCAL` (`scheduleAddress`) e `LINK DO LOCAL` (`scheduleAddressUrl`, sublinhado em accent e clicável por anotação de link do pdf-lib). Sem data, horário, local ou endereço: `A definir`. Sem link: a linha não aparece.
  - `02 IDENTIFICAÇÃO DO TUTOR`: 2 linhas × 4 colunas — `NOME COMPLETO`, `CPF`, `CELULAR`, `E-MAIL` / `ENDEREÇO`, `BAIRRO`, `CIDADE / UF`, `CEP` (formatação de CPF, telefone e CEP do Codex).
  - `03 ANIMAIS E PROCEDIMENTOS`: por animal, faixa tint `01   LUNA   ·   Canina · Fêmea` (nome em maiúsculas); linha `RAÇA` (SRD quando indefinida), `PORTE`, `PESO` (`12,4 kg`), `IDADE` (em anos, ou meses abaixo de 1 ano, calculada na data de emissão a partir de `birthDate`, ou o texto de `age`), `MICROCHIP` (código, ou `Sim`/`Não`); linha `PROCEDIMENTOS` (rótulo cinza + nomes em accent negrito separados por `•`); linha de detalhes em cinza menor: `Pelagem: … · Vacinas: em dia|não · Vermifugação: sim|não · Doenças prévias: não relatadas|{texto}`.
  - Nota final em cinza: `Cada animal e seus procedimentos estão vinculados a um único protocolo.`
- Página 2:
  - Título `DECLARAÇÃO DE CIÊNCIA E RESPONSABILIDADES`.
  - Abertura em negrito: `Eu, {tutor}, na condição de tutor(a) ou responsável pelos animais identificados neste requerimento, declaro, para os devidos fins, que:`
  - Grupos no formato `01 / CUIDADOS E AUTORIZAÇÃO` e `02 / ELEGIBILIDADE E VERACIDADE DAS INFORMAÇÕES` (accent negrito), itens numerados `01`…`09` em sequência (número accent negrito, texto com recuo).
  - `ORIENTAÇÕES PARA O DIA DO ATENDIMENTO` (accent negrito) + parágrafo.
  - Pedido web: `03 / REGISTRO DE ACEITE ELETRÔNICO` com bloco de fundo tint contendo `ACEITE ELETRÔNICO CONFIRMADO NO SISTEMA`, o parágrafo `O(a) tutor(a) declarou ciência e concordância com os termos acima ao confirmar o requerimento. O aceite ficou registrado eletronicamente e vinculado a este protocolo.` e 3 campos: `TUTOR(A) / RESPONSÁVEL`, `CPF`, `DATA E HORA DO ACEITE` (`19/11/2026 · 20:31:12`, de `signed_at`).
  - Pedido de balcão: sem aceite eletrônico; termina com `03 / ASSINATURA DO TUTOR OU RESPONSÁVEL`, campos `TUTOR(A) / RESPONSÁVEL` e `CPF` e a linha de assinatura em papel (confirmar pergunta 2).
  - Prévia antes do envio: protocolo `A gerar após o envio`, data de emissão = hoje, e no lugar do aceite `Aceite eletrônico pendente.`
- O texto da declaração e das orientações vem de um único módulo (hoje `shared/request-declaration-contract.js`, que passa a viver em `src/features/request-document/`). O PDF monta a declaração a partir do município, em vez de receber a declaração pronta por parâmetro.
- Remover o que o Codex pôs e o modelo não tem: texto acima do título, faixa escura do protocolo, quadrado preenchido das seções, campos `TIPO`, `MUNICÍPIO`, `UNIDADE`, `VETERINÁRIO(A)`, `OBSERVAÇÕES`, subtítulo `Condições e compromissos…` e faixa `PROTOCOLO DE REFERÊNCIA`.
- Corrigir a sobreposição do título do grupo com a primeira cláusula (bug atual).

**Receita (`prescription-pdf.ts`, `prescription-dialog.tsx`, `process-modal.tsx`)**

- Topo: `Dr(a). {nome}` (negrito dark, ≈ 12 pt). Se o nome já começar com `Dr.`, `Dra.` ou `Dr(a).`, não repetir o prefixo.
- Título `RECEITUÁRIO VETERINÁRIO`.
- Tabela com fundo tint, sem caixas: linha 1 `TUTOR(A)`, `PET`, `PROTOCOLO`; linha 2 `ESPÉCIE / RAÇA`, `SEXO`, `PESO` (`12,4 kg`), `MICROCHIP`.
- `PRESCRIÇÃO:` seguida do texto livre, mantendo as quebras de linha, sem linhas pautadas.
- `{Cidade}/{UF}, {data por extenso}.` à direita, em cinza.
- Assinatura centralizada: fio, `Dr(a). {nome}` em negrito, `{registro} · Assinatura do profissional` em cinza.
- Faixa: `PROTOCOLO`, `DATA DE EMISSÃO` (`issuedAt`), `Nº DO DOCUMENTO` (`prescription.number`).
- O diálogo salva primeiro e gera o PDF com a receita **devolvida pelo servidor** (número e `issuedAt` do servidor). Para isso, `onSave` / `act` / `onProcedureAction` passam a devolver o pedido atualizado (ou a receita gravada) em vez de só `true/false`. Receita sem mudança: baixa o PDF da receita salva, sem salvar de novo.
- Remover: a linha `Médico(a)-veterinário(a) · CRMV`, o texto `DOCUMENTO CLÍNICO / USO VETERINÁRIO`, as 13 linhas pautadas (`rowCount`, `rowHeight`).

**Troca de tutor, óbito e denúncia (novos geradores em `src/features/municipal-documents/`)**

- Mesmo padrão, com o município do pedido, título do documento e as mesmas seções e campos de hoje (ver os geradores atuais no `App.tsx` antes de apagar): dados da solicitação, tutor atual/novo tutor, animal, registro de óbito, denunciante, relato.

**Prontuário do animal**

- Novo gerador no padrão municipal, com o mesmo conteúdo de hoje (dados do animal, tutor, resumo, linha do tempo do histórico, receitas). A montagem dos dados (`resolveProntuarioData`) sai do `App.tsx` junto.
- Os 3 pontos que geram o prontuário passam a enviar o município do animal/pedido: `downloadAnimalRecordPdf` (área do tutor), o botão do `TutorDashboard` e `generateAndDownloadProntuario`.
- Sem leitura de `workflow.attendancePrescription`, `workflow.attendanceProcedure` e `workflow.cancelNote` (nada grava mais esses campos).

**Relatório do processo (`src/features/process-report/process-report-pdf.ts`)**

- `generateProcessReportPdf` sai do `App.tsx`: requerimento, tramitação (páginas no padrão municipal, faixa `PROTOCOLO` + `DATA DE EMISSÃO`), anexos (PDF e imagem como hoje), página "anexo sem prévia" no padrão municipal e receitas (`appendPrescriptionPdf`).
- `issuedPrescriptions` / `reportPrescriptions` perdem o parâmetro da receita antiga (`legacyText`) e o item `legacy`.
- `prepareProcessDocumentPreview` sai do `App.tsx` para um módulo próprio (ex.: `src/features/process-report/process-document-preview.ts`).

**Formulário público — botão "Ler" da declaração**

- Conforme a pergunta 3 (recomendado: abrir a declaração em texto num diálogo na tela, com o mesmo texto do PDF, porque PDF embutido não abre na maioria dos celulares Android).

**Tela de detalhe do tutor (`TutorDashboard`)**

- Receitas sem o item `legacy` e sem `attendanceProcedure` / `attendancePrescription`.

**Saídas do `App.tsx` (fim das importações circulares)**

- `App.tsx` passa a exportar só o `App`. Movem para módulos próprios, levando as dependências que só eles usam:
  - `ToastContainer` (usado por `src/features/agenda.tsx`) → `src/components/`
  - `DocumentPreviewModal` (usado por `process-modal.tsx`) → `src/components/`
  - `AiAnalysisDetails` (usado por `attachments-tab.tsx`) → módulo da análise de documentos
  - `PublicSchedulePicker` (usado por `reschedule-dialog.tsx`) → módulo da agenda pública
  - `userBelongsToSector` (usado por `process-dialogs.tsx`) → `src/domain.ts` ou módulo de setores
  - `generateProcessReportPdf`, `prepareProcessDocumentPreview` → como descrito acima

**Código fora do lugar**

- `shared/request-declaration-contract.js` → `src/features/request-document/` (só o frontend usa). O teste `backend/test/request-declaration-contract.test.js` vira teste vitest ao lado.
- `src/features/process-report/print-html.ts` → `src/features/reports/` (só a tela Relatórios usa).
- Helpers de imagem genéricos de `src/features/adoption-share/compress-adoption-photo.ts` (`loadImage`, `fittedSize`, `readAsDataUrl`, `dataUrlBytes`) → módulo neutro (ex.: `src/features/images/image-data.ts`), usado por adoção, denúncia, município e documentos.
- Comentário desatualizado em `src/features/registered-animals/use-request-options.ts` (fala da secretaria na declaração).

### Backend

- **Numeração:**
  - `shared/document-number-contract.js`: `DocumentSequence = Object.freeze({ PROTOCOL: "protocol", PRESCRIPTION: "prescription" })` e a formatação `000001/2026`.
  - `backend/src/repositories/document-numbers.js`: `nextDocumentNumber(client, { municipalityId, sequence })`, upsert atômico em `document_counters` (`INSERT … ON CONFLICT (municipality_id, sequence, year) DO UPDATE SET next_seq = document_counters.next_seq + 1 RETURNING next_seq - 1`), ano pelo horário de Brasília; erro se não houver município.
  - Protocolo: substituir as duas cópias de `nextProtocol` (`backend/src/routes/requests.js` e `backend/src/routes/animals.js`) pelo repository, nos 3 pontos que criam pedido (pedido; óbito e troca de tutor em `animals.js`), sempre com o município do pedido resolvido no servidor.
  - Receita: em `procedure-action-handler.js`, quando a ação for `ProcedureAction.PRESCRIPTION`, gerar o número dentro da transação (o pedido já está travado por `lockRequestForUpdate`) e passá-lo a `applyProcedureAction`, que grava `prescription = { …input, number, issuedAt, issuedBy }`. Receita salva de novo recebe número novo. A resposta devolve o pedido atualizado.
- **Aceite:**
  - Criação (`requests.js`): `signed_at` só quando o pedido é web, de procedimento e com `declarationAccepted === true` (data do servidor); em todos os outros casos `null`. Não ler `signed_at`/`signedAt` nem `signature_data_url`/`signatureDataUrl` do corpo.
  - Edição genérica (`PATCH`): tirar `signed_at` e `signature_data_url` dos campos permitidos e do mapa camelCase → snake_case; remover `parseSignedAt` se ficar sem uso.
  - `animals.js`: tirar `signature_data_url` do `SELECT` e da resposta do histórico.
- **Sem uso / uso único:** ver "O que será removido".

### Banco de dados

- Mudanças **no esquema base** `backend/src/db/migrations.js` (exceção à regra do AGENT.md de não editar migration aplicada, justificada porque os dois bancos serão recriados do zero; confirmar pergunta 1):
  - Trocar `request_protocol_counters` por `document_counters (municipality_id UUID NOT NULL REFERENCES municipalities(id), sequence TEXT NOT NULL CHECK (sequence IN ('protocol', 'prescription')), year INT NOT NULL, next_seq INT NOT NULL DEFAULT 1, PRIMARY KEY (municipality_id, sequence, year))`.
  - Protocolo único por município: tirar `UNIQUE` de `protocol` no `CREATE TABLE requests` e no `ALTER TABLE requests ADD COLUMN IF NOT EXISTS protocol`; trocar `requests_protocol_unique_idx` por `requests_municipality_protocol_unique_idx ON requests (municipality_id, protocol) WHERE protocol IS NOT NULL`. Atenção: o boot roda `CREATE UNIQUE INDEX IF NOT EXISTS` a cada início; o índice global precisa sair do arquivo, senão volta.
  - Tirar `signature_data_url` do `CREATE TABLE requests` e do `ALTER TABLE requests ADD COLUMN IF NOT EXISTS signature_data_url`.
- Nenhum SQL novo em `backend/src/db/sql/` (se a pergunta 1 for "não", criar `backend/src/db/sql/20261122-document-numbers.sql` com as mesmas mudanças e manter o boot coerente).
- Os SQL existentes continuam sendo aplicados em ordem depois do boot num banco novo.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

- Nenhuma variável nova. Sem mudança de build, start, portas ou Render.
- Ordem obrigatória em produção: apagar o esquema → deploy → SQL em ordem (fase 5). Um banco não recriado ficaria com protocolo único global e a coluna antiga.

---

## Arquivos provavelmente afetados

- `src/features/municipal-documents/` (base, cabeçalho, blocos, nomes dos estados, geradores de troca de tutor, óbito, denúncia e prontuário) — arquivos novos e alterados
- `src/features/request-document/request-requirement-pdf.ts` (+ teste), `request-acceptance.ts` (+ teste), `request-declaration.ts` (+ teste, vindo de `shared/`)
- `src/features/process-modal/prescription-pdf.ts`, `prescription-pdf.test.ts` (novo, no lugar de `prescription-print.test.tsx`), `prescription-dialog.tsx`, `process-modal.tsx`, `use-attachment-actions.ts`, `process-dialogs.tsx`, `reschedule-dialog.tsx`, `attachments-tab.tsx`
- `src/features/process-report/process-report.ts` (+ teste), `process-report-pdf.ts` (novo), `process-document-preview.ts` (novo)
- `src/features/reports/print-html.ts` (movido), `src/features/reports.tsx`
- `src/features/agenda.tsx`, `src/components/` (componentes movidos do `App.tsx`)
- `src/features/adoption-share/compress-adoption-photo.ts`, `src/features/complaint/complaint-photo.ts`, `src/features/municipality-form/municipality-image.ts`, módulo novo de imagem
- `src/features/registered-animals/request-payload.ts`, `use-request-options.ts`
- `src/domain.ts` (`signatureDataUrl`)
- `src/App.tsx` _(arquivo grande: só os trechos citados em "Leitura de contexto"; perde cerca de 1.100 linhas)_
- `src/styles.css` (classes do Anexo A)
- `tsconfig.json` (`noUnusedLocals`)
- `shared/document-number-contract.js` (novo), `shared/request-declaration-contract.js` (sai), `shared/whatsapp-templates-contract.js`
- `backend/src/db/migrations.js`
- `backend/src/repositories/document-numbers.js` (novo)
- `backend/src/routes/requests.js`, `backend/src/routes/animals.js`
- `backend/src/services/procedure-actions/procedure-action-apply.js`, `procedure-action-handler.js`
- `backend/src/middleware/auth.js`, `backend/src/tenant.js`, `backend/src/services/breed-defaults.js`, `request-type-defaults.js`, `municipality-location.js`
- `backend/scripts/` (sai), `backend/src/services/integration-permission-defaults.js` (sai)
- `backend/test/*` correspondentes

---

## O que será removido

- **Estilo antigo de PDF no `App.tsx`:** `drawProntuarioHeader`, `drawProntuarioSectionTitle`, `drawAnimalRecordHeader`, `drawProntuarioFields`, `drawProntuarioSummaryCards`, `drawProntuarioTimeline`, `ANIMAL_RECORD_COLORS`, `hexToRgbTuple`, `getPdfColors`, `createPdfDocContext`, `pdfText`, `wrapPdfText`, `drawRequestPdfFooter`, o tipo `PdfRgbFn`.
- **Geradores antigos no `App.tsx`** (reescritos nos módulos novos): `createTutorTransferPdfDataUrl`, `createDeathRegistrationPdfDataUrl`, `createComplaintPdfDataUrl`, `generateProntuarioPdf`, `resolveProntuarioData`, `appendProcessTextPages`, `appendUnsupportedAttachmentPage`, `appendPdfDataUrl`, `appendImageDataUrl`, `generateProcessReportPdf`, `prepareProcessDocumentPreview`, `createRequestPdfDataUrl` (vira função do módulo de documentos), e os imports que ficarem órfãos (`A4_PAGE_SIZE`, `importPdfLib`, `renderDeclaration` etc.).
- **Layout do Codex que o modelo não tem:** textos acima dos títulos (`SOLICITAÇÃO DE ATENDIMENTO / DOCUMENTO MUNICIPAL`, `TERMO INTEGRANTE DO REQUERIMENTO`), faixa escura `PROTOCOLO ÚNICO DA SOLICITAÇÃO`, quadrado preenchido das seções, campos `TIPO`/`MUNICÍPIO`/`UNIDADE`/`VETERINÁRIO(A)`/`OBSERVAÇÕES`, subtítulo e faixa `PROTOCOLO DE REFERÊNCIA`, cabeçalho `PROGRAMA MUNICIPAL DE CASTRAÇÃO ANIMAL` / `EMITIDO EM`, fio do rodapé, campos em caixa (`drawMunicipalPdfFields` atual), na receita `designation`, `professionalDetails`, `rowCount`, `rowHeight`.
- **Teste quebrado:** `src/features/process-modal/prescription-print.test.tsx` (importa o arquivo apagado `prescription-print.ts`).
- **Aceite e assinatura antigos:** coluna `requests.signature_data_url` (no esquema base), leitura de `signature_data_url`/`signatureDataUrl` nas rotas, no `domain.ts` e no `request-payload.ts`; `signed_at`/`signedAt` vindo do navegador (criação e `PATCH`), `signedAt: ""` enviado pelo cadastro interno; `RequestAcceptance.UNRECORDED`.
- **Numeração antiga:** tabela `request_protocol_counters`, as duas funções `nextProtocol` nas rotas, `UNIQUE` global de `requests.protocol` e o índice `requests_protocol_unique_idx`.
- **Campos antigos lidos:** `workflow.attendancePrescription`, `workflow.attendanceProcedure`, `workflow.cancelNote`; parâmetro `legacyText` e item `legacy` de `issuedPrescriptions`/`reportPrescriptions`; rótulo `id === "legacy"` no `TutorDashboard`.
- **Código sem uso (frontend):** as 86 declarações apontadas por `tsc --noUnusedLocals` (imports, estados e funções como `patchSector`, `deleteSector`, `patchTeamUser`, `patchPermissionGroup`, `patchDocumentType`, `deleteDocumentType`, `deleteListItem`, `toggleRequestDocument`, `agendaLocationStatus`, `matchesAdoptionSearch`, estados de agenda nunca lidos). Antes de apagar cada função `patch*`/`delete*`, conferir que nenhuma tela deveria chamá-la e listar no resumo da implementação.
- **Exports mortos:** `YesNoField` (`src/components/ui.tsx`), tipo `Neighborhood` (`src/features/neighborhoods/neighborhoods.ts`), `isSpecialRequestType` (`src/features/request-analysis-sections.tsx`), `WHATSAPP_DEFAULT_LANGUAGE` (`shared/whatsapp-templates-contract.js`), `requireGlobal` (`backend/src/middleware/auth.js`), `getRoleLevel` (`backend/src/tenant.js`), `MUNICIPALITY_LOCATION_FIELDS` (`backend/src/services/municipality-location.js`), `SPECIES_CONFIG_KEY` (`backend/src/services/breed-defaults.js`, depois de sair o script).
- **Só usados por testes:** `procedureNames` (`src/features/request-procedures/request-procedures.ts`, sobra da declaração antiga em HTML) e `formatMunicipalityAddress` (`src/features/municipality-form/municipality-address.ts`), com os casos de teste deles.
- **Cargas de uso único (sem município antigo depois do reset):** pasta `backend/scripts/` inteira (`add-default-request-types.js`, `add-integration-permissions.js`, `seed-default-breeds.js`, `config-store.js`), `backend/src/services/integration-permission-defaults.js`, `planBreedSeed` (`breed-defaults.js`), `planDefaultRequestTypes` (`request-type-defaults.js`) e os testes deles (`backend/test/integration-permission-defaults.test.js` e os casos de `plan*` em `breed-defaults.test.js` e `default-request-types.test.js`; manter os casos que cobrem funções ainda usadas).
- **CSS sem uso:** as classes do Anexo A, em `src/styles.css`. Ao remover, tirar só o seletor morto de listas de seletores; manter regras que ainda têm seletor usado. Não remover as classes montadas por código (`status-*`, `is-*`, `*--variante`, `whatsapp-link-var--*` etc.) nem as do Recharts.
- **Movidos (não apagados):** ver "Saídas do `App.tsx`" e "Código fora do lugar".

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

**Antes de começar:** confirmar com o usuário as perguntas em aberto 1, 2 e 3 (afetam esquema, conteúdo da página 2 e o botão "Ler").

**Fase 1 — Numeração e aceite (commit 1, `feat:`)**

1. Criar `shared/document-number-contract.js` e `backend/src/repositories/document-numbers.js`.
2. Ajustar o esquema base em `migrations.js` (contadores, protocolo por município, sem `signature_data_url`).
3. Trocar `nextProtocol` pelo repository em `requests.js` e `animals.js` (3 pontos), com o município resolvido no servidor.
4. Gerar o número da receita na transação da ação `PRESCRIPTION` e devolver o pedido atualizado.
5. Aceite: `signed_at` só pelo servidor; tirar `signature_data_url` e `signed_at` da criação e do `PATCH`; ajustar `animals.js`.
6. Testes do backend da fase.

**Fase 2 — Documentos (commit 2, `feat:`)**

7. Base comum: contexto, cabeçalho, rodapé, blocos, paginação, nomes dos estados, nome de arquivo, import único do pdf-lib.
8. Requerimento (web, balcão e prévia), com a declaração movida para `src/features/request-document/`.
9. Receita e diálogo (PDF a partir da receita do servidor).
10. Troca de tutor, óbito e denúncia.
11. Prontuário (+ município nos 3 pontos).
12. Relatório do processo e prévia de documentos do processo fora do `App.tsx`.
13. Botão "Ler" conforme a pergunta 3; `TutorDashboard` sem campos antigos.
14. Testes do frontend da fase.

**Fase 3 — Limpeza (commit 3, `refactor:`)**

15. Mover `ToastContainer`, `DocumentPreviewModal`, `AiAnalysisDetails`, `PublicSchedulePicker` e `userBelongsToSector` para módulos próprios; `App.tsx` exporta só o `App`.
16. Mover `print-html.ts` e os helpers de imagem; corrigir o comentário de `use-request-options.ts`.
17. Ativar `"noUnusedLocals": true` no `tsconfig.json` e remover tudo o que o compilador apontar.
18. Remover exports mortos, funções só de teste, cargas de uso único e CSS do Anexo A.
19. Se a pergunta 5 for "sim", apagar os planos já implementados em `.plans/` (manter este plano até o fim da implementação).

**Fase 4 — Validação**

20. Rodar uma vez, ao final: `npm run typecheck`, `npm test`, `node --test backend/test/*.test.js`, `npm run build`.
21. Gerar os PDFs com dados falsos (script temporário com `vite-node`, fora do repositório) e comparar com os modelos.
22. Varrer o diff por token, ID de conta e telefone antes de cada commit.

**Fase 5 — Reset dos bancos (só com ordem explícita do usuário, primeiro o local, depois a produção)**

23. Local (`localhost:5433`): `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` → reiniciar o back (o boot cria a base e o master) → aplicar os `backend/src/db/sql/*.sql` em ordem de nome. Fica só o master, com a senha mantida.
24. Produção: confirmar o estado do banco → apagar o esquema → deploy deste commit → aplicar os SQL em ordem. Depois o usuário recria pela tela: município Içara e gestor, IDs de template do EmailJS, SMS, `WHATSAPP_TOKEN_ICARA` no WhatsApp de Içara e contratos; na Meta, os templates.

---

## Regras de negócio identificadas

- Protocolo e receita são numerados por município e por ano, começando em `000001`, no formato `000001/2026`, sem prefixo.
- Cada salvamento de receita gera um número novo e uma nova data de emissão.
- Pedido web de procedimento exige o aceite da declaração; a data do aceite é a do servidor no momento do envio e não pode ser alterada depois.
- Pedido de balcão não tem aceite eletrônico; o requerimento leva a linha de assinatura do tutor em papel (confirmar pergunta 2).
- A declaração é a do modelo (9 cláusulas em 2 grupos + orientações), sem cláusula de taxa; cita o município do pedido e "sem ônus para a Prefeitura".
- Sem brasão ou logo, o espaço fica vazio; linha do cabeçalho sem dado é omitida.
- "MODELO ILUSTRATIVO" não aparece nos documentos.
- O relatório gerencial não muda.

---

## Regras multi-tenant e segurança

- O município da numeração vem sempre do pedido gravado (ou do animal) resolvido no servidor, nunca do corpo da requisição.
- Unicidade do protocolo por `(municipality_id, protocol)`. Consultas públicas e links de acesso já buscam por município + protocolo (`request-access.js`, `request-tracking.js`, `buildAccessPath`). Conferir que a lista de pedidos do admin global mostra o município junto do protocolo.
- O contador é atualizado por upsert atômico dentro da transação que cria o pedido ou salva a receita (sem corrida entre requisições).
- `signed_at` deixa de ser aceito do navegador em qualquer rota.
- PDFs são gerados no navegador com o município do próprio pedido (`getPrescriptionMunicipality` e equivalentes), nunca com o município ativo da tela quando forem diferentes.
- Procedimentos e receitas continuam protegidos contra o `PATCH` genérico (`protectStoredProcedures`).

---

## Validações necessárias

- `nextDocumentNumber` recusa chamada sem município.
- Criação de pedido: sem município resolvido, não gera protocolo (erro claro, sem gravar).
- Receita: as validações atuais de texto, nome e registro continuam (`procedure-action-input.js`).
- `PATCH`: `signed_at` e `signature_data_url` enviados são ignorados.

---

## Testes necessários

### Frontend

- Base municipal: cabeçalho com Estado, Prefeitura e secretaria; sem brasão/logo não quebra; faixa com 2 e com 3 itens; rodapé em todas as páginas; quebra de página repete o cabeçalho (requerimento com 4 animais).
- Requerimento web: textos das 2 páginas, data/horário, link do local, idade em anos, peso com vírgula, procedimentos, declaração do modelo e bloco de aceite com `signed_at`.
- Requerimento de balcão: sem bloco de aceite, com linha de assinatura (conforme pergunta 2).
- Prévia: `A gerar após o envio` e `Aceite eletrônico pendente.`
- Receita: `Dr(a).` sem repetir prefixo, número na faixa, peso `12,4 kg`, local e data por extenso.
- Troca de tutor, óbito, denúncia e prontuário: título, faixa e campos principais.
- `requestAcceptance`: web → eletrônico com `signed_at`; interno → balcão.
- `issuedPrescriptions` sem o item antigo.
- Declaração (vitest, vindo do backend): grupos, numeração e nome do município.
- Nome de arquivo sem barra.

### Backend

- `nextDocumentNumber`: sequências independentes por município, por tipo e por ano; formato `000001/2026`; erro sem município.
- Protocolo igual em dois municípios é aceito; repetido no mesmo município não.
- Ação `PRESCRIPTION`: grava `number`, `issuedAt` e `issuedBy`; salvar de novo gera número novo.
- Criação: `signed_at` só em pedido web de procedimento com aceite; corpo com `signed_at`/`signature_data_url` é ignorado.
- `PATCH`: `signed_at` e `signature_data_url` não são alterados.

### Conferência manual (tela)

- Baixar e comparar com os modelos: requerimento (web e balcão), prévia do "Ler", receita, troca de tutor, óbito, denúncia, prontuário e relatório do processo.
- Conferir brasão e logo de um município com as duas imagens e de um sem imagens.
- No celular: o "Ler" do formulário público mostra a declaração.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

---

## Riscos e pontos de atenção

- **Reset de produção:** apaga tudo de forma irreversível; só com ordem explícita, depois de conferir o estado do banco.
- **Esquema base editado:** banco não recriado fica com protocolo único global e coluna antiga; o reset precisa acompanhar o deploy.
- **Alterar migrations antigas:** exceção pedida na pergunta 1; se negada, usar SQL novo e manter o boot coerente (o índice global precisa sair do `migrations.js` de qualquer forma).
- **Contrato frontend/backend:** a ação de procedimento passa a devolver o pedido atualizado; o diálogo da receita depende disso.
- **CSS:** remover só o que nenhum código menciona; classes montadas por código ficam.
- **Funções `patch*`/`delete*` órfãs:** podem ser telas que deveriam estar ligadas; listar antes de apagar.
- **Diff grande no `App.tsx`:** dividido em 3 commits.
- **PDF no navegador:** geração continua no cliente (sem custo no Render); WEBP depende de canvas.
- **Commit e push direto em `main`**, sem `staging`.

---

## Perguntas em aberto

Confirmar no início do `/implementar` (o plano foi aprovado com estas respostas pendentes; entre parênteses, a recomendação):

1. Esquema base: a numeração e a remoção de `signature_data_url` vão direto no `migrations.js`, como exceção à regra do AGENT.md, já que os dois bancos serão recriados? (Recomendado: sim.)
2. Balcão: o requerimento leva a declaração com a linha de assinatura em papel, sem aceite eletrônico, ou sai sem a declaração? (Recomendado: com a declaração e a linha de assinatura, como respondido antes.)
3. "Ler" no formulário público: mostrar a declaração em texto num diálogo na tela ou manter a prévia do requerimento em PDF? (Recomendado: texto na tela.)
4. Compatibilidade com dados antigos, esquema único do banco, CSS duplicado e organização de pastas ficam para um plano seguinte? (Recomendado: sim.)
5. Apagar os planos já implementados em `.plans/`? O `reescrita-completa-sistema.md` nunca foi executado: manter ou apagar?

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- Os 8 documentos saem no padrão municipal, conferidos contra os modelos (requerimento e receita) e entre si (os demais).
- Protocolo e receita são numerados por município e ano, sem prefixo, e a receita mostra o número na faixa.
- A data do aceite só é gravada pelo servidor e aparece no requerimento web; o requerimento de balcão sai conforme a pergunta 2.
- `App.tsx` não gera PDF e não exporta nada além do `App`; nenhum módulo importa de `App.tsx`.
- `noUnusedLocals` ativo e typecheck limpo; nada da seção "O que será removido" sobra no código.
- `npm run typecheck`, `npm test`, `node --test backend/test/*.test.js` e `npm run build` sem erros.
- Os 3 commits enviados para `main`; o reset feito só com ordem do usuário.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations nem o reset sem confirmação explícita, e nunca rodar SQL de produção sem ordem do usuário no momento.
- Seguir `/AGENT.md`.
- Manter cada arquivo novo dentro do tamanho recomendado (até 250 linhas); dividir se passar.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
- Ler os geradores antigos do `App.tsx` antes de apagá-los, para não perder campos nem seções.
- Arquivos do repositório misturam CRLF e LF; a ferramenta Edit preserva o fim de linha.

---

## Anexo A — classes CSS sem uso em `src/styles.css` (227)

Levantamento de 2026-11-22: classes definidas no `styles.css` que nenhum arquivo de `src/` nem o `index.html` menciona. Ficaram de fora as classes criadas pelo Recharts (`recharts-*`) e as 54 que podem ser montadas por código (`status-*`, `is-*`, `*--variante`, `whatsapp-link-var--*`, `ag-badge--*`, `tc-result-badge--*` etc.). Conferir cada uma com uma busca antes de apagar.

`access-field`, `access-field-icon`, `access-metrics-grid`, `admin-calendar-day`, `admin-calendar-grid`, `adoption-card-actions`, `adoption-card-description`, `adoption-card-header`, `adoption-card-meta`, `adoption-clear-filters`, `adoption-command-copy`, `adoption-command-header`, `adoption-command-stats`, `adoption-control-panel`, `adoption-empty-showcase`, `adoption-filter-rail`, `adoption-health-list`, `adoption-hero`, `adoption-hero-copy`, `adoption-hero-filters`, `adoption-hero-stats`, `adoption-search-box`, `adoption-toolbar`, `adoption-toolbar-left`, `ag-nav`, `ag-nav-today`, `ag-occ-label`, `ag-search`, `ag-side-head`, `aguardando_cirurgia`, `aguardando_triagem`, `ai-config-grid`, `arquivada`, `attachment-card`, `billing-method-field`, `brand-sub`, `btn-secondary`, `calendar-month-header`, `card-title-row`, `charts-grid`, `checkbox-row`, `compact-grid`, `config-card`, `config-management-bar`, `config-section-actions`, `cons-body`, `cons-brasao-hero`, `cons-fields-row`, `cons-hero`, `cons-hero-icon`, `cons-metric`, `cons-metric-sep`, `cons-metrics`, `cons-search-card`, `cons-service-card`, `cons-service-cards`, `cons-services`, `cons-services-label`, `cons-submit-btn`, `cons-subtitle`, `cons-title`, `cons-topbar`, `cons-topbar-inner`, `consultation-brasao`, `consultation-card`, `consultation-card-header`, `consultation-card-location`, `consultation-card-topline`, `consultation-inline-metrics`, `consultation-mun-id`, `consultation-mun-name`, `consultation-search-row`, `consultation-stack`, `consultation-submit`, `consultation-title-brasao`, `consultation-title-row`, `consultation-topnav-brasao`, `cr-badge`, `cr-controls-row`, `cr-kpi-chip`, `cr-label`, `cr-modal`, `cr-modal-actions`, `cr-modal-close`, `cr-nav`, `cr-note-field`, `cr-root`, `cr-seg-count`, `cr-stats-row`, `cr-step-label`, `cr-stepper`, `cr-table`, `cr-title`, `cr-toolbar`, `cr-value`, `danger-action`, `danger-soft`, `dashboard-hero-card`, `dashboard-hero-copy`, `dashboard-hero-metrics`, `dashboard-tabs`, `deferida`, `detail-card`, `detail-stack`, `detail-title`, `document-upload-card`, `document-upload-title`, `em_analise`, `fee-note`, `field-label`, `form-field`, `global-search`, `help-text`, `hero-panel`, `icon-btn-flat`, `icon-button`, `indeferida`, `info-box`, `inline-create-row`, `inline-microchip-fields`, `interest-item`, `interest-item-header`, `interests-list`, `internal-adoption-filters`, `invalid-block`, `irm-back-btn`, `irm-body`, `irm-footer`, `irm-form`, `irm-next-btn`, `irm-section-label`, `irm-step-count`, `irm-subsection-label`, `login-brand`, `maps-location-modal`, `modal-header-subtitle`, `modal-header-title`, `municipality-brasao-placeholder`, `municipality-brasao-thumb`, `notification-template-fields`, `page-actions`, `page-subtitle`, `page-title`, `pet-video-shade`, `pet-welcome-video`, `prescription-btn-row`, `prescription-emit-btn`, `prescription-saved-badge`, `prm-lookup-actions`, `prm-lookup-animal-card`, `prm-lookup-animal-icon`, `prm-lookup-animal-info`, `prm-lookup-chip`, `prm-lookup-event`, `prm-lookup-event-body`, `prm-lookup-event-dot`, `prm-lookup-event-meta`, `prm-lookup-event-title`, `prm-lookup-field`, `prm-lookup-form`, `prm-lookup-heading`, `prm-lookup-hero`, `prm-lookup-history`, `prm-lookup-history-head`, `prm-lookup-history-list`, `prm-lookup-no-history`, `prm-lookup-pdf-btn`, `prm-lookup-pdf-row`, `prm-lookup-result`, `prm-lookup-sep`, `prm-lookup-shell`, `prm-lookup-status-badge`, `prm-lookup-tutor-card`, `process-flow-card`, `process-history-card`, `process-history-card-head`, `process-history-dot`, `process-history-node`, `process-history-tree`, `process-work-modal`, `public-adoption-highlight-badge`, `public-animal-meta`, `public-back-button`, `public-request-detail-grid`, `public-request-detail-hero`, `public-request-detail-history`, `report-card`, `request-card`, `request-card-actions`, `request-card-main`, `request-card-meta`, `request-context-bar`, `request-list`, `request-page-head`, `request-preview-modal`, `request-type-card`, `request-type-grid`, `request-type-summary`, `schedule-config-row`, `schedule-confirm-card`, `schedule-picker-header`, `schedule-rule-row`, `schedule-slot-card`, `selected-schedule-note`, `settings-grid`, `simple-stack`, `stat-card`, `summary-card`, `summary-row`, `team-item`, `team-user-create`, `toggle-row`, `toggle-switch`, `toggle-thumb`, `toggle-track`, `toolbar`, `topbar-context-chip`, `topbar-quota-card`, `tutor-auth-form`, `tutor-screen`, `tutor-screen--full`, `validation-key-card`, `weekday-toggle-row`, `workflow-grid`, `workflow-item`, `workspace-heading`, `workspace-heading-main`
