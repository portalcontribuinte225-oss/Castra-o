# Central de notificações da equipe

A central usa a sessão da equipe e verifica a permissão **Solicitações** no servidor. Contas municipais consultam o município da própria sessão. Master e suporte podem consultar todos os municípios ativos ou passar `municipalityId` para filtrar um deles.

## API

- `GET /api/notifications` retorna `items`, `unreadCount` e `nextCursor`. Envie `nextCursor` no parâmetro `cursor` para carregar a próxima página. O contador inclui todas as páginas do escopo atual.
- Um item tem `id`, `type`, `protocol`, `createdAt`, `read`, `municipalityId` e `requestId`. Os tipos são `request_created` e `request_assigned`. Trate `id` e `nextCursor` como strings.
- `POST /api/notifications/:id/read` registra a leitura da conta atual e retorna `request` e `unreadCount`. A requisição aceita o mesmo filtro municipal da listagem. Um alerta fora do escopo ou um processo indisponível retorna HTTP 404.

## Persistência

O evento de criação usa a transação da solicitação. A atribuição registra o evento quando a conta responsável muda, para um destinatário ativo que pode acessar Solicitações. A leitura é por usuário e pode ser repetida com segurança.

A migração [20261120-staff-notifications.sql](../backend/src/db/sql/20261120-staff-notifications.sql) deve ser aplicada com autorização explícita antes do deploy do backend.
