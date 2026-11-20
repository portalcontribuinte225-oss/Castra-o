# AGENT.md

Sistema de castração animal multi-prefeitura. Frontend React + Vite + TypeScript em `src/`, backend Express (JavaScript, `pg`) em `backend/` e contratos compartilhados em `shared/`. Prioridade: segurança, previsibilidade e mudanças pequenas e focadas. Em dúvida, escolha a opção mais segura, menor, mais fácil de revisar/testar/reverter, mais explícita e menos acoplada.

## Runtime e escopo

- Node padrão `v22.17.0` / npm `10.9.2`. Não adicione dependência cujo `engines.node` exija versão maior; se for inevitável, pare e reporte com alternativa compatível.
- Este é o único AGENT.md do projeto (não há `frontend/AGENT.md` nem `backend/AGENT.md`). Em conflito, este arquivo prevalece sobre os padrões existentes no código.
- Nunca altere `.env` (nem renomeie/remova variáveis ou secrets) sem pedido explícito.

## Git, PRs e deploy

- Fluxo deste projeto (definido pelas skills `implementar`/`finalizar`): commit e push direto em `main`, sem `staging` e sem PR. Isso prevalece sobre qualquer menção a `staging`/PR em documentos antigos.
- Publicação em produção exige autorização explícita. Para um envio só ao GitHub, use `[skip render]` na mensagem do commit se o auto-deploy estiver ativo ou se o estado dele for desconhecido.
- Commits pequenos e focados, Conventional Commits em inglês (`feat:`, `fix:`, `refactor:`, `chore:`). Sem `git push --force` e sem reset destrutivo, salvo pedido explícito e confirmado.
- Não commitar secrets, tokens, `.pem`, `.key`, certificados nem arquivos privados.
- Não alterar CI/CD, Render, Dockerfiles, scripts de deploy, start/build commands, health checks ou portas sem necessidade explícita.
- Banco: o schema base é criado por `backend/src/db/migrations.js` (`runMigrations()` no boot do servidor); mudanças manuais ficam em `backend/src/db/sql/`. Nunca edite SQL ou migration já aplicado; crie um novo. SQL e migrations só com confirmação explícita (o ambiente pode apontar para produção); sem `DATABASE_URL` local, entregue o SQL ao usuário.
- Produção roda no Render: evite aumentar CPU, memória, tempo de request e bloqueios síncronos. Trabalho pesado (PDFs grandes, relatórios, importações, uploads) não deve rodar dentro de request HTTP; proponha antes uma alternativa assíncrona.
- Execute `npm run build` e `npm start` na raiz. O build prepara as dependências do frontend e do backend quando necessário e gera `dist/`. O start inicia o backend, que serve os arquivos compilados. Configure `DATABASE_URL` com a URL do PostgreSQL nas variáveis do ambiente.

## Qualidade e validação

- Antes de concluir: typecheck, testes e build sem erros novos. Da raiz: `npm run typecheck`, `npm test` (frontend, vitest), `node --test backend/test/*.test.js` (backend) e `npm run build`. Não há lint configurado. Nenhum segredo exposto; nenhum arquivo não relacionado alterado; nenhuma migration antiga modificada. Erro preexistente deve ser documentado.
- Não atualize dependências nem lockfiles sem necessidade; não adicione dependência se o que já existe resolve.
- Código novo em inglês (arquivos, pastas, funções, tipos, variáveis, enums, tabelas, colunas, migrations, testes, componentes, hooks, comentários técnicos). Código legado em português permanece; não renomeie em massa sem pedido.
- Sem código morto, imports não usados, `TODO`/`FIXME`, gambiarras temporárias, `console.log` ou debug. Sem `as unknown as` (se inevitável, escopo mínimo e motivo documentado). Sem efeitos colaterais ocultos ou abstrações surpreendentes.
- Reutilize padrões e arquitetura existentes antes de criar algo novo; não introduza um segundo padrão para o mesmo problema.

## Enums e constantes de domínio

- Valores finitos e conhecidos (status, roles, tipos, categorias, workflows, permissões, estados) têm uma única definição centralizada e tipada, reutilizada entre frontend, backend e validações: `enum` no TypeScript (ex.: `RequestStep`) e objeto congelado em `shared/*-contract.js` (ex.: `NotificationEvent`). Não espalhe strings literais.
- Não crie enum para valor usado uma vez, texto livre, valor dinâmico ou constante temporária/local.

## Estrutura de código

- Um arquivo, uma responsabilidade. Evite "god files" (config + banco + transação + tenant + segurança + regra de negócio + utils + tipos no mesmo arquivo).
- Tamanho: até 150 linhas ideal; 150–250 aceitável; 250–400 exige revisão; acima de 400 exige justificativa (gerados são isentos).
- Camadas no backend: routes (recebem, validam, chamam services, respondem) → services (casos de uso e regras; integrações como e-mail, WhatsApp e SMS ficam como adapters em `services/`) → repositories (só banco). Contratos compartilhados ficam em `shared/`. Não misture camadas.
- Nomes específicos (`request-submission.js`, `notification-events.js`); evite `utils.ts`, `helpers.ts`, `common.ts`, `manager.ts`, `runtime.ts`, `service.ts`.
- Infraestrutura explícita: o entrypoint de banco é `backend/src/db/index.js` (exporta o `pool`). Não crie pools avulsos no código de aplicação. O isolamento entre prefeituras é por `municipality_id`: resolva o município por `backend/src/tenant.js` e nunca confie no valor vindo livremente do client.
- Infra crítica (tenant, autenticação, permissões, notificações, agenda) deve ser testável isoladamente, sem subir a aplicação inteira.

## Backend

- Consultas com `pg`, sempre parametrizadas (`$1`, `$2`) e escopadas por município; nunca interpole valores na string SQL.
- Não vaze dados sensíveis (stack, SQL, credenciais, resposta bruta de provedor) em mensagens de erro; erros inesperados devolvem mensagem genérica ao cliente.

## Multi-tenant (atenção redobrada)

Qualquer mudança em autenticação, autorização, tenant/prefeitura, permissões, relatórios, PDFs, exportações, importações ou storage exige validação extra. O isolamento entre tenants tem prioridade sobre conveniência; nunca assuma que uma mudança pequena é segura.

## Código compartilhado

- Antes de alterar `shared/` ou configs compartilhadas, verifique impacto em frontend, backend, scripts, build e testes; preserve compatibilidade.
- Não altere arquivos não relacionados, lockfiles sem necessidade nem formatações incidentais.

## Checklist antes de finalizar

- [ ] Alterações dentro do escopo, sem arquivos desnecessários
- [ ] Sem secret/env/config crítica/migration antiga alterados
- [ ] Frontend e backend continuam compatíveis
- [ ] Typecheck, testes e build executados, sem erros novos
- [ ] Commit em `main` conforme o fluxo acima
