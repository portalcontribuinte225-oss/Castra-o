# Plano: aba "E-mail" nas integrações e configuração separada por canal

## Origem

- Complemento operacional das fases 4 e 5 de `.portal/specs/solicitacao-animal-cadastrado-e-acesso-tutor.md` (canais de notificação e templates de acesso). Não é uma fase nova do roadmap.
- Data: 2026-11-15. Base: commit `1d380bf` (status de e-mail e merge por canal no backend, com testes).
- Classificação: `frontend-only`. O backend já está pronto.
- Decisão do usuário: **separar por canal**. A aba E-mail concentra o que é de e-mail; a aba WhatsApp fica só com o que é de WhatsApp.

## Resumo

Hoje a aba WhatsApp (Integrações) mistura os templates de e-mail com os de WhatsApp. O backend já faz merge por canal com lock transacional, então cada aba pode salvar somente o seu canal sem apagar o outro.

## Escopo

- Nova aba **E-mail** em Integrações, com:
  - status somente leitura das credenciais do EmailJS (`GET /config/email/status`: só indicadores, nunca valores);
  - template de notificações por e-mail (`emailTemplateId`);
  - templates de acesso por e-mail (senha inicial, recuperação, confirmação de e-mail, contato alterado).
- Aba **WhatsApp** passa a mostrar só os templates de WhatsApp (eventos de notificação e templates de acesso).
- `NotificationSettings` e `AuthDeliverySettings` recebem `channel`; cada um salva **apenas os campos do seu canal**.
- Permissão `email_settings` ("Aba E-mail") no grupo de permissões e mesma regra de visibilidade da aba SMS: administrador municipal/global e, havendo grupos, permissão `email_settings`.

## Fora do escopo

- Qualquer mudança de backend, migration, `.env` ou dependência.
- Editar credenciais do EmailJS pela tela (continuam nas variáveis do servidor).
- Envio de e-mail de teste.
- Mudar a ordem padrão de abertura das abas (WhatsApp continua a primeira).

## Arquivos

- `src/features/notifications/use-notification-settings.ts` e `notification-settings.tsx`: parâmetro `channel`; `notificationChannelPatch` envia só `emailTemplateId` ou só `whatsappTemplates`.
- `src/features/tutor-access/use-auth-delivery-settings.ts` e `auth-delivery-settings.tsx`: parâmetro `channel`; `authChannelPatch` envia só `emailTemplates` ou só `whatsappTemplates`; propósitos filtrados por canal (confirmação de e-mail só no e-mail, confirmação de telefone só no WhatsApp).
- `src/features/email/use-email-status.ts` e `email-settings.tsx` (novos): consulta do status e composição da aba.
- `src/App.tsx`: aba, permissão, visibilidade e as duas chamadas da aba WhatsApp.
- Testes em `src/features/email/email-settings.test.tsx`.

## Validação

- typecheck, vitest do frontend e testes do backend (sem alteração de backend, só para confirmar que nada regrediu), build.
- Sem inspeção visual no navegador, salvo pedido. Conferir na tela: aba E-mail com status e templates; aba WhatsApp sem campos de e-mail; salvar numa aba não apaga o outro canal.
