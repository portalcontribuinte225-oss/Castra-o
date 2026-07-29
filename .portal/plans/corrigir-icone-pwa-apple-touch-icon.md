# Plano de Implementação: Corrigir ícone PWA para iOS (apple-touch-icon)

## Origem

- Arquivo de especificação: feedback de análise PWA/mobile discutido em conversa (sem `.md` de feature dedicado)
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`

## Resumo

O ícone do PWA hoje existe só como `public/pwa-icon.svg`, referenciado no `manifest.webmanifest`. O `index.html` não declara `<link rel="apple-touch-icon">` nem `<link rel="icon">`. iOS Safari não lê o array `icons` do manifest para "Adicionar à Tela de Início" e não renderiza bem SVG nesse papel — resultado provável: ícone genérico/quebrado ao instalar no iPhone, justamente o fluxo que o próprio `PwaInstallPrompt` (`src/App.tsx:5844-5912`) instrui o usuário a fazer manualmente. A correção é gerar PNGs reais a partir do SVG existente e declarar os links corretos no HTML e no manifest.

## Escopo

### Dentro do escopo

- Adicionar `sharp` como devDependency e um script Node local (não versionado como parte do build de produção) para rasterizar `public/pwa-icon.svg` em 3 tamanhos PNG: 180×180 (apple-touch-icon), 192×192 e 512×512 (manifest/favicon).
- Adicionar `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` e `<link rel="icon" href="/pwa-icon-192.png" type="image/png">` em `index.html`.
- Adicionar as 2 entradas PNG no array `icons` de `public/manifest.webmanifest`, mantendo a entrada SVG existente.
- Atualizar `STATIC_ASSETS` em `public/sw.js` com os novos PNGs e bumpar `CACHE_NAME` de `v6` para `v7`, garantindo que o service worker invalide o cache antigo.

### Fora do escopo

- Splash screen dedicada por dispositivo (`apple-touch-startup-image`) — cosmético, não solicitado.
- Migrar a infraestrutura de PWA para `vite-plugin-pwa` ou automatizar a geração de ícone dentro do pipeline de build oficial (`npm run build`) — mudaria a arquitetura de PWA do projeto; o script de geração desta tarefa é uma ferramenta local de uso pontual, não parte do build.
- Qualquer mudança em `src/App.tsx` / `PwaInstallPrompt` — o componente já funciona corretamente, o problema é só o asset/link ausente.
- Qualquer mudança em fluxos de solicitação, home pública ou CSS (`styles.css`) — fora do escopo desta tarefa específica de ícone.

## Leitura de contexto

- `/AGENT.md` — lido. É um template genérico (menciona `frontend/`, `backend/` como pastas separadas com Drizzle, branch `staging`, monorepo) que não corresponde 1:1 à estrutura real deste projeto (arquivo único `src/App.tsx`, `package.json` na raiz, branch `main` direto, sem `staging` — conforme confirmado por `git status` e por memória de projeto já registrada). Apliquei as regras que fazem sentido neste contexto real: mudanças pequenas e focadas, não alterar `.env`/CI/CD, não commitar sem pedido explícito, rodar validações antes de concluir.
- Não há `frontend/AGENT.md` nem `backend/AGENT.md` neste repositório (verificado via busca de arquivos) — não aplicável.
- `index.html`
- `public/manifest.webmanifest`
- `public/sw.js`
- `src/main.tsx`
- `vite.config.ts`
- `package.json` (scripts: `dev`, `dev:frontend`, `build`, `typecheck`, `preview` — não existe script `lint` neste projeto)
- `src/App.tsx` (trecho do `PwaInstallPrompt`, linha 5844-5912)

## Impacto por área

### Frontend

- `index.html`: adicionar 2 tags `<link>` no `<head>`.
- `public/manifest.webmanifest`: adicionar 2 entradas PNG no array `icons`, mantendo a entrada SVG.
- `public/sw.js`: incluir os novos PNGs em `STATIC_ASSETS`; bumpar `CACHE_NAME` para `v7`.
- Novos arquivos binários gerados: `public/apple-touch-icon.png` (180×180), `public/pwa-icon-192.png`, `public/pwa-icon-512.png`.
- Script utilitário novo (ex: `scripts/generate-pwa-icons.mjs` ou similar) que usa `sharp` para converter o SVG existente nos 3 PNGs — rodado uma vez localmente, não integrado ao `npm run build`.
- `package.json`: adicionar `sharp` em `devDependencies` (e, opcionalmente, um script `"generate:pwa-icons"` para reprodutibilidade futura).
- Sem impacto em componentes React, hooks, roteamento ou lógica de negócio.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado — mudança restrita a arquivos estáticos servidos pelo Vite/hosting atual (Render, conforme `/AGENT.md`), sem alteração de env vars, build command, start command ou health checks.

Atenção: migrations não devem ser executadas sem confirmação explícita do usuário, pois o ambiente atual pode estar apontando para produção. (Não aplicável a este plano — não há mudança de banco.)

## Arquivos provavelmente afetados

- `index.html`
- `public/manifest.webmanifest`
- `public/sw.js`
- `package.json` (nova devDependency `sharp`)
- `public/apple-touch-icon.png` (novo)
- `public/pwa-icon-192.png` (novo)
- `public/pwa-icon-512.png` (novo)
- Script utilitário novo de geração de ícones (local, não parte do build de produção)

## Estratégia de implementação

1. Adicionar `sharp` como devDependency (`npm install --save-dev sharp`), confirmando compatibilidade com Node `v22.17.0` antes de instalar.
2. Criar um script Node local que lê `public/pwa-icon.svg` e gera os 3 PNGs (180, 192, 512) via `sharp`.
3. Rodar o script uma vez para gerar os arquivos em `public/`.
4. Adicionar `<link rel="apple-touch-icon">` e `<link rel="icon">` em `index.html`.
5. Adicionar as entradas PNG no array `icons` de `manifest.webmanifest` (mantendo o SVG existente).
6. Atualizar `STATIC_ASSETS` em `sw.js` com os novos arquivos e bumpar `CACHE_NAME` para `v7`.
7. Rodar `npm run build` e `npm run typecheck` para validar que nada quebrou.
8. Validação visual: inspecionar o manifest via Chrome DevTools (Application > Manifest) e, se possível, testar "Adicionar à Tela de Início" em iPhone real ou simulador.

## Regras de negócio identificadas

Nenhuma — correção técnica de asset/configuração PWA, sem regra de negócio do domínio (castração/adoção) envolvida.

## Regras multi-tenant e segurança

Sem impacto — ícone e manifest são globais à aplicação (todas as prefeituras/tenants compartilham a mesma PWA/branding), não variam por município. Nenhuma alteração em autenticação, permissões, relatórios ou PDFs.

## Validações necessárias

- Confirmar que `sharp` é compatível com Node `v22.17.0` antes de instalar (checar `engines` no `package.json` da lib).
- Confirmar visualmente no Chrome DevTools que o manifest lista os ícones PNG corretamente.
- Confirmar que o `sw.js` atualizado não quebra o cache-first de assets estáticos existente (`STATIC_ASSETS`).
- Testar instalação do PWA em iOS (real ou simulador) após o deploy, já que esse é o cenário que motivou a correção.

## Testes necessários

### Frontend

Não há suíte de testes automatizados para PWA/assets neste projeto — validação é manual/visual via DevTools e dispositivo real.

### Backend

Não aplicável.

### E2E

Não aplicável.

## Comandos de validação sugeridos

```bash
npm run build
npm run typecheck
```

Não existe script `lint` neste `package.json` — não incluí `npm run lint` no plano.

## Riscos e pontos de atenção

- Adicionar `sharp` introduz uma nova dependência de build (mesmo que só devDependency) — `/AGENT.md` pede para evitar dependências sem necessidade clara; a justificativa aqui é que não há alternativa nativa para rasterizar SVG→PNG neste ambiente. Deixar claro no commit que é devDependency, sem impacto em runtime de produção.
- Se `CACHE_NAME` não for bumpado, usuários com o PWA já instalado podem continuar vendo o ícone antigo por causa do cache-first do service worker.
- Verificar se `sharp` baixa binários nativos compatíveis com o ambiente de build do Render — risco baixo mas vale confirmar no primeiro deploy.
- Mudança de baixo risco geral: assets estáticos e configuração declarativa, sem lógica de aplicação nem contrato frontend/backend afetado.
- Commit deve ser pequeno e focado (conforme `/AGENT.md`), sem misturar com outras pendências (ex: limpeza de CSS discutida separadamente, que fica de fora deste plano).

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. (Decisões já tomadas: gerar PNGs via `sharp`/script local; scripts de validação confirmados no `package.json`.)

## Critérios de aceite do plano

- PNGs existem em `public/` nos 3 tamanhos (180, 192, 512).
- `index.html` declara `apple-touch-icon` e `icon`.
- `manifest.webmanifest` lista as entradas PNG além do SVG existente.
- `sw.js` com `CACHE_NAME` incrementado para `v7` e novos assets em `STATIC_ASSETS`.
- `npm run build` e `npm run typecheck` rodam sem erro novo.
- Ícone renderiza corretamente ao inspecionar o manifest via DevTools.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não aplicável, mas reforçando por padrão do template).
- Este projeto não segue a estrutura `frontend/AGENT.md`/`backend/AGENT.md` do template — não procurar esses arquivos, eles não existem aqui.
- Manter a mudança pequena e focada: só ícone/PWA, sem tocar em `App.tsx`, CSS de home pública, ou outras pendências discutidas em paralelo (limpeza de `styles.css`).
- Confirmar compatibilidade do `sharp` com Node `v22.17.0` antes de instalar.
- Rodar `npm run build` e `npm run typecheck` ao final.
- Não fazer commit/push automaticamente — isso é papel da skill `finalizar`, a pedido explícito do usuário.
