"""CLI: python extract.py <arquivo_ou_pasta> [--output arquivo.json]"""

import argparse
import json
import sys
from pathlib import Path

from extractor import process_document, process_folder


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai dados estruturados de documentos via Anthropic.")
    parser.add_argument("path", help="Caminho de um arquivo (PDF/PNG/JPEG) ou de uma pasta")
    parser.add_argument("--output", "-o", help="Arquivo para salvar o JSON resultante (opcional)")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"Caminho não encontrado: {target}", file=sys.stderr)
        return 1

    try:
        if target.is_dir():
            result = process_folder(str(target))
        else:
            result = process_document(str(target)).model_dump()
    except RuntimeError as err:
        print(f"Erro: {err}", file=sys.stderr)
        return 1

    output_json = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output:
        Path(args.output).write_text(output_json, encoding="utf-8")
        print(f"Resultado salvo em {args.output}")
    else:
        print(output_json)

    return 0


if __name__ == "__main__":
    sys.exit(main())
