# Plano de Implementação: Ajuste estrutural da etapa "Animal" do wizard público de Solicitações

## Origem

- Arquivo de especificação: nenhum arquivo `.md` — mockup enviado como imagens (4 telas: Animal, Tutor, Agenda, Documentos) diretamente na conversa
- Data do planejamento: 2026-07-23
- Classificação: `frontend-only`

## Resumo

A rodada anterior ("Solicitações v2") restilizou o wizard público como CSS-only, partindo do pressuposto de que a estrutura já batia com o mockup. Comparação ao vivo (screenshots do app real vs. imagens do mockup) revelou divergências de **estrutura/componente**, não só de cor, na etapa "Animal". Este plano corrige essas divergências. É pura reestruturação de UI/front-end — nenhuma função, validação, cálculo ou dado muda.

## Escopo

### Dentro do escopo

- Trocar os botões de escolha (pills) individuais com borda/gap — usados em Tipo de solicitação, Espécie, Tipo de Procedimento, Raça, Sexo — por uma barra única dividida ao meio, sem borda por botão, como no mockup. CSS, escopado a `.nr-shell--public`.
- Trocar os 4 campos booleanos de "Saúde e cuidados" (Vermifugado, Vacinas em dia, Já teve cria, Histórico de doenças) de par de botões Sim/Não para um switch liga/desliga, reaproveitando o padrão `.prm-toggle` já existente no modal interno, recolorido para verde no contexto público. O valor gravado continua sendo a string "Sim"/"Não" — mesmo dado, mesma validação, mesmo contrato.
- Mover "Tipo de Procedimento" para fora do card "Identificação do animal" e criar um card "Procedimento desejado" separado, na ordem do mockup (Identificação → Procedimento desejado → Saúde e cuidados).
- Esconder o cabeçalho/chevron de acordeão "Animal N" quando há apenas 1 animal na lista (mostra os campos direto, sem acordeão). Manter o acordeão funcional e visível quando há 2+ animais (recurso usado por "Ninhada", que permite adicionar múltiplos animais) — não pode regredir.
- Trocar os círculos numerados do stepper (`.nr-step-circle`) por uma barra colorida sob o label de cada etapa, como no mockup. CSS; se não for suficiente, ajuste leve de JSX (será avaliado durante a implementação).
- Remover a imagem do brasão do município do topbar nas etapas de cadastro (`.nr-topbar-right` / `selectedMunForTopbar.brasao`, usado em `NewRequest`), substituindo por um ícone simples (casa, verde) no estilo do mockup.

### Fora do escopo

- Lógica de validação, cálculo de porte por peso (`detectSizeFromWeight`), upload de documentos, agenda/vagas — inalterados.
- `PublicSchedulePicker`, `ValidationKeyConsultation` — fora desta etapa (já tratados na rodada anterior).
- Uso do brasão do município em outras telas fora do fluxo de cadastro público (`NewRequest`), caso exista — será checado antes de remover, para não tirar o brasão de uma tela onde ele ainda seja necessário para identificar a prefeitura.

## Leitura de contexto

- `/AGENT.md` (raiz) — fluxo direto em `main`, sem staging/PR
- `src/App.tsx` — componente `NewRequest` (~L3618-3899): `stepperNode`, `nr-topbar`/`nr-topbar-right`/brasão, acordeão "Animal N" (`animal-form-header`, `animal-accordion-toggle`), cards "Identificação do animal" e "Saúde e cuidados", uso de `CompactChoiceField`/`YesNoField`
- `src/components/ui.tsx` — `SegmentedButtons`/`YesNoField`/`CompactChoiceField` (componentes reaproveitados, não redefinidos)
- `src/styles.css` — `.compact-choice-field`, `.anm-type-card`, `.nr-stepper`/`.nr-step*`, `.nr-topbar-right`/`.nr-topbar-brasao`
- Padrão já existente reaproveitado: `.prm-toggle`/`.prm-toggle--on`/`.prm-toggle-thumb` (toggle switch usado no modal interno, ~L18829-18868 de `styles.css`, JSX em `App.tsx` ~L5010-5021) — será adaptado, não recriado do zero
- Mockup de referência: 4 imagens enviadas na conversa (Animal, Tutor, Agenda, Documentos)

## Impacto por área

### Frontend

- `NewRequest` (`src/App.tsx`): reordenar JSX dos cards da etapa Animal; condicionar renderização do acordeão a `animals.length > 1`; substituir os 4 `YesNoField` de saúde por um componente de toggle (novo, pequeno, ou adaptação inline reaproveitando o padrão `.prm-toggle`); remover `<img className="nr-topbar-brasao">` do topbar de `NewRequest` e renderizar um ícone simples no lugar.
- `src/styles.css`: nova regra de "barra dividida" para choice-fields dentro de `.nr-shell--public`; estilo verde do toggle switch no contexto público; ajuste do stepper (esconder círculo, estilizar barra); estilo do novo ícone do topbar.
- Estados a preservar: seleção de pills, toggle on/off refletindo corretamente o valor "Sim"/"Não", validação de campos obrigatórios (`submitAttempted`/`is-invalid`), comportamento de adicionar/remover animal.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estratégia de implementação

1. Confirmar via grep que `.nr-topbar-brasao`/`selectedMunForTopbar.brasao` é usado só em `NewRequest` (fluxo de cadastro) antes de remover — se houver outro uso, avisar antes de tocar.
2. Reordenar o JSX da etapa Animal: mover o bloco de `CompactChoiceField` de "Tipo de Procedimento" para um novo `form-sub-card` "Procedimento desejado", entre "Identificação do animal" e "Saúde e cuidados".
3. Condicionar o cabeçalho de acordeão (`animal-form-header`/chevron/collapse) a `animals.length > 1`; quando houver só 1 animal, renderizar os campos sempre abertos, sem o cabeçalho "Animal 1".
4. Criar um componente de toggle switch (reaproveitando classes/estrutura de `.prm-toggle`) e trocar os 4 `YesNoField` de saúde por ele, mantendo o mesmo `value`/`onChange` (string "Sim"/"Não") — sem mudar `updateAnimal`.
5. Ajustar CSS de `.compact-choice-field button`/`.anm-type-card` dentro de `.nr-shell--public` para virar barra dividida (remover borda/gap individual, unir num container só, divisor fino entre opções).
6. Ajustar `.nr-stepper`/`.nr-step-circle`/`.nr-step-connector` para esconder o círculo numerado e mostrar barra colorida sob o label.
7. Trocar a imagem do brasão por um ícone (ex.: `Home` do lucide-react, como já usado no botão esquerdo) estilizado em verde, no `.nr-topbar-right`.
8. Grep de todas as classes alteradas no arquivo inteiro (checklist da skill `implementar`) para garantir que não sobrou versão antiga/duplicada.
9. Testar via CDP/headless Chrome: etapa Animal com 1 animal (sem acordeão) e com 2+ animais (acordeão funcional), toggle switches refletindo Sim/Não corretamente, validação de campos obrigatórios ainda funcionando, stepper visual.

## Regras de negócio identificadas

- Nenhuma regra de negócio nova. O valor "Sim"/"Não" dos campos de saúde deve continuar sendo gravado exatamente como hoje (mesma string), só a representação visual muda de par-de-botões para switch.
- Multi-animal ("Ninhada") continua permitindo adicionar/remover animais; o acordeão só fica oculto no caso trivial de 1 animal.

## Regras multi-tenant e segurança

Sem impacto — mudança puramente visual/estrutural de front-end, não mexe em qual município/tenant é resolvido nem em permissões. A remoção do brasão do topbar do cadastro é uma decisão de UI confirmada pelo usuário, não afeta a lógica de seleção de município (`selectedMunicipalityId`) usada em outras partes do sistema.

## Validações necessárias

- Confirmar que a validação de campos obrigatórios (`submitAttempted`, classes `is-invalid`) continua funcionando após a reordenação dos cards.
- Confirmar que o toggle switch atualiza `animal.dewormed`/`vaccinated`/`hadLitter`/`illnessHistory` com os mesmos valores de string que o `YesNoField` gravava.

## Testes necessários

### Frontend

Sem testes automatizados novos (projeto não tem suíte frontend configurada).

### Backend

Sem impacto esperado.

### E2E

- Verificação manual/CDP: etapa Animal com 1 animal (visual sem acordeão, cards na ordem do mockup, pills em barra dividida, toggles de saúde) e com 2+ animais (acordeão "Animal N" funcional, adicionar/remover animal); envio completo do wizard até o sucesso, para garantir que nada quebrou no fluxo de submissão.

## Comandos de validação sugeridos

```bash
npm run typecheck
npm run build
```

## Riscos e pontos de atenção

- Se `.nr-topbar-brasao`/brasão for usado em outro lugar além de `NewRequest`, a remoção precisa ser escopada só ao cadastro — checar antes de remover.
- Condicionar o acordeão a `animals.length === 1` precisa ser testado nos dois cenários (1 e 2+ animais) para não regredir a feature de "Ninhada".
- Trocar `YesNoField` por toggle é mudança de interação (não só de estilo) — testar que o valor gravado é idêntico ao anterior.
- Push para `origin/main` segue bloqueado por permissão (403, `RodrigoMartini02` sem acesso a `portalcontribuinte225-oss/Castra-o.git`) — commits desta tarefa ficarão pendentes de push até o usuário resolver o acesso.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — decisões já confirmadas pelo usuário (remover brasão do cadastro; reestruturação é só de UI, funções continuam as mesmas).

## Critérios de aceite do plano

- Etapa "Animal" com 1 animal visualmente alinhada ao mockup: sem acordeão, cards na ordem Identificação → Procedimento desejado → Saúde e cuidados, pills em barra dividida, campos de saúde como toggle switch verde, topbar sem brasão (ícone simples no lugar), stepper sem círculos numerados.
- Com 2+ animais, o acordeão "Animal N" continua funcional (expandir/colapsar, adicionar/remover animal).
- Nenhuma mudança de validação, cálculo ou dado gravado — mesmos valores enviados ao backend de antes.
- `npm run typecheck` e `npm run build` passam sem erros novos.

## Observações para a skill implementar

- Usar este plano como fonte principal de contexto.
- Antes de remover o brasão, confirmar via grep que não é usado fora de `NewRequest`.
- Reaproveitar o padrão `.prm-toggle` para o novo toggle switch em vez de criar um componente do zero.
- Escopar toda mudança de pill/choice-field via `.nr-shell--public`, como já estabelecido nas rodadas anteriores.
- Seguir o checklist de CSS da skill (grep de cada classe alterada no arquivo inteiro, verificar `!important`/especificidade escondida).
- Testar via CDP/headless Chrome os dois cenários de quantidade de animais antes de reportar como concluído.
- Não commitar/dar push — isso é responsabilidade da skill `finalizar`, só quando solicitado.
