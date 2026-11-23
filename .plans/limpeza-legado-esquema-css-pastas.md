# Plano de Implementação: limpeza do legado, esquema único do banco, CSS e pastas

## Origem

- Arquivo de especificação: seção "Fora do escopo → Plano seguinte" de `.plans/documentos-municipais-numeracao-limpeza.md`, mais o levantamento feito no planejamento (abaixo).
- Data do planejamento: `2026-11-22`
- Classificação: `frontend + backend + database`
- Contexto: em 2026-11-22 os bancos local e de produção foram zerados e recriados (só o master, 20 tabelas, `main` = `8806b26`). Nenhum banco guarda mais dados no formato antigo, então o código que só existia para lê-los pode sair.

---

## Resumo

Quatro frentes de limpeza, sem funcionalidade nova:

1. **Legado de dados:** remover os 7 mecanismos que só serviam a dados antigos e ficaram mortos com o reset. Os outros 5 que o código chama de "legado" ainda têm uso hoje: ficam, só com o comentário corrigido.
2. **Esquema único:** reescrever `backend/src/db/migrations.js` como o esquema final (tabelas, colunas, restrições e índices como estão hoje), absorvendo os 8 SQL de `backend/src/db/sql/` e tirando as correções de dados antigos que o boot ainda roda. Um banco novo passa a ficar completo só com o boot.
3. **CSS:** remover as 398 declarações do `styles.css` que uma regra posterior do mesmo seletor sempre sobrescreve, e as regras que ficarem vazias. Por construção, nada muda na tela.
4. **Pastas:** mover os arquivos soltos da raiz de `src/features` para pastas próprias.

---

## Escopo

### Dentro do escopo

- Os 7 mecanismos mortos da seção "O que será removido", com seus testes.
- Correção dos comentários que chamam de "legado" o que ainda é uso atual.
- Esquema único em `migrations.js`, sem os SQL avulsos, com comparação de catálogo contra o banco local atual.
- Remoção das tabelas `sectors` e `user_sectors` (gravadas, nunca lidas) e das colunas sem uso `animals.current_tutor_id` e `animal_tutors.relationship`.
- Declarações mortas de CSS.
- Organização dos arquivos soltos de `src/features`.
- Atualizar a documentação que manda aplicar os SQL avulsos.
- Zerar de novo o banco local e o de produção no fim (só com ordem do usuário; confirmar pergunta 1).

### Fora do escopo

- Os 321 `!important` do `styles.css` (confirmar pergunta 2): tirá-los exige conferir cada tela, e a migração para Tailwind + shadcn vai reescrever esses estilos.
- Regras duplicadas de CSS que não são mortas (mesclar regras pode mudar a cascata).
- Dividir o `App.tsx` (cerca de 7 mil linhas): assunto do `.plans/reescrita-completa-sistema.md`.
- Os 94 exports usados só no próprio arquivo (quase todos tipos de assinatura): sem ganho.
- Mudar comportamento além do que a remoção do legado implica.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- `.plans/documentos-municipais-numeracao-limpeza.md`
- `src/domain.ts` (`normalizeRequestType`, `normalizeRequestStatus`, `tagsFromLegacyStatus`, `normalizeRequest`)
- `backend/src/routes/requests.js` (`ALLOWED_REQUEST_TAGS`), `backend/src/routes/animals.js` (`fetchLegacyAnimalRequest`, `ensureAnimalFromLegacyRequest`), `backend/src/routes/municipalities.js` (inserts em `sectors`/`user_sectors`)
- `shared/notification-contract.js`, `shared/use-switches-contract.js`, `shared/whatsapp-templates-contract.js`, `src/features/whatsapp-integration/whatsapp-template-link-modal.tsx`, `backend/src/services/whatsapp-active-templates.js`
- `backend/src/services/documents/document-provenance.js`, `stored-document.js`, `document-catalog.js`, `document-reviews.js`, `backend/src/repositories/document-sources.js`
- `backend/src/services/notifications/dispatch-notification.js`, `backend/src/services/request-change-notifications.js`, `backend/src/services/request-submission.js`
- `backend/src/services/config-permission.js`, `backend/src/services/staff-notification-events.js`, `backend/src/municipalityDefaults.js`
- `backend/src/services/config-secret-cipher.js`, `shared/schedule-contract.js`, `shared/request-procedure-contract.js`, `backend/src/repositories/registered-animals.js`
- `backend/src/db/migrations.js` e os 8 arquivos de `backend/src/db/sql/`
- Levantamentos: declarações mortas e `!important` do `styles.css` (postcss), colunas do banco local sem menção no código, arquivos soltos de `src/features`.

---

## Impacto por área

### Frontend

- `src/domain.ts`:
  - `normalizeRequestStatus` aceita só os status de `RequestStatus` (`shared/request-contract.js`); qualquer outro valor vira `NOVA`;
  - saem `tagsFromLegacyStatus` e o filtro de tags de fluxo (`DEFERIDA`, `INDEFERIDA`, `COMPARECEU`, `NAO_COMPARECEU`, `CANCELADA`) em `normalizeRequest`.
- `src/features/whatsapp-integration/whatsapp-template-link-modal.tsx`: sai a opção do aviso antigo `documents_reviewed`.
- `src/App.tsx`: conferir o id `usuario_padrao_<município>` de `defaultMunicipalityUserToTeamUser`. Se o usuário padrão sempre chega com id de conta, sai o valor de reserva.
- Tags que ficam (`ATRIBUIDA`, `REAGENDADA`, `MICROCHIP`, `OBITO`, `TROCA_TUTOR`) passam a vir de `RequestTag` em `shared/request-contract.js`, sem strings soltas no front e no back.
- CSS: `src/styles.css` (declarações mortas).
- Pastas, com imports ajustados e os mesmos nomes exportados:
  - `src/features/agenda.tsx` e `agenda.test.tsx` → `src/features/agenda/agenda-view.tsx` e `agenda-view.test.tsx`;
  - `src/features/reports.tsx` → `src/features/reports/reports-view.tsx`;
  - `src/features/accessRequests.tsx` e `accessRequests.test.tsx` → `src/features/access-requests/access-requests-view.tsx` e `access-requests-view.test.tsx`;
  - `src/features/adoption-interest-count.ts` (+ teste) e `src/features/adoption-status.ts` → `src/features/adoption/`;
  - `src/features/request-actions.ts` (+ teste) → `src/features/request-actions/request-actions.ts`;
  - `src/features/request-analysis-sections.tsx` → `src/features/process-modal/special-request-sections.tsx`.

### Backend

- **Tags:** `ALLOWED_REQUEST_TAGS` perde `PRIORIDADE`, `RETORNO_TUTOR`, `MUTIRAO` e `PRESENCIAL` (nada grava essas tags).
- **Aviso antigo `documents_reviewed`:**
  - sai `LEGACY_DOCUMENTS_REVIEWED` de `shared/notification-contract.js`;
  - sai `inheritDocumentNoticeValues` de `shared/use-switches-contract.js`; `normalizeUseSwitches` lê as chaves gravadas direto;
  - em `shared/whatsapp-templates-contract.js` saem `WHATSAPP_LEGACY_DOCUMENTS_LABEL`, o ramo antigo de `linkedUses` e o de `isLinkUse` (e o que ficar sem uso, como `documentOutcomeUses`);
  - em `backend/src/services/whatsapp-active-templates.js` sai o rótulo antigo.
- **Anexos sem comprovante:**
  - sai `legacyAttachmentId` (`document-provenance.js`);
  - `describeStoredDocument` (`stored-document.js`) usa sempre o `attachmentId` gravado;
  - anexo sem recibo válido fica não conferido, sem data de recebimento confiável e indisponível para reaproveitamento (hoje, sem recibo nenhum, ainda podia ser reaproveitado);
  - `document-catalog.js` perde a releitura com id `legacy-…`;
  - `readDocumentSource` (`document-sources.js`) perde a busca por índice `legacy-<n>-…`;
  - comentário de `document-reviews.js` corrigido.
- **Notificações:**
  - `dispatchNotification` perde o parâmetro `legacy` e `tryLegacyWhatsapp`;
  - `notifyRequestChanges` perde a marca `legacy`;
  - pedido sem `followUp` não envia aviso (já é o efeito atual para óbito e troca de tutor, que não têm agenda).
- **Animais:** em `animals.js` saem `fetchLegacyAnimalRequest` e `ensureAnimalFromLegacyRequest`; a consulta por microchip busca só na tabela `animals`, sempre com o município.
- **Permissões:**
  - `config-permission.js` acha o membro da equipe só pelo id da conta, sem a reserva por e-mail;
  - `staff-notification-events.js` perde a comparação para ids locais de equipe antigos.
- **Tabelas paralelas:** `municipalities.js` deixa de inserir em `sectors` e `user_sectors`.
- **Comentários a corrigir (o código fica):**
  - `normalizeRequestType` (`src/domain.ts`): tipo de procedimento é gravado com os nomes dos procedimentos;
  - `request-submission.js`: o envio de tipo único é o modo do município sem tipos cadastrados;
  - `legacyId` em `shared/request-procedure-contract.js` vira `singleTypeId`, com comentário certo;
  - `config-secret-cipher.js`: texto puro é o modo sem `CONFIG_ENCRYPTION_KEY`;
  - `shared/schedule-contract.js`: ocorrência que não existe mais na agenda;
  - `registered-animals.js`: tirar "adaptador de compatibilidade".

### Banco de dados

- `backend/src/db/migrations.js` reescrito como o esquema final:
  - as tabelas atuais com as colunas, restrições e índices de hoje, nos mesmos nomes;
  - as 7 tabelas e colunas que vinham dos SQL avulsos passam para dentro dele: `tutor_profiles`, `auth_challenges`, `request_tracking_challenges`, `staff_notifications`, `staff_notification_reads`, as colunas novas de `users`, `tutor_profiles` e `access_requests`, e os índices de `20261113-registered-animals.sql`;
  - só `CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS` e a criação do master.
- **Sai do esquema:**
  - as tabelas `sectors` e `user_sectors`;
  - as colunas `animals.current_tutor_id` e `animal_tutors.relationship`;
  - as correções de dados antigos: troca de papel `admin` → `suporte`/`admin_municipal`, `UPDATE` de status antigos, município de `animal_records`, `DROP CONSTRAINT config_pkey`/`requests_status_check`;
  - as cadeias de `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
- **SQL avulsos:** os 8 arquivos de `backend/src/db/sql/` são apagados (o `20261122-credenciais-no-ambiente.sql` só limpava dados). A pasta continua sendo o lugar das mudanças manuais futuras, como diz o AGENT.md.
- **Comparação obrigatória:**
  - criar um banco temporário no Postgres local (ex.: `castracao_schema_check`), rodar o boot novo nele e comparar o catálogo com o banco local atual: tabelas; colunas (tipo, padrão, nulidade); restrições (tipo, definição); índices (definição);
  - a única diferença aceita é a lista "Sai do esquema" acima;
  - apagar o banco temporário no fim.
- **Bancos existentes:**
  - local e produção ainda têm o que sai;
  - recomendado: zerar os dois de novo depois do deploy (só o boot, sem SQL), confirmar pergunta 1;
  - alternativa: um SQL que remove só as tabelas e colunas mortas.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

- Sem variável nova. Os commits saem com `[skip render]`.
- Deploy de produção só com ordem do usuário, junto com o reset: apagar o esquema → deploy → conferir o estado (não há mais SQL para aplicar).

---

## Arquivos provavelmente afetados

- `backend/src/db/migrations.js`, `backend/src/db/sql/*.sql` (removidos)
- `backend/src/routes/requests.js`, `animals.js`, `municipalities.js`
- `backend/src/services/documents/document-provenance.js`, `stored-document.js`, `document-catalog.js`, `document-reviews.js`
- `backend/src/repositories/document-sources.js`, `registered-animals.js`
- `backend/src/services/notifications/dispatch-notification.js`, `backend/src/services/request-change-notifications.js`, `request-submission.js`
- `backend/src/services/config-permission.js`, `staff-notification-events.js`, `whatsapp-active-templates.js`, `config-secret-cipher.js`
- `shared/notification-contract.js`, `use-switches-contract.js`, `whatsapp-templates-contract.js`, `request-contract.js`, `request-procedure-contract.js`, `schedule-contract.js`
- `src/domain.ts`, `src/App.tsx` (imports e trechos citados), `src/styles.css`
- `src/features/whatsapp-integration/whatsapp-template-link-modal.tsx`
- Arquivos movidos de `src/features` e quem os importa
- `backend/test/*` correspondentes e testes do frontend dos arquivos movidos
- `docs/registered-animals.md` e `docs/tutor-access.md` (trechos que mandam aplicar SQL avulso)

---

## O que será removido

- `tagsFromLegacyStatus`; o mapeamento de status antigos de `normalizeRequestStatus`; o filtro de tags de fluxo de `normalizeRequest`; as tags `PRIORIDADE`, `RETORNO_TUTOR`, `MUTIRAO`, `PRESENCIAL` da lista aceita.
- `LEGACY_DOCUMENTS_REVIEWED`, `inheritDocumentNoticeValues`, `WHATSAPP_LEGACY_DOCUMENTS_LABEL`, os ramos antigos de `linkedUses`/`isLinkUse`, a opção antiga do modal de vínculo e o rótulo antigo em `whatsapp-active-templates.js`.
- `legacyAttachmentId`, a releitura `legacy-…` do catálogo, a busca por índice `legacy-<n>-…` de `readDocumentSource` e o tratamento de anexo sem recibo como reaproveitável.
- `tryLegacyWhatsapp` e o parâmetro/marca `legacy` das notificações.
- `fetchLegacyAnimalRequest` e `ensureAnimalFromLegacyRequest`.
- A reserva por e-mail para membro de equipe sem id de conta (`config-permission.js`) e a comparação de ids locais antigos (`staff-notification-events.js`); o id `usuario_padrao_*` se confirmado sem uso.
- Os inserts em `sectors` e `user_sectors`; as tabelas `sectors`, `user_sectors`; as colunas `animals.current_tutor_id`, `animal_tutors.relationship` _(sai do esquema; nos bancos existentes, via reset ou SQL — não executar sem ordem)_.
- No `migrations.js`: cadeias de `ALTER … ADD COLUMN`, correções de dados antigos, `DROP CONSTRAINT` de `config_pkey` e `requests_status_check`.
- Os 8 arquivos de `backend/src/db/sql/`.
- As 398 declarações mortas do `styles.css` e as regras/at-rules que ficarem vazias.
- Os testes que cobrem só os comportamentos antigos acima.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

**Antes de começar:** confirmar com o usuário as perguntas em aberto 1, 2 e 3.

1. **Esquema único** (commit próprio):
   - Montar o esquema final a partir do banco local atual (que é exatamente o caminho boot + 8 SQL) e escrevê-lo em `migrations.js`, com os mesmos nomes de restrições e índices.
   - Tirar `sectors`, `user_sectors`, `animals.current_tutor_id` e `animal_tutors.relationship` do esquema e os inserts de `municipalities.js`.
   - Apagar `backend/src/db/sql/*.sql`.
   - Comparar o catálogo: banco temporário com o boot novo × banco local atual. Diferença aceita só a removida de propósito.
   - Ajustar a documentação que manda aplicar SQL avulso.
2. **Legado do backend e shared** (commit próprio): itens de tags, aviso antigo, anexos, notificações, animais, permissões e comentários, com testes do comportamento novo.
3. **Legado do frontend:** `src/domain.ts`, modal do WhatsApp, `RequestTag` no front, id `usuario_padrao_*`.
4. **CSS** (commit próprio): script com postcss que remove só a declaração de uma regra de seletor único quando uma regra posterior do mesmo seletor, no mesmo contexto de at-rules, declara a mesma propriedade com importância igual ou maior; remove regras e at-rules vazias; mantém comentários. Conferir a contagem (cerca de 398).
5. **Pastas** (commit próprio): `git mv` dos arquivos soltos e ajuste dos imports; nada de mudança de código além dos caminhos.
6. **Validação** uma vez ao final: `npm run typecheck`, `npm test`, `node --test backend/test/*.test.js`, `npm run build`; rodar de novo o levantamento de código/CSS/exports sem uso.
7. **Bancos** (só com ordem do usuário): zerar o local; depois zerar produção junto com o deploy (apagar o esquema → deploy → conferir 18 tabelas, só o master).

---

## Regras de negócio identificadas

- Os status de um pedido são só `NOVA`, `AGENDADA`, `REALIZADA` e `CANCELADA`.
- As tags aceitas são `ATRIBUIDA`, `REAGENDADA`, `MICROCHIP`, `OBITO` e `TROCA_TUTOR`.
- Os avisos de documentos são dois: deferidos (`documents_approved`) e indeferidos (`documents_rejected`).
- Um anexo só é reaproveitado quando tem recibo válido; sem recibo válido, a equipe o vê como não conferido.
- Pedido sem acompanhamento (`followUp`) não gera aviso.
- A consulta de animal por microchip olha só os animais cadastrados do município.
- A permissão de um membro da equipe vem do grupo ligado ao id da sua conta.
- Setores vivem só na configuração do município (`castragestao:teams`).
- Município sem tipos de pedido cadastrados continua aceitando o envio de tipo único (confirmar pergunta 3).

---

## Regras multi-tenant e segurança

- A consulta de animal continua filtrada pelo município do usuário; nada de buscar em pedidos de outro município.
- Anexos: a remoção do caminho antigo deixa o reaproveitamento mais restrito (só com recibo válido); nenhuma rota passa a aceitar id vindo do cliente sem conferência.
- Permissões: sem a reserva por e-mail, um e-mail reaproveitado nunca herda o grupo de outra conta.
- O esquema mantém todas as restrições de município de hoje (chaves estrangeiras, índices únicos por município, `users_id_municipality_unique` etc.); a comparação de catálogo garante isso.

---

## Validações necessárias

- `normalizeRequestStatus` com valor desconhecido → `NOVA`.
- `PATCH` de pedido com tag removida → 400 (tag inválida).
- Comparação de catálogo do esquema sem diferença fora da lista aceita.
- Contagem de declarações CSS removidas igual ao levantamento.

---

## Testes necessários

### Frontend

- `normalizeRequest`: status desconhecido vira `NOVA`; tags gravadas passam como estão.
- Modal de vínculo do WhatsApp sem a opção antiga.
- Testes dos arquivos movidos continuam passando nos novos caminhos.

### Backend

- Anexo sem recibo: aparece para a equipe como não conferido e não entra no catálogo de reaproveitamento; anexo com recibo segue igual.
- `readDocumentSource` recusa id fora do formato atual.
- `dispatchNotification`/`notifyRequestChanges`: pedido sem `followUp` não envia nada.
- Consulta de animal por microchip sem animal cadastrado: não cria animal a partir de pedido.
- `config-permission`: membro da equipe achado só por id; e-mail igual de outra conta não dá permissão.
- `normalizeUseSwitches` sem a herança antiga.
- `ALLOWED_REQUEST_TAGS` sem as tags removidas.
- Criação de município não grava em `sectors`/`user_sectors`.
- Esquema: teste existente de boot/migrations (se houver) e a comparação de catálogo como verificação manual registrada no resumo.

### Conferência manual (tela)

- Área de configuração do WhatsApp: vínculo de template sem a opção antiga.
- Processo com anexos: anexos aparecem e a conferência funciona.
- Consulta de prontuário por microchip.
- Telas principais sem mudança visual depois da limpeza de CSS.

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

- **Áreas sensíveis:** anexos, permissões e notificações; cada mudança tem teste do comportamento novo.
- **Esquema reescrito:** uma diferença sutil é pega pela comparação de catálogo antes do commit; o banco temporário é apagado no fim.
- **Bancos existentes:** continuam com as tabelas e colunas removidas até o reset (ou SQL); o código novo não depende delas.
- **Produção:** se o usuário recriar Içara antes do reset deste plano, o reset apaga isso (pergunta 1).
- **Commit e push direto em `main`**, sem `staging`, com `[skip render]`.

---

## Perguntas em aberto

Confirmar no início do `/implementar` (o plano foi aprovado com estas respostas pendentes; entre parênteses, a recomendação):

1. O usuário segura o cadastro de Içara e das integrações em produção até este plano ir ao ar, para zerar os dois bancos de novo? (Recomendado: sim. Alternativa: SQL que remove só as tabelas e colunas mortas e mantém os dados.)
2. Os 321 `!important` ficam para a migração para Tailwind + shadcn? (Recomendado: sim. Alternativa: tirar agora com conferência visual de cada tela.)
3. Mantém o modo de município sem tipos de pedido cadastrados, com envio de tipo único? (Recomendado: sim, é uso atual. Alternativa: exigir procedimentos sempre, removendo o `legacyId`/`singleTypeId` e o caminho de tipo único.)

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- Os 7 mecanismos mortos não existem mais no código, e os 5 mantidos têm comentários que dizem o uso real.
- `migrations.js` é o esquema final único, `backend/src/db/sql/` está vazio e a comparação de catálogo só mostra as remoções aceitas.
- As declarações mortas do CSS saíram, sem mudança visual.
- A raiz de `src/features` só tem pastas.
- `npm run typecheck`, `npm test`, `node --test backend/test/*.test.js` e `npm run build` sem erros.
- Commits enviados para `main` com `[skip render]`; resets só com ordem do usuário.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations nem resets sem confirmação explícita; o banco temporário de comparação é criado e apagado só no Postgres local (`localhost`).
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas; um commit por frente.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
- Scripts com regex ou `\n`: gravar com a ferramenta Write, nunca por heredoc do Bash.
