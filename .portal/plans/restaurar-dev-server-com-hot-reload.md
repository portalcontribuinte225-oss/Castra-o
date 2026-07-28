# Plano de Implementacao: Restaurar Dev Server com Hot Reload

## Origem

- Arquivo de especificacao: pedido direto do usuario no chat
- Data do planejamento: 2026-07-28
- Classificacao: `frontend-only`

## Resumo

Restaurar a experiencia de desenvolvimento em que alteracoes em `src/App.tsx` e `src/styles.css` aparecem imediatamente na tela. O problema provavel e que o script atual `npm run dev` usa `vite build --watch`, que recompila o `dist`, mas nao oferece HMR/reload automatico no navegador. A solucao proposta e usar o servidor dev do Vite para o frontend, com proxy para o backend em `/api`.

## Escopo

### Dentro do escopo

- Ajustar scripts de desenvolvimento no `package.json`.
- Criar ou ajustar configuracao do Vite para rodar frontend com hot reload.
- Configurar proxy de `/api` para o backend local.
- Preservar o modo antigo de build watch como script separado, caso seja util.
- Documentar no proprio plano como usar a URL correta em desenvolvimento.

### Fora do escopo

- Alterar backend funcional.
- Alterar banco de dados.
- Executar migrations.
- Alterar `.env`.
- Alterar deploy, Render, CI/CD ou comandos de producao.
- Alterar regras de negocio.
- Alterar service worker de producao, salvo se a implementacao identificar necessidade minima e segura.

## Leitura de contexto

- `/AGENT.md`
- `/frontend/AGENT.md`: nao encontrado no repositorio
- `package.json`
- `backend/src/server.js`
- `src/main.tsx`
- `public/sw.js`
- busca por scripts, Vite, service worker e servidor estatico

## Impacto por area

### Frontend

Impacto esperado em ferramentas de desenvolvimento:

- `npm run dev` deve iniciar Vite em modo dev para entregar HMR.
- O frontend deve ser aberto na URL do Vite, provavelmente `http://localhost:5175` ou porta configurada.
- Chamadas para `/api` devem continuar funcionando via proxy para o backend local.

### Backend

Sem impacto funcional esperado.

Observacao: o backend local continua necessario para API. Como `backend/src/server.js` executa `runMigrations()` no start, a implementacao nao deve iniciar backend sem cuidado durante validacao.

### Banco de dados

Sem impacto esperado.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado.

`npm run build` e `npm start` devem continuar funcionando como antes para producao/build estatico.

## Arquivos provavelmente afetados

- `package.json`
- `vite.config.ts`

## Estrategia de implementacao

1. Verificar se existe configuracao Vite no projeto.
2. Criar `vite.config.ts` se nao existir.
3. Configurar servidor Vite com:
   - `host: "0.0.0.0"` ou equivalente seguro para acesso local;
   - `port` fixo ou preferencial, se o projeto ja usa uma porta padrao;
   - proxy `/api` para `http://localhost:3002`.
4. Atualizar `package.json`:
   - `dev` deve rodar backend e Vite dev server em paralelo;
   - manter o comportamento antigo como `dev:build-watch`;
   - manter `build`, `typecheck`, `start` e `preview` sem mudanca funcional de producao.
5. Nao iniciar backend automaticamente durante validacao se isso puder executar migrations em ambiente incerto.
6. Validar com:
   - `npm run typecheck`;
   - `npm run build`.
7. Se possivel e seguro, validar que `vite` sobe sem precisar executar backend/migrations, ou documentar que a validacao manual deve ser feita com a URL do Vite.

## Regras de negocio identificadas

- Sem mudanca de regra de negocio.
- O objetivo e apenas recuperar feedback visual imediato durante implementacao.

## Regras multi-tenant e seguranca

- Nao alterar origem do tenant.
- Nao alterar permissao.
- Nao alterar endpoints.
- Nao alterar backend nem banco.
- Evitar rodar comandos que iniciem migrations sem confirmacao.

## Validacoes necessarias

- `npm run dev` deve disponibilizar frontend com hot reload.
- Ao alterar CSS/TSX, o navegador conectado ao Vite deve atualizar automaticamente.
- Requisicoes `/api` no frontend devem apontar para o backend local.
- `npm run build` deve continuar gerando `dist`.
- `npm start` deve continuar servindo a versao buildada.

## Testes necessarios

### Frontend

- Validacao manual do hot reload em uma alteracao pequena de CSS.
- Validacao manual de uma chamada `/api` via proxy, quando backend local estiver rodando.

### Backend

- Sem testes backend esperados.

### E2E

- Sem E2E obrigatorio para este ajuste.

## Comandos de validacao sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

Opcional, com cuidado:

```bash
npm run dev
```

## Riscos e pontos de atencao

- Se o usuario abrir `http://localhost:3002`, vera o build estatico servido pelo backend, nao o HMR do Vite.
- Se o backend local iniciar com `runMigrations()`, pode tocar banco dependendo do `.env`; evitar iniciar backend sem necessidade durante validacao automatica.
- Service worker so registra em `import.meta.env.PROD`, entao nao deve afetar o Vite dev.
- Alterar o script `dev` pode mudar habito operacional; por isso preservar o modo antigo em `dev:build-watch`.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada.

## Criterios de aceite do plano

A implementacao deve ser considerada pronta quando:

- `npm run dev` usar Vite dev server e backend em paralelo.
- A URL de desenvolvimento correta estiver clara.
- Alteracoes em `src/App.tsx` e `src/styles.css` refletirem sem rebuild manual.
- `npm run typecheck` passar.
- `npm run build` passar.
- Nao houver alteracao em backend, banco, `.env`, deploy ou migrations.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao executar migrations.
- Nao alterar `.env`.
- Nao alterar backend funcional.
- Manter mudanca pequena e focada em scripts/config do Vite.
- Considerar que existe ajuste visual pendente no worktree para o botao `Indeferir`; nao reverter esse ajuste.
