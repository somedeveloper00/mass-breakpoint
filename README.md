# Mass Breakpoint

Small VS Code extension to add/remove breakpoints for all reference results of the symbol under the cursor. Useful when you want to debug all call sites or usages.

Commands
- `Mass Breakpoint: Set breakpoints for all References` — collects references for the symbol at the cursor, logs all locations to the "Mass Breakpoint" output channel, and sets breakpoints at each unique location (line start).
- `Mass Breakpoint: Clear breakpoints created from References` — removes all breakpoints that were added by the extension and stored in the workspace state.

Notes and Implementation Details
- The extension uses `vscode.executeReferenceProvider` to collect references.
- It stores added breakpoints specific to this extension in the workspace state (`massBreakpoint.addedBreakpoints`).
- To avoid accidentally adding many breakpoints, a limit is configurable via `massBreakpoint.maxBreakpoints` — default 250.
- The extension logs to an output channel named `Mass Breakpoint` with an initial 'activated' message.
- The extension logs to an output channel named `Mass Breakpoint` with an initial 'activated' message. Logging can be enabled via the `massBreakpoint.enableLogging` setting (default: false). When disabled the output channel is not created.
- The extension attempts to contribute a menu entry to the References view, but not all built-in views expose consistent context keys across versions — the commands always work from the command palette and editor context menu.

Usage
1. Open a source file and place the cursor on a symbol or identifier.
2. Run `Mass Breakpoint: Set breakpoints for all References` from the command palette or the editor context menu.
3. Confirm the output panel to see the gathered references and how many breakpoints were added.
4. Run `Mass Breakpoint: Clear breakpoints created from References` to remove them.

Developer / Example
- Open this repository in VS Code and press F5 to run the Extension Host.
- Open `examples/example.ts` in the Extension Host.
- Place the cursor on `greet` and use the command to add breakpoints for all usages.
- Use the `Mass Breakpoint` output channel to see the logged references and breakpoints being added.


Testing and Debugging
- Run `npm install` then `npm run compile` to build.
- Use `Run -> Start Debugging (F5)` in VS Code to run the extension in a new Extension Development Host; then open a workspace with TypeScript/JavaScript code and try the command.
