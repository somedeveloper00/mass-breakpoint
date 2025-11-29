import * as vscode from 'vscode';

const OUTPUT_CHANNEL_NAME = 'Mass Breakpoint';
const STORED_BREAKPOINTS_KEY = 'massBreakpoint.addedBreakpoints';

function makeKey(uri: vscode.Uri, line: number, char: number) {
    return `${uri.toString()}:${line}:${char}`;
}

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    context.subscriptions.push(output);

    // Helper to write to the output channel only when logging is enabled
    function log(message: string) {
        const enabled = vscode.workspace.getConfiguration('massBreakpoint').get<boolean>('enableLogging', true);
        if (enabled) {
            output.appendLine(message);
        }
    }

    log('Mass Breakpoint extension activated.');

    const setCommand = vscode.commands.registerCommand('mass-breakpoint.setBreakpointsForReferences', async () => {
        log('setBreakpointsForReferences: triggered');

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Open a file and place the cursor on a symbol to gather references.');
            log('No active editor.');
            return;
        }

        const position = editor.selection.active;
        const uri = editor.document.uri;
        log(`Requesting references for ${uri.toString()}@${position.line}:${position.character}`);

        const references = (await vscode.commands.executeCommand('vscode.executeReferenceProvider', uri, position)) as vscode.Location[] | undefined;
        if (!references || references.length === 0) {
            vscode.window.showInformationMessage('No references found for symbol at cursor.');
            log('No references returned by the provider.');
            return;
        }

        // Log all reference locations
        log(`Found ${references.length} references:`);
        const uniqueMap = new Map<string, vscode.Location>();
        for (const loc of references) {
            const key = makeKey(loc.uri, loc.range.start.line, loc.range.start.character);
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, loc);
                log(` - ${loc.uri.fsPath} ${loc.range.start.line + 1}:${loc.range.start.character + 1}`);
            }
        }

        const uniqueLocations = Array.from(uniqueMap.values());
        // Make breakpoints
        const toAdd: vscode.SourceBreakpoint[] = [];
        const stored = context.workspaceState.get<string[]>(STORED_BREAKPOINTS_KEY, []);

        for (const loc of uniqueLocations) {
            const bp = new vscode.SourceBreakpoint(new vscode.Location(loc.uri, loc.range.start));
            toAdd.push(bp);
            stored.push(makeKey(loc.uri, loc.range.start.line, loc.range.start.character));
        }

        // Optionally prevent adding too many breakpoints at once
        const maxBreakpoints = vscode.workspace.getConfiguration('massBreakpoint').get<number>('maxBreakpoints', 1000);
        if (toAdd.length > maxBreakpoints) {
            vscode.window.showWarningMessage(`Refusing to add ${toAdd.length} breakpoints — exceeds limit of ${maxBreakpoints}.`);
            log(`Aborted: would add ${toAdd.length} breakpoints; limit is ${maxBreakpoints}.`);
            return;
        }

        vscode.debug.addBreakpoints(toAdd);
        await context.workspaceState.update(STORED_BREAKPOINTS_KEY, stored);
        vscode.window.showInformationMessage(`Added ${toAdd.length} breakpoints from References.`);
        log(`Added ${toAdd.length} breakpoints.`);
    });

    const clearCommand = vscode.commands.registerCommand('mass-breakpoint.clearBreakpointsFromReferences', async () => {
        log('clearBreakpointsFromReferences: triggered');
        const stored = context.workspaceState.get<string[]>(STORED_BREAKPOINTS_KEY, []);
        if (!stored || stored.length === 0) {
            vscode.window.showInformationMessage('No stored breakpoints to clear.');
            log('No stored breakpoint keys in workspace state.');
            return;
        }

        // Collect breakpoints to remove
        const toRemove: vscode.Breakpoint[] = [];
        for (const bp of vscode.debug.breakpoints) {
            if (bp instanceof vscode.SourceBreakpoint) {
                const uri = bp.location.uri;
                const start = bp.location.range.start;
                const key = makeKey(uri, start.line, start.character);
                if (stored.includes(key)) {
                    toRemove.push(bp);
                    log(` - Will remove ${uri.fsPath}:${start.line + 1}:${start.character + 1}`);
                }
            }
        }

        if (toRemove.length === 0) {
            vscode.window.showInformationMessage('No breakpoints matched the stored Reference breakpoints.');
            log('No matching breakpoints found to remove.');
            return;
        }

        vscode.debug.removeBreakpoints(toRemove);
        await context.workspaceState.update(STORED_BREAKPOINTS_KEY, []);
        vscode.window.showInformationMessage(`Removed ${toRemove.length} breakpoints added from References.`);
        log(`Removed ${toRemove.length} breakpoints.`);
    });

    context.subscriptions.push(setCommand, clearCommand);
}

export function deactivate() {
    // noop
}
