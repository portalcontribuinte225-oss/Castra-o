# Especificação: Auditar resolução de tenant em todos os métodos de criação de processo

## Problema (já confirmado em produção/dev)

A rota `POST /animals/:id/transfer` (Troca de tutor) criava processos com
`municipality_id = NULL` quando o usuário logado era de uma prefeitura
específica e o animal não tinha histórico prévio de `requests` com
`municipality_id` preenchido. Isso deixava a solicitação **invisível** na
caixa de solicitações, porque `GET /requests` filtra por
`WHERE municipality_id = req.user.municipalityId` para usuários não-globais
— e `NULL` nunca bate com esse filtro. O mesmo bug existia (mesma lógica
copiada) em `POST /animals/:id/death` (Registrar óbito).

Causa raiz: essas duas rotas resolviam o tenant com uma lógica frágil e
silenciosa (tentar herdar `municipality_id` de requests antigas do mesmo
animal, sem validar nada e sem nunca abortar com erro), em vez de usar o
padrão já usado pelo fluxo de referência ("Solicitar procedimento",
`POST /requests`), que usa `requireMunicipality`/`pickMunicipalityId`
(`backend/src/tenant.js`) — resolve do usuário logado ou do body/query, e
**recusa a criação com HTTP 400** se não conseguir resolver.

Essas duas rotas já foram corrigidas (usam `pickMunicipalityId` agora, com
abort explícito). Falta confirmar que **nenhuma outra rota que cria uma
linha em `requests`** tem o mesmo problema, silencioso ou não.

## Objetivo desta spec

Revisar sistematicamente **todo método/rota que cria uma solicitação** (uma
linha em `requests`, e também `access_requests` como caso à parte) para
confirmar que:

1. O `municipality_id`/tenant é sempre resolvido de forma confiável (nunca
   fica `NULL` silenciosamente).
2. O status inicial gravado é sempre um valor que realmente aparece na aba
   "Novas" da caixa de solicitações (`status = 'NOVA'` e sem a tag
   `ATRIBUIDA` — ver `src/App.tsx`, `filterTabs`, aba `id: "inbox"`).
3. Não há nenhum outro campo obrigatório para a query de listagem
   (`GET /requests`, `AdminDashboard`) que possa faltar e também causar
   invisibilidade silenciosa (ex: `tags` malformada, `origin` inesperado).

## Escopo da auditoria

Percorrer, no mínimo:

- `backend/src/routes/requests.js` — `POST /` (referência), `POST /consult`
  (não cria, só lê — confirmar).
- `backend/src/routes/animals.js` — `POST /:id/death`, `POST /:id/transfer`
  (já corrigidas — validar que a correção está completa e não falta nada),
  `POST /consult`, `POST /lookup` (não deveriam criar `requests` — confirmar
  que de fato não criam).
- `backend/src/routes/accessRequests.js` — `POST /` (Credenciamento; sabe-se
  que usa tabela separada `access_requests`, não `requests` — confirmar que
  o `municipality_id` desse fluxo também é resolvido corretamente, já que é
  o mesmo tipo de bug possível em tabela diferente).
- Qualquer rota nova de Denúncia (`request_type: 'DENUNCIA'`, reaproveita
  `POST /requests` conforme implementado recentemente) — já deveria herdar o
  comportamento correto por usar a rota de referência, mas confirmar.
- Qualquer outra rota em `backend/src/routes/*.js` que faça
  `INSERT INTO requests` — grep completo antes de fechar a lista, não confiar
  só na lista acima.

Para cada rota encontrada, documentar:

- Nome do arquivo:linha.
- Como resolve `municipality_id` hoje (usa `pickMunicipalityId`? lógica
  própria? nenhuma?).
- Se falha silenciosamente (grava `NULL`/valor incorreto sem abortar) ou
  falha com erro claro.
- Status inicial gravado e se bate com o filtro da aba "Novas".
- Veredito: OK / Precisa correção, com a correção sugerida (sempre alinhar
  ao padrão `pickMunicipalityId`/`requireMunicipality` já usado no fluxo de
  referência).

## Fora do escopo

- Reabrir a discussão de unificar `access_requests` dentro de `requests`
  (decisão já tomada: manter separado).
- Qualquer mudança de UI/UX da caixa de solicitações além do necessário para
  confirmar o diagnóstico.
- Migrations de schema (a menos que a auditoria encontre necessidade real,
  o que deve ser reportado como pergunta em aberto, não decidido sozinho).
