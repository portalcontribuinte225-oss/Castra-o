# Plano de Implementação: Link de compartilhamento do animal para adoção, com prévia

## Origem

- Arquivo de especificação: conversa de 2026-11-17 (pedido no chat: "um link para compartilhar o animal postado para adoção", versão com prévia)
- Data do planejamento: `2026-11-17`
- Classificação: `fullstack` (front e back; sem mudança de banco: as fotos e os dados já existem)

---

## Resumo

Cada animal para adoção ganha um link próprio, `https://<endereço do app>/adocao/<id>`. Em WhatsApp, Facebook e afins o link aparece com a foto principal, o nome e um resumo do animal (prévia Open Graph). Quem abre cai na página pública já no município do animal, com a janela dele aberta (fotos e "Tenho interesse"). Um botão "Compartilhar" fica na janela pública do animal e no card do painel interno de Adoção: no celular abre o menu nativo de compartilhar; no computador copia o link e avisa "Link copiado".

---

## Escopo

### Dentro do escopo

- Rota de página `GET /adocao/:id` que devolve o `index.html` do app com as tags de prévia preenchidas.
- Rota de dados `GET /api/adoptions/:id/public` (só campos públicos) e rota de imagem `GET /api/adoptions/:id/photo` (foto principal).
- Leitura do link na página pública: escolher o município do animal e abrir a janela dele; avisos de adotado e de indisponível.
- Botão "Compartilhar" na janela pública do animal e no card do painel interno de Adoção.
- Compressão no navegador das fotos novas de adoção ao cadastrar (até 1280 px no maior lado, JPEG, cerca de 200 KB), para a prévia do WhatsApp mostrar a foto.
- Módulo compartilhado de "imagem comum em base64" usado pela foto do animal e pelo brasão.

### Fora do escopo

- Recomprimir as fotos já cadastradas.
- Levar quem está logado para o animal: o link é para o público; logado, o app abre normalmente.
- Página só do animal, sem a página pública por trás.
- Encurtador de link, QR code, contagem de cliques.

---

## Leitura de contexto

- `/AGENT.md`
- `backend/src/server.js` (rotas montadas antes de `app.use(express.static(distPath))` e de `app.get("*")`, que entrega o `index.html`; sem `trust proxy`)
- `backend/src/routes/adoptions.js` (lista pública `GET /` com `optionalAuth` e `pickMunicipalityId`; fotos em base64 até 2 MB cada, até 5 por animal)
- `backend/src/services/adoption-public-view.js` (`publicAdoption`: id, animal_name, species, sex, age, description, health, photo_url, photos, main_photo_index, status, municipality_id, adopted_at, created_at, interestCount)
- `backend/src/routes/municipality-brasao.js` (modelo de imagem pública: só raster, 404 igual para todo caso inválido, ETag, cache de 1 dia, `nosniff`)
- `public/sw.js` (navegação vai primeiro à rede: o link sempre chega ao back)
- `index.html` (título e descrição atuais)
- `src/App.tsx`: `AdoptionCarousel` (~L1421, janela do animal com `selectedAnimal` interno), seção pública de adoção (~L1975), escolha do município pelo link (~L418–L446, `slug` e `localStorage`), `AdoptionView` (~L5091), constantes de status em `src/features/adoption-status.ts`
- `src/api.ts` (`getAdoptions(municipalityId)`, `registerInterest`)
- `shared/request-access-contract.js` (`readAccessLink`: modelo de link lido de `window.location`)

---

## Impacto por área

### Frontend

- `src/features/adoption-share/`:
  - `adoption-share-link.ts`: monta `/adocao/<id>` com a origem atual e lê o id do caminho aberto (via contrato compartilhado).
  - `use-shared-adoption.ts`: ao abrir `/adocao/<id>`, busca `api.getPublicAdoption(id)`, escolhe o município do animal (como o link de acesso faz: estado + `localStorage`) e devolve o id a abrir; trata indisponível.
  - `share-adoption-button.tsx`: `navigator.share({ title, text, url })` quando existe; senão `navigator.clipboard.writeText(url)` e aviso "Link copiado" (estado curto, sem `alert`); erro de cópia vira aviso para copiar manualmente.
  - `compress-adoption-photo.ts`: reduz a foto escolhida (canvas, maior lado 1280 px, JPEG ~0,82, repetindo com qualidade menor até ~200 KB), mantendo o formato `data:image/jpeg;base64,...` que o back já aceita.
- `src/App.tsx`:
  - `AdoptionCarousel` recebe o id a abrir pelo link e abre a janela dele quando o animal está na lista; animal adotado mostra "Já encontrou uma família" e os outros disponíveis; indisponível mostra "Este animal não está mais disponível".
  - Botão "Compartilhar" na janela pública do animal e no card do `AdoptionView`.
  - O formulário de cadastro de foto de adoção passa as fotos novas pela compressão.
  - Depois de abrir pelo link, o endereço volta a `/` (`history.replaceState`), como o link de acesso já faz.
- `src/api.ts`: `getPublicAdoption(id)`.
- Estados: carregando (página pública normal enquanto busca), erro/indisponível (aviso), sucesso (janela aberta).

### Backend

- `backend/src/services/raster-image.js`: `decodeRasterDataUrl(text, maxBytes)` → `{ mime, bytes }` ou `null` (só png, jpeg, webp, gif; nunca SVG). A rota do brasão passa a usá-lo, sem mudar o comportamento.
- `backend/src/repositories/adoption-share.js`: `loadPublicAdoption(id)` com consulta parametrizada (`$1`), só as colunas públicas.
- `backend/src/services/adoption-share.js`:
  - `mainPhotoOf(adoption)`: a foto de `main_photo_index`, senão a primeira, senão `photo_url`.
  - `sharePreview(adoption, baseUrl)`: título, descrição, URL da imagem e URL da página; adotado → "Já encontrou uma família"; sem animal → prévia genérica do app.
  - `injectSharePreview(indexHtml, preview)`: troca `<title>` e a descrição e insere `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`, com todo texto escapado (`& < > " '`).
  - `requestBaseUrl(req)`: primeiro valor de `x-forwarded-proto` (ou `req.protocol`) + `host`.
- `backend/src/routes/adoption-share.js`:
  - `GET /adocao/:id` → HTML com a prévia (`Cache-Control: no-cache`, como o `index.html`); id que não é UUID ou animal inexistente → prévia genérica (status 200, o app trata).
  - `GET /api/adoptions/:id/public` → `publicAdoption(...)` ou 404 genérico.
  - `GET /api/adoptions/:id/photo` → bytes da foto principal com `Content-Type`, ETag, `Cache-Control: public, max-age=86400`, `X-Content-Type-Options: nosniff`, 304 com `If-None-Match`; todo caso inválido → o mesmo 404.
- `backend/src/server.js`: montar as rotas antes do `express.static` e do `app.get("*")`.
- `shared/adoption-share-contract.js`: o prefixo `/adocao/`, `adoptionSharePath(id)` e `readAdoptionShareId(pathname)`.

### Banco de dados

Sem impacto esperado.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem env nova. O back passa a ler o `dist/index.html` para montar a prévia (ler uma vez e guardar em memória, relendo se o arquivo mudar, para não ler o disco a cada pedido).

---

## Arquivos provavelmente afetados

- `shared/adoption-share-contract.js` (novo)
- `backend/src/services/raster-image.js` (novo)
- `backend/src/repositories/adoption-share.js` (novo)
- `backend/src/services/adoption-share.js` (novo)
- `backend/src/routes/adoption-share.js` (novo)
- `backend/src/routes/municipality-brasao.js` (usar `raster-image.js`)
- `backend/src/server.js` (montar as rotas)
- `backend/test/adoption-share.test.js` (novo)
- `src/features/adoption-share/` (novo: link, leitura, botão, compressão e testes)
- `src/api.ts`
- `src/App.tsx` _(arquivo grande: só `AdoptionCarousel`, a seção pública de adoção, o formulário de fotos e o card do `AdoptionView`)_

---

## O que será removido

- A constante `RASTER_DATA_URL` e a decodificação feita à mão dentro de `backend/src/routes/municipality-brasao.js`, substituídas por `decodeRasterDataUrl` de `backend/src/services/raster-image.js`.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Criar `shared/adoption-share-contract.js`.
2. Criar `raster-image.js` e passar o brasão a usá-lo (testes do brasão continuam passando).
3. Criar repositório, serviço e rotas de compartilhamento no back; montar no `server.js` antes do app estático; testes do back.
4. Front: `src/features/adoption-share/` (link, leitura, botão, compressão) e `api.getPublicAdoption`; testes.
5. `App.tsx`: abrir a janela pelo link, avisos de adotado/indisponível, botão na janela pública e no card interno, compressão no cadastro de fotos.
6. Rodar typecheck, testes do front e do back e build uma vez ao final.
7. Teste visual (mudança com front; liberado pelo usuário): prévia de dados falsos para a janela e o botão; conferir o HTML de `/adocao/<id>` com `curl` no back local.

---

## Regras de negócio identificadas

- O link é `/adocao/<id>`, com a origem do app.
- Só os campos de `publicAdoption` saem pelas rotas novas; interessados (`interests`), quem cadastrou e dados internos nunca.
- Prévia: título "`<nome>` · `<espécie>` para adoção"; descrição com idade, sexo e o início da descrição (até ~150 caracteres); imagem = foto principal.
- Adotado (`status = adotado`): prévia "`<nome>` já encontrou uma família"; ao abrir, aviso e lista dos outros disponíveis do município.
- Inexistente/removido/id inválido: prévia genérica do app; ao abrir, "Este animal não está mais disponível" e a página pública normal.
- Foto: só raster (png, jpeg, webp, gif), até 2 MB; senão 404 genérico, como o brasão.
- Fotos novas de adoção são comprimidas no navegador (maior lado 1280 px, ~200 KB); as já cadastradas ficam como estão.
- Quem está logado e abre o link vê o app normal.

---

## Regras multi-tenant e segurança

- As rotas são públicas de propósito (o WhatsApp busca sem sessão) e expõem só o que a lista pública já entrega (a lista já manda as fotos em base64).
- O município vem do próprio animal, nunca de parâmetro do cliente.
- Consultas parametrizadas; id validado como UUID antes de consultar (`isUuid`).
- Todo texto do animal é escapado antes de entrar no HTML; nada de `innerHTML` no front.
- Imagem: nunca SVG; `X-Content-Type-Options: nosniff`; 404 igual em todo caso inválido; erros sem detalhe interno.

---

## Validações necessárias

- `:id` precisa ser UUID nas três rotas.
- Foto: data URL raster válida, tamanho máximo.
- Compressão: arquivo de imagem válido; se o navegador não conseguir comprimir, manda a foto original dentro do limite atual (o back continua validando).

---

## Testes necessários

### Frontend

- `adoption-share-link`: monta `/adocao/<id>` e lê o id do caminho (com e sem barra final; caminho que não é de adoção → nada).
- `share-adoption-button`: usa `navigator.share` quando existe; senão copia e mostra "Link copiado".
- `compress-adoption-photo`: a lógica de dimensões (maior lado 1280 px, proporção mantida).
- Janela aberta pelo link e avisos (render estático, dados falsos).

### Backend

- `injectSharePreview` escapa `<script>`, aspas e `&` do nome e da descrição.
- Animal adotado → "já encontrou uma família"; inexistente/id inválido → prévia genérica com status 200.
- `GET /api/adoptions/:id/public` não traz `interests` nem quem cadastrou; 404 genérico quando não existe.
- `GET /api/adoptions/:id/photo`: raster ok com `Content-Type`, ETag e cache; SVG, base64 inválido, sem foto e id inválido → o mesmo 404; `If-None-Match` → 304.
- O brasão continua igual depois de usar `raster-image.js`.

### Conferência manual (tela)

- Compartilhar um animal pelo celular e ver a prévia com foto no WhatsApp (precisa do app publicado: o WhatsApp não lê `localhost`).
- Abrir o link: a página pública abre no município certo com a janela do animal.
- Animal adotado e animal apagado mostram os avisos.
- No computador, o botão copia o link e mostra "Link copiado".

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

- WhatsApp costuma não mostrar a imagem de prévia acima de ~300 KB: as fotos já cadastradas (até 2 MB) podem sair sem foto; as novas vêm comprimidas.
- Texto digitado entrando no HTML: coberto pelo escape e pelos testes.
- Rotas públicas novas: não expõem nada além da lista pública.
- Custo no Render: decodificar a foto por pedido é leve; o cache de 1 dia e o ETag evitam repetir; o `index.html` fica em memória.
- A prévia só funciona com o app publicado em domínio acessível (não em `localhost`).
- Commit e push direto em `main`, sem `staging`.

---

## Perguntas em aberto

- Assumidas as recomendações apresentadas no chat (o usuário aprovou sem responder): (1) comprimir as fotos novas no navegador; (2) quem está logado e abre o link vê o app normal. Ajustar se o usuário disser outra coisa.

---

## Critérios de aceite

- O link `/adocao/<id>` mostra prévia com foto, nome e resumo e abre a janela do animal na página pública do município dele.
- Botão "Compartilhar" na janela pública e no card interno, com menu nativo ou cópia.
- Animal adotado e inexistente tratados como nas regras.
- Nenhum campo fora de `publicAdoption` sai pelas rotas novas; textos escapados; foto só raster.
- Fotos novas de adoção chegam comprimidas.
- O brasão continua funcionando; typecheck, testes (front e back) e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
