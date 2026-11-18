# Plano de Implementação: Brasão municipal e logo do órgão

## Origem

- Arquivo de especificação: pedido no chat (2026-11-17), com print do modal "Editar município"
- Data do planejamento: `2026-11-17`
- Classificação: `frontend + backend + database`

---

## Resumo

O cadastro do município passa a ter duas imagens: o **brasão municipal** (já existe) e o **logo do órgão** (novo). As duas ficam disponíveis como variáveis em todos os e-mails e aparecem no topo da home pública. A revisão da imagem atual corrigiu três falhas: SVG aceito no formulário mas nunca entregue ao e-mail, imagem sem limite de tamanho e brasão perdido ao criar o município.

---

## Escopo

### Dentro do escopo

- Coluna `department_logo` em `municipalities`.
- Formulário "Editar município" com duas caixas de imagem lado a lado: "Brasão do município" e "Logo do órgão".
- Envio de imagem: só PNG, JPG e WEBP; redesenhada no navegador para no máximo 512 px no lado maior, em PNG (mantém transparência).
- Back aceita `department_logo` no `PATCH` (master/suporte e quem tem "Dados Gerais") e no `POST` de criação, junto com o `brasao`.
- Back recusa imagem que não seja data URL raster (PNG/JPG/WEBP/GIF) ou que passe de 2 MB; string vazia remove a imagem.
- Rota pública `/api/public/municipalities/:id/department-logo`, igual à do brasão.
- Variável de e-mail `department_logo_url` nas variáveis de identidade (todas as mensagens).
- Aba E-mail: "Brasão: cadastrado · Logo do órgão: não cadastrado ⚠"; texto do endereço público cita as duas imagens.
- Home pública: logo do órgão no topo, depois do nome da secretaria, separado por uma linha fina.

### Fora do escopo

- Menu lateral do admin (continua só com o brasão).
- Receita impressa (`buildPrescriptionPrintHtml`, continua com o brasão).
- Montar os templates no EmailJS (é o usuário quem faz).
- Reprocessar brasões já salvos (seguem como estão; só imagens novas passam pelo redimensionamento).
- Tirar as imagens da lista pública de municípios (`SELECT *`): fica como está; o redimensionamento já reduz o peso.

---

## Leitura de contexto

- `/AGENT.md`
- `backend/src/db/migrations.js` (colunas do município: `department_name`, `address_number`)
- `backend/src/routes/municipalities.js` (`POST /`, `PATCH /:id`, `MUNICIPALITY_SELF_EDIT_FIELDS`)
- `backend/src/routes/municipality-brasao.js`, `backend/src/services/raster-image.js`
- `backend/src/repositories/municipality-identity.js`, `backend/src/services/email-identity.js`
- `shared/email-uses-contract.js`, `shared/email-contract.js`
- `src/App.tsx` (topo da home ~1832, formulário ~8079, `saveMunicipality` ~6468)
- `src/features/municipality-form/municipality-address.ts`
- `src/features/email/email-integration-tab.tsx`, `email-credentials.tsx`, `email-integration-types.ts`
- `src/features/adoption-share/compress-adoption-photo.ts` (`fittedSize`, `dataUrlBytes`)
- `backend/test/municipality-brasao.test.js`, `backend/test/fixtures/email-config-db.js`

---

## Impacto por área

### Frontend

- `MunicipalityForm` ganha `departmentLogo` (em `formFromMunicipality` lê `department_logo`/`departmentLogo`).
- Componente novo em `src/features/municipality-form/` para a caixa de imagem (prévia, remover, selecionar), usado duas vezes no formulário; o bloco atual do brasão sai do App.tsx.
- Função nova de preparo da imagem (redesenho até 512 px em PNG), reaproveitando `fittedSize` e `dataUrlBytes` de `compress-adoption-photo.ts`. Arquivo de tipo não aceito ou imagem que não cabe em 2 MB mostra mensagem curta no status do formulário.
- Home (`public-topbar-brand`): logo do órgão depois do nome da secretaria, com linha fina antes; sem logo, nada muda. Estilo reaproveita `brand-brasao` no `styles.css` (ajustar a regra que decide, sem `!important`).
- Aba E-mail: status das duas imagens e texto do endereço público.

### Backend

- `municipalities.js`:
  - `department_logo` em `MUNICIPALITY_SELF_EDIT_FIELDS`; `departmentLogo` mapeado para `department_logo` como já se faz com `departmentName`.
  - `POST /` grava `brasao` e `department_logo` no `INSERT` e no `ON CONFLICT` (hoje o brasão enviado na criação é descartado).
  - Validação das duas imagens antes de gravar (400 com mensagem humanizada).
- `municipality-brasao.js` vira `municipality-images.js`: `GET /:id/brasao` e `GET /:id/department-logo`, mesmo handler, mesmo 404 para todo caso inválido.
- `municipality-identity.js`: `has_department_logo` na identidade; leitura da imagem por coluna fixa (lista fechada, sem interpolar valor do client).
- `email-identity.js`: `department_logo_url` com o mesmo `?v=updated_at`; resumo devolve o status das duas imagens.

### Banco de dados

- `ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS department_logo TEXT;` em bloco novo no `migrations.js` (padrão de `department_name`/`address_number`). Roda no boot do back.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado (sem env nova). A coluna nasce no boot ao publicar.

---

## Arquivos provavelmente afetados

- `backend/src/db/migrations.js`
- `backend/src/routes/municipalities.js`
- `backend/src/routes/municipality-images.js` _(novo, substitui `municipality-brasao.js`)_
- `backend/src/server.js` (import da rota)
- `backend/src/repositories/municipality-identity.js`
- `backend/src/services/email-identity.js`
- validação da imagem: função em `backend/src/services/raster-image.js` (reaproveita `decodeRasterDataUrl`)
- `shared/email-uses-contract.js`, `shared/email-contract.js`
- `src/App.tsx` _(topo da home, formulário do município)_
- `src/features/municipality-form/municipality-address.ts` + componente e preparo de imagem novos
- `src/features/email/email-integration-tab.tsx`, `email-credentials.tsx`, `email-integration-types.ts`
- `src/styles.css` (regra do logo no topo)
- Testes: `backend/test/municipality-images.test.js` (substitui `municipality-brasao.test.js`), `email-identity.test.js`, `email-templates.test.js`, `fixtures/email-config-db.js`, teste de rotas do município se existir; `src/features/email/email-integration.test.tsx`, `src/features/municipality-form/municipality-address.test.ts`, teste do preparo de imagem

---

## O que será removido

- `backend/src/routes/municipality-brasao.js` e `backend/test/municipality-brasao.test.js` (substituídos por `municipality-images`).
- `image/svg+xml` do `accept` do envio de imagem.
- O bloco JSX do brasão no formulário do App.tsx (vira o componente reutilizado).
- `EmailBrasaoStatus` em `shared/email-contract.js`, trocado por `EmailImageStatus` (mesmos valores, serve às duas imagens); o mapa `brasaoText` da aba E-mail vira um mapa genérico.
- Import de `municipalityBrasaoRoutes` no `server.js`.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Migration: bloco novo com `department_logo` no `migrations.js`.
2. `shared/`: `EmailVariable.DEPARTMENT_LOGO_URL = "department_logo_url"` em `EMAIL_IDENTITY_VARIABLES`; `EmailBrasaoStatus` → `EmailImageStatus`.
3. Back: validação de imagem (raster, ≤ 2 MB, vazio permitido) em `raster-image.js`; `POST`/`PATCH` do município com `brasao` e `department_logo`; rota `municipality-images.js`; repositório e `email-identity.js`.
4. Front: campo no `MunicipalityForm`, preparo da imagem, componente da caixa de imagem, formulário com as duas caixas lado a lado.
5. Home: logo do órgão no topo + regra de estilo.
6. Aba E-mail: status das duas imagens e textos.
7. Testes (abaixo) e validação uma vez ao final.

---

## Regras de negócio identificadas

- Duas imagens independentes, ambas opcionais: brasão (da prefeitura) e logo do órgão (da secretaria que toca o programa).
- Nos e-mails, cada imagem vira um link público; vazio quando não há imagem ou quando o endereço público do sistema não foi configurado.
- `municipality_brasao_url` mantém o nome para não quebrar templates já montados no EmailJS.
- Na home, sem logo do órgão o topo fica como hoje.

---

## Regras multi-tenant e segurança

- `PATCH` mantém a regra atual: fora do global, só o próprio município e com "Dados Gerais".
- Rotas públicas das imagens: só UUID válido, só município ativo, só raster (SVG nunca é servido), `nosniff`, mesmo 404 para todo caso inválido.
- Coluna lida por nome fixo no código, nunca vinda do client.
- Validação no back recusa conteúdo que não seja imagem raster, mesmo vindo de fora do formulário.

---

## Validações necessárias

- Front: tipo PNG/JPG/WEBP; resultado ≤ 2 MB após o redesenho.
- Back: `brasao` e `department_logo` vazios ou data URL raster ≤ 2 MB; caso contrário 400 "Envie uma imagem PNG, JPG ou WEBP de até 2 MB."

---

## Testes necessários

### Frontend

- `formFromMunicipality` lê `department_logo`.
- Preparo da imagem: tamanho redesenhado e recusa de tipo/tamanho.
- Aba E-mail mostra o status das duas imagens e lista `{{department_logo_url}}`.

### Backend

- Rotas públicas: brasão e logo servidos (tipos raster, cache, 304), 404 para SVG, inativo, inexistente, UUID inválido.
- `email-identity`: `department_logo_url` com versão; vazio sem logo ou sem endereço público.
- `email-templates`: a variável nova aparece em todas as mensagens.
- Município: `PATCH` recusa imagem inválida e aceita vazio; `POST` grava as duas imagens.

### Conferência manual (tela)

- Editar município: enviar brasão e logo, salvar, recarregar e ver as duas.
- Home do município: logo do órgão no topo, depois do nome da secretaria; sem logo, topo igual a hoje (inclusive no celular).
- Aba E-mail: "Brasão" e "Logo do órgão" com o status certo.

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

- Coluna nova no boot: só `ADD COLUMN IF NOT EXISTS`, sem efeito em dados existentes.
- No EmailJS, cada `<img>` deve ficar dentro de `{{#department_logo_url}}…{{/department_logo_url}}` (e do brasão), senão município sem imagem recebe ícone quebrado.
- Brasões já salvos acima de 2 MB ou em SVG continuam fora do e-mail até serem reenviados.
- Topo da home no celular: conferir que nome, secretaria, logo e chip de município cabem sem quebrar.
- Commit e push direto em `main`.

---

## Perguntas em aberto

Sem resposta no planejamento; assumidas as recomendações:

1. Logo do órgão no topo da home, ao lado do brasão (não no rodapé).
2. Correção de SVG e tamanho incluída.
3. Nome da variável: `department_logo_url`.

Acrescentado depois da aprovação, por ser da mesma revisão: a criação do município (`POST /`) grava o brasão e o logo (hoje o brasão enviado na criação é descartado).

---

## Critérios de aceite

- O modal do município tem "Brasão do município" e "Logo do órgão", e as duas imagens persistem após salvar e recarregar, tanto ao editar quanto ao criar.
- SVG e imagem acima de 2 MB não são aceitos, nem pela tela nem direto na API.
- Todo e-mail recebe `municipality_brasao_url` e `department_logo_url` (vazias quando não há imagem ou endereço público).
- A home mostra o logo do órgão no topo quando cadastrado.
- Typecheck, testes e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
