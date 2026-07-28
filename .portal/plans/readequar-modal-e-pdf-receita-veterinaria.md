# Plano de Implementacao: Readequar Modal e PDF de Receita Veterinaria

## Origem

- Arquivo de especificacao: `solicitacao inline no chat com imagem de referencia`
- Data do planejamento: `2026-07-28`
- Classificacao: `frontend-only`

## Resumo

Readequar o modal de receita veterinaria para uma interface mais limpa, removendo elementos redundantes, e atualizar o PDF gerado para se aproximar de um receituario institucional com dados do municipio cadastrados em configuracao.

## Escopo

### Dentro do escopo

- Remover do modal:
  - card verde do animal;
  - data exibida no rodape;
  - linha de assinatura;
  - botao `Salvar`.
- Manter no modal:
  - titulo;
  - identificacao simples do animal/processo;
  - campo de prescricao;
  - botao `Cancelar`;
  - botao `Gerar PDF`.
- Salvar automaticamente o texto da receita ao gerar PDF.
- Passar dados do municipio para o modal/PDF usando dados ja existentes no frontend.
- Readequar layout do PDF para receituario institucional:
  - cabecalho tipo papel timbrado;
  - brasao/logo do municipio quando disponivel;
  - nome da prefeitura/municipio em destaque;
  - contato, email, endereco e CEP quando disponiveis;
  - protocolo em area discreta;
  - dados do tutor e animal;
  - area principal com `Rx` e prescricao;
  - rodape institucional.

### Fora do escopo

- Criar campos novos no banco.
- Criar migrations.
- Alterar backend, endpoints ou contratos de API.
- Implementar assinatura digital.
- Criar upload novo de assinatura/CRMV/responsavel tecnico.
- Alterar o fluxo de atendimento fora do modal de receita.

## Leitura de contexto

- `/AGENT.md`
- `frontend/AGENT.md`: nao encontrado no workspace
- `src/App.tsx`
- `src/styles.css`
- `backend/src/routes/municipalities.js`
- `backend/src/db/migrations.js`

## Impacto por area

### Frontend

Impacta `PrescriptionModal`, `generatePrescriptionPdf` e estilos `prescription-*`.

Alteracoes previstas:

- Remover a faixa verde `prescription-patient-strip` do modal ou substituir por resumo textual simples no topo.
- Remover `prescription-sig-row`, `prescription-date` e `prescription-sig-line` do modal.
- Remover botao `Salvar` do rodape do modal.
- Fazer `Gerar PDF` chamar `onSave(text)` antes de gerar o documento.
- Passar `municipality` ou dados equivalentes para `PrescriptionModal`.
- Atualizar `generatePrescriptionPdf` para receber/derivar dados do municipio.
- Usar `municipality.name`, `municipality.brasao`, `municipality.contact`, `municipality.email`, `municipality.address` e `municipality.cep` quando existirem.
- Manter fallback limpo quando municipio ou campos estiverem vazios.

### Backend

Sem impacto esperado.

### Banco de dados

Sem impacto esperado.

Atencao: migrations nao devem ser executadas sem confirmacao explicita do usuario, pois o ambiente atual pode estar apontando para producao.

### Infra/Deploy

Sem impacto esperado.

## Arquivos provavelmente afetados

- `src/App.tsx`
- `src/styles.css`

## Estrategia de implementacao

1. Localizar a chamada de `PrescriptionModal` dentro de `RequestPreviewModal`.
2. Identificar como obter o municipio ativo da solicitacao:
   - por `request.municipalityId`;
   - por `currentUser.municipalityId`;
   - por lista `municipalities`, se estiver disponivel no escopo.
3. Se `municipalities` nao estiver disponivel no modal, passar a lista ou o objeto do municipio a partir das telas que abrem `RequestPreviewModal`.
4. Ajustar `PrescriptionModal` para receber `municipality`.
5. Remover do JSX do modal o card verde, data, linha de assinatura e botao salvar.
6. Ajustar `handleGenerate` para:
   - validar texto;
   - chamar `onSave(text)`;
   - gerar PDF com `generatePrescriptionPdf(request, text, municipality)`.
7. Consolidar/remover CSS morto de `prescription-patient-strip`, `prescription-patient-tag`, `prescription-chip-tag`, `prescription-proto`, `prescription-sig-row`, `prescription-date` e `prescription-sig-line` quando nao forem mais usados.
8. Reescrever `generatePrescriptionPdf` mantendo `pdf-lib`, sem nova dependencia:
   - papel A4;
   - cabecalho com brasao/nome/contatos;
   - bloco discreto de protocolo;
   - linha de paciente/tutor;
   - `Rx` grande;
   - prescricao com quebra de linha e limite seguro;
   - rodape com endereco/contato.
9. Garantir que imagens de brasao em data URL sejam tratadas com try/catch para nao quebrar PDF se formato falhar.
10. Rodar validacoes.

## Regras de negocio identificadas

- Receita deve usar dados do municipio configurado sempre que existirem.
- Receita deve continuar vinculada ao processo/protocolo.
- Texto da prescricao continua livre.
- Gerar PDF deve preservar o texto digitado no atendimento.
- Se nao houver dados do municipio, usar fallback institucional generico sem quebrar o PDF.
- Responsavel tecnico/CRMV nao deve ser inventado; usar `request.veterinarian` quando disponivel, ou deixar sem destaque especifico.

## Regras multi-tenant e seguranca

- Nao buscar dados de outro municipio.
- Usar apenas municipio associado ao processo/usuario/escopo atual.
- Nao alterar permissoes nem backend.
- Nao expor dados sensiveis alem dos dados institucionais ja cadastrados em configuracao.

## Validacoes necessarias

- Modal abre sem card verde, data, linha de assinatura e botao salvar.
- `Gerar PDF` fica desabilitado sem texto.
- `Gerar PDF` salva a prescricao e abre preview do PDF.
- PDF usa nome/brasao/contato/email/endereco/CEP do municipio quando disponiveis.
- PDF nao quebra quando brasao ou dados do municipio estiverem ausentes.
- Texto longo da prescricao nao extrapola pagina de forma grosseira.

## Testes necessarios

### Frontend

- Validacao manual do modal de receita.
- Validacao manual do PDF gerado com municipio com brasao.
- Validacao manual do PDF gerado sem brasao/dados de municipio.
- `npm run typecheck`.
- `npm run build`.

### Backend

Sem testes backend esperados.

### E2E

Nao obrigatorio para este ajuste, mas desejavel futuramente para fluxo de atendimento e emissao de receita.

## Comandos de validacao sugeridos

```bash
git diff --check
npm run typecheck
npm run build
```

## Riscos e pontos de atencao

- `src/App.tsx` e `src/styles.css` sao arquivos grandes e historicos; manter alteracao pequena.
- O PDF atual usa desenho manual com `pdf-lib`; quebra de texto e posicionamento precisam ser cuidados.
- Brasao pode estar em diferentes formatos de imagem; tratar falha ao embutir sem impedir a geracao.
- Existe alteracao pendente em `src/styles.css` no inicio do planejamento; preservar mudancas nao relacionadas.
- Push e commit sao feitos direto em `main` quando a skill `finalizar` for usada.

## Perguntas em aberto

- O responsavel tecnico deve vir de `request.veterinarian`, usuario logado ou permanecer omitido quando nao houver campo cadastrado?

## Criterios de aceite do plano

- Modal da receita fica limpo, sem card verde, sem data, sem assinatura e sem botao salvar.
- `Gerar PDF` salva automaticamente a prescricao.
- PDF se aproxima visualmente de papel timbrado/receituario institucional.
- PDF usa dados cadastrados do municipio quando disponiveis.
- Sem backend, migrations ou novos campos de banco.
- `git diff --check`, `npm run typecheck` e `npm run build` passam.

## Observacoes para a skill implementar

- Usar este plano como fonte principal de contexto.
- Nao executar migrations.
- Nao alterar backend.
- Nao criar nova dependencia.
- Preservar mudancas pendentes nao relacionadas.
- Consolidar CSS removendo regras mortas em vez de empilhar override.
