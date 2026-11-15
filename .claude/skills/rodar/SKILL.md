---
name: rodar
description: Sobe o frontend (Vite, porta 5175) e o backend (Express, porta 3002) deste projeto e confirma que ambos responderam. Caminho rápido, sem browser/Playwright/screenshot — só o start e um check HTTP. Use quando o usuário pedir para "rodar o projeto", "subir o app", "testar se sobe" ou similar.
---

# Rodar projeto (caminho rápido)

Sobe backend + frontend e confirma com `curl` que os dois estão de pé.
Não abre browser, não interage com UI, não tira screenshot — é só o
caminho de "sobe e confirma".

## Pré-requisito

Postgres local precisa estar acessível na porta usada por
`backend/.env` (`DATABASE_URL`, normalmente `localhost:5433`). Se não
estiver, o backend sobe mas falha nas rotas que tocam banco — ainda
assim o processo escuta na porta 3002.

## Passos

1. Checar se as portas 5175 e 3002 já estão em uso (processo antigo
   ainda rodando). Se estiverem, avisar o usuário e perguntar se pode
   reaproveitar ou se quer derrubar antes de subir de novo — não matar
   processo por conta própria sem avisar.

```bash
powershell -Command "Test-NetConnection -ComputerName localhost -Port 5175 -InformationLevel Quiet"
powershell -Command "Test-NetConnection -ComputerName localhost -Port 3002 -InformationLevel Quiet"
```

2. Subir os dois com o script já existente do projeto (`npm run dev`
   usa `concurrently` para rodar `vite` e `node backend/src/server.js`
   juntos), em background:

```bash
npm run dev
```

Use a ferramenta de background (não bloquear a sessão). Não precisa
`cd` — rodar a partir da raiz do repo.

3. Esperar as portas responderem (não usar `sleep` fixo — pollar):

```bash
timeout 30 bash -c 'until curl -sf http://localhost:3002 >/dev/null || curl -s -o /dev/null -w "%{http_code}" http://localhost:3002 | grep -qv "000"; do sleep 0.5; done'
timeout 30 bash -c 'until curl -sf http://localhost:5175 >/dev/null; do sleep 0.5; done'
```

4. Validar com um curl simples em cada porta e reportar o resultado:

```bash
curl -s -o /dev/null -w "BACK  %{http_code}\n" http://localhost:3002/
curl -s -o /dev/null -w "FRONT %{http_code}\n" http://localhost:5175/
```

- Backend: qualquer resposta HTTP (mesmo 404 numa rota sem match) já
  prova que o Express está de pé. Se quiser mais confiança, bata numa
  rota de `/api/...` conhecida.
- Frontend: 200 no `/` do Vite confirma que o dev server está servindo
  o `index.html`.

5. Reportar ao usuário: portas confirmadas, PID/processo em background
   (para ele saber que pode parar depois), e se algum log mostrou erro
   (ex: `EADDRINUSE`, erro de conexão com o Postgres).

## Não fazer

- Não instalar Playwright/chromium-cli nem abrir browser — isso é
  responsabilidade da skill `run` (built-in), não desta.
- Não derrubar o processo automaticamente ao final — deixar rodando,
  já que o objetivo é ter o app de pé para o resto da sessão. Só
  derrubar se o usuário pedir.
- Não rodar `npm install` a menos que falte alguma dependência (dev
  já roda com `node_modules` existente na maioria dos casos).
