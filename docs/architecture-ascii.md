# ASCII Architecture Map

Language: **English** | [简体中文](architecture-ascii.zh-CN.md)

## C1: Context

```text
+------------------+        +----------------------------+
| Operator / Codex |        | TASK, AGENT, skills        |
+------------------+        +----------------------------+
          |                               |
          | reads boundary                | blocks forbidden actions
          v                               v
+------------------+        +----------------------------+
| Amazon pages     |        | Dianxiaomi pages           |
+------------------+        +----------------------------+
          |                               |
          | candidate evidence            | edit/save/readback state
          v                               v
+--------------------------------------------------------+
| Haituo Codex Project: userscripts + tools + evidence   |
+--------------------------------------------------------+
```

## C2: Containers

```text
+---------------- Browser / Tampermonkey ----------------+
|                                                        |
|  +--------------+      +-----------------------------+  |
|  | Amazon pages | ==>  | DXM Amazon Crawlbox V1      |  |
|  +--------------+      +-----------------------------+  |
|                                  | local evidence       |
|                                  v                      |
|  +--------------+      +-----------------------------+  |
|  | DXM pages    | <=>  | DXM Automation V1 - NEW     |  |
|  +--------------+      +-----------------------------+  |
|          |                      | readonly / dry-run    |
|          v                      v                      |
|  +----------------+    +-----------------------------+  |
|  | Payload V3     |    | Interface Detector V2       |  |
|  +----------------+    +-----------------------------+  |
|                                                        |
+--------------------------------------------------------+
                | reports, JSON, screenshots
                v
+----------------------- Local Repository ---------------+
| src/      userscripts                                  |
| tools/    Node/Python helpers                          |
| config/   schemas, thresholds, maps, risk rules         |
| skills/   execution rules and operational procedures    |
| docs/     architecture, test docs, audit, status        |
| runs/     curated run evidence                         |
| analysis/ offline payload and run analysis             |
+--------------------------------------------------------+
```

## C3: Main Flow

```text
Amazon candidate
  => Crawlbox scan
  => candidate/risk/price evidence
  => AliExpress category evidence + DXM map
  => Dianxiaomi readonly preflight
  => dry-run payload/report
  => explicit live gate
       | no
       v
     stop + report + exception queue
       |
       | yes
       v
     guarded save to wait-publish
       => authoritative readback
       => final report
```

## Legend

```text
=>  synchronous read or local command
<=> page read/write interaction inside current browser context
~>  evidence/report output
X   blocked unless TASK.md and explicit user confirmation allow the action
```

## Live-Action Boundary

```text
collection X
claim      X
edit       X
save       X
publish    always blocked
one-click  always blocked
```
