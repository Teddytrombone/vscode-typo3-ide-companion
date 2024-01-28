import { LanguageClient, ServerOptions, LanguageClientOptions, StreamInfo } from 'vscode-languageclient';

import * as vscode from 'vscode';
import * as path from 'path';
import * as net from 'net';
import * as fs from 'fs';
import { ChildProcess, spawn } from "child_process";

let languageClient: LanguageClient;
let languageServerProcess: ChildProcess;

interface IdeCompanionConfig {
	executablePath: string
	phpPath: string
	enable: boolean
	config: object
	remote: {
		enabled: boolean
		host: string
		port: number
	}
	launchServerArgs: string[]
}

const defaultBinaryPaths = [
	'bin/typo3',
	'typo3/sysext/core/bin/typo3'
];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	if (!checkPlatform()) {
		return;
	}

	const workspaceConfig = vscode.workspace.getConfiguration();
	const config = workspaceConfig.get<IdeCompanionConfig>('vscode-typo3-ide-companion') || <IdeCompanionConfig>{};
	const enable = config.enable;

	const typo3RootPath = findTypo3Root();

	if (!typo3RootPath) {
		if (config.executablePath && !path.isAbsolute(config.executablePath)) {
			console.log('TYPO3 root path not found - IDE companion not starting');
			return;
		}
	}

	if (!config.launchServerArgs) {
		config.launchServerArgs = [];
	}

	if (!config.executablePath && typo3RootPath) {
		const useTypo3Console = defaultBinaryPaths.some(currentBinaryPath => {
			const binaryPath = path.join(typo3RootPath, currentBinaryPath);
			if (fs.existsSync(binaryPath)) {
				config.executablePath = binaryPath;
				return true;
			}
			return false;
		});
		if (useTypo3Console) {
			config.launchServerArgs.unshift('idecompanion:lsp');
		}
	}

	if (!config.executablePath) {
		console.log('The executable is not found - IDE companion not starting');
		return;
	}

	if (!config.phpPath) {
		const phpConfig = vscode.workspace.getConfiguration('php');
		config.phpPath =
			phpConfig.get<string>('executablePath') ||
			phpConfig.get<string>('validate.executablePath') ||
			(process.platform === 'win32' ? 'php.exe' : 'php');
	}

	// If our executable is the TYPO3 console command we should use the php binary
	// If not, the executable has to be executable
	if (!config.executablePath.endsWith('bin/typo3')) {
		config.phpPath = '';
	}

	if (config.phpPath) {
		config.launchServerArgs.unshift(config.executablePath);
		config.executablePath = config.phpPath;
	}

	if (enable === false) {
		return;
	}

	context.subscriptions.push(vscode.commands.registerCommand('vscode-typo3-ide-companion.reindex', reindex));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-typo3-ide-companion.restartServer', async () => {
		await killServer();
		languageClient = createClient(config, context);
		languageClient.start();
	}));

	languageClient = createClient(config, context);
	languageClient.start();
}

function getServerOptions(config: IdeCompanionConfig): ServerOptions {
	if (!config.remote?.enabled) {
		// launch language server via stdio
		return async (): Promise<ChildProcess> => {
			languageServerProcess = spawn(config.executablePath, config.launchServerArgs, {
				env: {
					...process.env,
					TYPO3_CONTEXT: 'Development'
				}
			});
			return languageServerProcess;
		};
	} else {
		// credits: https://github.com/itemis/xtext-languageserver-example/blob/master/vscode-extension/src/extension.ts
		// launch language server via socket
		return () => {
			const { host, port } = config.remote;
			const socket = net.connect({
				host,
				port,
			});

			const result = <StreamInfo>{
				writer: socket,
				reader: socket,
			};

			return Promise.resolve(result);
		};
	}
}

function createClient(config: IdeCompanionConfig, context: vscode.ExtensionContext): LanguageClient {
	const serverOptions = getServerOptions(config);

	const clientOptions: LanguageClientOptions = {
		// We hook on almost any file type and let the language server decide, if it will handle it
		documentSelector: [
			{ scheme: 'file' },
			{ scheme: 'untitled' },
		],
		initializationOptions: config.config,
	};

	languageClient = new LanguageClient('typo3-ide-companion', 'TYPO3 ide companion', serverOptions, clientOptions);

	return languageClient;
}

function reindex(): void {
	if (!checkPlatform() || !languageClient) {
		return;
	}

	void languageClient.sendRequest('indexer/reindex');
}

function findTypo3Root(): string | null {
	let foundRootPath = null;
	vscode.workspace.workspaceFolders?.some(workspaceFolder => {
		foundRootPath = checkForTypo3RootInDirectory(workspaceFolder.uri.fsPath);
	});
	return foundRootPath;
}

function checkForTypo3RootInDirectory(currentPath: string): string | null {
	let foundRootPath = null;
	if (defaultBinaryPaths.some(currentBinaryPath => {
		const binaryPath = path.join(currentPath, currentBinaryPath);
		if (fs.existsSync(binaryPath)) {
			foundRootPath = currentPath;
			return true;
		}
		return false;
	})) {
		return foundRootPath;
	}
	// If current path contains a composer.json, load it and look into web-dir
	let webDir = getWebDirFromComposerJson(currentPath);
	if (webDir !== null) {
		foundRootPath = checkForTypo3RootInDirectory(webDir);
	}
	if (foundRootPath) {
		return foundRootPath;
	}

	// Walk currentPath up because maybe our Workspace only contains a subdirectory

	const parentPath = path.dirname(currentPath);
	if (parentPath !== currentPath) {
		return checkForTypo3RootInDirectory(parentPath);
	}

	return null;
}

function getWebDirFromComposerJson(currentFolder: string): string | null {
	const composerJsonPath = path.join(currentFolder, 'composer.json');

	if (fs.existsSync(composerJsonPath)) {
		try {
			const composerJsonContent = fs.readFileSync(composerJsonPath, 'utf-8');
			const composerJson = JSON.parse(composerJsonContent);

			// Überprüfen Sie, ob "extra" und "web-dir" im composer.json vorhanden sind
			if (composerJson.extra && composerJson.extra['typo3/cms'] && composerJson.extra['typo3/cms']['web-dir']) {
				return composerJson.extra['typo3/cms']['web-dir'];
			}
		} catch (error) {
		}
	}
	return null;
}

function checkPlatform(): boolean {
	if (process.platform === 'win32') {
		void vscode.window.showWarningMessage('TYPO3 ide companion is not supported on Windows at the moment.');
		return false;
	}
	return true;
}

async function killServer(): Promise<void> {
	await languageClient.stop();
	languageServerProcess.kill();
}

export function deactivate(): Thenable<void> | undefined {
	return killServer();
}
