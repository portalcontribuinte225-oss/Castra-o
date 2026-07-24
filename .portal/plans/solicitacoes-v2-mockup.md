# Plano de Implementação: Restilização do Fluxo Público de Solicitações (v2)

## Origem

- Arquivo de especificação: nenhum `.md` foi fornecido — a especificação usada foi um mockup HTML standalone ("Solicitações v2") compartilhado diretamente no chat.
- Data do planejamento: 2026-07-23
- Classificação: `frontend-only`

## Resumo

O mockup "Solicitações v2" mostra um wizard de solicitação pública de castração/microchipagem com 4 passos (Animal, Tutor, Agenda, Documentos) + tela de sucesso com protocolo e chave de validação. Esse fluxo já existe integralmente no app — `PublicCastrationForm` (`src/App.tsx` ~L2568) renderiza `NewRequest` (~L2942), que já implementa exatamente essa estrutura (mesma ordem de passos, múltiplos animais, 5 toggles de saúde, upload de documentos com termo, protocolo + chave de validação), `PublicSchedulePicker` (~L1712) já é um calendário mensal com vagas/passado/sem-agenda, e `ValidationKeyConsultation` (~L1150) já implementa a consulta por CPF + chave de validação mencionada no texto de sucesso do mockup. Não há feature nova a construir — o trabalho é levar o CSS envolvido da paleta azul/teal legada (`--teal: #2563eb`, `--green: #16a34a`, `--ink: #0a0a0a`) para a paleta verde/creme (`#1f8a5f` / `#f4f1ea` / `#2b2420`) já estabelecida na home v4 e no modal de credenciamento (rodadas anteriores desta sessão).

## Escopo

### Dentro do escopo

- Restilizar `.nr-topbar`/`.nr-stepper`/`.nr-step*` (header de progresso do wizard) para o padrão verde/creme.
- Restilizar `.calendar-day-button.selected`/`:hover`/`.has-vacancy` (agenda) de azul (`#2563eb`) para verde (`#1f8a5f`), **mantendo a navegação por mês existente** (dropdown de mês), sem alterar estrutura/lógica do calendário.
- Restilizar `.public-form-header`/`.public-form-success`/`.success-validation-key` (tela de sucesso) para verde/creme.
- Reaproveitar o seletor "Tipo de solicitação" (`requestTypes` configurável por prefeitura, ex. Ninhada/Animal de rua) tal como já existe — apenas restilizar visualmente o pill, sem hardcode.
- Restilizar cards/inputs/botões de `ValidationKeyConsultation` (tela de busca por CPF+chave/microchip e seus resultados) para o padrão visual verde/creme, **sem alterar** layout, fluxo ou lógica dos modais de serviço internos (registro de procedimento, transferência de tutor, registro de óbito) que esse componente também contém.

### Fora do escopo

- `.internal-request-modal`/`.prm-modal--reschedule` — versões internas/admin que compartilham as mesmas classes base (`.nr-stepper`, `.calendar-day-button`) e devem continuar visualmente como estão.
- Tokens globais `--green`/`--teal`/`--ink`/`--muted` (usados em dezenas de outros lugares do app) — a restilização deve usar hex literal escopado às classes do fluxo público, seguindo o padrão já validado nas duas rodadas anteriores desta sessão.
- Qualquer mudança de campos, validação, regras de negócio ou lógica de submissão do formulário (já corretos e já batem com o mockup).
- Lógica/layout dos modais de serviço dentro de `ValidationKeyConsultation` (registrar procedimento/transferência/óbito) — só recolorir o entorno visual (cards, inputs, botões), não redesenhar.

## Leitura de contexto

- `/AGENT.md`
- Mockup HTML "Solicitações v2" fornecido no chat
- `src/App.tsx`:
  - `PublicCastrationForm` (~L2568-2690) — tela pública que hospeda o wizard, a tela de sucesso e a tela de consulta
  - `NewRequest` (~L2942-4012) — wizard multi-step (Animal/Tutor/Agenda/Documentos), já com "Adicionar outro animal", 5 toggles de saúde, geração de protocolo/chave de validação
  - `PublicSchedulePicker` (~L1712-1820) — calendário mensal com vagas por dia, navegação por mês
  - `ValidationKeyConsultation` (~L1150-1711) — busca por CPF/chave/microchip + modais de serviço (procedimento/transferência/óbito)
- `src/styles.css`:
  - `.nr-stepper`/`.nr-step*` — ocorrências em ~2669, ~12766 (`.internal-request-modal`), ~16513, ~17074, ~17659 (`.public-form-page:not(.public-form-page--consultation)`)
  - `.calendar-day-button*` — ocorrências em ~3025 (base), ~17866 (`.nr-shell`), ~19094 (`.prm-inline-panel`), ~20993 (`.prm-modal--reschedule`)
  - `.public-form-success`/`.success-validation-key` — ~1327-1394
  - Tokens de cor confirmados: `--green: #16a34a`, `--teal: #2563eb` (nome legado, é azul), `--ink: #0a0a0a`, `--muted: #6b7280` — nenhum bate com a paleta verde/creme v4

## Impacto por área

### Frontend

- `src/styles.css`: restilizar as classes listadas acima. Nenhuma classe nova necessária.
- `src/App.tsx`: nenhuma alteração esperada — estrutura, campos e lógica já batem com o mockup.
- Sem novos componentes, hooks ou query keys.
- Testes: verificação manual em browser (sem suíte de frontend automatizada identificada para este fluxo).

### Backend

Sem impacto esperado — endpoints de criação de solicitação, agendamento e consulta por CPF+chave já existem e já funcionam.

### Banco de dados

Sem impacto esperado.

Atenção: este plano não autoriza executar migrations automaticamente (não aplicável aqui, mas mantido por padrão do template).

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/styles.css` (blocos `.nr-topbar`/`.nr-stepper`/`.nr-step*`, `.calendar-day-button*` escopado ao fluxo público, `.public-form-success`/`.success-validation-key`, cards/inputs de `ValidationKeyConsultation`)

## Estratégia de implementação

1. Restilizar `.nr-topbar`/`.nr-stepper`/`.nr-step*`: verde (`#1f8a5f`) para passo atual/concluído, tom creme/cinza-quente para pendente. Escopar a `.public-form-page`/`.nr-shell--public` para não vazar ao `.internal-request-modal`.
2. Restilizar `.calendar-day-button.selected`/`:hover`/`.has-vacancy` de azul para verde, mantendo toda a estrutura de navegação por mês existente em `PublicSchedulePicker`.
3. Restilizar `.public-form-success`/`.success-validation-key` (ícone, borda, fundo, texto da chave de validação) para verde/creme.
4. Restilizar cards/inputs/botões de busca e resultados de `ValidationKeyConsultation` para o padrão visual, sem tocar nos modais de serviço (procedimento/transferência/óbito).
5. Para cada classe alterada, buscar (grep) todas as ocorrências no arquivo `src/styles.css` inteiro antes de considerar concluído — essas classes têm histórico de cascata duplicada entre o fluxo público e modais internos (`.internal-request-modal`, `.prm-modal--reschedule`), como já ocorreu no modal de credenciamento nesta sessão.
6. Rodar `npm run typecheck` e `npm run build`.
7. Verificação visual via screenshot: abrir "Solicitações" no topbar público, percorrer os 4 passos do wizard, conferir tela de sucesso e a tela de consulta por CPF+chave, em desktop e mobile.

## Regras de negócio identificadas

- Ordem e comportamento do wizard (Animal → Tutor → Agenda → Documentos), múltiplos animais, 5 toggles de saúde, geração de protocolo + chave de validação: já implementados e corretos, não alterar.
- Seletor "Tipo de solicitação" continua vindo de `requestTypes` configurável por prefeitura — não hardcodear valores do mockup.
- Consulta por CPF + chave de validação (`ValidationKeyConsultation`) já existe e não deve ter sua lógica alterada, apenas a aparência.

## Regras multi-tenant e segurança

- Nenhuma mudança em autenticação/autorização.
- Nenhum dado sensível novo, nenhum endpoint novo.

## Validações necessárias

Nenhuma validação de formulário nova — apenas restilização CSS de um fluxo já validado.

## Testes necessários

### Frontend

- Verificação manual em browser: abrir "Solicitações" no topbar público → percorrer os 4 passos do wizard → confirmar tela de sucesso → testar tela de consulta por CPF+chave → responsivo mobile.

### Backend

- Não aplicável (sem impacto esperado).

### E2E

- Não há suíte E2E identificada neste projeto.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- As classes `.nr-stepper`/`.nr-step*`/`.calendar-day-button` aparecem em múltiplos pontos da cascata, compartilhadas com `.internal-request-modal` e `.prm-modal--reschedule` — mesmo padrão de "código sobre código" já encontrado e corrigido no modal de credenciamento nesta sessão. Exige auditoria completa por classe (grep no arquivo inteiro), não só o primeiro ponto encontrado.
- `ValidationKeyConsultation` é significativamente maior e mais complexo do que o mockup sugere (inclui modais de serviço para staff registrar procedimento/transferência/óbito) — risco de escopo se a implementação tentar "recriar" a tela em vez de apenas recolorir o que já existe.
- Push para `origin/main` segue bloqueado por permissão (pendência de sessões anteriores, não relacionada a este plano).

## Perguntas em aberto

Todas resolvidas com o usuário em 2026-07-23:

1. Seletor "Tipo de solicitação": **reaproveitar** o `requestTypes` configurável existente, sem hardcode.
2. Navegação do calendário: **manter** a navegação por mês existente, só levar a estilização compatível com a nova versão.
3. Tela de consulta (`ValidationKeyConsultation`): **incluir no escopo**, adequando visualmente para ficar no padrão, sem alterar os modais de serviço internos.

Nenhuma pergunta em aberto restante.

## Critérios de aceite do plano

- Wizard (Animal/Tutor/Agenda/Documentos), calendário e tela de sucesso renderizam na paleta verde/creme, sem vazar para `.internal-request-modal`/`.prm-modal--reschedule`.
- `ValidationKeyConsultation` visualmente consistente com o resto do fluxo público, sem alteração de comportamento dos modais de serviço.
- `npm run typecheck` e `npm run build` passam sem novos erros.
- Nenhuma mudança em `src/App.tsx` (restilização é CSS-only).

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto. Todas as decisões já foram confirmadas com o usuário (ver seção "Perguntas em aberto") — não reabrir essas decisões sem motivo novo.
- Antes de considerar qualquer classe restilizada, buscar (grep) todas as suas ocorrências no arquivo `src/styles.css` inteiro — não assumir que a primeira ocorrência encontrada é a que efetivamente renderiza (lição já aplicada no modal de credenciamento nesta sessão).
- Não alterar `.internal-request-modal`/`.prm-modal--reschedule` nem os tokens globais `--green`/`--teal`/`--ink`/`--muted`.
- Não alterar `src/App.tsx` — este plano é CSS-only.
- Seguir o fluxo real de git deste projeto (commit direto em `main`, sem `staging`/PR).
- Rodar `npm run typecheck` e `npm run build` antes de considerar a implementação concluída.
