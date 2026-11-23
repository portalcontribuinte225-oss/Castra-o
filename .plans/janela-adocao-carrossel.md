# Plano de Implementação: Janela do animal com carrossel e uma rolagem só

## Origem

- Arquivo de especificação: nenhum `.md`. A base é a conversa de 2026-11-23: print do celular em produção com a janela de adoção cortada, o pedido de imagens menores, a remoção do "Compartilhar" e o carrossel para até 5 fotos.
- Data do planejamento: `2026-11-23`
- Classificação: `frontend-only` (sem backend, banco ou migration; as fotos continuam vindo como hoje, em `photos` e `main_photo_index`)
- Linhas citadas: estado do `main` em `c985533`. Conferir antes de editar.

---

## Resumo

No celular, a janela do animal tem altura fixa em `vh` e duas áreas presas: a foto em cima (mínimo de 260px, e ainda cresce) e as informações embaixo, rolando numa área própria. Com o formulário de interesse aberto:
- o nome fica cortado na borda da foto;
- o fim do formulário cai abaixo da tela, porque no Chrome do Android `100vh` não desconta a barra de endereço.

Além disso, a linha de miniaturas mostra as fotos, mas não troca a principal.

O plano:
- faz a janela rolar inteira de uma vez no celular, com altura pela tela visível (`dvh`);
- troca a foto e as miniaturas por um carrossel menor (até 5 fotos), que vira uma miniatura ao lado do nome quando o formulário abre;
- tira do modal o botão "Compartilhar" (fica o ícone no card da home) e o título "Registrar interesse".

O link `/adocao/<id>` abre a mesma janela e fica corrigido junto.

---

## Escopo

### Dentro do escopo

1. **Carrossel de fotos** na janela do animal, em todos os tamanhos:
   - arrastar no celular, com encaixe por foto;
   - setas ‹ › no computador e teclado ← →;
   - bolinhas indicando a posição (ex.: "Foto 2 de 5");
   - começa na foto principal do cadastro.
2. **Celular:** uma rolagem só na janela, altura até `100dvh - 24px`, carrossel em 16:10 com no máximo 40% da tela visível.
3. **Computador e tablet:** foto à esquerda e informações à direita, como hoje, com o carrossel na coluna da foto e altura em `dvh`.
4. **Formulário aberto e mensagem de sucesso:** miniatura de 64px ao lado do nome com a foto que estava na tela, no lugar do carrossel.
5. **Remoções:** o botão "Compartilhar" e o título "Registrar interesse" do modal; a versão com texto do `ShareAdoptionButton`; a linha de miniaturas.

### Fora do escopo

- A prévia da foto na mensagem do WhatsApp (imagem do link compartilhado montada pelo WhatsApp).
- Reduzir o peso das fotos antigas, de antes da compressão no cadastro.
- O card da home e a janela interna de cadastro de adoção.

---

## Leitura de contexto

Arquivos lidos para esta análise:

- `/AGENT.md`
- `src/App.tsx`: `AdoptionCarousel` (janela do animal, por volta das linhas 1467-1550), `getAnimalPhotos`/`getAnimalMainPhoto` (1589-1598), `normalizeAdoptionAnimal` (`mainPhotoIndex`, 1575-1583)
- `src/styles.css`:
  - `.animal-detail-modal` (1167 e 6808);
  - `.adoption-profile-modal`, `.adoption-profile-media`, `.adoption-main-photo`, `.adoption-thumb-row`, `.adoption-profile-info`, `.adoption-interest-form`, `.interest-form-heading` (1179-1320);
  - bloco `@media (max-width: 720px)` (3865-3890);
  - `.modal-backdrop`
- `src/features/adoption-share/share-adoption-button.tsx` e o teste dele

---

## Impacto por área

### Frontend

**Carrossel** (novo `src/features/adoption/adoption-photo-carousel.tsx`)
- Props: as fotos, o índice inicial (foto principal), o nome do animal (para o `alt`), a classe de gradiente do animal (fundo sem foto) e `onIndexChange`.
- Faixa com `overflow-x: auto` e `scroll-snap-type: x mandatory`, uma foto por vez, `object-fit: cover` centralizado. Sem biblioteca nova.
- A foto exibida segue a posição de rolagem (largura da faixa). Bolinhas e setas rolam a faixa até a foto.
- Fotos 2 a 5 com `loading="lazy"`; a primeira carrega normal.
- Abre no índice inicial (rolagem sem animação ao montar).
- Bolinhas: botões com `aria-label="Foto N de T"` e `aria-current` na exibida.
- Setas: botões "Foto anterior" e "Próxima foto". Só aparecem com mouse (`(hover: hover)`), mas funcionam pelo teclado. ← → na faixa troca a foto.
- Com uma foto só, sem setas nem bolinhas. Sem foto, a pata como hoje.
- Estilo em classes Tailwind no componente (padrão atual), sem classe CSS nova por feature.

**Janela do animal** (`AdoptionCarousel` em `App.tsx`)
- Novo estado `photoIndex`, iniciado pela foto principal (`mainPhotoIndex`) ao abrir o animal.
- O carrossel substitui `adoption-main-photo` e a linha de miniaturas.
- Com `showInterestForm` ou `interestSent`: no lugar do carrossel, miniatura de 64px com a foto `photoIndex`, ao lado do nome (no bloco da identidade).
- Saem o `<ShareAdoptionButton animal={selectedAnimal} />` e o bloco `interest-form-heading`.

**CSS**
- `.adoption-profile-modal`: `height: min(82vh, 620px)` passa a `min(82dvh, 620px)`.
- Bloco de 720px:
  - `height: calc(100vh - 20px)` dá lugar a altura pelo conteúdo, com `max-height: calc(100dvh - 24px)` e `overflow-y: auto` (uma rolagem só);
  - a mídia vira faixa 16:10 com `max-height: 40dvh`;
  - `.adoption-profile-info` sem rolagem própria.
- Corrigir as regras que decidem, sem regra por cima nem `!important` novo.

**Botão de compartilhar**
- `ShareAdoptionButton` fica só com o ícone (a prop `iconOnly` deixa de existir).
- O card da home continua igual.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

> **Atenção:** este plano não autoriza executar migrations automaticamente. Migrations não devem ser executadas sem confirmação explícita — o ambiente pode estar apontando para produção.

### Infra/Deploy

Sem impacto esperado.

---

## Arquivos provavelmente afetados

- `src/App.tsx` _(só o `AdoptionCarousel`)_
- `src/styles.css`
- `src/features/adoption/adoption-photo-carousel.tsx` _(novo)_
- `src/features/adoption/adoption-photo-carousel.test.tsx` _(novo)_
- `src/features/adoption-share/share-adoption-button.tsx`
- `src/features/adoption-share/share-adoption-button.test.tsx`

---

## O que será removido

**`src/App.tsx`, janela do animal**
- o `div.adoption-main-photo` e a linha `adoption-thumb-row` (substituídos pelo carrossel);
- `<ShareAdoptionButton animal={selectedAnimal} />`;
- o bloco `div.interest-form-heading` ("Registrar interesse").

**`src/features/adoption-share/share-adoption-button.tsx`**
- a versão com texto ("Compartilhar", `variant="outline"`, largura total);
- a prop `iconOnly` e o seu comentário;
- `iconOnly` nos usos (card da home) e nos testes.

**`src/features/adoption-share/share-adoption-button.test.tsx`**
- o teste "shows the Compartilhar label in the animal window".

**`src/styles.css`**
- `.adoption-main-photo` (regra base e regra do bloco de 720px);
- o seletor `.adoption-main-photo img` da regra compartilhada com `.adoption-thumb-row img`;
- `.adoption-thumb-row`, `.adoption-thumb-row img` e `.adoption-thumb-row img:hover`;
- `.interest-form-heading`;
- `height: calc(100vh - 20px)` do `.adoption-profile-modal` no bloco de 720px;
- o `overflow-y: auto` da `.adoption-profile-info` no celular (a rolagem passa para a janela).

> **Atenção para a skill `implementar`:** cada item acima deve ser **deletado do arquivo** — não comentado, não envolto em `if (false)`, não ocultado com `display: none` ou flag desativada. Se a remoção gerar erro de compilação, corrigir o erro — não suprimir com `@ts-ignore` ou `eslint-disable`.

---

## Estratégia de implementação

1. Criar o carrossel com os testes.
2. Na janela do animal:
   - estado `photoIndex` iniciado pela foto principal;
   - trocar a foto e as miniaturas pelo carrossel;
   - miniatura ao lado do nome com o formulário aberto ou depois do envio;
   - remover o "Compartilhar" e o título "Registrar interesse".
3. Ajustar o CSS da janela:
   - `dvh` no computador;
   - uma rolagem só e faixa 16:10 (até 40% da tela) no celular;
   - apagar as regras listadas.
4. Deixar o `ShareAdoptionButton` só com ícone, tirar o `iconOnly` dos usos e atualizar os testes.
5. Buscar (grep) cada classe alterada no `styles.css` inteiro, para não sobrar regra antiga ativa.
6. Rodar a validação uma vez ao final.

---

## Regras de negócio identificadas

- O carrossel abre na foto principal escolhida no cadastro (`main_photo_index`) e mostra no máximo as 5 fotos do animal.
- Com o formulário de interesse aberto ou depois do envio, a foto exibida vira miniatura ao lado do nome.
- O compartilhamento do animal fica só no ícone do card da home.
- A janela aberta pelo link compartilhado é a mesma, com o mesmo comportamento.

---

## Regras multi-tenant e segurança

Sem impacto: só apresentação, com os mesmos dados públicos de adoção já carregados por município.

---

## Validações necessárias

Nenhuma validação de formulário muda (nome e WhatsApp continuam obrigatórios).

---

## Testes necessários

### Frontend

- **Carrossel** (`renderToStaticMarkup`):
  - 3 fotos geram 3 bolinhas com "Foto N de 3";
  - a foto inicial aparece marcada;
  - fotos a partir da 2ª com `loading="lazy"`;
  - uma foto só, sem setas nem bolinhas;
  - sem fotos, mostra a pata.
- **Botão de compartilhar:** continua só com ícone, com nome acessível do animal (e o genérico quando não há nome).

### Backend

Sem mudança. Rodar a suíte por regra do AGENT.md.

### Conferência manual (tela)

**Celular (Android e iPhone)**
- Pelo card e pelo link `/adocao/<id>`:
  - a janela rola inteira;
  - o nome não fica cortado;
  - "Enviar interesse" aparece sem ficar sob a barra do navegador.
- Arrastar entre as fotos com encaixe, e as bolinhas acompanhando.
- "Quero adotar" troca o carrossel pela miniatura ao lado do nome.

**Computador**
- Setas e bolinhas trocam a foto; ← → também.
- Animal com uma foto só não mostra controles.

**Card da home**
- Continua com o ícone de compartilhar.

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

- **Fotos antigas pesadas** (de antes da compressão no cadastro): o carregamento tardio alivia as fotos 2 a 5, mas não a primeira.
- **Corte das bordas:** foto muito vertical ou horizontal perde as bordas (`cover`).
- **iPhone:** arraste com encaixe e bolinhas acompanhando a rolagem precisam de conferência na tela.
- **Produção:** commit e push direto em `main`, sem `staging`. Publicar só com ordem do usuário.

---

## Perguntas em aberto

Nenhuma pergunta em aberto identificada. Plano aprovado com as recomendações assumidas:

1. Saem do modal o "Compartilhar" e o título "Registrar interesse".
2. A foto preenche o espaço e corta as bordas, centralizada.
3. Com o formulário aberto, miniatura ao lado do nome.
4. A prévia da foto no WhatsApp fica fora deste plano.

---

## Critérios de aceite

A implementação deve ser considerada pronta quando:

- **Celular**
  - A janela tem uma rolagem só, cabe na tela visível (`dvh`) e não corta o nome nem o fim do formulário.
  - Pelo link compartilhado, o comportamento é o mesmo.
- **Carrossel**
  - Mostra até 5 fotos e começa na principal.
  - Troca por arraste, setas, bolinhas e teclado.
  - Fotos a partir da 2ª carregam tarde.
  - Com uma foto não há controles.
- **Formulário aberto e após o envio:** miniatura com a foto exibida, ao lado do nome.
- **Removidos:** o "Compartilhar" e o título "Registrar interesse" não aparecem mais no modal. O card da home mantém o ícone.
- **Código e validação**
  - Tudo da seção "O que será removido" apagado.
  - Nenhum `!important` novo.
  - Typecheck, testes e build sem erros novos.

---

## Observações para a skill `implementar`

- Usar este plano como fonte principal de contexto.
- Não executar migrations sem confirmação explícita (não há migration neste plano).
- Seguir `/AGENT.md`: código novo em inglês, um arquivo por responsabilidade, sem código morto.
- CSS: mudar a regra que decide, nunca regra por cima nem `!important` novo. Reutilizar `Button`, `Card` e as variáveis `--type-*`.
- Manter alterações pequenas e focadas.
- Deletar tudo que está na seção "O que será removido" — não ocultar.
- Atualizar testes conforme descrito. Testes só com valores falsos.
- Conferência visual fica com o usuário.
