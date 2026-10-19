"""Explicit cloud-inference CLI. Requires configured Azure subscription/credits.

No web endpoint calls Foundry, to avoid unexpected costs from public traffic.
Run only after billing and model quota have been confirmed.
"""
import argparse
import asyncio
import json

from api.agent_pipeline import run_pipeline
from api.foundry_agents import FoundryAgentBackend
from api.simulator import build_match


async def main():
    parser = argparse.ArgumentParser(description="Run actual Microsoft Foundry agents")
    parser.add_argument("--at", type=int, default=4500, help="Replay time in seconds")
    args = parser.parse_args()
    backend = FoundryAgentBackend()
    result = await run_pipeline(
        build_match(), at_second=args.at, backend=backend,
        provider="microsoft-foundry"
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
