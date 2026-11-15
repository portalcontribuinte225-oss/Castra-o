# AGENTS.md

Monorepo multi-prefeitura (frontend, backend e recursos compartilhados). Prioridade: segurança, previsibilidade e mudanças pequenas e focadas. Em dúvida, escolha a opção mais segura, menor, mais fácil de revisar/testar/reverter, mais explícita e menos acoplada.

## Runtime e escopo dos AGENT.md

- Node padrão `v22.17.0` / npm `10.9.2`. Não adicione dependência cujo `engines.node` exija versão maior; se for inevitável, pare e reporte com alternativa compatível.
- Prioridade das regras: este arquivo > AGENT.md do domínio (`/frontend/AGENT.md`, `/backend/AGENT.md`, quando existirem) > padrões existentes no código.
- Nunca altere `.env` (nem renomeie/remova variáveis ou secrets) sem pedido explícito.

## Git, PRs e deploy

- Fluxo deste projeto (definido pelas skills `implementar`/`finalizar`): commit e push direto em `main`, sem `staging` e sem PR. Isso prevalece sobre qualquer menção a `staging`/PR em documentos antigos.
- Commits pequenos e focados, Conventional Commits em inglês (`feat:`, `fix:`, `refactor:`, `chore:`). Sem `git push --force` e sem reset destrutivo, salvo pedido explícito e confirmado.
- Não commitar secrets, tokens, `.pem`, `.key`, certificados nem arquivos privados.
- Não alterar CI/CD, Render, Dockerfiles, scripts de deploy, start/build commands, health checks ou portas sem necessidade explícita.
- Nunca editar migrations já executadas; criar nova migration. Migrations só com confirmação explícita (o ambiente pode apontar para produção).
- Produção roda no Render: evite aumentar CPU, memória, tempo de request e bloqueios síncronos. PDFs, relatórios grandes, importações e uploads pesados não rodam dentro de request HTTP; use job/fila/worker, armazenamento e URL de download.

## Qualidade e validação

- Antes de concluir: lint (se existir), typecheck, testes e build sem erros novos; nenhum segredo exposto; nenhum arquivo não relacionado alterado; nenhuma migration antiga modificada. Erro preexistente deve ser documentado.
- Não atualize dependências nem lockfiles sem necessidade; não adicione dependência se o que já existe resolve.
- Código novo em inglês (arquivos, pastas, funções, tipos, variáveis, enums, tabelas, colunas, migrations, testes, componentes, hooks, comentários técnicos). Código legado em português permanece; não renomeie em massa sem pedido.
- Sem código morto, imports não usados, `TODO`/`FIXME`, gambiarras temporárias, `console.log` ou debug. Sem `as unknown as` (se inevitável, escopo mínimo e motivo documentado). Sem efeitos colaterais ocultos ou abstrações surpreendentes.
- Reutilize padrões e arquitetura existentes antes de criar algo novo; não introduza um segundo padrão para o mesmo problema.

## Enums e constantes de domínio

- Valores finitos e conhecidos (status, roles, tipos, categorias, workflows, permissões, estados) têm uma única definição centralizada e tipada (prefira `enum`), reutilizada entre frontend, backend, DTOs e validações. Não espalhe strings literais.
- Não crie enum para valor usado uma vez, texto livre, valor dinâmico ou constante temporária/local.

## Estrutura de código

- Um arquivo, uma responsabilidade. Evite "god files" (config + banco + transação + tenant + segurança + regra de negócio + utils + tipos no mesmo arquivo).
- Tamanho: até 150 linhas ideal; 150–250 aceitável; 250–400 exige revisão; acima de 400 exige justificativa (gerados são isentos).
- Camadas: controllers (recebem, validam, chamam services, respondem) → services (casos de uso e regras) → repositories (só banco) → workers (assíncrono) → adapters (integrações) → types (só contratos). Não misture camadas.
- Nomes específicos (`tenant-context.ts`, `pdf-renderer.ts`); evite `utils.ts`, `helpers.ts`, `common.ts`, `manager.ts`, `runtime.ts`, `service.ts`.
- Infraestrutura explícita: o entrypoint de banco é `backend/db/index.ts`; o `db` exportado aplica o RLS do tenant da request. Não use `drizzle(process.env.DATABASE_URL!)`, `drizzle(pool)` ou pools avulsos no código de aplicação. Comportamento (ex.: `withTenantContext()`, `adminDb`) deve ser óbvio pelo nome.
- Infra crítica (tenant, RLS, PDF, importações, filas, workers, storage, permissões, certificados) deve ser testável isoladamente, sem subir a aplicação inteira.

## Backend

- Erros inesperados passam pelo error handler central (`sendError` ou `next(error)`); nunca `res.status(500).json({ message: 'Erro interno.' })` estático.
- Novas operações de banco usam Drizzle (`db.select/insert/update/delete`, `drizzleFromClient(client)` em transações). SQL raw existente é legado; SQL raw novo só se Drizzle não resolver, com parâmetros, isolamento por tenant e justificativa.
- PDFs: API → Job → Queue → Worker → Storage → URL de download, com rastreamento de status. Nunca gerar PDF grande dentro da request.
- Importações financeiras: auditáveis, versionadas e reconciliáveis (storage → staging → validação → reconciliação → promoção). Nada de insert linha a linha via ORM para grandes volumes; prefira COPY, streaming ou lotes.

## Multi-tenant (atenção redobrada)

Qualquer mudança em autenticação, autorização, tenant/prefeitura, permissões, relatórios, PDFs, exportações, importações ou storage exige validação extra. O isolamento entre tenants tem prioridade sobre conveniência; nunca assuma que uma mudança pequena é segura.

## Monorepo

- Antes de alterar pacotes/utils/tipos/configs compartilhados, verifique impacto em frontend, backend, scripts, build e testes; preserve compatibilidade.
- Não altere arquivos não relacionados, lockfiles sem necessidade nem formatações incidentais.

## Checklist antes de finalizar

- [ ] Alterações dentro do escopo, sem arquivos desnecessários
- [ ] Sem secret/env/config crítica/migration antiga alterados
- [ ] Frontend e backend continuam compatíveis
- [ ] Lint (se existir), typecheck, testes e build executados, sem erros novos
- [ ] Commit em `main` conforme o fluxo acima
