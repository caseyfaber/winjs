// Copyright (c) Microsoft Opven Technologies, Inc.  All Rights Reserved. Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
/// <reference path="../Core.d.ts" />
import _Base = require("../Core/_Base");
import _BaseUtils = require("../Core/_BaseUtils");
import BindingList = require("../BindingList");
import ControlProcessor = require("../ControlProcessor");
import _Constants = require("./Toolbar/_Constants");
import _Command = require("./AppBar/_Command");
import _Control = require("../Utilities/_Control");
import _Dispose = require("../Utilities/_Dispose");
import _ElementUtilities = require("../Utilities/_ElementUtilities");
import _ErrorFromName = require("../Core/_ErrorFromName");
import _Flyout = require("../Controls/Flyout");
import _Global = require("../Core/_Global");
import Menu = require("../Controls/Menu");
import _MenuCommand = require("./Menu/_Command");
import _Resources = require("../Core/_Resources");
import _WriteProfilerMark = require("../Core/_WriteProfilerMark");

"use strict";

interface CommandInfo {
    command: _Command.ICommand;
    width: number;
    priority: number;
}

var strings = {
    get ariaLabel() { return _Resources._getWinJSString("ui/toolbarAriaLabel").value; },
    get overflowButtonAriaLabel() { return _Resources._getWinJSString("ui/toolbarOverflowButtonAriaLabel").value; },
    get badOverflowMode() { return "Invalid argument: The overflowMode property must be 'attached' or 'detached'"; },
    get badData() { return "Invalid argument: The data property must an instance of a WinJS.Binding.List"; },
    get mustContainCommands() { return "The toolbar can only contain WinJS.UI.Command or WinJS.UI.AppBarCommand controls"; }
};

export class Toolbar {
    private _id: string;
    private _disposed: boolean;
    private _overflowButton: HTMLButtonElement;
    private _separatorWidth: number;
    private _standardCommandWidth: number;
    private _overflowButtonWidth: number;
    private _menu: Menu.Menu;
    private _overflowMode: string;
    private _element: HTMLElement;
    private _data: BindingList.List<_Command.ICommand>;
    private _primaryCommands: _Command.ICommand[];
    private _secondaryCommands: _Command.ICommand[];
    private _customContentContainer: HTMLElement;
    private _mainActionArea: HTMLElement;
    private _customContentFlyout: _Flyout.Flyout;
    private _selectedCustomCommand: _Command.ICommand;
    private _measured = false;
    private _customContentCommandsWidth: { [uniqueID: string]: number };
    private _initializing = true;
    private _attachedOverflowArea: HTMLElement;
    
    // <field type="HTMLElement" domElement="true" hidden="true" locid="WinJS.UI.Toolbar.element" helpKeyword="WinJS.UI.Toolbar.element">
    /// Gets the DOM element that hosts the Toolbar.
    /// </field>
    get element() {
        return this._element;
    }

    // <field type="HTMLElement" domElement="true" hidden="true" locid="WinJS.UI.Toolbar.overflowMode" helpKeyword="WinJS.UI.Toolbar.overflowMode">
    /// Gets or sets the overflow mode of the Toolbar.
    /// </field>
    get overflowMode() {
        return this._overflowMode;
    }
    set overflowMode(value: string) {
        this._writeProfilerMark("set_overflowMode,info");

        if (value === this._overflowMode) {
            return;
        }
        if (value !== _Constants.overflowModeAttached && value !== _Constants.overflowModeDetached) {
            throw new _ErrorFromName("WinJS.UI.Toolbar.BadOverflowMode", strings.badOverflowMode);
        }

        this._overflowMode = value;

        if (value === _Constants.overflowModeDetached) {
            _ElementUtilities.addClass(this.element, _Constants.detachedModeCssClass);
            _ElementUtilities.removeClass(this.element, _Constants.attachedModeCssClass);
            if (!this._overflowButton) {
                this._overflowButton = _Global.document.createElement("button");
                this._overflowButton.tabIndex = 0;
                this._overflowButton.innerHTML = "<span class='" + _Constants.ellipsisCssClass + "'></span>";
                _ElementUtilities.addClass(this._overflowButton, _Constants.overflowButtonCssClass);
                this._mainActionArea.appendChild(this._overflowButton);
                this._overflowButton.addEventListener("click", () => {
                    var isRTL = _Global.getComputedStyle(this._element).direction === 'rtl';
                    this._menu.show(this._overflowButton, "autovertical", isRTL ? "left" : "right");
                });
                this._overflowButtonWidth = _ElementUtilities.getTotalWidth(this._overflowButton);
            }
        } else {
            _ElementUtilities.addClass(this.element, _Constants.attachedModeCssClass);
            _ElementUtilities.removeClass(this.element, _Constants.detachedModeCssClass);
            if (!this._attachedOverflowArea) {
                this._attachedOverflowArea = _Global.document.createElement("div");
                _ElementUtilities.addClass(this._attachedOverflowArea, _Constants.overflowAreaCssClass);
                _ElementUtilities.addClass(this._attachedOverflowArea, _Constants.menuCssClass);
                this.element.appendChild(this._attachedOverflowArea);
            }
        }
        if (!this._initializing) {
            this._positionCommands();
        }
    }

    // <field type="HTMLElement" domElement="true" hidden="true" locid="WinJS.UI.Toolbar.data" helpKeyword="WinJS.UI.Toolbar.overflowMode">
    /// Gets or sets the Binding List of WinJS.UI.Command for the Toolbar.
    /// </field>
    get data() {
        return this._data;
    }
    set data(value: BindingList.List<_Command.ICommand>) {
        this._writeProfilerMark("set_data,info");

        if (value === this.data) {
            return;
        }
        if (!(value instanceof BindingList.List)) {
            throw new _ErrorFromName("WinJS.UI.Toolbar.BadData", strings.badData);
        }

        this._data = value;
        this._primaryCommands = [];
        this._secondaryCommands = [];

        if (value.length > 0) {
            _ElementUtilities.removeClass(this.element, _Constants.emptyToolbarCssClass);
            value.forEach((command) => {
                if (command.section === "selection") {
                    this._secondaryCommands.push(command);
                } else {
                    this._primaryCommands.push(command);
                }
            });

            if (!this._initializing) {
                this._measureCommands();
                this._positionCommands();
            }
        } else {
            _ElementUtilities.addClass(this.element, _Constants.emptyToolbarCssClass);
        }
    }

    constructor(element?: HTMLElement, options: any = {}) {
        /// <signature helpKeyword="WinJS.UI.Toolbar.Toolbar">
        /// <summary locid="WinJS.UI.Toolbar.constructor">
        /// Creates a new Toolbar control.
        /// </summary>
        /// <param name="element" type="HTMLElement" domElement="true" locid="WinJS.UI.Toolbar.constructor_p:element">
        /// The DOM element that will host the control.
        /// </param>
        /// <param name="options" type="Object" locid="WinJS.UI.Toolbar.constructor_p:options">
        /// The set of properties and values to apply to the new Toolbar control.
        /// </param>
        /// <returns type="WinJS.UI.Toolbar" locid="WinJS.UI.Toolbar.constructor_returnValue">
        /// The new Toolbar control.
        /// </returns>
        /// </signature>

        // Make sure there's an element
        this._element = element || _Global.document.createElement("div");

        // Attaching JS control to DOM element
        this._element["winControl"] = this;

        this._id = this._element.id || _ElementUtilities._uniqueID(this._element);
        this._writeProfilerMark("constructor,StartTM");

        if (!this._element.hasAttribute("tabIndex")) {
            this._element.tabIndex = -1;
        }

        // Attach our css class.
        _ElementUtilities.addClass(this._element, _Constants.controlCssClass);

        this._disposed = false;
        _ElementUtilities.addClass(this._element, "win-disposable");

        // Make sure we have an ARIA role
        var role = this._element.getAttribute("role");
        if (!role) {
            this._element.setAttribute("role", "menubar");
        }

        var label = this._element.getAttribute("aria-label");
        if (!label) {
            this._element.setAttribute("aria-label", strings.ariaLabel);
        }

        this._setupTree();

        if (!options.data) {
            // Shallow copy object so we can modify it.
            options = _BaseUtils._shallowCopy(options);
            options.data = this._getDataFromDOMElements();
        }

        if (!options.overflowMode) {
            options.overflowMode = _Constants.overflowModeDetached;
        }

        _Control.setOptions(this, options);

        _ElementUtilities._resizeNotifier.subscribe(this._element, this._resizeHandler.bind(this));

        var initiallyParented = _Global.document.body.contains(this._element);
        _ElementUtilities._addInsertedNotifier(this._element);
        if (initiallyParented) {
            this._measureCommands();
            this._positionCommands();
        } else {
            var nodeInsertedHandler = () => {
                this._writeProfilerMark("_setupTree_WinJSNodeInserted:initiallyParented:" + initiallyParented + ",info");
                this._element.removeEventListener("WinJSNodeInserted", nodeInsertedHandler, false);
                this._measureCommands();
                this._positionCommands();
            };
            this._element.addEventListener("WinJSNodeInserted", nodeInsertedHandler, false);
        }

        this._initializing = false;

        this._writeProfilerMark("constructor,StopTM");

        return this;
    }

    dispose() {
        /// <signature helpKeyword="WinJS.UI.Toolbar.dispose">
        /// <summary locid="WinJS.UI.Toolbar.dispose">
        /// Disposes this Toolbar.
        /// </summary>
        /// </signature>
        if (this._disposed) {
            return;
        }

        this._customContentFlyout && this._customContentFlyout.dispose();
        this._menu && this._menu.dispose();

        _Dispose.disposeSubTree(this.element);
        this._disposed = true;
    }

    forceLayout() {
        /// <signature helpKeyword="WinJS.UI.Toolbar.forceLayout">
        /// <summary locid="WinJS.UI.Toolbar.forceLayout">
        /// Forces the Toolbar to update its layout. Use this function when the window did not change size, but the container of the Toolbar changed size.
        /// </summary>
        /// </signature>
        this._positionCommands();
    }

    private _writeProfilerMark(text: string) {
        _WriteProfilerMark("WinJS.UI.Toolbar:" + this._id + ":" + text);
    }

    private _setupTree() {
        this._writeProfilerMark("_setupTree,info");

        this._primaryCommands = [];
        this._secondaryCommands = [];

        this._mainActionArea = _Global.document.createElement("div");
        _ElementUtilities.addClass(this._mainActionArea, _Constants.actionAreaCssClass);
        _ElementUtilities._reparentChildren(this.element, this._mainActionArea);
        this.element.appendChild(this._mainActionArea);
    }

    private _getDataFromDOMElements(): BindingList.List<_Command.ICommand> {
        this._writeProfilerMark("_getDataFromDOMElements,info");

        ControlProcessor.processAll(this._mainActionArea, /*skip root*/ true);

        var commands:_Command.ICommand[] = [];
        var childrenLength = this._mainActionArea.children.length;
        var child: Element;
        for (var i = 0; i < childrenLength; i++) {
            child = this._mainActionArea.children[i];
            if (child["winControl"] && child["winControl"] instanceof _Command.AppBarCommand) {
                commands.push(child["winControl"]);
            } else {
                throw new _ErrorFromName("WinJS.UI.Toolbar.MustContainCommands", strings.mustContainCommands);
            }
        }
        return new BindingList.List(commands);
    }

    private _resizeHandler() {
        this._positionCommands();
    }

    private _commandUniqueId(command: _Command.ICommand): string {
        return _ElementUtilities._uniqueID(command.element);
    }

    private _getCommandsInfo(): CommandInfo[] {
        var width = 0;
        var commands: CommandInfo[] = [];
        var priority = 0;
        var currentAssignedPriority = 0;

        for (var i = this._primaryCommands.length - 1; i >= 0; i--) {
            var command = this._primaryCommands[i];
            if (command.priority === undefined) {
                priority = currentAssignedPriority--;
            } else {
                priority = command.priority;
            }
            width = (command.element.style.display === "none" ? 0 : this._getCommandWidth(command));

            commands.push({
                command: command,
                width: width,
                priority: priority
            });
        }

        // Return commands in the correct order
        return commands.reverse();
    }

    private _getPrimaryCommandsLocation(mainActionWidth: number) {
        this._writeProfilerMark("_getCommandsLocation,info");

        var mainActionCommands: _Command.ICommand[] = [];
        var overflowCommands: _Command.ICommand[] = [];
        var overflowButtonWidth = this.overflowMode === _Constants.overflowModeDetached ? this._overflowButtonWidth : 0;
        var spaceLeft = mainActionWidth;
        var overflowButtonSpace = 0;
        var hasSecondaryCommands = this._secondaryCommands.length > 0;

        var commandsInfo = this._getCommandsInfo();
        var sortedCommandsInfo = commandsInfo.slice(0).sort((commandInfo1: CommandInfo, commandInfo2: CommandInfo) => {
            return commandInfo1.priority - commandInfo2.priority;
        });

        var maxPriority = Number.MAX_VALUE;
        var availableWidth = mainActionWidth;

        for (var i = 0, len = sortedCommandsInfo.length; i < len; i++) {
            availableWidth -= sortedCommandsInfo[i].width;

            // The overflow button needs space if there are secondary commands or we are not evaluating the last command
            overflowButtonSpace = (hasSecondaryCommands || (i < len - 1) ? overflowButtonWidth : 0)

            if (availableWidth - overflowButtonSpace < 0) {
                maxPriority = sortedCommandsInfo[i].priority - 1;
                break;
            }
        }

        commandsInfo.forEach((commandInfo) => {
            if (commandInfo.priority <= maxPriority) {
                mainActionCommands.push(commandInfo.command);
            } else {
                overflowCommands.push(commandInfo.command);
            }
        });

        return {
            mainArea: mainActionCommands,
            overflowArea: overflowCommands
        }
    }

    private _getCommandWidth(command: _Command.ICommand): number {
        if (command.type === _Constants.typeContent) {
            return this._customContentCommandsWidth[this._commandUniqueId(command)];
        } else if (command.type === _Constants.typeSeparator) {
            return this._separatorWidth;
        } else {
            return this._standardCommandWidth;
        }
    }

    private _measureCommands() {
        this._writeProfilerMark("_measureCommands,info");

        if (this._disposed || !_Global.document.body.contains(this._element)) {
            return;
        }

        var primaryCommandsLength = this._primaryCommands.length;
        this._customContentCommandsWidth = {};
        this._separatorWidth = 0;
        this._standardCommandWidth = 0;

        this._primaryCommands.forEach((command) => {
            if (!command.element.parentElement) {
                this._mainActionArea.appendChild(command.element);
            }

            if (command.type === _Constants.typeContent) {
                this._customContentCommandsWidth[this._commandUniqueId(command)] = _ElementUtilities.getTotalWidth(command.element);
            } else if (command.type === _Constants.typeSeparator) {
                if (!this._separatorWidth) {
                    this._separatorWidth = _ElementUtilities.getTotalWidth(command.element);
                }
            } else {
                // Button, toggle, flyout command types have the same width
                if (!this._standardCommandWidth) {
                    this._standardCommandWidth = _ElementUtilities.getTotalWidth(command.element);
                }
            }
        });

        if (this._overflowButton && !this._overflowButtonWidth && this.overflowMode === _Constants.overflowModeDetached) {
            this._overflowButtonWidth = _ElementUtilities.getTotalWidth(this._overflowButton);
        }

        this._measured = true;
    }

    private _positionCommands() {
        this._writeProfilerMark("_positionCommands,StartTM");

        if (this._disposed || !this._measured) {
            this._writeProfilerMark("_positionCommands,StopTM");
            return;
        }

        if (this._overflowButton) {
            // Ensure that the overflow button is the last element in the main action area
            this._mainActionArea.appendChild(this._overflowButton);
        }

        var mainActionWidth = _ElementUtilities.getTotalWidth(this.element);
        var primaryCommandsLength = this._primaryCommands.length;

        this._primaryCommands.forEach((command) => {
            command.element.style.display = (command.hidden ? "none" : "");
        })

        var commandsLocation = this._getPrimaryCommandsLocation(mainActionWidth);

        this._hideSeparatorsIfNeeded(commandsLocation.mainArea);

        // Primary commands that will be mirrored in the overflow area should be hidden so
        // that they are not visible in the main action area.
        commandsLocation.overflowArea.forEach((command) => {
            command.element.style.display = "none";
        });

        // The secondary commands in the the main action area should be hidden since they are always
        // mirrored as new elements in the overflow area.
        this._secondaryCommands.forEach((command) => {
            command.element.style.display = "none";
        });

        this._setupOverflowArea(commandsLocation.overflowArea);

        this._writeProfilerMark("_positionCommands,StopTM");
    }

    private _getMenuCommand(command: _Command.ICommand): _MenuCommand.MenuCommand {
        var menuCommand = new _MenuCommand.MenuCommand(null, {
            label: command.label,
            type: (command.type === _Constants.typeContent ? _Constants.typeFlyout : command.type) || _Constants.typeButton,
            disabled: command.disabled,
            flyout: command.flyout
        });

        if (command.selected) {
            menuCommand.selected = true;
        }

        if (command.extraClass) {
            menuCommand.extraClass = command.extraClass;
        }

        if (command.type === _Constants.typeContent) {
            if (!menuCommand.label) {
                menuCommand.label = _Constants.contentMenuCommandDefaultLabel;
            }
            menuCommand.flyout = this._customContentFlyout;
            menuCommand["_originalToolbarCommand"] = command;
            menuCommand.element.addEventListener("focus", () => {
                this._selectedCustomCommand = <_Command.ICommand>(menuCommand["_originalToolbarCommand"]);
            });
        } else {
            menuCommand.onclick = command.onclick;
        }
        return menuCommand;
    }

    private _setupOverflowArea(additionalCommands: any[]) {
        if (this._overflowButton) {
            var showOverflowButton = (additionalCommands.length > 0 || this._secondaryCommands.length > 0) && this.overflowMode === _Constants.overflowModeDetached;
            this._overflowButton.style.display = showOverflowButton ? "": "none"
        }

        if (this.overflowMode === _Constants.overflowModeAttached) {
            this._setupOverflowAreaAttached(additionalCommands);
        } else {
            this._setupOverflowAreaDetached(additionalCommands);
        }
    }

    private _setupOverflowAreaAttached(additionalCommands: any[]) {
        this._writeProfilerMark("_setupOverflowAreaAttached,info");

        // Note: The overflow attached presentation will be implemented as part of an upcoming task.
        // The following is a temporary presentation.

        _ElementUtilities.empty(this._attachedOverflowArea);

        this._hideSeparatorsIfNeeded(additionalCommands);

        // Add primary commands that should overflow
        additionalCommands.forEach((command) => {
            this._attachedOverflowArea.appendChild(this._getMenuCommand(command).element);
        });

        // Add separator between primary and secondary command if applicable
        var secondaryCommandsLength = this._secondaryCommands.length;
        if (additionalCommands.length > 0 && secondaryCommandsLength > 0) {
            var separator = new _MenuCommand.MenuCommand(null, {
                type: _Constants.typeSeparator
            });
            this._attachedOverflowArea.appendChild(separator.element);
        }

        this._hideSeparatorsIfNeeded(this._secondaryCommands);

        // Add secondary commands
        this._secondaryCommands.forEach((command) => {
            if (!command.hidden) {
                this._attachedOverflowArea.appendChild(this._getMenuCommand(command).element);
            }
        });
    }

    private _setupOverflowAreaDetached(additionalCommands: any[]) {
        this._writeProfilerMark("_setupOverflowAreaDetached,info");

        var isCustomContent = (command: _Command.ICommand) => { return command.type === _Constants.typeContent };
        var customContent = additionalCommands.filter(isCustomContent);
        if (customContent.length === 0) {
            customContent = this._secondaryCommands.filter(isCustomContent);
        }

        if (customContent.length > 0 && !this._customContentFlyout) {
            var mainFlyout = _Global.document.createElement("div");
            this._customContentContainer = _Global.document.createElement("div");
            _ElementUtilities.addClass(this._customContentContainer, _Constants.overflowContentFlyoutCssClass);
            mainFlyout.appendChild(this._customContentContainer);
            this._customContentFlyout = new _Flyout.Flyout(mainFlyout);
            _Global.document.body.appendChild(this._customContentFlyout.element);
            this._customContentFlyout.onbeforeshow = () => {
                _ElementUtilities.empty(this._customContentContainer);
                _ElementUtilities._reparentChildren(this._selectedCustomCommand.element, this._customContentContainer);
            };
            this._customContentFlyout.onafterhide = () => {
                _ElementUtilities._reparentChildren(this._customContentContainer, this._selectedCustomCommand.element);
            };
        }

        if (!this._menu) {
            this._menu = new Menu.Menu();
            _ElementUtilities.addClass(this._menu.element, _Constants.overflowAreaCssClass);
            _Global.document.body.appendChild(this._menu.element);
        }

        var menuCommands: _MenuCommand.MenuCommand[] = [];

        // Add primary commands that should overflow to the menu commands
        additionalCommands.forEach((command) => {
            menuCommands.push(this._getMenuCommand(command));
        });

        // Add separator between primary and secondary command if applicable
        if (additionalCommands.length > 0 && this._secondaryCommands.length > 0) {
            menuCommands.push(new _MenuCommand.MenuCommand(null, {
                type: _Constants.typeSeparator
            }));
        }

        // Add secondary commands to the menu commands
        this._secondaryCommands.forEach((command) => {
            if (!command.hidden) {
                menuCommands.push(this._getMenuCommand(command));
            }
        });

        this._hideSeparatorsIfNeeded(<_Command.ICommand[]> menuCommands);

        // Set the menu commands
        this._menu.commands = menuCommands;
    }

    private _hideSeparatorsIfNeeded(commands: _Command.ICommand[]): void {
        var prevType = _Constants.typeSeparator;
        var command: _Command.ICommand;

        // Hide all leading or consecutive separators
        var commandsLength = commands.length;
        commands.forEach((command) => {
            if (command.type === _Constants.typeSeparator &&
                prevType === _Constants.typeSeparator) {
                command.element.style.display = "none";
            }
            prevType = command.type;
        });

        // Hide trailing separators
        for (var i = commandsLength - 1; i >= 0; i--) {
            command = commands[i];
            if (command.type === _Constants.typeSeparator) {
                command.element.style.display = "none";
            } else {
                break;
            }
        }
    }

    static supportedForProcessing: boolean = true;
}

// addEventListener, removeEventListener, dispatchEvent
_Base.Class.mix(Toolbar, _Control.DOMEventMixin);

_Base.Namespace.define("WinJS.UI", {
    Toolbar: Toolbar
});
