# Plano de Implementação: Procedimentos por animal na solicitação (etapa 1 reestruturada, lista de raças e tipos padrão)

## Origem

- Arquivo de especificação: nenhum arquivo único. Base: a conversa de 2026-11-16, o código do `main` (commit `614fe60`) e o plano `.plans/tipos-identificacao-configuraveis.md` (modelo de tipo de identificação e regra "todos precisam permitir" reaproveitados).
- Data do planejamento: `2026-11-16`
- Classificação: `frontend + backend` (sem migration: o dado novo cabe em `requests.animals` e `requests.workflow_data`, que já são JSONB, e em `requests.request_type`, que já é texto). Nenhuma variável de ambiente nova.

---

## Resumo

Hoje a solicitação tem **um tipo só** (`request_type`), escolhido na etapa 1 dentro do primeiro animal, e ele define taxa, documentos, etapas e agenda do pedido inteiro. O usuário precisa poder pedir **mais de um tipo de solicitação por animal** e **tipos diferentes para animais diferentes no mesmo pedido**.

Passa a funcionar assim:

- **Cada animal tem `requestTypeIds`** (lista de procedimentos). O campo `procedure` que já existe no animal guarda o procedimento *realizado* no atendimento e continua como está; o campo novo tem outro nome para não colidir.
- **Derivados no servidor, nunca vindos do cliente:** `workflow_data.requestTypeIds` (lista distinta, em ordem) e `request_type` com os **nomes completos** separados por vírgula (sem "+1").
- **Etapa 1 reestruturada.** Bloco "Solicitação" (global: só Com tutor / Sem tutor) e bloco "Animais" (acordeão; cabeçalho fechado = "Animal 1 · Nome · Espécie"). Em cada animal: lista de procedimentos com checkbox e rolagem própria, depois os dados do animal e a saúde. "Duplicar o anterior" e "Aplicar os procedimentos do Animal 1 a todos". Sem barra de resumo. Mesma tela no formulário público e no interno.
- **Regras combinadas:** etapas (Tutor, Agenda, Documentos) valem quando **todos** os procedimentos de todos os animais, mais o tipo de identificação, permitem; documentos são a **soma por pedido**, sem repetir, e obrigatório vale se algum tipo exigir; a lista de raças de cada animal é a união das raças ligadas aos procedimentos dele, filtrada pela espécie.
- **Listas, filtros e análises** mostram cada procedimento por inteiro e filtram por procedimento.
- **Vínculo de raças no cadastro do tipo de solicitação** deixa de ser chips e vira lista com rolagem, checkbox, agrupada por espécie e com busca.
- **Tipos de solicitação padrão** de município novo: Castração, Microchipagem, Vacinação antirrábica, Remoção de tumor e Esterilização de animal de rua, todos gratuitos, com o comprovante de residência como hoje e ligados às 10 raças padrão.
- **Municípios existentes** recebem os tipos que faltam por um script (simulação por padrão, `--apply` para gravar), sem remover nem alterar nada do que já têm.
- **Pedidos antigos** continuam valendo: sem `requestTypeIds`, vale o tipo antigo (`workflow_data.requestTypeId` ou `request_type`).

Motivo: refletir como o atendimento realmente acontece (vários procedimentos para o mesmo animal, procedimentos diferentes por animal) e separar o que é do pedido do que é do animal.

---

## Escopo

### Dentro do escopo

- Contrato compartilhado dos procedimentos de um pedido (resolução, derivados, limites).
- Validação e combinação no backend: envio público e interno, documentos, agenda, PATCH do tipo.
- Etapa 1 reestruturada, com bloco "Solicitação" e acordeão de animais, para o formulário público e o interno.
- Lista de procedimentos com checkbox e rolagem própria; "Duplicar o anterior" e "Aplicar a todos".
- Exibição por procedimento: lista, detalhe, agenda, acompanhamento, PDF, filtros e análises.
- Lista com rolagem, checkbox, busca e agrupamento por espécie no vínculo de raças do cadastro do tipo de solicitação.
- Tipos de solicitação padrão para município novo e script de carga para os existentes.
- Testes e atualização de documentação afetada.

### Fora do escopo

- Fluxo "Animal já cadastrado": segue com um animal e um tipo, sem mudança de comportamento.
- Somar valores de taxa. A taxa do pedido é "Gratuito" quando todos os procedimentos são gratuitos; senão, a lista dos valores por procedimento.
- Documentos por animal (valem por pedido).
- Denúncia (`DENUNCIA`), óbito e troca de tutor: seguem como tipos especiais, sem procedimentos por animal.
- Remover ou renomear tipos de solicitação de municípios que já existem.
- Mudança de schema, migration ou backfill de pedidos antigos.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`, `.claude/skills/planejar/SKILL.md` e `TEMPLATE_planejar.md`
- Backend: `services/request-submission.js`, `routes/requests.js`, `services/documents/request-documents.js`, `document-policy.js`, `document-catalog.js`, `services/schedule/schedule-booking.js`, `services/request-tracking/tracking-view.js`, `repositories/request-tracking.js`, `repositories/registered-animals.js`, `routes/animals.js`, `municipalityDefaults.js`, `services/identification-type-defaults.js`, `services/breed-defaults.js`
- Frontend: `src/App.tsx` (`NewRequest`, `AdminDashboard`, `RequestPreviewModal`, cadastro de tipos), `features/request-steps/request-steps.ts`, `features/breeds/*` (`breed-picker.tsx`, `breeds.ts`), `features/request-filters/*`, `features/agenda.tsx`, `analytics.ts`, `domain.ts` (`requestTypeLabel`), `features/request-actions.ts`, `features/request-tracking/tracked-request-view.tsx`, `features/registered-animals/*`
- Planos: `tipos-identificacao-configuraveis.md`

Fatos verificados que sustentam o plano:

- `requests.request_type` é texto e `requests.animals` e `requests.workflow_data` são JSONB: não há coluna nova. O INSERT de `routes/requests.js` não grava taxa; a taxa vive no tipo configurado e nos relatórios.
- A validação do envio (`prepareRequestSubmission`) procura **um** tipo ativo do município e calcula `tutorRequired` com `configsAllowStep([tipo, identificação], "stepTutor")`. `request-documents.js` e `schedule-booking.js` fazem o mesmo para `stepDocuments` e `stepAgenda`, e `document-policy.js` resolve os documentos de um único tipo.
- O animal já tem `procedure` (realizado no atendimento) e os PDFs já mostram "PROCEDIMENTO" por animal.
- O formulário usa `requestData.type` global, e o seletor de tipo aparece só no primeiro animal (`index === 0`). A raça do animal vem de `getBreedOptions(breeds, { breedIds: tipo.breedIds, speciesId })`.
- `requestTypeLabel(request)` em `domain.ts` é o ponto central do rótulo no painel, agenda, acompanhamento e filtros; os filtros e a agenda filtram em memória, não em SQL.
- `isProcedureRequest(requestType)` só distingue os tipos especiais (denúncia, óbito, troca de tutor), então uma lista de nomes continua sendo "procedimento".

---

## Impacto por área

### Frontend

- **Etapa 1 do `NewRequest`** (pública e interna), com componentes novos em `src/features/request-procedures/`:
  - `request-procedure-list.tsx`: caixa com altura máxima e rolagem própria, uma linha por tipo (nome e taxa), checkbox, busca quando houver muitos tipos.
  - `animal-accordion-card.tsx`: cartão do animal; recolhido mostra "Animal N · Nome · Espécie"; aberto mostra procedimentos, dados do animal e saúde.
  - `request-identification-card.tsx`: bloco global "Com tutor / Sem tutor".
  - Ações "Duplicar o anterior" (copia espécie, porte, raça e procedimentos, deixa o nome em branco) e "Aplicar os procedimentos do Animal 1 a todos".
- **Estado:** `requestData.type` global sai; cada animal carrega `requestTypeIds`. `getVisibleSteps` recebe como `configs` os tipos de todos os procedimentos de todos os animais mais o tipo de identificação. A lista de documentos obrigatórios e a verificação de anexos usam a união.
- **Raças por animal:** união dos `breedIds` dos procedimentos escolhidos, filtrada pela espécie; sem procedimento escolhido, a seleção de raça definida fica indisponível com a explicação.
- **Exibição:** `requestTypeLabel` passa a listar os nomes; filtros (`request-filters`) ganham uma chave por procedimento; `agenda.tsx`, `analytics.ts`, detalhe (`RequestPreviewModal`: documentos exigidos pela união), acompanhamento e PDF listam os procedimentos.
- **Cadastro do tipo de solicitação:** o vínculo de raças vira `BreedChecklist` (lista com rolagem, checkbox, busca e grupos por espécie), reaproveitando `groupBreedsBySpecies`.
- Estados de loading/erro/vazio: sem tipos cadastrados, a lista explica e aponta para Configurar Ambiente; sem raças, o vínculo mostra a mensagem atual.
- Testes de frontend: ver "Testes necessários".

### Backend

- **Contrato `shared/request-types-contract.js`** (novo): `resolveRequestTypeIds(request)` (por animal, com fallback ao tipo antigo), `deriveRequestTypeFields(typeIds, types)` (lista distinta, `request_type` com nomes completos), `MAX_REQUEST_TYPES_PER_ANIMAL`, e a regra de taxa (Gratuito ou lista de valores).
- **`request-submission.js`:** valida cada id de cada animal contra os tipos **ativos do município** (como já faz com o tipo de identificação); exige ao menos um procedimento por animal no fluxo de procedimento; calcula `tutorRequired` pela conjunção de todos os tipos mais a identificação; grava os derivados. No fluxo interno, a conjunção usa só a identificação para o tutor (como hoje) e a lista para o resto.
- **`documents/request-documents.js` e `document-policy.js`:** `requestDocumentDefinitions` passa a receber a lista de tipos e devolve a união (por id de documento, obrigatório se algum exigir); `stepDocuments` pela conjunção.
- **`schedule/schedule-booking.js`:** `stepAgenda` pela conjunção; `bookingChanged` compara os procedimentos derivados.
- **`routes/requests.js`:** grava `workflow_data.requestTypeIds` e `request_type` derivados; no PATCH, o recálculo parte dos animais (o texto de `request_type` deixa de ser a fonte).
- **`tracking-view.js` e `repositories/request-tracking.js`:** o `requestType` exibido é a lista.
- **`municipalityDefaults.js`:** tipos padrão (Castração, Microchipagem, Vacinação antirrábica, Remoção de tumor, Esterilização de animal de rua), cada um com `breedIds` das 10 raças padrão e o comprovante de residência.
- **Script `backend/scripts/add-default-request-types.js`** (novo, usa `config-store.js`): para cada município, acrescenta os tipos padrão cujo id ainda não existe; nunca remove nem altera os existentes; liga as raças padrão aos novos só quando o município tem as raças padrão; simula por padrão e grava só com `--apply`.
- **Isolamento:** tudo continua por `municipality_id`; o município vem de `pickMunicipalityId`/JWT, nunca do body.

### Banco de dados

Sem alteração de schema. O dado novo fica em `requests.animals[].requestTypeIds` e `requests.workflow_data.requestTypeIds` (JSONB) e `requests.request_type` (texto, agora com a lista de nomes). Pedidos antigos continuam sem esses campos e são lidos pelo fallback.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção. Este plano não cria migration; o script de carga é separado, simula por padrão e é o usuário quem o roda.

### Infra/Deploy

Sem impacto esperado. Sem variável de ambiente nova nem mudança no Render. O push em `main` dispara o deploy.

---

## Arquivos provavelmente afetados

**Novos**

- `shared/request-types-contract.js`
- `src/features/request-procedures/` (`request-procedure-list.tsx`, `animal-accordion-card.tsx`, `request-identification-card.tsx`, `breed-checklist.tsx`)
- `backend/scripts/add-default-request-types.js`
- Testes: `backend/test/request-types-contract.test.js`, `backend/test/default-request-types.test.js` e testes de frontend dos componentes novos

**Alterados**

- `backend/src/services/request-submission.js`, `routes/requests.js`, `services/documents/request-documents.js`, `services/documents/document-policy.js`, `services/schedule/schedule-booking.js`, `services/request-tracking/tracking-view.js`, `repositories/request-tracking.js`, `municipalityDefaults.js`
- `src/App.tsx` (só `NewRequest`, `RequestPreviewModal`, cadastro do tipo e rótulos; arquivo grande: citar só os trechos afetados)
- `src/features/request-steps/request-steps.ts`, `src/domain.ts` (`requestTypeLabel`), `src/features/request-filters/request-filters.ts`, `src/features/agenda.tsx`, `src/analytics.ts`, `src/features/request-tracking/tracked-request-view.tsx`, `src/features/registered-animals/request-payload.ts`
- `src/styles.css` (estilos dos componentes novos; remover os do que sai)
- Testes existentes de submissão, documentos, agenda, etapas, filtros e acompanhamento
- `docs/` afetados, se houver menção ao tipo único

---

## O que será removido

Cada item deve ser **deletado do arquivo**, não comentado nem ocultado.

- O seletor de tipo em cartões (`anm-type-picker`, `anm-type-cards`) e o estado global `requestData.type` da etapa 1; os cartões "Tipo e identificação" misturados com os dados do primeiro animal.
- A regra "só no primeiro animal" (`index === 0`) para `showTypeSelector` e `showIdentificationPicker`.
- A busca de um único tipo nas validações do envio, dos documentos e da agenda (`resolveDocumentRequestType` com tipo único, `selectedRequestType` único na validação), trocada pelas versões com lista.
- O `BreedPicker` em chips (`document-pill`) e seu CSS, trocado pelo `BreedChecklist`.
- O `requestTypeLabel` de um nome só e as comparações de `request.type` com o nome de um tipo (por exemplo `requestTypes.find((t) => t.name === request.type)` no modal de detalhe), trocadas pela busca por ids.
- Estilos CSS dos elementos removidos e imports que ficarem órfãos.

> **Atenção para a skill `implementar`:** nada acima deve ser comentado, envolto em `if (false)` ou escondido com flag. Se a remoção gerar erro de compilação, corrigir o erro, sem `@ts-ignore`.

Dados que **não** são apagados: os tipos de solicitação, as raças e os pedidos existentes.

---

## Estratégia de implementação

A divisão em entregas é decisão do usuário. Corte natural, se pedido: (A) contrato e backend, sem mudar a tela; (B) etapa 1 e vínculo de raças; (C) exibição, filtros, PDF e padrões novos com o script.

1. **Contrato.** `shared/request-types-contract.js`: resolução dos procedimentos (por animal com fallback), derivados, limite por animal e regra de taxa. Testes primeiro.
2. **Envio.** `request-submission.js` valida os ids de cada animal, combina etapas e tutor, exige ao menos um procedimento por animal no fluxo de procedimento e produz os derivados. Rota grava `workflow_data.requestTypeIds` e `request_type`.
3. **Documentos e agenda.** União de documentos em `request-documents.js` e `document-policy.js`; conjunção para `stepDocuments` e `stepAgenda`; PATCH recalcula a partir dos animais.
4. **Acompanhamento no backend.** `tracking-view.js` e a consulta do repositório devolvem a lista.
5. **Componentes.** `request-procedure-list`, `animal-accordion-card`, `request-identification-card`, com testes.
6. **Etapa 1.** Integrar os componentes no `NewRequest` (público e interno), "Duplicar" e "Aplicar a todos"; ajustar `getVisibleSteps`, documentos e raças por animal; remover o que sai.
7. **Vínculo de raças.** `BreedChecklist` no cadastro do tipo; remover o `BreedPicker`.
8. **Exibição.** `requestTypeLabel`, filtros, agenda, análises, detalhe, acompanhamento e PDF por procedimento.
9. **Padrões e carga.** Tipos padrão em `municipalityDefaults.js`; script `add-default-request-types.js` (simula por padrão).
10. **Testes e documentação.** Atualizar os testes listados; rodar os comandos de validação uma vez ao final.

---

## Regras de negócio identificadas

- Um pedido tem um ou mais animais; **cada animal tem um ou mais procedimentos** (tipos de solicitação do município). Animais diferentes podem ter procedimentos diferentes.
- **Global do pedido:** só o tipo de identificação (Com tutor / Sem tutor). **Do animal:** procedimentos, dados, saúde (e microchip e foto no formulário interno).
- **Etapas:** uma etapa só aparece quando **todos** os procedimentos de todos os animais e o tipo de identificação a permitem (só `false` explícito esconde).
- **Documentos:** soma por pedido dos documentos de todos os procedimentos, sem repetir por id; obrigatório se algum tipo exigir; a declaração e o termo seguem a regra atual.
- **Raças:** por animal, a união das raças ligadas aos procedimentos dele, da espécie dele.
- **Taxa:** sem somar. Gratuito se todos os procedimentos forem gratuitos; senão, a lista dos valores por procedimento.
- **Agenda:** uma data para o pedido, contando uma vaga por animal, como hoje.
- **Listas e filtros:** cada procedimento aparece por inteiro e filtra por procedimento; análises contam por procedimento e animal.
- **Pedidos antigos e "Animal já cadastrado":** sem `requestTypeIds`, vale o tipo antigo; o fluxo de animal cadastrado continua com um tipo.
- **Tipos padrão de município novo:** Castração, Microchipagem, Vacinação antirrábica, Remoção de tumor e Esterilização de animal de rua, gratuitos, com o comprovante de residência e ligados às 10 raças padrão. Município existente só recebe o que falta.

---

## Regras multi-tenant e segurança

- **Origem do tenant:** `pickMunicipalityId`/JWT; o `municipalityId` do corpo nunca decide o município de um usuário autenticado.
- **Validação backend obrigatória:** todo id em `animals[].requestTypeIds` precisa ser um tipo **ativo do município da operação**; id desconhecido, inativo ou de outro município responde 400. Os derivados (`workflow_data.requestTypeIds`, `request_type`) são sempre calculados no servidor e qualquer valor enviado pelo cliente é descartado.
- **Dispensa de tutor, documentos e agenda** continuam decididos só por configuração confiável do servidor, nunca por flag do cliente.
- **Limites:** número máximo de procedimentos por animal e o limite existente de animais e de tamanho do pedido, contra payload abusivo.
- **Script de carga:** opera por município, dentro de transação por município, sem remover dados, simulação por padrão e imprime o banco de destino.
- **Relatórios/PDFs:** mudam a contagem por tipo (por procedimento); sem novo dado pessoal exposto.

---

## Validações necessárias

- `animals[].requestTypeIds`: array de strings, sem duplicatas, tamanho entre 1 e o máximo no fluxo de procedimento; ids existentes e ativos no município.
- Animais sem `requestTypeIds` em pedido novo de procedimento: erro claro; em pedido antigo: fallback ao tipo antigo.
- `request_type` e `workflow_data.requestTypeIds` vindos do cliente são ignorados e recalculados.
- Formulário: pelo menos um procedimento por animal; raça definida só com procedimento escolhido; documentos obrigatórios pela união; mensagens por animal ("Animal 2: escolha ao menos um procedimento").
- Script: id de tipo padrão já existente é ignorado; município sem a lista de tipos gravada é tratado como "vale o padrão de leitura".

---

## Testes necessários

### Frontend

- Lista de procedimentos: seleção múltipla, rolagem (altura máxima), busca, estado vazio.
- Cartão do animal: cabeçalho recolhido "Animal N · Nome · Espécie" (sem procedimento nem barra de resumo), abrir e fechar, remover.
- "Duplicar o anterior" (nome em branco) e "Aplicar os procedimentos do Animal 1 a todos".
- `getVisibleSteps` com vários procedimentos: uma etapa some quando qualquer um a dispensa; documentos pela união.
- Raças por animal pela união dos procedimentos e pela espécie; sem procedimento, sem raça definida.
- Formulário público e interno: mesmo comportamento; interno mantém a regra de tutor pela identificação.
- `BreedChecklist`: grupos por espécie, busca, seleção múltipla; `requestTypeLabel` e filtros por procedimento.

### Backend

- **Contrato:** resolução por animal e fallback; derivados; taxa (Gratuito vs lista); limites.
- **Submissão:** ids válidos, desconhecidos, inativos e de outro município; derivados descartam o que vem do cliente; conjunção de `stepTutor` com vários tipos; interno e público.
- **Documentos:** união sem repetição, obrigatório se algum exigir, anexo de documento de qualquer procedimento aceito, de outro não.
- **Agenda:** `stepAgenda` pela conjunção; mudança de procedimentos conta como alteração de reserva.
- **PATCH:** recalcula os derivados a partir dos animais.
- **Acompanhamento:** devolve a lista.
- **Padrões:** `municipalityDefaults` com os 5 tipos, ids únicos, `breedIds` coerentes; script só acrescenta, não altera existentes, é idempotente.
- Pedidos antigos continuam passando nos testes atuais.

### Conferência manual (tela)

- Formulário público: um pedido com 2 animais, procedimentos diferentes, "Sem tutor", "Duplicar" e "Aplicar a todos"; a etapa Tutor some no sem tutor.
- Formulário interno: o mesmo pedido.
- Lista de pedidos: cada procedimento por inteiro e filtro por procedimento.
- Cadastro do tipo de solicitação: lista de raças com rolagem e busca.
- Município novo: os 5 tipos padrão e as raças já ligadas.

---

## Comandos de validação sugeridos

```bash
npm run typecheck
npm test
node --test backend/test/*.test.js
npm run build
```

Sem inspeção visual no navegador, salvo pedido.

---

## Riscos e pontos de atenção

- **Validação do envio público** é a parte mais sensível (isolamento entre prefeituras e dispensa de tutor, documentos e agenda); por isso o servidor recalcula tudo e os testes cobrem os casos de id forjado.
- **`request_type` vira lista de nomes:** qualquer código que compare esse texto com o nome de um tipo precisa usar ids; o plano lista o modal de detalhe, e a implementação deve varrer os demais usos.
- **`App.tsx` é muito grande:** os componentes novos ficam em arquivos próprios e só os trechos afetados do `NewRequest` mudam.
- **Contagem em relatórios e análises** muda (por procedimento e animal): deixar claro na tela.
- **Pedidos antigos:** dependem do fallback; os testes existentes precisam continuar verdes.
- **Carga em município existente:** só acrescenta; se um id padrão já existir com configuração diferente, é respeitado.
- **Produção:** push direto em `main` dispara o deploy no Render; sem migration, o risco é de comportamento. O backend em execução local precisa ser reiniciado para valer.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. Suposições adotadas e já combinadas na conversa: documentos por pedido; "Duplicar o anterior" e "Aplicar a todos" na primeira versão; taxa sem somar; o script de carga apenas acrescenta; o fluxo "Animal já cadastrado" fica como está.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- A etapa 1 tem o bloco "Solicitação" (só Com tutor / Sem tutor) e o bloco "Animais" em acordeão, com cabeçalho "Animal N · Nome · Espécie" e sem barra de resumo, no formulário público e no interno.
- Cada animal aceita vários procedimentos, escolhidos em lista com rolagem própria e checkbox; animais diferentes podem ter procedimentos diferentes no mesmo pedido.
- "Duplicar o anterior" e "Aplicar os procedimentos do Animal 1 a todos" funcionam.
- Etapas, documentos e raças seguem as regras combinadas; o servidor valida os ids contra os tipos ativos do município e recalcula os derivados.
- Listas, filtros, agenda, acompanhamento, detalhe e PDF mostram cada procedimento por inteiro e filtram por procedimento; pedidos antigos continuam corretos.
- O vínculo de raças no cadastro do tipo é uma lista com rolagem, checkbox, busca e grupos por espécie; o `BreedPicker` em chips foi removido.
- Município novo nasce com os 5 tipos padrão (Castração, Microchipagem, Vacinação antirrábica, Remoção de tumor, Esterilização de animal de rua) ligados às raças padrão; o script acrescenta o que falta nos existentes sem alterar o que já têm.
- Nada do que está em "O que será removido" permanece no código.
- Typecheck, testes de frontend e de backend e build passam sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita. Este plano não cria nenhuma. O script de carga não roda sozinho: o usuário o executa, primeiro em simulação.
- Seguir `/AGENT.md`: código novo em inglês, arquivos pequenos de responsabilidade única, sem `console.log` fora dos scripts de linha de comando, sem código morto, enums e constantes centralizados em `shared/`.
- Não alterar `.env`. Testes só com valores falsos.
- Deletar tudo que está em "O que será removido": não ocultar.
- Manter alterações pequenas e focadas; a divisão em entregas é decisão do usuário.
- Não commitar nem dar push sem o `/finalizar`.
