"""Script utilitário para rodar o ETL PNCP manualmente.

Uso:
    python -m scripts.run_etl_manual --tipos contrato --ufs SP,RJ --keywords software,TI
"""
from __future__ import annotations

import argparse
import logging
import sys

from app.core.database import SessionLocal
from app.services.pncp.etl import run_full_etl

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tipos", default="contrato", help="tipos_documento: contrato|ata|edital")
    parser.add_argument("--status", default="vigente")
    parser.add_argument("--ufs", default="", help="CSV de UFs (ex: SP,RJ,MG)")
    parser.add_argument("--keywords", default="", help="CSV de keywords")
    parser.add_argument("--max-paginas", type=int, default=None)
    args = parser.parse_args()

    ufs = [u.strip() for u in args.ufs.split(",") if u.strip()] or None
    kws = [k.strip() for k in args.keywords.split(",") if k.strip()] or None

    with SessionLocal() as db:
        resumo = run_full_etl(
            db,
            tipos_documento=args.tipos,
            keywords=kws,
            ufs=ufs,
            status=args.status,
            max_paginas=args.max_paginas,
        )
        print(resumo)
    return 0


if __name__ == "__main__":
    sys.exit(main())
