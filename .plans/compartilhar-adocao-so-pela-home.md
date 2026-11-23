# Plano de Implementação: link do animal de adoção sempre abre a home pública

## Origem

- Arquivo de especificação: pedido no chat, sem `.md`. Pontos do pedido: "o link só pode ser compartilhado pela home", "ninguém pode abrir o link já logado", "o link deve direcionar para a home direto no animal", "algo simples".
- Data do planejamento: `2026-11-23`
- Classificação: `frontend-only`. O servidor já responde `/adocao/<id>` com a prévia (`backend/src/routes/adoption-share.js`) e a home já abre o animal (`useSharedAdoption` + `AdoptionCarousel`). Mudam só duas coisas: como o navegador trata a sessão salva ao abrir o link e onde o botão Compartilhar aparece.

---

## Resumo

O link do animal (`/adocao/<id>`) serve só para quem tem interesse em adotar. Hoje, quem abre o link num navegador com sessão salva (equipe ou tutor) cai no painel ou na área do tutor, sem ver o animal. Além disso, o endereço fica preso em `/adocao/<id>` e, ao sair da conta, a home abre sozinha no animal.

Depois desta mudança, o link sempre abre a home pública já no animal, como para qualquer visitante, e a sessão salva não é encerrada. O botão Compartilhar fica só no modal do animal na home.

---

## Escopo

### Dentro do escopo

- A página aberta por um link de adoção ignora a sessão salva (não valida nem envia) até alguém entrar por ela.
- A sessão salva não é apagada: as outras abas seguem logadas, e recarregar ou abrir o site de novo volta ao painel ou à área do tutor.
- Remover o Compartilhar da tela interna de adoção (grade e lista) e o formato de ícone do botão.
- Remover a condição `!currentUser` do gancho do link.
- Teste do modo visitante.

### Fora do escopo

- Servidor: a rota `/adocao/:id`, a prévia (`og:*`), `/api/adoptions/:id/public` e `/api/adoptions/:id/photo` ficam como estão.
- Botão "Voltar ao painel" na home aberta pelo link (não pedido).
- Botão de compartilhar no card da home (sugestão não pedida).
- Links de acesso à solicitação (`readAccessLink`) abertos com sessão salva: mesmo padrão, não pedido.
- Textos da prévia e do compartilhamento.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- `shared/adoption-contract.js` (`ADOPTION_SHARE_PREFIX`, `adoptionSharePath`, `readAdoptionShareId`)
- `backend/src/routes/adoption-share.js`, `backend/src/services/adoption-share.js`, `backend/src/repositories/adoption-share.js`
- `backend/src/routes/adoptions.js` (`GET /` com `optionalAuth`) e `backend/src/tenant.js` (`pickMunicipalityId`: o usuário logado que não é global fica no próprio município e a query é ignorada)
- `src/api.ts` (`getToken`, `headers`, `request`, gravações do token, `logout`)
- `src/main.tsx`
- `src/features/tutor-access/use-session.ts` e `src/features/tutor-access/session-boundary.tsx`
- `src/features/adoption-share/share-adoption-button.tsx`, `share-adoption.ts`, `use-shared-adoption.ts`, `shared-adoption-notice.tsx`
- `src/App.tsx`, só os trechos: 210, 361-374 (`App`), 439-463, 761-765, 795-810, 1302-1335, 1515, 1655-1661, 3859, 3901
- `src/features/tutor-access/auth-api.test.ts` e `src/features/tutor-access/use-session.test.ts`
- `public/sw.js` (a navegação vai primeiro à rede, então o `/adocao/<id>` chega ao servidor)

---

## Impacto por área

### Frontend

1. **`src/api.ts`, modo visitante:**
   - `let ignoresSavedSession = false;` com um comentário curto: a página aberta por um link de adoção ignora a sessão salva até alguém entrar por ela; a sessão continua guardada para as outras abas e para a próxima visita.
   - `getToken()` devolve `null` enquanto `ignoresSavedSession` estiver ligado. O código atual já garante o resto:
     - `headers()` não põe `Authorization`;
     - `request()` só dispara `SESSION_INVALID_EVENT` quando a requisição levou token (`requestToken`), então nenhum 401 na página do link apaga a sessão salva;
     - `api.hasToken()` fica falso.
   - `function saveToken(token: string)` desliga a flag e grava `localStorage.setItem("castragestao:token", token)`. Ela substitui as 4 gravações diretas: `login` (linha 82), `changePassword` (103), renovação em `upsertAuthUser` (130) e `requestAccess.createPassword` (184).
   - `api.ignoreSavedSession()` liga a flag.
   - `logout()` não muda.
   - O `bearerToken` explícito (acompanhamento e acesso à solicitação) não muda: `headers()` continua usando `bearerToken ?? getToken()`.
2. **`src/main.tsx`:** antes do `createRoot(...).render`, entra `if (readAdoptionShareId(window.location.pathname)) api.ignoreSavedSession();` com um comentário de uma linha. Daí em diante o fluxo já existente resolve o resto:
   - o efeito do `useSession` vê `hasToken()` falso e fica pronto sem usuário, sem validar a sessão;
   - o `SessionBoundary` mostra a home pública (`renderWorkspace(null)`);
   - o `useSharedAdoption` abre o animal e volta o endereço para `/`.
3. **`src/features/adoption-share/use-shared-adoption.ts`:** a assinatura passa a ser `useSharedAdoption(onMunicipality)`, sem `enabled`, e o id vem de `useState(() => readAdoptionShareId(window.location.pathname))`. A condição deixa de ser necessária porque só a home pública chega a ver um link de adoção: com sessão salva a página é de visitante, e depois do primeiro carregamento o endereço já é `/`.
4. **`src/App.tsx`:**
   - linhas 439-440: `const sharedAdoption = useSharedAdoption(handleMunicipalitySelect);`, com o comentário atualizado (o link sempre abre a home pública no animal; ver `main.tsx`);
   - remover `<ShareAdoptionButton animal={animal} look={ShareButtonLook.ICON} />` nas linhas 3859 (grade) e 3901 (lista), junto com a condição `animal.status !== ADOPTION_STATUS_ADOPTED &&` de cada um;
   - linha 210: o import fica só com `ShareAdoptionButton`;
   - linha 1515 (modal da home): sem mudança.
5. **`src/features/adoption-share/share-adoption-button.tsx`:** passa a ser `ShareAdoptionButton({ animal }: { animal: AnyRecord })`, só com o botão largo atual, sem enum, sem prop `look` e sem o trecho do ícone.

Estados de carregamento, animal encontrado, adotado e indisponível: a home do link já trata todos (`SharedAdoptionState`, `SharedAdoptionNotice`). Sem mudança.

### Backend

Sem impacto esperado. A página do link passa a fazer as chamadas públicas sem sessão, e o servidor responde como responde a qualquer visitante.

### Banco de dados

Sem impacto esperado.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita, porque o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado. O front só muda na tela depois de `npm run build`, porque o back serve o `dist`. A prévia com foto continua funcionando só no domínio publicado.

---

## Arquivos provavelmente afetados

- `src/api.ts`
- `src/main.tsx`
- `src/features/adoption-share/use-shared-adoption.ts`
- `src/features/adoption-share/share-adoption-button.tsx`
- `src/App.tsx` _(arquivo grande: só as linhas 210, 439-440, 3859 e 3901)_
- `src/features/adoption-share/shared-link-session.test.ts` _(novo)_

---

## O que será removido

- `src/App.tsx:3859` e `src/App.tsx:3901`: os dois `<ShareAdoptionButton ... look={ShareButtonLook.ICON} />` da tela interna (grade e lista), com a condição de status de cada um.
- `src/App.tsx:210`: `ShareButtonLook` no import.
- `src/features/adoption-share/share-adoption-button.tsx`: o enum `ShareButtonLook`, a prop `look` e o trecho `if (look === ShareButtonLook.ICON) { ... }`.
- `src/features/adoption-share/use-shared-adoption.ts`: o parâmetro `enabled` e o `enabled ? ... : ""`.
- `src/App.tsx:439-440`: a condição `!currentUser` e o comentário "whoever is signed in sees the app as usual".
- `src/api.ts`: as 4 chamadas diretas `localStorage.setItem("castragestao:token", ...)`, trocadas por `saveToken(...)`.
- CSS: nenhum. O formato de ícone usava só classes utilitárias `tw:`, e `adoptionIconButtonStyle` continua em uso pelos outros botões da tela interna.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. `src/api.ts`: criar a flag `ignoresSavedSession`, o `getToken()` que respeita a flag, o `saveToken()` e o `api.ignoreSavedSession()`, e trocar as 4 gravações diretas do token.
2. `src/main.tsx`: ligar o modo visitante antes do primeiro render quando o endereço for um link de adoção.
3. `src/features/adoption-share/use-shared-adoption.ts`: tirar o `enabled`.
4. `src/App.tsx`: ajustar a chamada do gancho e o comentário, remover os dois botões internos e tirar `ShareButtonLook` do import.
5. `src/features/adoption-share/share-adoption-button.tsx`: remover o formato de ícone.
6. Criar `src/features/adoption-share/shared-link-session.test.ts` (ver "Testes necessários").
7. Rodar a validação da raiz uma vez no fim.

---

## Regras de negócio identificadas

- O link do animal é para quem tem interesse em adotar: sempre abre a home pública, direto no animal.
- Ninguém abre o link como logado. Com sessão salva no navegador (equipe ou tutor), a página do link é a de um visitante.
- Abrir o link não encerra a sessão salva. As outras abas seguem logadas, e recarregar ou abrir o site de novo volta ao painel ou à área do tutor.
- Entrar pela home do link vale como qualquer login: a sessão nova passa a valer.
- Compartilhar só pela home, no modal do animal. A tela interna de adoção não compartilha.
- Animal adotado ou indisponível continua com o aviso de hoje na home.

---

## Regras multi-tenant e segurança

- A página do link não envia a sessão salva, então o servidor responde como a um visitante. Antes, com sessão, `GET /api/adoptions` devolvia o município de quem está logado (`pickMunicipalityId` ignora o `municipalityId` da query para quem não é global). Para quem administra adoções, vinham também as linhas internas, com os interessados. Nada disso chega mais à home.
- Nenhuma rota, permissão ou escopo de município muda no servidor.
- Um 401 na página do link não dispara o aviso de sessão inválida, porque a requisição vai sem token. Assim a sessão salva das outras abas não é apagada.
- O município da home continua vindo do animal (`onMunicipality` chama `handleMunicipalitySelect`).
- Sem impacto em relatórios ou PDFs.

---

## Validações necessárias

- Quem decide o modo visitante é só `readAdoptionShareId`, que já existe e aceita só o caminho `/adocao/<uuid>`. Qualquer outro endereço segue o fluxo normal.
- Sem campos ou payloads novos.

---

## Testes necessários

### Frontend

- Novo `src/features/adoption-share/shared-link-session.test.ts`. Fica num arquivo próprio porque o modo visitante é estado do módulo da API, e o vitest isola os módulos por arquivo. `localStorage` e `fetch` são trocados como em `auth-api.test.ts`, só com valores falsos.
  1. Sessão salva + `api.ignoreSavedSession()`: `api.hasToken()` é falso; uma chamada pública (ex.: `api.getPublicAdoption(id)`) sai sem `Authorization`; um 401 com `AuthErrorCode.SESSION_INVALID` não dispara `SESSION_INVALID_EVENT`; o token salvo continua no armazenamento.
  2. Em seguida, `api.login(...)` na mesma página: grava o token novo, `api.hasToken()` passa a verdadeiro e a próxima chamada leva `Authorization: Bearer <token novo>`. Como o login desliga a flag, o arquivo termina sem o modo ligado.
- `auth-api.test.ts` e `use-session.test.ts` devem continuar passando sem mudança. A gravação segue na mesma chave e o `use-session` usa a API simulada.

### Backend

- Nenhum teste novo, porque o backend não muda. Rodar a suíte para confirmar.

### Conferência manual (tela)

- Logado como equipe, abrir `/adocao/<id>` de um animal disponível: aparece a home pública do município do animal com o modal aberto, e o endereço volta a `/`.
- Recarregar: volta ao painel logado. Uma outra aba com o painel aberto continua funcionando.
- Logado como tutor: o mesmo resultado.
- Sem sessão: igual a hoje.
- Animal adotado ou apagado: aviso na home, como hoje.
- Tela interna de adoção (grade e lista): sem o ícone de compartilhar. O modal da home mantém o botão "Compartilhar".

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

- A leitura do token é a base do login. A mudança se limita a deixar de ler o token enquanto a página é de visitante e a gravar por uma função única. O teste novo cobre os dois lados, e os de `auth-api.test.ts` continuam valendo.
- `main.tsx` precisa ligar o modo antes do primeiro render, porque o efeito do `useSession` lê `hasToken()` logo depois de montar.
- Para voltar ao painel depois de abrir o link, basta recarregar ou abrir o site de novo; no app instalado (PWA), fechar e abrir. Entrar pela home do link troca a sessão salva pela nova, como qualquer login.
- Se outra aba entrar com outra conta enquanto a página do link está aberta, a página do link continua como visitante: a flag só desliga com um login feito nela.
- Commit e push direto em `main`. Publicar só com autorização; se o envio for só ao GitHub, usar `[skip render]`.
- Sem migrations e sem mudança no contrato entre front e back.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. A sessão é mantida ao abrir o link, como combinado no chat.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- abrir `/adocao/<id>` com sessão salva (equipe ou tutor) mostra a home pública no animal, sem validar a sessão e sem passar pelo painel;
- a sessão salva continua no navegador, e recarregar volta ao painel;
- na página do link, nenhuma chamada leva a sessão salva, e um 401 não encerra a sessão das outras abas;
- um login feito na home do link passa a valer normalmente;
- o Compartilhar aparece só no modal do animal da home, e a grade e a lista internas não têm o ícone;
- `ShareButtonLook`, a prop `look`, o parâmetro `enabled` e as gravações diretas do token não existem mais;
- typecheck, testes (front e back) e build passam sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
