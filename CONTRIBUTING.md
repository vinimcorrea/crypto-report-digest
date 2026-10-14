# Contributing

Thanks for helping make Crypto Report Digest better!

## Development

Requires Node 22+. There are no dependencies.

```bash
npm test        # unit tests (node:test)
npm run demo    # renders preview.html with the fictional data in test/
```

Source layout (`src/`):

| File | What it does |
|---|---|
| `extract.mjs` | Fetches the report site and extracts the editions from its JS bundle |
| `strategy.mjs` | Asks the LLM for the conservative/neutral/aggressive profiles (retries and model fallback) |
| `wallet.mjs` | Reads positions from Zerion and groups assets into buckets |
| `analyze.mjs` | Allocation, debt and the adherence score |
| `render.mjs` | HTML e-mail |
| `main.mjs` | Orchestration, state and sending through Resend |

Fixtures in `test/` let you run everything offline: `EDITIONS_FIXTURE`, `WALLET_FIXTURE` and `STRATEGY_FIXTURE`.

If you change the e-mail layout, regenerate `docs/preview.png` from `npm run demo`. The README banner `docs/hero.png` is a 1280×640 screenshot of `docs/hero.html`, which also works as the repository's social preview image.

## Pull requests

- Keep PRs small and focused, and describe what changed and why.
- Make sure `npm test` and `npm run demo` pass.
- Use [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`...).
- Never commit API keys, real wallet addresses or report content. Use fictional data.
