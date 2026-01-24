import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// --- Custom Rename Dialog ---
const RenameDialog = GObject.registerClass(
    { GTypeName: 'WorkspaceNamerDialog' },
    class RenameDialog extends ModalDialog.ModalDialog {
        _init(currentName, callback) {
            super._init();
            this._callback = callback;

            let contentBox = new St.BoxLayout({
                vertical: true,
                style: 'spacing: 12px; padding: 10px;'
            });

            let label = new St.Label({
                text: 'Rename Workspace',
                style: 'font-weight: bold; text-align: center;'
            });

            contentBox.add_child(label);

            this._entry = new St.Entry({
                text: currentName,
                can_focus: true,
                style: 'width: 250px;'
            });

            this._entry.clutter_text.connect('activate', () => this._onSave());

            contentBox.add_child(this._entry);

            this.contentLayout.add_child(contentBox);

            this.addButton({
                label: 'Cancel',
                action: () => this.close(),
                key: Clutter.KEY_Escape
            });

            this.addButton({
                label: 'Save',
                action: () => this._onSave(),
                default: true
            });

            this.connect('opened', () => {
                this._entry.grab_key_focus();
            });
        }

        _onSave() {
            let newName = this._entry.get_text();
            if (this._callback) this._callback(newName);
            this.close();
        }
    }
);

// --- Main Extension ---
export default class WorkspaceNamer extends Extension {
    enable() {
        this._settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });

        this._button = new PanelMenu.Button(0.0, 'WorkspaceNamer', false);

        this._label = new St.Label({
            text: 'Loading...',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding: 0 8px;'
        });

        this._button.add_child(this._label);
        Main.panel.addToStatusArea('workspace-namer', this._button, 0, 'left');

        this._button.connect('button-press-event', () => {
            this._openNativeDialog();
            return Clutter.EVENT_STOP;
        });

        this._label.reactive = true;
        this._label.connect('button-press-event', () => {
            this._openNativeDialog();
            return Clutter.EVENT_STOP;
        });

        this._wsSignal = global.workspace_manager.connect('active-workspace-changed', () => this._updateLabel());
        this._settingsSignal = this._settings.connect('changed::workspace-names', () => this._updateLabel());

        this._updateLabel();
    }

    disable() {
        if (this._wsSignal) {
            global.workspace_manager.disconnect(this._wsSignal);
            this._wsSignal = null;
        }
        if (this._settingsSignal) {
            this._settings.disconnect(this._settingsSignal);
            this._settingsSignal = null;
        }
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
        this._settings = null;
    }

    _updateLabel() {
        try {
            let activeIndex = global.workspace_manager.get_active_workspace_index();
            let names = this._settings.get_strv('workspace-names');
            let currentName = names[activeIndex] || `Workspace ${activeIndex + 1}`;
            if (this._label) this._label.set_text(currentName);
        } catch (e) {
            console.error(e);
        }
    }

    _openNativeDialog() {
        try {
            let activeIndex = global.workspace_manager.get_active_workspace_index();
            let names = this._settings.get_strv('workspace-names');
            let currentName = names[activeIndex] || `Workspace ${activeIndex + 1}`;

            let dialog = new RenameDialog(currentName, (newName) => {
                if (newName && newName.trim() !== "") {
                    this._saveName(newName.trim());
                }
            });
            dialog.open();
        } catch (e) {
            console.error("WS Namer Error opening dialog:", e);
        }
    }

    _saveName(newName) {
        let activeIndex = global.workspace_manager.get_active_workspace_index();
        let names = this._settings.get_strv('workspace-names');
        while (names.length <= activeIndex) names.push("");
        names[activeIndex] = newName;
        this._settings.set_strv('workspace-names', names);
        this._updateLabel();
    }
}
