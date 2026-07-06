---
name: capability-deposition
description: Mandatory post-task process that turns execution experience into reusable project skills and updates project memory after every meaningful task.
---

# Capability Deposition Skill

Use this skill after every meaningful project task.

## Input

```json
{
  "task": "what was executed",
  "successes": [],
  "failures": [],
  "reusableOperations": [],
  "filesChanged": [],
  "validation": []
}
```

## Process

1. Task summary:
   - record what task was done;
   - record which steps succeeded;
   - record which steps failed;
   - record which operations are repeatable.
2. Capability extraction:
   - extract collection rules;
   - extract recognition logic;
   - extract DOM / WebBridge operation methods;
   - extract category decision rules;
   - extract field filling rules;
   - extract preflight rules;
   - extract error recovery methods;
   - extract skip conditions;
   - extract success paths.
3. Skill write:
   - write reusable rules under `/skills/`;
   - each skill must include `Input`, `Process`, and `Output`;
   - each skill must be executable, not only descriptive;
   - update an existing skill when it owns the capability;
   - create a new skill only when no existing skill owns the capability.
4. Project memory update:
   - update `DEVELOPMENT_LOG.md`;
   - update `docs/current-status.md`;
   - record every added or updated Skill path.

## Output

```json
{
  "summaryWritten": true,
  "capabilitiesExtracted": [],
  "skillsAdded": [],
  "skillsUpdated": [],
  "projectMemoryUpdated": true,
  "validation": []
}
```

## Hard Rules

1. Do not end a meaningful task with only chat summary.
2. Do not write only a report when reusable capability was discovered.
3. Do not leave failures only in chat; write skip/failure rules into a skill or project memory.
4. Do not add vague skill text; rules must be directly reusable by the next batch.
