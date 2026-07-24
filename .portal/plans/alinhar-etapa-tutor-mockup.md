# Plano de Implementação: Alinhar etapa "Tutor" (fluxo público) ao mockup

## Origem

- Arquivo de especificação: mockup HTML colado nesta sessão (fonte real extraída, `STEP 2: TUTOR`, linhas ~317-389) + screenshot do mockup renderizado enviado pelo usuário
- Data do planejamento: 2026-07-24
- Classificação: `frontend-only`

## Resumo

A etapa Tutor hoje tem **3 cards** ("Identificação", "Endereço", "Contato"); o mockup usa **2 cards** ("Responsável e contato" — juntando Nome/CPF/CadÚnico/Email/Telefone —, e "Endereço", que já bate quase 100% com o que existe). Também há diferenças de rótulo, placeholder, o visual do campo CadÚnico (checkbox+texto → botão quadrado toggle), o botão de verificação de SMS (botão preto full-width → botão compacto "Verificar" ao lado do telefone) e a proporção/ícone dos botões Voltar/Continuar. A lógica de negócio (validação, CEP, verificação SMS em 2 passos) não muda — é reorganização visual/estrutural, igual foi feito na etapa Animal.

## Escopo

### Dentro do escopo

1. **Mesclar cards**: "Identificação" + "Contato" viram um card só, "Responsável e contato", nesta ordem: Nome completo (linha cheia) → CPF + CadÚnico (2 colunas) → Email + Telefone (2 colunas) → fluxo de SMS. "Endereço" continua como card separado (estrutura já bate com o mockup).
2. **Rótulos/placeholders** (só `publicFlow`, mesmo padrão já usado na etapa Animal — texto mais curto):
   - "TUTOR" → "NOME COMPLETO" (mantém `data-label`/campo internos)
   - CPF: placeholder "CPF (000.000.000-00)" → "000.000.000-00"
   - CadÚnico: rótulo "CADUNICO" → "CADÚNICO (SE APLICA)"; placeholder "Número do CadÚnico" → "Número"
   - Endereço: placeholder "Endereço (Rua, complemento)" → "Rua, complemento"
3. **CadÚnico "se aplica"**: trocar o checkbox HTML + texto "Se aplica" por um botão quadrado (38×38, mesmo padrão de toggle já usado — verde `#1f8a5f` preenchido com check branco quando aplica, borda creme `#e6ddc9` quando não) ao lado do input, igual ao mockup. **Mesma variável de estado** (`requestData.cadUnicoNotApplicable`, `toggleCadUnicoNotApplicable`) — só muda o componente visual, não o dado gravado.
4. **Verificação de SMS — troca visual, não funcional**: o botão atual "Enviar código de verificação" (preto, full-width, abaixo da linha Email/Telefone) vira um botão compacto "Verificar" ao lado do campo Telefone (mesmo espírito do mockup). **A lógica de 2 passos (enviar código → confirmar código) é preservada integralmente** — o mockup simplifica para um clique só, mas isso não existe de verdade no sistema (é SMS real), então mantemos `sendSmsCode`/`smsInput`/`confirmSmsCode` exatamente como estão, só reposicionando/restilizando o botão de disparo. Quando o código é enviado, o bloco de input+"Confirmar" continua aparecendo normalmente logo abaixo (o mockup não tem equivalente disso, mas é funcionalidade real que não pode ser removida).
5. **Botões Voltar/Continuar**: no mockup são `flex:1` cada (largura igual, 50/50) e "Continuar" tem um ícone de seta (chevron-right) depois do texto. Hoje o botão "Voltar" é bem menor que "Continuar". Ajustar para 50/50 + ícone, escopado a `publicFlow` (afeta a barra de navegação compartilhada por Tutor/Agenda/Documentos — a etapa Animal já usa uma linha própria, mesclada com Adicionar/Remover animal na rodada anterior, e fica de fora deste ajuste específico de proporção por enquanto).

### Fora do escopo

- Qualquer mudança de validação, máscara de CPF/telefone, busca de CEP (`lookupCep`), ou nos nomes dos campos gravados (`requestData.tutor`, `.cpf`, `.cadUnico`, `.cadUnicoNotApplicable`, `.email`, `.phone`).
- O fluxo real de verificação por SMS (`sendSmsCode`/`confirmSmsCode`/`smsInput`/`smsStatus`) — só a aparência do botão de disparo muda, a lógica de 2 passos continua.
- Modal interno do staff (`internalSimple`) — mantém os 3 cards separados e o botão "Enviar código de verificação" como está (mesma decisão de escopo das rodadas anteriores).
- Proporção/ícone do botão "Continuar" da etapa Animal (já mesclado numa linha própria com Adicionar/Remover animal) — não mexido aqui; se quiser, vira um ajuste separado.
- Cabeçalho branco + ícone da direita do topbar — já removidos por instrução explícita anterior nesta sessão; não estão sendo revertidos.

## Leitura de contexto

- `/AGENT.md` — fluxo direto em `main`, sem staging/PR
- `src/App.tsx`:
  - Bloco `formStep === 0` (~L3708-3783): os 3 cards atuais ("Identificação", "Endereço", "Contato") e o fluxo de SMS.
  - Bloco `.nr-nav-row` (~L4042-4075): botões Voltar/Continuar compartilhados.
  - `toggleCadUnicoNotApplicable`, `sendSmsCode`, `confirmSmsCode`, `lookupCep` — funções reaproveitadas sem alteração de assinatura/lógica.
- Fonte do mockup (colada nesta sessão) — `STEP 2: TUTOR`, linhas ~317-389 do arquivo extraído: estrutura exata de card único, campo CadÚnico com toggle quadrado, botão "Verificar" compacto, e o bloco `<!-- Actions -->` (~L458-465) com Voltar/Continuar 50/50 + ícone.
- `src/styles.css`: `.form-sub-card`/`.form-sub-card-title` (já ajustados na etapa Animal, reaproveitados aqui sem mudança), `.two-column-fields`, `.cadunico-row`/`.cadunico-checkbox`, `.sms-send-btn`, `.nr-nav-row`/`.nr-topbar-continue`/`.nr-back-btn`.
- `src/components/ui.tsx`: `ToggleSwitch` (padrão de toggle já existente, pode inspirar o novo botão quadrado do CadÚnico, mas o visual é diferente — quadrado com check, não trilho).

## Impacto por área

### Frontend

- `src/App.tsx`:
  - Reestruturar o bloco `formStep === 0` para renderizar 1 card mesclado (`publicFlow`) ou os 3 cards atuais (`!publicFlow`/staff), no mesmo padrão de branch condicional já usado na etapa Animal.
  - Novo pequeno trecho JSX para o botão quadrado do CadÚnico (reaproveitando `requestData.cadUnicoNotApplicable`/`toggleCadUnicoNotApplicable`).
  - Reposicionar o botão de disparo do SMS para ficar ao lado do campo Telefone (`publicFlow`), mantendo o restante do fluxo (`smsCode`/`smsInput`/`confirmSmsCode`/`smsStatus`) inalterado.
  - Ajustar o bloco `.nr-nav-row` para `flex:1` nos dois botões + ícone `ChevronRight` (já importado de `lucide-react`, usado no acordeão da etapa Animal) no botão Continuar, escopado a `publicFlow`.
- `src/styles.css`:
  - Novas regras escopadas a `.nr-shell--public` para: card único (reaproveita `.form-sub-card` existente, sem CSS novo de card), botão quadrado do CadÚnico, botão compacto "Verificar", `.nr-nav-row` 50/50.
  - Checklist de sempre: grep de cada classe alterada no arquivo inteiro antes de considerar concluído, para não deixar versão antiga/duplicada.

### Backend / Banco de dados / Infra

Sem impacto esperado — nenhum campo novo, nenhuma mudança de contrato de dados.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Reestruturar o JSX da etapa Tutor: criar o card único "Responsável e contato" para `publicFlow`, preservando o bloco de 3 cards atual para o staff (mesmo padrão `publicFlow ? (...) : (...)` já usado na etapa Animal).
2. Ajustar rótulos/placeholders (`publicFlow` apenas).
3. Implementar o botão quadrado do CadÚnico (verde+check quando aplica, borda creme quando não).
4. Reposicionar/restilizar o botão de disparo do SMS como "Verificar" compacto ao lado do Telefone, sem tocar na lógica de `sendSmsCode`/`confirmSmsCode`.
5. Ajustar `.nr-nav-row` (Voltar/Continuar 50/50 + ícone), escopado a `publicFlow`.
6. Grep de cada classe alterada no arquivo inteiro (checklist da skill `implementar`), para confirmar que não sobrou versão antiga ativa por baixo.
7. Testar via CDP/headless Chrome: card único renderizando os campos na ordem certa, toggle do CadÚnico (aplica/não aplica) funcionando e gravando o mesmo dado de antes, clique em "Verificar" ainda disparando o SMS real (código de teste aparecendo, campo de confirmação surgindo), validação de campos obrigatórios continuando a bloquear o avanço, botões Voltar/Continuar 50/50 com ícone.
8. Confirmar visualmente que o modal do staff continua com os 3 cards de sempre.
9. `npm run typecheck` e `npm run build`.

## Regras de negócio identificadas

- Nenhuma regra nova. CadÚnico continua sendo `requestData.cadUnicoNotApplicable` (mesma semântica invertida já existente — "aplica" = `!cadUnicoNotApplicable`). Verificação de SMS continua exigindo os 2 passos reais (enviar + confirmar) antes de permitir avançar, exatamente como hoje (`getStepIssues`/`getRequestValidationIssues` não mudam).

## Regras multi-tenant e segurança

Sem impacto — mudança de UI/estrutura, não mexe em resolução de tenant, permissões, nem no fluxo real de autenticação por SMS (que continua real, não é simulado a menos do que já é hoje em ambiente de teste).

## Validações necessárias

- Confirmar que o toggle do CadÚnico grava exatamente o mesmo valor que o checkbox gravava antes.
- Confirmar que "Verificar" dispara `sendSmsCode` normalmente e que o fluxo de confirmação (código + "Confirmar") continua funcionando e bloqueando o avanço até confirmado (quando aplicável).
- Confirmar que a validação de campos obrigatórios (`submitAttempted`/`is-invalid`) continua funcionando após a reestruturação dos cards.
- Confirmar visualmente que o staff (`internalSimple`) não foi afetado.

## Testes necessários

### Frontend

Sem testes automatizados novos (projeto não tem suíte configurada).

### E2E

- CDP/headless Chrome: etapa Tutor pública — preencher card único, alternar toggle do CadÚnico, disparar/confirmar SMS de teste, avançar para Agenda; conferir que Tutor do modal do staff continua com 3 cards.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- O botão quadrado do CadÚnico é um componente visual novo (não existe padrão igual no projeto) — vale conferir estados de foco/hover além do padrão, já que isso já causou resíduos de estilo antigo em rodadas anteriores.
- Reposicionar o disparo do SMS pode mexer no layout quando o código já foi enviado (campo de confirmação aparecendo) — testar os 2 estados (antes/depois de enviar o código) visualmente.
- Push para `origin/main` segue bloqueado por permissão (403) nesta sessão — commits ficam pendentes até o usuário resolver o acesso.

## Perguntas em aberto

Nenhuma — usuário optou por aplicar o ajuste "Voltar/Continuar 50/50 + ícone" só na barra genérica (Tutor/Agenda/Documentos), sem mexer na linha mesclada da etapa Animal por enquanto.

## Critérios de aceite do plano

- Etapa Tutor pública com 1 card "Responsável e contato" (Nome → CPF/CadÚnico → Email/Telefone) + card "Endereço" (já como está, só placeholders ajustados).
- CadÚnico com botão quadrado toggle, mesmo dado gravado de antes.
- SMS: botão "Verificar" compacto ao lado do Telefone, mesma lógica de 2 passos preservada.
- Voltar/Continuar 50/50 com ícone no Continuar.
- Modal do staff inalterado.
- `npm run typecheck` e `npm run build` passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Escopar tudo a `publicFlow` — não tocar no modal do staff.
- Não simplificar o fluxo de SMS para um clique só — é funcionalidade real, só a aparência do botão de disparo muda.
- Reaproveitar padrões já estabelecidos (card único condicional, placeholders curtos, grep de classes alteradas no arquivo inteiro).
- Não commitar/dar push — isso é responsabilidade da skill `finalizar`, só quando solicitado.
