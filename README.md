# CastraGestao Animal

Protótipo PWA em React para gestão de solicitações de castração animal, agenda, adoção, mapas territoriais, relatórios e configurações administrativas.

## Como Rodar

```bash
npm install
npm run dev
```

A aplicação usa uma porta fixa para evitar conflito com outros sistemas:

- Testes/preview de produção: http://localhost:5198
- Desenvolvimento com HMR: http://localhost:5199

## Usuarios de Teste

As credenciais ficam em `.env`:

```bash
VITE_ADMIN_EMAIL=admin@castragestao.local
VITE_ADMIN_PASSWORD=Admin@123
VITE_TUTOR_EMAIL=tutor@castragestao.local
VITE_TUTOR_PASSWORD=Tutor@123
```

Tambem existe `.env.example` para servir de modelo quando as senhas forem trocadas.

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Escopo Implementado

- Dashboard do tutor com solicitações e próxima ação.
- Formulário multi-etapas de nova solicitação.
- Dashboard administrativo com fila, detalhe e transições de status.
- Fluxo corrigido com `REAGENDAMENTO_SOLICITADO` separado de `REAGENDADA`.
- Estado intermediário `AGUARDANDO_AGENDAMENTO` entre deferimento e agendamento.
- Agenda semanal, módulo de adoção, mapas territoriais e relatórios preparados para dados criados no teste.
- Manifesto PWA, ícone e service worker básico.

## Pendências Para Backend

- Autenticação real, RBAC e sessão.
- Persistência em banco de dados.
- Upload de documentos.
- Geração de PDF.
- Integrações com SMS, email, push, ViaCEP e mapas.
- Auditoria completa e logs por ação.
