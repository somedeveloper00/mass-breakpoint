# Mass Breakpoint — Copilot Instructions

This repo contains a small VS Code extension that sets breakpoints on all usages (references) of a symbol. The top-level entry is `src/extension.ts` with the two user-facing commands listed in `package.json`.

Key files
- `src/extension.ts`: Main extension activation and command implementations. Uses `vscode.commands.executeCommand('vscode.executeReferenceProvider', ...)` to collect references and `vscode.debug.addBreakpoints` for creating breakpoints.
- `package.json`: Defines commands, activation events, menu entries and contributes a setting `massBreakpoint.maxBreakpoints`.
- `README.md`: Quick usage and developer instructions.
- `examples/` and `src/examples/`: Example files used to test the extension in the development host.

Big-picture architecture
- Single-node extension: activation events are `onCommand:mass-breakpoint.*`; no long-running background services.
- The extension programmatically queries the reference providers. It does not intercept or directly manipulate the built-in References UI; it only uses the provider results and contributes commands to menus. The breakpoints are added using the Debug API.
- Breakpoints created by the extension are tracked by storing a list of location keys (URI:line:char) in `context.workspaceState` so they can be cleaned up later.

Notable patterns and rules
- Querying references: use `vscode.commands.executeCommand('vscode.executeReferenceProvider', uri, position)` to obtain `Location[]` results for the symbol at the cursor.
- De-duplication: deduplicate reference results by `uri + line + char`.
- Limits: If a reference set is very large, the command refuses to add breakpoints beyond the configured limit at `massBreakpoint.maxBreakpoints` (default 250).
- Breakpoint storage: all breakpoints added are tracked in `context.workspaceState` under key `massBreakpoint.addedBreakpoints`.
- Removal: to clear breakpoints, compare current `vscode.debug.breakpoints` to the stored keys and use `vscode.debug.removeBreakpoints`.

Developer workflows
- Build:
  - `npm install`
  - `npm run compile` or use the `npm: compile` task in `.vscode/tasks.json`.
- Run the extension:
  - Press `F5` in VS Code to start an Extension Development Host.
  - Open `examples/example.ts`, place the cursor on an identifier, and run the `Mass Breakpoint: Set breakpoints for all References` command.
  - Check the `Mass Breakpoint` output channel to confirm collected references and added breakpoints.
- Debugging the extension: Use the `Run` panel with the default debug configuration in `.vscode/launch.json`.

Integration and constraints
- This extension relies on language services (reference providers) to return correct and complete references. If the language server does not implement references or is slow, fewer or no results may be returned.
- The command works from the command palette and editor context menu. We also attempt to expose the action when the References UI is visible with the `referenceSearchVisible` context key. If that key is not present for your VS Code version or language, the command remains available via the Command Palette.

Project-specific conventions
- Keep functionality in `src/extension.ts` for this small project.
- Use an `OutputChannel` named `Mass Breakpoint` for logging and debugging (useful in Extension Host runs).
- Store extension-added state in `context.workspaceState` and keep keys lightweight (`uri:line:char`).

Potential improvements & tips for copilot agents
- For reliability, consider adding a manual confirmation dialog listing the top N grouped file results before adding breakpoints in cases where many references exist.
- Limit breakpoints per file or restrict to project-root files if you want to avoid setting breakpoints into node_modules/external libs.
- Add a quick UI to toggle `massBreakpoint.maxBreakpoints` or to display preview results in a quick pick before creating breakpoints.

When editing files
- When modifying the command behavior, update `README.md` and the `Mass Breakpoint` output messages to reflect new actions.
- Preserve `workspaceState` key for backwards compatibility; if you update storage format, migrate existing keys.
