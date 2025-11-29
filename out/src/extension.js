"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const OUTPUT_CHANNEL_NAME = 'Mass Breakpoint';
const STORED_BREAKPOINTS_KEY = 'massBreakpoint.addedBreakpoints';
function makeKey(uri, line, char) {
    return `${uri.toString()}:${line}:${char}`;
}
function activate(context) {
    let output = undefined;
    // Helper: create the output channel lazily when logging is enabled
    function ensureOutputChannel() {
        const enabled = vscode.workspace.getConfiguration('massBreakpoint').get('enableLogging', false);
        if (!enabled)
            return;
        if (!output) {
            output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
            context.subscriptions.push(output);
        }
    }
    // Helper to write to the output channel only when logging is enabled
    function log(message) {
        const enabled = vscode.workspace.getConfiguration('massBreakpoint').get('enableLogging', false);
        if (!enabled)
            return;
        ensureOutputChannel();
        output === null || output === void 0 ? void 0 : output.appendLine(message);
    }
    // Listen for config changes to toggle output channel lifecycle
    const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('massBreakpoint.enableLogging')) {
            const enabled = vscode.workspace.getConfiguration('massBreakpoint').get('enableLogging', false);
            if (!enabled && output) {
                output.dispose();
                // remove from subscriptions if present, but context.subscriptions doesn't support remove — it's ok to leave disposed instance
                output = undefined;
            }
            else if (enabled && !output) {
                ensureOutputChannel();
            }
        }
    });
    context.subscriptions.push(configWatcher);
    log('Mass Breakpoint extension activated.');
    const setCommand = vscode.commands.registerCommand('mass-breakpoint.setBreakpointsForReferences', () => __awaiter(this, void 0, void 0, function* () {
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
        const references = (yield vscode.commands.executeCommand('vscode.executeReferenceProvider', uri, position));
        if (!references || references.length === 0) {
            vscode.window.showInformationMessage('No references found for symbol at cursor.');
            log('No references returned by the provider.');
            return;
        }
        // Log all reference locations
        log(`Found ${references.length} references:`);
        const uniqueMap = new Map();
        for (const loc of references) {
            const key = makeKey(loc.uri, loc.range.start.line, loc.range.start.character);
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, loc);
                log(` - ${loc.uri.fsPath} ${loc.range.start.line + 1}:${loc.range.start.character + 1}`);
            }
        }
        const uniqueLocations = Array.from(uniqueMap.values());
        // Make breakpoints
        const toAdd = [];
        const stored = context.workspaceState.get(STORED_BREAKPOINTS_KEY, []);
        for (const loc of uniqueLocations) {
            const bp = new vscode.SourceBreakpoint(new vscode.Location(loc.uri, loc.range.start));
            toAdd.push(bp);
            stored.push(makeKey(loc.uri, loc.range.start.line, loc.range.start.character));
        }
        // Optionally prevent adding too many breakpoints at once
        const maxBreakpoints = vscode.workspace.getConfiguration('massBreakpoint').get('maxBreakpoints', 1000);
        if (toAdd.length > maxBreakpoints) {
            vscode.window.showWarningMessage(`Refusing to add ${toAdd.length} breakpoints — exceeds limit of ${maxBreakpoints}.`);
            log(`Aborted: would add ${toAdd.length} breakpoints; limit is ${maxBreakpoints}.`);
            return;
        }
        vscode.debug.addBreakpoints(toAdd);
        yield context.workspaceState.update(STORED_BREAKPOINTS_KEY, stored);
        vscode.window.showInformationMessage(`Added ${toAdd.length} breakpoints from References.`);
        log(`Added ${toAdd.length} breakpoints.`);
    }));
    const clearCommand = vscode.commands.registerCommand('mass-breakpoint.clearBreakpointsFromReferences', () => __awaiter(this, void 0, void 0, function* () {
        log('clearBreakpointsFromReferences: triggered');
        const stored = context.workspaceState.get(STORED_BREAKPOINTS_KEY, []);
        if (!stored || stored.length === 0) {
            vscode.window.showInformationMessage('No stored breakpoints to clear.');
            log('No stored breakpoint keys in workspace state.');
            return;
        }
        // Collect breakpoints to remove
        const toRemove = [];
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
        yield context.workspaceState.update(STORED_BREAKPOINTS_KEY, []);
        vscode.window.showInformationMessage(`Removed ${toRemove.length} breakpoints added from References.`);
        log(`Removed ${toRemove.length} breakpoints.`);
    }));
    context.subscriptions.push(setCommand, clearCommand);
}
exports.activate = activate;
function deactivate() {
    // noop
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map