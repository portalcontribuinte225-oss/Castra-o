# Plano de Implementação: Módulo Python de Extração Estruturada de Documentos (API Anthropic)

## Origem

- Solicitação direta do usuário em conversa (especificação detalhada em 6 requisitos numerados: autenticação, leitura de documentos, extração, otimização de custo, uso/CLI, qualidade).
- Data do planejamento: `2026-07-26`
- Classificação: `ferramenta standalone` — módulo Python independente, sem integração com o app Node/Express existente.

## Resumo

Criar um módulo Python novo (`document-extractor/`) que extrai dados estruturados de documentos (PDF e imagem) usando a Messages API da Anthropic, com schema de campos configurável via Pydantic, suporte a arquivo único (síncrono) e pasta inteira (Batch API), prompt caching na instrução fixa de extração, e tratamento de erros claro.

Este projeto (a "castração") é inteiramente Node/TypeScript — não existe nenhum código Python nem dependência de IA em Python hoje. Este módulo não altera nem depende de nenhum arquivo existente do app; vive isolado em sua própria pasta na raiz do repositório.

**Decisão técnica relevante, já validada com o usuário**: em vez do fluxo pedido originalmente ("prompt pedindo JSON" + "limpar cercas markdown manualmente"), o fluxo síncrono usa `client.messages.parse(output_format=SeuModeloPydantic)` — a forma nativa e recomendada hoje pela Anthropic para extração estruturada, que já retorna `response.parsed_output` validado contra o schema Pydantic sem necessidade de limpeza manual de markdown. A limpeza de cercas + retry manual (como pedido originalmente) é mantida apenas no modo Batch, onde esse helper não está disponível.

## Escopo

### Dentro do escopo

- Estrutura de arquivos do módulo (`document-extractor/`), `requirements.txt`, `.env.example`, `.gitignore` específico de Python.
- Leitura de PDF (bloco `document`) e imagem PNG/JPG (bloco `image`), base64 puro, detecção de mime via `mimetypes` (biblioteca padrão).
- Schema de extração configurável via Pydantic (`schema.py`), com campos de exemplo genéricos (nome, cpf, data, endereço).
- `process_document(path)` — fluxo síncrono via `client.messages.parse()`.
- `process_folder(dir)` — fluxo em lote via Batch API (`client.messages.batches.create/retrieve/results`), com `custom_id` sanitizado por arquivo.
- Prompt caching (`cache_control: ephemeral`) na instrução fixa de extração.
- CLI simples (`python extract.py <arquivo_ou_pasta>`).
- Tratamento de erros tipado (401, 429, 5xx/529) com mensagens claras.
- README com instruções de configuração da chave e uso.

### Fora do escopo

- Qualquer integração com o app Node/Express existente (frontend, backend, banco de dados) — módulo 100% isolado.
- OCR local ou qualquer fallback sem IA — este módulo é inteiramente baseado na API externa da Anthropic.
- Interface gráfica — só CLI.
- Deploy/infraestrutura para rodar este módulo em produção (fica como script local, a critério do usuário decidir depois onde/como rodar).

## Leitura de contexto

- Especificação do usuário (mensagem direta, 6 requisitos numerados).
- Documentação oficial da Anthropic consultada via WebFetch: Batch Processing API, Structured Outputs (Pydantic), Document & File Input, Prompt Caching — para garantir sintaxe exata do SDK Python (não baseado em suposição).
- Confirmado: nenhum arquivo Python ou dependência de IA existe hoje neste repositório.

## Impacto por área

### Frontend / Backend / Banco de dados

Sem impacto esperado — módulo Python standalone, não integrado ao app Node.js existente.

### Infra/Deploy

Sem impacto esperado. Nenhuma alteração em `.env` do projeto principal, CI/CD ou configuração de deploy do Render.

## Arquivos a serem criados

```
document-extractor/
├── .env.example
├── .gitignore
├── requirements.txt
├── README.md
├── schema.py       # ExtractionSchema (Pydantic) — o arquivo que o usuário edita/adapta
├── extractor.py     # client, leitura de documento, process_document(), process_folder()
└── extract.py       # CLI
```

## Estratégia de implementação

1. Criar a estrutura de pastas/arquivos e `requirements.txt` (`anthropic`, `pydantic`, `python-dotenv`).
2. Criar `.env.example` e `.gitignore` específico de Python (confirmar que `.env` já está coberto pelo `.gitignore` da raiz do projeto, sem precisar duplicar).
3. Implementar `schema.py` com `ExtractionSchema` (Pydantic) e campos de exemplo genéricos.
4. Implementar `extractor.py`:
   - Inicialização do client (lê `ANTHROPIC_API_KEY` do ambiente, nunca hardcoded).
   - Leitura de arquivo + detecção de mime + montagem do content block (`document` ou `image`).
   - Instrução de extração fixa com `cache_control: ephemeral`.
   - `process_document(path)` via `client.messages.parse(output_format=ExtractionSchema)`, com retry limitado (2 tentativas extras) para os casos de `refusal`/`max_tokens`/falha de validação.
   - Tratamento de erros tipado (`AuthenticationError`, `RateLimitError`, `APIStatusError` cobrindo 5xx/529; fallback genérico para qualquer outro status, incluindo o 402 mencionado pelo usuário, que não é um código documentado da API da Anthropic).
5. Implementar `process_folder(dir)`:
   - Montar `Request`/`MessageCreateParamsNonStreaming` por arquivo, com `custom_id` sanitizado.
   - `output_config.format` montado manualmente a partir do schema Pydantic (já que `.parse()` não está disponível no Batch).
   - Poll até `processing_status == "ended"`, depois `client.messages.batches.results()`.
   - Validar cada resultado contra o schema Pydantic; limpar cercas markdown como fallback defensivo antes de reportar falha.
   - Combinar resultados por `custom_id` (a ordem não é garantida pela API).
6. Implementar `extract.py` (CLI): detecta se o argumento é arquivo ou pasta, chama a função certa, imprime/salva o JSON resultante.
7. Escrever `README.md` com instruções de configuração da chave e como rodar.
8. Validar rodando localmente (arquivo único e pasta pequena) — só se o usuário fornecer/confirmar uma chave de API real para teste, dado o histórico de cautela com custo nesta mesma conversa.

## Validações necessárias

- Rodar `python extract.py <arquivo de teste>` e confirmar que `parsed_output` vem preenchido corretamente.
- Rodar `python extract.py <pasta de teste>` com 2-3 arquivos pequenos e confirmar que os resultados batem por `custom_id`.
- Confirmar que erros de autenticação (chave ausente/inválida) produzem mensagem clara, sem travar com stack trace bruto.

## Riscos e pontos de atenção

- Custo real de API a cada execução — testes devem ser deliberados e mínimos (já demonstrado nesta conversa que o usuário monitora saldo de conta).
- Cache de prompt só ativa de fato se a instrução fixa de extração ultrapassar o mínimo cacheável do modelo (~1024 tokens no `claude-sonnet-5`) — instruções curtas não vão gerar economia real, mas a marcação não causa erro.
- Extração de PDF totalmente escaneado (sem texto embutido) depende inteiramente da visão do modelo, sem OCR de apoio.

## Perguntas em aberto

Nenhuma pergunta em aberto identificada — especificação já era suficientemente detalhada, e as decisões técnicas (uso de `.parse()`, localização do módulo) foram validadas com o usuário durante o planejamento.

## Critérios de aceite do plano

- Estrutura de arquivos criada conforme especificado.
- `process_document()` funciona para PDF e imagem (PNG/JPG), retornando dado validado contra o schema Pydantic.
- `process_folder()` processa múltiplos arquivos via Batch API e retorna resultados combinados por `custom_id`.
- CLI funcional para arquivo único e pasta.
- README claro sobre configuração da chave.
- Nenhum arquivo do app Node/Express existente foi alterado.

## Observações para a skill implementar

- Seguir a ordem pedida pelo usuário: estrutura de arquivos + requirements.txt primeiro, depois fluxo síncrono, por último modo Batch.
- Não fazer nenhuma chamada real à API sem confirmação explícita do usuário (custo).
- Não alterar nenhum arquivo do app Node/Express existente.
- Não alterar `.env` da raiz do projeto.
- Manter o nome do modelo como constante fácil de trocar.
