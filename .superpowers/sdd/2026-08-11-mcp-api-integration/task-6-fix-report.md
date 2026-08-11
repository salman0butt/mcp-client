# Task 6 documentation fix report

## Change

Updated `README.md` so the client verification workflow uses:

```bash
cd client
bun run test
```

The README now briefly explains that this configured Vitest script is required
because direct Bun discovery misses the repository's `*.vitest.ts` and
`*.vitest.tsx` filenames.

No source code or unrelated documentation was changed. `.env` and the root
`bun.lock` were not touched.

## Verification

- Focused README search confirmed the client command is `bun run test` and the
  discovery note is present.
- `git diff --check`: passed with no whitespace errors.
- `cd client && bun run test`: passed; 2 test files and 18 tests passed.
