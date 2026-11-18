# Plano de Implementação: Templates do WhatsApp ligados a avisos e variáveis escolhidas na tela

## Origem

- Arquivo de especificação: pedido no chat (2026-11-18), com print da aba WhatsApp → Templates e esboço aprovado
- Data do planejamento: `2026-11-18`
- Classificação: `frontend + backend` (contrato compartilhado; sem migration, tudo na tabela `config`)

---

## Resumo

Hoje o sistema decide qual aviso um template da Meta envia só pelo nome (`castracao_<aviso>`) e preenche `{{1}}`, `{{2}}`… numa ordem fixa no código. Templates criados com outros nomes (ex.: `castracao_confirmacao_cadastro`, `castracao_nao_comparecimento`) aparecem como "Template padrão da Meta, não usado pelo sistema". A tela passa a permitir, por template, escolher o aviso e o que vai em cada número, com prévia da mensagem. Sem configuração, vale a regra do nome como hoje.

---

## Escopo

### Dentro do escopo

- **Tabela de templates:** botão "Configurar" (ícone ⚙) em cada linha, visível só para o master.
- **Coluna "Aviso":** mostra o aviso configurado; sem configuração, o reconhecido pelo nome com a marca "(pelo nome)"; sem nenhum, "Não usado pelo sistema".
- **Janela "Configurar template":**
  - cabeçalho com nome, idioma e status;
  - texto do template como está na Meta, com `{{n}}` destacados, cada número na cor do seu select;
  - select "Qual aviso este template envia?" com os 7 avisos (Solicitação registrada, Agendamento confirmado, Agendamento alterado, Não comparecimento, Documentos conferidos, Atendimento concluído, Solicitação indeferida) ou "Nenhum";
  - um select por número ("O que vai em `{{n}}`") com as variáveis de `whatsappFieldLabels`; ao escolher o aviso, os selects vêm na ordem padrão daquele aviso;
  - prévia ao vivo com dados de exemplo (`previewRequest`);
  - "Salvar" (bloqueado com número sem variável: "Escolha o que vai em {{n}}"), "Cancelar" e "Voltar ao padrão do nome" (apaga a configuração);
  - template fora das regras de estrutura: mostra o motivo no lugar dos selects; catálogo sem texto: "Sincronize os templates para ver o texto", com os selects disponíveis.
- **Sincronização** passa a guardar o texto do corpo (`bodyText`, até 1100 caracteres) no catálogo.
- **Ativação:** um template configurado liga para o aviso escolhido; trocar o aviso de um template ligado o desliga (liga de novo na tabela); trocar só as variáveis o mantém ligado.
- **Envio:** cada `{{n}}` recebe a variável escolhida; sem configuração, a ordem padrão do aviso.

### Fora do escopo

- Templates de código de acesso (recuperação de senha, confirmação, acompanhamento) e de contato alterado: estrutura fixa (botão de copiar código), continuam reconhecidos só pelo nome.
- Aliases fixos no código para os nomes atuais (a configuração na tela substitui).
- Criar ou editar templates na Meta.

---

## Leitura de contexto

- `/AGENT.md`
- `shared/whatsapp-templates-contract.js` (`whatsappUses`, `recognizeWhatsappTemplate`, `normalizeActiveTemplates`, `activateTemplate`, `isWhatsappTemplateUsable`)
- `backend/src/services/whatsapp-graph-templates.js` (`describeGraphTemplate`), `whatsapp-catalog.js`, `whatsapp-active-templates.js` (`buildTemplateRows`, `setWhatsappTemplateActive`, `resolveActiveTemplate`)
- `backend/src/services/notifications/whatsapp-template-parameters.js` (`resolveWhatsappField`, `buildBodyComponents`, `previewRequest`), `dispatch-notification.js`
- `backend/src/routes/whatsapp.js`, `backend/src/services/auth/auth-message-delivery.js`, `recovery-channels.js`
- `src/features/whatsapp-integration/*` (tabela, painel, hook, tipos, display, lista de variáveis, testes)

---

## Impacto por área

### Frontend

- `whatsapp-templates-table.tsx`: coluna "Aviso" com "(pelo nome)"/"Não usado pelo sistema"; botão ⚙ "Configurar" só para o master.
- Nova `whatsapp-template-link-modal.tsx`: a janela descrita acima (texto com números destacados, select do aviso, selects por número, prévia, validação, salvar/cancelar/voltar ao padrão).
- `use-whatsapp-templates.ts`: salvar e remover a configuração (via `src/api.ts`), atualizando a lista com a resposta.
- `whatsapp-integration-types.ts`: linha com `bodyText`, `bodyVariables`, `configured` (se há configuração), `fields` (variáveis por número), `structureReason`.
- `whatsapp-template-display.ts`: textos novos; montagem da prévia (substituir `{{n}}` pelo valor de exemplo).
- `whatsapp-templates-panel.tsx`: sem a lista de variáveis de consulta.

### Backend

- `whatsapp-graph-templates.js`: `describeGraphTemplate` devolve `bodyText`.
- `whatsapp-catalog.js`: `normalizeEntry` aceita `bodyText` opcional (string ≤ 1100; ausente vira `""`, sem descartar entradas antigas).
- `whatsapp-active-templates.js`:
  - carregar a configuração (`whatsapp_template_links`) do município;
  - `buildTemplateRows` usa configuração → senão nome; devolve texto, variáveis por número e se está configurado;
  - novo `setWhatsappTemplateLink` (salvar/remover), validando: template no catálogo, estrutura suportada, aviso conhecido (só os 7 avisos), uma variável conhecida por número, quantidade igual a `bodyVariables`; troca de aviso desliga o template ativo; auditoria;
  - `resolveActiveTemplate` devolve também as variáveis (`fields`) do template ativo, e só aceita template utilizável para o aviso pela configuração ou pelo nome.
- `dispatch-notification.js` e o envio de teste em `routes/whatsapp.js`: usar os `fields` resolvidos em `buildBodyComponents`.
- `routes/whatsapp.js`: rota nova para salvar/remover a configuração de um template — sessão, município resolvido por `tenant.js`, **só master**.
- Acessos (`auth-message-delivery.js`, `recovery-channels.js`): seguem pelo nome; conferir que continuam funcionando com o novo retorno de `resolveActiveTemplate`.

### Banco de dados

Sem migration. Nova chave na tabela `config`, por município (mesmo escopo do catálogo e dos ativos): `whatsapp_template_links` = `{ links: { "<name>|<language>": { use: "<useKey>", fields: ["tutor_name", …] } } }`.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `shared/whatsapp-templates-contract.js`
- `backend/src/services/whatsapp-graph-templates.js`
- `backend/src/services/whatsapp-catalog.js`
- `backend/src/services/whatsapp-active-templates.js`
- `backend/src/services/notifications/dispatch-notification.js`
- `backend/src/services/notifications/whatsapp-template-parameters.js` _(se a prévia/validação precisar de helper)_
- `backend/src/routes/whatsapp.js`
- `src/api.ts`
- `src/features/whatsapp-integration/whatsapp-templates-table.tsx`, `whatsapp-template-link-modal.tsx` _(novo)_, `use-whatsapp-templates.ts`, `whatsapp-integration-types.ts`, `whatsapp-template-display.ts`, `whatsapp-templates-panel.tsx`
- `src/styles.css` (janela, números destacados, prévia — reaproveitando classes do app)
- Testes: `backend/test/whatsapp-templates.test.js`, `whatsapp-catalog.test.js`, `notification-dispatch.test.js`/`notification-transports.test.js` conforme o envio; `src/features/whatsapp-integration/whatsapp-integration.test.tsx`

---

## O que será removido

- `src/features/whatsapp-integration/whatsapp-variables-list.tsx` e seu uso no painel (lista "Variáveis existentes no sistema", só de consulta) — substituída pelos selects de cada template — e o CSS que só ela usa (`.whatsapp-variables-field`, se não houver outro uso).
- `NOT_USED_BY_SYSTEM_TEXT` com "Template padrão da Meta, não usado pelo sistema." (vira "Não usado pelo sistema") e o que só servia a ele.
- O uso direto de `getWhatsappUse(event).fields` no envio (passa a vir do template resolvido).

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Contrato: chave `whatsapp_template_links`, normalização/validação da configuração, regra "configuração → senão nome" para aviso e variáveis, ativação pelo aviso configurado.
2. Catálogo: `bodyText` na descrição e na normalização.
3. Serviço: linhas da tabela, salvar/remover configuração (com desligamento ao trocar de aviso), `resolveActiveTemplate` com `fields`.
4. Envio: notificações e envio de teste com os `fields` resolvidos.
5. Rota (só master) + `src/api.ts` + hook.
6. Tela: coluna "Aviso", botão ⚙, janela com texto destacado, selects, prévia e validações; remover a lista de consulta.
7. Testes e validação (typecheck, testes front/back, build).

---

## Regras de negócio identificadas

- Um template configurado envia só o aviso escolhido; sem configuração, o aviso do nome.
- Cada número do corpo recebe exatamente uma variável; quantidade igual à do template.
- Só templates aprovados e com estrutura suportada ligam (regra atual).
- Trocar o aviso de um template ligado o desliga; trocar só variáveis mantém.
- Só o master configura; quem tem a permissão do município continua só ligando e desligando.

---

## Regras multi-tenant e segurança

- Configuração guardada por município (mesmo escopo do catálogo e dos ativos); município resolvido por `backend/src/tenant.js`, nunca livre do client.
- Rota de configuração: sessão + papel master; testes de recusa para gestor/analista e de isolamento entre municípios.
- Variáveis só da lista fechada (`WhatsappTemplateField`), resolvidas por `resolveWhatsappField` (whitelist atual): nada de campo arbitrário, CPF ou contatos.
- `bodyText` vem da Meta: exibido como texto (sem HTML), limitado a 1100 caracteres.

---

## Validações necessárias

- Template existe no catálogo do município; estrutura suportada.
- Aviso entre os 7 avisos; variáveis conhecidas; uma por número; quantidade = `bodyVariables`.
- Corpo da requisição com nome, idioma, aviso e variáveis (ou remoção).

---

## Testes necessários

### Frontend

- Tabela: aviso configurado, "(pelo nome)", "Não usado pelo sistema", botão ⚙ só para o master.
- Janela: números destacados, um select por número, ordem padrão ao escolher o aviso, prévia com dados de exemplo, "Salvar" bloqueado com número vazio, motivo para template fora das regras, aviso para catálogo sem texto.

### Backend

- Contrato: configuração válida/ inválida; aviso e variáveis pela configuração ou pelo nome.
- Catálogo: `bodyText` guardado; entrada antiga sem texto não é descartada.
- Rota: só master; isolamento por município; validações; trocar aviso desliga; trocar variáveis mantém.
- Envio: `{{n}}` recebe a variável escolhida; sem configuração, ordem padrão.

### Conferência manual (tela)

- Recolocar o token do WhatsApp (o banco local foi limpo), sincronizar, configurar `castracao_nao_comparecimento` e `castracao_confirmacao_cadastro`, ligar e conferir a prévia.

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

- Multi-município: configuração e catálogo sempre do mesmo município; coberto por teste.
- Catálogo sincronizado antes da mudança não tem o texto: a janela pede nova sincronização.
- Mudança no retorno de `resolveActiveTemplate` alcança notificações e acessos: conferir todos os chamadores.
- O banco local foi limpo: a conta do WhatsApp precisa ser recolocada para testar.
- Commit e push direto em `main`.

---

## Perguntas em aberto

Sem resposta no planejamento; assumidas as recomendações:

1. Só o master configura.
2. A prévia com dados de exemplo fica na janela.

---

## Critérios de aceite

- Os templates `castracao_confirmacao_cadastro`, `castracao_documentos_analisados` e `castracao_nao_comparecimento` podem ser ligados aos avisos pela tela, sem recriar na Meta.
- Cada `{{n}}` tem sua variável escolhida na tela e o envio respeita a escolha.
- Templates sem configuração continuam funcionando pelo nome.
- Sem a lista de consulta antiga e sem o texto "Template padrão da Meta".
- Typecheck, testes e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
