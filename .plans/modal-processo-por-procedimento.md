# Plano de Implementação: Modal do processo por animal e procedimento

## Origem

- Arquivo de especificação: escopo "Reestruturação da tela de processos" colado no chat, com 2 imagens de protótipo (aba Anexos e aba Procedimento e saúde) — as regras dele estão transcritas em "Regras de negócio identificadas"
- Data do planejamento: `2026-11-18`
- Classificação: `fullstack` (frontend + backend; sem SQL novo — o estado dos procedimentos vive no JSONB `requests.animals`, que já existe)

---

## Resumo

O modal do processo (`RequestPreviewModal`, [App.tsx:3958](../src/App.tsx#L3958), ~930 linhas) é refeito em `src/features/process-modal/`, com os componentes e classes atuais. Hoje status e agenda são do processo inteiro; o escopo exige que **cada procedimento de cada animal** tenha status, agenda e dados de execução próprios. Por isso o estado passa a ser guardado por procedimento dentro de `animals[i].procedures`, uma rota nova executa as ações de um único procedimento e o status geral do processo é **derivado** dos procedimentos, para listagem, filtros, painel, agenda e avisos continuarem funcionando.

Perguntas do plano preliminar sem resposta: assumidas as recomendações (ver "Decisões assumidas").

---

## Escopo

### Dentro do escopo

- Cabeçalho compacto: `PROCESSO <protocolo>`, título, "Tutor: <nome> · N animais", status geral, Relatório, Fechar.
- Abas na ordem Anexos → Procedimento e saúde → Dados do tutor; abre sempre em Anexos; todas navegáveis.
- Aba Anexos: lista compacta, Visualizar/Baixar, Deferir, Solicitar ajuste (com justificativa), Anexar evidência, documento do sistema identificado e sem decisão, aviso de pendência documental, contador de pendências na aba.
- Aba Procedimento e saúde: seletor de animais (nome + nº de procedimentos), lista lateral de procedimentos (nome, data, status), detalhe do procedimento (microchip só em Microchipagem), Saúde do animal (doenças e alergias, uma abaixo da outra, largura total).
- Rodapé fixo por aba e status; janelas de Reagendar, Indeferir (justificativa obrigatória), Solicitar ajuste, Receita.
- Ações por procedimento: Salvar alterações, Reagendar, Confirmar agenda, Confirmar atendimento, Não compareceu, Indeferir, Emitir receita.
- Dados do tutor com o botão "Salvar dados do tutor" no rodapé.
- Atribuir/Assumir continuam do processo.
- Layout responsivo; rolagem só no conteúdo.

### Fora do escopo

- Assinatura digital e integrações profissionais da receita.
- Reenvio de documento pelo tutor no acompanhamento (a justificativa do ajuste vai no aviso e no histórico).
- Avisos novos por procedimento (os avisos seguem a mudança do status geral).
- Tela de Agenda por procedimento (continua listando o processo, pela data derivada).
- Painéis de indicadores, seções ou campos não pedidos.

---

## Leitura de contexto

- `/AGENT.md`, `.claude/skills/planejar/SKILL.md`
- `src/App.tsx` (3958–4887: `RequestPreviewModal`; 5060+: `PrescriptionModal` e `buildPrescription*`; 3883: montagem do modal)
- `src/features/request-actions.ts`, `src/features/tutor-data/tutor-data-tab.tsx`, `src/features/registered-animals/document-review-decisions.ts`, `src/features/request-procedures/request-procedures.ts`
- `backend/src/routes/requests.js` (PATCH 268–477), `backend/src/services/request-procedures.js`, `backend/src/services/schedule/schedule-booking.js`, `backend/src/repositories/schedule-availability.js`, `backend/src/services/documents/document-reviews.js`, `backend/src/services/request-change-notifications.js`, `backend/src/services/registered-animals/from-request.js`
- `shared/request-contract.js`, `shared/request-types-contract.js`, `shared/schedule-contract.js` (`allocateScheduleAvailability`), `shared/notification-contract.js`, `shared/document-reuse-contract.js`
- `backend/src/db/migrations.js` (tabela `requests`)

---

## Impacto por área

### Frontend

Pasta nova `src/features/process-modal/` (um arquivo, uma responsabilidade; até ~200 linhas cada):

- `process-modal.tsx` — casca: cabeçalho, abas, corpo com rolagem, rodapé; tipos especiais (óbito, troca de tutor, denúncia) mantêm `getSpecialRequestSection` e suas ações atuais (confirmar especial, deferir denúncia, indeferir o processo) dentro do layout novo.
- `process-header.tsx` — título "Atendimento de animais" (nos especiais, o nome do tipo), "Tutor: X · N animais", `StatusBadge` do status geral, Relatório, Fechar.
- `attachment-rows.ts` — funções puras hoje dentro do modal: montar linhas (requerimento, foto, obrigatórios, extras), status, documento do sistema, pendência que bloqueia; testadas.
- `attachments-tab.tsx` — título "Conferência de documentos", "N pendente(s)", linhas com Visualizar (e Baixar), Deferir, Solicitar ajuste; caixa tracejada "Anexar evidência"; aviso "Pendência documental".
- `document-adjustment-modal.tsx` — justificativa obrigatória do ajuste.
- `animal-selector.tsx`, `procedure-list.tsx`, `procedure-detail.tsx`, `procedures-tab.tsx` — seletor de animais, lista lateral e detalhe (cabeçalho do procedimento com animal · espécie · sexo e status; microchip só para Microchipagem; Saúde do animal).
- `use-process-procedures.ts` — seleção de animal/procedimento, rascunho por animal (trocar de animal não perde nada), detecção de alterações não salvas, chamadas às ações e atualização do processo na tela.
- `procedure-api.ts` — cliente da rota nova (via `src/api.ts`).
- `process-footer.tsx` — rodapé por aba/status (abaixo).
- `reschedule-modal.tsx` — reagendamento atual (`PublicSchedulePicker` + `useScheduleAvailability`) em janela, para o procedimento selecionado, contando 1 vaga.
- `reject-modal.tsx` — indeferimento com motivo (lista `REJECTION_REASONS`) e justificativa obrigatória.
- `prescription-modal.tsx` — `PrescriptionModal` movido do App.tsx, com identificação do animal e procedimento, nome do profissional (preenchido com o usuário logado), registro profissional (digitado), prescrição e "Imprimir / PDF" (reusa `buildPrescriptionPrintHtml`, movido junto); salva no procedimento sem mudar o status.
- `unsaved-changes-notice` — aviso dentro do modal ao fechar com alterações não salvas (Salvar / Descartar / Continuar editando); nada de `window.confirm`.

Rodapé:

| Aba | Esquerda | Direita |
|---|---|---|
| Anexos | Atribuir, Assumir | texto de pendência ("Aguardando conferência dos anexos") + "Ver procedimentos →" |
| Procedimento e saúde | Não compareceu, Indeferir | Salvar alterações, Reagendar, Emitir receita, Confirmar agenda **ou** Confirmar atendimento |
| Dados do tutor | — | Salvar dados do tutor (`<button form="tutor-data-form">`, o form da aba ganha esse id e perde o botão interno) |

Botões por status do procedimento selecionado:

| Status | Ações |
|---|---|
| Aguardando | Salvar, Reagendar, Emitir receita, Indeferir, Confirmar agenda (bloqueado com pendência documental ou sem atribuição, com o motivo no `title`) |
| Agendado | Salvar, Reagendar, Emitir receita, Não compareceu, Indeferir, Confirmar atendimento |
| Realizado / Não compareceu / Indeferido | Emitir receita (consulta/reimpressão) e nada mais; campos somente leitura |

`readOnly` do modal continua valendo: sem ações e campos somente leitura.

Outros arquivos:

- `src/App.tsx` — apagar `RequestPreviewModal`, `isAnimalPhotoDocument`, `AttachmentRow`, `PrescriptionModal`, `getPrescriptionMunicipality`, `buildPrescription*` (movidos) e importar o modal novo em 3883 com as props que sobrarem.
- `src/features/request-actions.ts` — apagar as ações do processo substituídas (ver "O que será removido"); manter `assignFromPreview`, `assumeFromPreview`, `confirmSpecialRequest`, `updatePreviewTutor` e o que a listagem/agenda ainda usar; o processo atualizado devolvido pela rota nova substitui `previewRequest`.
- `src/features/tutor-data/tutor-data-tab.tsx` — `id` no form, botão sai da aba.
- `src/features/registered-animals/document-review-decisions.ts` — passa a montar uma decisão por vez, com `note` no ajuste (ou é apagado, se a chamada ficar direta no `attachments-tab`).
- `src/styles.css` — reutilizar `prm-*`, `field`, `ghost-button`, `primary-action`, `assign-modal*`, `attachment-status*`; corrigir as regras que decidem (sem regra por cima nem `!important` novo); apagar as classes que ficarem sem uso.

### Backend

- **Contrato novo `shared/request-procedure-contract.js`:**
  - `ProcedureStatus` congelado: `AGUARDANDO`, `AGENDADO`, `REALIZADO`, `NAO_COMPARECEU`, `INDEFERIDO`.
  - `ProcedureAction`: `SAVE`, `CONFIRM_SCHEDULE`, `ATTEND`, `NO_SHOW`, `REJECT`, `RESCHEDULE`, `PRESCRIPTION`.
  - Tabela de transições permitidas.
  - `resolveAnimalProcedures(request)` — leitura de compatibilidade: animal sem `procedures` ganha um por `requestTypeIds` (ou um pelo `request_type` do processo, nos antigos) com status e data vindos do processo: `NOVA`→Aguardando, `AGENDADA`→Agendado, `REALIZADA`→Realizado, `CANCELADA` com motivo "Não compareceu"→Não compareceu, demais `CANCELADA`→Indeferido.
  - `deriveRequestStatus(animals)` — algum Agendado → `AGENDADA`; senão algum Aguardando → `NOVA`; todos encerrados com algum Realizado → `REALIZADA`; senão `CANCELADA` (motivo "Não compareceu" se todos foram ausência, senão indeferido).
  - `deriveRequestSchedule(animals)` — a data/local/horário do procedimento aberto mais próximo vira `schedule_date` e `workflow_data.schedule*` do processo.
- **Rota nova `POST /api/requests/:id/procedures/action`** (arquivo próprio em `routes/`), corpo `{ animalIndex, requestTypeId, action, data }`; só equipe interna (`isInternalUser`), escopo pelo município do usuário (`tenant.js`), nunca pelo client.
- **Service novo `services/request-procedure-actions.js`:**
  1. Trava a agenda do município e o processo (`FOR UPDATE`).
  2. Valida a transição.
  3. Exige atribuição quando o processo é público (regra atual "atribua um setor e um usuário").
  4. Em `CONFIRM_SCHEDULE` e `RESCHEDULE`, exige documentos obrigatórios do processo regulares (aprovados; nenhum recusado ou faltando).
  5. Em `RESCHEDULE`, reserva 1 vaga para o animal na data/ocorrência/horário.
  6. Altera **só** `animals[animalIndex].procedures[requestTypeId]` e, em `SAVE`, a saúde (`doencas`, `alergias`) do mesmo animal.
  7. Grava histórico ("<procedimento> de <animal>: …"), recalcula status e agenda derivados, chama `applyAnimalRequestTransition` e, depois do commit, `notifyRequestChanges` (os avisos atuais disparam pela mudança do status geral e da data derivada).
- **Trecho comum do PATCH** (conexão, trava da agenda, `SELECT … FOR UPDATE` escopado, `UPDATE … RETURNING`, avisos pós-commit): extraído para uma função reutilizada pelas duas rotas, sem segundo padrão.
- **Agenda** (`shared/schedule-contract.js` `allocateScheduleAvailability`, `schedule-booking.js`):
  - A ocupação passa a vir dos procedimentos abertos (Aguardando/Agendado) via `resolveAnimalProcedures`: 1 vaga por animal em cada data+ocorrência+horário distinto.
  - Processos antigos continuam ocupando como hoje pela leitura de compatibilidade.
  - `reserveRequestSchedule` (criação do processo pelo formulário) grava a mesma data em todos os procedimentos novos.
  - `bookingChanged` considera a agenda dos procedimentos.
- **Documentos** (`document-reviews.js`): a decisão `rejected` aceita `note` obrigatória (texto, limite de tamanho), guardada em `review.note` e devolvida no processo.
- **PATCH genérico**: deixa de aceitar `status` e as chaves de agenda nos processos de procedimento que já têm `procedures` (essas mudanças passam pela rota nova), para que nada altere um procedimento por fora; os tipos especiais seguem pelo PATCH.

### Banco de dados

Sem tabela ou coluna nova. Os campos novos ficam no JSONB `requests.animals` (`procedures[]`, `doencas`, `alergias`) e em `documents[].review.note`. Os dados antigos não são reescritos: a leitura de compatibilidade monta os procedimentos na hora, e o primeiro salvamento grava o formato novo.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

O back local precisa ser reiniciado para ter a rota nova (só com ordem do usuário). Sem env nova.

---

## Arquivos provavelmente afetados

- `shared/request-procedure-contract.js` (novo), `shared/schedule-contract.js`, `shared/request-types-contract.js` (se `resolveAnimalProcedures` precisar de helpers dele)
- `backend/src/routes/requests.js` (PATCH e montagem da rota nova), `backend/src/routes/request-procedures.js` (novo)
- `backend/src/services/request-procedure-actions.js` (novo), `backend/src/services/schedule/schedule-booking.js`, `backend/src/services/documents/document-reviews.js`, `backend/src/repositories/schedule-availability.js`
- `backend/src/server.js` (registro da rota, se for arquivo novo)
- `backend/test/` (testes novos e ajustes em `schedule-booking.test.js`, `request-routes.test.js`)
- `src/features/process-modal/*` (novo)
- `src/App.tsx` _(só os trechos 3883–3900, 3951–4887 e 4969–~5120)_
- `src/features/request-actions.ts`, `src/features/tutor-data/tutor-data-tab.tsx`, `src/features/registered-animals/document-review-decisions.ts`, `src/api.ts`
- `src/styles.css` _(só as regras `prm-*` e de anexos afetadas)_

---

## O que será removido

- `RequestPreviewModal`, `AttachmentRow`, `isAnimalPhotoDocument` do `App.tsx` (substituídos pela pasta nova).
- `PrescriptionModal`, `getPrescriptionMunicipality`, `buildPrescriptionInstitutionName`, `buildPrescriptionFooterLines`, `buildPrescriptionPrintHtml` do `App.tsx` (movidos — o original é apagado).
- Faixa Tipo / Agenda / Responsável do cabeçalho (`prm-header-meta`) e o subtítulo espécie · sexo do primeiro animal.
- Campos "Microchip conferido do primeiro animal", microchip por animal (`confirmedAnimalChips`) e "Observação" do atendimento (`attendanceData.note`).
- Painel de reagendamento embutido (`renderInlineReschedule`, `prm-modal--reschedule`, `isRescheduleMode`) e o painel de indeferimento embutido (`activePanel === "reject"`).
- Decisões só na tela (`docDecisions`, botões ✓/✗ `doc-decision-btn*`), botão "Indeferir" por anexo (`prm-attachment-reject-btn`, `openDocumentRejectPanel`, `buildDocumentRejectionNote`, `describeAttachmentBlock`) e o aviso `prm-documents-warning`.
- Bloqueio da aba ("Disponível após confirmar a agenda", `prm-tab--disabled`, `canUseProcedureTab` como trava de aba).
- Em `request-actions.ts`, para processos de procedimento: `approveRequest`, `confirmAttendanceFromProcess`, `getPerformedProceduresLabel`, `rescheduleFromPreview`, `rejectRequestFromProcess` e o "não compareceu" por `archiveWithTag` — **antes de apagar, conferir com grep se a listagem, a agenda ou outras telas ainda usam**; o que ainda tiver uso fica.
- Botão "Salvar dados do tutor" de dentro da aba (vai para o rodapé).
- Classes CSS que ficarem sem uso depois da troca, e imports órfãos.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. **Contrato** `shared/request-procedure-contract.js` com status, ações, transições, `resolveAnimalProcedures`, `deriveRequestStatus`, `deriveRequestSchedule` + testes.
2. **Agenda**: `allocateScheduleAvailability` e `reserveRequestSchedule`/`bookingChanged` contando por procedimento aberto (1 vaga por animal por data/ocorrência/horário); ajustar e ampliar os testes de agenda antes de seguir.
3. **Documentos**: `note` obrigatória na decisão `rejected` + teste.
4. **Trecho comum do PATCH** extraído; PATCH passa a recusar status/agenda em processos com `procedures`.
5. **Rota e service** das ações por procedimento + testes de rota (isolamento, transições, bloqueio documental, vaga, não alterar outros procedimentos/animais, status derivado, avisos).
6. **Frontend — lógica**: `attachment-rows.ts`, `procedure-api.ts`, `use-process-procedures.ts` + testes.
7. **Frontend — telas**: cabeçalho, abas, Anexos, Procedimento e saúde, rodapé, janelas (reagendar, indeferir, ajuste, receita, aviso de não salvo), tutor com botão no rodapé.
8. **Trocar** o modal no `App.tsx`, apagar o que está em "O que será removido", limpar `request-actions.ts` e CSS órfão.
9. **Responsivo**: abaixo de ~760px, seletor de animais com rolagem horizontal, lista de procedimentos acima do detalhe, rodapé quebrando em duas linhas; cabeçalho e rodapé fixos, rolagem só no corpo.
10. **Validar** uma vez ao final (comandos abaixo).

---

## Regras de negócio identificadas

- Um processo = um protocolo; um ou vários animais; um ou vários procedimentos por animal. A tela mostra só o processo aberto.
- Cada procedimento tem status, agendamento e dados de execução próprios; saúde é do animal.
- O mesmo animal pode estar em outros processos (vínculo `animal_id`/`animals[i].id` atual, sem duplicar cadastro).
- Abre em Anexos; outras abas sempre navegáveis.
- Documentos do sistema identificados e sem deferir/ajuste/indeferir.
- Confirmar agenda (e reagendar) bloqueado enquanto houver documento obrigatório do processo pendente, recusado ou faltando; o bloqueio não afeta navegação nem outras ações.
- Microchip só para Microchipagem (procedimento cujo nome normalizado contém "microchip").
- Campos que não voltam: data do agendamento, animal, observações do atendimento.
- Reagendar: janela com nova data; afeta só o procedimento selecionado.
- Confirmar agenda, Confirmar atendimento, Não compareceu e Indeferir (justificativa obrigatória) afetam só o procedimento selecionado.
- Receita vinculada ao animal e procedimento; profissional e registro; imprimir/PDF; não muda status.
- Atribuir/Assumir são do processo.
- Trocar de animal não descarta nada; fechar com alteração não salva avisa.

---

## Regras multi-tenant e segurança

- Município sempre do usuário autenticado (`tenant.js`); global usa o município do próprio processo, como no PATCH.
- Rota nova só para equipe interna; somente leitura (`readOnly`) não chama ações.
- Consultas parametrizadas e escopadas por `municipality_id`; trava de agenda por município antes do `FOR UPDATE`.
- `animalIndex` e `requestTypeId` validados contra o processo travado (índice existente, procedimento existente no animal); nada vindo do client define município, status derivado ou agenda sem validação.
- Erros inesperados devolvem mensagem genérica.
- Relatório do processo (`generateProcessReportPdf`) continua igual; conferir que ele não quebra com `procedures` no animal.

---

## Validações necessárias

- Rota: `action` dentro de `ProcedureAction`; transição permitida; `animalIndex` inteiro existente; `requestTypeId` do animal.
- `REJECT`: motivo obrigatório + justificativa obrigatória (texto aparado, limite de tamanho).
- `RESCHEDULE`: data válida e futura, ocorrência e horário com vaga (mesma checagem de `reserveRequestSchedule`).
- `SAVE`: `doencas`/`alergias` texto com limite; microchip só alfanumérico maiúsculo e só em Microchipagem.
- `PRESCRIPTION`: texto, nome e registro do profissional obrigatórios, com limite.
- Ajuste de documento: `note` obrigatória com limite.

---

## Testes necessários

### Frontend

- `attachment-rows.ts`: linhas, documento do sistema, pendências que bloqueiam.
- Rodapé: botões por aba e por status do procedimento; Confirmar agenda bloqueado com pendência.
- `use-process-procedures`: trocar de animal mantém o rascunho; alteração não salva detectada.
- Microchip só aparece em Microchipagem; campos removidos não aparecem.
- Tutor: botão do rodapé envia o form.

### Backend

- Contrato: transições, `resolveAnimalProcedures` (processos antigos por status), `deriveRequestStatus`, `deriveRequestSchedule`.
- Agenda: ocupação por procedimento, 1 vaga por animal por data/horário, processos antigos ocupando igual.
- Rota: outro município → 404; usuário externo → 403; ação inválida/transição proibida → 400/409; confirmar agenda com documento pendente → 409; uma ação não altera outro procedimento nem outro animal; status geral derivado e avisos disparados pela mudança.
- PATCH recusa status/agenda em processo com `procedures`; especiais seguem funcionando.
- Revisão de documento recusada exige `note`.

### Conferência manual (tela)

- Processo com 2 animais e 2 procedimentos cada: abre em Anexos; deferir/ajustar libera o Confirmar agenda; cada procedimento muda sozinho.
- Reagendar um procedimento e ver a vaga na agenda.
- Receita impressa com animal, procedimento, profissional e registro.
- Celular: seletor, lista e rodapé utilizáveis.

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

- Contagem de vagas é compartilhada com o formulário público: erro gera vaga duplicada ou falsa lotação — testes de agenda primeiro.
- Agenda, relatórios, painel e acompanhamento do tutor leem a data e o status do processo: passam a ver os derivados.
- Processos antigos dependem de `resolveAnimalProcedures`.
- Avisos (e-mail, WhatsApp, SMS) seguem a mudança do status geral: confirmar o segundo procedimento de um processo já Agendada não avisa.
- Mudança grande: dividir em commits por etapa (contrato/agenda, backend, frontend).
- Commit e push direto em `main`.

---

## Decisões assumidas

Recomendações do plano preliminar, sem resposta explícita do usuário:

1. Agenda por procedimento, 1 vaga por animal por data/ocorrência/horário.
2. Status geral derivado: algum Agendado → Agendada; senão algum Aguardando → Nova; todos encerrados com algum Realizado → Realizada; senão Cancelada.
3. Avisos atuais, disparados pela mudança do status geral e da data derivada; nenhum aviso novo por procedimento.
4. Bloqueio documental pelos documentos obrigatórios do processo inteiro.
5. Solicitar ajuste: justificativa no aviso de documentos conferidos e no histórico; reenvio pelo tutor fora deste ajuste.
6. Atribuir/Assumir no rodapé da aba Anexos (como no protótipo).
7. Microchip pelo nome do procedimento contendo "microchip" (vale para tipos criados pelo município).
8. Receita: profissional preenchido com o usuário logado, registro digitado a cada receita.
9. Título "Atendimento de animais"; nos especiais, o nome do tipo.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada (as decisões acima podem ser revistas antes do `/implementar`).

---

## Critérios de aceite

- O processo mostra só o próprio protocolo.
- Navegação entre vários animais do mesmo processo; cada animal com todos os seus procedimentos.
- Selecionar um procedimento carrega seus dados e status.
- Aba Anexos primeiro; conferência funciona e bloqueia Confirmar agenda com pendência obrigatória.
- Doenças preexistentes e Alergias conhecidas uma abaixo da outra, por animal.
- Data do agendamento, Animal e Observação não reaparecem.
- Ações no rodapé fixo; Salvar, Reagendar, Confirmar agenda, Confirmar atendimento, Não compareceu e Indeferir funcionando por procedimento.
- Receita no contexto do animal e procedimento selecionados.
- Dados do tutor com os campos originais e Salvar no rodapé.
- Uma ação não altera outros animais ou procedimentos.
- Layout adequado em computador e celular.
- Typecheck, testes e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
