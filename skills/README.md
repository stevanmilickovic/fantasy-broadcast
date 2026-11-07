# Project skills

Ponytail's six upstream skills are vendored here for backend and frontend work.
The root [AGENTS.md](../AGENTS.md) requires the main skill for coding tasks and
routes requested reviews/audits to the matching skill. Each stack's guidelines
continue to apply. These instructions are available on the next turn through
the repository guidelines; no global plugin installation is required.

| Skill                                       | Use                                                     |
| ------------------------------------------- | ------------------------------------------------------- |
| [ponytail](ponytail/SKILL.md)               | Smallest complete implementation; default `full` mode   |
| [ponytail-review](ponytail-review/SKILL.md) | Review a change and its connected code                  |
| [ponytail-audit](ponytail-audit/SKILL.md)   | Audit the requested repository scope                    |
| [ponytail-debt](ponytail-debt/SKILL.md)     | Report documented shortcuts                             |
| [ponytail-gain](ponytail-gain/SKILL.md)     | Display upstream benchmark results, not project savings |
| [ponytail-help](ponytail-help/SKILL.md)     | Explain the upstream skills and modes                   |

Source: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), pinned
to commit `09c434ab73ca43761c5d8b0c5d341926c2fba710`.
License: [MIT](PONYTAIL-LICENSE). The main Ponytail skill includes a local rule
against redundant UI copy and the repository's imperative commit-title convention;
the other five skill files are unchanged upstream copies.

This is the instruction-only installation. Plugin lifecycle hooks, persistent mode
configuration, a dashboard and host-specific slash commands are not installed.
Request a skill by its name; do not assume plugin commands/configuration described
in the upstream help are available in this setup.

To update, review a new upstream revision, replace the six skill directories and
license together, and update the pinned commit here. Preserve the local UI-copy and commit-style rules
in `ponytail/SKILL.md` when updating. Keep other local project rules in
`AGENTS.md` rather than editing upstream skills. The gain skill's benchmark source
is in the upstream repository at the pinned revision; it is not a local benchmark.
