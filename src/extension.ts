'use strict';
import * as vscode from 'vscode';
import { QueryConsole } from './query-runner';

export function activate(context: vscode.ExtensionContext) {

    console.log('Congratulations, your extension "query-console" is now active!');

    let queryConsole = new QueryConsole();

    let run = vscode.commands.registerCommand('query-console.run', () => {
        queryConsole.run();
    });

    let stop = vscode.commands.registerCommand('query-console.stop', () => {
        queryConsole.stop();
    });

    context.subscriptions.push(run);
    context.subscriptions.push(stop);
}

export function deactivate() {
}