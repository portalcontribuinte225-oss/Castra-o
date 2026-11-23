# Plano de Implementação: Controles discretos nos cards de adoção + compartilhar no card da home pública

## Origem

- Arquivo de especificação: pedido na conversa (print dos cards internos de adoção), sem `.md` de feature
- Data do planejamento: `2026-11-23`
- Classificação: `frontend-only` — muda a aparência e a posição de botões que já existem; servidor e banco não mudam.

---

## Resumo

Nos cards da tela interna de adoção (grade):
- o contador de interessados e o X de excluir ficam pequenos e translúcidos sobre a foto;
- o lápis e o concluir/reativar do rodapé perdem o contorno e o fundo azul, e a cor só aparece ao passar o mouse.

Nos cards da home pública, o ícone de compartilhar fica na mesma linha de "N interessados", sem precisar abrir a janela do animal.

---

## Escopo

### Dentro do escopo

- Card interno em grade (`adoption-card-modern`): contador de interessados, X de excluir, editar e concluir/reativar.
- Card da home pública (`public-animal-card`): ícone de compartilhar ao lado do contador de interessados.
- Modo "só ícone" no `ShareAdoptionButton`.

### Fora do escopo

- Visualização em lista da tela interna (`adoption-list-modern`): continua com o concluir/reativar em azul. Recomendação aceita junto com o plano.
- O Compartilhar da janela do animal na home continua como está.
- A ficha do animal (drawer) e a janela de interessados.
- Testes visuais: ficam com o usuário.

---

## Leitura de contexto

- `/AGENT.md`
- `src/App.tsx`:
  - ~1428–1465: grade e card da home pública;
  - ~1510–1525: janela do animal com `ShareAdoptionButton`;
  - ~3405–3406: `adoptionIconButtonStyle` e `adoptionBlueButtonStyle`;
  - ~3852–3905: card interno em grade;
  - ~3925–3935: lista, que fica fora do escopo.
- `src/features/adoption-share/share-adoption-button.tsx`, `share-adoption.ts`
- `src/features/adoption/adoption-interest-count.ts`
- `src/components/button.tsx`: o base tem `tw:min-h-10 tw:px-3.5 tw:rounded-full tw:border` e não encolhe de forma confiável sobrescrevendo classes.
- `src/styles.css`: `.public-animal-footer` / `.public-interest-count` (~1140–1162), `.adoption-workspace .adoption-card-modern …` (~9267–9310).

---

## Impacto por área

### Frontend

**1. Controles sobre a foto (card interno em grade)**
- Nova constante de classes ao lado de `adoptionIconButtonStyle`, por exemplo `adoptionPhotoControlStyle`. O conteúdo é uma sugestão a ajustar:
  - `tw:inline-flex tw:h-7 tw:min-w-7 tw:items-center tw:justify-center tw:gap-1 tw:rounded-full tw:border-0 tw:px-2`
  - `tw:bg-slate-900/45 tw:text-xs tw:text-white tw:backdrop-blur-sm tw:enabled:hover:bg-slate-900/65`
  - foco visível branco
- O contador de interessados e o X passam a ser `<button type="button">` nativos com essa constante. O `Button` do app não serve aqui porque a altura mínima de 40px dele vence as sobrescritas.
- O contador continua com ícone `Users`, número, `title="Interessados"`, o `aria-label` atual e `openInterestsModal`. Quando há interessados, o número fica em negrito, sem trocar para verde.
- O X continua com `aria-label={"Excluir …"}` e `deleteAnimal`. O fundo fica vermelho (`ui-danger`) só ao passar o mouse.
- As posições não mudam: contador em cima à esquerda, X em cima à direita, `z-[3]`.

**2. Rodapé do card interno**
- O editar e o concluir/reativar viram botões de ícone sem borda e sem fundo (`Button variant="custom"` com borda transparente e fundo transparente). O tamanho de clique continua em 40px (`adoptionIconButtonStyle`).
- Ao passar o mouse, aparece o fundo `card-page`.
- O ícone do editar fica neutro (`ui-muted`); o do concluir/reativar fica azul (`var(--teal)`), sem preenchimento.
- Títulos, `aria-label` e ações não mudam.

**3. Card da home pública**
- No `.public-animal-footer`, o contador "N interessados" e o ícone de compartilhar ficam numa linha (`flex`, `items-center`, `justify-between`), com o contador à esquerda e o ícone à direita. O "Quero adotar" continua embaixo, em largura total.
- `ShareAdoptionButton` ganha um modo só com ícone, por prop: por exemplo `iconOnly`, ou `appearance` se um enum se justificar.
- No modo ícone:
  - mostra `Share2`, ou `Check` depois de copiar;
  - tem `aria-label` "Compartilhar {nome}" e o mesmo texto como dica ao passar o mouse;
  - anuncia o resultado ("Link copiado" / "Não deu para copiar o link") numa região `aria-live`.
- No modo completo (janela do animal), nada muda.
- O `stopPropagation` que já existe continua.

**4. Testes**
- Teste novo do `ShareAdoptionButton`, por HTML estático:
  - no modo completo, mostra "Compartilhar";
  - no modo ícone, não mostra o texto, tem `aria-label="Compartilhar {nome}"` e mostra o ícone.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `src/App.tsx` _(arquivo grande: só os trechos ~1436–1462, ~3405–3406 e ~3858–3905)_
- `src/features/adoption-share/share-adoption-button.tsx`
- `src/features/adoption-share/share-adoption-button.test.tsx` _(novo)_
- `src/styles.css` _(só se o `.public-animal-footer` precisar de ajuste para a linha nova)_

---

## O que será removido

- **Card interno em grade:**
  - o X com `Button variant="danger"`, que tinha borda e fundo vermelhos;
  - o contador como `Button variant="custom"` em pílula branca, junto com as classes condicionais `tw:border-ui-accent tw:bg-ui-accent-soft tw:text-ui-accent-strong` / `tw:border-card-border tw:bg-card-surface tw:text-ui-muted`;
  - o uso de `adoptionBlueButtonStyle` nos botões concluir/reativar do card. A constante continua, porque a lista ainda usa.
- **Home pública:** o contador solto no rodapé, que passa para a linha nova com o ícone de compartilhar.
- O que ficar sem uso depois da troca: imports, classes, e qualquer regra de `styles.css` que só servisse ao rodapé antigo.

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Criar a constante de classes dos controles sobre a foto e trocar o contador de interessados e o X do card interno por botões nativos com ela.
2. Deixar o editar e o concluir/reativar do rodapé do card interno sem borda e sem fundo, com a cor só no ícone e no hover.
3. Criar o modo só com ícone no `ShareAdoptionButton`, com nome acessível e aviso de "Link copiado".
4. Montar a linha "contador + compartilhar" no rodapé do card da home pública.
5. Procurar por grep as classes e estilos trocados e remover o que ficou sem uso.
6. Criar o teste do `ShareAdoptionButton`.
7. Rodar typecheck, testes e build uma vez ao final.

---

## Regras de negócio identificadas

- Os controles do card interno fazem o mesmo de hoje (abrir interessados, excluir, editar, concluir/reativar). Só muda a aparência.
- O compartilhar do card público gera o mesmo link da janela do animal (`adoptionShareDetails`) e não abre a janela.
- O contador de interessados continua mostrando o mesmo número (`getAdoptionInterestCount`).

---

## Regras multi-tenant e segurança

- Sem mudança: só a interface muda, sobre os animais que já vêm escopados pelo município.
- O link compartilhado é o público que já existe (`/adocao/<id>`).

---

## Validações necessárias

Nenhuma validação de entrada nova.

---

## Testes necessários

### Frontend

- `share-adoption-button.test.tsx` _(novo)_: modo completo com o texto "Compartilhar"; modo ícone sem o texto visível, com `aria-label` "Compartilhar {nome}".

### Backend

- Sem impacto.

### Conferência manual (tela) — feita pelo usuário

- **Tela interna de adoção, em grade:**
  - contador e X pequenos e translúcidos, legíveis em foto clara e escura;
  - X vermelho só ao passar o mouse;
  - editar e concluir sem fundo azul;
  - as ações funcionam como antes.
- **Home pública:**
  - "N interessados" e o ícone de compartilhar na mesma linha;
  - o ícone compartilha (no celular) ou copia o link (no computador) sem abrir a janela do animal;
  - "Quero adotar" continua embaixo.
- **Janela do animal:** o "Compartilhar" continua igual.

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

- **Fotos muito claras:** a leitura depende do fundo escuro translúcido. Conferir com foto clara.
- **Botões sobre a foto menores:** com 28px, o toque exige mais precisão. É uma tela interna, mas vale conferir no celular.
- **Card da home:** o clique no ícone de compartilhar não pode abrir a janela do animal. Ele fica fora do botão da foto e já usa `stopPropagation`.
- **Regra legada:** `button:where(:not([data-ui-button]))` força o peso de fonte do corpo nos botões nativos. Se o negrito do contador for necessário, considerar `data-ui-button`, como foi feito nos títulos da tabela de Bairros.
- Publicação: commit e push direto em `main`. O deploy só com ordem do usuário.

---

## Perguntas em aberto

Respostas assumidas pela recomendação, salvas junto com o plano sem resposta explícita:

1. "Área externa" = cards da home pública.
2. O Compartilhar continua também na janela do animal.
3. A visualização em lista fica fora desta mudança.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- No card interno em grade:
  - contador e X aparecem pequenos e translúcidos sobre a foto, com o vermelho só no hover;
  - editar e concluir/reativar ficam sem borda e sem fundo azul;
  - todas as ações funcionam como antes.
- No card da home pública:
  - o ícone de compartilhar aparece na linha do contador de interessados e compartilha sem abrir a janela do animal;
  - o "Quero adotar" continua.
- O `ShareAdoptionButton` tem os dois modos cobertos por teste.
- Tudo listado em "O que será removido" foi deletado.
- Typecheck, testes e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita.
- Seguir `/AGENT.md`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito.
- Não há `@testing-library`: os testes são de HTML estático (`renderToStaticMarkup`).
- Sem `!important` novo e sem classe CSS própria por feature. Preferir classes Tailwind em constantes, como `adoptionIconButtonStyle`.
- Testes visuais ficam com o usuário: validar com typecheck, testes e build.
