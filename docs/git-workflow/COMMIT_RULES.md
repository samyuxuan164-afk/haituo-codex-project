# Git Commit Rules

## Goal

Every code change, rule update, execution document update, test report, and optimization must be committed to Git with small, auditable commits.

## Core Rules

1. Do not make large mixed commits.
2. One commit should represent one clear purpose.
3. Code changes and documentation changes should be committed separately when possible.
4. Execution logs, validation reports, and rule updates must be committed after each meaningful task.
5. Always run `git status` before and after committing.
6. Always push to GitHub after a completed commit unless the work is still unsafe or incomplete.
7. Never commit real passwords, API keys, cookies, sessions, tokens, or private account data.

## Minimum Commit Granularity

Use the smallest practical commit unit:

- one bug fix
- one rule update
- one skill update
- one validation report
- one execution document update
- one script improvement
- one cleanup operation

## Commit Message Format

Use this format:

```text
type(scope): short summary
