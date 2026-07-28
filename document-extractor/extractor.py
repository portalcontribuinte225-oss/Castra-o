"""Extração estruturada de documentos via API da Anthropic (síncrono e em lote)."""

import base64
import json
import mimetypes
import os
import re
import time
from pathlib import Path
from typing import Optional

import anthropic
from anthropic import Anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request
from dotenv import load_dotenv

from schema import ExtractionSchema

load_dotenv(Path(__file__).resolve().parent / ".env")

MODEL = "claude-sonnet-5"
MAX_TOKENS = 1024
MAX_RETRIES = 2
BATCH_POLL_INTERVAL_SECONDS = 15

EXTRACTION_INSTRUCTION = (
    "Você é um extrator de dados estruturados. Leia o documento anexado com atenção "
    "e extraia exatamente os campos definidos no schema fornecido. Não invente "
    "informação que não esteja visível no documento — use uma string vazia quando um "
    "campo não puder ser identificado. Baseie-se apenas no conteúdo real do arquivo."
)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)

_client: Optional[Anthropic] = None


def get_client() -> Anthropic:
    """Cria (uma vez) o client da Anthropic, lendo a chave do ambiente."""
    global _client
    if _client is None:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError(
                "ANTHROPIC_API_KEY não encontrada. Configure no arquivo .env (veja .env.example)."
            )
        _client = Anthropic()
    return _client


def build_content_block(path: Path) -> dict:
    """Detecta o mime do arquivo e monta o content block (document ou image)."""
    mime_type, _ = mimetypes.guess_type(str(path))
    if mime_type == "application/pdf":
        block_type = "document"
    elif mime_type in ("image/png", "image/jpeg"):
        block_type = "image"
    else:
        raise ValueError(
            f"Tipo de arquivo não suportado: {path.name} (mime detectado: {mime_type}). "
            "Aceita apenas PDF, PNG e JPEG."
        )
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return {
        "type": block_type,
        "source": {"type": "base64", "media_type": mime_type, "data": data},
    }


def _system_blocks() -> list:
    return [
        {
            "type": "text",
            "text": EXTRACTION_INSTRUCTION,
            "cache_control": {"type": "ephemeral"},
        }
    ]


def _user_message(content_block: dict) -> list:
    return [
        {
            "role": "user",
            "content": [
                content_block,
                {"type": "text", "text": "Extraia os dados deste documento."},
            ],
        }
    ]


def process_document(path: str) -> ExtractionSchema:
    """Extrai dados de um único arquivo (PDF/PNG/JPEG), síncrono."""
    file_path = Path(path)
    content_block = build_content_block(file_path)
    client = get_client()

    last_error: Optional[BaseException] = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = client.messages.parse(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                thinking={"type": "disabled"},
                system=_system_blocks(),
                messages=_user_message(content_block),
                output_format=ExtractionSchema,
            )
        except anthropic.AuthenticationError as err:
            raise RuntimeError(
                "Chave de API inválida ou ausente. Confira ANTHROPIC_API_KEY no .env."
            ) from err
        except anthropic.RateLimitError as err:
            last_error = err
            time.sleep(2 ** attempt)
            continue
        except anthropic.APIStatusError as err:
            if err.status_code in (500, 529):
                last_error = err
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(
                f"Erro da API Anthropic (status {err.status_code}): {err.message}"
            ) from err
        except anthropic.APIConnectionError as err:
            raise RuntimeError(f"Falha de conexão com a API Anthropic: {err}") from err

        if response.stop_reason == "refusal":
            last_error = RuntimeError("A IA recusou a solicitação (stop_reason=refusal).")
            continue
        if response.parsed_output is None:
            last_error = RuntimeError("Resposta não pôde ser validada contra o schema.")
            continue

        return response.parsed_output

    raise RuntimeError(
        f"Falha ao extrair {file_path.name} após {MAX_RETRIES + 1} tentativa(s): {last_error}"
    )


def _sanitize_custom_id(index: int, filename: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]", "-", Path(filename).stem)[:50]
    return f"{index:03d}-{slug}" if slug else f"doc-{index:03d}"


def _output_config() -> dict:
    return {"format": {"type": "json_schema", "schema": ExtractionSchema.model_json_schema()}}


def _extract_text(content_blocks) -> str:
    for block in content_blocks:
        if block.type == "text":
            return block.text
    return ""


def _validate_json(text: str) -> Optional[dict]:
    for candidate in (text, _FENCE_RE.sub("", text).strip()):
        try:
            return ExtractionSchema.model_validate_json(candidate).model_dump()
        except (json.JSONDecodeError, Exception):
            continue
    return None


def process_folder(dir_path: str, poll_interval: int = BATCH_POLL_INTERVAL_SECONDS) -> dict:
    """Extrai dados de todos os arquivos suportados de uma pasta via Batch API."""
    folder = Path(dir_path)
    files = sorted(p for p in folder.iterdir() if p.is_file())
    if not files:
        raise ValueError(f"Nenhum arquivo encontrado em {folder}")

    client = get_client()
    custom_id_to_filename: dict = {}
    requests_list: list = []

    for index, file_path in enumerate(files):
        try:
            content_block = build_content_block(file_path)
        except ValueError as err:
            print(f"Aviso: pulando {file_path.name} — {err}")
            continue

        custom_id = _sanitize_custom_id(index, file_path.name)
        custom_id_to_filename[custom_id] = file_path.name
        requests_list.append(
            Request(
                custom_id=custom_id,
                params=MessageCreateParamsNonStreaming(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    thinking={"type": "disabled"},
                    system=_system_blocks(),
                    messages=_user_message(content_block),
                    output_config=_output_config(),
                ),
            )
        )

    if not requests_list:
        raise ValueError("Nenhum arquivo suportado (PDF/PNG/JPEG) encontrado na pasta.")

    try:
        batch = client.messages.batches.create(requests=requests_list)
    except anthropic.AuthenticationError as err:
        raise RuntimeError(
            "Chave de API inválida ou ausente. Confira ANTHROPIC_API_KEY no .env."
        ) from err
    except anthropic.APIStatusError as err:
        raise RuntimeError(
            f"Erro da API Anthropic (status {err.status_code}): {err.message}"
        ) from err

    while True:
        batch = client.messages.batches.retrieve(batch.id)
        if batch.processing_status == "ended":
            break
        time.sleep(poll_interval)

    results: dict = {}
    for result in client.messages.batches.results(batch.id):
        filename = custom_id_to_filename.get(result.custom_id, result.custom_id)
        if result.result.type == "succeeded":
            text = _extract_text(result.result.message.content)
            parsed = _validate_json(text)
            results[filename] = (
                parsed if parsed is not None else {"erro": "Falha ao validar JSON", "bruto": text}
            )
        elif result.result.type == "errored":
            results[filename] = {"erro": result.result.error.error.message}
        else:
            results[filename] = {"erro": f"Requisição {result.result.type}"}

    return results
