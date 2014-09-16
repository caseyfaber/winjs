// Copyright (c) Microsoft Open Technologies, Inc.  All Rights Reserved. Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
/// <reference path="ms-appx://$(TargetFramework)/js/base.js" />
/// <reference path="ms-appx://$(TargetFramework)/js/ui.js" />
/// <reference path="ms-appx://$(TargetFramework)/js/en-us/ui.strings.js" />
/// <reference path="ms-appx://$(TargetFramework)/css/ui-dark.css" />
/// <reference path="../TestLib/LegacyLiveUnit/CommonUtils.ts"/>
/// <reference path="NavBarUtils.js"/>

var WinJSTests = WinJSTests || {};

WinJSTests.NavBarLayoutTests = function () {
    "use strict";

    var Key = WinJS.Utilities.Key;
    var canElementResize = null;

    this.setUp = function (complete) {
        LiveUnit.LoggingCore.logComment("In setup");
        this._elementWrapper = document.createElement("div");
        var newNode = document.createElement("div");
        newNode.id = "container";
        newNode.style.width = "500px";
        newNode.style.backgroundColor = "darkgreen";
        this._elementWrapper.appendChild(newNode);
        document.body.appendChild(this._elementWrapper);
        this._element = newNode;
        CommonUtilities.detectMsElementResize(function (canResize) {
            canElementResize = canResize;
            complete();
        });
    };

    this.tearDown = function () {
        LiveUnit.LoggingCore.logComment("In tearDown");
        if (this._elementWrapper) {
            WinJS.Utilities.disposeSubTree(this._elementWrapper);
            document.body.removeChild(this._elementWrapper);
            this._elementWrapper = null;
            this._element = null;
        }
    };

    var navUtils = NavBarUtils;

    // Verifies that the NavBar focus state is reset when the NavBar is hidden and then shown.
    this.testNavBarFocusOnHideAndShow = function (complete) {
        var navbarEl = document.createElement("div"),
            navbarContainerEl = document.createElement("div");

        this._element.appendChild(navbarEl);
        navbarEl.appendChild(navbarContainerEl);
        navbarContainerEl.style.backgroundColor = "brown";

        var navbar = new WinJS.UI.NavBar(navbarEl);
        var navbarContainer = new WinJS.UI.NavBarContainer(navbarContainerEl, {
            data: navUtils.getNavBarCommandsData(20, true, false, false, false, false, true)
        });

        navbar.show();

        function waitForScrollComplete(viewportEl) {
            return new WinJS.Promise(function (c, e, p) {
                // Wait time needs to be more than time required to perform UI action
                var waitTime = 300;
                function completeForReal() {
                    viewportEl.removeEventListener("scroll", handler);
                    c();
                }
                var timeout = setTimeout(completeForReal, waitTime);

                function handler(e) {
                    clearTimeout(timeout);
                    timeout = setTimeout(completeForReal, waitTime);
                };
                viewportEl.addEventListener("scroll", handler);
            });
        }

        CommonUtilities.waitForEvent(navbar, "aftershow").
        then(function () {
            // Move focus to the last command
            var firstNavItem = navbarContainer._surfaceEl.children[0].winControl;
            var lastNavItem = navbarContainer._surfaceEl.children[19].winControl;

            CommonUtilities.keydown(firstNavItem._buttonEl, Key.end);
            LiveUnit.Assert.areEqual(lastNavItem._buttonEl, document.activeElement);
            LiveUnit.Assert.areEqual(19, navbarContainer.currentIndex);

            return waitForScrollComplete(navbarContainerEl.querySelector(".win-navbarcontainer-viewport"));
        }).
        then(function () {
            var lastNavItem = navbarContainer._surfaceEl.children[19].winControl;

            // Open the split button
            lastNavItem._splitButtonEl.click();
            LiveUnit.Assert.isTrue(lastNavItem.splitOpened);

            // Hide the navbar
            navbar.hide();
            return CommonUtilities.waitForEvent(navbar, "afterhide");
        }).
        then(function () {
            // Show the navbar
            navbar.show();
            return CommonUtilities.waitForEvent(navbar, "aftershow");
        }).
        then(function () {
            // Verify the focus state was reset
            var firstNavItem = navbarContainer._surfaceEl.children[0].winControl;
            var lastNavItem = navbarContainer._surfaceEl.children[19].winControl;
            LiveUnit.Assert.areEqual(firstNavItem._buttonEl, document.activeElement);
            LiveUnit.Assert.areEqual(0, navbarContainer.currentIndex);
            LiveUnit.Assert.isFalse(lastNavItem.splitOpened);

            complete();
        });
    };

    this.testNavBarAriaProperties = function (complete) {
        var navbarEl = document.createElement("div"),
            navbarContainerEl = document.createElement("div");

        this._element.appendChild(navbarEl);
        navbarEl.appendChild(navbarContainerEl);
        navbarContainerEl.style.backgroundColor = "brown";

        var navbar = new WinJS.UI.NavBar(navbarEl);
        var navbarContainer = new WinJS.UI.NavBarContainer(navbarContainerEl, {
            data: navUtils.getNavBarCommandsData(20, true, false, false, false, false, true)
        });

        function checkAttribute(element, attribute, expectedValue) {
            var values = element.getAttribute(attribute).match(expectedValue),
                value = values ? values[0] : null;

            LiveUnit.Assert.areEqual(value, expectedValue, "Expected " + attribute + ": " + expectedValue +
                " Actual: " + value);
        }

        // Verify the NavBarContainer aria properties
        var viewportEl = navbarContainerEl.querySelector(".win-navbarcontainer-viewport");
        checkAttribute(viewportEl, "role", "group");
        checkAttribute(viewportEl, "aria-label", WinJS.Resources._getWinJSString("ui/navBarContainerViewportAriaLabel").value);

        // Verify the NavBarCommand aria properties
        var navbarCmds = navbarContainerEl.querySelectorAll(".win-navbarcommand");
        for (var i = 0; i < navbarCmds.length; i++) {
            var cmd = navbarCmds[i].winControl;
            checkAttribute(cmd._buttonEl, "role", "button");
            checkAttribute(cmd._splitButtonEl, "aria-expanded", "false");
        }

        navbar.show();

        CommonUtilities.waitForEvent(navbar, "aftershow").
            then(function () {
                // Click on split button and verify aria-expanded
                var splitEl = navbarCmds[0].winControl._splitButtonEl;
                splitEl.click();
                checkAttribute(splitEl, "aria-expanded", "true");
                splitEl.click();
                checkAttribute(splitEl, "aria-expanded", "false");
                complete();
            });
    };
};

LiveUnit.registerTestClass("WinJSTests.NavBarLayoutTests");

