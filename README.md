# Workspace Namer for GNOME

A lightweight, native GNOME Shell extension that lets you name your workspaces directly from the top bar.

This is especially nice for task-oriented workspaces

## Features

* **Zero Dependencies:** Written in pure JavaScript (GJS) using native GNOME libraries
* **Native UI:** Uses the standard GNOME 45+ `ModalDialog` for a seamless look and feel
* **Persistent:** Workspace names are saved to the system's `org.gnome.desktop.wm.preferences workspace-names` schema, meaning they persist after reboots and work with other tools
* **GNOME 45/46+ Support:** Updated to use modern `add_child()` APIs

## Requirements

* **GNOME Shell 45 or newer** (Ubuntu 24.04+, Fedora 39+, Arch, etc.)

## Installation

For the best results on GNOME 45/46+, follow these steps to ensure the extension is registered correctly by the shell.

### Clone into the Extensions directory

Open your terminal and run the following command to clone the repository directly into your local GNOME extensions folder:

```bash
git clone https://github.com/spacebarlabs/gnome-extension-workspace-namer.git \
  ~/.local/share/gnome-shell/extensions/workspace-namer@spacebarlabs.com
```

### Restart your Session

GNOME Shell only scans for new extension folders during startup.

* Save your work and Log Out
* Log back in

### Activate via Terminal

Once you have logged back in, you can activate the extension immediately using the GNOME extensions CLI (or **Extensions** app if you prefer:

```bash
gnome-extensions enable workspace-namer@spacebarlabs.com
```

## Usage

1. Look at the top bar (top-left by default). You will see **"Workspace 1"**
2. Click the name
3. A dialog box will pop up
4. Type a new name (e.g., "Code", "Music", "Browsing") and save
5. The name updates immediately and stays saved

## Development

### Running Tests

This extension includes automated tests that run in CI via GitHub Actions. To run tests locally:

```bash
# Install development dependencies
npm install

# Run all tests (validation + linting)
npm test

# Run only validation tests
npm run validate

# Run only linting
npm run lint
```

### CI/CD

All tests automatically run on every push and pull request via GitHub Actions. The CI workflow:
- Validates `metadata.json` format and required fields
- Checks that `extension.js` has proper structure
- Runs ESLint to ensure code quality

You can view the CI status and logs in the [Actions tab](https://github.com/spacebarlabs/gnome-extension-workspace-namer/actions).
