---
name: reuse-and-organize
description: Use whenever building or modifying code, especially UI elements, components, helpers, or utilities. Enforces reuse of existing code before creating anything new, and keeps the codebase cleanly organized.
---

# Reuse and Organize

## Step 1: Discover before building (mandatory)
Before writing any new component, element, function, style, or utility:
1. Search the codebase for existing equivalents (grep for names, similar markup, similar logic).
2. Check the usual locations: `components/`, `ui/`, `utils/`, `helpers/`, `hooks/`, `lib/`, `styles/`, shared constants.
3. List what you found in one short block:
   - **Reusing:** existing items that fit as-is
   - **Extending:** existing items that need a small, backward-compatible change
   - **Creating:** only what truly does not exist, with a one-line reason

Never create a new element if an existing one can do the job with props, variants, or a minor extension.

## Step 2: Reuse rules
- Prefer, in order: use as-is, then configure via props/options, then extend, then create new.
- Do not copy-paste an existing element and tweak it. Extend or parametrize the original instead.
- If the same logic or markup appears 3 or more times, extract it into a shared piece and replace the duplicates only within the files already in scope.
- Reuse existing design tokens (colors, spacing, fonts, constants). Do not hardcode new values that already exist.
- Do not add a new dependency if the project already has something that does the job.

## Step 3: Organization rules
- Follow the project's existing folder structure and naming conventions. Do not invent a new one.
- One responsibility per file and per function. Keep functions short and single-purpose.
- New reusable pieces go in the shared location (e.g. `components/` or `utils/`), not inside a page or feature file.
- Keep naming consistent with neighbours (casing, prefixes, file naming).
- No dead code, no commented-out blocks, no unused imports or variables introduced by your change.
- Keep imports grouped and ordered the way the rest of the project does it.

## Step 4: Stay in scope
- Only change what the task requires. No unrelated refactors, renames, or reformatting.
- If you notice duplication or messy code outside the task, do not fix it. Report it under Observations.
- Ask before deleting or renaming any file.

## Step 5: Final report (always)
Run `git diff` and report:

### Reused
- Existing elements/functions used, with file paths

### Added
- New files/functions/elements, with the reason nothing existing could be reused

### Modified
- file:function, what changed and why

### Removed
- What was deleted and why

### Observations
- Duplicates or problems found but intentionally not touched

### How to verify
- Exact steps to test, and anything you could not test