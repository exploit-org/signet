# Contributing to Signet

Thanks for contributing to Signet. It's a security-sensitive, multi-chain Java library, so we keep changes disciplined: clear intent, clear tests, and minimal noise.

## Where to post what

- **Security issues:** do **NOT** open a public issue or discussion. See [SECURITY](SECURITY.md) and report them privately.
- **Questions / support:** use **GitHub Discussions** (Q&A) or contact the maintainers at `contact@exploit.org`.
- **Bugs / actionable work:** use **GitHub Issues** (only after you can describe a reproducible problem).
- **Design proposals / larger changes:** start in **Discussions** first (Ideas), then open an issue/PR.

## Reporting a bug (Issues)

Before opening an issue:

- Search existing issues/discussions.
- Test on the latest release (or the default branch if you can).

Include:

- Expected vs actual behavior
- Signet version / commit SHA
- Minimal reproduction steps
- Logs/stack traces
- Environment (OS, JDK)

If you can provide a minimal failing test, even better.

## Feature requests (Discussions → Issues)

Start in Discussions with:

- The real problem you're solving
- Proposed API/behavior
- Compatibility notes (breaking vs non-breaking)
- Any relevant standards/papers/RFCs

If the direction is agreed, convert it to an issue.

## Testing expectations

- If your change affects behavior, **add or update a unit or integration test**. See [integration tests](integration-tests).
- If you're not sure whether something is behavioral, assume it is and add the test.

## Code style

- Prefer small PRs with one clear purpose.
- Add tests for behavior changes when practical.
- Don’t mix large refactors with bug fixes. Keep fixes small and reviewable.
- Keep public API changes explicit.

## Commit messages

Use short, clear commit messages that describe the change. Prefixes such as `feat:`, `fix:`, or `chore:` are not required.

Good examples:

- `Fix transaction signature validation`
- `Add integration test for block parsing`
- `Update dependency versions`
- `Document account creation`

Keep each commit focused on one logical change.

## Pull requests

A PR should include:

- What changed (short summary)
- Why it changed (rationale)
- Tests added/updated (or why not)
- Notes on compatibility and security impact (if applicable)

## License

By contributing, you agree that your contributions will be licensed under the project [Apache 2.0](LICENSE.md) license.
