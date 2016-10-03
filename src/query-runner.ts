'use strict';
import * as vscode from 'vscode';
import {
    join,
    dirname
} from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as http from 'http';
//import * as https from 'https';
import * as querystring from 'querystring';

const TmpDir = os.tmpdir();

export class QueryConsole {
    private _outputChannel: vscode.OutputChannel;
    private _isRunning: boolean;
    private _process;
    private _codeFile: string;
    private _isTmpFile: boolean;
    private _languageId: string;
    private _cwd: string;
    private _config: vscode.WorkspaceConfiguration;

    constructor() {
        this._outputChannel = vscode.window.createOutputChannel('Output');
    }

    public run(languageId: string = null): void {
        if (this._isRunning) {
            vscode.window.showInformationMessage('Query is already running!');
            return;
        }

        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No code found or selected.');
            return;
        }

        this.initialize(editor);
        this.getCodeFileAndExecute(editor);
    }

    public stop(): void {
        if (this._isRunning) {
            this._isRunning = false;
            let kill = require('tree-kill');
            kill(this._process.pid);
        }
    }

    private initialize(editor: vscode.TextEditor): void {
        this._config = vscode.workspace.getConfiguration('query-console');
        this._cwd = this._config.get<string>('cwd');
        if (this._cwd) {
            return;
        }
        if (this._config.get<boolean>('fileDirectoryAsCwd') && !editor.document.isUntitled) {
            this._cwd = dirname(editor.document.fileName);
        } else {
            this._cwd = vscode.workspace.rootPath;
        }
        if (this._cwd) {
            return;
        }
        this._cwd = TmpDir;
    }

    private getCodeFileAndExecute(editor: vscode.TextEditor): any {
        let fileExtension = this.getFileExtension(editor);
        let selection = editor.selection;

        if (selection.isEmpty && !editor.document.isUntitled) {
            this._codeFile = editor.document.fileName;

            if (this._config.get<boolean>('saveFileBeforeRun')) {
                return editor.document.save().then(() => {
                    this.executeMLQuery(editor.document.getText(), fileExtension);
                });
            }
            this.executeMLQuery(editor.document.getText(), fileExtension);
        } else {
            let text = selection.isEmpty ? editor.document.getText() : editor.document.getText(selection);
            vscode.window.showErrorMessage('Save file before executing.');
            //this.executeMLQuery(text, fileExtension);
        }
    }



    private getFileExtension(editor: vscode.TextEditor): string {
        let fileName = editor.document.fileName;
        let index = fileName.lastIndexOf(".");
        if (index !== -1) {
            return fileName.substr(index);
        } else {
            return "";
        }
    }

    private executeMLQuery(code: string, fileExtension: string) {
        this._isRunning = true;
        let clearPreviousOutput = this._config.get<boolean>('clearPreviousOutput');
        if (clearPreviousOutput) {
            this._outputChannel.clear();
        }
        this._outputChannel.show();

        var postData;
        if (!/(\.xqy|xq|sjs|js)/.test(fileExtension)) {
            return vscode.window.showInformationMessage('works only with .xqy | .xq | .sjs | .js');
        }
        if (fileExtension === '.xqy' || fileExtension === '.xq') {
            postData = querystring.stringify({
                'xquery': code
            });
        }
        if (fileExtension === '.sjs' || fileExtension === '.js') {
            postData = querystring.stringify({
                'javascript': code
            });
        }
        let protocol = this._config.get<string>('protocol') ? this._config.get<string>('protocol') + ':' : 'http:';
        let hostname = this._config.get<string>('MarkLogicHost');
        let port = this._config.get<string>('MarkLogicPort')
        let endpoint = this._config.get<string>('MarkLogicEvalEndpoint')
        let username = this._config.get<string>('username')
        let password = this._config.get<string>('password')
        let auth = username + ':' + password;

        var options = {
          //  protocol: protocol,
            method: "POST",
            hostname: hostname,
            port: port,
            path: endpoint + '?database=' + this._config.get<string>('defaultDatabase') ,
            auth: auth,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'multipart/mixed; boundary=BOUNDARY',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const callback = (res) => {
            var chunks = [];

            res.on("data", (chunk) => {
                chunks.push(chunk);
                vscode.window.setStatusBarMessage('RUNNING...')
            });
            res.on("end", () => {
                vscode.window.setStatusBarMessage('DONE')
                var body = Buffer.concat(chunks);
                this._isRunning = false;
                if (res.statusCode === 200) {
                    this._outputChannel.appendLine(body.toString())
                } else if(res.statusCode === 401) {
                    this._outputChannel.appendLine('[AUTH ERROR]: Authenticaion Failed. Check credentials and check authentication is not Digest')
                } else {
                    this._outputChannel.appendLine('[ERROR]: ' + JSON.parse(body.toString()).errorResponse.message)
                }

                this._outputChannel.appendLine('');
            });
        }
        var req = http.request(options, callback);

        req.on('error', (e) => {
            //this._outputChannel.appendLine('problem with request')
            this._outputChannel.appendLine(e)
        });

        req.write(postData);
        req.end();
    }
}