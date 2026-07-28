# Plano de Implementação: Banner de aviso de Mutirão na home pública

## Origem

- Arquivo de especificação: pedido direto do usuário no chat (sem `.md` de feature externo)
- Data do planejamento: 2026-07-28
- Classificação: `frontend-only`

## Resumo

Adicionar um banner de destaque na home pública anunciando o próximo Mutirão de castração (quando houver um configurado e futuro), mostrando local, endereço, data e horário, com um botão que leva direto ao fluxo de agendamento já existente (`NewRequest`), com aquele dia pré-selecionado. Todos os dados necessários já existem em `scheduleDay` (`kind`, `date`, `locationName`, `locationAddress`, `addressUrl`, horário via `slots`/`startTime`) e já chegam até a área pública — não há necessidade de endpoint novo, mudança de schema ou nova consulta ao backend.

## Escopo

### Dentro do escopo

- Helper para encontrar o próximo mutirão futuro a partir de `scheduleDays` (`kind === "Mutirao"` e não passado).
- Novo componente de banner (`MutiraoBanner` ou nome equivalente em inglês) exibindo local, endereço, data e horário do mutirão.
- Inserção do banner na home pública (`LoginView`), logo abaixo do `PetWelcomeArt` principal (versão não-compacta), condicionado a existir mutirão futuro configurado.
- CTA do banner que abre o fluxo de agendamento público (`openPublicService("procedure_form")`) com a data do mutirão pré-selecionada via `initialSchedule` do `NewRequest` (reaproveitando o mesmo mecanismo de prefill já usado para `initialType`/`procedurePrefill`).
- Estilização nova em `styles.css`, reaproveitando a paleta laranja suave já usada no badge/borda de mutirão do calendário (consistência visual).

### Fora do escopo

- Qualquer alteração de backend, schema ou endpoint novo.
- Exibir múltiplos mutirões futuros simultaneamente (mostrar apenas o mais próximo).
- Alterar o fluxo de agendamento em si (`NewRequest`), além de aceitar o prefill que ele já suporta.
- Alterar a versão compacta do `PetWelcomeArt` (usada dentro de `activePublicService`).
- Qualquer mudança no calendário/admin interno de mutirão.

## Leitura de contexto

- `/AGENT.md` (raiz) — lido; é um template genérico (menciona `staging`/PR/`feature/*`), mas a prática real do projeto (confirmada em memória e nas skills `implementar`/`finalizar`) é commit direto em `main`, sem `staging`. Este plano segue a prática real do projeto.
- `frontend/AGENT.md` — não existe neste repo (é um monorepo de pasta única `src/`, não `frontend/`).
- `backend/AGENT.md` — não existe neste repo (não há impacto de backend).
- Investigação direta em `src/App.tsx`:
  - `scheduleDays` chega em `LoginView` (linha ~2222) já com todos os campos necessários.
  - `PetWelcomeArt` (linha ~2853) é o hero da home pública; renderizado em duas variantes: compacta (linha ~2436, dentro de `activePublicService`) e completa (linha ~2509, na home).
  - `openPublicService(serviceId)` (linha ~2347) e `procedurePrefill` (state, linha ~2229) já existem como mecanismo de navegação/prefill para o fluxo de solicitação.
  - `NewRequest` (linha ~3199) já aceita `initialSchedule` (linha ~3217) e `initialType` (linha ~3218), aplicados via `useEffect` ao montar.
  - `ScheduleDayButton`/badge de mutirão (linhas ~1911-1921) confirmam os campos usados: `day.kind === "Mutirao"`, `day.date`, `day.locationName`, `day.locationAddress`, `day.addressUrl`, `day.offeredSlot?.time || day.startTime`.
  - `isPastScheduleDay` (importado, usado em várias linhas) já é o helper padrão para filtrar datas passadas — deve ser reaproveitado, não duplicado.

## Impacto por área

### Frontend

- **Novo helper** (próximo das outras funções utilitárias de agenda, ex.: perto de `isPastScheduleDay`/`getAgendaOccurrenceList`): `getNextUpcomingMutirao(scheduleDays)` — filtra `kind === "Mutirao"` e `!isPastScheduleDay(date)`, ordena por data, retorna o primeiro (ou `null`/`undefined` se não houver).
- **Novo componente**: `MutiraoBanner({ scheduleDay, onJoin })` — recebe o `scheduleDay` do próximo mutirão e um callback de ação; renderiza local, endereço (com link para `addressUrl` quando existir), data formatada (reaproveitar `formatMonthYear`/formatação de data já existente no arquivo, não criar uma nova) e horário (`offeredSlot?.time || startTime`).
- **`LoginView`**: calcular `nextMutirao = getNextUpcomingMutirao(scopedScheduleDays ou equivalente já disponível no escopo)`; renderizar `<MutiraoBanner>` condicionalmente logo após o `<PetWelcomeArt>` da home completa (linha ~2509), não na variante compacta.
- **Prefill do agendamento**: `onJoin` do banner deve chamar algo equivalente a `setProcedurePrefill({ requestType: ... , schedule: nextMutirao.date })` (ajustar conforme o formato real de `procedurePrefill` já usado) e então `openPublicService("procedure_form")`; e o `initialSchedule` passado a `NewRequest` (linha ~2481 e arredores) deve ler esse valor de prefill, do mesmo jeito que `initialType={procedurePrefill?.requestType || ""}` já faz hoje.
- Estados: se não houver mutirão futuro, `nextMutirao` é `null`/`undefined` e o banner simplesmente não renderiza (sem placeholder, sem "nenhum mutirão configurado").
- Sem impacto em React Query/hooks de rede — `scheduleDays` já é state local recebido via props, não uma query nova.
- Sem formulário novo, sem Zod/RHF envolvido (é um card informativo com um botão).

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx` — novo helper `getNextUpcomingMutirao`, novo componente `MutiraoBanner`, ajustes em `LoginView` (render condicional do banner) e no fluxo `procedurePrefill`/`initialSchedule` para o CTA.
- `src/styles.css` — novo bloco de estilo para o banner (paleta laranja suave alinhada ao badge/borda de mutirão já existente).

## Estratégia de implementação

1. Adicionar `getNextUpcomingMutirao(scheduleDays)` próximo das demais funções utilitárias de agenda/mutirão já existentes em `App.tsx`, reaproveitando `isPastScheduleDay`.
2. Criar o componente `MutiraoBanner`, reaproveitando formatação de data/hora já usada no calendário (não recriar lógica de formatação).
3. Ligar o CTA do banner ao fluxo existente: setar prefill de `schedule` (e manter o prefill de `requestType` como já é feito hoje) e chamar `openPublicService("procedure_form")`.
4. Repassar o valor de prefill de `schedule` como `initialSchedule` na chamada de `NewRequest` já existente na home pública (mesmo padrão de `initialType={procedurePrefill?.requestType || ""}`).
5. Inserir `<MutiraoBanner>` condicionalmente em `LoginView`, logo abaixo do `PetWelcomeArt` completo.
6. Estilizar em `styles.css`, reutilizando as variáveis/tons já usados no badge e borda de mutirão do calendário (consistência com o que já foi ajustado nesta mesma sessão).
7. Rodar `grep` de `MutiraoBanner`/classes novas no arquivo inteiro para confirmar que não há colisão com estilos pré-existentes de outro componente.
8. Rodar `typecheck` e `build`.

## Regras de negócio identificadas

- Um "Mutirão" é um `scheduleDay` com `kind === "Mutirao"`.
- Um mutirão é "futuro" quando `!isPastScheduleDay(date)`.
- Quando existir mais de um mutirão futuro, exibir apenas o mais próximo por data.
- Quando não existir nenhum mutirão futuro, nenhum banner deve ser renderizado.
- O CTA do banner deve levar ao mesmo fluxo de solicitação/agendamento público já existente, apenas com a data pré-selecionada — não deve criar um formulário paralelo.

## Regras multi-tenant e segurança

- `scheduleDays` já chega em `LoginView` filtrado/escopado pelo município selecionado (via props existentes, ex.: `scopedScheduleDays`/`effectivePublicServiceScheduleDays` ou equivalente usado hoje pela home) — o banner deve usar a mesma fonte de dados já escopada por município, nunca uma lista não-escopada, para não vazar mutirão de outra prefeitura.
- Nenhuma nova permissão é necessária — é uma view pública, sem autenticação, igual ao restante da home.
- Sem impacto em relatórios/PDFs.

## Validações necessárias

- Verificar que `MutiraoBanner` não quebra quando `scheduleDay.addressUrl` está vazio (link opcional, não obrigatório).
- Verificar que a formatação de data/hora não quebra com `offeredSlot`/`startTime` ausentes (fallback consistente com o que o calendário já faz na linha ~1920).
- Confirmar visualmente que o banner não aparece quando não há mutirão futuro configurado (testar com dado local/mock, se não houver ambiente de banco disponível).

## Testes necessários

### Frontend

- Não há suíte de testes automatizados de componente identificada neste projeto para telas públicas equivalentes (a confirmar durante a implementação); se não houver, documentar isso no resumo final em vez de inventar um framework novo.

### Backend

Sem impacto esperado.

### E2E

- Não aplicável a menos que já exista suíte Playwright configurada — a confirmar durante a implementação; não introduzir ferramenta nova só para este item.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
npm run lint
```

(Este projeto não usa `frontend/`/`backend/` como prefixos separados — é `src/` na raiz do monorepo; ajustar comandos conforme os scripts reais do `package.json` durante a implementação.)

## Riscos e pontos de atenção

- `App.tsx` tem ~10 mil linhas e há outra sessão trabalhando em paralelo no mesmo arquivo — inserir o novo componente/JSX em um ponto isolado (perto de `PetWelcomeArt`) para minimizar risco de conflito.
- Garantir que o `scheduleDays` usado pelo banner é a versão já escopada por município (mesma usada pelo resto da home pública), não a lista bruta/global.
- Push é direto em `main`, sem `staging` — qualquer regressão visual na home pública é imediatamente visível em produção.
- Reaproveitar a paleta de cor já ajustada nesta sessão para o badge/borda de mutirão, em vez de introduzir um novo tom.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — assunções (mostrar apenas o mutirão mais próximo; banner oculto quando não há mutirão futuro; CTA pré-seleciona a data reaproveitando `initialSchedule`) foram validadas durante o planejamento e podem ser ajustadas durante a implementação se o usuário pedir.

## Critérios de aceite do plano

- Banner aparece na home pública somente quando há mutirão futuro configurado, mostrando local, endereço, data e horário corretos.
- Banner não aparece quando não há mutirão futuro.
- CTA do banner leva ao fluxo de agendamento já existente, com a data do mutirão pré-selecionada.
- Nenhum endpoint novo, nenhuma mudança de schema.
- `typecheck` e `build` passam sem novos erros.
- Estilo visualmente consistente com a paleta de mutirão já usada no calendário.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Não executar migrations (não há nenhuma prevista neste plano).
- Reaproveitar `isPastScheduleDay`, formatação de data/hora e o mecanismo de prefill (`procedurePrefill`/`initialType`/`initialSchedule`) já existentes — não duplicar lógica.
- Manter a alteração pequena e focada: um helper, um componente, um ponto de inserção em `LoginView`, um bloco de CSS novo.
- Confirmar antes de finalizar que o `scheduleDays` usado é a versão já escopada por município.
- Seguir a regra de comunicação silenciosa da skill `implementar` (responder só "codando...", sem narrar/colar código, resumo curto no final).
