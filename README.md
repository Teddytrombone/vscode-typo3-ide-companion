# TYPO3 ide companion

The TYPO3 extension ide_companion supports your TYPO3 development with various LSP based features for Fluid, TypoScript and other things.

This project handles establishing a connection from your VS Code Workspace to your TYPO3 ide_companion installation.

## Requirements

You need to have ide_companion installed in your TYPO3 installation. Ensure that you can run TYPO3 console commands and that the console command `idecompanion:lsp` is available.

Your workspace needs to point to the TYPO3 installation or an subdirectory of your installation. If autodetection of the root of your installation does not work, you need to set an absolute executablePath for your Workspace (see "Extension Settings").

## Extension Settings

Every setting is optional.

- `vscode-typo3-ide-companion.enable`: Enable/disable this extension.
- `vscode-typo3-ide-companion.executablePath`: The VS Code extension tries to autodetect the TYPO3 console command binary. If this doesn't work or if you want to provide an different executable like a bash script which for example connects to a docker container, this could be configured via this setting. Defaults to autodetection if empty.
- `vscode-typo3-ide-companion.phpPath`: If the TYPO3 console command binary is used (either with autodetection or manually configured path to the binary) but a different php version needs to be used than the system default, you can set the path to the specific php binary. Defaults to setting of VS Code php settings. If empty the systems php command is used.
- `vscode-typo3-ide-companion.config`: Override the settings of ide_companion if needed. Valid configuration values can be found in ide_comanion`s settings file.
- `vscode-typo3-ide-companion.launchServerArgs`: Array of additional arguments passed to the binary.

Available but not implemented yet in ide_companion:

- `vscode-typo3-ide-companion.remote.enabled`: Connect to language server via socket instead stdio
- `vscode-typo3-ide-companion.remote.host`: Host that language server is running
- `vscode-typo3-ide-companion.remote.port`: Port that language server is running
