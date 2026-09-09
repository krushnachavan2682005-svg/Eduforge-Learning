import argparse
import json
from pathlib import Path

from app.config.settings import get_settings
from app.embeddings.factory import build_embedding_components


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate embedding and pgvector prerequisites without mutation")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--show-database", action="store_true")
    parser.add_argument("--show-model", action="store_true")
    parser.add_argument("--output-file")
    args = parser.parse_args()
    _, _, _, preflight, _ = build_embedding_components(get_settings())
    result = preflight.run(check_model=True)
    payload = result.to_dict()
    if args.json:
        rendered = json.dumps(payload, indent=2, default=str)
    else:
        rendered_lines = []
        for check in result.checks:
            value = check.details or check.message or ""
            rendered_lines.append(f"{check.name.replace('_', ' ').title()}: {check.status} {value}")
        rendered_lines.extend([
            f"Overall result: {'PASS' if result.passed else 'FAIL'}",
            f"Blocking reason: {result.blocking_reason or 'NONE'}",
        ])
        rendered = "\n".join(rendered_lines)
    print(rendered)
    if args.output_file:
        Path(args.output_file).write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
