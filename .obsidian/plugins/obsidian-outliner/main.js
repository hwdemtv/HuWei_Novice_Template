'use strict';

var obsidian = require('obsidian');
var view = require('@codemirror/view');
var language = require('@codemirror/language');
var state = require('@codemirror/state');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

class MoveCursorToPreviousUnfoldedLine {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = this.root.getListUnderCursor();
        const cursor = this.root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => {
            return (cursor.ch === l.from.ch + list.getCheckboxLength() &&
                cursor.line === l.from.line);
        });
        if (lineNo === 0) {
            this.moveCursorToPreviousUnfoldedItem(root, cursor);
        }
        else if (lineNo > 0) {
            this.moveCursorToPreviousNoteLine(root, lines, lineNo);
        }
    }
    moveCursorToPreviousNoteLine(root, lines, lineNo) {
        this.stopPropagation = true;
        this.updated = true;
        root.replaceCursor(lines[lineNo - 1].to);
    }
    moveCursorToPreviousUnfoldedItem(root, cursor) {
        const prev = root.getListUnderLine(cursor.line - 1);
        if (!prev) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        if (prev.isFolded()) {
            const foldRoot = prev.getTopFoldRoot();
            const firstLineEnd = foldRoot.getLinesInfo()[0].to;
            root.replaceCursor(firstLineEnd);
        }
        else {
            root.replaceCursor(prev.getLastLineContentEnd());
        }
    }
}

function getEditorFromState(state) {
    const { editor } = state.field(obsidian.editorInfoField);
    if (!editor) {
        return null;
    }
    return new MyEditor(editor);
}
function foldInside(view, from, to) {
    let found = null;
    language.foldedRanges(view.state).between(from, to, (from, to) => {
        if (!found || found.from > from)
            found = { from, to };
    });
    return found;
}
class MyEditor {
    constructor(e) {
        this.e = e;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.view = this.e.cm;
    }
    getCursor() {
        return this.e.getCursor();
    }
    getLine(n) {
        return this.e.getLine(n);
    }
    lastLine() {
        return this.e.lastLine();
    }
    listSelections() {
        return this.e.listSelections();
    }
    getRange(from, to) {
        return this.e.getRange(from, to);
    }
    replaceRange(replacement, from, to) {
        return this.e.replaceRange(replacement, from, to);
    }
    setSelections(selections) {
        this.e.setSelections(selections);
    }
    setValue(text) {
        this.e.setValue(text);
    }
    getValue() {
        return this.e.getValue();
    }
    offsetToPos(offset) {
        return this.e.offsetToPos(offset);
    }
    posToOffset(pos) {
        return this.e.posToOffset(pos);
    }
    fold(n) {
        const { view } = this;
        const l = view.lineBlockAt(view.state.doc.line(n + 1).from);
        const range = language.foldable(view.state, l.from, l.to);
        if (!range || range.from === range.to) {
            return;
        }
        view.dispatch({ effects: [language.foldEffect.of(range)] });
    }
    unfold(n) {
        const { view } = this;
        const l = view.lineBlockAt(view.state.doc.line(n + 1).from);
        const range = foldInside(view, l.from, l.to);
        if (!range) {
            return;
        }
        view.dispatch({ effects: [language.unfoldEffect.of(range)] });
    }
    getAllFoldedLines() {
        const c = language.foldedRanges(this.view.state).iter();
        const res = [];
        while (c.value) {
            res.push(this.offsetToPos(c.from).line);
            c.next();
        }
        return res;
    }
    triggerOnKeyDown(e) {
        view.runScopeHandlers(this.view, e, "editor");
    }
    getZoomRange() {
        if (!window.ObsidianZoomPlugin) {
            return null;
        }
        return window.ObsidianZoomPlugin.getZoomRange(this.e);
    }
    zoomOut() {
        if (!window.ObsidianZoomPlugin) {
            return;
        }
        window.ObsidianZoomPlugin.zoomOut(this.e);
    }
    zoomIn(line) {
        if (!window.ObsidianZoomPlugin) {
            return;
        }
        window.ObsidianZoomPlugin.zoomIn(this.e, line);
    }
    tryRefreshZoom(line) {
        if (!window.ObsidianZoomPlugin) {
            return;
        }
        if (window.ObsidianZoomPlugin.refreshZoom) {
            window.ObsidianZoomPlugin.refreshZoom(this.e);
        }
        else {
            window.ObsidianZoomPlugin.zoomIn(this.e, line);
        }
    }
}

function createKeymapRunCallback(config) {
    const check = config.check || (() => true);
    const { run } = config;
    return (view) => {
        const editor = getEditorFromState(view.state);
        if (!check(editor)) {
            return false;
        }
        const { shouldUpdate, shouldStopPropagation } = run(editor);
        return shouldUpdate || shouldStopPropagation;
    };
}

class ArrowLeftAndCtrlArrowLeftBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new MoveCursorToPreviousUnfoldedLine(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "ArrowLeft",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
                {
                    win: "c-ArrowLeft",
                    linux: "c-ArrowLeft",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

function cmpPos(a, b) {
    return a.line - b.line || a.ch - b.ch;
}
function maxPos(a, b) {
    return cmpPos(a, b) < 0 ? b : a;
}
function minPos(a, b) {
    return cmpPos(a, b) < 0 ? a : b;
}
function isRangesIntersects(a, b) {
    return cmpPos(a[1], b[0]) >= 0 && cmpPos(a[0], b[1]) <= 0;
}
function recalculateNumericBullets(root) {
    function visit(parent) {
        let index = 1;
        for (const child of parent.getChildren()) {
            if (/\d+\./.test(child.getBullet())) {
                child.replateBullet(`${index++}.`);
            }
            visit(child);
        }
    }
    visit(root);
}
let idSeq = 0;
class List {
    constructor(root, indent, bullet, optionalCheckbox, spaceAfterBullet, firstLine, foldRoot) {
        this.root = root;
        this.indent = indent;
        this.bullet = bullet;
        this.optionalCheckbox = optionalCheckbox;
        this.spaceAfterBullet = spaceAfterBullet;
        this.foldRoot = foldRoot;
        this.parent = null;
        this.children = [];
        this.notesIndent = null;
        this.lines = [];
        this.id = idSeq++;
        this.lines.push(firstLine);
    }
    getID() {
        return this.id;
    }
    getNotesIndent() {
        return this.notesIndent;
    }
    setNotesIndent(notesIndent) {
        if (this.notesIndent !== null) {
            throw new Error(`Notes indent already provided`);
        }
        this.notesIndent = notesIndent;
    }
    addLine(text) {
        if (this.notesIndent === null) {
            throw new Error(`Unable to add line, notes indent should be provided first`);
        }
        this.lines.push(text);
    }
    replaceLines(lines) {
        if (lines.length > 1 && this.notesIndent === null) {
            throw new Error(`Unable to add line, notes indent should be provided first`);
        }
        this.lines = lines;
    }
    getLineCount() {
        return this.lines.length;
    }
    getRoot() {
        return this.root;
    }
    getChildren() {
        return this.children.concat();
    }
    getLinesInfo() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return this.lines.map((row, i) => {
            const line = startLine + i;
            const startCh = i === 0 ? this.getContentStartCh() : this.notesIndent.length;
            const endCh = startCh + row.length;
            return {
                text: row,
                from: { line, ch: startCh },
                to: { line, ch: endCh },
            };
        });
    }
    getLines() {
        return this.lines.concat();
    }
    getFirstLineContentStart() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return {
            line: startLine,
            ch: this.getContentStartCh(),
        };
    }
    getFirstLineContentStartAfterCheckbox() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return {
            line: startLine,
            ch: this.getContentStartCh() + this.getCheckboxLength(),
        };
    }
    getLastLineContentEnd() {
        const endLine = this.root.getContentLinesRangeOf(this)[1];
        const endCh = this.lines.length === 1
            ? this.getContentStartCh() + this.lines[0].length
            : this.notesIndent.length + this.lines[this.lines.length - 1].length;
        return {
            line: endLine,
            ch: endCh,
        };
    }
    getContentEndIncludingChildren() {
        return this.getLastChild().getLastLineContentEnd();
    }
    getLastChild() {
        let lastChild = this;
        while (!lastChild.isEmpty()) {
            lastChild = lastChild.getChildren().last();
        }
        return lastChild;
    }
    getContentStartCh() {
        return this.indent.length + this.bullet.length + 1;
    }
    isFolded() {
        if (this.foldRoot) {
            return true;
        }
        if (this.parent) {
            return this.parent.isFolded();
        }
        return false;
    }
    isFoldRoot() {
        return this.foldRoot;
    }
    getTopFoldRoot() {
        let tmp = this;
        let foldRoot = null;
        while (tmp) {
            if (tmp.isFoldRoot()) {
                foldRoot = tmp;
            }
            tmp = tmp.parent;
        }
        return foldRoot;
    }
    getLevel() {
        if (!this.parent) {
            return 0;
        }
        return this.parent.getLevel() + 1;
    }
    unindentContent(from, till) {
        this.indent = this.indent.slice(0, from) + this.indent.slice(till);
        if (this.notesIndent !== null) {
            this.notesIndent =
                this.notesIndent.slice(0, from) + this.notesIndent.slice(till);
        }
        for (const child of this.children) {
            child.unindentContent(from, till);
        }
    }
    indentContent(indentPos, indentChars) {
        this.indent =
            this.indent.slice(0, indentPos) +
                indentChars +
                this.indent.slice(indentPos);
        if (this.notesIndent !== null) {
            this.notesIndent =
                this.notesIndent.slice(0, indentPos) +
                    indentChars +
                    this.notesIndent.slice(indentPos);
        }
        for (const child of this.children) {
            child.indentContent(indentPos, indentChars);
        }
    }
    getFirstLineIndent() {
        return this.indent;
    }
    getBullet() {
        return this.bullet;
    }
    getSpaceAfterBullet() {
        return this.spaceAfterBullet;
    }
    getCheckboxLength() {
        return this.optionalCheckbox.length;
    }
    replateBullet(bullet) {
        this.bullet = bullet;
    }
    getParent() {
        return this.parent;
    }
    addBeforeAll(list) {
        this.children.unshift(list);
        list.parent = this;
    }
    addAfterAll(list) {
        this.children.push(list);
        list.parent = this;
    }
    removeChild(list) {
        const i = this.children.indexOf(list);
        this.children.splice(i, 1);
        list.parent = null;
    }
    addBefore(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i, 0, list);
        list.parent = this;
    }
    addAfter(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i + 1, 0, list);
        list.parent = this;
    }
    getPrevSiblingOf(list) {
        const i = this.children.indexOf(list);
        return i > 0 ? this.children[i - 1] : null;
    }
    getNextSiblingOf(list) {
        const i = this.children.indexOf(list);
        return i >= 0 && i < this.children.length ? this.children[i + 1] : null;
    }
    isEmpty() {
        return this.children.length === 0;
    }
    print() {
        let res = "";
        for (let i = 0; i < this.lines.length; i++) {
            res +=
                i === 0
                    ? this.indent + this.bullet + this.spaceAfterBullet
                    : this.notesIndent;
            res += this.lines[i];
            res += "\n";
        }
        for (const child of this.children) {
            res += child.print();
        }
        return res;
    }
    clone(newRoot) {
        const clone = new List(newRoot, this.indent, this.bullet, this.optionalCheckbox, this.spaceAfterBullet, "", this.foldRoot);
        clone.id = this.id;
        clone.lines = this.lines.concat();
        clone.notesIndent = this.notesIndent;
        for (const child of this.children) {
            clone.addAfterAll(child.clone(newRoot));
        }
        return clone;
    }
}
class Root {
    constructor(start, end, selections) {
        this.start = start;
        this.end = end;
        this.rootList = new List(this, "", "", "", "", "", false);
        this.selections = [];
        this.replaceSelections(selections);
    }
    getRootList() {
        return this.rootList;
    }
    getContentRange() {
        return [this.getContentStart(), this.getContentEnd()];
    }
    getContentStart() {
        return Object.assign({}, this.start);
    }
    getContentEnd() {
        return Object.assign({}, this.end);
    }
    getSelections() {
        return this.selections.map((s) => ({
            anchor: Object.assign({}, s.anchor),
            head: Object.assign({}, s.head),
        }));
    }
    hasSingleCursor() {
        if (!this.hasSingleSelection()) {
            return false;
        }
        const selection = this.selections[0];
        return (selection.anchor.line === selection.head.line &&
            selection.anchor.ch === selection.head.ch);
    }
    hasSingleSelection() {
        return this.selections.length === 1;
    }
    getSelection() {
        const selection = this.selections[this.selections.length - 1];
        const from = selection.anchor.ch > selection.head.ch
            ? selection.head.ch
            : selection.anchor.ch;
        const to = selection.anchor.ch > selection.head.ch
            ? selection.anchor.ch
            : selection.head.ch;
        return Object.assign(Object.assign({}, selection), { from,
            to });
    }
    getCursor() {
        return Object.assign({}, this.selections[this.selections.length - 1].head);
    }
    replaceCursor(cursor) {
        this.selections = [{ anchor: cursor, head: cursor }];
    }
    replaceSelections(selections) {
        if (selections.length < 1) {
            throw new Error(`Unable to create Root without selections`);
        }
        this.selections = selections;
    }
    getListUnderCursor() {
        return this.getListUnderLine(this.getCursor().line);
    }
    getListUnderLine(line) {
        if (line < this.start.line || line > this.end.line) {
            return;
        }
        let result = null;
        let index = this.start.line;
        const visitArr = (ll) => {
            for (const l of ll) {
                const listFromLine = index;
                const listTillLine = listFromLine + l.getLineCount() - 1;
                if (line >= listFromLine && line <= listTillLine) {
                    result = l;
                }
                else {
                    index = listTillLine + 1;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result;
    }
    getContentLinesRangeOf(list) {
        let result = null;
        let line = this.start.line;
        const visitArr = (ll) => {
            for (const l of ll) {
                const listFromLine = line;
                const listTillLine = listFromLine + l.getLineCount() - 1;
                if (l === list) {
                    result = [listFromLine, listTillLine];
                }
                else {
                    line = listTillLine + 1;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result;
    }
    getChildren() {
        return this.rootList.getChildren();
    }
    print() {
        let res = "";
        for (const child of this.rootList.getChildren()) {
            res += child.print();
        }
        return res.replace(/\n$/, "");
    }
    clone() {
        const clone = new Root(Object.assign({}, this.start), Object.assign({}, this.end), this.getSelections());
        clone.rootList = this.rootList.clone(clone);
        return clone;
    }
}

class DeleteTillPreviousLineContentEnd {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const cursor = root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => cursor.ch === l.from.ch && cursor.line === l.from.line);
        if (lineNo === 0) {
            this.mergeWithPreviousItem(root, cursor, list);
        }
        else if (lineNo > 0) {
            this.mergeNotes(root, cursor, list, lines, lineNo);
        }
    }
    mergeNotes(root, cursor, list, lines, lineNo) {
        this.stopPropagation = true;
        this.updated = true;
        const prevLineNo = lineNo - 1;
        root.replaceCursor({
            line: cursor.line - 1,
            ch: lines[prevLineNo].text.length + lines[prevLineNo].from.ch,
        });
        lines[prevLineNo].text += lines[lineNo].text;
        lines.splice(lineNo, 1);
        list.replaceLines(lines.map((l) => l.text));
    }
    mergeWithPreviousItem(root, cursor, list) {
        if (root.getChildren()[0] === list && list.isEmpty()) {
            return;
        }
        this.stopPropagation = true;
        const prev = root.getListUnderLine(cursor.line - 1);
        if (!prev) {
            return;
        }
        const bothAreEmpty = prev.isEmpty() && list.isEmpty();
        const prevIsEmptyAndSameLevel = prev.isEmpty() && !list.isEmpty() && prev.getLevel() === list.getLevel();
        const listIsEmptyAndPrevIsParent = list.isEmpty() && prev.getLevel() === list.getLevel() - 1;
        if (bothAreEmpty || prevIsEmptyAndSameLevel || listIsEmptyAndPrevIsParent) {
            this.updated = true;
            const parent = list.getParent();
            const prevEnd = prev.getLastLineContentEnd();
            if (!prev.getNotesIndent() && list.getNotesIndent()) {
                prev.setNotesIndent(prev.getFirstLineIndent() +
                    list.getNotesIndent().slice(list.getFirstLineIndent().length));
            }
            const oldLines = prev.getLines();
            const newLines = list.getLines();
            oldLines[oldLines.length - 1] += newLines[0];
            const resultLines = oldLines.concat(newLines.slice(1));
            prev.replaceLines(resultLines);
            parent.removeChild(list);
            for (const c of list.getChildren()) {
                list.removeChild(c);
                prev.addAfterAll(c);
            }
            root.replaceCursor(prevEnd);
            recalculateNumericBullets(root);
        }
    }
}

class BackspaceBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new DeleteTillPreviousLineContentEnd(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "Backspace",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const BETTER_LISTS_BODY_CLASS = "outliner-plugin-better-lists";
class BetterListsStyles {
    constructor(settings, obsidianSettings) {
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.updateBodyClass = () => {
            const shouldExists = this.obsidianSettings.isDefaultThemeEnabled() &&
                this.settings.betterListsStyles;
            const exists = document.body.classList.contains(BETTER_LISTS_BODY_CLASS);
            if (shouldExists && !exists) {
                document.body.classList.add(BETTER_LISTS_BODY_CLASS);
            }
            if (!shouldExists && exists) {
                document.body.classList.remove(BETTER_LISTS_BODY_CLASS);
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.updateBodyClass();
            this.updateBodyClassInterval = window.setInterval(() => {
                this.updateBodyClass();
            }, 1000);
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.updateBodyClassInterval);
            document.body.classList.remove(BETTER_LISTS_BODY_CLASS);
        });
    }
}

class SelectAllContent {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleSelection()) {
            return;
        }
        const selection = root.getSelections()[0];
        const [rootStart, rootEnd] = root.getContentRange();
        const selectionFrom = minPos(selection.anchor, selection.head);
        const selectionTo = maxPos(selection.anchor, selection.head);
        if (selectionFrom.line < rootStart.line ||
            selectionTo.line > rootEnd.line) {
            return false;
        }
        if (selectionFrom.line === rootStart.line &&
            selectionFrom.ch === rootStart.ch &&
            selectionTo.line === rootEnd.line &&
            selectionTo.ch === rootEnd.ch) {
            return false;
        }
        const list = root.getListUnderCursor();
        const contentStart = list.getFirstLineContentStartAfterCheckbox();
        const contentEnd = list.getLastLineContentEnd();
        const listUnderSelectionFrom = root.getListUnderLine(selectionFrom.line);
        const listStart = listUnderSelectionFrom.getFirstLineContentStartAfterCheckbox();
        const listEnd = listUnderSelectionFrom.getContentEndIncludingChildren();
        this.stopPropagation = true;
        this.updated = true;
        if (selectionFrom.line === contentStart.line &&
            selectionFrom.ch === contentStart.ch &&
            selectionTo.line === contentEnd.line &&
            selectionTo.ch === contentEnd.ch) {
            if (list.getChildren().length) {
                // select sub lists
                root.replaceSelections([
                    { anchor: contentStart, head: list.getContentEndIncludingChildren() },
                ]);
            }
            else {
                // select whole list
                root.replaceSelections([{ anchor: rootStart, head: rootEnd }]);
            }
        }
        else if (listStart.ch == selectionFrom.ch &&
            listEnd.line == selectionTo.line &&
            listEnd.ch == selectionTo.ch) {
            // select whole list
            root.replaceSelections([{ anchor: rootStart, head: rootEnd }]);
        }
        else if ((selectionFrom.line > contentStart.line ||
            (selectionFrom.line == contentStart.line &&
                selectionFrom.ch >= contentStart.ch)) &&
            (selectionTo.line < contentEnd.line ||
                (selectionTo.line == contentEnd.line &&
                    selectionTo.ch <= contentEnd.ch))) {
            // select whole line
            root.replaceSelections([{ anchor: contentStart, head: contentEnd }]);
        }
        else {
            this.stopPropagation = false;
            this.updated = false;
            return false;
        }
        return true;
    }
}

class CtrlAAndCmdABehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.overrideSelectAllBehaviour && !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new SelectAllContent(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "c-a",
                    mac: "m-a",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class DeleteTillNextLineContentStart {
    constructor(root) {
        this.root = root;
        this.deleteTillPreviousLineContentEnd =
            new DeleteTillPreviousLineContentEnd(root);
    }
    shouldStopPropagation() {
        return this.deleteTillPreviousLineContentEnd.shouldStopPropagation();
    }
    shouldUpdate() {
        return this.deleteTillPreviousLineContentEnd.shouldUpdate();
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const cursor = root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => cursor.ch === l.to.ch && cursor.line === l.to.line);
        if (lineNo === lines.length - 1) {
            const nextLine = lines[lineNo].to.line + 1;
            const nextList = root.getListUnderLine(nextLine);
            if (!nextList) {
                return;
            }
            root.replaceCursor(nextList.getFirstLineContentStart());
            this.deleteTillPreviousLineContentEnd.perform();
        }
        else if (lineNo >= 0) {
            root.replaceCursor(lines[lineNo + 1].from);
            this.deleteTillPreviousLineContentEnd.perform();
        }
    }
}

class DeleteBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new DeleteTillNextLineContentStart(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "Delete",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class MoveListToDifferentPosition {
    constructor(root, listToMove, placeToMove, whereToMove, defaultIndentChars) {
        this.root = root;
        this.listToMove = listToMove;
        this.placeToMove = placeToMove;
        this.whereToMove = whereToMove;
        this.defaultIndentChars = defaultIndentChars;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        if (this.listToMove === this.placeToMove) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const cursorAnchor = this.calculateCursorAnchor();
        this.moveList();
        this.changeIndent();
        this.restoreCursor(cursorAnchor);
        recalculateNumericBullets(this.root);
    }
    calculateCursorAnchor() {
        const cursorLine = this.root.getCursor().line;
        const lines = [
            this.listToMove.getFirstLineContentStart().line,
            this.listToMove.getLastLineContentEnd().line,
            this.placeToMove.getFirstLineContentStart().line,
            this.placeToMove.getLastLineContentEnd().line,
        ];
        const listStartLine = Math.min(...lines);
        const listEndLine = Math.max(...lines);
        if (cursorLine < listStartLine || cursorLine > listEndLine) {
            return null;
        }
        const cursor = this.root.getCursor();
        const cursorList = this.root.getListUnderLine(cursor.line);
        const cursorListStart = cursorList.getFirstLineContentStart();
        const lineDiff = cursor.line - cursorListStart.line;
        const chDiff = cursor.ch - cursorListStart.ch;
        return { cursorList, lineDiff, chDiff };
    }
    moveList() {
        this.listToMove.getParent().removeChild(this.listToMove);
        switch (this.whereToMove) {
            case "before":
                this.placeToMove
                    .getParent()
                    .addBefore(this.placeToMove, this.listToMove);
                break;
            case "after":
                this.placeToMove
                    .getParent()
                    .addAfter(this.placeToMove, this.listToMove);
                break;
            case "inside":
                this.placeToMove.addBeforeAll(this.listToMove);
                break;
        }
    }
    changeIndent() {
        const oldIndent = this.listToMove.getFirstLineIndent();
        const newIndent = this.whereToMove === "inside"
            ? this.placeToMove.getFirstLineIndent() + this.defaultIndentChars
            : this.placeToMove.getFirstLineIndent();
        this.listToMove.unindentContent(0, oldIndent.length);
        this.listToMove.indentContent(0, newIndent);
    }
    restoreCursor(cursorAnchor) {
        if (cursorAnchor) {
            const cursorListStart = cursorAnchor.cursorList.getFirstLineContentStart();
            this.root.replaceCursor({
                line: cursorListStart.line + cursorAnchor.lineDiff,
                ch: cursorListStart.ch + cursorAnchor.chDiff,
            });
        }
        else {
            // When you move a list, the screen scrolls to the cursor.
            // It is better to move the cursor into the viewport than let the screen scroll.
            this.root.replaceCursor(this.listToMove.getLastLineContentEnd());
        }
    }
}

const BODY_CLASS = "outliner-plugin-dnd";
class DragAndDrop {
    constructor(plugin, settings, obisidian, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.obisidian = obisidian;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.preStart = null;
        this.state = null;
        this.handleSettingsChange = () => {
            if (!isFeatureSupported()) {
                return;
            }
            if (this.settings.dragAndDrop) {
                document.body.classList.add(BODY_CLASS);
            }
            else {
                document.body.classList.remove(BODY_CLASS);
            }
        };
        this.handleMouseDown = (e) => {
            if (!isFeatureSupported() ||
                !this.settings.dragAndDrop ||
                !isClickOnBullet(e)) {
                return;
            }
            const view = getEditorViewFromHTMLElement(e.target);
            if (!view) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            this.preStart = {
                x: e.x,
                y: e.y,
                view,
            };
        };
        this.handleMouseMove = (e) => {
            if (this.preStart) {
                this.startDragging();
            }
            if (this.state) {
                this.detectAndDrawDropZone(e.x, e.y);
            }
        };
        this.handleMouseUp = () => {
            if (this.preStart) {
                this.preStart = null;
            }
            if (this.state) {
                this.stopDragging();
            }
        };
        this.handleKeyDown = (e) => {
            if (this.state && e.code === "Escape") {
                this.cancelDragging();
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension([
                draggingLinesStateField,
                droppingLinesStateField,
            ]);
            this.enableFeatureToggle();
            this.createDropZone();
            this.addEventListeners();
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            this.removeEventListeners();
            this.removeDropZone();
            this.disableFeatureToggle();
        });
    }
    enableFeatureToggle() {
        this.settings.onChange(this.handleSettingsChange);
        this.handleSettingsChange();
    }
    disableFeatureToggle() {
        this.settings.removeCallback(this.handleSettingsChange);
        document.body.classList.remove(BODY_CLASS);
    }
    createDropZone() {
        this.dropZonePadding = document.createElement("div");
        this.dropZonePadding.classList.add("outliner-plugin-drop-zone-padding");
        this.dropZone = document.createElement("div");
        this.dropZone.classList.add("outliner-plugin-drop-zone");
        this.dropZone.style.display = "none";
        this.dropZone.appendChild(this.dropZonePadding);
        document.body.appendChild(this.dropZone);
    }
    removeDropZone() {
        document.body.removeChild(this.dropZone);
        this.dropZonePadding = null;
        this.dropZone = null;
    }
    addEventListeners() {
        document.addEventListener("mousedown", this.handleMouseDown, {
            capture: true,
        });
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
        document.addEventListener("keydown", this.handleKeyDown);
    }
    removeEventListeners() {
        document.removeEventListener("mousedown", this.handleMouseDown, {
            capture: true,
        });
        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
        document.removeEventListener("keydown", this.handleKeyDown);
    }
    startDragging() {
        const { x, y, view } = this.preStart;
        this.preStart = null;
        const editor = getEditorFromState(view.state);
        const pos = editor.offsetToPos(view.posAtCoords({ x, y }));
        const root = this.parser.parse(editor, pos);
        const list = root.getListUnderLine(pos.line);
        const state = new DragAndDropState(view, editor, root, list);
        if (!state.hasDropVariants()) {
            return;
        }
        this.state = state;
        this.highlightDraggingLines();
    }
    detectAndDrawDropZone(x, y) {
        this.state.calculateNearestDropVariant(x, y);
        this.drawDropZone();
    }
    cancelDragging() {
        this.state.dropVariant = null;
        this.stopDragging();
    }
    stopDragging() {
        this.unhightlightDraggingLines();
        this.hideDropZone();
        this.applyChanges();
        this.state = null;
    }
    applyChanges() {
        if (!this.state.dropVariant) {
            return;
        }
        const { state } = this;
        const { dropVariant, editor, root, list } = state;
        const newRoot = this.parser.parse(editor, root.getContentStart());
        if (!isSameRoots(root, newRoot)) {
            new obsidian.Notice(`The item cannot be moved. The page content changed during the move.`, 5000);
            return;
        }
        this.operationPerformer.eval(root, new MoveListToDifferentPosition(root, list, dropVariant.placeToMove, dropVariant.whereToMove, this.obisidian.getDefaultIndentChars()), editor);
    }
    highlightDraggingLines() {
        const { state } = this;
        const { list, editor, view } = state;
        const lines = [];
        const fromLine = list.getFirstLineContentStart().line;
        const tillLine = list.getContentEndIncludingChildren().line;
        for (let i = fromLine; i <= tillLine; i++) {
            lines.push(editor.posToOffset({ line: i, ch: 0 }));
        }
        view.dispatch({
            effects: [dndStarted.of(lines)],
        });
        document.body.classList.add("outliner-plugin-dragging");
    }
    unhightlightDraggingLines() {
        document.body.classList.remove("outliner-plugin-dragging");
        this.state.view.dispatch({
            effects: [dndEnded.of()],
        });
    }
    drawDropZone() {
        const { state } = this;
        const { view, editor, dropVariant } = state;
        const newParent = dropVariant.whereToMove === "inside"
            ? dropVariant.placeToMove
            : dropVariant.placeToMove.getParent();
        const newParentIsRootList = !newParent.getParent();
        {
            const width = Math.round(view.contentDOM.offsetWidth -
                (dropVariant.left - this.state.leftPadding));
            this.dropZone.style.display = "block";
            this.dropZone.style.top = dropVariant.top + "px";
            this.dropZone.style.left = dropVariant.left + "px";
            this.dropZone.style.width = width + "px";
        }
        {
            const level = newParent.getLevel();
            const indentWidth = this.state.tabWidth;
            const width = indentWidth * level;
            const dashPadding = 3;
            const dashWidth = indentWidth - dashPadding;
            const color = getComputedStyle(document.body).getPropertyValue("--color-accent");
            this.dropZonePadding.style.width = `${width}px`;
            this.dropZonePadding.style.marginLeft = `-${width}px`;
            this.dropZonePadding.style.backgroundImage = `url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20${width}%204%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cline%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%22${width}%22%20y2%3D%220%22%20stroke%3D%22${color}%22%20stroke-width%3D%228%22%20stroke-dasharray%3D%22${dashWidth}%20${dashPadding}%22%2F%3E%3C%2Fsvg%3E')`;
        }
        this.state.view.dispatch({
            effects: [
                dndMoved.of(newParentIsRootList
                    ? null
                    : editor.posToOffset({
                        line: newParent.getFirstLineContentStart().line,
                        ch: 0,
                    })),
            ],
        });
    }
    hideDropZone() {
        this.dropZone.style.display = "none";
    }
}
class DragAndDropState {
    constructor(view, editor, root, list) {
        this.view = view;
        this.editor = editor;
        this.root = root;
        this.list = list;
        this.dropVariants = new Map();
        this.dropVariant = null;
        this.leftPadding = 0;
        this.tabWidth = 0;
        this.collectDropVariants();
        this.calculateLeftPadding();
        this.calculateTabWidth();
    }
    getDropVariants() {
        return Array.from(this.dropVariants.values());
    }
    hasDropVariants() {
        return this.dropVariants.size > 0;
    }
    calculateNearestDropVariant(x, y) {
        const { view, editor } = this;
        const dropVariants = this.getDropVariants();
        const possibleDropVariants = [];
        for (const v of dropVariants) {
            const { placeToMove } = v;
            const positionAfterList = v.whereToMove === "after" || v.whereToMove === "inside";
            const line = positionAfterList
                ? placeToMove.getContentEndIncludingChildren().line
                : placeToMove.getFirstLineContentStart().line;
            const linePos = editor.posToOffset({
                line,
                ch: 0,
            });
            const coords = view.coordsAtPos(linePos, -1);
            if (!coords) {
                continue;
            }
            v.left = this.leftPadding + (v.level - 1) * this.tabWidth;
            v.top = coords.top;
            if (positionAfterList) {
                v.top += view.lineBlockAt(linePos).height;
            }
            // Better vertical alignment
            v.top -= 8;
            possibleDropVariants.push(v);
        }
        const nearestLineTop = possibleDropVariants
            .sort((a, b) => Math.abs(y - a.top) - Math.abs(y - b.top))
            .first().top;
        const variansOnNearestLine = possibleDropVariants.filter((v) => Math.abs(v.top - nearestLineTop) <= 4);
        this.dropVariant = variansOnNearestLine
            .sort((a, b) => Math.abs(x - a.left) - Math.abs(x - b.left))
            .first();
    }
    addDropVariant(v) {
        this.dropVariants.set(`${v.line} ${v.level}`, v);
    }
    collectDropVariants() {
        const visit = (lists) => {
            for (const placeToMove of lists) {
                const lineBefore = placeToMove.getFirstLineContentStart().line;
                const lineAfter = placeToMove.getContentEndIncludingChildren().line + 1;
                const level = placeToMove.getLevel();
                this.addDropVariant({
                    line: lineBefore,
                    level,
                    left: 0,
                    top: 0,
                    placeToMove,
                    whereToMove: "before",
                });
                this.addDropVariant({
                    line: lineAfter,
                    level,
                    left: 0,
                    top: 0,
                    placeToMove,
                    whereToMove: "after",
                });
                if (placeToMove === this.list) {
                    continue;
                }
                if (placeToMove.isEmpty()) {
                    this.addDropVariant({
                        line: lineAfter,
                        level: level + 1,
                        left: 0,
                        top: 0,
                        placeToMove,
                        whereToMove: "inside",
                    });
                }
                else {
                    visit(placeToMove.getChildren());
                }
            }
        };
        visit(this.root.getChildren());
    }
    calculateLeftPadding() {
        const cmLine = this.view.dom.querySelector("div.cm-line");
        this.leftPadding = cmLine.getBoundingClientRect().left;
    }
    calculateTabWidth() {
        const { view } = this;
        const indentDom = view.dom.querySelector(".cm-indent");
        if (indentDom) {
            this.tabWidth = indentDom.offsetWidth;
            return;
        }
        const singleIndent = language.indentString(view.state, language.getIndentUnit(view.state));
        for (let i = 1; i <= view.state.doc.lines; i++) {
            const line = view.state.doc.line(i);
            if (line.text.startsWith(singleIndent)) {
                const a = view.coordsAtPos(line.from, -1);
                if (!a) {
                    continue;
                }
                const b = view.coordsAtPos(line.from + singleIndent.length, -1);
                if (!b) {
                    continue;
                }
                this.tabWidth = b.left - a.left;
                return;
            }
        }
        this.tabWidth = view.defaultCharacterWidth * language.getIndentUnit(view.state);
    }
}
const dndStarted = state.StateEffect.define({
    map: (lines, change) => lines.map((l) => change.mapPos(l)),
});
const dndMoved = state.StateEffect.define({
    map: (line, change) => (line !== null ? change.mapPos(line) : line),
});
const dndEnded = state.StateEffect.define();
const draggingLineDecoration = view.Decoration.line({
    class: "outliner-plugin-dragging-line",
});
const droppingLineDecoration = view.Decoration.line({
    class: "outliner-plugin-dropping-line",
});
const draggingLinesStateField = state.StateField.define({
    create: () => view.Decoration.none,
    update: (dndState, tr) => {
        dndState = dndState.map(tr.changes);
        for (const e of tr.effects) {
            if (e.is(dndStarted)) {
                dndState = dndState.update({
                    add: e.value.map((l) => draggingLineDecoration.range(l, l)),
                });
            }
            if (e.is(dndEnded)) {
                dndState = view.Decoration.none;
            }
        }
        return dndState;
    },
    provide: (f) => view.EditorView.decorations.from(f),
});
const droppingLinesStateField = state.StateField.define({
    create: () => view.Decoration.none,
    update: (dndDroppingState, tr) => {
        dndDroppingState = dndDroppingState.map(tr.changes);
        for (const e of tr.effects) {
            if (e.is(dndMoved)) {
                dndDroppingState =
                    e.value === null
                        ? view.Decoration.none
                        : view.Decoration.set(droppingLineDecoration.range(e.value, e.value));
            }
            if (e.is(dndEnded)) {
                dndDroppingState = view.Decoration.none;
            }
        }
        return dndDroppingState;
    },
    provide: (f) => view.EditorView.decorations.from(f),
});
function getEditorViewFromHTMLElement(e) {
    while (e && !e.classList.contains("cm-editor")) {
        e = e.parentElement;
    }
    if (!e) {
        return null;
    }
    return view.EditorView.findFromDOM(e);
}
function isClickOnBullet(e) {
    let el = e.target;
    while (el) {
        if (el.classList.contains("cm-formatting-list") ||
            el.classList.contains("cm-fold-indicator") ||
            el.classList.contains("task-list-item-checkbox")) {
            return true;
        }
        el = el.parentElement;
    }
    return false;
}
function isSameRoots(a, b) {
    const [aStart, aEnd] = a.getContentRange();
    const [bStart, bEnd] = b.getContentRange();
    if (cmpPos(aStart, bStart) !== 0 || cmpPos(aEnd, bEnd) !== 0) {
        return false;
    }
    return a.print() === b.print();
}
function isFeatureSupported() {
    return obsidian.Platform.isDesktop;
}

class KeepCursorOutsideFoldedLines {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        if (!list.isFolded()) {
            return;
        }
        const foldRoot = list.getTopFoldRoot();
        const firstLineEnd = foldRoot.getLinesInfo()[0].to;
        if (cursor.line > firstLineEnd.line) {
            this.updated = true;
            this.stopPropagation = true;
            root.replaceCursor(firstLineEnd);
        }
    }
}

class KeepCursorWithinListContent {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        const contentStart = list.getFirstLineContentStartAfterCheckbox();
        const linePrefix = contentStart.line === cursor.line
            ? contentStart.ch
            : list.getNotesIndent().length;
        if (cursor.ch < linePrefix) {
            this.updated = true;
            this.stopPropagation = true;
            root.replaceCursor({
                line: cursor.line,
                ch: linePrefix,
            });
        }
    }
}

class EditorSelectionsBehaviourOverride {
    constructor(plugin, settings, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.transactionExtender = (tr) => {
            if (this.settings.keepCursorWithinContent === "never" || !tr.selection) {
                return null;
            }
            const editor = getEditorFromState(tr.startState);
            setTimeout(() => {
                this.handleSelectionsChanges(editor);
            }, 0);
            return null;
        };
        this.handleSelectionsChanges = (editor) => {
            const root = this.parser.parse(editor);
            if (!root) {
                return;
            }
            {
                const { shouldStopPropagation } = this.operationPerformer.eval(root, new KeepCursorOutsideFoldedLines(root), editor);
                if (shouldStopPropagation) {
                    return;
                }
            }
            this.operationPerformer.eval(root, new KeepCursorWithinListContent(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.EditorState.transactionExtender.of(this.transactionExtender));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const checkboxRe = `\\[[^\\[\\]]\\][ \t]`;

function isEmptyLineOrEmptyCheckbox(line) {
    return line === "" || line === "[ ] ";
}

class CreateNewItem {
    constructor(root, defaultIndentChars, getZoomRange, after = true) {
        this.root = root;
        this.defaultIndentChars = defaultIndentChars;
        this.getZoomRange = getZoomRange;
        this.after = after;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleSelection()) {
            return;
        }
        const selection = root.getSelection();
        if (!selection || selection.anchor.line !== selection.head.line) {
            return;
        }
        const list = root.getListUnderCursor();
        const lines = list.getLinesInfo();
        if (lines.length === 1 && isEmptyLineOrEmptyCheckbox(lines[0].text)) {
            return;
        }
        const cursor = root.getCursor();
        const lineUnderCursor = lines.find((l) => l.from.line === cursor.line);
        if (cursor.ch < lineUnderCursor.from.ch) {
            return;
        }
        const { oldLines, newLines } = lines.reduce((acc, line) => {
            if (cursor.line > line.from.line) {
                acc.oldLines.push(line.text);
            }
            else if (cursor.line === line.from.line) {
                const left = line.text.slice(0, selection.from - line.from.ch);
                const right = line.text.slice(selection.to - line.from.ch);
                acc.oldLines.push(left);
                acc.newLines.push(right);
            }
            else if (cursor.line < line.from.line) {
                acc.newLines.push(line.text);
            }
            return acc;
        }, {
            oldLines: [],
            newLines: [],
        });
        const codeBlockBacticks = oldLines.join("\n").split("```").length - 1;
        const isInsideCodeblock = codeBlockBacticks > 0 && codeBlockBacticks % 2 !== 0;
        if (isInsideCodeblock) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const zoomRange = this.getZoomRange.getZoomRange();
        const listIsZoomingRoot = Boolean(zoomRange &&
            list.getFirstLineContentStart().line >= zoomRange.from.line &&
            list.getLastLineContentEnd().line <= zoomRange.from.line);
        const hasChildren = !list.isEmpty();
        const childIsFolded = list.isFoldRoot();
        const endPos = list.getLastLineContentEnd();
        const endOfLine = cursor.line === endPos.line && cursor.ch === endPos.ch;
        const onChildLevel = listIsZoomingRoot || (hasChildren && !childIsFolded && endOfLine);
        const indent = onChildLevel
            ? hasChildren
                ? list.getChildren()[0].getFirstLineIndent()
                : list.getFirstLineIndent() + this.defaultIndentChars
            : list.getFirstLineIndent();
        const bullet = onChildLevel && hasChildren
            ? list.getChildren()[0].getBullet()
            : list.getBullet();
        const spaceAfterBullet = onChildLevel && hasChildren
            ? list.getChildren()[0].getSpaceAfterBullet()
            : list.getSpaceAfterBullet();
        const prefix = oldLines[0].match(checkboxRe) ? "[ ] " : "";
        const newList = new List(list.getRoot(), indent, bullet, prefix, spaceAfterBullet, prefix + newLines.shift(), false);
        if (newLines.length > 0) {
            newList.setNotesIndent(list.getNotesIndent());
            for (const line of newLines) {
                newList.addLine(line);
            }
        }
        if (onChildLevel) {
            list.addBeforeAll(newList);
        }
        else {
            if (!childIsFolded || !endOfLine) {
                const children = list.getChildren();
                for (const child of children) {
                    list.removeChild(child);
                    newList.addAfterAll(child);
                }
            }
            if (this.after) {
                list.getParent().addAfter(list, newList);
            }
            else {
                list.getParent().addBefore(list, newList);
            }
        }
        list.replaceLines(oldLines);
        const newListStart = newList.getFirstLineContentStart();
        root.replaceCursor({
            line: newListStart.line,
            ch: newListStart.ch + prefix.length,
        });
        recalculateNumericBullets(root);
    }
}

class OutdentList {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        if (!grandParent) {
            return;
        }
        this.updated = true;
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        const indentRmFrom = parent.getFirstLineIndent().length;
        const indentRmTill = list.getFirstLineIndent().length;
        parent.removeChild(list);
        grandParent.addAfter(parent, list);
        list.unindentContent(indentRmFrom, indentRmTill);
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const chDiff = indentRmTill - indentRmFrom;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch - chDiff,
        });
        recalculateNumericBullets(root);
    }
}

class OutdentListIfItsEmpty {
    constructor(root) {
        this.root = root;
        this.outdentList = new OutdentList(root);
    }
    shouldStopPropagation() {
        return this.outdentList.shouldStopPropagation();
    }
    shouldUpdate() {
        return this.outdentList.shouldUpdate();
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const lines = list.getLines();
        if (lines.length > 1 ||
            !isEmptyLineOrEmptyCheckbox(lines[0]) ||
            list.getLevel() === 1) {
            return;
        }
        this.outdentList.perform();
    }
}

class EnterBehaviourOverride {
    constructor(plugin, settings, imeDetector, obsidianSettings, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return this.settings.overrideEnterBehaviour && !this.imeDetector.isOpened();
        };
        this.run = (editor) => {
            const root = this.parser.parse(editor);
            if (!root) {
                return {
                    shouldUpdate: false,
                    shouldStopPropagation: false,
                };
            }
            {
                const res = this.operationPerformer.eval(root, new OutdentListIfItsEmpty(root), editor);
                if (res.shouldStopPropagation) {
                    return res;
                }
            }
            {
                const defaultIndentChars = this.obsidianSettings.getDefaultIndentChars();
                const zoomRange = editor.getZoomRange();
                const getZoomRange = {
                    getZoomRange: () => zoomRange,
                };
                const res = this.operationPerformer.eval(root, new CreateNewItem(root, defaultIndentChars, getZoomRange), editor);
                if (res.shouldUpdate && zoomRange) {
                    editor.tryRefreshZoom(zoomRange.from.line);
                }
                return res;
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "Enter",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

function createEditorCallback(cb) {
    return (editor) => {
        const myEditor = new MyEditor(editor);
        const shouldStopPropagation = cb(myEditor);
        if (!shouldStopPropagation &&
            window.event &&
            window.event.type === "keydown") {
            myEditor.triggerOnKeyDown(window.event);
        }
    };
}

class ListsFoldingCommands {
    constructor(plugin, obsidianSettings) {
        this.plugin = plugin;
        this.obsidianSettings = obsidianSettings;
        this.fold = (editor) => {
            return this.setFold(editor, "fold");
        };
        this.unfold = (editor) => {
            return this.setFold(editor, "unfold");
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "fold",
                icon: "chevrons-down-up",
                name: "Fold the list",
                editorCallback: createEditorCallback(this.fold),
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: "ArrowUp",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "unfold",
                icon: "chevrons-up-down",
                name: "Unfold the list",
                editorCallback: createEditorCallback(this.unfold),
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: "ArrowDown",
                    },
                ],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    setFold(editor, type) {
        if (!this.obsidianSettings.getFoldSettings().foldIndent) {
            new obsidian.Notice(`Unable to ${type} because folding is disabled. Please enable "Fold indent" in Obsidian settings.`, 5000);
            return true;
        }
        const cursor = editor.getCursor();
        if (type === "fold") {
            editor.fold(cursor.line);
        }
        else {
            editor.unfold(cursor.line);
        }
        return true;
    }
}

class IndentList {
    constructor(root, defaultIndentChars) {
        this.root = root;
        this.defaultIndentChars = defaultIndentChars;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const prev = parent.getPrevSiblingOf(list);
        if (!prev) {
            return;
        }
        this.updated = true;
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        const indentPos = list.getFirstLineIndent().length;
        let indentChars = "";
        if (indentChars === "" && !prev.isEmpty()) {
            indentChars = prev
                .getChildren()[0]
                .getFirstLineIndent()
                .slice(prev.getFirstLineIndent().length);
        }
        if (indentChars === "") {
            indentChars = list
                .getFirstLineIndent()
                .slice(parent.getFirstLineIndent().length);
        }
        if (indentChars === "" && !list.isEmpty()) {
            indentChars = list.getChildren()[0].getFirstLineIndent();
        }
        if (indentChars === "") {
            indentChars = this.defaultIndentChars;
        }
        parent.removeChild(list);
        prev.addAfterAll(list);
        list.indentContent(indentPos, indentChars);
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch + indentChars.length,
        });
        recalculateNumericBullets(root);
    }
}

class MoveListDown {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const next = parent.getNextSiblingOf(list);
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        if (!next && grandParent) {
            const newParent = grandParent.getNextSiblingOf(parent);
            if (newParent) {
                this.updated = true;
                parent.removeChild(list);
                newParent.addBeforeAll(list);
            }
        }
        else if (next) {
            this.updated = true;
            parent.removeChild(list);
            parent.addAfter(next, list);
        }
        if (!this.updated) {
            return;
        }
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch,
        });
        recalculateNumericBullets(root);
    }
}

class MoveListUp {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const prev = parent.getPrevSiblingOf(list);
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        if (!prev && grandParent) {
            const newParent = grandParent.getPrevSiblingOf(parent);
            if (newParent) {
                this.updated = true;
                parent.removeChild(list);
                newParent.addAfterAll(list);
            }
        }
        else if (prev) {
            this.updated = true;
            parent.removeChild(list);
            parent.addBefore(prev, list);
        }
        if (!this.updated) {
            return;
        }
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch,
        });
        recalculateNumericBullets(root);
    }
}

class ListsMovementCommands {
    constructor(plugin, obsidianSettings, operationPerformer) {
        this.plugin = plugin;
        this.obsidianSettings = obsidianSettings;
        this.operationPerformer = operationPerformer;
        this.moveListDown = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new MoveListDown(root), editor);
            return shouldStopPropagation;
        };
        this.moveListUp = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new MoveListUp(root), editor);
            return shouldStopPropagation;
        };
        this.indentList = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new IndentList(root, this.obsidianSettings.getDefaultIndentChars()), editor);
            return shouldStopPropagation;
        };
        this.outdentList = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new OutdentList(root), editor);
            return shouldStopPropagation;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "move-list-item-up",
                icon: "arrow-up",
                name: "Move list and sublists up",
                editorCallback: createEditorCallback(this.moveListUp),
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift"],
                        key: "ArrowUp",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "move-list-item-down",
                icon: "arrow-down",
                name: "Move list and sublists down",
                editorCallback: createEditorCallback(this.moveListDown),
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift"],
                        key: "ArrowDown",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "indent-list",
                icon: "indent",
                name: "Indent the list and sublists",
                editorCallback: createEditorCallback(this.indentList),
                hotkeys: [],
            });
            this.plugin.addCommand({
                id: "outdent-list",
                icon: "outdent",
                name: "Outdent the list and sublists",
                editorCallback: createEditorCallback(this.outdentList),
                hotkeys: [],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class DeleteTillCurrentLineContentStart {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => l.from.line === cursor.line);
        lines[lineNo].text = lines[lineNo].text.slice(cursor.ch - lines[lineNo].from.ch);
        list.replaceLines(lines.map((l) => l.text));
        root.replaceCursor(lines[lineNo].from);
    }
}

class MetaBackspaceBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new DeleteTillCurrentLineContentStart(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    mac: "m-Backspace",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class ObsidianOutlinerPluginSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin, settings) {
        super(app, plugin);
        this.settings = settings;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName("Stick the cursor to the content")
            .setDesc("Don't let the cursor move to the bullet position.")
            .addDropdown((dropdown) => {
            dropdown
                .addOptions({
                never: "Never",
                "bullet-only": "Stick cursor out of bullets",
                "bullet-and-checkbox": "Stick cursor out of bullets and checkboxes",
            })
                .setValue(this.settings.keepCursorWithinContent)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.keepCursorWithinContent = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Tab key")
            .setDesc("Make Tab and Shift-Tab behave the same as other outliners.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideTabBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideTabBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Enter key")
            .setDesc("Make the Enter key behave the same as other outliners.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideEnterBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideEnterBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Vim-mode o/O inserts bullets")
            .setDesc("Create a bullet when pressing o or O in Vim mode.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideVimOBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideVimOBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Ctrl+A or Cmd+A behavior")
            .setDesc("Press the hotkey once to select the current list item. Press the hotkey twice to select the entire list.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideSelectAllBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideSelectAllBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Improve the style of your lists")
            .setDesc("Styles are only compatible with built-in Obsidian themes and may not be compatible with other themes.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.betterListsStyles)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.betterListsStyles = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Draw vertical indentation lines")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.verticalLines).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.verticalLines = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Vertical indentation line click action")
            .addDropdown((dropdown) => {
            dropdown
                .addOptions({
                none: "None",
                "zoom-in": "Zoom In",
                "toggle-folding": "Toggle Folding",
            })
                .setValue(this.settings.verticalLinesAction)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.verticalLinesAction = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl).setName("Drag-and-Drop").addToggle((toggle) => {
            toggle.setValue(this.settings.dragAndDrop).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.dragAndDrop = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Debug mode")
            .setDesc("Open DevTools (Command+Option+I or Control+Shift+I) to copy the debug logs.")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.debug).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.debug = value;
                yield this.settings.save();
            }));
        });
    }
}
class SettingsTab {
    constructor(plugin, settings) {
        this.plugin = plugin;
        this.settings = settings;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addSettingTab(new ObsidianOutlinerPluginSettingTab(this.plugin.app, this.plugin, this.settings));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class ShiftTabBehaviourOverride {
    constructor(plugin, imeDetector, settings, operationPerformer) {
        this.plugin = plugin;
        this.imeDetector = imeDetector;
        this.settings = settings;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return this.settings.overrideTabBehaviour && !this.imeDetector.isOpened();
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new OutdentList(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "s-Tab",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class SystemInfoModal extends obsidian.Modal {
    constructor(app, settings) {
        super(app);
        this.settings = settings;
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            this.titleEl.setText("System Information");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const app = this.app;
            const data = {
                process: {
                    arch: process.arch,
                    platform: process.platform,
                },
                app: {
                    internalPlugins: {
                        config: app.internalPlugins.config,
                    },
                    isMobile: app.isMobile,
                    plugins: {
                        enabledPlugins: Array.from(app.plugins.enabledPlugins),
                        manifests: Object.keys(app.plugins.manifests).reduce((acc, key) => {
                            acc[key] = {
                                version: app.plugins.manifests[key].version,
                            };
                            return acc;
                        }, {}),
                    },
                    vault: {
                        config: app.vault.config,
                    },
                },
                plugin: {
                    settings: { values: this.settings.getValues() },
                },
            };
            const text = JSON.stringify(data, null, 2);
            const pre = this.contentEl.createEl("pre");
            pre.setText(text);
            pre.setCssStyles({
                overflow: "scroll",
                maxHeight: "300px",
            });
            const button = this.contentEl.createEl("button");
            button.setText("Copy and Close");
            button.onClickEvent(() => {
                navigator.clipboard.writeText("```json\n" + text + "\n```");
                this.close();
            });
        });
    }
}
class SystemInfo {
    constructor(plugin, settings) {
        this.plugin = plugin;
        this.settings = settings;
        this.callback = () => {
            const modal = new SystemInfoModal(this.plugin.app, this.settings);
            modal.open();
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "system-info",
                name: "Show System Info",
                callback: this.callback,
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift", "Alt"],
                        key: "I",
                    },
                ],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class TabBehaviourOverride {
    constructor(plugin, imeDetector, obsidianSettings, settings, operationPerformer) {
        this.plugin = plugin;
        this.imeDetector = imeDetector;
        this.obsidianSettings = obsidianSettings;
        this.settings = settings;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return this.settings.overrideTabBehaviour && !this.imeDetector.isOpened();
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new IndentList(root, this.obsidianSettings.getDefaultIndentChars()), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "Tab",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const VERTICAL_LINES_BODY_CLASS = "outliner-plugin-vertical-lines";
class VerticalLinesPluginValue {
    constructor(settings, obsidianSettings, parser, view) {
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.view = view;
        this.lineElements = [];
        this.waitForEditor = () => {
            const editor = getEditorFromState(this.view.state);
            if (!editor) {
                setTimeout(this.waitForEditor, 0);
                return;
            }
            this.editor = editor;
            this.scheduleRecalculate();
        };
        this.onScroll = (e) => {
            const { scrollLeft, scrollTop } = e.target;
            this.scroller.scrollTo(scrollLeft, scrollTop);
        };
        this.scheduleRecalculate = () => {
            clearTimeout(this.scheduled);
            this.scheduled = setTimeout(this.calculate, 0);
        };
        this.calculate = () => {
            this.lines = [];
            if (this.settings.verticalLines &&
                this.obsidianSettings.isDefaultThemeEnabled() &&
                this.view.viewportLineBlocks.length > 0 &&
                this.view.visibleRanges.length > 0) {
                const fromLine = this.editor.offsetToPos(this.view.viewport.from).line;
                const toLine = this.editor.offsetToPos(this.view.viewport.to).line;
                const lists = this.parser.parseRange(this.editor, fromLine, toLine);
                for (const list of lists) {
                    this.lastLine = list.getContentEnd().line;
                    for (const c of list.getChildren()) {
                        this.recursive(c);
                    }
                }
                this.lines.sort((a, b) => a.top === b.top ? a.left - b.left : a.top - b.top);
            }
            this.updateDom();
        };
        this.onClick = (e) => {
            e.preventDefault();
            const line = this.lines[Number(e.target.dataset.index)];
            switch (this.settings.verticalLinesAction) {
                case "zoom-in":
                    this.zoomIn(line);
                    break;
                case "toggle-folding":
                    this.toggleFolding(line);
                    break;
            }
        };
        this.view.scrollDOM.addEventListener("scroll", this.onScroll);
        this.settings.onChange(this.scheduleRecalculate);
        this.prepareDom();
        this.waitForEditor();
    }
    prepareDom() {
        this.contentContainer = document.createElement("div");
        this.contentContainer.classList.add("outliner-plugin-list-lines-content-container");
        this.scroller = document.createElement("div");
        this.scroller.classList.add("outliner-plugin-list-lines-scroller");
        this.scroller.appendChild(this.contentContainer);
        this.view.dom.appendChild(this.scroller);
    }
    update(update) {
        if (update.docChanged ||
            update.viewportChanged ||
            update.geometryChanged ||
            update.transactions.some((tr) => tr.reconfigured)) {
            this.scheduleRecalculate();
        }
    }
    getNextSibling(list) {
        let listTmp = list;
        let p = listTmp.getParent();
        while (p) {
            const nextSibling = p.getNextSiblingOf(listTmp);
            if (nextSibling) {
                return nextSibling;
            }
            listTmp = p;
            p = listTmp.getParent();
        }
        return null;
    }
    recursive(list, parentCtx = {}) {
        const children = list.getChildren();
        if (children.length === 0) {
            return;
        }
        const fromOffset = this.editor.posToOffset({
            line: list.getFirstLineContentStart().line,
            ch: list.getFirstLineIndent().length,
        });
        const nextSibling = this.getNextSibling(list);
        const tillOffset = this.editor.posToOffset({
            line: nextSibling
                ? nextSibling.getFirstLineContentStart().line - 1
                : this.lastLine,
            ch: 0,
        });
        let visibleFrom = this.view.visibleRanges[0].from;
        let visibleTo = this.view.visibleRanges[this.view.visibleRanges.length - 1].to;
        const zoomRange = this.editor.getZoomRange();
        if (zoomRange) {
            visibleFrom = Math.max(visibleFrom, this.editor.posToOffset(zoomRange.from));
            visibleTo = Math.min(visibleTo, this.editor.posToOffset(zoomRange.to));
        }
        if (fromOffset > visibleTo || tillOffset < visibleFrom) {
            return;
        }
        const coords = this.view.coordsAtPos(fromOffset, 1);
        if (parentCtx.rootLeft === undefined) {
            parentCtx.rootLeft = coords.left;
        }
        const left = Math.floor(coords.right - parentCtx.rootLeft);
        const top = visibleFrom > 0 && fromOffset < visibleFrom
            ? -20
            : this.view.lineBlockAt(fromOffset).top;
        const bottom = tillOffset > visibleTo
            ? this.view.lineBlockAt(visibleTo - 1).bottom
            : this.view.lineBlockAt(tillOffset).bottom;
        const height = bottom - top;
        if (height > 0 && !list.isFolded()) {
            const nextSibling = list.getParent().getNextSiblingOf(list);
            const hasNextSibling = !!nextSibling &&
                this.editor.posToOffset(nextSibling.getFirstLineContentStart()) <=
                    visibleTo;
            this.lines.push({
                top,
                left,
                height: `calc(${height}px ${hasNextSibling ? "- 1.5em" : "- 2em"})`,
                list,
            });
        }
        for (const child of children) {
            if (!child.isEmpty()) {
                this.recursive(child, parentCtx);
            }
        }
    }
    zoomIn(line) {
        const editor = getEditorFromState(this.view.state);
        editor.zoomIn(line.list.getFirstLineContentStart().line);
    }
    toggleFolding(line) {
        const { list } = line;
        if (list.isEmpty()) {
            return;
        }
        let needToUnfold = true;
        const linesToToggle = [];
        for (const c of list.getChildren()) {
            if (c.isEmpty()) {
                continue;
            }
            if (!c.isFolded()) {
                needToUnfold = false;
            }
            linesToToggle.push(c.getFirstLineContentStart().line);
        }
        const editor = getEditorFromState(this.view.state);
        for (const l of linesToToggle) {
            if (needToUnfold) {
                editor.unfold(l);
            }
            else {
                editor.fold(l);
            }
        }
    }
    updateDom() {
        const cmScroll = this.view.scrollDOM;
        const cmContent = this.view.contentDOM;
        const cmContentContainer = cmContent.parentElement;
        const cmSizer = cmContentContainer.parentElement;
        /**
         * Obsidian can add additional elements into Content Manager.
         * The most obvious case is the 'embedded-backlinks' core plugin that adds a menu inside a Content Manager.
         * We must take heights of all of these elements into account
         * to be able to calculate the correct size of lines' container.
         */
        let cmSizerChildrenSumHeight = 0;
        for (let i = 0; i < cmSizer.children.length; i++) {
            cmSizerChildrenSumHeight += cmSizer.children[i].clientHeight;
        }
        this.scroller.style.top = cmScroll.offsetTop + "px";
        this.contentContainer.style.height = cmSizerChildrenSumHeight + "px";
        this.contentContainer.style.marginLeft =
            cmContentContainer.offsetLeft + "px";
        this.contentContainer.style.marginTop =
            cmContent.firstElementChild.offsetTop - 24 + "px";
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lineElements.length === i) {
                const e = document.createElement("div");
                e.classList.add("outliner-plugin-list-line");
                e.dataset.index = String(i);
                e.addEventListener("mousedown", this.onClick);
                this.contentContainer.appendChild(e);
                this.lineElements.push(e);
            }
            const l = this.lines[i];
            const e = this.lineElements[i];
            e.style.top = l.top + "px";
            e.style.left = l.left + "px";
            e.style.height = l.height;
            e.style.display = "block";
        }
        for (let i = this.lines.length; i < this.lineElements.length; i++) {
            const e = this.lineElements[i];
            e.style.top = "0px";
            e.style.left = "0px";
            e.style.height = "0px";
            e.style.display = "none";
        }
    }
    destroy() {
        this.settings.removeCallback(this.scheduleRecalculate);
        this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
        this.view.dom.removeChild(this.scroller);
        clearTimeout(this.scheduled);
    }
}
class VerticalLines {
    constructor(plugin, settings, obsidianSettings, parser) {
        this.plugin = plugin;
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.updateBodyClass = () => {
            const shouldExists = this.obsidianSettings.isDefaultThemeEnabled() &&
                this.settings.verticalLines;
            const exists = document.body.classList.contains(VERTICAL_LINES_BODY_CLASS);
            if (shouldExists && !exists) {
                document.body.classList.add(VERTICAL_LINES_BODY_CLASS);
            }
            if (!shouldExists && exists) {
                document.body.classList.remove(VERTICAL_LINES_BODY_CLASS);
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.updateBodyClass();
            this.updateBodyClassInterval = window.setInterval(() => {
                this.updateBodyClass();
            }, 1000);
            this.plugin.registerEditorExtension(view.ViewPlugin.define((view) => new VerticalLinesPluginValue(this.settings, this.obsidianSettings, this.parser, view)));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.updateBodyClassInterval);
            document.body.classList.remove(VERTICAL_LINES_BODY_CLASS);
        });
    }
}

class VimOBehaviourOverride {
    constructor(plugin, settings, obsidianSettings, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.inited = false;
        this.handleSettingsChange = () => {
            if (this.inited || !this.settings.overrideVimOBehaviour) {
                return;
            }
            if (!window.CodeMirrorAdapter || !window.CodeMirrorAdapter.Vim) {
                console.error("Vim adapter not found");
                return;
            }
            const vim = window.CodeMirrorAdapter.Vim;
            const plugin = this.plugin;
            const parser = this.parser;
            const obsidianSettings = this.obsidianSettings;
            const operationPerformer = this.operationPerformer;
            const settings = this.settings;
            vim.defineAction("insertLineAfterBullet", (cm, operatorArgs) => {
                const view = plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                const obsidianEditor = view === null || view === void 0 ? void 0 : view.editor;
                if (!obsidianEditor) {
                    vim.enterInsertMode(cm);
                    return;
                }
                this.moveCursorToLineEnd(obsidianEditor);
                if (!settings.overrideVimOBehaviour) {
                    this.openPlainLine(obsidianEditor, operatorArgs.after);
                    vim.enterInsertMode(cm);
                    return;
                }
                const editor = new MyEditor(obsidianEditor);
                const root = parser.parse(editor);
                if (!root) {
                    this.openPlainLine(obsidianEditor, operatorArgs.after);
                    vim.enterInsertMode(cm);
                    return;
                }
                const defaultIndentChars = obsidianSettings.getDefaultIndentChars();
                const zoomRange = editor.getZoomRange();
                const getZoomRange = {
                    getZoomRange: () => zoomRange,
                };
                const res = operationPerformer.eval(root, new CreateNewItem(root, defaultIndentChars, getZoomRange, operatorArgs.after), editor);
                if (res.shouldUpdate && zoomRange) {
                    editor.tryRefreshZoom(zoomRange.from.line);
                }
                // Ensure the editor is always left in insert mode
                vim.enterInsertMode(cm);
            });
            vim.mapCommand("o", "action", "insertLineAfterBullet", {}, {
                isEdit: true,
                context: "normal",
                interlaceInsertRepeat: true,
                actionArgs: { after: true },
            });
            vim.mapCommand("O", "action", "insertLineAfterBullet", {}, {
                isEdit: true,
                context: "normal",
                interlaceInsertRepeat: true,
                actionArgs: { after: false },
            });
            this.inited = true;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings.onChange(this.handleSettingsChange);
            this.handleSettingsChange();
        });
    }
    moveCursorToLineEnd(editor) {
        const cursor = editor.getCursor();
        editor.setCursor({
            line: cursor.line,
            ch: editor.getLine(cursor.line).length,
        });
    }
    getLineIndent(line) {
        return line.match(/^[ \t]*/)[0];
    }
    openPlainLine(editor, after) {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const indent = this.getLineIndent(line);
        if (after) {
            const insertAt = { line: cursor.line, ch: line.length };
            editor.replaceRange(`\n${indent}`, insertAt, insertAt);
            editor.setCursor({ line: cursor.line + 1, ch: indent.length });
        }
        else {
            const insertAt = { line: cursor.line, ch: 0 };
            editor.replaceRange(`${indent}\n`, insertAt, insertAt);
            editor.setCursor({ line: cursor.line, ch: indent.length });
        }
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.inited) {
                return;
            }
            new obsidian.Notice(`To fully unload obsidian-outliner plugin, please restart the app`, 5000);
        });
    }
}

class ChangesApplicator {
    apply(editor, prevRoot, newRoot) {
        const changes = this.calculateChanges(editor, prevRoot, newRoot);
        if (changes) {
            const { replacement, changeFrom, changeTo } = changes;
            const { unfold, fold } = this.calculateFoldingOprations(prevRoot, newRoot, changeFrom, changeTo);
            for (const line of unfold) {
                editor.unfold(line);
            }
            editor.replaceRange(replacement, changeFrom, changeTo);
            for (const line of fold) {
                editor.fold(line);
            }
        }
        editor.setSelections(newRoot.getSelections());
    }
    calculateChanges(editor, prevRoot, newRoot) {
        const rootRange = prevRoot.getContentRange();
        const oldString = editor.getRange(rootRange[0], rootRange[1]);
        const newString = newRoot.print();
        const changeFrom = Object.assign({}, rootRange[0]);
        const changeTo = Object.assign({}, rootRange[1]);
        let oldTmp = oldString;
        let newTmp = newString;
        while (true) {
            const nlIndex = oldTmp.lastIndexOf("\n");
            if (nlIndex < 0) {
                break;
            }
            const oldLine = oldTmp.slice(nlIndex);
            const newLine = newTmp.slice(-oldLine.length);
            if (oldLine !== newLine) {
                break;
            }
            oldTmp = oldTmp.slice(0, -oldLine.length);
            newTmp = newTmp.slice(0, -oldLine.length);
            const nlIndex2 = oldTmp.lastIndexOf("\n");
            changeTo.ch =
                nlIndex2 >= 0 ? oldTmp.length - nlIndex2 - 1 : oldTmp.length;
            changeTo.line--;
        }
        while (true) {
            const nlIndex = oldTmp.indexOf("\n");
            if (nlIndex < 0) {
                break;
            }
            const oldLine = oldTmp.slice(0, nlIndex + 1);
            const newLine = newTmp.slice(0, oldLine.length);
            if (oldLine !== newLine) {
                break;
            }
            changeFrom.line++;
            oldTmp = oldTmp.slice(oldLine.length);
            newTmp = newTmp.slice(oldLine.length);
        }
        if (oldTmp === newTmp) {
            return null;
        }
        return {
            replacement: newTmp,
            changeFrom,
            changeTo,
        };
    }
    calculateFoldingOprations(prevRoot, newRoot, changeFrom, changeTo) {
        const changedRange = [changeFrom, changeTo];
        const prevLists = getAllChildren(prevRoot);
        const newLists = getAllChildren(newRoot);
        const unfold = [];
        const fold = [];
        for (const prevList of prevLists.values()) {
            if (!prevList.isFoldRoot()) {
                continue;
            }
            const newList = newLists.get(prevList.getID());
            if (!newList) {
                continue;
            }
            const prevListRange = [
                prevList.getFirstLineContentStart(),
                prevList.getContentEndIncludingChildren(),
            ];
            if (isRangesIntersects(prevListRange, changedRange)) {
                unfold.push(prevList.getFirstLineContentStart().line);
                fold.push(newList.getFirstLineContentStart().line);
            }
        }
        unfold.sort((a, b) => b - a);
        fold.sort((a, b) => b - a);
        return { unfold, fold };
    }
}
function getAllChildrenReduceFn(acc, child) {
    acc.set(child.getID(), child);
    child.getChildren().reduce(getAllChildrenReduceFn, acc);
    return acc;
}
function getAllChildren(root) {
    return root.getChildren().reduce(getAllChildrenReduceFn, new Map());
}

class IMEDetector {
    constructor() {
        this.composition = false;
        this.onCompositionStart = () => {
            this.composition = true;
        };
        this.onCompositionEnd = () => {
            this.composition = false;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            document.addEventListener("compositionstart", this.onCompositionStart);
            document.addEventListener("compositionend", this.onCompositionEnd);
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            document.removeEventListener("compositionend", this.onCompositionEnd);
            document.removeEventListener("compositionstart", this.onCompositionStart);
        });
    }
    isOpened() {
        return this.composition && obsidian.Platform.isDesktop;
    }
}

class Logger {
    constructor(settings) {
        this.settings = settings;
    }
    log(method, ...args) {
        if (!this.settings.debug) {
            return;
        }
        console.info(method, ...args);
    }
    bind(method) {
        return (...args) => this.log(method, ...args);
    }
}

function getHiddenObsidianConfig(app) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return app.vault.config;
}
class ObsidianSettings {
    constructor(app) {
        this.app = app;
    }
    isLegacyEditorEnabled() {
        const config = Object.assign({ legacyEditor: false }, getHiddenObsidianConfig(this.app));
        return config.legacyEditor;
    }
    isDefaultThemeEnabled() {
        const config = Object.assign({ cssTheme: "" }, getHiddenObsidianConfig(this.app));
        return config.cssTheme === "";
    }
    getTabsSettings() {
        return Object.assign({ useTab: true, tabSize: 4 }, getHiddenObsidianConfig(this.app));
    }
    getFoldSettings() {
        return Object.assign({ foldIndent: true }, getHiddenObsidianConfig(this.app));
    }
    getDefaultIndentChars() {
        const { useTab, tabSize } = this.getTabsSettings();
        return useTab ? "\t" : new Array(tabSize).fill(" ").join("");
    }
}

class OperationPerformer {
    constructor(parser, changesApplicator) {
        this.parser = parser;
        this.changesApplicator = changesApplicator;
    }
    eval(root, op, editor) {
        const prevRoot = root.clone();
        op.perform();
        if (op.shouldUpdate()) {
            this.changesApplicator.apply(editor, prevRoot, root);
        }
        return {
            shouldUpdate: op.shouldUpdate(),
            shouldStopPropagation: op.shouldStopPropagation(),
        };
    }
    perform(cb, editor, cursor = editor.getCursor()) {
        const root = this.parser.parse(editor, cursor);
        if (!root) {
            return { shouldUpdate: false, shouldStopPropagation: false };
        }
        const op = cb(root);
        return this.eval(root, op, editor);
    }
}

const bulletSignRe = `(?:[-*+]|\\d+\\.)`;
const optionalCheckboxRe = `(?:${checkboxRe})?`;
const listItemWithoutSpacesRe = new RegExp(`^${bulletSignRe}( |\t)`);
const listItemRe = new RegExp(`^[ \t]*${bulletSignRe}( |\t)`);
const stringWithSpacesRe = new RegExp(`^[ \t]+`);
const parseListItemRe = new RegExp(`^([ \t]*)(${bulletSignRe})( |\t)(${optionalCheckboxRe})(.*)$`);
class Parser {
    constructor(logger, settings) {
        this.logger = logger;
        this.settings = settings;
    }
    parseRange(editor, fromLine = 0, toLine = editor.lastLine()) {
        const lists = [];
        for (let i = fromLine; i <= toLine; i++) {
            const line = editor.getLine(i);
            if (i === fromLine || this.isListItem(line)) {
                const list = this.parseWithLimits(editor, i, fromLine, toLine);
                if (list) {
                    lists.push(list);
                    i = list.getContentEnd().line;
                }
            }
        }
        return lists;
    }
    parse(editor, cursor = editor.getCursor()) {
        return this.parseWithLimits(editor, cursor.line, 0, editor.lastLine());
    }
    parseWithLimits(editor, parsingStartLine, limitFrom, limitTo) {
        const d = this.logger.bind("parseList");
        const error = (msg) => {
            d(msg);
            return null;
        };
        const line = editor.getLine(parsingStartLine);
        let listLookingPos = null;
        if (this.isListItem(line)) {
            listLookingPos = parsingStartLine;
        }
        else if (this.isLineWithIndent(line)) {
            let listLookingPosSearch = parsingStartLine - 1;
            while (listLookingPosSearch >= 0) {
                const line = editor.getLine(listLookingPosSearch);
                if (this.isListItem(line)) {
                    listLookingPos = listLookingPosSearch;
                    break;
                }
                else if (this.isLineWithIndent(line)) {
                    listLookingPosSearch--;
                }
                else {
                    break;
                }
            }
        }
        if (listLookingPos === null) {
            return null;
        }
        let listStartLine = null;
        let listStartLineLookup = listLookingPos;
        while (listStartLineLookup >= 0) {
            const line = editor.getLine(listStartLineLookup);
            if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
                break;
            }
            if (this.isListItemWithoutSpaces(line)) {
                listStartLine = listStartLineLookup;
                if (listStartLineLookup <= limitFrom) {
                    break;
                }
            }
            listStartLineLookup--;
        }
        if (listStartLine === null) {
            return null;
        }
        let listEndLine = listLookingPos;
        let listEndLineLookup = listLookingPos;
        while (listEndLineLookup <= editor.lastLine()) {
            const line = editor.getLine(listEndLineLookup);
            if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
                break;
            }
            if (!this.isEmptyLine(line)) {
                listEndLine = listEndLineLookup;
            }
            if (listEndLineLookup >= limitTo) {
                listEndLine = limitTo;
                break;
            }
            listEndLineLookup++;
        }
        if (listStartLine > parsingStartLine || listEndLine < parsingStartLine) {
            return null;
        }
        // if the last line contains only spaces and that's incorrect indent, then ignore the last line
        // https://github.com/vslinko/obsidian-outliner/issues/368
        if (listEndLine > listStartLine) {
            const lastLine = editor.getLine(listEndLine);
            if (lastLine.trim().length === 0) {
                const prevLine = editor.getLine(listEndLine - 1);
                const [, prevLineIndent] = /^(\s*)/.exec(prevLine);
                if (!lastLine.startsWith(prevLineIndent)) {
                    listEndLine--;
                }
            }
        }
        const root = new Root({ line: listStartLine, ch: 0 }, { line: listEndLine, ch: editor.getLine(listEndLine).length }, editor.listSelections().map((r) => ({
            anchor: { line: r.anchor.line, ch: r.anchor.ch },
            head: { line: r.head.line, ch: r.head.ch },
        })));
        let currentParent = root.getRootList();
        let currentList = null;
        let currentIndent = "";
        const foldedLines = editor.getAllFoldedLines();
        for (let l = listStartLine; l <= listEndLine; l++) {
            const line = editor.getLine(l);
            const matches = parseListItemRe.exec(line);
            if (matches) {
                const [, indent, bullet, spaceAfterBullet] = matches;
                let [, , , , optionalCheckbox, content] = matches;
                content = optionalCheckbox + content;
                if (this.settings.keepCursorWithinContent !== "bullet-and-checkbox") {
                    optionalCheckbox = "";
                }
                const compareLength = Math.min(currentIndent.length, indent.length);
                const indentSlice = indent.slice(0, compareLength);
                const currentIndentSlice = currentIndent.slice(0, compareLength);
                if (indentSlice !== currentIndentSlice) {
                    const expected = currentIndentSlice
                        .replace(/ /g, "S")
                        .replace(/\t/g, "T");
                    const got = indentSlice.replace(/ /g, "S").replace(/\t/g, "T");
                    return error(`Unable to parse list: expected indent "${expected}", got "${got}"`);
                }
                if (indent.length > currentIndent.length) {
                    currentParent = currentList;
                    currentIndent = indent;
                }
                else if (indent.length < currentIndent.length) {
                    while (currentParent.getFirstLineIndent().length >= indent.length &&
                        currentParent.getParent()) {
                        currentParent = currentParent.getParent();
                    }
                    currentIndent = indent;
                }
                const foldRoot = foldedLines.includes(l);
                currentList = new List(root, indent, bullet, optionalCheckbox, spaceAfterBullet, content, foldRoot);
                currentParent.addAfterAll(currentList);
            }
            else if (this.isLineWithIndent(line)) {
                if (!currentList) {
                    return error(`Unable to parse list: expected list item, got empty line`);
                }
                const indentToCheck = currentList.getNotesIndent() || currentIndent;
                if (line.indexOf(indentToCheck) !== 0) {
                    const expected = indentToCheck.replace(/ /g, "S").replace(/\t/g, "T");
                    const got = line
                        .match(/^[ \t]*/)[0]
                        .replace(/ /g, "S")
                        .replace(/\t/g, "T");
                    return error(`Unable to parse list: expected indent "${expected}", got "${got}"`);
                }
                if (!currentList.getNotesIndent()) {
                    const matches = line.match(/^[ \t]+/);
                    if (!matches || matches[0].length <= currentIndent.length) {
                        if (/^\s+$/.test(line)) {
                            continue;
                        }
                        return error(`Unable to parse list: expected some indent, got no indent`);
                    }
                    currentList.setNotesIndent(matches[0]);
                }
                currentList.addLine(line.slice(currentList.getNotesIndent().length));
            }
            else {
                return error(`Unable to parse list: expected list item or note, got "${line}"`);
            }
        }
        return root;
    }
    isEmptyLine(line) {
        return line.length === 0;
    }
    isLineWithIndent(line) {
        return stringWithSpacesRe.test(line);
    }
    isListItem(line) {
        return listItemRe.test(line);
    }
    isListItemWithoutSpaces(line) {
        return listItemWithoutSpacesRe.test(line);
    }
}

const DEFAULT_SETTINGS = {
    styleLists: true,
    debug: false,
    stickCursor: "bullet-and-checkbox",
    betterEnter: true,
    betterVimO: true,
    betterTab: true,
    selectAll: true,
    listLines: false,
    listLineAction: "toggle-folding",
    dnd: true,
    previousRelease: null,
};
class Settings {
    constructor(storage) {
        this.storage = storage;
        this.callbacks = new Set();
    }
    get keepCursorWithinContent() {
        // Adaptor for users migrating from older version of the plugin.
        if (this.values.stickCursor === true) {
            return "bullet-and-checkbox";
        }
        else if (this.values.stickCursor === false) {
            return "never";
        }
        return this.values.stickCursor;
    }
    set keepCursorWithinContent(value) {
        this.set("stickCursor", value);
    }
    get overrideTabBehaviour() {
        return this.values.betterTab;
    }
    set overrideTabBehaviour(value) {
        this.set("betterTab", value);
    }
    get overrideEnterBehaviour() {
        return this.values.betterEnter;
    }
    set overrideEnterBehaviour(value) {
        this.set("betterEnter", value);
    }
    get overrideVimOBehaviour() {
        return this.values.betterVimO;
    }
    set overrideVimOBehaviour(value) {
        this.set("betterVimO", value);
    }
    get overrideSelectAllBehaviour() {
        return this.values.selectAll;
    }
    set overrideSelectAllBehaviour(value) {
        this.set("selectAll", value);
    }
    get betterListsStyles() {
        return this.values.styleLists;
    }
    set betterListsStyles(value) {
        this.set("styleLists", value);
    }
    get verticalLines() {
        return this.values.listLines;
    }
    set verticalLines(value) {
        this.set("listLines", value);
    }
    get verticalLinesAction() {
        return this.values.listLineAction;
    }
    set verticalLinesAction(value) {
        this.set("listLineAction", value);
    }
    get dragAndDrop() {
        return this.values.dnd;
    }
    set dragAndDrop(value) {
        this.set("dnd", value);
    }
    get debug() {
        return this.values.debug;
    }
    set debug(value) {
        this.set("debug", value);
    }
    get previousRelease() {
        return this.values.previousRelease;
    }
    set previousRelease(value) {
        this.set("previousRelease", value);
    }
    onChange(cb) {
        this.callbacks.add(cb);
    }
    removeCallback(cb) {
        this.callbacks.delete(cb);
    }
    reset() {
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
            this.set(k, v);
        }
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.values = Object.assign({}, DEFAULT_SETTINGS, yield this.storage.loadData());
        });
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.storage.saveData(this.values);
        });
    }
    getValues() {
        return Object.assign({}, this.values);
    }
    set(key, value) {
        this.values[key] = value;
        for (const cb of this.callbacks) {
            cb();
        }
    }
}

class ObsidianOutlinerPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Loading obsidian-outliner`);
            yield this.prepareSettings();
            this.obsidianSettings = new ObsidianSettings(this.app);
            this.logger = new Logger(this.settings);
            this.parser = new Parser(this.logger, this.settings);
            this.changesApplicator = new ChangesApplicator();
            this.operationPerformer = new OperationPerformer(this.parser, this.changesApplicator);
            this.imeDetector = new IMEDetector();
            yield this.imeDetector.load();
            this.features = [
                // service features
                // new ReleaseNotesAnnouncement(this, this.settings),
                new SettingsTab(this, this.settings),
                new SystemInfo(this, this.settings),
                // general features
                new ListsMovementCommands(this, this.obsidianSettings, this.operationPerformer),
                new ListsFoldingCommands(this, this.obsidianSettings),
                // features based on settings.keepCursorWithinContent
                new EditorSelectionsBehaviourOverride(this, this.settings, this.parser, this.operationPerformer),
                new ArrowLeftAndCtrlArrowLeftBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                new BackspaceBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                new MetaBackspaceBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                new DeleteBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                // features based on settings.overrideTabBehaviour
                new TabBehaviourOverride(this, this.imeDetector, this.obsidianSettings, this.settings, this.operationPerformer),
                new ShiftTabBehaviourOverride(this, this.imeDetector, this.settings, this.operationPerformer),
                // features based on settings.overrideEnterBehaviour
                new EnterBehaviourOverride(this, this.settings, this.imeDetector, this.obsidianSettings, this.parser, this.operationPerformer),
                // features based on settings.overrideVimOBehaviour
                new VimOBehaviourOverride(this, this.settings, this.obsidianSettings, this.parser, this.operationPerformer),
                // features based on settings.overrideSelectAllBehaviour
                new CtrlAAndCmdABehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                // features based on settings.betterListsStyles
                new BetterListsStyles(this.settings, this.obsidianSettings),
                // features based on settings.verticalLines
                new VerticalLines(this, this.settings, this.obsidianSettings, this.parser),
                // features based on settings.dragAndDrop
                new DragAndDrop(this, this.settings, this.obsidianSettings, this.parser, this.operationPerformer),
            ];
            for (const feature of this.features) {
                yield feature.load();
            }
        });
    }
    onunload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Unloading obsidian-outliner`);
            yield this.imeDetector.unload();
            for (const feature of this.features) {
                yield feature.unload();
            }
        });
    }
    prepareSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = new Settings(this);
            yield this.settings.load();
        });
    }
}

module.exports = ObsidianOutlinerPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uL3NyYy9vcGVyYXRpb25zL01vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lLnRzIiwiLi4vc3JjL2VkaXRvci9pbmRleC50cyIsIi4uL3NyYy91dGlscy9jcmVhdGVLZXltYXBSdW5DYWxsYmFjay50cyIsIi4uL3NyYy9mZWF0dXJlcy9BcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGUudHMiLCIuLi9zcmMvcm9vdC9pbmRleC50cyIsIi4uL3NyYy9vcGVyYXRpb25zL0RlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kLnRzIiwiLi4vc3JjL2ZlYXR1cmVzL0JhY2tzcGFjZUJlaGF2aW91ck92ZXJyaWRlLnRzIiwiLi4vc3JjL2ZlYXR1cmVzL0JldHRlckxpc3RzU3R5bGVzLnRzIiwiLi4vc3JjL29wZXJhdGlvbnMvU2VsZWN0QWxsQ29udGVudC50cyIsIi4uL3NyYy9mZWF0dXJlcy9DdHJsQUFuZENtZEFCZWhhdmlvdXJPdmVycmlkZS50cyIsIi4uL3NyYy9vcGVyYXRpb25zL0RlbGV0ZVRpbGxOZXh0TGluZUNvbnRlbnRTdGFydC50cyIsIi4uL3NyYy9mZWF0dXJlcy9EZWxldGVCZWhhdmlvdXJPdmVycmlkZS50cyIsIi4uL3NyYy9vcGVyYXRpb25zL01vdmVMaXN0VG9EaWZmZXJlbnRQb3NpdGlvbi50cyIsIi4uL3NyYy9mZWF0dXJlcy9EcmFnQW5kRHJvcC50cyIsIi4uL3NyYy9vcGVyYXRpb25zL0tlZXBDdXJzb3JPdXRzaWRlRm9sZGVkTGluZXMudHMiLCIuLi9zcmMvb3BlcmF0aW9ucy9LZWVwQ3Vyc29yV2l0aGluTGlzdENvbnRlbnQudHMiLCIuLi9zcmMvZmVhdHVyZXMvRWRpdG9yU2VsZWN0aW9uc0JlaGF2aW91ck92ZXJyaWRlLnRzIiwiLi4vc3JjL3V0aWxzL2NoZWNrYm94UmUudHMiLCIuLi9zcmMvdXRpbHMvaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3gudHMiLCIuLi9zcmMvb3BlcmF0aW9ucy9DcmVhdGVOZXdJdGVtLnRzIiwiLi4vc3JjL29wZXJhdGlvbnMvT3V0ZGVudExpc3QudHMiLCIuLi9zcmMvb3BlcmF0aW9ucy9PdXRkZW50TGlzdElmSXRzRW1wdHkudHMiLCIuLi9zcmMvZmVhdHVyZXMvRW50ZXJCZWhhdmlvdXJPdmVycmlkZS50cyIsIi4uL3NyYy91dGlscy9jcmVhdGVFZGl0b3JDYWxsYmFjay50cyIsIi4uL3NyYy9mZWF0dXJlcy9MaXN0c0ZvbGRpbmdDb21tYW5kcy50cyIsIi4uL3NyYy9vcGVyYXRpb25zL0luZGVudExpc3QudHMiLCIuLi9zcmMvb3BlcmF0aW9ucy9Nb3ZlTGlzdERvd24udHMiLCIuLi9zcmMvb3BlcmF0aW9ucy9Nb3ZlTGlzdFVwLnRzIiwiLi4vc3JjL2ZlYXR1cmVzL0xpc3RzTW92ZW1lbnRDb21tYW5kcy50cyIsIi4uL3NyYy9vcGVyYXRpb25zL0RlbGV0ZVRpbGxDdXJyZW50TGluZUNvbnRlbnRTdGFydC50cyIsIi4uL3NyYy9mZWF0dXJlcy9NZXRhQmFja3NwYWNlQmVoYXZpb3VyT3ZlcnJpZGUudHMiLCIuLi9zcmMvZmVhdHVyZXMvU2V0dGluZ3NUYWIudHMiLCIuLi9zcmMvZmVhdHVyZXMvU2hpZnRUYWJCZWhhdmlvdXJPdmVycmlkZS50cyIsIi4uL3NyYy9mZWF0dXJlcy9TeXN0ZW1JbmZvLnRzIiwiLi4vc3JjL2ZlYXR1cmVzL1RhYkJlaGF2aW91ck92ZXJyaWRlLnRzIiwiLi4vc3JjL2ZlYXR1cmVzL1ZlcnRpY2FsTGluZXMudHMiLCIuLi9zcmMvZmVhdHVyZXMvVmltT0JlaGF2aW91ck92ZXJyaWRlLnRzIiwiLi4vc3JjL3NlcnZpY2VzL0NoYW5nZXNBcHBsaWNhdG9yLnRzIiwiLi4vc3JjL3NlcnZpY2VzL0lNRURldGVjdG9yLnRzIiwiLi4vc3JjL3NlcnZpY2VzL0xvZ2dlci50cyIsIi4uL3NyYy9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzLnRzIiwiLi4vc3JjL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lci50cyIsIi4uL3NyYy9zZXJ2aWNlcy9QYXJzZXIudHMiLCIuLi9zcmMvc2VydmljZXMvU2V0dGluZ3MudHMiLCIuLi9zcmMvT2JzaWRpYW5PdXRsaW5lclBsdWdpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UsIFN1cHByZXNzZWRFcnJvciwgU3ltYm9sLCBJdGVyYXRvciAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19lc0RlY29yYXRlKGN0b3IsIGRlc2NyaXB0b3JJbiwgZGVjb3JhdG9ycywgY29udGV4dEluLCBpbml0aWFsaXplcnMsIGV4dHJhSW5pdGlhbGl6ZXJzKSB7XHJcbiAgICBmdW5jdGlvbiBhY2NlcHQoZikgeyBpZiAoZiAhPT0gdm9pZCAwICYmIHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGdW5jdGlvbiBleHBlY3RlZFwiKTsgcmV0dXJuIGY7IH1cclxuICAgIHZhciBraW5kID0gY29udGV4dEluLmtpbmQsIGtleSA9IGtpbmQgPT09IFwiZ2V0dGVyXCIgPyBcImdldFwiIDoga2luZCA9PT0gXCJzZXR0ZXJcIiA/IFwic2V0XCIgOiBcInZhbHVlXCI7XHJcbiAgICB2YXIgdGFyZ2V0ID0gIWRlc2NyaXB0b3JJbiAmJiBjdG9yID8gY29udGV4dEluW1wic3RhdGljXCJdID8gY3RvciA6IGN0b3IucHJvdG90eXBlIDogbnVsbDtcclxuICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvckluIHx8ICh0YXJnZXQgPyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgY29udGV4dEluLm5hbWUpIDoge30pO1xyXG4gICAgdmFyIF8sIGRvbmUgPSBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIGNvbnRleHQgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbikgY29udGV4dFtwXSA9IHAgPT09IFwiYWNjZXNzXCIgPyB7fSA6IGNvbnRleHRJbltwXTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbi5hY2Nlc3MpIGNvbnRleHQuYWNjZXNzW3BdID0gY29udGV4dEluLmFjY2Vzc1twXTtcclxuICAgICAgICBjb250ZXh0LmFkZEluaXRpYWxpemVyID0gZnVuY3Rpb24gKGYpIHsgaWYgKGRvbmUpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgYWRkIGluaXRpYWxpemVycyBhZnRlciBkZWNvcmF0aW9uIGhhcyBjb21wbGV0ZWRcIik7IGV4dHJhSW5pdGlhbGl6ZXJzLnB1c2goYWNjZXB0KGYgfHwgbnVsbCkpOyB9O1xyXG4gICAgICAgIHZhciByZXN1bHQgPSAoMCwgZGVjb3JhdG9yc1tpXSkoa2luZCA9PT0gXCJhY2Nlc3NvclwiID8geyBnZXQ6IGRlc2NyaXB0b3IuZ2V0LCBzZXQ6IGRlc2NyaXB0b3Iuc2V0IH0gOiBkZXNjcmlwdG9yW2tleV0sIGNvbnRleHQpO1xyXG4gICAgICAgIGlmIChraW5kID09PSBcImFjY2Vzc29yXCIpIHtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdm9pZCAwKSBjb250aW51ZTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkXCIpO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuZ2V0KSkgZGVzY3JpcHRvci5nZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuc2V0KSkgZGVzY3JpcHRvci5zZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuaW5pdCkpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChfID0gYWNjZXB0KHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgaWYgKGtpbmQgPT09IFwiZmllbGRcIikgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgICAgIGVsc2UgZGVzY3JpcHRvcltrZXldID0gXztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGFyZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSwgZGVzY3JpcHRvcik7XHJcbiAgICBkb25lID0gdHJ1ZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3J1bkluaXRpYWxpemVycyh0aGlzQXJnLCBpbml0aWFsaXplcnMsIHZhbHVlKSB7XHJcbiAgICB2YXIgdXNlVmFsdWUgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5pdGlhbGl6ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFsdWUgPSB1c2VWYWx1ZSA/IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcsIHZhbHVlKSA6IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVzZVZhbHVlID8gdmFsdWUgOiB2b2lkIDA7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wcm9wS2V5KHgpIHtcclxuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gXCJzeW1ib2xcIiA/IHggOiBcIlwiLmNvbmNhdCh4KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NldEZ1bmN0aW9uTmFtZShmLCBuYW1lLCBwcmVmaXgpIHtcclxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikgbmFtZSA9IG5hbWUuZGVzY3JpcHRpb24gPyBcIltcIi5jb25jYXQobmFtZS5kZXNjcmlwdGlvbiwgXCJdXCIpIDogXCJcIjtcclxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZiwgXCJuYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCB2YWx1ZTogcHJlZml4ID8gXCJcIi5jb25jYXQocHJlZml4LCBcIiBcIiwgbmFtZSkgOiBuYW1lIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZyA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSk7XHJcbiAgICByZXR1cm4gZy5uZXh0ID0gdmVyYigwKSwgZ1tcInRocm93XCJdID0gdmVyYigxKSwgZ1tcInJldHVyblwiXSA9IHZlcmIoMiksIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoZyAmJiAoZyA9IDAsIG9wWzBdICYmIChfID0gMCkpLCBfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihtLCBrKTtcclxuICAgIGlmICghZGVzYyB8fCAoXCJnZXRcIiBpbiBkZXNjID8gIW0uX19lc01vZHVsZSA6IGRlc2Mud3JpdGFibGUgfHwgZGVzYy5jb25maWd1cmFibGUpKSB7XHJcbiAgICAgICAgZGVzYyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgZGVzYyk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tLCBwYWNrKSB7XHJcbiAgICBpZiAocGFjayB8fCBhcmd1bWVudHMubGVuZ3RoID09PSAyKSBmb3IgKHZhciBpID0gMCwgbCA9IGZyb20ubGVuZ3RoLCBhcjsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmIChhciB8fCAhKGkgaW4gZnJvbSkpIHtcclxuICAgICAgICAgICAgaWYgKCFhcikgYXIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tLCAwLCBpKTtcclxuICAgICAgICAgICAgYXJbaV0gPSBmcm9tW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0by5jb25jYXQoYXIgfHwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEFzeW5jSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEFzeW5jSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSksIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiwgYXdhaXRSZXR1cm4pLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiBhd2FpdFJldHVybihmKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZiwgcmVqZWN0KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlmIChnW25dKSB7IGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IGlmIChmKSBpW25dID0gZihpW25dKTsgfSB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogZmFsc2UgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxudmFyIG93bktleXMgPSBmdW5jdGlvbihvKSB7XHJcbiAgICBvd25LZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgfHwgZnVuY3Rpb24gKG8pIHtcclxuICAgICAgICB2YXIgYXIgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBrIGluIG8pIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgaykpIGFyW2FyLmxlbmd0aF0gPSBrO1xyXG4gICAgICAgIHJldHVybiBhcjtcclxuICAgIH07XHJcbiAgICByZXR1cm4gb3duS2V5cyhvKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrID0gb3duS2V5cyhtb2QpLCBpID0gMDsgaSA8IGsubGVuZ3RoOyBpKyspIGlmIChrW2ldICE9PSBcImRlZmF1bHRcIikgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrW2ldKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlKGVudiwgdmFsdWUsIGFzeW5jKSB7XHJcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHZvaWQgMCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgIHZhciBkaXNwb3NlLCBpbm5lcjtcclxuICAgICAgICBpZiAoYXN5bmMpIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuYXN5bmNEaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jRGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuYXN5bmNEaXNwb3NlXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRpc3Bvc2UgPT09IHZvaWQgMCkge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5kaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmRpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmRpc3Bvc2VdO1xyXG4gICAgICAgICAgICBpZiAoYXN5bmMpIGlubmVyID0gZGlzcG9zZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkaXNwb3NlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qgbm90IGRpc3Bvc2FibGUuXCIpO1xyXG4gICAgICAgIGlmIChpbm5lcikgZGlzcG9zZSA9IGZ1bmN0aW9uKCkgeyB0cnkgeyBpbm5lci5jYWxsKHRoaXMpOyB9IGNhdGNoIChlKSB7IHJldHVybiBQcm9taXNlLnJlamVjdChlKTsgfSB9O1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgdmFsdWU6IHZhbHVlLCBkaXNwb3NlOiBkaXNwb3NlLCBhc3luYzogYXN5bmMgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChhc3luYykge1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgYXN5bmM6IHRydWUgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcblxyXG59XHJcblxyXG52YXIgX1N1cHByZXNzZWRFcnJvciA9IHR5cGVvZiBTdXBwcmVzc2VkRXJyb3IgPT09IFwiZnVuY3Rpb25cIiA/IFN1cHByZXNzZWRFcnJvciA6IGZ1bmN0aW9uIChlcnJvciwgc3VwcHJlc3NlZCwgbWVzc2FnZSkge1xyXG4gICAgdmFyIGUgPSBuZXcgRXJyb3IobWVzc2FnZSk7XHJcbiAgICByZXR1cm4gZS5uYW1lID0gXCJTdXBwcmVzc2VkRXJyb3JcIiwgZS5lcnJvciA9IGVycm9yLCBlLnN1cHByZXNzZWQgPSBzdXBwcmVzc2VkLCBlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGlzcG9zZVJlc291cmNlcyhlbnYpIHtcclxuICAgIGZ1bmN0aW9uIGZhaWwoZSkge1xyXG4gICAgICAgIGVudi5lcnJvciA9IGVudi5oYXNFcnJvciA/IG5ldyBfU3VwcHJlc3NlZEVycm9yKGUsIGVudi5lcnJvciwgXCJBbiBlcnJvciB3YXMgc3VwcHJlc3NlZCBkdXJpbmcgZGlzcG9zYWwuXCIpIDogZTtcclxuICAgICAgICBlbnYuaGFzRXJyb3IgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgdmFyIHIsIHMgPSAwO1xyXG4gICAgZnVuY3Rpb24gbmV4dCgpIHtcclxuICAgICAgICB3aGlsZSAociA9IGVudi5zdGFjay5wb3AoKSkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyLmFzeW5jICYmIHMgPT09IDEpIHJldHVybiBzID0gMCwgZW52LnN0YWNrLnB1c2gociksIFByb21pc2UucmVzb2x2ZSgpLnRoZW4obmV4dCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoci5kaXNwb3NlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHIuZGlzcG9zZS5jYWxsKHIudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyLmFzeW5jKSByZXR1cm4gcyB8PSAyLCBQcm9taXNlLnJlc29sdmUocmVzdWx0KS50aGVuKG5leHQsIGZ1bmN0aW9uKGUpIHsgZmFpbChlKTsgcmV0dXJuIG5leHQoKTsgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHMgfD0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgZmFpbChlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocyA9PT0gMSkgcmV0dXJuIGVudi5oYXNFcnJvciA/IFByb21pc2UucmVqZWN0KGVudi5lcnJvcikgOiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICBpZiAoZW52Lmhhc0Vycm9yKSB0aHJvdyBlbnYuZXJyb3I7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV4dCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24ocGF0aCwgcHJlc2VydmVKc3gpIHtcclxuICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIiAmJiAvXlxcLlxcLj9cXC8vLnRlc3QocGF0aCkpIHtcclxuICAgICAgICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXC4odHN4KSR8KCg/OlxcLmQpPykoKD86XFwuW14uL10rPyk/KVxcLihbY21dPyl0cyQvaSwgZnVuY3Rpb24gKG0sIHRzeCwgZCwgZXh0LCBjbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHN4ID8gcHJlc2VydmVKc3ggPyBcIi5qc3hcIiA6IFwiLmpzXCIgOiBkICYmICghZXh0IHx8ICFjbSkgPyBtIDogKGQgKyBleHQgKyBcIi5cIiArIGNtLnRvTG93ZXJDYXNlKCkgKyBcImpzXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhdGg7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fZXNEZWNvcmF0ZTogX19lc0RlY29yYXRlLFxyXG4gICAgX19ydW5Jbml0aWFsaXplcnM6IF9fcnVuSW5pdGlhbGl6ZXJzLFxyXG4gICAgX19wcm9wS2V5OiBfX3Byb3BLZXksXHJcbiAgICBfX3NldEZ1bmN0aW9uTmFtZTogX19zZXRGdW5jdGlvbk5hbWUsXHJcbiAgICBfX21ldGFkYXRhOiBfX21ldGFkYXRhLFxyXG4gICAgX19hd2FpdGVyOiBfX2F3YWl0ZXIsXHJcbiAgICBfX2dlbmVyYXRvcjogX19nZW5lcmF0b3IsXHJcbiAgICBfX2NyZWF0ZUJpbmRpbmc6IF9fY3JlYXRlQmluZGluZyxcclxuICAgIF9fZXhwb3J0U3RhcjogX19leHBvcnRTdGFyLFxyXG4gICAgX192YWx1ZXM6IF9fdmFsdWVzLFxyXG4gICAgX19yZWFkOiBfX3JlYWQsXHJcbiAgICBfX3NwcmVhZDogX19zcHJlYWQsXHJcbiAgICBfX3NwcmVhZEFycmF5czogX19zcHJlYWRBcnJheXMsXHJcbiAgICBfX3NwcmVhZEFycmF5OiBfX3NwcmVhZEFycmF5LFxyXG4gICAgX19hd2FpdDogX19hd2FpdCxcclxuICAgIF9fYXN5bmNHZW5lcmF0b3I6IF9fYXN5bmNHZW5lcmF0b3IsXHJcbiAgICBfX2FzeW5jRGVsZWdhdG9yOiBfX2FzeW5jRGVsZWdhdG9yLFxyXG4gICAgX19hc3luY1ZhbHVlczogX19hc3luY1ZhbHVlcyxcclxuICAgIF9fbWFrZVRlbXBsYXRlT2JqZWN0OiBfX21ha2VUZW1wbGF0ZU9iamVjdCxcclxuICAgIF9faW1wb3J0U3RhcjogX19pbXBvcnRTdGFyLFxyXG4gICAgX19pbXBvcnREZWZhdWx0OiBfX2ltcG9ydERlZmF1bHQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldDogX19jbGFzc1ByaXZhdGVGaWVsZFNldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRJbjogX19jbGFzc1ByaXZhdGVGaWVsZEluLFxyXG4gICAgX19hZGREaXNwb3NhYmxlUmVzb3VyY2U6IF9fYWRkRGlzcG9zYWJsZVJlc291cmNlLFxyXG4gICAgX19kaXNwb3NlUmVzb3VyY2VzOiBfX2Rpc3Bvc2VSZXNvdXJjZXMsXHJcbiAgICBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbjogX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24sXHJcbn07XHJcbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBMaXN0TGluZSwgUG9zaXRpb24sIFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgTW92ZUN1cnNvclRvUHJldmlvdXNVbmZvbGRlZExpbmUgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gdGhpcy5yb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMucm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXNJbmZvKCk7XG4gICAgY29uc3QgbGluZU5vID0gbGluZXMuZmluZEluZGV4KChsKSA9PiB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICBjdXJzb3IuY2ggPT09IGwuZnJvbS5jaCArIGxpc3QuZ2V0Q2hlY2tib3hMZW5ndGgoKSAmJlxuICAgICAgICBjdXJzb3IubGluZSA9PT0gbC5mcm9tLmxpbmVcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICBpZiAobGluZU5vID09PSAwKSB7XG4gICAgICB0aGlzLm1vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRJdGVtKHJvb3QsIGN1cnNvcik7XG4gICAgfSBlbHNlIGlmIChsaW5lTm8gPiAwKSB7XG4gICAgICB0aGlzLm1vdmVDdXJzb3JUb1ByZXZpb3VzTm90ZUxpbmUocm9vdCwgbGluZXMsIGxpbmVObyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBtb3ZlQ3Vyc29yVG9QcmV2aW91c05vdGVMaW5lKFxuICAgIHJvb3Q6IFJvb3QsXG4gICAgbGluZXM6IExpc3RMaW5lW10sXG4gICAgbGluZU5vOiBudW1iZXIsXG4gICkge1xuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgcm9vdC5yZXBsYWNlQ3Vyc29yKGxpbmVzW2xpbmVObyAtIDFdLnRvKTtcbiAgfVxuXG4gIHByaXZhdGUgbW92ZUN1cnNvclRvUHJldmlvdXNVbmZvbGRlZEl0ZW0ocm9vdDogUm9vdCwgY3Vyc29yOiBQb3NpdGlvbikge1xuICAgIGNvbnN0IHByZXYgPSByb290LmdldExpc3RVbmRlckxpbmUoY3Vyc29yLmxpbmUgLSAxKTtcblxuICAgIGlmICghcHJldikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgaWYgKHByZXYuaXNGb2xkZWQoKSkge1xuICAgICAgY29uc3QgZm9sZFJvb3QgPSBwcmV2LmdldFRvcEZvbGRSb290KCk7XG4gICAgICBjb25zdCBmaXJzdExpbmVFbmQgPSBmb2xkUm9vdC5nZXRMaW5lc0luZm8oKVswXS50bztcbiAgICAgIHJvb3QucmVwbGFjZUN1cnNvcihmaXJzdExpbmVFbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByb290LnJlcGxhY2VDdXJzb3IocHJldi5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKSk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBFZGl0b3IsIGVkaXRvckluZm9GaWVsZCB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQge1xuICBmb2xkRWZmZWN0LFxuICBmb2xkYWJsZSxcbiAgZm9sZGVkUmFuZ2VzLFxuICB1bmZvbGRFZmZlY3QsXG59IGZyb20gXCJAY29kZW1pcnJvci9sYW5ndWFnZVwiO1xuaW1wb3J0IHsgRWRpdG9yU3RhdGUgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcbmltcG9ydCB7IEVkaXRvclZpZXcsIHJ1blNjb3BlSGFuZGxlcnMgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuXG5leHBvcnQgY2xhc3MgTXlFZGl0b3JQb3NpdGlvbiB7XG4gIGxpbmU6IG51bWJlcjtcbiAgY2g6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIE15RWRpdG9yUmFuZ2Uge1xuICBmcm9tOiBNeUVkaXRvclBvc2l0aW9uO1xuICB0bzogTXlFZGl0b3JQb3NpdGlvbjtcbn1cblxuZXhwb3J0IGNsYXNzIE15RWRpdG9yU2VsZWN0aW9uIHtcbiAgYW5jaG9yOiBNeUVkaXRvclBvc2l0aW9uO1xuICBoZWFkOiBNeUVkaXRvclBvc2l0aW9uO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RWRpdG9yRnJvbVN0YXRlKHN0YXRlOiBFZGl0b3JTdGF0ZSkge1xuICBjb25zdCB7IGVkaXRvciB9ID0gc3RhdGUuZmllbGQoZWRpdG9ySW5mb0ZpZWxkKTtcblxuICBpZiAoIWVkaXRvcikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBNeUVkaXRvcihlZGl0b3IpO1xufVxuXG5kZWNsYXJlIGdsb2JhbCB7XG4gIGludGVyZmFjZSBXaW5kb3cge1xuICAgIE9ic2lkaWFuWm9vbVBsdWdpbj86IHtcbiAgICAgIGdldFpvb21SYW5nZShlOiBFZGl0b3IpOiBNeUVkaXRvclJhbmdlO1xuICAgICAgem9vbU91dChlOiBFZGl0b3IpOiB2b2lkO1xuICAgICAgem9vbUluKGU6IEVkaXRvciwgbGluZTogbnVtYmVyKTogdm9pZDtcbiAgICAgIHJlZnJlc2hab29tPyhlOiBFZGl0b3IpOiB2b2lkO1xuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9sZEluc2lkZSh2aWV3OiBFZGl0b3JWaWV3LCBmcm9tOiBudW1iZXIsIHRvOiBudW1iZXIpIHtcbiAgbGV0IGZvdW5kOiB7IGZyb206IG51bWJlcjsgdG86IG51bWJlciB9IHwgbnVsbCA9IG51bGw7XG4gIGZvbGRlZFJhbmdlcyh2aWV3LnN0YXRlKS5iZXR3ZWVuKGZyb20sIHRvLCAoZnJvbSwgdG8pID0+IHtcbiAgICBpZiAoIWZvdW5kIHx8IGZvdW5kLmZyb20gPiBmcm9tKSBmb3VuZCA9IHsgZnJvbSwgdG8gfTtcbiAgfSk7XG4gIHJldHVybiBmb3VuZDtcbn1cblxuZXhwb3J0IGNsYXNzIE15RWRpdG9yIHtcbiAgcHJpdmF0ZSB2aWV3OiBFZGl0b3JWaWV3O1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZTogRWRpdG9yKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICB0aGlzLnZpZXcgPSAodGhpcy5lIGFzIGFueSkuY207XG4gIH1cblxuICBnZXRDdXJzb3IoKTogTXlFZGl0b3JQb3NpdGlvbiB7XG4gICAgcmV0dXJuIHRoaXMuZS5nZXRDdXJzb3IoKTtcbiAgfVxuXG4gIGdldExpbmUobjogbnVtYmVyKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5lLmdldExpbmUobik7XG4gIH1cblxuICBsYXN0TGluZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmUubGFzdExpbmUoKTtcbiAgfVxuXG4gIGxpc3RTZWxlY3Rpb25zKCk6IE15RWRpdG9yU2VsZWN0aW9uW10ge1xuICAgIHJldHVybiB0aGlzLmUubGlzdFNlbGVjdGlvbnMoKTtcbiAgfVxuXG4gIGdldFJhbmdlKGZyb206IE15RWRpdG9yUG9zaXRpb24sIHRvOiBNeUVkaXRvclBvc2l0aW9uKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5lLmdldFJhbmdlKGZyb20sIHRvKTtcbiAgfVxuXG4gIHJlcGxhY2VSYW5nZShcbiAgICByZXBsYWNlbWVudDogc3RyaW5nLFxuICAgIGZyb206IE15RWRpdG9yUG9zaXRpb24sXG4gICAgdG86IE15RWRpdG9yUG9zaXRpb24sXG4gICk6IHZvaWQge1xuICAgIHJldHVybiB0aGlzLmUucmVwbGFjZVJhbmdlKHJlcGxhY2VtZW50LCBmcm9tLCB0byk7XG4gIH1cblxuICBzZXRTZWxlY3Rpb25zKHNlbGVjdGlvbnM6IE15RWRpdG9yU2VsZWN0aW9uW10pOiB2b2lkIHtcbiAgICB0aGlzLmUuc2V0U2VsZWN0aW9ucyhzZWxlY3Rpb25zKTtcbiAgfVxuXG4gIHNldFZhbHVlKHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuZS5zZXRWYWx1ZSh0ZXh0KTtcbiAgfVxuXG4gIGdldFZhbHVlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuZS5nZXRWYWx1ZSgpO1xuICB9XG5cbiAgb2Zmc2V0VG9Qb3Mob2Zmc2V0OiBudW1iZXIpOiBNeUVkaXRvclBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5lLm9mZnNldFRvUG9zKG9mZnNldCk7XG4gIH1cblxuICBwb3NUb09mZnNldChwb3M6IE15RWRpdG9yUG9zaXRpb24pOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmUucG9zVG9PZmZzZXQocG9zKTtcbiAgfVxuXG4gIGZvbGQobjogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgeyB2aWV3IH0gPSB0aGlzO1xuICAgIGNvbnN0IGwgPSB2aWV3LmxpbmVCbG9ja0F0KHZpZXcuc3RhdGUuZG9jLmxpbmUobiArIDEpLmZyb20pO1xuICAgIGNvbnN0IHJhbmdlID0gZm9sZGFibGUodmlldy5zdGF0ZSwgbC5mcm9tLCBsLnRvKTtcblxuICAgIGlmICghcmFuZ2UgfHwgcmFuZ2UuZnJvbSA9PT0gcmFuZ2UudG8pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2aWV3LmRpc3BhdGNoKHsgZWZmZWN0czogW2ZvbGRFZmZlY3Qub2YocmFuZ2UpXSB9KTtcbiAgfVxuXG4gIHVuZm9sZChuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCB7IHZpZXcgfSA9IHRoaXM7XG4gICAgY29uc3QgbCA9IHZpZXcubGluZUJsb2NrQXQodmlldy5zdGF0ZS5kb2MubGluZShuICsgMSkuZnJvbSk7XG4gICAgY29uc3QgcmFuZ2UgPSBmb2xkSW5zaWRlKHZpZXcsIGwuZnJvbSwgbC50byk7XG5cbiAgICBpZiAoIXJhbmdlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmlldy5kaXNwYXRjaCh7IGVmZmVjdHM6IFt1bmZvbGRFZmZlY3Qub2YocmFuZ2UpXSB9KTtcbiAgfVxuXG4gIGdldEFsbEZvbGRlZExpbmVzKCk6IG51bWJlcltdIHtcbiAgICBjb25zdCBjID0gZm9sZGVkUmFuZ2VzKHRoaXMudmlldy5zdGF0ZSkuaXRlcigpO1xuICAgIGNvbnN0IHJlczogbnVtYmVyW10gPSBbXTtcbiAgICB3aGlsZSAoYy52YWx1ZSkge1xuICAgICAgcmVzLnB1c2godGhpcy5vZmZzZXRUb1BvcyhjLmZyb20pLmxpbmUpO1xuICAgICAgYy5uZXh0KCk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICB0cmlnZ2VyT25LZXlEb3duKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICBydW5TY29wZUhhbmRsZXJzKHRoaXMudmlldywgZSwgXCJlZGl0b3JcIik7XG4gIH1cblxuICBnZXRab29tUmFuZ2UoKTogTXlFZGl0b3JSYW5nZSB8IG51bGwge1xuICAgIGlmICghd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdpbmRvdy5PYnNpZGlhblpvb21QbHVnaW4uZ2V0Wm9vbVJhbmdlKHRoaXMuZSk7XG4gIH1cblxuICB6b29tT3V0KCkge1xuICAgIGlmICghd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHdpbmRvdy5PYnNpZGlhblpvb21QbHVnaW4uem9vbU91dCh0aGlzLmUpO1xuICB9XG5cbiAgem9vbUluKGxpbmU6IG51bWJlcikge1xuICAgIGlmICghd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHdpbmRvdy5PYnNpZGlhblpvb21QbHVnaW4uem9vbUluKHRoaXMuZSwgbGluZSk7XG4gIH1cblxuICB0cnlSZWZyZXNoWm9vbShsaW5lOiBudW1iZXIpIHtcbiAgICBpZiAoIXdpbmRvdy5PYnNpZGlhblpvb21QbHVnaW4pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAod2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbi5yZWZyZXNoWm9vbSkge1xuICAgICAgd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbi5yZWZyZXNoWm9vbSh0aGlzLmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luLnpvb21Jbih0aGlzLmUsIGxpbmUpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgRWRpdG9yVmlldyB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IE15RWRpdG9yLCBnZXRFZGl0b3JGcm9tU3RhdGUgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayhjb25maWc6IHtcbiAgY2hlY2s/OiAoZWRpdG9yOiBNeUVkaXRvcikgPT4gYm9vbGVhbjtcbiAgcnVuOiAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHNob3VsZFVwZGF0ZTogYm9vbGVhbjtcbiAgICBzaG91bGRTdG9wUHJvcGFnYXRpb246IGJvb2xlYW47XG4gIH07XG59KSB7XG4gIGNvbnN0IGNoZWNrID0gY29uZmlnLmNoZWNrIHx8ICgoKSA9PiB0cnVlKTtcbiAgY29uc3QgeyBydW4gfSA9IGNvbmZpZztcblxuICByZXR1cm4gKHZpZXc6IEVkaXRvclZpZXcpOiBib29sZWFuID0+IHtcbiAgICBjb25zdCBlZGl0b3IgPSBnZXRFZGl0b3JGcm9tU3RhdGUodmlldy5zdGF0ZSk7XG5cbiAgICBpZiAoIWNoZWNrKGVkaXRvcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHNob3VsZFVwZGF0ZSwgc2hvdWxkU3RvcFByb3BhZ2F0aW9uIH0gPSBydW4oZWRpdG9yKTtcblxuICAgIHJldHVybiBzaG91bGRVcGRhdGUgfHwgc2hvdWxkU3RvcFByb3BhZ2F0aW9uO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgTW92ZUN1cnNvclRvUHJldmlvdXNVbmZvbGRlZExpbmUgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9Nb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZVwiO1xuaW1wb3J0IHsgSU1FRGV0ZWN0b3IgfSBmcm9tIFwiLi4vc2VydmljZXMvSU1FRGV0ZWN0b3JcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5pbXBvcnQgeyBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVLZXltYXBSdW5DYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgQXJyb3dMZWZ0QW5kQ3RybEFycm93TGVmdEJlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBpbWVEZXRlY3RvcjogSU1FRGV0ZWN0b3IsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBrZXltYXAub2YoW1xuICAgICAgICB7XG4gICAgICAgICAga2V5OiBcIkFycm93TGVmdFwiLFxuICAgICAgICAgIHJ1bjogY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgd2luOiBcImMtQXJyb3dMZWZ0XCIsXG4gICAgICAgICAgbGludXg6IFwiYy1BcnJvd0xlZnRcIixcbiAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgIT09IFwibmV2ZXJcIiAmJlxuICAgICAgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKVxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBNb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZShyb290KSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuICB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGNtcFBvcyhhOiBQb3NpdGlvbiwgYjogUG9zaXRpb24pIHtcbiAgcmV0dXJuIGEubGluZSAtIGIubGluZSB8fCBhLmNoIC0gYi5jaDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1heFBvcyhhOiBQb3NpdGlvbiwgYjogUG9zaXRpb24pIHtcbiAgcmV0dXJuIGNtcFBvcyhhLCBiKSA8IDAgPyBiIDogYTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1pblBvcyhhOiBQb3NpdGlvbiwgYjogUG9zaXRpb24pIHtcbiAgcmV0dXJuIGNtcFBvcyhhLCBiKSA8IDAgPyBhIDogYjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUmFuZ2VzSW50ZXJzZWN0cyhcbiAgYTogW1Bvc2l0aW9uLCBQb3NpdGlvbl0sXG4gIGI6IFtQb3NpdGlvbiwgUG9zaXRpb25dLFxuKSB7XG4gIHJldHVybiBjbXBQb3MoYVsxXSwgYlswXSkgPj0gMCAmJiBjbXBQb3MoYVswXSwgYlsxXSkgPD0gMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdDogUm9vdCkge1xuICBmdW5jdGlvbiB2aXNpdChwYXJlbnQ6IFJvb3QgfCBMaXN0KSB7XG4gICAgbGV0IGluZGV4ID0gMTtcblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgcGFyZW50LmdldENoaWxkcmVuKCkpIHtcbiAgICAgIGlmICgvXFxkK1xcLi8udGVzdChjaGlsZC5nZXRCdWxsZXQoKSkpIHtcbiAgICAgICAgY2hpbGQucmVwbGF0ZUJ1bGxldChgJHtpbmRleCsrfS5gKTtcbiAgICAgIH1cblxuICAgICAgdmlzaXQoY2hpbGQpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0KHJvb3QpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvc2l0aW9uIHtcbiAgY2g6IG51bWJlcjtcbiAgbGluZTogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExpc3RMaW5lIHtcbiAgdGV4dDogc3RyaW5nO1xuICBmcm9tOiBQb3NpdGlvbjtcbiAgdG86IFBvc2l0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJhbmdlIHtcbiAgYW5jaG9yOiBQb3NpdGlvbjtcbiAgaGVhZDogUG9zaXRpb247XG59XG5cbmxldCBpZFNlcSA9IDA7XG5cbmV4cG9ydCBjbGFzcyBMaXN0IHtcbiAgcHJpdmF0ZSBpZDogbnVtYmVyO1xuICBwcml2YXRlIHBhcmVudDogTGlzdCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGNoaWxkcmVuOiBMaXN0W10gPSBbXTtcbiAgcHJpdmF0ZSBub3Rlc0luZGVudDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgbGluZXM6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByb290OiBSb290LFxuICAgIHByaXZhdGUgaW5kZW50OiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBidWxsZXQ6IHN0cmluZyxcbiAgICBwcml2YXRlIG9wdGlvbmFsQ2hlY2tib3g6IHN0cmluZyxcbiAgICBwcml2YXRlIHNwYWNlQWZ0ZXJCdWxsZXQ6IHN0cmluZyxcbiAgICBmaXJzdExpbmU6IHN0cmluZyxcbiAgICBwcml2YXRlIGZvbGRSb290OiBib29sZWFuLFxuICApIHtcbiAgICB0aGlzLmlkID0gaWRTZXErKztcbiAgICB0aGlzLmxpbmVzLnB1c2goZmlyc3RMaW5lKTtcbiAgfVxuXG4gIGdldElEKCkge1xuICAgIHJldHVybiB0aGlzLmlkO1xuICB9XG5cbiAgZ2V0Tm90ZXNJbmRlbnQoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubm90ZXNJbmRlbnQ7XG4gIH1cblxuICBzZXROb3Rlc0luZGVudChub3Rlc0luZGVudDogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMubm90ZXNJbmRlbnQgIT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm90ZXMgaW5kZW50IGFscmVhZHkgcHJvdmlkZWRgKTtcbiAgICB9XG4gICAgdGhpcy5ub3Rlc0luZGVudCA9IG5vdGVzSW5kZW50O1xuICB9XG5cbiAgYWRkTGluZSh0ZXh0OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5ub3Rlc0luZGVudCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgVW5hYmxlIHRvIGFkZCBsaW5lLCBub3RlcyBpbmRlbnQgc2hvdWxkIGJlIHByb3ZpZGVkIGZpcnN0YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5saW5lcy5wdXNoKHRleHQpO1xuICB9XG5cbiAgcmVwbGFjZUxpbmVzKGxpbmVzOiBzdHJpbmdbXSkge1xuICAgIGlmIChsaW5lcy5sZW5ndGggPiAxICYmIHRoaXMubm90ZXNJbmRlbnQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYFVuYWJsZSB0byBhZGQgbGluZSwgbm90ZXMgaW5kZW50IHNob3VsZCBiZSBwcm92aWRlZCBmaXJzdGAsXG4gICAgICApO1xuICAgIH1cblxuICAgIHRoaXMubGluZXMgPSBsaW5lcztcbiAgfVxuXG4gIGdldExpbmVDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5saW5lcy5sZW5ndGg7XG4gIH1cblxuICBnZXRSb290KCkge1xuICAgIHJldHVybiB0aGlzLnJvb3Q7XG4gIH1cblxuICBnZXRDaGlsZHJlbigpIHtcbiAgICByZXR1cm4gdGhpcy5jaGlsZHJlbi5jb25jYXQoKTtcbiAgfVxuXG4gIGdldExpbmVzSW5mbygpOiBMaXN0TGluZVtdIHtcbiAgICBjb25zdCBzdGFydExpbmUgPSB0aGlzLnJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZih0aGlzKVswXTtcblxuICAgIHJldHVybiB0aGlzLmxpbmVzLm1hcCgocm93LCBpKSA9PiB7XG4gICAgICBjb25zdCBsaW5lID0gc3RhcnRMaW5lICsgaTtcbiAgICAgIGNvbnN0IHN0YXJ0Q2ggPVxuICAgICAgICBpID09PSAwID8gdGhpcy5nZXRDb250ZW50U3RhcnRDaCgpIDogdGhpcy5ub3Rlc0luZGVudC5sZW5ndGg7XG4gICAgICBjb25zdCBlbmRDaCA9IHN0YXJ0Q2ggKyByb3cubGVuZ3RoO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0ZXh0OiByb3csXG4gICAgICAgIGZyb206IHsgbGluZSwgY2g6IHN0YXJ0Q2ggfSxcbiAgICAgICAgdG86IHsgbGluZSwgY2g6IGVuZENoIH0sXG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0TGluZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLmxpbmVzLmNvbmNhdCgpO1xuICB9XG5cbiAgZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkge1xuICAgIGNvbnN0IHN0YXJ0TGluZSA9IHRoaXMucm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKHRoaXMpWzBdO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGxpbmU6IHN0YXJ0TGluZSxcbiAgICAgIGNoOiB0aGlzLmdldENvbnRlbnRTdGFydENoKCksXG4gICAgfTtcbiAgfVxuXG4gIGdldEZpcnN0TGluZUNvbnRlbnRTdGFydEFmdGVyQ2hlY2tib3goKSB7XG4gICAgY29uc3Qgc3RhcnRMaW5lID0gdGhpcy5yb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YodGhpcylbMF07XG5cbiAgICByZXR1cm4ge1xuICAgICAgbGluZTogc3RhcnRMaW5lLFxuICAgICAgY2g6IHRoaXMuZ2V0Q29udGVudFN0YXJ0Q2goKSArIHRoaXMuZ2V0Q2hlY2tib3hMZW5ndGgoKSxcbiAgICB9O1xuICB9XG5cbiAgZ2V0TGFzdExpbmVDb250ZW50RW5kKCkge1xuICAgIGNvbnN0IGVuZExpbmUgPSB0aGlzLnJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZih0aGlzKVsxXTtcbiAgICBjb25zdCBlbmRDaCA9XG4gICAgICB0aGlzLmxpbmVzLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IHRoaXMuZ2V0Q29udGVudFN0YXJ0Q2goKSArIHRoaXMubGluZXNbMF0ubGVuZ3RoXG4gICAgICAgIDogdGhpcy5ub3Rlc0luZGVudC5sZW5ndGggKyB0aGlzLmxpbmVzW3RoaXMubGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGxpbmU6IGVuZExpbmUsXG4gICAgICBjaDogZW5kQ2gsXG4gICAgfTtcbiAgfVxuXG4gIGdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRMYXN0Q2hpbGQoKS5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0TGFzdENoaWxkKCkge1xuICAgIGxldCBsYXN0Q2hpbGQ6IExpc3QgPSB0aGlzO1xuXG4gICAgd2hpbGUgKCFsYXN0Q2hpbGQuaXNFbXB0eSgpKSB7XG4gICAgICBsYXN0Q2hpbGQgPSBsYXN0Q2hpbGQuZ2V0Q2hpbGRyZW4oKS5sYXN0KCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGxhc3RDaGlsZDtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0Q29udGVudFN0YXJ0Q2goKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZW50Lmxlbmd0aCArIHRoaXMuYnVsbGV0Lmxlbmd0aCArIDE7XG4gIH1cblxuICBpc0ZvbGRlZCgpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5mb2xkUm9vdCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucGFyZW50KSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJlbnQuaXNGb2xkZWQoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpc0ZvbGRSb290KCkge1xuICAgIHJldHVybiB0aGlzLmZvbGRSb290O1xuICB9XG5cbiAgZ2V0VG9wRm9sZFJvb3QoKSB7XG4gICAgbGV0IHRtcDogTGlzdCA9IHRoaXM7XG4gICAgbGV0IGZvbGRSb290OiBMaXN0IHwgbnVsbCA9IG51bGw7XG4gICAgd2hpbGUgKHRtcCkge1xuICAgICAgaWYgKHRtcC5pc0ZvbGRSb290KCkpIHtcbiAgICAgICAgZm9sZFJvb3QgPSB0bXA7XG4gICAgICB9XG4gICAgICB0bXAgPSB0bXAucGFyZW50O1xuICAgIH1cbiAgICByZXR1cm4gZm9sZFJvb3Q7XG4gIH1cblxuICBnZXRMZXZlbCgpOiBudW1iZXIge1xuICAgIGlmICghdGhpcy5wYXJlbnQpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnBhcmVudC5nZXRMZXZlbCgpICsgMTtcbiAgfVxuXG4gIHVuaW5kZW50Q29udGVudChmcm9tOiBudW1iZXIsIHRpbGw6IG51bWJlcikge1xuICAgIHRoaXMuaW5kZW50ID0gdGhpcy5pbmRlbnQuc2xpY2UoMCwgZnJvbSkgKyB0aGlzLmluZGVudC5zbGljZSh0aWxsKTtcbiAgICBpZiAodGhpcy5ub3Rlc0luZGVudCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3Rlc0luZGVudCA9XG4gICAgICAgIHRoaXMubm90ZXNJbmRlbnQuc2xpY2UoMCwgZnJvbSkgKyB0aGlzLm5vdGVzSW5kZW50LnNsaWNlKHRpbGwpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5jaGlsZHJlbikge1xuICAgICAgY2hpbGQudW5pbmRlbnRDb250ZW50KGZyb20sIHRpbGwpO1xuICAgIH1cbiAgfVxuXG4gIGluZGVudENvbnRlbnQoaW5kZW50UG9zOiBudW1iZXIsIGluZGVudENoYXJzOiBzdHJpbmcpIHtcbiAgICB0aGlzLmluZGVudCA9XG4gICAgICB0aGlzLmluZGVudC5zbGljZSgwLCBpbmRlbnRQb3MpICtcbiAgICAgIGluZGVudENoYXJzICtcbiAgICAgIHRoaXMuaW5kZW50LnNsaWNlKGluZGVudFBvcyk7XG4gICAgaWYgKHRoaXMubm90ZXNJbmRlbnQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMubm90ZXNJbmRlbnQgPVxuICAgICAgICB0aGlzLm5vdGVzSW5kZW50LnNsaWNlKDAsIGluZGVudFBvcykgK1xuICAgICAgICBpbmRlbnRDaGFycyArXG4gICAgICAgIHRoaXMubm90ZXNJbmRlbnQuc2xpY2UoaW5kZW50UG9zKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pIHtcbiAgICAgIGNoaWxkLmluZGVudENvbnRlbnQoaW5kZW50UG9zLCBpbmRlbnRDaGFycyk7XG4gICAgfVxuICB9XG5cbiAgZ2V0Rmlyc3RMaW5lSW5kZW50KCkge1xuICAgIHJldHVybiB0aGlzLmluZGVudDtcbiAgfVxuXG4gIGdldEJ1bGxldCgpIHtcbiAgICByZXR1cm4gdGhpcy5idWxsZXQ7XG4gIH1cblxuICBnZXRTcGFjZUFmdGVyQnVsbGV0KCkge1xuICAgIHJldHVybiB0aGlzLnNwYWNlQWZ0ZXJCdWxsZXQ7XG4gIH1cblxuICBnZXRDaGVja2JveExlbmd0aCgpIHtcbiAgICByZXR1cm4gdGhpcy5vcHRpb25hbENoZWNrYm94Lmxlbmd0aDtcbiAgfVxuXG4gIHJlcGxhdGVCdWxsZXQoYnVsbGV0OiBzdHJpbmcpIHtcbiAgICB0aGlzLmJ1bGxldCA9IGJ1bGxldDtcbiAgfVxuXG4gIGdldFBhcmVudCgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnQ7XG4gIH1cblxuICBhZGRCZWZvcmVBbGwobGlzdDogTGlzdCkge1xuICAgIHRoaXMuY2hpbGRyZW4udW5zaGlmdChsaXN0KTtcbiAgICBsaXN0LnBhcmVudCA9IHRoaXM7XG4gIH1cblxuICBhZGRBZnRlckFsbChsaXN0OiBMaXN0KSB7XG4gICAgdGhpcy5jaGlsZHJlbi5wdXNoKGxpc3QpO1xuICAgIGxpc3QucGFyZW50ID0gdGhpcztcbiAgfVxuXG4gIHJlbW92ZUNoaWxkKGxpc3Q6IExpc3QpIHtcbiAgICBjb25zdCBpID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGxpc3QpO1xuICAgIHRoaXMuY2hpbGRyZW4uc3BsaWNlKGksIDEpO1xuICAgIGxpc3QucGFyZW50ID0gbnVsbDtcbiAgfVxuXG4gIGFkZEJlZm9yZShiZWZvcmU6IExpc3QsIGxpc3Q6IExpc3QpIHtcbiAgICBjb25zdCBpID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGJlZm9yZSk7XG4gICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaSwgMCwgbGlzdCk7XG4gICAgbGlzdC5wYXJlbnQgPSB0aGlzO1xuICB9XG5cbiAgYWRkQWZ0ZXIoYmVmb3JlOiBMaXN0LCBsaXN0OiBMaXN0KSB7XG4gICAgY29uc3QgaSA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZihiZWZvcmUpO1xuICAgIHRoaXMuY2hpbGRyZW4uc3BsaWNlKGkgKyAxLCAwLCBsaXN0KTtcbiAgICBsaXN0LnBhcmVudCA9IHRoaXM7XG4gIH1cblxuICBnZXRQcmV2U2libGluZ09mKGxpc3Q6IExpc3QpIHtcbiAgICBjb25zdCBpID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGxpc3QpO1xuICAgIHJldHVybiBpID4gMCA/IHRoaXMuY2hpbGRyZW5baSAtIDFdIDogbnVsbDtcbiAgfVxuXG4gIGdldE5leHRTaWJsaW5nT2YobGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YobGlzdCk7XG4gICAgcmV0dXJuIGkgPj0gMCAmJiBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGggPyB0aGlzLmNoaWxkcmVuW2kgKyAxXSA6IG51bGw7XG4gIH1cblxuICBpc0VtcHR5KCkge1xuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmxlbmd0aCA9PT0gMDtcbiAgfVxuXG4gIHByaW50KCkge1xuICAgIGxldCByZXMgPSBcIlwiO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXMgKz1cbiAgICAgICAgaSA9PT0gMFxuICAgICAgICAgID8gdGhpcy5pbmRlbnQgKyB0aGlzLmJ1bGxldCArIHRoaXMuc3BhY2VBZnRlckJ1bGxldFxuICAgICAgICAgIDogdGhpcy5ub3Rlc0luZGVudDtcbiAgICAgIHJlcyArPSB0aGlzLmxpbmVzW2ldO1xuICAgICAgcmVzICs9IFwiXFxuXCI7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiB0aGlzLmNoaWxkcmVuKSB7XG4gICAgICByZXMgKz0gY2hpbGQucHJpbnQoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgY2xvbmUobmV3Um9vdDogUm9vdCkge1xuICAgIGNvbnN0IGNsb25lID0gbmV3IExpc3QoXG4gICAgICBuZXdSb290LFxuICAgICAgdGhpcy5pbmRlbnQsXG4gICAgICB0aGlzLmJ1bGxldCxcbiAgICAgIHRoaXMub3B0aW9uYWxDaGVja2JveCxcbiAgICAgIHRoaXMuc3BhY2VBZnRlckJ1bGxldCxcbiAgICAgIFwiXCIsXG4gICAgICB0aGlzLmZvbGRSb290LFxuICAgICk7XG4gICAgY2xvbmUuaWQgPSB0aGlzLmlkO1xuICAgIGNsb25lLmxpbmVzID0gdGhpcy5saW5lcy5jb25jYXQoKTtcbiAgICBjbG9uZS5ub3Rlc0luZGVudCA9IHRoaXMubm90ZXNJbmRlbnQ7XG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiB0aGlzLmNoaWxkcmVuKSB7XG4gICAgICBjbG9uZS5hZGRBZnRlckFsbChjaGlsZC5jbG9uZShuZXdSb290KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBSb290IHtcbiAgcHJpdmF0ZSByb290TGlzdCA9IG5ldyBMaXN0KHRoaXMsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIFwiXCIsIGZhbHNlKTtcbiAgcHJpdmF0ZSBzZWxlY3Rpb25zOiBSYW5nZVtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBzdGFydDogUG9zaXRpb24sXG4gICAgcHJpdmF0ZSBlbmQ6IFBvc2l0aW9uLFxuICAgIHNlbGVjdGlvbnM6IFJhbmdlW10sXG4gICkge1xuICAgIHRoaXMucmVwbGFjZVNlbGVjdGlvbnMoc2VsZWN0aW9ucyk7XG4gIH1cblxuICBnZXRSb290TGlzdCgpIHtcbiAgICByZXR1cm4gdGhpcy5yb290TGlzdDtcbiAgfVxuXG4gIGdldENvbnRlbnRSYW5nZSgpOiBbUG9zaXRpb24sIFBvc2l0aW9uXSB7XG4gICAgcmV0dXJuIFt0aGlzLmdldENvbnRlbnRTdGFydCgpLCB0aGlzLmdldENvbnRlbnRFbmQoKV07XG4gIH1cblxuICBnZXRDb250ZW50U3RhcnQoKTogUG9zaXRpb24ge1xuICAgIHJldHVybiB7IC4uLnRoaXMuc3RhcnQgfTtcbiAgfVxuXG4gIGdldENvbnRlbnRFbmQoKTogUG9zaXRpb24ge1xuICAgIHJldHVybiB7IC4uLnRoaXMuZW5kIH07XG4gIH1cblxuICBnZXRTZWxlY3Rpb25zKCk6IFJhbmdlW10ge1xuICAgIHJldHVybiB0aGlzLnNlbGVjdGlvbnMubWFwKChzKSA9PiAoe1xuICAgICAgYW5jaG9yOiB7IC4uLnMuYW5jaG9yIH0sXG4gICAgICBoZWFkOiB7IC4uLnMuaGVhZCB9LFxuICAgIH0pKTtcbiAgfVxuXG4gIGhhc1NpbmdsZUN1cnNvcigpIHtcbiAgICBpZiAoIXRoaXMuaGFzU2luZ2xlU2VsZWN0aW9uKCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBzZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGlvbnNbMF07XG5cbiAgICByZXR1cm4gKFxuICAgICAgc2VsZWN0aW9uLmFuY2hvci5saW5lID09PSBzZWxlY3Rpb24uaGVhZC5saW5lICYmXG4gICAgICBzZWxlY3Rpb24uYW5jaG9yLmNoID09PSBzZWxlY3Rpb24uaGVhZC5jaFxuICAgICk7XG4gIH1cblxuICBoYXNTaW5nbGVTZWxlY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0aW9ucy5sZW5ndGggPT09IDE7XG4gIH1cblxuICBnZXRTZWxlY3Rpb24oKSB7XG4gICAgY29uc3Qgc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb25zW3RoaXMuc2VsZWN0aW9ucy5sZW5ndGggLSAxXTtcblxuICAgIGNvbnN0IGZyb20gPVxuICAgICAgc2VsZWN0aW9uLmFuY2hvci5jaCA+IHNlbGVjdGlvbi5oZWFkLmNoXG4gICAgICAgID8gc2VsZWN0aW9uLmhlYWQuY2hcbiAgICAgICAgOiBzZWxlY3Rpb24uYW5jaG9yLmNoO1xuICAgIGNvbnN0IHRvID1cbiAgICAgIHNlbGVjdGlvbi5hbmNob3IuY2ggPiBzZWxlY3Rpb24uaGVhZC5jaFxuICAgICAgICA/IHNlbGVjdGlvbi5hbmNob3IuY2hcbiAgICAgICAgOiBzZWxlY3Rpb24uaGVhZC5jaDtcblxuICAgIHJldHVybiB7XG4gICAgICAuLi5zZWxlY3Rpb24sXG4gICAgICBmcm9tLFxuICAgICAgdG8sXG4gICAgfTtcbiAgfVxuXG4gIGdldEN1cnNvcigpIHtcbiAgICByZXR1cm4geyAuLi50aGlzLnNlbGVjdGlvbnNbdGhpcy5zZWxlY3Rpb25zLmxlbmd0aCAtIDFdLmhlYWQgfTtcbiAgfVxuXG4gIHJlcGxhY2VDdXJzb3IoY3Vyc29yOiBQb3NpdGlvbikge1xuICAgIHRoaXMuc2VsZWN0aW9ucyA9IFt7IGFuY2hvcjogY3Vyc29yLCBoZWFkOiBjdXJzb3IgfV07XG4gIH1cblxuICByZXBsYWNlU2VsZWN0aW9ucyhzZWxlY3Rpb25zOiBSYW5nZVtdKSB7XG4gICAgaWYgKHNlbGVjdGlvbnMubGVuZ3RoIDwgMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gY3JlYXRlIFJvb3Qgd2l0aG91dCBzZWxlY3Rpb25zYCk7XG4gICAgfVxuICAgIHRoaXMuc2VsZWN0aW9ucyA9IHNlbGVjdGlvbnM7XG4gIH1cblxuICBnZXRMaXN0VW5kZXJDdXJzb3IoKTogTGlzdCB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0TGlzdFVuZGVyTGluZSh0aGlzLmdldEN1cnNvcigpLmxpbmUpO1xuICB9XG5cbiAgZ2V0TGlzdFVuZGVyTGluZShsaW5lOiBudW1iZXIpIHtcbiAgICBpZiAobGluZSA8IHRoaXMuc3RhcnQubGluZSB8fCBsaW5lID4gdGhpcy5lbmQubGluZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCByZXN1bHQ6IExpc3QgPSBudWxsO1xuICAgIGxldCBpbmRleDogbnVtYmVyID0gdGhpcy5zdGFydC5saW5lO1xuXG4gICAgY29uc3QgdmlzaXRBcnIgPSAobGw6IExpc3RbXSkgPT4ge1xuICAgICAgZm9yIChjb25zdCBsIG9mIGxsKSB7XG4gICAgICAgIGNvbnN0IGxpc3RGcm9tTGluZSA9IGluZGV4O1xuICAgICAgICBjb25zdCBsaXN0VGlsbExpbmUgPSBsaXN0RnJvbUxpbmUgKyBsLmdldExpbmVDb3VudCgpIC0gMTtcblxuICAgICAgICBpZiAobGluZSA+PSBsaXN0RnJvbUxpbmUgJiYgbGluZSA8PSBsaXN0VGlsbExpbmUpIHtcbiAgICAgICAgICByZXN1bHQgPSBsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGluZGV4ID0gbGlzdFRpbGxMaW5lICsgMTtcbiAgICAgICAgICB2aXNpdEFycihsLmdldENoaWxkcmVuKCkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdmlzaXRBcnIodGhpcy5yb290TGlzdC5nZXRDaGlsZHJlbigpKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBnZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3Q6IExpc3QpOiBbbnVtYmVyLCBudW1iZXJdIHwgbnVsbCB7XG4gICAgbGV0IHJlc3VsdDogW251bWJlciwgbnVtYmVyXSB8IG51bGwgPSBudWxsO1xuICAgIGxldCBsaW5lOiBudW1iZXIgPSB0aGlzLnN0YXJ0LmxpbmU7XG5cbiAgICBjb25zdCB2aXNpdEFyciA9IChsbDogTGlzdFtdKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGwgb2YgbGwpIHtcbiAgICAgICAgY29uc3QgbGlzdEZyb21MaW5lID0gbGluZTtcbiAgICAgICAgY29uc3QgbGlzdFRpbGxMaW5lID0gbGlzdEZyb21MaW5lICsgbC5nZXRMaW5lQ291bnQoKSAtIDE7XG5cbiAgICAgICAgaWYgKGwgPT09IGxpc3QpIHtcbiAgICAgICAgICByZXN1bHQgPSBbbGlzdEZyb21MaW5lLCBsaXN0VGlsbExpbmVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxpbmUgPSBsaXN0VGlsbExpbmUgKyAxO1xuICAgICAgICAgIHZpc2l0QXJyKGwuZ2V0Q2hpbGRyZW4oKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIHZpc2l0QXJyKHRoaXMucm9vdExpc3QuZ2V0Q2hpbGRyZW4oKSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgZ2V0Q2hpbGRyZW4oKSB7XG4gICAgcmV0dXJuIHRoaXMucm9vdExpc3QuZ2V0Q2hpbGRyZW4oKTtcbiAgfVxuXG4gIHByaW50KCkge1xuICAgIGxldCByZXMgPSBcIlwiO1xuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiB0aGlzLnJvb3RMaXN0LmdldENoaWxkcmVuKCkpIHtcbiAgICAgIHJlcyArPSBjaGlsZC5wcmludCgpO1xuICAgIH1cblxuICAgIHJldHVybiByZXMucmVwbGFjZSgvXFxuJC8sIFwiXCIpO1xuICB9XG5cbiAgY2xvbmUoKSB7XG4gICAgY29uc3QgY2xvbmUgPSBuZXcgUm9vdChcbiAgICAgIHsgLi4udGhpcy5zdGFydCB9LFxuICAgICAgeyAuLi50aGlzLmVuZCB9LFxuICAgICAgdGhpcy5nZXRTZWxlY3Rpb25zKCksXG4gICAgKTtcbiAgICBjbG9uZS5yb290TGlzdCA9IHRoaXMucm9vdExpc3QuY2xvbmUoY2xvbmUpO1xuICAgIHJldHVybiBjbG9uZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7XG4gIExpc3QsXG4gIExpc3RMaW5lLFxuICBQb3NpdGlvbixcbiAgUm9vdCxcbiAgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyxcbn0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIERlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXNJbmZvKCk7XG5cbiAgICBjb25zdCBsaW5lTm8gPSBsaW5lcy5maW5kSW5kZXgoXG4gICAgICAobCkgPT4gY3Vyc29yLmNoID09PSBsLmZyb20uY2ggJiYgY3Vyc29yLmxpbmUgPT09IGwuZnJvbS5saW5lLFxuICAgICk7XG5cbiAgICBpZiAobGluZU5vID09PSAwKSB7XG4gICAgICB0aGlzLm1lcmdlV2l0aFByZXZpb3VzSXRlbShyb290LCBjdXJzb3IsIGxpc3QpO1xuICAgIH0gZWxzZSBpZiAobGluZU5vID4gMCkge1xuICAgICAgdGhpcy5tZXJnZU5vdGVzKHJvb3QsIGN1cnNvciwgbGlzdCwgbGluZXMsIGxpbmVObyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBtZXJnZU5vdGVzKFxuICAgIHJvb3Q6IFJvb3QsXG4gICAgY3Vyc29yOiBQb3NpdGlvbixcbiAgICBsaXN0OiBMaXN0LFxuICAgIGxpbmVzOiBMaXN0TGluZVtdLFxuICAgIGxpbmVObzogbnVtYmVyLFxuICApIHtcbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGNvbnN0IHByZXZMaW5lTm8gPSBsaW5lTm8gLSAxO1xuXG4gICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHtcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lIC0gMSxcbiAgICAgIGNoOiBsaW5lc1twcmV2TGluZU5vXS50ZXh0Lmxlbmd0aCArIGxpbmVzW3ByZXZMaW5lTm9dLmZyb20uY2gsXG4gICAgfSk7XG5cbiAgICBsaW5lc1twcmV2TGluZU5vXS50ZXh0ICs9IGxpbmVzW2xpbmVOb10udGV4dDtcbiAgICBsaW5lcy5zcGxpY2UobGluZU5vLCAxKTtcblxuICAgIGxpc3QucmVwbGFjZUxpbmVzKGxpbmVzLm1hcCgobCkgPT4gbC50ZXh0KSk7XG4gIH1cblxuICBwcml2YXRlIG1lcmdlV2l0aFByZXZpb3VzSXRlbShyb290OiBSb290LCBjdXJzb3I6IFBvc2l0aW9uLCBsaXN0OiBMaXN0KSB7XG4gICAgaWYgKHJvb3QuZ2V0Q2hpbGRyZW4oKVswXSA9PT0gbGlzdCAmJiBsaXN0LmlzRW1wdHkoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcblxuICAgIGNvbnN0IHByZXYgPSByb290LmdldExpc3RVbmRlckxpbmUoY3Vyc29yLmxpbmUgLSAxKTtcblxuICAgIGlmICghcHJldikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGJvdGhBcmVFbXB0eSA9IHByZXYuaXNFbXB0eSgpICYmIGxpc3QuaXNFbXB0eSgpO1xuICAgIGNvbnN0IHByZXZJc0VtcHR5QW5kU2FtZUxldmVsID1cbiAgICAgIHByZXYuaXNFbXB0eSgpICYmICFsaXN0LmlzRW1wdHkoKSAmJiBwcmV2LmdldExldmVsKCkgPT09IGxpc3QuZ2V0TGV2ZWwoKTtcbiAgICBjb25zdCBsaXN0SXNFbXB0eUFuZFByZXZJc1BhcmVudCA9XG4gICAgICBsaXN0LmlzRW1wdHkoKSAmJiBwcmV2LmdldExldmVsKCkgPT09IGxpc3QuZ2V0TGV2ZWwoKSAtIDE7XG5cbiAgICBpZiAoYm90aEFyZUVtcHR5IHx8IHByZXZJc0VtcHR5QW5kU2FtZUxldmVsIHx8IGxpc3RJc0VtcHR5QW5kUHJldklzUGFyZW50KSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xuICAgICAgY29uc3QgcHJldkVuZCA9IHByZXYuZ2V0TGFzdExpbmVDb250ZW50RW5kKCk7XG5cbiAgICAgIGlmICghcHJldi5nZXROb3Rlc0luZGVudCgpICYmIGxpc3QuZ2V0Tm90ZXNJbmRlbnQoKSkge1xuICAgICAgICBwcmV2LnNldE5vdGVzSW5kZW50KFxuICAgICAgICAgIHByZXYuZ2V0Rmlyc3RMaW5lSW5kZW50KCkgK1xuICAgICAgICAgICAgbGlzdC5nZXROb3Rlc0luZGVudCgpLnNsaWNlKGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoKSxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb2xkTGluZXMgPSBwcmV2LmdldExpbmVzKCk7XG4gICAgICBjb25zdCBuZXdMaW5lcyA9IGxpc3QuZ2V0TGluZXMoKTtcbiAgICAgIG9sZExpbmVzW29sZExpbmVzLmxlbmd0aCAtIDFdICs9IG5ld0xpbmVzWzBdO1xuICAgICAgY29uc3QgcmVzdWx0TGluZXMgPSBvbGRMaW5lcy5jb25jYXQobmV3TGluZXMuc2xpY2UoMSkpO1xuXG4gICAgICBwcmV2LnJlcGxhY2VMaW5lcyhyZXN1bHRMaW5lcyk7XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobGlzdCk7XG5cbiAgICAgIGZvciAoY29uc3QgYyBvZiBsaXN0LmdldENoaWxkcmVuKCkpIHtcbiAgICAgICAgbGlzdC5yZW1vdmVDaGlsZChjKTtcbiAgICAgICAgcHJldi5hZGRBZnRlckFsbChjKTtcbiAgICAgIH1cblxuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHByZXZFbmQpO1xuXG4gICAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3QpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgRGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9EZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZFwiO1xuaW1wb3J0IHsgSU1FRGV0ZWN0b3IgfSBmcm9tIFwiLi4vc2VydmljZXMvSU1FRGV0ZWN0b3JcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5pbXBvcnQgeyBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVLZXltYXBSdW5DYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgQmFja3NwYWNlQmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIGltZURldGVjdG9yOiBJTUVEZXRlY3RvcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIGtleW1hcC5vZihbXG4gICAgICAgIHtcbiAgICAgICAgICBrZXk6IFwiQmFja3NwYWNlXCIsXG4gICAgICAgICAgcnVuOiBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgIHJ1bjogdGhpcy5ydW4sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICBdKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIGNoZWNrID0gKCkgPT4ge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLnNldHRpbmdzLmtlZXBDdXJzb3JXaXRoaW5Db250ZW50ICE9PSBcIm5ldmVyXCIgJiZcbiAgICAgICF0aGlzLmltZURldGVjdG9yLmlzT3BlbmVkKClcbiAgICApO1xuICB9O1xuXG4gIHByaXZhdGUgcnVuID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICByZXR1cm4gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIucGVyZm9ybShcbiAgICAgIChyb290KSA9PiBuZXcgRGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE9ic2lkaWFuU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXR0aW5nc1wiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcblxuY29uc3QgQkVUVEVSX0xJU1RTX0JPRFlfQ0xBU1MgPSBcIm91dGxpbmVyLXBsdWdpbi1iZXR0ZXItbGlzdHNcIjtcblxuZXhwb3J0IGNsYXNzIEJldHRlckxpc3RzU3R5bGVzIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIHByaXZhdGUgdXBkYXRlQm9keUNsYXNzSW50ZXJ2YWw6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIG9ic2lkaWFuU2V0dGluZ3M6IE9ic2lkaWFuU2V0dGluZ3MsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMudXBkYXRlQm9keUNsYXNzKCk7XG4gICAgdGhpcy51cGRhdGVCb2R5Q2xhc3NJbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZUJvZHlDbGFzcygpO1xuICAgIH0sIDEwMDApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge1xuICAgIGNsZWFySW50ZXJ2YWwodGhpcy51cGRhdGVCb2R5Q2xhc3NJbnRlcnZhbCk7XG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKEJFVFRFUl9MSVNUU19CT0RZX0NMQVNTKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlQm9keUNsYXNzID0gKCkgPT4ge1xuICAgIGNvbnN0IHNob3VsZEV4aXN0cyA9XG4gICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MuaXNEZWZhdWx0VGhlbWVFbmFibGVkKCkgJiZcbiAgICAgIHRoaXMuc2V0dGluZ3MuYmV0dGVyTGlzdHNTdHlsZXM7XG4gICAgY29uc3QgZXhpc3RzID0gZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuY29udGFpbnMoQkVUVEVSX0xJU1RTX0JPRFlfQ0xBU1MpO1xuXG4gICAgaWYgKHNob3VsZEV4aXN0cyAmJiAhZXhpc3RzKSB7XG4gICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoQkVUVEVSX0xJU1RTX0JPRFlfQ0xBU1MpO1xuICAgIH1cblxuICAgIGlmICghc2hvdWxkRXhpc3RzICYmIGV4aXN0cykge1xuICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKEJFVFRFUl9MSVNUU19CT0RZX0NMQVNTKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCwgbWF4UG9zLCBtaW5Qb3MgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgU2VsZWN0QWxsQ29udGVudCBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVTZWxlY3Rpb24oKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHNlbGVjdGlvbiA9IHJvb3QuZ2V0U2VsZWN0aW9ucygpWzBdO1xuICAgIGNvbnN0IFtyb290U3RhcnQsIHJvb3RFbmRdID0gcm9vdC5nZXRDb250ZW50UmFuZ2UoKTtcblxuICAgIGNvbnN0IHNlbGVjdGlvbkZyb20gPSBtaW5Qb3Moc2VsZWN0aW9uLmFuY2hvciwgc2VsZWN0aW9uLmhlYWQpO1xuICAgIGNvbnN0IHNlbGVjdGlvblRvID0gbWF4UG9zKHNlbGVjdGlvbi5hbmNob3IsIHNlbGVjdGlvbi5oZWFkKTtcblxuICAgIGlmIChcbiAgICAgIHNlbGVjdGlvbkZyb20ubGluZSA8IHJvb3RTdGFydC5saW5lIHx8XG4gICAgICBzZWxlY3Rpb25Uby5saW5lID4gcm9vdEVuZC5saW5lXG4gICAgKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgc2VsZWN0aW9uRnJvbS5saW5lID09PSByb290U3RhcnQubGluZSAmJlxuICAgICAgc2VsZWN0aW9uRnJvbS5jaCA9PT0gcm9vdFN0YXJ0LmNoICYmXG4gICAgICBzZWxlY3Rpb25Uby5saW5lID09PSByb290RW5kLmxpbmUgJiZcbiAgICAgIHNlbGVjdGlvblRvLmNoID09PSByb290RW5kLmNoXG4gICAgKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgY29udGVudFN0YXJ0ID0gbGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnRBZnRlckNoZWNrYm94KCk7XG4gICAgY29uc3QgY29udGVudEVuZCA9IGxpc3QuZ2V0TGFzdExpbmVDb250ZW50RW5kKCk7XG4gICAgY29uc3QgbGlzdFVuZGVyU2VsZWN0aW9uRnJvbSA9IHJvb3QuZ2V0TGlzdFVuZGVyTGluZShzZWxlY3Rpb25Gcm9tLmxpbmUpO1xuICAgIGNvbnN0IGxpc3RTdGFydCA9XG4gICAgICBsaXN0VW5kZXJTZWxlY3Rpb25Gcm9tLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydEFmdGVyQ2hlY2tib3goKTtcbiAgICBjb25zdCBsaXN0RW5kID0gbGlzdFVuZGVyU2VsZWN0aW9uRnJvbS5nZXRDb250ZW50RW5kSW5jbHVkaW5nQ2hpbGRyZW4oKTtcblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgaWYgKFxuICAgICAgc2VsZWN0aW9uRnJvbS5saW5lID09PSBjb250ZW50U3RhcnQubGluZSAmJlxuICAgICAgc2VsZWN0aW9uRnJvbS5jaCA9PT0gY29udGVudFN0YXJ0LmNoICYmXG4gICAgICBzZWxlY3Rpb25Uby5saW5lID09PSBjb250ZW50RW5kLmxpbmUgJiZcbiAgICAgIHNlbGVjdGlvblRvLmNoID09PSBjb250ZW50RW5kLmNoXG4gICAgKSB7XG4gICAgICBpZiAobGlzdC5nZXRDaGlsZHJlbigpLmxlbmd0aCkge1xuICAgICAgICAvLyBzZWxlY3Qgc3ViIGxpc3RzXG4gICAgICAgIHJvb3QucmVwbGFjZVNlbGVjdGlvbnMoW1xuICAgICAgICAgIHsgYW5jaG9yOiBjb250ZW50U3RhcnQsIGhlYWQ6IGxpc3QuZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCkgfSxcbiAgICAgICAgXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBzZWxlY3Qgd2hvbGUgbGlzdFxuICAgICAgICByb290LnJlcGxhY2VTZWxlY3Rpb25zKFt7IGFuY2hvcjogcm9vdFN0YXJ0LCBoZWFkOiByb290RW5kIH1dKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgbGlzdFN0YXJ0LmNoID09IHNlbGVjdGlvbkZyb20uY2ggJiZcbiAgICAgIGxpc3RFbmQubGluZSA9PSBzZWxlY3Rpb25Uby5saW5lICYmXG4gICAgICBsaXN0RW5kLmNoID09IHNlbGVjdGlvblRvLmNoXG4gICAgKSB7XG4gICAgICAvLyBzZWxlY3Qgd2hvbGUgbGlzdFxuICAgICAgcm9vdC5yZXBsYWNlU2VsZWN0aW9ucyhbeyBhbmNob3I6IHJvb3RTdGFydCwgaGVhZDogcm9vdEVuZCB9XSk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIChzZWxlY3Rpb25Gcm9tLmxpbmUgPiBjb250ZW50U3RhcnQubGluZSB8fFxuICAgICAgICAoc2VsZWN0aW9uRnJvbS5saW5lID09IGNvbnRlbnRTdGFydC5saW5lICYmXG4gICAgICAgICAgc2VsZWN0aW9uRnJvbS5jaCA+PSBjb250ZW50U3RhcnQuY2gpKSAmJlxuICAgICAgKHNlbGVjdGlvblRvLmxpbmUgPCBjb250ZW50RW5kLmxpbmUgfHxcbiAgICAgICAgKHNlbGVjdGlvblRvLmxpbmUgPT0gY29udGVudEVuZC5saW5lICYmXG4gICAgICAgICAgc2VsZWN0aW9uVG8uY2ggPD0gY29udGVudEVuZC5jaCkpXG4gICAgKSB7XG4gICAgICAvLyBzZWxlY3Qgd2hvbGUgbGluZVxuICAgICAgcm9vdC5yZXBsYWNlU2VsZWN0aW9ucyhbeyBhbmNob3I6IGNvbnRlbnRTdGFydCwgaGVhZDogY29udGVudEVuZCB9XSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSBmYWxzZTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgU2VsZWN0QWxsQ29udGVudCB9IGZyb20gXCIuLi9vcGVyYXRpb25zL1NlbGVjdEFsbENvbnRlbnRcIjtcbmltcG9ydCB7IElNRURldGVjdG9yIH0gZnJvbSBcIi4uL3NlcnZpY2VzL0lNRURldGVjdG9yXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuaW1wb3J0IHsgY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2sgfSBmcm9tIFwiLi4vdXRpbHMvY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2tcIjtcblxuZXhwb3J0IGNsYXNzIEN0cmxBQW5kQ21kQUJlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBpbWVEZXRlY3RvcjogSU1FRGV0ZWN0b3IsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBrZXltYXAub2YoW1xuICAgICAgICB7XG4gICAgICAgICAga2V5OiBcImMtYVwiLFxuICAgICAgICAgIG1hYzogXCJtLWFcIixcbiAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVTZWxlY3RBbGxCZWhhdmlvdXIgJiYgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKVxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBTZWxlY3RBbGxDb250ZW50KHJvb3QpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG4gIH07XG59XG4iLCJpbXBvcnQgeyBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZCB9IGZyb20gXCIuL0RlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kXCI7XG5pbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVUaWxsTmV4dExpbmVDb250ZW50U3RhcnQgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIGRlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kOiBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHtcbiAgICB0aGlzLmRlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kID1cbiAgICAgIG5ldyBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZChyb290KTtcbiAgfVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5kZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZC5zaG91bGRTdG9wUHJvcGFnYXRpb24oKTtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5kZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZC5zaG91bGRVcGRhdGUoKTtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXNJbmZvKCk7XG5cbiAgICBjb25zdCBsaW5lTm8gPSBsaW5lcy5maW5kSW5kZXgoXG4gICAgICAobCkgPT4gY3Vyc29yLmNoID09PSBsLnRvLmNoICYmIGN1cnNvci5saW5lID09PSBsLnRvLmxpbmUsXG4gICAgKTtcblxuICAgIGlmIChsaW5lTm8gPT09IGxpbmVzLmxlbmd0aCAtIDEpIHtcbiAgICAgIGNvbnN0IG5leHRMaW5lID0gbGluZXNbbGluZU5vXS50by5saW5lICsgMTtcbiAgICAgIGNvbnN0IG5leHRMaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJMaW5lKG5leHRMaW5lKTtcbiAgICAgIGlmICghbmV4dExpc3QpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKG5leHRMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpKTtcbiAgICAgIHRoaXMuZGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQucGVyZm9ybSgpO1xuICAgIH0gZWxzZSBpZiAobGluZU5vID49IDApIHtcbiAgICAgIHJvb3QucmVwbGFjZUN1cnNvcihsaW5lc1tsaW5lTm8gKyAxXS5mcm9tKTtcbiAgICAgIHRoaXMuZGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQucGVyZm9ybSgpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgRGVsZXRlVGlsbE5leHRMaW5lQ29udGVudFN0YXJ0IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvRGVsZXRlVGlsbE5leHRMaW5lQ29udGVudFN0YXJ0XCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVCZWhhdmlvdXJPdmVycmlkZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAge1xuICAgICAgICAgIGtleTogXCJEZWxldGVcIixcbiAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgIT09IFwibmV2ZXJcIiAmJlxuICAgICAgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKVxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBEZWxldGVUaWxsTmV4dExpbmVDb250ZW50U3RhcnQocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBMaXN0LCBSb290LCByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzIH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuaW50ZXJmYWNlIEN1cnNvckFuY2hvciB7XG4gIGN1cnNvckxpc3Q6IExpc3Q7XG4gIGxpbmVEaWZmOiBudW1iZXI7XG4gIGNoRGlmZjogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgTW92ZUxpc3RUb0RpZmZlcmVudFBvc2l0aW9uIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByb290OiBSb290LFxuICAgIHByaXZhdGUgbGlzdFRvTW92ZTogTGlzdCxcbiAgICBwcml2YXRlIHBsYWNlVG9Nb3ZlOiBMaXN0LFxuICAgIHByaXZhdGUgd2hlcmVUb01vdmU6IFwiYmVmb3JlXCIgfCBcImFmdGVyXCIgfCBcImluc2lkZVwiLFxuICAgIHByaXZhdGUgZGVmYXVsdEluZGVudENoYXJzOiBzdHJpbmcsXG4gICkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGlmICh0aGlzLmxpc3RUb01vdmUgPT09IHRoaXMucGxhY2VUb01vdmUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGNvbnN0IGN1cnNvckFuY2hvciA9IHRoaXMuY2FsY3VsYXRlQ3Vyc29yQW5jaG9yKCk7XG4gICAgdGhpcy5tb3ZlTGlzdCgpO1xuICAgIHRoaXMuY2hhbmdlSW5kZW50KCk7XG4gICAgdGhpcy5yZXN0b3JlQ3Vyc29yKGN1cnNvckFuY2hvcik7XG4gICAgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyh0aGlzLnJvb3QpO1xuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGVDdXJzb3JBbmNob3IoKTogQ3Vyc29yQW5jaG9yIHtcbiAgICBjb25zdCBjdXJzb3JMaW5lID0gdGhpcy5yb290LmdldEN1cnNvcigpLmxpbmU7XG5cbiAgICBjb25zdCBsaW5lcyA9IFtcbiAgICAgIHRoaXMubGlzdFRvTW92ZS5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lLFxuICAgICAgdGhpcy5saXN0VG9Nb3ZlLmdldExhc3RMaW5lQ29udGVudEVuZCgpLmxpbmUsXG4gICAgICB0aGlzLnBsYWNlVG9Nb3ZlLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUsXG4gICAgICB0aGlzLnBsYWNlVG9Nb3ZlLmdldExhc3RMaW5lQ29udGVudEVuZCgpLmxpbmUsXG4gICAgXTtcbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lID0gTWF0aC5taW4oLi4ubGluZXMpO1xuICAgIGNvbnN0IGxpc3RFbmRMaW5lID0gTWF0aC5tYXgoLi4ubGluZXMpO1xuXG4gICAgaWYgKGN1cnNvckxpbmUgPCBsaXN0U3RhcnRMaW5lIHx8IGN1cnNvckxpbmUgPiBsaXN0RW5kTGluZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5yb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGN1cnNvckxpc3QgPSB0aGlzLnJvb3QuZ2V0TGlzdFVuZGVyTGluZShjdXJzb3IubGluZSk7XG4gICAgY29uc3QgY3Vyc29yTGlzdFN0YXJ0ID0gY3Vyc29yTGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKTtcbiAgICBjb25zdCBsaW5lRGlmZiA9IGN1cnNvci5saW5lIC0gY3Vyc29yTGlzdFN0YXJ0LmxpbmU7XG4gICAgY29uc3QgY2hEaWZmID0gY3Vyc29yLmNoIC0gY3Vyc29yTGlzdFN0YXJ0LmNoO1xuXG4gICAgcmV0dXJuIHsgY3Vyc29yTGlzdCwgbGluZURpZmYsIGNoRGlmZiB9O1xuICB9XG5cbiAgcHJpdmF0ZSBtb3ZlTGlzdCgpIHtcbiAgICB0aGlzLmxpc3RUb01vdmUuZ2V0UGFyZW50KCkucmVtb3ZlQ2hpbGQodGhpcy5saXN0VG9Nb3ZlKTtcblxuICAgIHN3aXRjaCAodGhpcy53aGVyZVRvTW92ZSkge1xuICAgICAgY2FzZSBcImJlZm9yZVwiOlxuICAgICAgICB0aGlzLnBsYWNlVG9Nb3ZlXG4gICAgICAgICAgLmdldFBhcmVudCgpXG4gICAgICAgICAgLmFkZEJlZm9yZSh0aGlzLnBsYWNlVG9Nb3ZlLCB0aGlzLmxpc3RUb01vdmUpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBcImFmdGVyXCI6XG4gICAgICAgIHRoaXMucGxhY2VUb01vdmVcbiAgICAgICAgICAuZ2V0UGFyZW50KClcbiAgICAgICAgICAuYWRkQWZ0ZXIodGhpcy5wbGFjZVRvTW92ZSwgdGhpcy5saXN0VG9Nb3ZlKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgXCJpbnNpZGVcIjpcbiAgICAgICAgdGhpcy5wbGFjZVRvTW92ZS5hZGRCZWZvcmVBbGwodGhpcy5saXN0VG9Nb3ZlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjaGFuZ2VJbmRlbnQoKSB7XG4gICAgY29uc3Qgb2xkSW5kZW50ID0gdGhpcy5saXN0VG9Nb3ZlLmdldEZpcnN0TGluZUluZGVudCgpO1xuICAgIGNvbnN0IG5ld0luZGVudCA9XG4gICAgICB0aGlzLndoZXJlVG9Nb3ZlID09PSBcImluc2lkZVwiXG4gICAgICAgID8gdGhpcy5wbGFjZVRvTW92ZS5nZXRGaXJzdExpbmVJbmRlbnQoKSArIHRoaXMuZGVmYXVsdEluZGVudENoYXJzXG4gICAgICAgIDogdGhpcy5wbGFjZVRvTW92ZS5nZXRGaXJzdExpbmVJbmRlbnQoKTtcbiAgICB0aGlzLmxpc3RUb01vdmUudW5pbmRlbnRDb250ZW50KDAsIG9sZEluZGVudC5sZW5ndGgpO1xuICAgIHRoaXMubGlzdFRvTW92ZS5pbmRlbnRDb250ZW50KDAsIG5ld0luZGVudCk7XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVDdXJzb3IoY3Vyc29yQW5jaG9yOiBDdXJzb3JBbmNob3IpIHtcbiAgICBpZiAoY3Vyc29yQW5jaG9yKSB7XG4gICAgICBjb25zdCBjdXJzb3JMaXN0U3RhcnQgPVxuICAgICAgICBjdXJzb3JBbmNob3IuY3Vyc29yTGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKTtcblxuICAgICAgdGhpcy5yb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgICBsaW5lOiBjdXJzb3JMaXN0U3RhcnQubGluZSArIGN1cnNvckFuY2hvci5saW5lRGlmZixcbiAgICAgICAgY2g6IGN1cnNvckxpc3RTdGFydC5jaCArIGN1cnNvckFuY2hvci5jaERpZmYsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2hlbiB5b3UgbW92ZSBhIGxpc3QsIHRoZSBzY3JlZW4gc2Nyb2xscyB0byB0aGUgY3Vyc29yLlxuICAgICAgLy8gSXQgaXMgYmV0dGVyIHRvIG1vdmUgdGhlIGN1cnNvciBpbnRvIHRoZSB2aWV3cG9ydCB0aGFuIGxldCB0aGUgc2NyZWVuIHNjcm9sbC5cbiAgICAgIHRoaXMucm9vdC5yZXBsYWNlQ3Vyc29yKHRoaXMubGlzdFRvTW92ZS5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKSk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBOb3RpY2UsIFBsYXRmb3JtLCBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgZ2V0SW5kZW50VW5pdCwgaW5kZW50U3RyaW5nIH0gZnJvbSBcIkBjb2RlbWlycm9yL2xhbmd1YWdlXCI7XG5pbXBvcnQgeyBTdGF0ZUVmZmVjdCwgU3RhdGVGaWVsZCB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsgRGVjb3JhdGlvbiwgRGVjb3JhdGlvblNldCwgRWRpdG9yVmlldyB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yLCBnZXRFZGl0b3JGcm9tU3RhdGUgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBNb3ZlTGlzdFRvRGlmZmVyZW50UG9zaXRpb24gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9Nb3ZlTGlzdFRvRGlmZmVyZW50UG9zaXRpb25cIjtcbmltcG9ydCB7IExpc3QsIFJvb3QsIGNtcFBvcyB9IGZyb20gXCIuLi9yb290XCI7XG5pbXBvcnQgeyBPYnNpZGlhblNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFBhcnNlciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QYXJzZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5cbmNvbnN0IEJPRFlfQ0xBU1MgPSBcIm91dGxpbmVyLXBsdWdpbi1kbmRcIjtcblxuZXhwb3J0IGNsYXNzIERyYWdBbmREcm9wIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIHByaXZhdGUgZHJvcFpvbmU6IEhUTUxEaXZFbGVtZW50O1xuICBwcml2YXRlIGRyb3Bab25lUGFkZGluZzogSFRNTERpdkVsZW1lbnQ7XG4gIHByaXZhdGUgcHJlU3RhcnQ6IERyYWdBbmREcm9wUHJlU3RhcnRTdGF0ZSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRlOiBEcmFnQW5kRHJvcFN0YXRlIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIG9iaXNpZGlhbjogT2JzaWRpYW5TZXR0aW5ncyxcbiAgICBwcml2YXRlIHBhcnNlcjogUGFyc2VyLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFtcbiAgICAgIGRyYWdnaW5nTGluZXNTdGF0ZUZpZWxkLFxuICAgICAgZHJvcHBpbmdMaW5lc1N0YXRlRmllbGQsXG4gICAgXSk7XG4gICAgdGhpcy5lbmFibGVGZWF0dXJlVG9nZ2xlKCk7XG4gICAgdGhpcy5jcmVhdGVEcm9wWm9uZSgpO1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHtcbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXJzKCk7XG4gICAgdGhpcy5yZW1vdmVEcm9wWm9uZSgpO1xuICAgIHRoaXMuZGlzYWJsZUZlYXR1cmVUb2dnbGUoKTtcbiAgfVxuXG4gIHByaXZhdGUgZW5hYmxlRmVhdHVyZVRvZ2dsZSgpIHtcbiAgICB0aGlzLnNldHRpbmdzLm9uQ2hhbmdlKHRoaXMuaGFuZGxlU2V0dGluZ3NDaGFuZ2UpO1xuICAgIHRoaXMuaGFuZGxlU2V0dGluZ3NDaGFuZ2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGlzYWJsZUZlYXR1cmVUb2dnbGUoKSB7XG4gICAgdGhpcy5zZXR0aW5ncy5yZW1vdmVDYWxsYmFjayh0aGlzLmhhbmRsZVNldHRpbmdzQ2hhbmdlKTtcbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoQk9EWV9DTEFTUyk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZURyb3Bab25lKCkge1xuICAgIHRoaXMuZHJvcFpvbmVQYWRkaW5nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB0aGlzLmRyb3Bab25lUGFkZGluZy5jbGFzc0xpc3QuYWRkKFwib3V0bGluZXItcGx1Z2luLWRyb3Atem9uZS1wYWRkaW5nXCIpO1xuICAgIHRoaXMuZHJvcFpvbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRoaXMuZHJvcFpvbmUuY2xhc3NMaXN0LmFkZChcIm91dGxpbmVyLXBsdWdpbi1kcm9wLXpvbmVcIik7XG4gICAgdGhpcy5kcm9wWm9uZS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgdGhpcy5kcm9wWm9uZS5hcHBlbmRDaGlsZCh0aGlzLmRyb3Bab25lUGFkZGluZyk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmRyb3Bab25lKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVtb3ZlRHJvcFpvbmUoKSB7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0aGlzLmRyb3Bab25lKTtcbiAgICB0aGlzLmRyb3Bab25lUGFkZGluZyA9IG51bGw7XG4gICAgdGhpcy5kcm9wWm9uZSA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIGFkZEV2ZW50TGlzdGVuZXJzKCkge1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgdGhpcy5oYW5kbGVNb3VzZURvd24sIHtcbiAgICAgIGNhcHR1cmU6IHRydWUsXG4gICAgfSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCB0aGlzLmhhbmRsZU1vdXNlTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgdGhpcy5oYW5kbGVNb3VzZVVwKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCB0aGlzLmhhbmRsZUtleURvd24pO1xuICB9XG5cbiAgcHJpdmF0ZSByZW1vdmVFdmVudExpc3RlbmVycygpIHtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMuaGFuZGxlTW91c2VEb3duLCB7XG4gICAgICBjYXB0dXJlOiB0cnVlLFxuICAgIH0pO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgdGhpcy5oYW5kbGVNb3VzZU1vdmUpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIHRoaXMuaGFuZGxlTW91c2VVcCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgdGhpcy5oYW5kbGVLZXlEb3duKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlU2V0dGluZ3NDaGFuZ2UgPSAoKSA9PiB7XG4gICAgaWYgKCFpc0ZlYXR1cmVTdXBwb3J0ZWQoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNldHRpbmdzLmRyYWdBbmREcm9wKSB7XG4gICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoQk9EWV9DTEFTUyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZShCT0RZX0NMQVNTKTtcbiAgICB9XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZURvd24gPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGlmIChcbiAgICAgICFpc0ZlYXR1cmVTdXBwb3J0ZWQoKSB8fFxuICAgICAgIXRoaXMuc2V0dGluZ3MuZHJhZ0FuZERyb3AgfHxcbiAgICAgICFpc0NsaWNrT25CdWxsZXQoZSlcbiAgICApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB2aWV3ID0gZ2V0RWRpdG9yVmlld0Zyb21IVE1MRWxlbWVudChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCk7XG4gICAgaWYgKCF2aWV3KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICB0aGlzLnByZVN0YXJ0ID0ge1xuICAgICAgeDogZS54LFxuICAgICAgeTogZS55LFxuICAgICAgdmlldyxcbiAgICB9O1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlTW91c2VNb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBpZiAodGhpcy5wcmVTdGFydCkge1xuICAgICAgdGhpcy5zdGFydERyYWdnaW5nKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0YXRlKSB7XG4gICAgICB0aGlzLmRldGVjdEFuZERyYXdEcm9wWm9uZShlLngsIGUueSk7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlTW91c2VVcCA9ICgpID0+IHtcbiAgICBpZiAodGhpcy5wcmVTdGFydCkge1xuICAgICAgdGhpcy5wcmVTdGFydCA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0YXRlKSB7XG4gICAgICB0aGlzLnN0b3BEcmFnZ2luZygpO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZUtleURvd24gPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgIGlmICh0aGlzLnN0YXRlICYmIGUuY29kZSA9PT0gXCJFc2NhcGVcIikge1xuICAgICAgdGhpcy5jYW5jZWxEcmFnZ2luZygpO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIHN0YXJ0RHJhZ2dpbmcoKSB7XG4gICAgY29uc3QgeyB4LCB5LCB2aWV3IH0gPSB0aGlzLnByZVN0YXJ0O1xuICAgIHRoaXMucHJlU3RhcnQgPSBudWxsO1xuXG4gICAgY29uc3QgZWRpdG9yID0gZ2V0RWRpdG9yRnJvbVN0YXRlKHZpZXcuc3RhdGUpO1xuICAgIGNvbnN0IHBvcyA9IGVkaXRvci5vZmZzZXRUb1Bvcyh2aWV3LnBvc0F0Q29vcmRzKHsgeCwgeSB9KSk7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMucGFyc2VyLnBhcnNlKGVkaXRvciwgcG9zKTtcbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJMaW5lKHBvcy5saW5lKTtcbiAgICBjb25zdCBzdGF0ZSA9IG5ldyBEcmFnQW5kRHJvcFN0YXRlKHZpZXcsIGVkaXRvciwgcm9vdCwgbGlzdCk7XG5cbiAgICBpZiAoIXN0YXRlLmhhc0Ryb3BWYXJpYW50cygpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuICAgIHRoaXMuaGlnaGxpZ2h0RHJhZ2dpbmdMaW5lcygpO1xuICB9XG5cbiAgcHJpdmF0ZSBkZXRlY3RBbmREcmF3RHJvcFpvbmUoeDogbnVtYmVyLCB5OiBudW1iZXIpIHtcbiAgICB0aGlzLnN0YXRlLmNhbGN1bGF0ZU5lYXJlc3REcm9wVmFyaWFudCh4LCB5KTtcbiAgICB0aGlzLmRyYXdEcm9wWm9uZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBjYW5jZWxEcmFnZ2luZygpIHtcbiAgICB0aGlzLnN0YXRlLmRyb3BWYXJpYW50ID0gbnVsbDtcbiAgICB0aGlzLnN0b3BEcmFnZ2luZygpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdG9wRHJhZ2dpbmcoKSB7XG4gICAgdGhpcy51bmhpZ2h0bGlnaHREcmFnZ2luZ0xpbmVzKCk7XG4gICAgdGhpcy5oaWRlRHJvcFpvbmUoKTtcbiAgICB0aGlzLmFwcGx5Q2hhbmdlcygpO1xuICAgIHRoaXMuc3RhdGUgPSBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhcHBseUNoYW5nZXMoKSB7XG4gICAgaWYgKCF0aGlzLnN0YXRlLmRyb3BWYXJpYW50KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgeyBzdGF0ZSB9ID0gdGhpcztcbiAgICBjb25zdCB7IGRyb3BWYXJpYW50LCBlZGl0b3IsIHJvb3QsIGxpc3QgfSA9IHN0YXRlO1xuXG4gICAgY29uc3QgbmV3Um9vdCA9IHRoaXMucGFyc2VyLnBhcnNlKGVkaXRvciwgcm9vdC5nZXRDb250ZW50U3RhcnQoKSk7XG4gICAgaWYgKCFpc1NhbWVSb290cyhyb290LCBuZXdSb290KSkge1xuICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgYFRoZSBpdGVtIGNhbm5vdCBiZSBtb3ZlZC4gVGhlIHBhZ2UgY29udGVudCBjaGFuZ2VkIGR1cmluZyB0aGUgbW92ZS5gLFxuICAgICAgICA1MDAwLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5ldmFsKFxuICAgICAgcm9vdCxcbiAgICAgIG5ldyBNb3ZlTGlzdFRvRGlmZmVyZW50UG9zaXRpb24oXG4gICAgICAgIHJvb3QsXG4gICAgICAgIGxpc3QsXG4gICAgICAgIGRyb3BWYXJpYW50LnBsYWNlVG9Nb3ZlLFxuICAgICAgICBkcm9wVmFyaWFudC53aGVyZVRvTW92ZSxcbiAgICAgICAgdGhpcy5vYmlzaWRpYW4uZ2V0RGVmYXVsdEluZGVudENoYXJzKCksXG4gICAgICApLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGhpZ2hsaWdodERyYWdnaW5nTGluZXMoKSB7XG4gICAgY29uc3QgeyBzdGF0ZSB9ID0gdGhpcztcbiAgICBjb25zdCB7IGxpc3QsIGVkaXRvciwgdmlldyB9ID0gc3RhdGU7XG5cbiAgICBjb25zdCBsaW5lcyA9IFtdO1xuICAgIGNvbnN0IGZyb21MaW5lID0gbGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lO1xuICAgIGNvbnN0IHRpbGxMaW5lID0gbGlzdC5nZXRDb250ZW50RW5kSW5jbHVkaW5nQ2hpbGRyZW4oKS5saW5lO1xuICAgIGZvciAobGV0IGkgPSBmcm9tTGluZTsgaSA8PSB0aWxsTGluZTsgaSsrKSB7XG4gICAgICBsaW5lcy5wdXNoKGVkaXRvci5wb3NUb09mZnNldCh7IGxpbmU6IGksIGNoOiAwIH0pKTtcbiAgICB9XG4gICAgdmlldy5kaXNwYXRjaCh7XG4gICAgICBlZmZlY3RzOiBbZG5kU3RhcnRlZC5vZihsaW5lcyldLFxuICAgIH0pO1xuXG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuYWRkKFwib3V0bGluZXItcGx1Z2luLWRyYWdnaW5nXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSB1bmhpZ2h0bGlnaHREcmFnZ2luZ0xpbmVzKCkge1xuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZShcIm91dGxpbmVyLXBsdWdpbi1kcmFnZ2luZ1wiKTtcblxuICAgIHRoaXMuc3RhdGUudmlldy5kaXNwYXRjaCh7XG4gICAgICBlZmZlY3RzOiBbZG5kRW5kZWQub2YoKV0sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGRyYXdEcm9wWm9uZSgpIHtcbiAgICBjb25zdCB7IHN0YXRlIH0gPSB0aGlzO1xuICAgIGNvbnN0IHsgdmlldywgZWRpdG9yLCBkcm9wVmFyaWFudCB9ID0gc3RhdGU7XG5cbiAgICBjb25zdCBuZXdQYXJlbnQgPVxuICAgICAgZHJvcFZhcmlhbnQud2hlcmVUb01vdmUgPT09IFwiaW5zaWRlXCJcbiAgICAgICAgPyBkcm9wVmFyaWFudC5wbGFjZVRvTW92ZVxuICAgICAgICA6IGRyb3BWYXJpYW50LnBsYWNlVG9Nb3ZlLmdldFBhcmVudCgpO1xuICAgIGNvbnN0IG5ld1BhcmVudElzUm9vdExpc3QgPSAhbmV3UGFyZW50LmdldFBhcmVudCgpO1xuXG4gICAge1xuICAgICAgY29uc3Qgd2lkdGggPSBNYXRoLnJvdW5kKFxuICAgICAgICB2aWV3LmNvbnRlbnRET00ub2Zmc2V0V2lkdGggLVxuICAgICAgICAgIChkcm9wVmFyaWFudC5sZWZ0IC0gdGhpcy5zdGF0ZS5sZWZ0UGFkZGluZyksXG4gICAgICApO1xuXG4gICAgICB0aGlzLmRyb3Bab25lLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgICB0aGlzLmRyb3Bab25lLnN0eWxlLnRvcCA9IGRyb3BWYXJpYW50LnRvcCArIFwicHhcIjtcbiAgICAgIHRoaXMuZHJvcFpvbmUuc3R5bGUubGVmdCA9IGRyb3BWYXJpYW50LmxlZnQgKyBcInB4XCI7XG4gICAgICB0aGlzLmRyb3Bab25lLnN0eWxlLndpZHRoID0gd2lkdGggKyBcInB4XCI7XG4gICAgfVxuXG4gICAge1xuICAgICAgY29uc3QgbGV2ZWwgPSBuZXdQYXJlbnQuZ2V0TGV2ZWwoKTtcbiAgICAgIGNvbnN0IGluZGVudFdpZHRoID0gdGhpcy5zdGF0ZS50YWJXaWR0aDtcbiAgICAgIGNvbnN0IHdpZHRoID0gaW5kZW50V2lkdGggKiBsZXZlbDtcbiAgICAgIGNvbnN0IGRhc2hQYWRkaW5nID0gMztcbiAgICAgIGNvbnN0IGRhc2hXaWR0aCA9IGluZGVudFdpZHRoIC0gZGFzaFBhZGRpbmc7XG4gICAgICBjb25zdCBjb2xvciA9IGdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuYm9keSkuZ2V0UHJvcGVydHlWYWx1ZShcbiAgICAgICAgXCItLWNvbG9yLWFjY2VudFwiLFxuICAgICAgKTtcblxuICAgICAgdGhpcy5kcm9wWm9uZVBhZGRpbmcuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XG4gICAgICB0aGlzLmRyb3Bab25lUGFkZGluZy5zdHlsZS5tYXJnaW5MZWZ0ID0gYC0ke3dpZHRofXB4YDtcbiAgICAgIHRoaXMuZHJvcFpvbmVQYWRkaW5nLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IGB1cmwoJ2RhdGE6aW1hZ2Uvc3ZnK3htbCwlM0NzdmclMjB2aWV3Qm94JTNEJTIyMCUyMDAlMjAke3dpZHRofSUyMDQlMjIlMjB4bWxucyUzRCUyMmh0dHAlM0ElMkYlMkZ3d3cudzMub3JnJTJGMjAwMCUyRnN2ZyUyMiUzRSUzQ2xpbmUlMjB4MSUzRCUyMjAlMjIlMjB5MSUzRCUyMjAlMjIlMjB4MiUzRCUyMiR7d2lkdGh9JTIyJTIweTIlM0QlMjIwJTIyJTIwc3Ryb2tlJTNEJTIyJHtjb2xvcn0lMjIlMjBzdHJva2Utd2lkdGglM0QlMjI4JTIyJTIwc3Ryb2tlLWRhc2hhcnJheSUzRCUyMiR7ZGFzaFdpZHRofSUyMCR7ZGFzaFBhZGRpbmd9JTIyJTJGJTNFJTNDJTJGc3ZnJTNFJylgO1xuICAgIH1cblxuICAgIHRoaXMuc3RhdGUudmlldy5kaXNwYXRjaCh7XG4gICAgICBlZmZlY3RzOiBbXG4gICAgICAgIGRuZE1vdmVkLm9mKFxuICAgICAgICAgIG5ld1BhcmVudElzUm9vdExpc3RcbiAgICAgICAgICAgID8gbnVsbFxuICAgICAgICAgICAgOiBlZGl0b3IucG9zVG9PZmZzZXQoe1xuICAgICAgICAgICAgICAgIGxpbmU6IG5ld1BhcmVudC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lLFxuICAgICAgICAgICAgICAgIGNoOiAwLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGhpZGVEcm9wWm9uZSgpIHtcbiAgICB0aGlzLmRyb3Bab25lLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgfVxufVxuXG5pbnRlcmZhY2UgRHJvcFZhcmlhbnQge1xuICBsaW5lOiBudW1iZXI7XG4gIGxldmVsOiBudW1iZXI7XG4gIGxlZnQ6IG51bWJlcjtcbiAgdG9wOiBudW1iZXI7XG4gIHBsYWNlVG9Nb3ZlOiBMaXN0O1xuICB3aGVyZVRvTW92ZTogXCJhZnRlclwiIHwgXCJiZWZvcmVcIiB8IFwiaW5zaWRlXCI7XG59XG5cbmludGVyZmFjZSBEcmFnQW5kRHJvcFByZVN0YXJ0U3RhdGUge1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdmlldzogRWRpdG9yVmlldztcbn1cblxuY2xhc3MgRHJhZ0FuZERyb3BTdGF0ZSB7XG4gIHByaXZhdGUgZHJvcFZhcmlhbnRzOiBNYXA8c3RyaW5nLCBEcm9wVmFyaWFudD4gPSBuZXcgTWFwKCk7XG4gIHB1YmxpYyBkcm9wVmFyaWFudDogRHJvcFZhcmlhbnQgPSBudWxsO1xuICBwdWJsaWMgbGVmdFBhZGRpbmcgPSAwO1xuICBwdWJsaWMgdGFiV2lkdGggPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyByZWFkb25seSB2aWV3OiBFZGl0b3JWaWV3LFxuICAgIHB1YmxpYyByZWFkb25seSBlZGl0b3I6IE15RWRpdG9yLFxuICAgIHB1YmxpYyByZWFkb25seSByb290OiBSb290LFxuICAgIHB1YmxpYyByZWFkb25seSBsaXN0OiBMaXN0LFxuICApIHtcbiAgICB0aGlzLmNvbGxlY3REcm9wVmFyaWFudHMoKTtcbiAgICB0aGlzLmNhbGN1bGF0ZUxlZnRQYWRkaW5nKCk7XG4gICAgdGhpcy5jYWxjdWxhdGVUYWJXaWR0aCgpO1xuICB9XG5cbiAgZ2V0RHJvcFZhcmlhbnRzKCkge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZHJvcFZhcmlhbnRzLnZhbHVlcygpKTtcbiAgfVxuXG4gIGhhc0Ryb3BWYXJpYW50cygpIHtcbiAgICByZXR1cm4gdGhpcy5kcm9wVmFyaWFudHMuc2l6ZSA+IDA7XG4gIH1cblxuICBjYWxjdWxhdGVOZWFyZXN0RHJvcFZhcmlhbnQoeDogbnVtYmVyLCB5OiBudW1iZXIpIHtcbiAgICBjb25zdCB7IHZpZXcsIGVkaXRvciB9ID0gdGhpcztcblxuICAgIGNvbnN0IGRyb3BWYXJpYW50cyA9IHRoaXMuZ2V0RHJvcFZhcmlhbnRzKCk7XG4gICAgY29uc3QgcG9zc2libGVEcm9wVmFyaWFudHMgPSBbXTtcblxuICAgIGZvciAoY29uc3QgdiBvZiBkcm9wVmFyaWFudHMpIHtcbiAgICAgIGNvbnN0IHsgcGxhY2VUb01vdmUgfSA9IHY7XG5cbiAgICAgIGNvbnN0IHBvc2l0aW9uQWZ0ZXJMaXN0ID1cbiAgICAgICAgdi53aGVyZVRvTW92ZSA9PT0gXCJhZnRlclwiIHx8IHYud2hlcmVUb01vdmUgPT09IFwiaW5zaWRlXCI7XG4gICAgICBjb25zdCBsaW5lID0gcG9zaXRpb25BZnRlckxpc3RcbiAgICAgICAgPyBwbGFjZVRvTW92ZS5nZXRDb250ZW50RW5kSW5jbHVkaW5nQ2hpbGRyZW4oKS5saW5lXG4gICAgICAgIDogcGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZTtcbiAgICAgIGNvbnN0IGxpbmVQb3MgPSBlZGl0b3IucG9zVG9PZmZzZXQoe1xuICAgICAgICBsaW5lLFxuICAgICAgICBjaDogMCxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBjb29yZHMgPSB2aWV3LmNvb3Jkc0F0UG9zKGxpbmVQb3MsIC0xKTtcblxuICAgICAgaWYgKCFjb29yZHMpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHYubGVmdCA9IHRoaXMubGVmdFBhZGRpbmcgKyAodi5sZXZlbCAtIDEpICogdGhpcy50YWJXaWR0aDtcbiAgICAgIHYudG9wID0gY29vcmRzLnRvcDtcblxuICAgICAgaWYgKHBvc2l0aW9uQWZ0ZXJMaXN0KSB7XG4gICAgICAgIHYudG9wICs9IHZpZXcubGluZUJsb2NrQXQobGluZVBvcykuaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICAvLyBCZXR0ZXIgdmVydGljYWwgYWxpZ25tZW50XG4gICAgICB2LnRvcCAtPSA4O1xuXG4gICAgICBwb3NzaWJsZURyb3BWYXJpYW50cy5wdXNoKHYpO1xuICAgIH1cblxuICAgIGNvbnN0IG5lYXJlc3RMaW5lVG9wID0gcG9zc2libGVEcm9wVmFyaWFudHNcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBNYXRoLmFicyh5IC0gYS50b3ApIC0gTWF0aC5hYnMoeSAtIGIudG9wKSlcbiAgICAgIC5maXJzdCgpLnRvcDtcblxuICAgIGNvbnN0IHZhcmlhbnNPbk5lYXJlc3RMaW5lID0gcG9zc2libGVEcm9wVmFyaWFudHMuZmlsdGVyKFxuICAgICAgKHYpID0+IE1hdGguYWJzKHYudG9wIC0gbmVhcmVzdExpbmVUb3ApIDw9IDQsXG4gICAgKTtcblxuICAgIHRoaXMuZHJvcFZhcmlhbnQgPSB2YXJpYW5zT25OZWFyZXN0TGluZVxuICAgICAgLnNvcnQoKGEsIGIpID0+IE1hdGguYWJzKHggLSBhLmxlZnQpIC0gTWF0aC5hYnMoeCAtIGIubGVmdCkpXG4gICAgICAuZmlyc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkRHJvcFZhcmlhbnQodjogRHJvcFZhcmlhbnQpIHtcbiAgICB0aGlzLmRyb3BWYXJpYW50cy5zZXQoYCR7di5saW5lfSAke3YubGV2ZWx9YCwgdik7XG4gIH1cblxuICBwcml2YXRlIGNvbGxlY3REcm9wVmFyaWFudHMoKSB7XG4gICAgY29uc3QgdmlzaXQgPSAobGlzdHM6IExpc3RbXSkgPT4ge1xuICAgICAgZm9yIChjb25zdCBwbGFjZVRvTW92ZSBvZiBsaXN0cykge1xuICAgICAgICBjb25zdCBsaW5lQmVmb3JlID0gcGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZTtcbiAgICAgICAgY29uc3QgbGluZUFmdGVyID0gcGxhY2VUb01vdmUuZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCkubGluZSArIDE7XG5cbiAgICAgICAgY29uc3QgbGV2ZWwgPSBwbGFjZVRvTW92ZS5nZXRMZXZlbCgpO1xuXG4gICAgICAgIHRoaXMuYWRkRHJvcFZhcmlhbnQoe1xuICAgICAgICAgIGxpbmU6IGxpbmVCZWZvcmUsXG4gICAgICAgICAgbGV2ZWwsXG4gICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgcGxhY2VUb01vdmUsXG4gICAgICAgICAgd2hlcmVUb01vdmU6IFwiYmVmb3JlXCIsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmFkZERyb3BWYXJpYW50KHtcbiAgICAgICAgICBsaW5lOiBsaW5lQWZ0ZXIsXG4gICAgICAgICAgbGV2ZWwsXG4gICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgcGxhY2VUb01vdmUsXG4gICAgICAgICAgd2hlcmVUb01vdmU6IFwiYWZ0ZXJcIixcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHBsYWNlVG9Nb3ZlID09PSB0aGlzLmxpc3QpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwbGFjZVRvTW92ZS5pc0VtcHR5KCkpIHtcbiAgICAgICAgICB0aGlzLmFkZERyb3BWYXJpYW50KHtcbiAgICAgICAgICAgIGxpbmU6IGxpbmVBZnRlcixcbiAgICAgICAgICAgIGxldmVsOiBsZXZlbCArIDEsXG4gICAgICAgICAgICBsZWZ0OiAwLFxuICAgICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgICAgcGxhY2VUb01vdmUsXG4gICAgICAgICAgICB3aGVyZVRvTW92ZTogXCJpbnNpZGVcIixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2aXNpdChwbGFjZVRvTW92ZS5nZXRDaGlsZHJlbigpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICB2aXNpdCh0aGlzLnJvb3QuZ2V0Q2hpbGRyZW4oKSk7XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUxlZnRQYWRkaW5nKCkge1xuICAgIGNvbnN0IGNtTGluZSA9IHRoaXMudmlldy5kb20ucXVlcnlTZWxlY3RvcihcImRpdi5jbS1saW5lXCIpO1xuICAgIHRoaXMubGVmdFBhZGRpbmcgPSBjbUxpbmUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdDtcbiAgfVxuXG4gIHByaXZhdGUgY2FsY3VsYXRlVGFiV2lkdGgoKSB7XG4gICAgY29uc3QgeyB2aWV3IH0gPSB0aGlzO1xuXG4gICAgY29uc3QgaW5kZW50RG9tID0gdmlldy5kb20ucXVlcnlTZWxlY3RvcihcIi5jbS1pbmRlbnRcIik7XG4gICAgaWYgKGluZGVudERvbSkge1xuICAgICAgdGhpcy50YWJXaWR0aCA9IChpbmRlbnREb20gYXMgSFRNTEVsZW1lbnQpLm9mZnNldFdpZHRoO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHNpbmdsZUluZGVudCA9IGluZGVudFN0cmluZyh2aWV3LnN0YXRlLCBnZXRJbmRlbnRVbml0KHZpZXcuc3RhdGUpKTtcblxuICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IHZpZXcuc3RhdGUuZG9jLmxpbmVzOyBpKyspIHtcbiAgICAgIGNvbnN0IGxpbmUgPSB2aWV3LnN0YXRlLmRvYy5saW5lKGkpO1xuXG4gICAgICBpZiAobGluZS50ZXh0LnN0YXJ0c1dpdGgoc2luZ2xlSW5kZW50KSkge1xuICAgICAgICBjb25zdCBhID0gdmlldy5jb29yZHNBdFBvcyhsaW5lLmZyb20sIC0xKTtcbiAgICAgICAgaWYgKCFhKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBiID0gdmlldy5jb29yZHNBdFBvcyhsaW5lLmZyb20gKyBzaW5nbGVJbmRlbnQubGVuZ3RoLCAtMSk7XG4gICAgICAgIGlmICghYikge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50YWJXaWR0aCA9IGIubGVmdCAtIGEubGVmdDtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudGFiV2lkdGggPSB2aWV3LmRlZmF1bHRDaGFyYWN0ZXJXaWR0aCAqIGdldEluZGVudFVuaXQodmlldy5zdGF0ZSk7XG4gIH1cbn1cblxuY29uc3QgZG5kU3RhcnRlZCA9IFN0YXRlRWZmZWN0LmRlZmluZTxudW1iZXJbXT4oe1xuICBtYXA6IChsaW5lcywgY2hhbmdlKSA9PiBsaW5lcy5tYXAoKGwpID0+IGNoYW5nZS5tYXBQb3MobCkpLFxufSk7XG5cbmNvbnN0IGRuZE1vdmVkID0gU3RhdGVFZmZlY3QuZGVmaW5lPG51bWJlciB8IG51bGw+KHtcbiAgbWFwOiAobGluZSwgY2hhbmdlKSA9PiAobGluZSAhPT0gbnVsbCA/IGNoYW5nZS5tYXBQb3MobGluZSkgOiBsaW5lKSxcbn0pO1xuXG5jb25zdCBkbmRFbmRlZCA9IFN0YXRlRWZmZWN0LmRlZmluZTx2b2lkPigpO1xuXG5jb25zdCBkcmFnZ2luZ0xpbmVEZWNvcmF0aW9uID0gRGVjb3JhdGlvbi5saW5lKHtcbiAgY2xhc3M6IFwib3V0bGluZXItcGx1Z2luLWRyYWdnaW5nLWxpbmVcIixcbn0pO1xuXG5jb25zdCBkcm9wcGluZ0xpbmVEZWNvcmF0aW9uID0gRGVjb3JhdGlvbi5saW5lKHtcbiAgY2xhc3M6IFwib3V0bGluZXItcGx1Z2luLWRyb3BwaW5nLWxpbmVcIixcbn0pO1xuXG5jb25zdCBkcmFnZ2luZ0xpbmVzU3RhdGVGaWVsZCA9IFN0YXRlRmllbGQuZGVmaW5lPERlY29yYXRpb25TZXQ+KHtcbiAgY3JlYXRlOiAoKSA9PiBEZWNvcmF0aW9uLm5vbmUsXG5cbiAgdXBkYXRlOiAoZG5kU3RhdGUsIHRyKSA9PiB7XG4gICAgZG5kU3RhdGUgPSBkbmRTdGF0ZS5tYXAodHIuY2hhbmdlcyk7XG5cbiAgICBmb3IgKGNvbnN0IGUgb2YgdHIuZWZmZWN0cykge1xuICAgICAgaWYgKGUuaXMoZG5kU3RhcnRlZCkpIHtcbiAgICAgICAgZG5kU3RhdGUgPSBkbmRTdGF0ZS51cGRhdGUoe1xuICAgICAgICAgIGFkZDogZS52YWx1ZS5tYXAoKGwpID0+IGRyYWdnaW5nTGluZURlY29yYXRpb24ucmFuZ2UobCwgbCkpLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGUuaXMoZG5kRW5kZWQpKSB7XG4gICAgICAgIGRuZFN0YXRlID0gRGVjb3JhdGlvbi5ub25lO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkbmRTdGF0ZTtcbiAgfSxcblxuICBwcm92aWRlOiAoZikgPT4gRWRpdG9yVmlldy5kZWNvcmF0aW9ucy5mcm9tKGYpLFxufSk7XG5cbmNvbnN0IGRyb3BwaW5nTGluZXNTdGF0ZUZpZWxkID0gU3RhdGVGaWVsZC5kZWZpbmU8RGVjb3JhdGlvblNldD4oe1xuICBjcmVhdGU6ICgpID0+IERlY29yYXRpb24ubm9uZSxcblxuICB1cGRhdGU6IChkbmREcm9wcGluZ1N0YXRlLCB0cikgPT4ge1xuICAgIGRuZERyb3BwaW5nU3RhdGUgPSBkbmREcm9wcGluZ1N0YXRlLm1hcCh0ci5jaGFuZ2VzKTtcblxuICAgIGZvciAoY29uc3QgZSBvZiB0ci5lZmZlY3RzKSB7XG4gICAgICBpZiAoZS5pcyhkbmRNb3ZlZCkpIHtcbiAgICAgICAgZG5kRHJvcHBpbmdTdGF0ZSA9XG4gICAgICAgICAgZS52YWx1ZSA9PT0gbnVsbFxuICAgICAgICAgICAgPyBEZWNvcmF0aW9uLm5vbmVcbiAgICAgICAgICAgIDogRGVjb3JhdGlvbi5zZXQoZHJvcHBpbmdMaW5lRGVjb3JhdGlvbi5yYW5nZShlLnZhbHVlLCBlLnZhbHVlKSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChlLmlzKGRuZEVuZGVkKSkge1xuICAgICAgICBkbmREcm9wcGluZ1N0YXRlID0gRGVjb3JhdGlvbi5ub25lO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkbmREcm9wcGluZ1N0YXRlO1xuICB9LFxuXG4gIHByb3ZpZGU6IChmKSA9PiBFZGl0b3JWaWV3LmRlY29yYXRpb25zLmZyb20oZiksXG59KTtcblxuZnVuY3Rpb24gZ2V0RWRpdG9yVmlld0Zyb21IVE1MRWxlbWVudChlOiBIVE1MRWxlbWVudCkge1xuICB3aGlsZSAoZSAmJiAhZS5jbGFzc0xpc3QuY29udGFpbnMoXCJjbS1lZGl0b3JcIikpIHtcbiAgICBlID0gZS5wYXJlbnRFbGVtZW50O1xuICB9XG5cbiAgaWYgKCFlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gRWRpdG9yVmlldy5maW5kRnJvbURPTShlKTtcbn1cblxuZnVuY3Rpb24gaXNDbGlja09uQnVsbGV0KGU6IE1vdXNlRXZlbnQpIHtcbiAgbGV0IGVsID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgd2hpbGUgKGVsKSB7XG4gICAgaWYgKFxuICAgICAgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwiY20tZm9ybWF0dGluZy1saXN0XCIpIHx8XG4gICAgICBlbC5jbGFzc0xpc3QuY29udGFpbnMoXCJjbS1mb2xkLWluZGljYXRvclwiKSB8fFxuICAgICAgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwidGFzay1saXN0LWl0ZW0tY2hlY2tib3hcIilcbiAgICApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gaXNTYW1lUm9vdHMoYTogUm9vdCwgYjogUm9vdCkge1xuICBjb25zdCBbYVN0YXJ0LCBhRW5kXSA9IGEuZ2V0Q29udGVudFJhbmdlKCk7XG4gIGNvbnN0IFtiU3RhcnQsIGJFbmRdID0gYi5nZXRDb250ZW50UmFuZ2UoKTtcblxuICBpZiAoY21wUG9zKGFTdGFydCwgYlN0YXJ0KSAhPT0gMCB8fCBjbXBQb3MoYUVuZCwgYkVuZCkgIT09IDApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gYS5wcmludCgpID09PSBiLnByaW50KCk7XG59XG5cbmZ1bmN0aW9uIGlzRmVhdHVyZVN1cHBvcnRlZCgpIHtcbiAgcmV0dXJuIFBsYXRmb3JtLmlzRGVza3RvcDtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIEtlZXBDdXJzb3JPdXRzaWRlRm9sZGVkTGluZXMgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgaWYgKCFsaXN0LmlzRm9sZGVkKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmb2xkUm9vdCA9IGxpc3QuZ2V0VG9wRm9sZFJvb3QoKTtcbiAgICBjb25zdCBmaXJzdExpbmVFbmQgPSBmb2xkUm9vdC5nZXRMaW5lc0luZm8oKVswXS50bztcblxuICAgIGlmIChjdXJzb3IubGluZSA+IGZpcnN0TGluZUVuZC5saW5lKSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKGZpcnN0TGluZUVuZCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBLZWVwQ3Vyc29yV2l0aGluTGlzdENvbnRlbnQgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGNvbnRlbnRTdGFydCA9IGxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0QWZ0ZXJDaGVja2JveCgpO1xuICAgIGNvbnN0IGxpbmVQcmVmaXggPVxuICAgICAgY29udGVudFN0YXJ0LmxpbmUgPT09IGN1cnNvci5saW5lXG4gICAgICAgID8gY29udGVudFN0YXJ0LmNoXG4gICAgICAgIDogbGlzdC5nZXROb3Rlc0luZGVudCgpLmxlbmd0aDtcblxuICAgIGlmIChjdXJzb3IuY2ggPCBsaW5lUHJlZml4KSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHtcbiAgICAgICAgbGluZTogY3Vyc29yLmxpbmUsXG4gICAgICAgIGNoOiBsaW5lUHJlZml4LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRWRpdG9yU3RhdGUsIFRyYW5zYWN0aW9uIH0gZnJvbSBcIkBjb2RlbWlycm9yL3N0YXRlXCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yLCBnZXRFZGl0b3JGcm9tU3RhdGUgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBLZWVwQ3Vyc29yT3V0c2lkZUZvbGRlZExpbmVzIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvS2VlcEN1cnNvck91dHNpZGVGb2xkZWRMaW5lc1wiO1xuaW1wb3J0IHsgS2VlcEN1cnNvcldpdGhpbkxpc3RDb250ZW50IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvS2VlcEN1cnNvcldpdGhpbkxpc3RDb250ZW50XCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBQYXJzZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvUGFyc2VyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuXG5leHBvcnQgY2xhc3MgRWRpdG9yU2VsZWN0aW9uc0JlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIEVkaXRvclN0YXRlLnRyYW5zYWN0aW9uRXh0ZW5kZXIub2YodGhpcy50cmFuc2FjdGlvbkV4dGVuZGVyKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIHRyYW5zYWN0aW9uRXh0ZW5kZXIgPSAodHI6IFRyYW5zYWN0aW9uKTogbnVsbCA9PiB7XG4gICAgaWYgKHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgPT09IFwibmV2ZXJcIiB8fCAhdHIuc2VsZWN0aW9uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBlZGl0b3IgPSBnZXRFZGl0b3JGcm9tU3RhdGUodHIuc3RhcnRTdGF0ZSk7XG5cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuaGFuZGxlU2VsZWN0aW9uc0NoYW5nZXMoZWRpdG9yKTtcbiAgICB9LCAwKTtcblxuICAgIHJldHVybiBudWxsO1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlU2VsZWN0aW9uc0NoYW5nZXMgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLnBhcnNlci5wYXJzZShlZGl0b3IpO1xuXG4gICAgaWYgKCFyb290KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAge1xuICAgICAgY29uc3QgeyBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLmV2YWwoXG4gICAgICAgIHJvb3QsXG4gICAgICAgIG5ldyBLZWVwQ3Vyc29yT3V0c2lkZUZvbGRlZExpbmVzKHJvb3QpLFxuICAgICAgICBlZGl0b3IsXG4gICAgICApO1xuXG4gICAgICBpZiAoc2hvdWxkU3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5ldmFsKFxuICAgICAgcm9vdCxcbiAgICAgIG5ldyBLZWVwQ3Vyc29yV2l0aGluTGlzdENvbnRlbnQocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImV4cG9ydCBjb25zdCBjaGVja2JveFJlID0gYFxcXFxbW15cXFxcW1xcXFxdXVxcXFxdWyBcXHRdYDtcbiIsImV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveChsaW5lOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGxpbmUgPT09IFwiXCIgfHwgbGluZSA9PT0gXCJbIF0gXCI7XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgTGlzdCwgUG9zaXRpb24sIFJvb3QsIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgY2hlY2tib3hSZSB9IGZyb20gXCIuLi91dGlscy9jaGVja2JveFJlXCI7XG5pbXBvcnQgeyBpc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveCB9IGZyb20gXCIuLi91dGlscy9pc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdldFpvb21SYW5nZSB7XG4gIGdldFpvb21SYW5nZSgpOiB7IGZyb206IFBvc2l0aW9uOyB0bzogUG9zaXRpb24gfSB8IG51bGw7XG59XG5cbmV4cG9ydCBjbGFzcyBDcmVhdGVOZXdJdGVtIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByb290OiBSb290LFxuICAgIHByaXZhdGUgZGVmYXVsdEluZGVudENoYXJzOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBnZXRab29tUmFuZ2U6IEdldFpvb21SYW5nZSxcbiAgICBwcml2YXRlIGFmdGVyOiBib29sZWFuID0gdHJ1ZSxcbiAgKSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZVNlbGVjdGlvbigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZWN0aW9uID0gcm9vdC5nZXRTZWxlY3Rpb24oKTtcbiAgICBpZiAoIXNlbGVjdGlvbiB8fCBzZWxlY3Rpb24uYW5jaG9yLmxpbmUgIT09IHNlbGVjdGlvbi5oZWFkLmxpbmUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXNJbmZvKCk7XG5cbiAgICBpZiAobGluZXMubGVuZ3RoID09PSAxICYmIGlzRW1wdHlMaW5lT3JFbXB0eUNoZWNrYm94KGxpbmVzWzBdLnRleHQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lVW5kZXJDdXJzb3IgPSBsaW5lcy5maW5kKChsKSA9PiBsLmZyb20ubGluZSA9PT0gY3Vyc29yLmxpbmUpO1xuXG4gICAgaWYgKGN1cnNvci5jaCA8IGxpbmVVbmRlckN1cnNvci5mcm9tLmNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgeyBvbGRMaW5lcywgbmV3TGluZXMgfSA9IGxpbmVzLnJlZHVjZShcbiAgICAgIChhY2MsIGxpbmUpID0+IHtcbiAgICAgICAgaWYgKGN1cnNvci5saW5lID4gbGluZS5mcm9tLmxpbmUpIHtcbiAgICAgICAgICBhY2Mub2xkTGluZXMucHVzaChsaW5lLnRleHQpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1cnNvci5saW5lID09PSBsaW5lLmZyb20ubGluZSkge1xuICAgICAgICAgIGNvbnN0IGxlZnQgPSBsaW5lLnRleHQuc2xpY2UoMCwgc2VsZWN0aW9uLmZyb20gLSBsaW5lLmZyb20uY2gpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gbGluZS50ZXh0LnNsaWNlKHNlbGVjdGlvbi50byAtIGxpbmUuZnJvbS5jaCk7XG4gICAgICAgICAgYWNjLm9sZExpbmVzLnB1c2gobGVmdCk7XG4gICAgICAgICAgYWNjLm5ld0xpbmVzLnB1c2gocmlnaHQpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1cnNvci5saW5lIDwgbGluZS5mcm9tLmxpbmUpIHtcbiAgICAgICAgICBhY2MubmV3TGluZXMucHVzaChsaW5lLnRleHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG9sZExpbmVzOiBbXSxcbiAgICAgICAgbmV3TGluZXM6IFtdLFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgY29uc3QgY29kZUJsb2NrQmFjdGlja3MgPSBvbGRMaW5lcy5qb2luKFwiXFxuXCIpLnNwbGl0KFwiYGBgXCIpLmxlbmd0aCAtIDE7XG4gICAgY29uc3QgaXNJbnNpZGVDb2RlYmxvY2sgPVxuICAgICAgY29kZUJsb2NrQmFjdGlja3MgPiAwICYmIGNvZGVCbG9ja0JhY3RpY2tzICUgMiAhPT0gMDtcblxuICAgIGlmIChpc0luc2lkZUNvZGVibG9jaykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3Qgem9vbVJhbmdlID0gdGhpcy5nZXRab29tUmFuZ2UuZ2V0Wm9vbVJhbmdlKCk7XG4gICAgY29uc3QgbGlzdElzWm9vbWluZ1Jvb3QgPSBCb29sZWFuKFxuICAgICAgem9vbVJhbmdlICYmXG4gICAgICBsaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUgPj0gem9vbVJhbmdlLmZyb20ubGluZSAmJlxuICAgICAgbGlzdC5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKS5saW5lIDw9IHpvb21SYW5nZS5mcm9tLmxpbmUsXG4gICAgKTtcblxuICAgIGNvbnN0IGhhc0NoaWxkcmVuID0gIWxpc3QuaXNFbXB0eSgpO1xuICAgIGNvbnN0IGNoaWxkSXNGb2xkZWQgPSBsaXN0LmlzRm9sZFJvb3QoKTtcbiAgICBjb25zdCBlbmRQb3MgPSBsaXN0LmdldExhc3RMaW5lQ29udGVudEVuZCgpO1xuICAgIGNvbnN0IGVuZE9mTGluZSA9IGN1cnNvci5saW5lID09PSBlbmRQb3MubGluZSAmJiBjdXJzb3IuY2ggPT09IGVuZFBvcy5jaDtcblxuICAgIGNvbnN0IG9uQ2hpbGRMZXZlbCA9XG4gICAgICBsaXN0SXNab29taW5nUm9vdCB8fCAoaGFzQ2hpbGRyZW4gJiYgIWNoaWxkSXNGb2xkZWQgJiYgZW5kT2ZMaW5lKTtcblxuICAgIGNvbnN0IGluZGVudCA9IG9uQ2hpbGRMZXZlbFxuICAgICAgPyBoYXNDaGlsZHJlblxuICAgICAgICA/IGxpc3QuZ2V0Q2hpbGRyZW4oKVswXS5nZXRGaXJzdExpbmVJbmRlbnQoKVxuICAgICAgICA6IGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCkgKyB0aGlzLmRlZmF1bHRJbmRlbnRDaGFyc1xuICAgICAgOiBsaXN0LmdldEZpcnN0TGluZUluZGVudCgpO1xuXG4gICAgY29uc3QgYnVsbGV0ID1cbiAgICAgIG9uQ2hpbGRMZXZlbCAmJiBoYXNDaGlsZHJlblxuICAgICAgICA/IGxpc3QuZ2V0Q2hpbGRyZW4oKVswXS5nZXRCdWxsZXQoKVxuICAgICAgICA6IGxpc3QuZ2V0QnVsbGV0KCk7XG5cbiAgICBjb25zdCBzcGFjZUFmdGVyQnVsbGV0ID1cbiAgICAgIG9uQ2hpbGRMZXZlbCAmJiBoYXNDaGlsZHJlblxuICAgICAgICA/IGxpc3QuZ2V0Q2hpbGRyZW4oKVswXS5nZXRTcGFjZUFmdGVyQnVsbGV0KClcbiAgICAgICAgOiBsaXN0LmdldFNwYWNlQWZ0ZXJCdWxsZXQoKTtcblxuICAgIGNvbnN0IHByZWZpeCA9IG9sZExpbmVzWzBdLm1hdGNoKGNoZWNrYm94UmUpID8gXCJbIF0gXCIgOiBcIlwiO1xuXG4gICAgY29uc3QgbmV3TGlzdCA9IG5ldyBMaXN0KFxuICAgICAgbGlzdC5nZXRSb290KCksXG4gICAgICBpbmRlbnQsXG4gICAgICBidWxsZXQsXG4gICAgICBwcmVmaXgsXG4gICAgICBzcGFjZUFmdGVyQnVsbGV0LFxuICAgICAgcHJlZml4ICsgbmV3TGluZXMuc2hpZnQoKSxcbiAgICAgIGZhbHNlLFxuICAgICk7XG5cbiAgICBpZiAobmV3TGluZXMubGVuZ3RoID4gMCkge1xuICAgICAgbmV3TGlzdC5zZXROb3Rlc0luZGVudChsaXN0LmdldE5vdGVzSW5kZW50KCkpO1xuICAgICAgZm9yIChjb25zdCBsaW5lIG9mIG5ld0xpbmVzKSB7XG4gICAgICAgIG5ld0xpc3QuYWRkTGluZShsaW5lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob25DaGlsZExldmVsKSB7XG4gICAgICBsaXN0LmFkZEJlZm9yZUFsbChuZXdMaXN0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFjaGlsZElzRm9sZGVkIHx8ICFlbmRPZkxpbmUpIHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBsaXN0LmdldENoaWxkcmVuKCk7XG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcbiAgICAgICAgICBsaXN0LnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAgICAgICBuZXdMaXN0LmFkZEFmdGVyQWxsKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5hZnRlcikge1xuICAgICAgICBsaXN0LmdldFBhcmVudCgpLmFkZEFmdGVyKGxpc3QsIG5ld0xpc3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGlzdC5nZXRQYXJlbnQoKS5hZGRCZWZvcmUobGlzdCwgbmV3TGlzdCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGlzdC5yZXBsYWNlTGluZXMob2xkTGluZXMpO1xuXG4gICAgY29uc3QgbmV3TGlzdFN0YXJ0ID0gbmV3TGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogbmV3TGlzdFN0YXJ0LmxpbmUsXG4gICAgICBjaDogbmV3TGlzdFN0YXJ0LmNoICsgcHJlZml4Lmxlbmd0aCxcbiAgICB9KTtcblxuICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290LCByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzIH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIE91dGRlbnRMaXN0IGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgcGFyZW50ID0gbGlzdC5nZXRQYXJlbnQoKTtcbiAgICBjb25zdCBncmFuZFBhcmVudCA9IHBhcmVudC5nZXRQYXJlbnQoKTtcblxuICAgIGlmICghZ3JhbmRQYXJlbnQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUJlZm9yZSA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcbiAgICBjb25zdCBpbmRlbnRSbUZyb20gPSBwYXJlbnQuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoO1xuICAgIGNvbnN0IGluZGVudFJtVGlsbCA9IGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoO1xuXG4gICAgcGFyZW50LnJlbW92ZUNoaWxkKGxpc3QpO1xuICAgIGdyYW5kUGFyZW50LmFkZEFmdGVyKHBhcmVudCwgbGlzdCk7XG4gICAgbGlzdC51bmluZGVudENvbnRlbnQoaW5kZW50Um1Gcm9tLCBpbmRlbnRSbVRpbGwpO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUFmdGVyID0gcm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3QpWzBdO1xuICAgIGNvbnN0IGxpbmVEaWZmID0gbGlzdFN0YXJ0TGluZUFmdGVyIC0gbGlzdFN0YXJ0TGluZUJlZm9yZTtcbiAgICBjb25zdCBjaERpZmYgPSBpbmRlbnRSbVRpbGwgLSBpbmRlbnRSbUZyb207XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIHJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICBsaW5lOiBjdXJzb3IubGluZSArIGxpbmVEaWZmLFxuICAgICAgY2g6IGN1cnNvci5jaCAtIGNoRGlmZixcbiAgICB9KTtcblxuICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuaW1wb3J0IHsgT3V0ZGVudExpc3QgfSBmcm9tIFwiLi9PdXRkZW50TGlzdFwiO1xuXG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IGlzRW1wdHlMaW5lT3JFbXB0eUNoZWNrYm94IH0gZnJvbSBcIi4uL3V0aWxzL2lzRW1wdHlMaW5lT3JFbXB0eUNoZWNrYm94XCI7XG5cbmV4cG9ydCBjbGFzcyBPdXRkZW50TGlzdElmSXRzRW1wdHkgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIG91dGRlbnRMaXN0OiBPdXRkZW50TGlzdDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHtcbiAgICB0aGlzLm91dGRlbnRMaXN0ID0gbmV3IE91dGRlbnRMaXN0KHJvb3QpO1xuICB9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLm91dGRlbnRMaXN0LnNob3VsZFN0b3BQcm9wYWdhdGlvbigpO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLm91dGRlbnRMaXN0LnNob3VsZFVwZGF0ZSgpO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXMoKTtcblxuICAgIGlmIChcbiAgICAgIGxpbmVzLmxlbmd0aCA+IDEgfHxcbiAgICAgICFpc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveChsaW5lc1swXSkgfHxcbiAgICAgIGxpc3QuZ2V0TGV2ZWwoKSA9PT0gMVxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMub3V0ZGVudExpc3QucGVyZm9ybSgpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgUHJlYyB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBDcmVhdGVOZXdJdGVtIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvQ3JlYXRlTmV3SXRlbVwiO1xuaW1wb3J0IHsgT3V0ZGVudExpc3RJZkl0c0VtcHR5IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvT3V0ZGVudExpc3RJZkl0c0VtcHR5XCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBQYXJzZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvUGFyc2VyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuaW1wb3J0IHsgY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2sgfSBmcm9tIFwiLi4vdXRpbHMvY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2tcIjtcblxuZXhwb3J0IGNsYXNzIEVudGVyQmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIGltZURldGVjdG9yOiBJTUVEZXRlY3RvcixcbiAgICBwcml2YXRlIG9ic2lkaWFuU2V0dGluZ3M6IE9ic2lkaWFuU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIFByZWMuaGlnaGVzdChcbiAgICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBrZXk6IFwiRW50ZXJcIixcbiAgICAgICAgICAgIHJ1bjogY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0pLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIGNoZWNrID0gKCkgPT4ge1xuICAgIHJldHVybiB0aGlzLnNldHRpbmdzLm92ZXJyaWRlRW50ZXJCZWhhdmlvdXIgJiYgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKTtcbiAgfTtcblxuICBwcml2YXRlIHJ1biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMucGFyc2VyLnBhcnNlKGVkaXRvcik7XG5cbiAgICBpZiAoIXJvb3QpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHNob3VsZFVwZGF0ZTogZmFsc2UsXG4gICAgICAgIHNob3VsZFN0b3BQcm9wYWdhdGlvbjogZmFsc2UsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHtcbiAgICAgIGNvbnN0IHJlcyA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLmV2YWwoXG4gICAgICAgIHJvb3QsXG4gICAgICAgIG5ldyBPdXRkZW50TGlzdElmSXRzRW1wdHkocm9vdCksXG4gICAgICAgIGVkaXRvcixcbiAgICAgICk7XG5cbiAgICAgIGlmIChyZXMuc2hvdWxkU3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgICB9XG4gICAgfVxuXG4gICAge1xuICAgICAgY29uc3QgZGVmYXVsdEluZGVudENoYXJzID0gdGhpcy5vYnNpZGlhblNldHRpbmdzLmdldERlZmF1bHRJbmRlbnRDaGFycygpO1xuICAgICAgY29uc3Qgem9vbVJhbmdlID0gZWRpdG9yLmdldFpvb21SYW5nZSgpO1xuICAgICAgY29uc3QgZ2V0Wm9vbVJhbmdlID0ge1xuICAgICAgICBnZXRab29tUmFuZ2U6ICgpID0+IHpvb21SYW5nZSxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHJlcyA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLmV2YWwoXG4gICAgICAgIHJvb3QsXG4gICAgICAgIG5ldyBDcmVhdGVOZXdJdGVtKHJvb3QsIGRlZmF1bHRJbmRlbnRDaGFycywgZ2V0Wm9vbVJhbmdlKSxcbiAgICAgICAgZWRpdG9yLFxuICAgICAgKTtcblxuICAgICAgaWYgKHJlcy5zaG91bGRVcGRhdGUgJiYgem9vbVJhbmdlKSB7XG4gICAgICAgIGVkaXRvci50cnlSZWZyZXNoWm9vbSh6b29tUmFuZ2UuZnJvbS5saW5lKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBFZGl0b3IgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFZGl0b3JDYWxsYmFjayhjYjogKGVkaXRvcjogTXlFZGl0b3IpID0+IGJvb2xlYW4pIHtcbiAgcmV0dXJuIChlZGl0b3I6IEVkaXRvcikgPT4ge1xuICAgIGNvbnN0IG15RWRpdG9yID0gbmV3IE15RWRpdG9yKGVkaXRvcik7XG4gICAgY29uc3Qgc2hvdWxkU3RvcFByb3BhZ2F0aW9uID0gY2IobXlFZGl0b3IpO1xuXG4gICAgaWYgKFxuICAgICAgIXNob3VsZFN0b3BQcm9wYWdhdGlvbiAmJlxuICAgICAgd2luZG93LmV2ZW50ICYmXG4gICAgICB3aW5kb3cuZXZlbnQudHlwZSA9PT0gXCJrZXlkb3duXCJcbiAgICApIHtcbiAgICAgIG15RWRpdG9yLnRyaWdnZXJPbktleURvd24od2luZG93LmV2ZW50IGFzIEtleWJvYXJkRXZlbnQpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IE5vdGljZSwgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBjcmVhdGVFZGl0b3JDYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVFZGl0b3JDYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgTGlzdHNGb2xkaW5nQ29tbWFuZHMgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIG9ic2lkaWFuU2V0dGluZ3M6IE9ic2lkaWFuU2V0dGluZ3MsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiZm9sZFwiLFxuICAgICAgaWNvbjogXCJjaGV2cm9ucy1kb3duLXVwXCIsXG4gICAgICBuYW1lOiBcIkZvbGQgdGhlIGxpc3RcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiBjcmVhdGVFZGl0b3JDYWxsYmFjayh0aGlzLmZvbGQpLFxuICAgICAgaG90a2V5czogW1xuICAgICAgICB7XG4gICAgICAgICAgbW9kaWZpZXJzOiBbXCJNb2RcIl0sXG4gICAgICAgICAga2V5OiBcIkFycm93VXBcIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInVuZm9sZFwiLFxuICAgICAgaWNvbjogXCJjaGV2cm9ucy11cC1kb3duXCIsXG4gICAgICBuYW1lOiBcIlVuZm9sZCB0aGUgbGlzdFwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGNyZWF0ZUVkaXRvckNhbGxiYWNrKHRoaXMudW5mb2xkKSxcbiAgICAgIGhvdGtleXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG1vZGlmaWVyczogW1wiTW9kXCJdLFxuICAgICAgICAgIGtleTogXCJBcnJvd0Rvd25cIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgc2V0Rm9sZChlZGl0b3I6IE15RWRpdG9yLCB0eXBlOiBcImZvbGRcIiB8IFwidW5mb2xkXCIpIHtcbiAgICBpZiAoIXRoaXMub2JzaWRpYW5TZXR0aW5ncy5nZXRGb2xkU2V0dGluZ3MoKS5mb2xkSW5kZW50KSB7XG4gICAgICBuZXcgTm90aWNlKFxuICAgICAgICBgVW5hYmxlIHRvICR7dHlwZX0gYmVjYXVzZSBmb2xkaW5nIGlzIGRpc2FibGVkLiBQbGVhc2UgZW5hYmxlIFwiRm9sZCBpbmRlbnRcIiBpbiBPYnNpZGlhbiBzZXR0aW5ncy5gLFxuICAgICAgICA1MDAwLFxuICAgICAgKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcblxuICAgIGlmICh0eXBlID09PSBcImZvbGRcIikge1xuICAgICAgZWRpdG9yLmZvbGQoY3Vyc29yLmxpbmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlZGl0b3IudW5mb2xkKGN1cnNvci5saW5lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgZm9sZCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0Rm9sZChlZGl0b3IsIFwiZm9sZFwiKTtcbiAgfTtcblxuICBwcml2YXRlIHVuZm9sZCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0Rm9sZChlZGl0b3IsIFwidW5mb2xkXCIpO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IFJvb3QsIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgSW5kZW50TGlzdCBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcm9vdDogUm9vdCxcbiAgICBwcml2YXRlIGRlZmF1bHRJbmRlbnRDaGFyczogc3RyaW5nLFxuICApIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IHByZXYgPSBwYXJlbnQuZ2V0UHJldlNpYmxpbmdPZihsaXN0KTtcblxuICAgIGlmICghcHJldikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQmVmb3JlID0gcm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3QpWzBdO1xuXG4gICAgY29uc3QgaW5kZW50UG9zID0gbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGg7XG4gICAgbGV0IGluZGVudENoYXJzID0gXCJcIjtcblxuICAgIGlmIChpbmRlbnRDaGFycyA9PT0gXCJcIiAmJiAhcHJldi5pc0VtcHR5KCkpIHtcbiAgICAgIGluZGVudENoYXJzID0gcHJldlxuICAgICAgICAuZ2V0Q2hpbGRyZW4oKVswXVxuICAgICAgICAuZ2V0Rmlyc3RMaW5lSW5kZW50KClcbiAgICAgICAgLnNsaWNlKHByZXYuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoKTtcbiAgICB9XG5cbiAgICBpZiAoaW5kZW50Q2hhcnMgPT09IFwiXCIpIHtcbiAgICAgIGluZGVudENoYXJzID0gbGlzdFxuICAgICAgICAuZ2V0Rmlyc3RMaW5lSW5kZW50KClcbiAgICAgICAgLnNsaWNlKHBhcmVudC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGgpO1xuICAgIH1cblxuICAgIGlmIChpbmRlbnRDaGFycyA9PT0gXCJcIiAmJiAhbGlzdC5pc0VtcHR5KCkpIHtcbiAgICAgIGluZGVudENoYXJzID0gbGlzdC5nZXRDaGlsZHJlbigpWzBdLmdldEZpcnN0TGluZUluZGVudCgpO1xuICAgIH1cblxuICAgIGlmIChpbmRlbnRDaGFycyA9PT0gXCJcIikge1xuICAgICAgaW5kZW50Q2hhcnMgPSB0aGlzLmRlZmF1bHRJbmRlbnRDaGFycztcbiAgICB9XG5cbiAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobGlzdCk7XG4gICAgcHJldi5hZGRBZnRlckFsbChsaXN0KTtcbiAgICBsaXN0LmluZGVudENvbnRlbnQoaW5kZW50UG9zLCBpbmRlbnRDaGFycyk7XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQWZ0ZXIgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgY29uc3QgbGluZURpZmYgPSBsaXN0U3RhcnRMaW5lQWZ0ZXIgLSBsaXN0U3RhcnRMaW5lQmVmb3JlO1xuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgKyBsaW5lRGlmZixcbiAgICAgIGNoOiBjdXJzb3IuY2ggKyBpbmRlbnRDaGFycy5sZW5ndGgsXG4gICAgfSk7XG5cbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3QpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCwgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBNb3ZlTGlzdERvd24gaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IGdyYW5kUGFyZW50ID0gcGFyZW50LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IG5leHQgPSBwYXJlbnQuZ2V0TmV4dFNpYmxpbmdPZihsaXN0KTtcblxuICAgIGNvbnN0IGxpc3RTdGFydExpbmVCZWZvcmUgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG5cbiAgICBpZiAoIW5leHQgJiYgZ3JhbmRQYXJlbnQpIHtcbiAgICAgIGNvbnN0IG5ld1BhcmVudCA9IGdyYW5kUGFyZW50LmdldE5leHRTaWJsaW5nT2YocGFyZW50KTtcblxuICAgICAgaWYgKG5ld1BhcmVudCkge1xuICAgICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobGlzdCk7XG4gICAgICAgIG5ld1BhcmVudC5hZGRCZWZvcmVBbGwobGlzdCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuZXh0KSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGxpc3QpO1xuICAgICAgcGFyZW50LmFkZEFmdGVyKG5leHQsIGxpc3QpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy51cGRhdGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUFmdGVyID0gcm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3QpWzBdO1xuICAgIGNvbnN0IGxpbmVEaWZmID0gbGlzdFN0YXJ0TGluZUFmdGVyIC0gbGlzdFN0YXJ0TGluZUJlZm9yZTtcblxuICAgIGNvbnN0IGN1cnNvciA9IHJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHtcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lICsgbGluZURpZmYsXG4gICAgICBjaDogY3Vyc29yLmNoLFxuICAgIH0pO1xuXG4gICAgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyhyb290KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IFJvb3QsIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgTW92ZUxpc3RVcCBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgZ3JhbmRQYXJlbnQgPSBwYXJlbnQuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgcHJldiA9IHBhcmVudC5nZXRQcmV2U2libGluZ09mKGxpc3QpO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUJlZm9yZSA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcblxuICAgIGlmICghcHJldiAmJiBncmFuZFBhcmVudCkge1xuICAgICAgY29uc3QgbmV3UGFyZW50ID0gZ3JhbmRQYXJlbnQuZ2V0UHJldlNpYmxpbmdPZihwYXJlbnQpO1xuXG4gICAgICBpZiAobmV3UGFyZW50KSB7XG4gICAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG4gICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcbiAgICAgICAgbmV3UGFyZW50LmFkZEFmdGVyQWxsKGxpc3QpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJldikge1xuICAgICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcbiAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcbiAgICAgIHBhcmVudC5hZGRCZWZvcmUocHJldiwgbGlzdCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnVwZGF0ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQWZ0ZXIgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgY29uc3QgbGluZURpZmYgPSBsaXN0U3RhcnRMaW5lQWZ0ZXIgLSBsaXN0U3RhcnRMaW5lQmVmb3JlO1xuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgKyBsaW5lRGlmZixcbiAgICAgIGNoOiBjdXJzb3IuY2gsXG4gICAgfSk7XG5cbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3QpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBJbmRlbnRMaXN0IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvSW5kZW50TGlzdFwiO1xuaW1wb3J0IHsgTW92ZUxpc3REb3duIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvTW92ZUxpc3REb3duXCI7XG5pbXBvcnQgeyBNb3ZlTGlzdFVwIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvTW92ZUxpc3RVcFwiO1xuaW1wb3J0IHsgT3V0ZGVudExpc3QgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9PdXRkZW50TGlzdFwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBjcmVhdGVFZGl0b3JDYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVFZGl0b3JDYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgTGlzdHNNb3ZlbWVudENvbW1hbmRzIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBvYnNpZGlhblNldHRpbmdzOiBPYnNpZGlhblNldHRpbmdzLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwibW92ZS1saXN0LWl0ZW0tdXBcIixcbiAgICAgIGljb246IFwiYXJyb3ctdXBcIixcbiAgICAgIG5hbWU6IFwiTW92ZSBsaXN0IGFuZCBzdWJsaXN0cyB1cFwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGNyZWF0ZUVkaXRvckNhbGxiYWNrKHRoaXMubW92ZUxpc3RVcCksXG4gICAgICBob3RrZXlzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RpZmllcnM6IFtcIk1vZFwiLCBcIlNoaWZ0XCJdLFxuICAgICAgICAgIGtleTogXCJBcnJvd1VwXCIsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtb3ZlLWxpc3QtaXRlbS1kb3duXCIsXG4gICAgICBpY29uOiBcImFycm93LWRvd25cIixcbiAgICAgIG5hbWU6IFwiTW92ZSBsaXN0IGFuZCBzdWJsaXN0cyBkb3duXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogY3JlYXRlRWRpdG9yQ2FsbGJhY2sodGhpcy5tb3ZlTGlzdERvd24pLFxuICAgICAgaG90a2V5czogW1xuICAgICAgICB7XG4gICAgICAgICAgbW9kaWZpZXJzOiBbXCJNb2RcIiwgXCJTaGlmdFwiXSxcbiAgICAgICAgICBrZXk6IFwiQXJyb3dEb3duXCIsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbmRlbnQtbGlzdFwiLFxuICAgICAgaWNvbjogXCJpbmRlbnRcIixcbiAgICAgIG5hbWU6IFwiSW5kZW50IHRoZSBsaXN0IGFuZCBzdWJsaXN0c1wiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGNyZWF0ZUVkaXRvckNhbGxiYWNrKHRoaXMuaW5kZW50TGlzdCksXG4gICAgICBob3RrZXlzOiBbXSxcbiAgICB9KTtcblxuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3V0ZGVudC1saXN0XCIsXG4gICAgICBpY29uOiBcIm91dGRlbnRcIixcbiAgICAgIG5hbWU6IFwiT3V0ZGVudCB0aGUgbGlzdCBhbmQgc3VibGlzdHNcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiBjcmVhdGVFZGl0b3JDYWxsYmFjayh0aGlzLm91dGRlbnRMaXN0KSxcbiAgICAgIGhvdGtleXM6IFtdLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIG1vdmVMaXN0RG93biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgY29uc3QgeyBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT4gbmV3IE1vdmVMaXN0RG93bihyb290KSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuXG4gICAgcmV0dXJuIHNob3VsZFN0b3BQcm9wYWdhdGlvbjtcbiAgfTtcblxuICBwcml2YXRlIG1vdmVMaXN0VXAgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIGNvbnN0IHsgc2hvdWxkU3RvcFByb3BhZ2F0aW9uIH0gPSB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBNb3ZlTGlzdFVwKHJvb3QpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG5cbiAgICByZXR1cm4gc2hvdWxkU3RvcFByb3BhZ2F0aW9uO1xuICB9O1xuXG4gIHByaXZhdGUgaW5kZW50TGlzdCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgY29uc3QgeyBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT5cbiAgICAgICAgbmV3IEluZGVudExpc3Qocm9vdCwgdGhpcy5vYnNpZGlhblNldHRpbmdzLmdldERlZmF1bHRJbmRlbnRDaGFycygpKSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuXG4gICAgcmV0dXJuIHNob3VsZFN0b3BQcm9wYWdhdGlvbjtcbiAgfTtcblxuICBwcml2YXRlIG91dGRlbnRMaXN0ID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICBjb25zdCB7IHNob3VsZFN0b3BQcm9wYWdhdGlvbiB9ID0gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIucGVyZm9ybShcbiAgICAgIChyb290KSA9PiBuZXcgT3V0ZGVudExpc3Qocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcblxuICAgIHJldHVybiBzaG91bGRTdG9wUHJvcGFnYXRpb247XG4gIH07XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBEZWxldGVUaWxsQ3VycmVudExpbmVDb250ZW50U3RhcnQgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGNvbnN0IGN1cnNvciA9IHJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgbGluZXMgPSBsaXN0LmdldExpbmVzSW5mbygpO1xuICAgIGNvbnN0IGxpbmVObyA9IGxpbmVzLmZpbmRJbmRleCgobCkgPT4gbC5mcm9tLmxpbmUgPT09IGN1cnNvci5saW5lKTtcblxuICAgIGxpbmVzW2xpbmVOb10udGV4dCA9IGxpbmVzW2xpbmVOb10udGV4dC5zbGljZShcbiAgICAgIGN1cnNvci5jaCAtIGxpbmVzW2xpbmVOb10uZnJvbS5jaCxcbiAgICApO1xuXG4gICAgbGlzdC5yZXBsYWNlTGluZXMobGluZXMubWFwKChsKSA9PiBsLnRleHQpKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3IobGluZXNbbGluZU5vXS5mcm9tKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgRGVsZXRlVGlsbEN1cnJlbnRMaW5lQ29udGVudFN0YXJ0IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvRGVsZXRlVGlsbEN1cnJlbnRMaW5lQ29udGVudFN0YXJ0XCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBNZXRhQmFja3NwYWNlQmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIGltZURldGVjdG9yOiBJTUVEZXRlY3RvcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIGtleW1hcC5vZihbXG4gICAgICAgIHtcbiAgICAgICAgICBtYWM6IFwibS1CYWNrc3BhY2VcIixcbiAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgIT09IFwibmV2ZXJcIiAmJlxuICAgICAgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKVxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBEZWxldGVUaWxsQ3VycmVudExpbmVDb250ZW50U3RhcnQocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7XG4gIEtlZXBDdXJzb3JXaXRoaW5Db250ZW50LFxuICBTZXR0aW5ncyxcbiAgVmVydGljYWxMaW5lc0FjdGlvbixcbn0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5cbmNsYXNzIE9ic2lkaWFuT3V0bGluZXJQbHVnaW5TZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICApIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlN0aWNrIHRoZSBjdXJzb3IgdG8gdGhlIGNvbnRlbnRcIilcbiAgICAgIC5zZXREZXNjKFwiRG9uJ3QgbGV0IHRoZSBjdXJzb3IgbW92ZSB0byB0aGUgYnVsbGV0IHBvc2l0aW9uLlwiKVxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xuICAgICAgICBkcm9wZG93blxuICAgICAgICAgIC5hZGRPcHRpb25zKHtcbiAgICAgICAgICAgIG5ldmVyOiBcIk5ldmVyXCIsXG4gICAgICAgICAgICBcImJ1bGxldC1vbmx5XCI6IFwiU3RpY2sgY3Vyc29yIG91dCBvZiBidWxsZXRzXCIsXG4gICAgICAgICAgICBcImJ1bGxldC1hbmQtY2hlY2tib3hcIjogXCJTdGljayBjdXJzb3Igb3V0IG9mIGJ1bGxldHMgYW5kIGNoZWNrYm94ZXNcIixcbiAgICAgICAgICB9IGFzIHsgW2tleSBpbiBLZWVwQ3Vyc29yV2l0aGluQ29udGVudF06IHN0cmluZyB9KVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLmtlZXBDdXJzb3JXaXRoaW5Db250ZW50KVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6IEtlZXBDdXJzb3JXaXRoaW5Db250ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLmtlZXBDdXJzb3JXaXRoaW5Db250ZW50ID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkVuaGFuY2UgdGhlIFRhYiBrZXlcIilcbiAgICAgIC5zZXREZXNjKFwiTWFrZSBUYWIgYW5kIFNoaWZ0LVRhYiBiZWhhdmUgdGhlIHNhbWUgYXMgb3RoZXIgb3V0bGluZXJzLlwiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLm92ZXJyaWRlVGFiQmVoYXZpb3VyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVUYWJCZWhhdmlvdXIgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiRW5oYW5jZSB0aGUgRW50ZXIga2V5XCIpXG4gICAgICAuc2V0RGVzYyhcIk1ha2UgdGhlIEVudGVyIGtleSBiZWhhdmUgdGhlIHNhbWUgYXMgb3RoZXIgb3V0bGluZXJzLlwiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLm92ZXJyaWRlRW50ZXJCZWhhdmlvdXIpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vdmVycmlkZUVudGVyQmVoYXZpb3VyID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlZpbS1tb2RlIG8vTyBpbnNlcnRzIGJ1bGxldHNcIilcbiAgICAgIC5zZXREZXNjKFwiQ3JlYXRlIGEgYnVsbGV0IHdoZW4gcHJlc3NpbmcgbyBvciBPIGluIFZpbSBtb2RlLlwiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLm92ZXJyaWRlVmltT0JlaGF2aW91cilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLm92ZXJyaWRlVmltT0JlaGF2aW91ciA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJFbmhhbmNlIHRoZSBDdHJsK0Egb3IgQ21kK0EgYmVoYXZpb3JcIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICBcIlByZXNzIHRoZSBob3RrZXkgb25jZSB0byBzZWxlY3QgdGhlIGN1cnJlbnQgbGlzdCBpdGVtLiBQcmVzcyB0aGUgaG90a2V5IHR3aWNlIHRvIHNlbGVjdCB0aGUgZW50aXJlIGxpc3QuXCIsXG4gICAgICApXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVTZWxlY3RBbGxCZWhhdmlvdXIpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vdmVycmlkZVNlbGVjdEFsbEJlaGF2aW91ciA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJJbXByb3ZlIHRoZSBzdHlsZSBvZiB5b3VyIGxpc3RzXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgXCJTdHlsZXMgYXJlIG9ubHkgY29tcGF0aWJsZSB3aXRoIGJ1aWx0LWluIE9ic2lkaWFuIHRoZW1lcyBhbmQgbWF5IG5vdCBiZSBjb21wYXRpYmxlIHdpdGggb3RoZXIgdGhlbWVzLlwiLFxuICAgICAgKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLmJldHRlckxpc3RzU3R5bGVzKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MuYmV0dGVyTGlzdHNTdHlsZXMgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiRHJhdyB2ZXJ0aWNhbCBpbmRlbnRhdGlvbiBsaW5lc1wiKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLnZlcnRpY2FsTGluZXMpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMuc2V0dGluZ3MudmVydGljYWxMaW5lcyA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlZlcnRpY2FsIGluZGVudGF0aW9uIGxpbmUgY2xpY2sgYWN0aW9uXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG4gICAgICAgIGRyb3Bkb3duXG4gICAgICAgICAgLmFkZE9wdGlvbnMoe1xuICAgICAgICAgICAgbm9uZTogXCJOb25lXCIsXG4gICAgICAgICAgICBcInpvb20taW5cIjogXCJab29tIEluXCIsXG4gICAgICAgICAgICBcInRvZ2dsZS1mb2xkaW5nXCI6IFwiVG9nZ2xlIEZvbGRpbmdcIixcbiAgICAgICAgICB9IGFzIHsgW2tleSBpbiBWZXJ0aWNhbExpbmVzQWN0aW9uXTogc3RyaW5nIH0pXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMuc2V0dGluZ3MudmVydGljYWxMaW5lc0FjdGlvbilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlOiBWZXJ0aWNhbExpbmVzQWN0aW9uKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLnZlcnRpY2FsTGluZXNBY3Rpb24gPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkRyYWctYW5kLURyb3BcIikuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLmRyYWdBbmREcm9wKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5kcmFnQW5kRHJvcCA9IHZhbHVlO1xuICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkRlYnVnIG1vZGVcIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICBcIk9wZW4gRGV2VG9vbHMgKENvbW1hbmQrT3B0aW9uK0kgb3IgQ29udHJvbCtTaGlmdCtJKSB0byBjb3B5IHRoZSBkZWJ1ZyBsb2dzLlwiLFxuICAgICAgKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLmRlYnVnKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLmRlYnVnID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVGFiIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLmFkZFNldHRpbmdUYWIoXG4gICAgICBuZXcgT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdUYWIoXG4gICAgICAgIHRoaXMucGx1Z2luLmFwcCxcbiAgICAgICAgdGhpcy5wbHVnaW4sXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IFByZWMgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcbmltcG9ydCB7IGtleW1hcCB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgT3V0ZGVudExpc3QgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9PdXRkZW50TGlzdFwiO1xuaW1wb3J0IHsgSU1FRGV0ZWN0b3IgfSBmcm9tIFwiLi4vc2VydmljZXMvSU1FRGV0ZWN0b3JcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5pbXBvcnQgeyBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVLZXltYXBSdW5DYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgU2hpZnRUYWJCZWhhdmlvdXJPdmVycmlkZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAgUHJlYy5oaWdoZXN0KFxuICAgICAgICBrZXltYXAub2YoW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGtleTogXCJzLVRhYlwiLFxuICAgICAgICAgICAgcnVuOiBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSksXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVUYWJCZWhhdmlvdXIgJiYgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKTtcbiAgfTtcblxuICBwcml2YXRlIHJ1biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT4gbmV3IE91dGRlbnRMaXN0KHJvb3QpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG4gIH07XG59XG4iLCJpbXBvcnQgeyBBcHAsIE1vZGFsLCBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcblxuaW50ZXJmYWNlIEFwcEhpZGRlblByb3BzIHtcbiAgaW50ZXJuYWxQbHVnaW5zOiB7XG4gICAgY29uZmlnOiB7IFtrZXk6IHN0cmluZ106IGJvb2xlYW4gfTtcbiAgfTtcbiAgaXNNb2JpbGU6IGJvb2xlYW47XG4gIHBsdWdpbnM6IHtcbiAgICBlbmFibGVkUGx1Z2luczogU2V0PHN0cmluZz47XG4gICAgbWFuaWZlc3RzOiB7IFtrZXk6IHN0cmluZ106IHsgdmVyc2lvbjogc3RyaW5nIH0gfTtcbiAgfTtcbiAgdmF1bHQ6IHtcbiAgICBjb25maWc6IG9iamVjdDtcbiAgfTtcbn1cblxuY2xhc3MgU3lzdGVtSW5mb01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpIHtcbiAgICB0aGlzLnRpdGxlRWwuc2V0VGV4dChcIlN5c3RlbSBJbmZvcm1hdGlvblwiKTtcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgYXBwID0gdGhpcy5hcHAgYXMgYW55IGFzIEFwcEhpZGRlblByb3BzO1xuXG4gICAgY29uc3QgZGF0YSA9IHtcbiAgICAgIHByb2Nlc3M6IHtcbiAgICAgICAgYXJjaDogcHJvY2Vzcy5hcmNoLFxuICAgICAgICBwbGF0Zm9ybTogcHJvY2Vzcy5wbGF0Zm9ybSxcbiAgICAgIH0sXG4gICAgICBhcHA6IHtcbiAgICAgICAgaW50ZXJuYWxQbHVnaW5zOiB7XG4gICAgICAgICAgY29uZmlnOiBhcHAuaW50ZXJuYWxQbHVnaW5zLmNvbmZpZyxcbiAgICAgICAgfSxcbiAgICAgICAgaXNNb2JpbGU6IGFwcC5pc01vYmlsZSxcbiAgICAgICAgcGx1Z2luczoge1xuICAgICAgICAgIGVuYWJsZWRQbHVnaW5zOiBBcnJheS5mcm9tKGFwcC5wbHVnaW5zLmVuYWJsZWRQbHVnaW5zKSxcbiAgICAgICAgICBtYW5pZmVzdHM6IE9iamVjdC5rZXlzKGFwcC5wbHVnaW5zLm1hbmlmZXN0cykucmVkdWNlKFxuICAgICAgICAgICAgKGFjYywga2V5KSA9PiB7XG4gICAgICAgICAgICAgIGFjY1trZXldID0ge1xuICAgICAgICAgICAgICAgIHZlcnNpb246IGFwcC5wbHVnaW5zLm1hbmlmZXN0c1trZXldLnZlcnNpb24sXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge30gYXMgeyBba2V5OiBzdHJpbmddOiB7IHZlcnNpb246IHN0cmluZyB9IH0sXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgICAgdmF1bHQ6IHtcbiAgICAgICAgICBjb25maWc6IGFwcC52YXVsdC5jb25maWcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcGx1Z2luOiB7XG4gICAgICAgIHNldHRpbmdzOiB7IHZhbHVlczogdGhpcy5zZXR0aW5ncy5nZXRWYWx1ZXMoKSB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgdGV4dCA9IEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpO1xuXG4gICAgY29uc3QgcHJlID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRWwoXCJwcmVcIik7XG4gICAgcHJlLnNldFRleHQodGV4dCk7XG4gICAgcHJlLnNldENzc1N0eWxlcyh7XG4gICAgICBvdmVyZmxvdzogXCJzY3JvbGxcIixcbiAgICAgIG1heEhlaWdodDogXCIzMDBweFwiLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYnV0dG9uID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRWwoXCJidXR0b25cIik7XG4gICAgYnV0dG9uLnNldFRleHQoXCJDb3B5IGFuZCBDbG9zZVwiKTtcbiAgICBidXR0b24ub25DbGlja0V2ZW50KCgpID0+IHtcbiAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KFwiYGBganNvblxcblwiICsgdGV4dCArIFwiXFxuYGBgXCIpO1xuICAgICAgdGhpcy5jbG9zZSgpO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTeXN0ZW1JbmZvIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwic3lzdGVtLWluZm9cIixcbiAgICAgIG5hbWU6IFwiU2hvdyBTeXN0ZW0gSW5mb1wiLFxuICAgICAgY2FsbGJhY2s6IHRoaXMuY2FsbGJhY2ssXG4gICAgICBob3RrZXlzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RpZmllcnM6IFtcIk1vZFwiLCBcIlNoaWZ0XCIsIFwiQWx0XCJdLFxuICAgICAgICAgIGtleTogXCJJXCIsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIGNhbGxiYWNrID0gKCkgPT4ge1xuICAgIGNvbnN0IG1vZGFsID0gbmV3IFN5c3RlbUluZm9Nb2RhbCh0aGlzLnBsdWdpbi5hcHAsIHRoaXMuc2V0dGluZ3MpO1xuICAgIG1vZGFsLm9wZW4oKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBQcmVjIH0gZnJvbSBcIkBjb2RlbWlycm9yL3N0YXRlXCI7XG5pbXBvcnQgeyBrZXltYXAgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9lZGl0b3JcIjtcbmltcG9ydCB7IEluZGVudExpc3QgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9JbmRlbnRMaXN0XCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuaW1wb3J0IHsgY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2sgfSBmcm9tIFwiLi4vdXRpbHMvY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2tcIjtcblxuZXhwb3J0IGNsYXNzIFRhYkJlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBpbWVEZXRlY3RvcjogSU1FRGV0ZWN0b3IsXG4gICAgcHJpdmF0ZSBvYnNpZGlhblNldHRpbmdzOiBPYnNpZGlhblNldHRpbmdzLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAgUHJlYy5oaWdoZXN0KFxuICAgICAgICBrZXltYXAub2YoW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGtleTogXCJUYWJcIixcbiAgICAgICAgICAgIHJ1bjogY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0pLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIGNoZWNrID0gKCkgPT4ge1xuICAgIHJldHVybiB0aGlzLnNldHRpbmdzLm92ZXJyaWRlVGFiQmVoYXZpb3VyICYmICF0aGlzLmltZURldGVjdG9yLmlzT3BlbmVkKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+XG4gICAgICAgIG5ldyBJbmRlbnRMaXN0KHJvb3QsIHRoaXMub2JzaWRpYW5TZXR0aW5ncy5nZXREZWZhdWx0SW5kZW50Q2hhcnMoKSksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQge1xuICBFZGl0b3JWaWV3LFxuICBQbHVnaW5WYWx1ZSxcbiAgVmlld1BsdWdpbixcbiAgVmlld1VwZGF0ZSxcbn0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IsIGdldEVkaXRvckZyb21TdGF0ZSB9IGZyb20gXCIuLi9lZGl0b3JcIjtcbmltcG9ydCB7IExpc3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBQYXJzZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvUGFyc2VyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuXG5jb25zdCBWRVJUSUNBTF9MSU5FU19CT0RZX0NMQVNTID0gXCJvdXRsaW5lci1wbHVnaW4tdmVydGljYWwtbGluZXNcIjtcblxuaW50ZXJmYWNlIExpbmVEYXRhIHtcbiAgdG9wOiBudW1iZXI7XG4gIGxlZnQ6IG51bWJlcjtcbiAgaGVpZ2h0OiBzdHJpbmc7XG4gIGxpc3Q6IExpc3Q7XG59XG5cbmNsYXNzIFZlcnRpY2FsTGluZXNQbHVnaW5WYWx1ZSBpbXBsZW1lbnRzIFBsdWdpblZhbHVlIHtcbiAgcHJpdmF0ZSBzY2hlZHVsZWQ6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+O1xuICBwcml2YXRlIHNjcm9sbGVyOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBjb250ZW50Q29udGFpbmVyOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlZGl0b3I6IE15RWRpdG9yO1xuICBwcml2YXRlIGxhc3RMaW5lOiBudW1iZXI7XG4gIHByaXZhdGUgbGluZXM6IExpbmVEYXRhW107XG4gIHByaXZhdGUgbGluZUVsZW1lbnRzOiBIVE1MRWxlbWVudFtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBvYnNpZGlhblNldHRpbmdzOiBPYnNpZGlhblNldHRpbmdzLFxuICAgIHByaXZhdGUgcGFyc2VyOiBQYXJzZXIsXG4gICAgcHJpdmF0ZSB2aWV3OiBFZGl0b3JWaWV3LFxuICApIHtcbiAgICB0aGlzLnZpZXcuc2Nyb2xsRE9NLmFkZEV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5vblNjcm9sbCk7XG4gICAgdGhpcy5zZXR0aW5ncy5vbkNoYW5nZSh0aGlzLnNjaGVkdWxlUmVjYWxjdWxhdGUpO1xuXG4gICAgdGhpcy5wcmVwYXJlRG9tKCk7XG4gICAgdGhpcy53YWl0Rm9yRWRpdG9yKCk7XG4gIH1cblxuICBwcml2YXRlIHdhaXRGb3JFZGl0b3IgPSAoKSA9PiB7XG4gICAgY29uc3QgZWRpdG9yID0gZ2V0RWRpdG9yRnJvbVN0YXRlKHRoaXMudmlldy5zdGF0ZSk7XG4gICAgaWYgKCFlZGl0b3IpIHtcbiAgICAgIHNldFRpbWVvdXQodGhpcy53YWl0Rm9yRWRpdG9yLCAwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5lZGl0b3IgPSBlZGl0b3I7XG4gICAgdGhpcy5zY2hlZHVsZVJlY2FsY3VsYXRlKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBwcmVwYXJlRG9tKCkge1xuICAgIHRoaXMuY29udGVudENvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgdGhpcy5jb250ZW50Q29udGFpbmVyLmNsYXNzTGlzdC5hZGQoXG4gICAgICBcIm91dGxpbmVyLXBsdWdpbi1saXN0LWxpbmVzLWNvbnRlbnQtY29udGFpbmVyXCIsXG4gICAgKTtcblxuICAgIHRoaXMuc2Nyb2xsZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRoaXMuc2Nyb2xsZXIuY2xhc3NMaXN0LmFkZChcIm91dGxpbmVyLXBsdWdpbi1saXN0LWxpbmVzLXNjcm9sbGVyXCIpO1xuXG4gICAgdGhpcy5zY3JvbGxlci5hcHBlbmRDaGlsZCh0aGlzLmNvbnRlbnRDb250YWluZXIpO1xuICAgIHRoaXMudmlldy5kb20uYXBwZW5kQ2hpbGQodGhpcy5zY3JvbGxlcik7XG4gIH1cblxuICBwcml2YXRlIG9uU2Nyb2xsID0gKGU6IEV2ZW50KSA9PiB7XG4gICAgY29uc3QgeyBzY3JvbGxMZWZ0LCBzY3JvbGxUb3AgfSA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuICAgIHRoaXMuc2Nyb2xsZXIuc2Nyb2xsVG8oc2Nyb2xsTGVmdCwgc2Nyb2xsVG9wKTtcbiAgfTtcblxuICBwcml2YXRlIHNjaGVkdWxlUmVjYWxjdWxhdGUgPSAoKSA9PiB7XG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuc2NoZWR1bGVkKTtcbiAgICB0aGlzLnNjaGVkdWxlZCA9IHNldFRpbWVvdXQodGhpcy5jYWxjdWxhdGUsIDApO1xuICB9O1xuXG4gIHVwZGF0ZSh1cGRhdGU6IFZpZXdVcGRhdGUpIHtcbiAgICBpZiAoXG4gICAgICB1cGRhdGUuZG9jQ2hhbmdlZCB8fFxuICAgICAgdXBkYXRlLnZpZXdwb3J0Q2hhbmdlZCB8fFxuICAgICAgdXBkYXRlLmdlb21ldHJ5Q2hhbmdlZCB8fFxuICAgICAgdXBkYXRlLnRyYW5zYWN0aW9ucy5zb21lKCh0cikgPT4gdHIucmVjb25maWd1cmVkKVxuICAgICkge1xuICAgICAgdGhpcy5zY2hlZHVsZVJlY2FsY3VsYXRlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGUgPSAoKSA9PiB7XG4gICAgdGhpcy5saW5lcyA9IFtdO1xuXG4gICAgaWYgKFxuICAgICAgdGhpcy5zZXR0aW5ncy52ZXJ0aWNhbExpbmVzICYmXG4gICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MuaXNEZWZhdWx0VGhlbWVFbmFibGVkKCkgJiZcbiAgICAgIHRoaXMudmlldy52aWV3cG9ydExpbmVCbG9ja3MubGVuZ3RoID4gMCAmJlxuICAgICAgdGhpcy52aWV3LnZpc2libGVSYW5nZXMubGVuZ3RoID4gMFxuICAgICkge1xuICAgICAgY29uc3QgZnJvbUxpbmUgPSB0aGlzLmVkaXRvci5vZmZzZXRUb1Bvcyh0aGlzLnZpZXcudmlld3BvcnQuZnJvbSkubGluZTtcbiAgICAgIGNvbnN0IHRvTGluZSA9IHRoaXMuZWRpdG9yLm9mZnNldFRvUG9zKHRoaXMudmlldy52aWV3cG9ydC50bykubGluZTtcbiAgICAgIGNvbnN0IGxpc3RzID0gdGhpcy5wYXJzZXIucGFyc2VSYW5nZSh0aGlzLmVkaXRvciwgZnJvbUxpbmUsIHRvTGluZSk7XG5cbiAgICAgIGZvciAoY29uc3QgbGlzdCBvZiBsaXN0cykge1xuICAgICAgICB0aGlzLmxhc3RMaW5lID0gbGlzdC5nZXRDb250ZW50RW5kKCkubGluZTtcblxuICAgICAgICBmb3IgKGNvbnN0IGMgb2YgbGlzdC5nZXRDaGlsZHJlbigpKSB7XG4gICAgICAgICAgdGhpcy5yZWN1cnNpdmUoYyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5saW5lcy5zb3J0KChhLCBiKSA9PlxuICAgICAgICBhLnRvcCA9PT0gYi50b3AgPyBhLmxlZnQgLSBiLmxlZnQgOiBhLnRvcCAtIGIudG9wLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZURvbSgpO1xuICB9O1xuXG4gIHByaXZhdGUgZ2V0TmV4dFNpYmxpbmcobGlzdDogTGlzdCk6IExpc3QgfCBudWxsIHtcbiAgICBsZXQgbGlzdFRtcCA9IGxpc3Q7XG4gICAgbGV0IHAgPSBsaXN0VG1wLmdldFBhcmVudCgpO1xuICAgIHdoaWxlIChwKSB7XG4gICAgICBjb25zdCBuZXh0U2libGluZyA9IHAuZ2V0TmV4dFNpYmxpbmdPZihsaXN0VG1wKTtcbiAgICAgIGlmIChuZXh0U2libGluZykge1xuICAgICAgICByZXR1cm4gbmV4dFNpYmxpbmc7XG4gICAgICB9XG4gICAgICBsaXN0VG1wID0gcDtcbiAgICAgIHAgPSBsaXN0VG1wLmdldFBhcmVudCgpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgcmVjdXJzaXZlKGxpc3Q6IExpc3QsIHBhcmVudEN0eDogeyByb290TGVmdD86IG51bWJlciB9ID0ge30pIHtcbiAgICBjb25zdCBjaGlsZHJlbiA9IGxpc3QuZ2V0Q2hpbGRyZW4oKTtcblxuICAgIGlmIChjaGlsZHJlbi5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmcm9tT2Zmc2V0ID0gdGhpcy5lZGl0b3IucG9zVG9PZmZzZXQoe1xuICAgICAgbGluZTogbGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lLFxuICAgICAgY2g6IGxpc3QuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoLFxuICAgIH0pO1xuICAgIGNvbnN0IG5leHRTaWJsaW5nID0gdGhpcy5nZXROZXh0U2libGluZyhsaXN0KTtcbiAgICBjb25zdCB0aWxsT2Zmc2V0ID0gdGhpcy5lZGl0b3IucG9zVG9PZmZzZXQoe1xuICAgICAgbGluZTogbmV4dFNpYmxpbmdcbiAgICAgICAgPyBuZXh0U2libGluZy5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lIC0gMVxuICAgICAgICA6IHRoaXMubGFzdExpbmUsXG4gICAgICBjaDogMCxcbiAgICB9KTtcblxuICAgIGxldCB2aXNpYmxlRnJvbSA9IHRoaXMudmlldy52aXNpYmxlUmFuZ2VzWzBdLmZyb207XG4gICAgbGV0IHZpc2libGVUbyA9XG4gICAgICB0aGlzLnZpZXcudmlzaWJsZVJhbmdlc1t0aGlzLnZpZXcudmlzaWJsZVJhbmdlcy5sZW5ndGggLSAxXS50bztcbiAgICBjb25zdCB6b29tUmFuZ2UgPSB0aGlzLmVkaXRvci5nZXRab29tUmFuZ2UoKTtcbiAgICBpZiAoem9vbVJhbmdlKSB7XG4gICAgICB2aXNpYmxlRnJvbSA9IE1hdGgubWF4KFxuICAgICAgICB2aXNpYmxlRnJvbSxcbiAgICAgICAgdGhpcy5lZGl0b3IucG9zVG9PZmZzZXQoem9vbVJhbmdlLmZyb20pLFxuICAgICAgKTtcbiAgICAgIHZpc2libGVUbyA9IE1hdGgubWluKHZpc2libGVUbywgdGhpcy5lZGl0b3IucG9zVG9PZmZzZXQoem9vbVJhbmdlLnRvKSk7XG4gICAgfVxuXG4gICAgaWYgKGZyb21PZmZzZXQgPiB2aXNpYmxlVG8gfHwgdGlsbE9mZnNldCA8IHZpc2libGVGcm9tKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgY29vcmRzID0gdGhpcy52aWV3LmNvb3Jkc0F0UG9zKGZyb21PZmZzZXQsIDEpO1xuICAgIGlmIChwYXJlbnRDdHgucm9vdExlZnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcGFyZW50Q3R4LnJvb3RMZWZ0ID0gY29vcmRzLmxlZnQ7XG4gICAgfVxuICAgIGNvbnN0IGxlZnQgPSBNYXRoLmZsb29yKGNvb3Jkcy5yaWdodCAtIHBhcmVudEN0eC5yb290TGVmdCk7XG5cbiAgICBjb25zdCB0b3AgPVxuICAgICAgdmlzaWJsZUZyb20gPiAwICYmIGZyb21PZmZzZXQgPCB2aXNpYmxlRnJvbVxuICAgICAgICA/IC0yMFxuICAgICAgICA6IHRoaXMudmlldy5saW5lQmxvY2tBdChmcm9tT2Zmc2V0KS50b3A7XG4gICAgY29uc3QgYm90dG9tID1cbiAgICAgIHRpbGxPZmZzZXQgPiB2aXNpYmxlVG9cbiAgICAgICAgPyB0aGlzLnZpZXcubGluZUJsb2NrQXQodmlzaWJsZVRvIC0gMSkuYm90dG9tXG4gICAgICAgIDogdGhpcy52aWV3LmxpbmVCbG9ja0F0KHRpbGxPZmZzZXQpLmJvdHRvbTtcbiAgICBjb25zdCBoZWlnaHQgPSBib3R0b20gLSB0b3A7XG5cbiAgICBpZiAoaGVpZ2h0ID4gMCAmJiAhbGlzdC5pc0ZvbGRlZCgpKSB7XG4gICAgICBjb25zdCBuZXh0U2libGluZyA9IGxpc3QuZ2V0UGFyZW50KCkuZ2V0TmV4dFNpYmxpbmdPZihsaXN0KTtcbiAgICAgIGNvbnN0IGhhc05leHRTaWJsaW5nID1cbiAgICAgICAgISFuZXh0U2libGluZyAmJlxuICAgICAgICB0aGlzLmVkaXRvci5wb3NUb09mZnNldChuZXh0U2libGluZy5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKSkgPD1cbiAgICAgICAgICB2aXNpYmxlVG87XG5cbiAgICAgIHRoaXMubGluZXMucHVzaCh7XG4gICAgICAgIHRvcCxcbiAgICAgICAgbGVmdCxcbiAgICAgICAgaGVpZ2h0OiBgY2FsYygke2hlaWdodH1weCAke2hhc05leHRTaWJsaW5nID8gXCItIDEuNWVtXCIgOiBcIi0gMmVtXCJ9KWAsXG4gICAgICAgIGxpc3QsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICBpZiAoIWNoaWxkLmlzRW1wdHkoKSkge1xuICAgICAgICB0aGlzLnJlY3Vyc2l2ZShjaGlsZCwgcGFyZW50Q3R4KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG9uQ2xpY2sgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgIGNvbnN0IGxpbmUgPSB0aGlzLmxpbmVzW051bWJlcigoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmRhdGFzZXQuaW5kZXgpXTtcblxuICAgIHN3aXRjaCAodGhpcy5zZXR0aW5ncy52ZXJ0aWNhbExpbmVzQWN0aW9uKSB7XG4gICAgICBjYXNlIFwiem9vbS1pblwiOlxuICAgICAgICB0aGlzLnpvb21JbihsaW5lKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgXCJ0b2dnbGUtZm9sZGluZ1wiOlxuICAgICAgICB0aGlzLnRvZ2dsZUZvbGRpbmcobGluZSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIHpvb21JbihsaW5lOiBMaW5lRGF0YSkge1xuICAgIGNvbnN0IGVkaXRvciA9IGdldEVkaXRvckZyb21TdGF0ZSh0aGlzLnZpZXcuc3RhdGUpO1xuXG4gICAgZWRpdG9yLnpvb21JbihsaW5lLmxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSk7XG4gIH1cblxuICBwcml2YXRlIHRvZ2dsZUZvbGRpbmcobGluZTogTGluZURhdGEpIHtcbiAgICBjb25zdCB7IGxpc3QgfSA9IGxpbmU7XG5cbiAgICBpZiAobGlzdC5pc0VtcHR5KCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgbmVlZFRvVW5mb2xkID0gdHJ1ZTtcbiAgICBjb25zdCBsaW5lc1RvVG9nZ2xlOiBudW1iZXJbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgYyBvZiBsaXN0LmdldENoaWxkcmVuKCkpIHtcbiAgICAgIGlmIChjLmlzRW1wdHkoKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmICghYy5pc0ZvbGRlZCgpKSB7XG4gICAgICAgIG5lZWRUb1VuZm9sZCA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgbGluZXNUb1RvZ2dsZS5wdXNoKGMuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSk7XG4gICAgfVxuXG4gICAgY29uc3QgZWRpdG9yID0gZ2V0RWRpdG9yRnJvbVN0YXRlKHRoaXMudmlldy5zdGF0ZSk7XG5cbiAgICBmb3IgKGNvbnN0IGwgb2YgbGluZXNUb1RvZ2dsZSkge1xuICAgICAgaWYgKG5lZWRUb1VuZm9sZCkge1xuICAgICAgICBlZGl0b3IudW5mb2xkKGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWRpdG9yLmZvbGQobCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVEb20oKSB7XG4gICAgY29uc3QgY21TY3JvbGwgPSB0aGlzLnZpZXcuc2Nyb2xsRE9NO1xuICAgIGNvbnN0IGNtQ29udGVudCA9IHRoaXMudmlldy5jb250ZW50RE9NO1xuICAgIGNvbnN0IGNtQ29udGVudENvbnRhaW5lciA9IGNtQ29udGVudC5wYXJlbnRFbGVtZW50O1xuICAgIGNvbnN0IGNtU2l6ZXIgPSBjbUNvbnRlbnRDb250YWluZXIucGFyZW50RWxlbWVudDtcblxuICAgIC8qKlxuICAgICAqIE9ic2lkaWFuIGNhbiBhZGQgYWRkaXRpb25hbCBlbGVtZW50cyBpbnRvIENvbnRlbnQgTWFuYWdlci5cbiAgICAgKiBUaGUgbW9zdCBvYnZpb3VzIGNhc2UgaXMgdGhlICdlbWJlZGRlZC1iYWNrbGlua3MnIGNvcmUgcGx1Z2luIHRoYXQgYWRkcyBhIG1lbnUgaW5zaWRlIGEgQ29udGVudCBNYW5hZ2VyLlxuICAgICAqIFdlIG11c3QgdGFrZSBoZWlnaHRzIG9mIGFsbCBvZiB0aGVzZSBlbGVtZW50cyBpbnRvIGFjY291bnRcbiAgICAgKiB0byBiZSBhYmxlIHRvIGNhbGN1bGF0ZSB0aGUgY29ycmVjdCBzaXplIG9mIGxpbmVzJyBjb250YWluZXIuXG4gICAgICovXG4gICAgbGV0IGNtU2l6ZXJDaGlsZHJlblN1bUhlaWdodCA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbVNpemVyLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjbVNpemVyQ2hpbGRyZW5TdW1IZWlnaHQgKz0gY21TaXplci5jaGlsZHJlbltpXS5jbGllbnRIZWlnaHQ7XG4gICAgfVxuXG4gICAgdGhpcy5zY3JvbGxlci5zdHlsZS50b3AgPSBjbVNjcm9sbC5vZmZzZXRUb3AgKyBcInB4XCI7XG4gICAgdGhpcy5jb250ZW50Q29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGNtU2l6ZXJDaGlsZHJlblN1bUhlaWdodCArIFwicHhcIjtcbiAgICB0aGlzLmNvbnRlbnRDb250YWluZXIuc3R5bGUubWFyZ2luTGVmdCA9XG4gICAgICBjbUNvbnRlbnRDb250YWluZXIub2Zmc2V0TGVmdCArIFwicHhcIjtcbiAgICB0aGlzLmNvbnRlbnRDb250YWluZXIuc3R5bGUubWFyZ2luVG9wID1cbiAgICAgIChjbUNvbnRlbnQuZmlyc3RFbGVtZW50Q2hpbGQgYXMgSFRNTEVsZW1lbnQpLm9mZnNldFRvcCAtIDI0ICsgXCJweFwiO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5saW5lRWxlbWVudHMubGVuZ3RoID09PSBpKSB7XG4gICAgICAgIGNvbnN0IGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICBlLmNsYXNzTGlzdC5hZGQoXCJvdXRsaW5lci1wbHVnaW4tbGlzdC1saW5lXCIpO1xuICAgICAgICBlLmRhdGFzZXQuaW5kZXggPSBTdHJpbmcoaSk7XG4gICAgICAgIGUuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLm9uQ2xpY2spO1xuICAgICAgICB0aGlzLmNvbnRlbnRDb250YWluZXIuYXBwZW5kQ2hpbGQoZSk7XG4gICAgICAgIHRoaXMubGluZUVsZW1lbnRzLnB1c2goZSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGwgPSB0aGlzLmxpbmVzW2ldO1xuICAgICAgY29uc3QgZSA9IHRoaXMubGluZUVsZW1lbnRzW2ldO1xuICAgICAgZS5zdHlsZS50b3AgPSBsLnRvcCArIFwicHhcIjtcbiAgICAgIGUuc3R5bGUubGVmdCA9IGwubGVmdCArIFwicHhcIjtcbiAgICAgIGUuc3R5bGUuaGVpZ2h0ID0gbC5oZWlnaHQ7XG4gICAgICBlLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IHRoaXMubGluZXMubGVuZ3RoOyBpIDwgdGhpcy5saW5lRWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGUgPSB0aGlzLmxpbmVFbGVtZW50c1tpXTtcbiAgICAgIGUuc3R5bGUudG9wID0gXCIwcHhcIjtcbiAgICAgIGUuc3R5bGUubGVmdCA9IFwiMHB4XCI7XG4gICAgICBlLnN0eWxlLmhlaWdodCA9IFwiMHB4XCI7XG4gICAgICBlLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc2V0dGluZ3MucmVtb3ZlQ2FsbGJhY2sodGhpcy5zY2hlZHVsZVJlY2FsY3VsYXRlKTtcbiAgICB0aGlzLnZpZXcuc2Nyb2xsRE9NLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgdGhpcy5vblNjcm9sbCk7XG4gICAgdGhpcy52aWV3LmRvbS5yZW1vdmVDaGlsZCh0aGlzLnNjcm9sbGVyKTtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5zY2hlZHVsZWQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWZXJ0aWNhbExpbmVzIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIHByaXZhdGUgdXBkYXRlQm9keUNsYXNzSW50ZXJ2YWw6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncyxcbiAgICBwcml2YXRlIHBhcnNlcjogUGFyc2VyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnVwZGF0ZUJvZHlDbGFzcygpO1xuICAgIHRoaXMudXBkYXRlQm9keUNsYXNzSW50ZXJ2YWwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgdGhpcy51cGRhdGVCb2R5Q2xhc3MoKTtcbiAgICB9LCAxMDAwKTtcblxuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAgVmlld1BsdWdpbi5kZWZpbmUoXG4gICAgICAgICh2aWV3KSA9PlxuICAgICAgICAgIG5ldyBWZXJ0aWNhbExpbmVzUGx1Z2luVmFsdWUoXG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICAgICAgdGhpcy5vYnNpZGlhblNldHRpbmdzLFxuICAgICAgICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICAgICAgICB2aWV3LFxuICAgICAgICAgICksXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7XG4gICAgY2xlYXJJbnRlcnZhbCh0aGlzLnVwZGF0ZUJvZHlDbGFzc0ludGVydmFsKTtcbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoVkVSVElDQUxfTElORVNfQk9EWV9DTEFTUyk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUJvZHlDbGFzcyA9ICgpID0+IHtcbiAgICBjb25zdCBzaG91bGRFeGlzdHMgPVxuICAgICAgdGhpcy5vYnNpZGlhblNldHRpbmdzLmlzRGVmYXVsdFRoZW1lRW5hYmxlZCgpICYmXG4gICAgICB0aGlzLnNldHRpbmdzLnZlcnRpY2FsTGluZXM7XG4gICAgY29uc3QgZXhpc3RzID0gZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QuY29udGFpbnMoVkVSVElDQUxfTElORVNfQk9EWV9DTEFTUyk7XG5cbiAgICBpZiAoc2hvdWxkRXhpc3RzICYmICFleGlzdHMpIHtcbiAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZChWRVJUSUNBTF9MSU5FU19CT0RZX0NMQVNTKTtcbiAgICB9XG5cbiAgICBpZiAoIXNob3VsZEV4aXN0cyAmJiBleGlzdHMpIHtcbiAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZShWRVJUSUNBTF9MSU5FU19CT0RZX0NMQVNTKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyB0eXBlIEVkaXRvciwgTWFya2Rvd25WaWV3LCBOb3RpY2UsIFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9lZGl0b3JcIjtcbmltcG9ydCB7IENyZWF0ZU5ld0l0ZW0gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9DcmVhdGVOZXdJdGVtXCI7XG5pbXBvcnQgeyBPYnNpZGlhblNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFBhcnNlciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QYXJzZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgdHlwZSBDTSA9IG9iamVjdDtcblxuICBpbnRlcmZhY2UgVmltIHtcbiAgICBkZWZpbmVBY3Rpb248VD4obmFtZTogc3RyaW5nLCBmbjogKGNtOiBDTSwgYXJnczogVCkgPT4gdm9pZCk6IHZvaWQ7XG5cbiAgICBoYW5kbGVFeChjbTogQ00sIGNvbW1hbmQ6IHN0cmluZyk6IHZvaWQ7XG5cbiAgICBlbnRlckluc2VydE1vZGUoY206IENNKTogdm9pZDtcblxuICAgIG1hcENvbW1hbmQoXG4gICAgICBrZXlzOiBzdHJpbmcsXG4gICAgICB0eXBlOiBzdHJpbmcsXG4gICAgICBuYW1lOiBzdHJpbmcsXG4gICAgICBhcmdzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICAgIGV4dHJhOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgICApOiB2b2lkO1xuICB9XG5cbiAgaW50ZXJmYWNlIFdpbmRvdyB7XG4gICAgQ29kZU1pcnJvckFkYXB0ZXI/OiB7XG4gICAgICBWaW0/OiBWaW07XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVmltT0JlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIHByaXZhdGUgaW5pdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIG9ic2lkaWFuU2V0dGluZ3M6IE9ic2lkaWFuU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnNldHRpbmdzLm9uQ2hhbmdlKHRoaXMuaGFuZGxlU2V0dGluZ3NDaGFuZ2UpO1xuICAgIHRoaXMuaGFuZGxlU2V0dGluZ3NDaGFuZ2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgbW92ZUN1cnNvclRvTGluZUVuZChlZGl0b3I6IEVkaXRvcikge1xuICAgIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcbiAgICBlZGl0b3Iuc2V0Q3Vyc29yKHtcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lLFxuICAgICAgY2g6IGVkaXRvci5nZXRMaW5lKGN1cnNvci5saW5lKS5sZW5ndGgsXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldExpbmVJbmRlbnQobGluZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGxpbmUubWF0Y2goL15bIFxcdF0qLylbMF07XG4gIH1cblxuICBwcml2YXRlIG9wZW5QbGFpbkxpbmUoZWRpdG9yOiBFZGl0b3IsIGFmdGVyOiBib29sZWFuKSB7XG4gICAgY29uc3QgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShjdXJzb3IubGluZSk7XG4gICAgY29uc3QgaW5kZW50ID0gdGhpcy5nZXRMaW5lSW5kZW50KGxpbmUpO1xuXG4gICAgaWYgKGFmdGVyKSB7XG4gICAgICBjb25zdCBpbnNlcnRBdCA9IHsgbGluZTogY3Vyc29yLmxpbmUsIGNoOiBsaW5lLmxlbmd0aCB9O1xuICAgICAgZWRpdG9yLnJlcGxhY2VSYW5nZShgXFxuJHtpbmRlbnR9YCwgaW5zZXJ0QXQsIGluc2VydEF0KTtcbiAgICAgIGVkaXRvci5zZXRDdXJzb3IoeyBsaW5lOiBjdXJzb3IubGluZSArIDEsIGNoOiBpbmRlbnQubGVuZ3RoIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBpbnNlcnRBdCA9IHsgbGluZTogY3Vyc29yLmxpbmUsIGNoOiAwIH07XG4gICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKGAke2luZGVudH1cXG5gLCBpbnNlcnRBdCwgaW5zZXJ0QXQpO1xuICAgICAgZWRpdG9yLnNldEN1cnNvcih7IGxpbmU6IGN1cnNvci5saW5lLCBjaDogaW5kZW50Lmxlbmd0aCB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZVNldHRpbmdzQ2hhbmdlID0gKCkgPT4ge1xuICAgIGlmICh0aGlzLmluaXRlZCB8fCAhdGhpcy5zZXR0aW5ncy5vdmVycmlkZVZpbU9CZWhhdmlvdXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXdpbmRvdy5Db2RlTWlycm9yQWRhcHRlciB8fCAhd2luZG93LkNvZGVNaXJyb3JBZGFwdGVyLlZpbSkge1xuICAgICAgY29uc29sZS5lcnJvcihcIlZpbSBhZGFwdGVyIG5vdCBmb3VuZFwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB2aW0gPSB3aW5kb3cuQ29kZU1pcnJvckFkYXB0ZXIuVmltO1xuICAgIGNvbnN0IHBsdWdpbiA9IHRoaXMucGx1Z2luO1xuICAgIGNvbnN0IHBhcnNlciA9IHRoaXMucGFyc2VyO1xuICAgIGNvbnN0IG9ic2lkaWFuU2V0dGluZ3MgPSB0aGlzLm9ic2lkaWFuU2V0dGluZ3M7XG4gICAgY29uc3Qgb3BlcmF0aW9uUGVyZm9ybWVyID0gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXI7XG4gICAgY29uc3Qgc2V0dGluZ3MgPSB0aGlzLnNldHRpbmdzO1xuXG4gICAgdmltLmRlZmluZUFjdGlvbihcbiAgICAgIFwiaW5zZXJ0TGluZUFmdGVyQnVsbGV0XCIsXG4gICAgICAoY20sIG9wZXJhdG9yQXJnczogeyBhZnRlcjogYm9vbGVhbiB9KSA9PiB7XG4gICAgICAgIGNvbnN0IHZpZXcgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgICAgIGNvbnN0IG9ic2lkaWFuRWRpdG9yID0gdmlldz8uZWRpdG9yO1xuXG4gICAgICAgIGlmICghb2JzaWRpYW5FZGl0b3IpIHtcbiAgICAgICAgICB2aW0uZW50ZXJJbnNlcnRNb2RlKGNtKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1vdmVDdXJzb3JUb0xpbmVFbmQob2JzaWRpYW5FZGl0b3IpO1xuXG4gICAgICAgIGlmICghc2V0dGluZ3Mub3ZlcnJpZGVWaW1PQmVoYXZpb3VyKSB7XG4gICAgICAgICAgdGhpcy5vcGVuUGxhaW5MaW5lKG9ic2lkaWFuRWRpdG9yLCBvcGVyYXRvckFyZ3MuYWZ0ZXIpO1xuICAgICAgICAgIHZpbS5lbnRlckluc2VydE1vZGUoY20pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGVkaXRvciA9IG5ldyBNeUVkaXRvcihvYnNpZGlhbkVkaXRvcik7XG4gICAgICAgIGNvbnN0IHJvb3QgPSBwYXJzZXIucGFyc2UoZWRpdG9yKTtcblxuICAgICAgICBpZiAoIXJvb3QpIHtcbiAgICAgICAgICB0aGlzLm9wZW5QbGFpbkxpbmUob2JzaWRpYW5FZGl0b3IsIG9wZXJhdG9yQXJncy5hZnRlcik7XG4gICAgICAgICAgdmltLmVudGVySW5zZXJ0TW9kZShjbSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVmYXVsdEluZGVudENoYXJzID0gb2JzaWRpYW5TZXR0aW5ncy5nZXREZWZhdWx0SW5kZW50Q2hhcnMoKTtcbiAgICAgICAgY29uc3Qgem9vbVJhbmdlID0gZWRpdG9yLmdldFpvb21SYW5nZSgpO1xuICAgICAgICBjb25zdCBnZXRab29tUmFuZ2UgPSB7XG4gICAgICAgICAgZ2V0Wm9vbVJhbmdlOiAoKSA9PiB6b29tUmFuZ2UsXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgcmVzID0gb3BlcmF0aW9uUGVyZm9ybWVyLmV2YWwoXG4gICAgICAgICAgcm9vdCxcbiAgICAgICAgICBuZXcgQ3JlYXRlTmV3SXRlbShcbiAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICBkZWZhdWx0SW5kZW50Q2hhcnMsXG4gICAgICAgICAgICBnZXRab29tUmFuZ2UsXG4gICAgICAgICAgICBvcGVyYXRvckFyZ3MuYWZ0ZXIsXG4gICAgICAgICAgKSxcbiAgICAgICAgICBlZGl0b3IsXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKHJlcy5zaG91bGRVcGRhdGUgJiYgem9vbVJhbmdlKSB7XG4gICAgICAgICAgZWRpdG9yLnRyeVJlZnJlc2hab29tKHpvb21SYW5nZS5mcm9tLmxpbmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW5zdXJlIHRoZSBlZGl0b3IgaXMgYWx3YXlzIGxlZnQgaW4gaW5zZXJ0IG1vZGVcbiAgICAgICAgdmltLmVudGVySW5zZXJ0TW9kZShjbSk7XG4gICAgICB9LFxuICAgICk7XG5cbiAgICB2aW0ubWFwQ29tbWFuZChcbiAgICAgIFwib1wiLFxuICAgICAgXCJhY3Rpb25cIixcbiAgICAgIFwiaW5zZXJ0TGluZUFmdGVyQnVsbGV0XCIsXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgaXNFZGl0OiB0cnVlLFxuICAgICAgICBjb250ZXh0OiBcIm5vcm1hbFwiLFxuICAgICAgICBpbnRlcmxhY2VJbnNlcnRSZXBlYXQ6IHRydWUsXG4gICAgICAgIGFjdGlvbkFyZ3M6IHsgYWZ0ZXI6IHRydWUgfSxcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHZpbS5tYXBDb21tYW5kKFxuICAgICAgXCJPXCIsXG4gICAgICBcImFjdGlvblwiLFxuICAgICAgXCJpbnNlcnRMaW5lQWZ0ZXJCdWxsZXRcIixcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBpc0VkaXQ6IHRydWUsXG4gICAgICAgIGNvbnRleHQ6IFwibm9ybWFsXCIsXG4gICAgICAgIGludGVybGFjZUluc2VydFJlcGVhdDogdHJ1ZSxcbiAgICAgICAgYWN0aW9uQXJnczogeyBhZnRlcjogZmFsc2UgfSxcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHRoaXMuaW5pdGVkID0gdHJ1ZTtcbiAgfTtcblxuICBhc3luYyB1bmxvYWQoKSB7XG4gICAgaWYgKCF0aGlzLmluaXRlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG5ldyBOb3RpY2UoXG4gICAgICBgVG8gZnVsbHkgdW5sb2FkIG9ic2lkaWFuLW91dGxpbmVyIHBsdWdpbiwgcGxlYXNlIHJlc3RhcnQgdGhlIGFwcGAsXG4gICAgICA1MDAwLFxuICAgICk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgTGlzdCwgUG9zaXRpb24sIFJvb3QsIGlzUmFuZ2VzSW50ZXJzZWN0cyB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBDaGFuZ2VzQXBwbGljYXRvciB7XG4gIGFwcGx5KGVkaXRvcjogTXlFZGl0b3IsIHByZXZSb290OiBSb290LCBuZXdSb290OiBSb290KSB7XG4gICAgY29uc3QgY2hhbmdlcyA9IHRoaXMuY2FsY3VsYXRlQ2hhbmdlcyhlZGl0b3IsIHByZXZSb290LCBuZXdSb290KTtcbiAgICBpZiAoY2hhbmdlcykge1xuICAgICAgY29uc3QgeyByZXBsYWNlbWVudCwgY2hhbmdlRnJvbSwgY2hhbmdlVG8gfSA9IGNoYW5nZXM7XG5cbiAgICAgIGNvbnN0IHsgdW5mb2xkLCBmb2xkIH0gPSB0aGlzLmNhbGN1bGF0ZUZvbGRpbmdPcHJhdGlvbnMoXG4gICAgICAgIHByZXZSb290LFxuICAgICAgICBuZXdSb290LFxuICAgICAgICBjaGFuZ2VGcm9tLFxuICAgICAgICBjaGFuZ2VUbyxcbiAgICAgICk7XG5cbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiB1bmZvbGQpIHtcbiAgICAgICAgZWRpdG9yLnVuZm9sZChsaW5lKTtcbiAgICAgIH1cblxuICAgICAgZWRpdG9yLnJlcGxhY2VSYW5nZShyZXBsYWNlbWVudCwgY2hhbmdlRnJvbSwgY2hhbmdlVG8pO1xuXG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgZm9sZCkge1xuICAgICAgICBlZGl0b3IuZm9sZChsaW5lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBlZGl0b3Iuc2V0U2VsZWN0aW9ucyhuZXdSb290LmdldFNlbGVjdGlvbnMoKSk7XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUNoYW5nZXMoZWRpdG9yOiBNeUVkaXRvciwgcHJldlJvb3Q6IFJvb3QsIG5ld1Jvb3Q6IFJvb3QpIHtcbiAgICBjb25zdCByb290UmFuZ2UgPSBwcmV2Um9vdC5nZXRDb250ZW50UmFuZ2UoKTtcbiAgICBjb25zdCBvbGRTdHJpbmcgPSBlZGl0b3IuZ2V0UmFuZ2Uocm9vdFJhbmdlWzBdLCByb290UmFuZ2VbMV0pO1xuICAgIGNvbnN0IG5ld1N0cmluZyA9IG5ld1Jvb3QucHJpbnQoKTtcblxuICAgIGNvbnN0IGNoYW5nZUZyb20gPSB7IC4uLnJvb3RSYW5nZVswXSB9O1xuICAgIGNvbnN0IGNoYW5nZVRvID0geyAuLi5yb290UmFuZ2VbMV0gfTtcbiAgICBsZXQgb2xkVG1wID0gb2xkU3RyaW5nO1xuICAgIGxldCBuZXdUbXAgPSBuZXdTdHJpbmc7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgbmxJbmRleCA9IG9sZFRtcC5sYXN0SW5kZXhPZihcIlxcblwiKTtcblxuICAgICAgaWYgKG5sSW5kZXggPCAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvbGRMaW5lID0gb2xkVG1wLnNsaWNlKG5sSW5kZXgpO1xuICAgICAgY29uc3QgbmV3TGluZSA9IG5ld1RtcC5zbGljZSgtb2xkTGluZS5sZW5ndGgpO1xuXG4gICAgICBpZiAob2xkTGluZSAhPT0gbmV3TGluZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgb2xkVG1wID0gb2xkVG1wLnNsaWNlKDAsIC1vbGRMaW5lLmxlbmd0aCk7XG4gICAgICBuZXdUbXAgPSBuZXdUbXAuc2xpY2UoMCwgLW9sZExpbmUubGVuZ3RoKTtcbiAgICAgIGNvbnN0IG5sSW5kZXgyID0gb2xkVG1wLmxhc3RJbmRleE9mKFwiXFxuXCIpO1xuICAgICAgY2hhbmdlVG8uY2ggPVxuICAgICAgICBubEluZGV4MiA+PSAwID8gb2xkVG1wLmxlbmd0aCAtIG5sSW5kZXgyIC0gMSA6IG9sZFRtcC5sZW5ndGg7XG4gICAgICBjaGFuZ2VUby5saW5lLS07XG4gICAgfVxuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IG5sSW5kZXggPSBvbGRUbXAuaW5kZXhPZihcIlxcblwiKTtcblxuICAgICAgaWYgKG5sSW5kZXggPCAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvbGRMaW5lID0gb2xkVG1wLnNsaWNlKDAsIG5sSW5kZXggKyAxKTtcbiAgICAgIGNvbnN0IG5ld0xpbmUgPSBuZXdUbXAuc2xpY2UoMCwgb2xkTGluZS5sZW5ndGgpO1xuXG4gICAgICBpZiAob2xkTGluZSAhPT0gbmV3TGluZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2hhbmdlRnJvbS5saW5lKys7XG4gICAgICBvbGRUbXAgPSBvbGRUbXAuc2xpY2Uob2xkTGluZS5sZW5ndGgpO1xuICAgICAgbmV3VG1wID0gbmV3VG1wLnNsaWNlKG9sZExpbmUubGVuZ3RoKTtcbiAgICB9XG5cbiAgICBpZiAob2xkVG1wID09PSBuZXdUbXApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICByZXBsYWNlbWVudDogbmV3VG1wLFxuICAgICAgY2hhbmdlRnJvbSxcbiAgICAgIGNoYW5nZVRvLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUZvbGRpbmdPcHJhdGlvbnMoXG4gICAgcHJldlJvb3Q6IFJvb3QsXG4gICAgbmV3Um9vdDogUm9vdCxcbiAgICBjaGFuZ2VGcm9tOiBQb3NpdGlvbixcbiAgICBjaGFuZ2VUbzogUG9zaXRpb24sXG4gICkge1xuICAgIGNvbnN0IGNoYW5nZWRSYW5nZTogW1Bvc2l0aW9uLCBQb3NpdGlvbl0gPSBbY2hhbmdlRnJvbSwgY2hhbmdlVG9dO1xuXG4gICAgY29uc3QgcHJldkxpc3RzID0gZ2V0QWxsQ2hpbGRyZW4ocHJldlJvb3QpO1xuICAgIGNvbnN0IG5ld0xpc3RzID0gZ2V0QWxsQ2hpbGRyZW4obmV3Um9vdCk7XG5cbiAgICBjb25zdCB1bmZvbGQ6IG51bWJlcltdID0gW107XG4gICAgY29uc3QgZm9sZDogbnVtYmVyW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgcHJldkxpc3Qgb2YgcHJldkxpc3RzLnZhbHVlcygpKSB7XG4gICAgICBpZiAoIXByZXZMaXN0LmlzRm9sZFJvb3QoKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbmV3TGlzdCA9IG5ld0xpc3RzLmdldChwcmV2TGlzdC5nZXRJRCgpKTtcblxuICAgICAgaWYgKCFuZXdMaXN0KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwcmV2TGlzdFJhbmdlOiBbUG9zaXRpb24sIFBvc2l0aW9uXSA9IFtcbiAgICAgICAgcHJldkxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCksXG4gICAgICAgIHByZXZMaXN0LmdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpLFxuICAgICAgXTtcblxuICAgICAgaWYgKGlzUmFuZ2VzSW50ZXJzZWN0cyhwcmV2TGlzdFJhbmdlLCBjaGFuZ2VkUmFuZ2UpKSB7XG4gICAgICAgIHVuZm9sZC5wdXNoKHByZXZMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUpO1xuICAgICAgICBmb2xkLnB1c2gobmV3TGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB1bmZvbGQuc29ydCgoYSwgYikgPT4gYiAtIGEpO1xuICAgIGZvbGQuc29ydCgoYSwgYikgPT4gYiAtIGEpO1xuXG4gICAgcmV0dXJuIHsgdW5mb2xkLCBmb2xkIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0QWxsQ2hpbGRyZW5SZWR1Y2VGbihhY2M6IE1hcDxudW1iZXIsIExpc3Q+LCBjaGlsZDogTGlzdCkge1xuICBhY2Muc2V0KGNoaWxkLmdldElEKCksIGNoaWxkKTtcbiAgY2hpbGQuZ2V0Q2hpbGRyZW4oKS5yZWR1Y2UoZ2V0QWxsQ2hpbGRyZW5SZWR1Y2VGbiwgYWNjKTtcblxuICByZXR1cm4gYWNjO1xufVxuXG5mdW5jdGlvbiBnZXRBbGxDaGlsZHJlbihyb290OiBSb290KTogTWFwPG51bWJlciwgTGlzdD4ge1xuICByZXR1cm4gcm9vdC5nZXRDaGlsZHJlbigpLnJlZHVjZShnZXRBbGxDaGlsZHJlblJlZHVjZUZuLCBuZXcgTWFwKCkpO1xufVxuIiwiaW1wb3J0IHsgUGxhdGZvcm0gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuZXhwb3J0IGNsYXNzIElNRURldGVjdG9yIHtcbiAgcHJpdmF0ZSBjb21wb3NpdGlvbiA9IGZhbHNlO1xuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNvbXBvc2l0aW9uc3RhcnRcIiwgdGhpcy5vbkNvbXBvc2l0aW9uU3RhcnQpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjb21wb3NpdGlvbmVuZFwiLCB0aGlzLm9uQ29tcG9zaXRpb25FbmQpO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjb21wb3NpdGlvbmVuZFwiLCB0aGlzLm9uQ29tcG9zaXRpb25FbmQpO1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjb21wb3NpdGlvbnN0YXJ0XCIsIHRoaXMub25Db21wb3NpdGlvblN0YXJ0KTtcbiAgfVxuXG4gIGlzT3BlbmVkKCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBvc2l0aW9uICYmIFBsYXRmb3JtLmlzRGVza3RvcDtcbiAgfVxuXG4gIHByaXZhdGUgb25Db21wb3NpdGlvblN0YXJ0ID0gKCkgPT4ge1xuICAgIHRoaXMuY29tcG9zaXRpb24gPSB0cnVlO1xuICB9O1xuXG4gIHByaXZhdGUgb25Db21wb3NpdGlvbkVuZCA9ICgpID0+IHtcbiAgICB0aGlzLmNvbXBvc2l0aW9uID0gZmFsc2U7XG4gIH07XG59XG4iLCIvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55ICovXG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL1NldHRpbmdzXCI7XG5cbmV4cG9ydCBjbGFzcyBMb2dnZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncykge31cblxuICBsb2cobWV0aG9kOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKSB7XG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLmRlYnVnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5pbmZvKG1ldGhvZCwgLi4uYXJncyk7XG4gIH1cblxuICBiaW5kKG1ldGhvZDogc3RyaW5nKSB7XG4gICAgcmV0dXJuICguLi5hcmdzOiBhbnlbXSkgPT4gdGhpcy5sb2cobWV0aG9kLCAuLi5hcmdzKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgQXBwIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT2JzaWRpYW5UYWJzU2V0dGluZ3Mge1xuICB1c2VUYWI6IGJvb2xlYW47XG4gIHRhYlNpemU6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBPYnNpZGlhbkZvbGRTZXR0aW5ncyB7XG4gIGZvbGRJbmRlbnQ6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIGdldEhpZGRlbk9ic2lkaWFuQ29uZmlnKGFwcDogQXBwKSB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gIHJldHVybiAoYXBwLnZhdWx0IGFzIGFueSkuY29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgT2JzaWRpYW5TZXR0aW5ncyB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYXBwOiBBcHApIHt9XG5cbiAgaXNMZWdhY3lFZGl0b3JFbmFibGVkKCkge1xuICAgIGNvbnN0IGNvbmZpZzogeyBsZWdhY3lFZGl0b3I6IGJvb2xlYW4gfSA9IHtcbiAgICAgIGxlZ2FjeUVkaXRvcjogZmFsc2UsXG4gICAgICAuLi5nZXRIaWRkZW5PYnNpZGlhbkNvbmZpZyh0aGlzLmFwcCksXG4gICAgfTtcblxuICAgIHJldHVybiBjb25maWcubGVnYWN5RWRpdG9yO1xuICB9XG5cbiAgaXNEZWZhdWx0VGhlbWVFbmFibGVkKCkge1xuICAgIGNvbnN0IGNvbmZpZzogeyBjc3NUaGVtZTogc3RyaW5nIH0gPSB7XG4gICAgICBjc3NUaGVtZTogXCJcIixcbiAgICAgIC4uLmdldEhpZGRlbk9ic2lkaWFuQ29uZmlnKHRoaXMuYXBwKSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbmZpZy5jc3NUaGVtZSA9PT0gXCJcIjtcbiAgfVxuXG4gIGdldFRhYnNTZXR0aW5ncygpOiBPYnNpZGlhblRhYnNTZXR0aW5ncyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHVzZVRhYjogdHJ1ZSxcbiAgICAgIHRhYlNpemU6IDQsXG4gICAgICAuLi5nZXRIaWRkZW5PYnNpZGlhbkNvbmZpZyh0aGlzLmFwcCksXG4gICAgfTtcbiAgfVxuXG4gIGdldEZvbGRTZXR0aW5ncygpOiBPYnNpZGlhbkZvbGRTZXR0aW5ncyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGZvbGRJbmRlbnQ6IHRydWUsXG4gICAgICAuLi5nZXRIaWRkZW5PYnNpZGlhbkNvbmZpZyh0aGlzLmFwcCksXG4gICAgfTtcbiAgfVxuXG4gIGdldERlZmF1bHRJbmRlbnRDaGFycygpIHtcbiAgICBjb25zdCB7IHVzZVRhYiwgdGFiU2l6ZSB9ID0gdGhpcy5nZXRUYWJzU2V0dGluZ3MoKTtcblxuICAgIHJldHVybiB1c2VUYWIgPyBcIlxcdFwiIDogbmV3IEFycmF5KHRhYlNpemUpLmZpbGwoXCIgXCIpLmpvaW4oXCJcIik7XG4gIH1cbn1cbiIsImltcG9ydCB7IENoYW5nZXNBcHBsaWNhdG9yIH0gZnJvbSBcIi4vQ2hhbmdlc0FwcGxpY2F0b3JcIjtcbmltcG9ydCB7IFBhcnNlciB9IGZyb20gXCIuL1BhcnNlclwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9lZGl0b3JcIjtcbmltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL09wZXJhdGlvblwiO1xuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBPcGVyYXRpb25QZXJmb3JtZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBhcnNlcjogUGFyc2VyLFxuICAgIHByaXZhdGUgY2hhbmdlc0FwcGxpY2F0b3I6IENoYW5nZXNBcHBsaWNhdG9yLFxuICApIHt9XG5cbiAgZXZhbChyb290OiBSb290LCBvcDogT3BlcmF0aW9uLCBlZGl0b3I6IE15RWRpdG9yKSB7XG4gICAgY29uc3QgcHJldlJvb3QgPSByb290LmNsb25lKCk7XG5cbiAgICBvcC5wZXJmb3JtKCk7XG5cbiAgICBpZiAob3Auc2hvdWxkVXBkYXRlKCkpIHtcbiAgICAgIHRoaXMuY2hhbmdlc0FwcGxpY2F0b3IuYXBwbHkoZWRpdG9yLCBwcmV2Um9vdCwgcm9vdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHNob3VsZFVwZGF0ZTogb3Auc2hvdWxkVXBkYXRlKCksXG4gICAgICBzaG91bGRTdG9wUHJvcGFnYXRpb246IG9wLnNob3VsZFN0b3BQcm9wYWdhdGlvbigpLFxuICAgIH07XG4gIH1cblxuICBwZXJmb3JtKFxuICAgIGNiOiAocm9vdDogUm9vdCkgPT4gT3BlcmF0aW9uLFxuICAgIGVkaXRvcjogTXlFZGl0b3IsXG4gICAgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpLFxuICApIHtcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZXIucGFyc2UoZWRpdG9yLCBjdXJzb3IpO1xuXG4gICAgaWYgKCFyb290KSB7XG4gICAgICByZXR1cm4geyBzaG91bGRVcGRhdGU6IGZhbHNlLCBzaG91bGRTdG9wUHJvcGFnYXRpb246IGZhbHNlIH07XG4gICAgfVxuXG4gICAgY29uc3Qgb3AgPSBjYihyb290KTtcblxuICAgIHJldHVybiB0aGlzLmV2YWwocm9vdCwgb3AsIGVkaXRvcik7XG4gIH1cbn1cbiIsImltcG9ydCB7IExvZ2dlciB9IGZyb20gXCIuL0xvZ2dlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi9TZXR0aW5nc1wiO1xuXG5pbXBvcnQgeyBMaXN0LCBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IGNoZWNrYm94UmUgfSBmcm9tIFwiLi4vdXRpbHMvY2hlY2tib3hSZVwiO1xuXG5jb25zdCBidWxsZXRTaWduUmUgPSBgKD86Wy0qK118XFxcXGQrXFxcXC4pYDtcbmNvbnN0IG9wdGlvbmFsQ2hlY2tib3hSZSA9IGAoPzoke2NoZWNrYm94UmV9KT9gO1xuXG5jb25zdCBsaXN0SXRlbVdpdGhvdXRTcGFjZXNSZSA9IG5ldyBSZWdFeHAoYF4ke2J1bGxldFNpZ25SZX0oIHxcXHQpYCk7XG5jb25zdCBsaXN0SXRlbVJlID0gbmV3IFJlZ0V4cChgXlsgXFx0XSoke2J1bGxldFNpZ25SZX0oIHxcXHQpYCk7XG5jb25zdCBzdHJpbmdXaXRoU3BhY2VzUmUgPSBuZXcgUmVnRXhwKGBeWyBcXHRdK2ApO1xuY29uc3QgcGFyc2VMaXN0SXRlbVJlID0gbmV3IFJlZ0V4cChcbiAgYF4oWyBcXHRdKikoJHtidWxsZXRTaWduUmV9KSggfFxcdCkoJHtvcHRpb25hbENoZWNrYm94UmV9KSguKikkYCxcbik7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGVyUG9zaXRpb24ge1xuICBsaW5lOiBudW1iZXI7XG4gIGNoOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGVyU2VsZWN0aW9uIHtcbiAgYW5jaG9yOiBSZWFkZXJQb3NpdGlvbjtcbiAgaGVhZDogUmVhZGVyUG9zaXRpb247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGVyIHtcbiAgZ2V0Q3Vyc29yKCk6IFJlYWRlclBvc2l0aW9uO1xuICBnZXRMaW5lKG46IG51bWJlcik6IHN0cmluZztcbiAgbGFzdExpbmUoKTogbnVtYmVyO1xuICBsaXN0U2VsZWN0aW9ucygpOiBSZWFkZXJTZWxlY3Rpb25bXTtcbiAgZ2V0QWxsRm9sZGVkTGluZXMoKTogbnVtYmVyW107XG59XG5cbmludGVyZmFjZSBQYXJzZUxpc3RMaXN0IHtcbiAgZ2V0Rmlyc3RMaW5lSW5kZW50KCk6IHN0cmluZztcbiAgc2V0Tm90ZXNJbmRlbnQobm90ZXNJbmRlbnQ6IHN0cmluZyk6IHZvaWQ7XG4gIGdldE5vdGVzSW5kZW50KCk6IHN0cmluZyB8IG51bGw7XG4gIGFkZExpbmUodGV4dDogc3RyaW5nKTogdm9pZDtcbiAgZ2V0UGFyZW50KCk6IFBhcnNlTGlzdExpc3QgfCBudWxsO1xuICBhZGRBZnRlckFsbChsaXN0OiBQYXJzZUxpc3RMaXN0KTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIFBhcnNlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXIsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICkge31cblxuICBwYXJzZVJhbmdlKGVkaXRvcjogUmVhZGVyLCBmcm9tTGluZSA9IDAsIHRvTGluZSA9IGVkaXRvci5sYXN0TGluZSgpKTogUm9vdFtdIHtcbiAgICBjb25zdCBsaXN0czogUm9vdFtdID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gZnJvbUxpbmU7IGkgPD0gdG9MaW5lOyBpKyspIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShpKTtcblxuICAgICAgaWYgKGkgPT09IGZyb21MaW5lIHx8IHRoaXMuaXNMaXN0SXRlbShsaW5lKSkge1xuICAgICAgICBjb25zdCBsaXN0ID0gdGhpcy5wYXJzZVdpdGhMaW1pdHMoZWRpdG9yLCBpLCBmcm9tTGluZSwgdG9MaW5lKTtcblxuICAgICAgICBpZiAobGlzdCkge1xuICAgICAgICAgIGxpc3RzLnB1c2gobGlzdCk7XG4gICAgICAgICAgaSA9IGxpc3QuZ2V0Q29udGVudEVuZCgpLmxpbmU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlzdHM7XG4gIH1cblxuICBwYXJzZShlZGl0b3I6IFJlYWRlciwgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpKTogUm9vdCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnBhcnNlV2l0aExpbWl0cyhlZGl0b3IsIGN1cnNvci5saW5lLCAwLCBlZGl0b3IubGFzdExpbmUoKSk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlV2l0aExpbWl0cyhcbiAgICBlZGl0b3I6IFJlYWRlcixcbiAgICBwYXJzaW5nU3RhcnRMaW5lOiBudW1iZXIsXG4gICAgbGltaXRGcm9tOiBudW1iZXIsXG4gICAgbGltaXRUbzogbnVtYmVyLFxuICApOiBSb290IHwgbnVsbCB7XG4gICAgY29uc3QgZCA9IHRoaXMubG9nZ2VyLmJpbmQoXCJwYXJzZUxpc3RcIik7XG4gICAgY29uc3QgZXJyb3IgPSAobXNnOiBzdHJpbmcpOiBudWxsID0+IHtcbiAgICAgIGQobXNnKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG5cbiAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUocGFyc2luZ1N0YXJ0TGluZSk7XG5cbiAgICBsZXQgbGlzdExvb2tpbmdQb3M6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gICAgaWYgKHRoaXMuaXNMaXN0SXRlbShsaW5lKSkge1xuICAgICAgbGlzdExvb2tpbmdQb3MgPSBwYXJzaW5nU3RhcnRMaW5lO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc0xpbmVXaXRoSW5kZW50KGxpbmUpKSB7XG4gICAgICBsZXQgbGlzdExvb2tpbmdQb3NTZWFyY2ggPSBwYXJzaW5nU3RhcnRMaW5lIC0gMTtcbiAgICAgIHdoaWxlIChsaXN0TG9va2luZ1Bvc1NlYXJjaCA+PSAwKSB7XG4gICAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShsaXN0TG9va2luZ1Bvc1NlYXJjaCk7XG4gICAgICAgIGlmICh0aGlzLmlzTGlzdEl0ZW0obGluZSkpIHtcbiAgICAgICAgICBsaXN0TG9va2luZ1BvcyA9IGxpc3RMb29raW5nUG9zU2VhcmNoO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuaXNMaW5lV2l0aEluZGVudChsaW5lKSkge1xuICAgICAgICAgIGxpc3RMb29raW5nUG9zU2VhcmNoLS07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobGlzdExvb2tpbmdQb3MgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCBsaXN0U3RhcnRMaW5lOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgbGlzdFN0YXJ0TGluZUxvb2t1cCA9IGxpc3RMb29raW5nUG9zO1xuICAgIHdoaWxlIChsaXN0U3RhcnRMaW5lTG9va3VwID49IDApIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShsaXN0U3RhcnRMaW5lTG9va3VwKTtcbiAgICAgIGlmICghdGhpcy5pc0xpc3RJdGVtKGxpbmUpICYmICF0aGlzLmlzTGluZVdpdGhJbmRlbnQobGluZSkpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc0xpc3RJdGVtV2l0aG91dFNwYWNlcyhsaW5lKSkge1xuICAgICAgICBsaXN0U3RhcnRMaW5lID0gbGlzdFN0YXJ0TGluZUxvb2t1cDtcbiAgICAgICAgaWYgKGxpc3RTdGFydExpbmVMb29rdXAgPD0gbGltaXRGcm9tKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxpc3RTdGFydExpbmVMb29rdXAtLTtcbiAgICB9XG5cbiAgICBpZiAobGlzdFN0YXJ0TGluZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IGxpc3RFbmRMaW5lID0gbGlzdExvb2tpbmdQb3M7XG4gICAgbGV0IGxpc3RFbmRMaW5lTG9va3VwID0gbGlzdExvb2tpbmdQb3M7XG4gICAgd2hpbGUgKGxpc3RFbmRMaW5lTG9va3VwIDw9IGVkaXRvci5sYXN0TGluZSgpKSB7XG4gICAgICBjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUobGlzdEVuZExpbmVMb29rdXApO1xuICAgICAgaWYgKCF0aGlzLmlzTGlzdEl0ZW0obGluZSkgJiYgIXRoaXMuaXNMaW5lV2l0aEluZGVudChsaW5lKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5pc0VtcHR5TGluZShsaW5lKSkge1xuICAgICAgICBsaXN0RW5kTGluZSA9IGxpc3RFbmRMaW5lTG9va3VwO1xuICAgICAgfVxuICAgICAgaWYgKGxpc3RFbmRMaW5lTG9va3VwID49IGxpbWl0VG8pIHtcbiAgICAgICAgbGlzdEVuZExpbmUgPSBsaW1pdFRvO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGxpc3RFbmRMaW5lTG9va3VwKys7XG4gICAgfVxuXG4gICAgaWYgKGxpc3RTdGFydExpbmUgPiBwYXJzaW5nU3RhcnRMaW5lIHx8IGxpc3RFbmRMaW5lIDwgcGFyc2luZ1N0YXJ0TGluZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gaWYgdGhlIGxhc3QgbGluZSBjb250YWlucyBvbmx5IHNwYWNlcyBhbmQgdGhhdCdzIGluY29ycmVjdCBpbmRlbnQsIHRoZW4gaWdub3JlIHRoZSBsYXN0IGxpbmVcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vdnNsaW5rby9vYnNpZGlhbi1vdXRsaW5lci9pc3N1ZXMvMzY4XG4gICAgaWYgKGxpc3RFbmRMaW5lID4gbGlzdFN0YXJ0TGluZSkge1xuICAgICAgY29uc3QgbGFzdExpbmUgPSBlZGl0b3IuZ2V0TGluZShsaXN0RW5kTGluZSk7XG4gICAgICBpZiAobGFzdExpbmUudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zdCBwcmV2TGluZSA9IGVkaXRvci5nZXRMaW5lKGxpc3RFbmRMaW5lIC0gMSk7XG4gICAgICAgIGNvbnN0IFssIHByZXZMaW5lSW5kZW50XSA9IC9eKFxccyopLy5leGVjKHByZXZMaW5lKTtcbiAgICAgICAgaWYgKCFsYXN0TGluZS5zdGFydHNXaXRoKHByZXZMaW5lSW5kZW50KSkge1xuICAgICAgICAgIGxpc3RFbmRMaW5lLS07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByb290ID0gbmV3IFJvb3QoXG4gICAgICB7IGxpbmU6IGxpc3RTdGFydExpbmUsIGNoOiAwIH0sXG4gICAgICB7IGxpbmU6IGxpc3RFbmRMaW5lLCBjaDogZWRpdG9yLmdldExpbmUobGlzdEVuZExpbmUpLmxlbmd0aCB9LFxuICAgICAgZWRpdG9yLmxpc3RTZWxlY3Rpb25zKCkubWFwKChyKSA9PiAoe1xuICAgICAgICBhbmNob3I6IHsgbGluZTogci5hbmNob3IubGluZSwgY2g6IHIuYW5jaG9yLmNoIH0sXG4gICAgICAgIGhlYWQ6IHsgbGluZTogci5oZWFkLmxpbmUsIGNoOiByLmhlYWQuY2ggfSxcbiAgICAgIH0pKSxcbiAgICApO1xuXG4gICAgbGV0IGN1cnJlbnRQYXJlbnQ6IFBhcnNlTGlzdExpc3QgPSByb290LmdldFJvb3RMaXN0KCk7XG4gICAgbGV0IGN1cnJlbnRMaXN0OiBQYXJzZUxpc3RMaXN0IHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGN1cnJlbnRJbmRlbnQgPSBcIlwiO1xuXG4gICAgY29uc3QgZm9sZGVkTGluZXMgPSBlZGl0b3IuZ2V0QWxsRm9sZGVkTGluZXMoKTtcblxuICAgIGZvciAobGV0IGwgPSBsaXN0U3RhcnRMaW5lOyBsIDw9IGxpc3RFbmRMaW5lOyBsKyspIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShsKTtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSBwYXJzZUxpc3RJdGVtUmUuZXhlYyhsaW5lKTtcblxuICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgY29uc3QgWywgaW5kZW50LCBidWxsZXQsIHNwYWNlQWZ0ZXJCdWxsZXRdID0gbWF0Y2hlcztcbiAgICAgICAgbGV0IFssICwgLCAsIG9wdGlvbmFsQ2hlY2tib3gsIGNvbnRlbnRdID0gbWF0Y2hlcztcblxuICAgICAgICBjb250ZW50ID0gb3B0aW9uYWxDaGVja2JveCArIGNvbnRlbnQ7XG4gICAgICAgIGlmICh0aGlzLnNldHRpbmdzLmtlZXBDdXJzb3JXaXRoaW5Db250ZW50ICE9PSBcImJ1bGxldC1hbmQtY2hlY2tib3hcIikge1xuICAgICAgICAgIG9wdGlvbmFsQ2hlY2tib3ggPSBcIlwiO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29tcGFyZUxlbmd0aCA9IE1hdGgubWluKGN1cnJlbnRJbmRlbnQubGVuZ3RoLCBpbmRlbnQubGVuZ3RoKTtcbiAgICAgICAgY29uc3QgaW5kZW50U2xpY2UgPSBpbmRlbnQuc2xpY2UoMCwgY29tcGFyZUxlbmd0aCk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRJbmRlbnRTbGljZSA9IGN1cnJlbnRJbmRlbnQuc2xpY2UoMCwgY29tcGFyZUxlbmd0aCk7XG5cbiAgICAgICAgaWYgKGluZGVudFNsaWNlICE9PSBjdXJyZW50SW5kZW50U2xpY2UpIHtcbiAgICAgICAgICBjb25zdCBleHBlY3RlZCA9IGN1cnJlbnRJbmRlbnRTbGljZVxuICAgICAgICAgICAgLnJlcGxhY2UoLyAvZywgXCJTXCIpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx0L2csIFwiVFwiKTtcbiAgICAgICAgICBjb25zdCBnb3QgPSBpbmRlbnRTbGljZS5yZXBsYWNlKC8gL2csIFwiU1wiKS5yZXBsYWNlKC9cXHQvZywgXCJUXCIpO1xuXG4gICAgICAgICAgcmV0dXJuIGVycm9yKFxuICAgICAgICAgICAgYFVuYWJsZSB0byBwYXJzZSBsaXN0OiBleHBlY3RlZCBpbmRlbnQgXCIke2V4cGVjdGVkfVwiLCBnb3QgXCIke2dvdH1cImAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbmRlbnQubGVuZ3RoID4gY3VycmVudEluZGVudC5sZW5ndGgpIHtcbiAgICAgICAgICBjdXJyZW50UGFyZW50ID0gY3VycmVudExpc3Q7XG4gICAgICAgICAgY3VycmVudEluZGVudCA9IGluZGVudDtcbiAgICAgICAgfSBlbHNlIGlmIChpbmRlbnQubGVuZ3RoIDwgY3VycmVudEluZGVudC5sZW5ndGgpIHtcbiAgICAgICAgICB3aGlsZSAoXG4gICAgICAgICAgICBjdXJyZW50UGFyZW50LmdldEZpcnN0TGluZUluZGVudCgpLmxlbmd0aCA+PSBpbmRlbnQubGVuZ3RoICYmXG4gICAgICAgICAgICBjdXJyZW50UGFyZW50LmdldFBhcmVudCgpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjdXJyZW50UGFyZW50ID0gY3VycmVudFBhcmVudC5nZXRQYXJlbnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3VycmVudEluZGVudCA9IGluZGVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZvbGRSb290ID0gZm9sZGVkTGluZXMuaW5jbHVkZXMobCk7XG5cbiAgICAgICAgY3VycmVudExpc3QgPSBuZXcgTGlzdChcbiAgICAgICAgICByb290LFxuICAgICAgICAgIGluZGVudCxcbiAgICAgICAgICBidWxsZXQsXG4gICAgICAgICAgb3B0aW9uYWxDaGVja2JveCxcbiAgICAgICAgICBzcGFjZUFmdGVyQnVsbGV0LFxuICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgZm9sZFJvb3QsXG4gICAgICAgICk7XG4gICAgICAgIGN1cnJlbnRQYXJlbnQuYWRkQWZ0ZXJBbGwoY3VycmVudExpc3QpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzTGluZVdpdGhJbmRlbnQobGluZSkpIHtcbiAgICAgICAgaWYgKCFjdXJyZW50TGlzdCkge1xuICAgICAgICAgIHJldHVybiBlcnJvcihcbiAgICAgICAgICAgIGBVbmFibGUgdG8gcGFyc2UgbGlzdDogZXhwZWN0ZWQgbGlzdCBpdGVtLCBnb3QgZW1wdHkgbGluZWAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGluZGVudFRvQ2hlY2sgPSBjdXJyZW50TGlzdC5nZXROb3Rlc0luZGVudCgpIHx8IGN1cnJlbnRJbmRlbnQ7XG5cbiAgICAgICAgaWYgKGxpbmUuaW5kZXhPZihpbmRlbnRUb0NoZWNrKSAhPT0gMCkge1xuICAgICAgICAgIGNvbnN0IGV4cGVjdGVkID0gaW5kZW50VG9DaGVjay5yZXBsYWNlKC8gL2csIFwiU1wiKS5yZXBsYWNlKC9cXHQvZywgXCJUXCIpO1xuICAgICAgICAgIGNvbnN0IGdvdCA9IGxpbmVcbiAgICAgICAgICAgIC5tYXRjaCgvXlsgXFx0XSovKVswXVxuICAgICAgICAgICAgLnJlcGxhY2UoLyAvZywgXCJTXCIpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx0L2csIFwiVFwiKTtcblxuICAgICAgICAgIHJldHVybiBlcnJvcihcbiAgICAgICAgICAgIGBVbmFibGUgdG8gcGFyc2UgbGlzdDogZXhwZWN0ZWQgaW5kZW50IFwiJHtleHBlY3RlZH1cIiwgZ290IFwiJHtnb3R9XCJgLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWN1cnJlbnRMaXN0LmdldE5vdGVzSW5kZW50KCkpIHtcbiAgICAgICAgICBjb25zdCBtYXRjaGVzID0gbGluZS5tYXRjaCgvXlsgXFx0XSsvKTtcblxuICAgICAgICAgIGlmICghbWF0Y2hlcyB8fCBtYXRjaGVzWzBdLmxlbmd0aCA8PSBjdXJyZW50SW5kZW50Lmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKC9eXFxzKyQvLnRlc3QobGluZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBlcnJvcihcbiAgICAgICAgICAgICAgYFVuYWJsZSB0byBwYXJzZSBsaXN0OiBleHBlY3RlZCBzb21lIGluZGVudCwgZ290IG5vIGluZGVudGAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGN1cnJlbnRMaXN0LnNldE5vdGVzSW5kZW50KG1hdGNoZXNbMF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY3VycmVudExpc3QuYWRkTGluZShsaW5lLnNsaWNlKGN1cnJlbnRMaXN0LmdldE5vdGVzSW5kZW50KCkubGVuZ3RoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZXJyb3IoXG4gICAgICAgICAgYFVuYWJsZSB0byBwYXJzZSBsaXN0OiBleHBlY3RlZCBsaXN0IGl0ZW0gb3Igbm90ZSwgZ290IFwiJHtsaW5lfVwiYCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcm9vdDtcbiAgfVxuXG4gIHByaXZhdGUgaXNFbXB0eUxpbmUobGluZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGxpbmUubGVuZ3RoID09PSAwO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0xpbmVXaXRoSW5kZW50KGxpbmU6IHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmdXaXRoU3BhY2VzUmUudGVzdChsaW5lKTtcbiAgfVxuXG4gIHByaXZhdGUgaXNMaXN0SXRlbShsaW5lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbGlzdEl0ZW1SZS50ZXN0KGxpbmUpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0xpc3RJdGVtV2l0aG91dFNwYWNlcyhsaW5lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbGlzdEl0ZW1XaXRob3V0U3BhY2VzUmUudGVzdChsaW5lKTtcbiAgfVxufVxuIiwiZXhwb3J0IHR5cGUgVmVydGljYWxMaW5lc0FjdGlvbiA9IFwibm9uZVwiIHwgXCJ6b29tLWluXCIgfCBcInRvZ2dsZS1mb2xkaW5nXCI7XG5leHBvcnQgdHlwZSBLZWVwQ3Vyc29yV2l0aGluQ29udGVudCA9XG4gIHwgXCJuZXZlclwiXG4gIHwgXCJidWxsZXQtb25seVwiXG4gIHwgXCJidWxsZXQtYW5kLWNoZWNrYm94XCI7XG5cbmludGVyZmFjZSBTZXR0aW5nc09iamVjdCB7XG4gIHN0eWxlTGlzdHM6IGJvb2xlYW47XG4gIGRlYnVnOiBib29sZWFuO1xuICBzdGlja0N1cnNvcjogS2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgfCBib29sZWFuO1xuICBiZXR0ZXJFbnRlcjogYm9vbGVhbjtcbiAgYmV0dGVyVmltTzogYm9vbGVhbjtcbiAgYmV0dGVyVGFiOiBib29sZWFuO1xuICBzZWxlY3RBbGw6IGJvb2xlYW47XG4gIGxpc3RMaW5lczogYm9vbGVhbjtcbiAgbGlzdExpbmVBY3Rpb246IFZlcnRpY2FsTGluZXNBY3Rpb247XG4gIGRuZDogYm9vbGVhbjtcbiAgcHJldmlvdXNSZWxlYXNlOiBzdHJpbmcgfCBudWxsO1xufVxuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBTZXR0aW5nc09iamVjdCA9IHtcbiAgc3R5bGVMaXN0czogdHJ1ZSxcbiAgZGVidWc6IGZhbHNlLFxuICBzdGlja0N1cnNvcjogXCJidWxsZXQtYW5kLWNoZWNrYm94XCIsXG4gIGJldHRlckVudGVyOiB0cnVlLFxuICBiZXR0ZXJWaW1POiB0cnVlLFxuICBiZXR0ZXJUYWI6IHRydWUsXG4gIHNlbGVjdEFsbDogdHJ1ZSxcbiAgbGlzdExpbmVzOiBmYWxzZSxcbiAgbGlzdExpbmVBY3Rpb246IFwidG9nZ2xlLWZvbGRpbmdcIixcbiAgZG5kOiB0cnVlLFxuICBwcmV2aW91c1JlbGVhc2U6IG51bGwsXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIFN0b3JhZ2Uge1xuICBsb2FkRGF0YSgpOiBQcm9taXNlPFNldHRpbmdzT2JqZWN0PjtcbiAgc2F2ZURhdGEoc2V0dGluZ3M6IFNldHRpbmdzT2JqZWN0KTogUHJvbWlzZTx2b2lkPjtcbn1cblxudHlwZSBDYWxsYmFjayA9ICgpID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBTZXR0aW5ncyB7XG4gIHByaXZhdGUgc3RvcmFnZTogU3RvcmFnZTtcbiAgcHJpdmF0ZSB2YWx1ZXM6IFNldHRpbmdzT2JqZWN0O1xuICBwcml2YXRlIGNhbGxiYWNrczogU2V0PENhbGxiYWNrPjtcblxuICBjb25zdHJ1Y3RvcihzdG9yYWdlOiBTdG9yYWdlKSB7XG4gICAgdGhpcy5zdG9yYWdlID0gc3RvcmFnZTtcbiAgICB0aGlzLmNhbGxiYWNrcyA9IG5ldyBTZXQoKTtcbiAgfVxuXG4gIGdldCBrZWVwQ3Vyc29yV2l0aGluQ29udGVudCgpIHtcbiAgICAvLyBBZGFwdG9yIGZvciB1c2VycyBtaWdyYXRpbmcgZnJvbSBvbGRlciB2ZXJzaW9uIG9mIHRoZSBwbHVnaW4uXG4gICAgaWYgKHRoaXMudmFsdWVzLnN0aWNrQ3Vyc29yID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gXCJidWxsZXQtYW5kLWNoZWNrYm94XCI7XG4gICAgfSBlbHNlIGlmICh0aGlzLnZhbHVlcy5zdGlja0N1cnNvciA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBcIm5ldmVyXCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLnN0aWNrQ3Vyc29yO1xuICB9XG5cbiAgc2V0IGtlZXBDdXJzb3JXaXRoaW5Db250ZW50KHZhbHVlOiBLZWVwQ3Vyc29yV2l0aGluQ29udGVudCkge1xuICAgIHRoaXMuc2V0KFwic3RpY2tDdXJzb3JcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IG92ZXJyaWRlVGFiQmVoYXZpb3VyKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5iZXR0ZXJUYWI7XG4gIH1cblxuICBzZXQgb3ZlcnJpZGVUYWJCZWhhdmlvdXIodmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcImJldHRlclRhYlwiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgb3ZlcnJpZGVFbnRlckJlaGF2aW91cigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuYmV0dGVyRW50ZXI7XG4gIH1cblxuICBzZXQgb3ZlcnJpZGVFbnRlckJlaGF2aW91cih2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwiYmV0dGVyRW50ZXJcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IG92ZXJyaWRlVmltT0JlaGF2aW91cigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuYmV0dGVyVmltTztcbiAgfVxuXG4gIHNldCBvdmVycmlkZVZpbU9CZWhhdmlvdXIodmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcImJldHRlclZpbU9cIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IG92ZXJyaWRlU2VsZWN0QWxsQmVoYXZpb3VyKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5zZWxlY3RBbGw7XG4gIH1cblxuICBzZXQgb3ZlcnJpZGVTZWxlY3RBbGxCZWhhdmlvdXIodmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcInNlbGVjdEFsbFwiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgYmV0dGVyTGlzdHNTdHlsZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLnN0eWxlTGlzdHM7XG4gIH1cblxuICBzZXQgYmV0dGVyTGlzdHNTdHlsZXModmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcInN0eWxlTGlzdHNcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IHZlcnRpY2FsTGluZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLmxpc3RMaW5lcztcbiAgfVxuXG4gIHNldCB2ZXJ0aWNhbExpbmVzKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJsaXN0TGluZXNcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IHZlcnRpY2FsTGluZXNBY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLmxpc3RMaW5lQWN0aW9uO1xuICB9XG5cbiAgc2V0IHZlcnRpY2FsTGluZXNBY3Rpb24odmFsdWU6IFZlcnRpY2FsTGluZXNBY3Rpb24pIHtcbiAgICB0aGlzLnNldChcImxpc3RMaW5lQWN0aW9uXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBkcmFnQW5kRHJvcCgpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuZG5kO1xuICB9XG5cbiAgc2V0IGRyYWdBbmREcm9wKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJkbmRcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IGRlYnVnKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5kZWJ1ZztcbiAgfVxuXG4gIHNldCBkZWJ1Zyh2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwiZGVidWdcIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IHByZXZpb3VzUmVsZWFzZSgpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMucHJldmlvdXNSZWxlYXNlO1xuICB9XG5cbiAgc2V0IHByZXZpb3VzUmVsZWFzZSh2YWx1ZTogc3RyaW5nIHwgbnVsbCkge1xuICAgIHRoaXMuc2V0KFwicHJldmlvdXNSZWxlYXNlXCIsIHZhbHVlKTtcbiAgfVxuXG4gIG9uQ2hhbmdlKGNiOiBDYWxsYmFjaykge1xuICAgIHRoaXMuY2FsbGJhY2tzLmFkZChjYik7XG4gIH1cblxuICByZW1vdmVDYWxsYmFjayhjYjogQ2FsbGJhY2spOiB2b2lkIHtcbiAgICB0aGlzLmNhbGxiYWNrcy5kZWxldGUoY2IpO1xuICB9XG5cbiAgcmVzZXQoKSB7XG4gICAgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMoREVGQVVMVF9TRVRUSU5HUykpIHtcbiAgICAgIHRoaXMuc2V0KGsgYXMga2V5b2YgU2V0dGluZ3NPYmplY3QsIHYpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy52YWx1ZXMgPSBPYmplY3QuYXNzaWduKFxuICAgICAge30sXG4gICAgICBERUZBVUxUX1NFVFRJTkdTLFxuICAgICAgYXdhaXQgdGhpcy5zdG9yYWdlLmxvYWREYXRhKCksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmUoKSB7XG4gICAgYXdhaXQgdGhpcy5zdG9yYWdlLnNhdmVEYXRhKHRoaXMudmFsdWVzKTtcbiAgfVxuXG4gIGdldFZhbHVlcygpOiBTZXR0aW5nc09iamVjdCB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy52YWx1ZXMgfTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0PFQgZXh0ZW5kcyBrZXlvZiBTZXR0aW5nc09iamVjdD4oXG4gICAga2V5OiBULFxuICAgIHZhbHVlOiBTZXR0aW5nc09iamVjdFtUXSxcbiAgKTogdm9pZCB7XG4gICAgdGhpcy52YWx1ZXNba2V5XSA9IHZhbHVlO1xuXG4gICAgZm9yIChjb25zdCBjYiBvZiB0aGlzLmNhbGxiYWNrcykge1xuICAgICAgY2IoKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBBcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9BcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGVcIjtcbmltcG9ydCB7IEJhY2tzcGFjZUJlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvQmFja3NwYWNlQmVoYXZpb3VyT3ZlcnJpZGVcIjtcbmltcG9ydCB7IEJldHRlckxpc3RzU3R5bGVzIH0gZnJvbSBcIi4vZmVhdHVyZXMvQmV0dGVyTGlzdHNTdHlsZXNcIjtcbmltcG9ydCB7IEN0cmxBQW5kQ21kQUJlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvQ3RybEFBbmRDbWRBQmVoYXZpb3VyT3ZlcnJpZGVcIjtcbmltcG9ydCB7IERlbGV0ZUJlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvRGVsZXRlQmVoYXZpb3VyT3ZlcnJpZGVcIjtcbmltcG9ydCB7IERyYWdBbmREcm9wIH0gZnJvbSBcIi4vZmVhdHVyZXMvRHJhZ0FuZERyb3BcIjtcbmltcG9ydCB7IEVkaXRvclNlbGVjdGlvbnNCZWhhdmlvdXJPdmVycmlkZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0VkaXRvclNlbGVjdGlvbnNCZWhhdmlvdXJPdmVycmlkZVwiO1xuaW1wb3J0IHsgRW50ZXJCZWhhdmlvdXJPdmVycmlkZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0VudGVyQmVoYXZpb3VyT3ZlcnJpZGVcIjtcbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9mZWF0dXJlcy9GZWF0dXJlXCI7XG5pbXBvcnQgeyBMaXN0c0ZvbGRpbmdDb21tYW5kcyB9IGZyb20gXCIuL2ZlYXR1cmVzL0xpc3RzRm9sZGluZ0NvbW1hbmRzXCI7XG5pbXBvcnQgeyBMaXN0c01vdmVtZW50Q29tbWFuZHMgfSBmcm9tIFwiLi9mZWF0dXJlcy9MaXN0c01vdmVtZW50Q29tbWFuZHNcIjtcbmltcG9ydCB7IE1ldGFCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZSB9IGZyb20gXCIuL2ZlYXR1cmVzL01ldGFCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZVwiO1xuLy8gaW1wb3J0IHsgUmVsZWFzZU5vdGVzQW5ub3VuY2VtZW50IH0gZnJvbSBcIi4vZmVhdHVyZXMvUmVsZWFzZU5vdGVzQW5ub3VuY2VtZW50XCI7XG5pbXBvcnQgeyBTZXR0aW5nc1RhYiB9IGZyb20gXCIuL2ZlYXR1cmVzL1NldHRpbmdzVGFiXCI7XG5pbXBvcnQgeyBTaGlmdFRhYkJlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvU2hpZnRUYWJCZWhhdmlvdXJPdmVycmlkZVwiO1xuaW1wb3J0IHsgU3lzdGVtSW5mbyB9IGZyb20gXCIuL2ZlYXR1cmVzL1N5c3RlbUluZm9cIjtcbmltcG9ydCB7IFRhYkJlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvVGFiQmVoYXZpb3VyT3ZlcnJpZGVcIjtcbmltcG9ydCB7IFZlcnRpY2FsTGluZXMgfSBmcm9tIFwiLi9mZWF0dXJlcy9WZXJ0aWNhbExpbmVzXCI7XG5pbXBvcnQgeyBWaW1PQmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9WaW1PQmVoYXZpb3VyT3ZlcnJpZGVcIjtcbmltcG9ydCB7IENoYW5nZXNBcHBsaWNhdG9yIH0gZnJvbSBcIi4vc2VydmljZXMvQ2hhbmdlc0FwcGxpY2F0b3JcIjtcbmltcG9ydCB7IElNRURldGVjdG9yIH0gZnJvbSBcIi4vc2VydmljZXMvSU1FRGV0ZWN0b3JcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCIuL3NlcnZpY2VzL0xvZ2dlclwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSBcIi4vc2VydmljZXMvUGFyc2VyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgY29uc3QgUExVR0lOX1ZFUlNJT046IHN0cmluZztcbiAgY29uc3QgQ0hBTkdFTE9HX01EOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE9ic2lkaWFuT3V0bGluZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBwcml2YXRlIGZlYXR1cmVzOiBGZWF0dXJlW107XG4gIHByb3RlY3RlZCBzZXR0aW5nczogU2V0dGluZ3M7XG4gIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XG4gIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncztcbiAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcjtcbiAgcHJpdmF0ZSBjaGFuZ2VzQXBwbGljYXRvcjogQ2hhbmdlc0FwcGxpY2F0b3I7XG4gIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXI7XG4gIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBjb25zb2xlLmxvZyhgTG9hZGluZyBvYnNpZGlhbi1vdXRsaW5lcmApO1xuXG4gICAgYXdhaXQgdGhpcy5wcmVwYXJlU2V0dGluZ3MoKTtcblxuICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyA9IG5ldyBPYnNpZGlhblNldHRpbmdzKHRoaXMuYXBwKTtcbiAgICB0aGlzLmxvZ2dlciA9IG5ldyBMb2dnZXIodGhpcy5zZXR0aW5ncyk7XG4gICAgdGhpcy5wYXJzZXIgPSBuZXcgUGFyc2VyKHRoaXMubG9nZ2VyLCB0aGlzLnNldHRpbmdzKTtcbiAgICB0aGlzLmNoYW5nZXNBcHBsaWNhdG9yID0gbmV3IENoYW5nZXNBcHBsaWNhdG9yKCk7XG4gICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIgPSBuZXcgT3BlcmF0aW9uUGVyZm9ybWVyKFxuICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICB0aGlzLmNoYW5nZXNBcHBsaWNhdG9yLFxuICAgICk7XG5cbiAgICB0aGlzLmltZURldGVjdG9yID0gbmV3IElNRURldGVjdG9yKCk7XG4gICAgYXdhaXQgdGhpcy5pbWVEZXRlY3Rvci5sb2FkKCk7XG5cbiAgICB0aGlzLmZlYXR1cmVzID0gW1xuICAgICAgLy8gc2VydmljZSBmZWF0dXJlc1xuICAgICAgLy8gbmV3IFJlbGVhc2VOb3Rlc0Fubm91bmNlbWVudCh0aGlzLCB0aGlzLnNldHRpbmdzKSxcbiAgICAgIG5ldyBTZXR0aW5nc1RhYih0aGlzLCB0aGlzLnNldHRpbmdzKSxcbiAgICAgIG5ldyBTeXN0ZW1JbmZvKHRoaXMsIHRoaXMuc2V0dGluZ3MpLFxuXG4gICAgICAvLyBnZW5lcmFsIGZlYXR1cmVzXG4gICAgICBuZXcgTGlzdHNNb3ZlbWVudENvbW1hbmRzKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICAgIG5ldyBMaXN0c0ZvbGRpbmdDb21tYW5kcyh0aGlzLCB0aGlzLm9ic2lkaWFuU2V0dGluZ3MpLFxuXG4gICAgICAvLyBmZWF0dXJlcyBiYXNlZCBvbiBzZXR0aW5ncy5rZWVwQ3Vyc29yV2l0aGluQ29udGVudFxuICAgICAgbmV3IEVkaXRvclNlbGVjdGlvbnNCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICAgIG5ldyBBcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICAgIG5ldyBCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5pbWVEZXRlY3RvcixcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgICAgbmV3IE1ldGFCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5pbWVEZXRlY3RvcixcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgICAgbmV3IERlbGV0ZUJlaGF2aW91ck92ZXJyaWRlKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLmltZURldGVjdG9yLFxuICAgICAgICB0aGlzLm9wZXJhdGlvblBlcmZvcm1lcixcbiAgICAgICksXG5cbiAgICAgIC8vIGZlYXR1cmVzIGJhc2VkIG9uIHNldHRpbmdzLm92ZXJyaWRlVGFiQmVoYXZpb3VyXG4gICAgICBuZXcgVGFiQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgICAgbmV3IFNoaWZ0VGFiQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcblxuICAgICAgLy8gZmVhdHVyZXMgYmFzZWQgb24gc2V0dGluZ3Mub3ZlcnJpZGVFbnRlckJlaGF2aW91clxuICAgICAgbmV3IEVudGVyQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyxcbiAgICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcblxuICAgICAgLy8gZmVhdHVyZXMgYmFzZWQgb24gc2V0dGluZ3Mub3ZlcnJpZGVWaW1PQmVoYXZpb3VyXG4gICAgICBuZXcgVmltT0JlaGF2aW91ck92ZXJyaWRlKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MsXG4gICAgICAgIHRoaXMucGFyc2VyLFxuICAgICAgICB0aGlzLm9wZXJhdGlvblBlcmZvcm1lcixcbiAgICAgICksXG5cbiAgICAgIC8vIGZlYXR1cmVzIGJhc2VkIG9uIHNldHRpbmdzLm92ZXJyaWRlU2VsZWN0QWxsQmVoYXZpb3VyXG4gICAgICBuZXcgQ3RybEFBbmRDbWRBQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcblxuICAgICAgLy8gZmVhdHVyZXMgYmFzZWQgb24gc2V0dGluZ3MuYmV0dGVyTGlzdHNTdHlsZXNcbiAgICAgIG5ldyBCZXR0ZXJMaXN0c1N0eWxlcyh0aGlzLnNldHRpbmdzLCB0aGlzLm9ic2lkaWFuU2V0dGluZ3MpLFxuXG4gICAgICAvLyBmZWF0dXJlcyBiYXNlZCBvbiBzZXR0aW5ncy52ZXJ0aWNhbExpbmVzXG4gICAgICBuZXcgVmVydGljYWxMaW5lcyhcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5vYnNpZGlhblNldHRpbmdzLFxuICAgICAgICB0aGlzLnBhcnNlcixcbiAgICAgICksXG5cbiAgICAgIC8vIGZlYXR1cmVzIGJhc2VkIG9uIHNldHRpbmdzLmRyYWdBbmREcm9wXG4gICAgICBuZXcgRHJhZ0FuZERyb3AoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyxcbiAgICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBmZWF0dXJlIG9mIHRoaXMuZmVhdHVyZXMpIHtcbiAgICAgIGF3YWl0IGZlYXR1cmUubG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG9udW5sb2FkKCkge1xuICAgIGNvbnNvbGUubG9nKGBVbmxvYWRpbmcgb2JzaWRpYW4tb3V0bGluZXJgKTtcblxuICAgIGF3YWl0IHRoaXMuaW1lRGV0ZWN0b3IudW5sb2FkKCk7XG5cbiAgICBmb3IgKGNvbnN0IGZlYXR1cmUgb2YgdGhpcy5mZWF0dXJlcykge1xuICAgICAgYXdhaXQgZmVhdHVyZS51bmxvYWQoKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgcHJlcGFyZVNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBuZXcgU2V0dGluZ3ModGhpcyk7XG4gICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5sb2FkKCk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJlZGl0b3JJbmZvRmllbGQiLCJmb2xkZWRSYW5nZXMiLCJmb2xkYWJsZSIsImZvbGRFZmZlY3QiLCJ1bmZvbGRFZmZlY3QiLCJydW5TY29wZUhhbmRsZXJzIiwia2V5bWFwIiwiTm90aWNlIiwiaW5kZW50U3RyaW5nIiwiZ2V0SW5kZW50VW5pdCIsIlN0YXRlRWZmZWN0IiwiRGVjb3JhdGlvbiIsIlN0YXRlRmllbGQiLCJFZGl0b3JWaWV3IiwiUGxhdGZvcm0iLCJFZGl0b3JTdGF0ZSIsIlByZWMiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0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
