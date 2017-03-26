/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind
} from 'vscode-languageserver';

import * as child_process from 'child_process';

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites.
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: false
			}
		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	validateTextDocument(change.document);
});

// hold the maxNumberOfProblems setting
let validatorLocation = "";

// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	let settings = change.settings;
	validatorLocation = settings.implicit.lintLocation || ""
	documents.all().forEach(validateTextDocument);
});

function validateTextDocument(textDocument: TextDocument): void {

	let child: child_process.ChildProcess = null;
	try {
		child = child_process.spawn(validatorLocation);
	} catch (e) {
		connection.window.showErrorMessage(`could not spawn child ${validatorLocation}`);
		return;
	}

	let buff = "";

	child.stdout.on('data', function (data) {
		buff += data.toString();
	});

	child.stdin.end(textDocument.getText());

	child.on('close', () => {
		connection.sendDiagnostics({
			uri: textDocument.uri,
			diagnostics: JSON.parse(buff)
		})
	})
}

// Listen on the connection
connection.listen();
