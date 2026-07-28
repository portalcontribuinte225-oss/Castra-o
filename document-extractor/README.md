# document-extractor

Extrai dados estruturados de documentos (PDF, PNG, JPEG) usando a Messages API da Anthropic.

## Configuração

```bash
cd document-extractor
pip install -r requirements.txt
cp .env.example .env
```

Edite `.env` e coloque sua chave real:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Schema

Edite `schema.py` para adaptar os campos ao seu formulário. Cada campo vira uma instrução para o modelo — o `description` de cada campo é o que orienta a extração.

## Uso

Um arquivo único (síncrono):

```bash
python extract.py caminho/para/documento.pdf
```

Uma pasta inteira (processamento em lote via Batch API — mais barato, mais lento):

```bash
python extract.py caminho/para/pasta
```

Salvar o resultado em arquivo:

```bash
python extract.py documento.pdf --output resultado.json
```

## Como funciona

- **Arquivo único**: usa `client.messages.parse()` com o schema Pydantic — a API já garante retorno estruturado, sem markdown, com retry automático para casos raros de recusa ou saída truncada.
- **Pasta**: usa a Message Batches API (50% mais barata, processamento assíncrono). Cada resultado é validado contra o mesmo schema; se o modelo devolver algo fora do formato esperado, o texto bruto é preservado no campo `erro`/`bruto` para inspeção manual.
- A instrução fixa de extração usa `cache_control: ephemeral` — só gera economia real de fato se ela ultrapassar o mínimo cacheável do modelo (~1024 tokens no `claude-sonnet-5`); com uma instrução curta, a marcação não causa erro, só não tem efeito prático.

## Modelo

Definido na constante `MODEL` em `extractor.py` (`claude-sonnet-5` por padrão). Troque ali se quiser usar outro.
