# Animal já cadastrado — fase 6

Plano: `.portal/plans/animal-cadastrado-fase-6.md`.

## Schema antes de executar

O código depende de `backend/src/db/sql/20261113-registered-animals.sql`. A migration permite microchip nulo e acrescenta índices de propriedade, município e agenda; não contém backfill, seed ou exclusão de dados.

Confirmar explicitamente a autorização e o banco de destino antes de aplicar essa SQL. A autorização da migration de acesso do tutor não se estende a esta migration. O runner legado do boot não aplica o arquivo novo. Não reiniciar a API com o código novo antes de preparar o schema.

Após aplicação autorizada, conferir nulabilidade de `animals.microchip`, preservação da unicidade e os índices criados. O desenvolvimento/testes desta fase não aplica a migration nem altera `.env`.

## Identidade dos animais

- Cada animal de uma nova solicitação de procedimento ganha UUID e registro municipal na transação do pedido, inclusive sem chip. A referência primária de `requests` continua por compatibilidade; `requests.animals[]` contém os IDs de todos os animais.
- Microchip declarado pelo cidadão fica em metadata. Somente conferência interna autorizada confirma o valor no índice global; um chip informado não permite apropriar cadastro existente.
- A listagem exige sessão completa de tutor, vínculo ativo por usuário e relação municipal. Nome, CPF e chip não concedem propriedade.
- Solicitações próprias anteriores sem UUID podem fornecer candidatos. A seleção faz um POST explícito e idempotente, verificando vínculos canônicos anteriores antes de criar registro. GETs não materializam animais.
- O pedido de animal já cadastrado usa um animal e snapshots carregados pelo servidor. Mudança de proprietário ou óbito entre seleção e envio impede a operação.

## Documentos

O catálogo municipal recebe `reuseScope` (`tutor`, `animal`, `request`) e `reuseValidityDays` (inteiro positivo ou `null`). Configuração anterior usa `request`, portanto o administrador precisa classificar documentos que podem ser reaproveitados. Ausência de prazo não dispensa análise, abrangência ou validade do conteúdo.

Prazo é contado do recebimento original, em períodos de 24 horas. Reaproveitar ou revisar não renova a idade do arquivo. Essa regra não comprova sua data de emissão. Arquivos anteriores sem procedência comprovada são tratados conservadoramente e não herdam aprovação somente porque o JSON dizia `approved`.

O cliente envia referências de origem; o servidor confere proprietário, município, animal, conteúdo, política, prazo e estado antes de copiar o arquivo. Receipts HMAC vinculam os metadados de autoridade ao conteúdo e à origem, sem serem credenciais de acesso. Mudança do segredo existente pode exigir nova conferência; nunca renova automaticamente prazo/aprovação.

Declaração, aceite e data do novo pedido são próprios daquele envio. PDFs gerados, evidências internas e assinaturas anteriores não são arquivos reaproveitáveis do tutor. O catálogo retorna metadados; o conteúdo só é servido sob demanda a sessão autorizada.

O limite final de 16 MiB inclui JSON UTF-8, expansão base64, foto e documentos copiados, além dos limites individuais. Não há novo storage ou aumento do limite HTTP nesta fase.

## Agenda e transações

`GET /api/schedule/availability` retorna ocorrências/horários e vagas restantes, sem dados dos pedidos que as ocupam. O envio revalida a ocorrência, horário e quantidade real de animais, gravando sua chave estável no workflow.

Escritores de pedidos e calendário compartilham um advisory lock municipal para manter ordem consistente entre reserva, documentos e vínculos. É um lock conservador por município; provedores de mensagem ficam fora da transação. Cancelamentos não ocupam vaga; atribuição ambígua de registros antigos consome capacidade conservadoramente.

## Verificação

Testes de HTTP e transação usam dependências simuladas, sem `server.js`, banco real, mensagens ou migrations. Após o schema autorizado, uma conferência real local pode verificar primeira solicitação, troca de senha, lista de animais, novo pedido e revisão de documentos. Envio real a provedores e inspeção em navegador dependem de solicitação própria.
