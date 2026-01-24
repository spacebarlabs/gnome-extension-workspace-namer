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

        // Maps workspace stable_sequence -> name
        // stable_sequence is computed from window IDs on the workspace
        this._workspaceNameMap = new Map();
        
        // Track current workspace IDs to detect when they're reordered
        this._workspaceInstances = new Map(); // index -> {stableId, name}
        
        // Load existing names from settings and create initial mappings
        this._initializeWorkspaceMap();

        this._button = new PanelMenu.Button(0.0, 'WorkspaceNamer', false);

        this._label = new St.Label({
            text: 'Loading...',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding: 0 8px;'
        });

        this._button.add_child(this._label);
        
        // Added to 'left' side at index 1 to appear to the right of the workspace switcher
        Main.panel.addToStatusArea('workspace-namer', this._button, 1, 'left');

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
        this._wsAddedSignal = global.workspace_manager.connect('workspace-added', () => this._onWorkspacesChanged());
        this._wsRemovedSignal = global.workspace_manager.connect('workspace-removed', () => this._onWorkspacesChanged());

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
        if (this._wsAddedSignal) {
            global.workspace_manager.disconnect(this._wsAddedSignal);
            this._wsAddedSignal = null;
        }
        if (this._wsRemovedSignal) {
            global.workspace_manager.disconnect(this._wsRemovedSignal);
            this._wsRemovedSignal = null;
        }
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
        this._workspaceNameMap = null;
        this._workspaceInstances = null;
        this._settings = null;
    }

    _updateLabel() {
        try {
            let activeIndex = global.workspace_manager.get_active_workspace_index();
            let workspace = global.workspace_manager.get_workspace_by_index(activeIndex);
            let stableId = this._getWorkspaceStableId(workspace);
            
            // First check if we're tracking this workspace instance at this position
            let instance = this._workspaceInstances.get(activeIndex);
            let currentName = null;
            
            if (instance && instance.name) {
                // We have a name for this workspace position
                currentName = instance.name;
                
                // Update the stable ID if windows changed
                if (instance.stableId !== stableId) {
                    // Windows changed, update our tracking
                    this._workspaceNameMap.delete(instance.stableId);
                    this._workspaceNameMap.set(stableId, currentName);
                    instance.stableId = stableId;
                }
            } else {
                // Try to get name from our window-based map
                currentName = this._workspaceNameMap.get(stableId);
                
                // Fallback to position-based name from settings for backwards compatibility
                if (!currentName) {
                    let names = this._settings.get_strv('workspace-names');
                    currentName = names[activeIndex];
                }
            }
            
            // Final fallback to default name
            if (!currentName) {
                currentName = `Workspace ${activeIndex + 1}`;
            }
            
            if (this._label) this._label.set_text(currentName);
        } catch (e) {
            console.error(e);
        }
    }

    _openNativeDialog() {
        try {
            let activeIndex = global.workspace_manager.get_active_workspace_index();
            let workspace = global.workspace_manager.get_workspace_by_index(activeIndex);
            let stableId = this._getWorkspaceStableId(workspace);
            
            // Check if we're tracking this workspace instance
            let instance = this._workspaceInstances.get(activeIndex);
            let currentName = null;
            
            if (instance && instance.name) {
                currentName = instance.name;
            } else {
                // Try to get name from our window-based map
                currentName = this._workspaceNameMap.get(stableId);
                
                // Fallback to position-based name from settings
                if (!currentName) {
                    let names = this._settings.get_strv('workspace-names');
                    currentName = names[activeIndex];
                }
            }
            
            // Final fallback to default name
            if (!currentName) {
                currentName = `Workspace ${activeIndex + 1}`;
            }

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
        let workspace = global.workspace_manager.get_workspace_by_index(activeIndex);
        let stableId = this._getWorkspaceStableId(workspace);
        
        // Store in our map (window-based tracking)
        this._workspaceNameMap.set(stableId, newName);
        
        // Track this workspace instance
        this._workspaceInstances.set(activeIndex, {
            stableId: stableId,
            name: newName
        });
        
        // Also update position-based settings for backwards compatibility
        let names = this._settings.get_strv('workspace-names');
        while (names.length <= activeIndex) names.push("");
        names[activeIndex] = newName;
        this._settings.set_strv('workspace-names', names);
        
        this._updateLabel();
    }

    /**
     * Get a stable identifier for a workspace based on its windows.
     * This allows us to track workspaces even when their index changes.
     * 
     * @param {Meta.Workspace} workspace - The workspace object
     * @returns {string} A stable identifier based on window IDs
     */
    _getWorkspaceStableId(workspace) {
        try {
            let windows = workspace.list_windows();
            
            // If workspace has no windows, use a special marker with the index
            // This handles empty workspaces that haven't been assigned yet
            if (windows.length === 0) {
                return `empty-ws-${workspace.index()}`;
            }
            
            // Create a stable ID from sorted window IDs
            // This ensures the same set of windows always produces the same ID
            let windowIds = windows
                .map(w => w.get_id())
                .sort((a, b) => a - b);
            
            return `windows-${windowIds.join('-')}`;
        } catch (e) {
            console.error("Error getting workspace stable ID:", e);
            return `fallback-${workspace.index()}`;
        }
    }

    /**
     * Initialize workspace name mappings from existing settings.
     * This provides backwards compatibility with position-based names.
     */
    _initializeWorkspaceMap() {
        try {
            let names = this._settings.get_strv('workspace-names');
            let numWorkspaces = global.workspace_manager.get_n_workspaces();
            
            for (let i = 0; i < numWorkspaces && i < names.length; i++) {
                if (names[i] && names[i].trim() !== "") {
                    let workspace = global.workspace_manager.get_workspace_by_index(i);
                    if (workspace) {
                        let stableId = this._getWorkspaceStableId(workspace);
                        this._workspaceNameMap.set(stableId, names[i]);
                        this._workspaceInstances.set(i, {
                            stableId: stableId,
                            name: names[i]
                        });
                    }
                }
            }
        } catch (e) {
            console.error("Error initializing workspace map:", e);
        }
    }

    /**
     * Handle workspace additions and removals.
     * This updates our mappings to ensure names follow their windows.
     */
    _onWorkspacesChanged() {
        try {
            let numWorkspaces = global.workspace_manager.get_n_workspaces();
            let names = [];
            let newInstances = new Map();
            
            // Build a map of current stable IDs to find matches
            let currentWorkspaces = [];
            for (let i = 0; i < numWorkspaces; i++) {
                let workspace = global.workspace_manager.get_workspace_by_index(i);
                let stableId = this._getWorkspaceStableId(workspace);
                currentWorkspaces.push({ index: i, stableId: stableId, workspace: workspace });
            }
            
            // Try to match current workspaces with previous instances
            for (let curr of currentWorkspaces) {
                let name = "";
                let matchedInstance = null;
                
                // First, try to find by stable ID (same windows)
                name = this._workspaceNameMap.get(curr.stableId);
                
                // If we found a match by windows, use that name
                if (name) {
                    newInstances.set(curr.index, {
                        stableId: curr.stableId,
                        name: name
                    });
                } else {
                    // Check if any previous instance might have moved here
                    // Look through previous instances to see if we can match by window overlap
                    for (let [oldIndex, oldInstance] of this._workspaceInstances.entries()) {
                        if (!matchedInstance && oldInstance.name) {
                            // This is a heuristic: if this workspace was previously tracked,
                            // it might have just had windows change
                            // For now, we'll let it lose the name if windows completely changed
                        }
                    }
                }
                
                names.push(name);
            }
            
            // Update our instance tracking
            this._workspaceInstances = newInstances;
            
            // Update settings to reflect new order
            this._settings.set_strv('workspace-names', names);
            
            // Update the label in case the active workspace changed
            this._updateLabel();
        } catch (e) {
            console.error("Error handling workspace change:", e);
        }
    }
}
