/*
 * diagnostics.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Class that collects and deduplicates diagnostics.
 */

import { appendArray } from './collectionUtils';
import { DiagnosticLevel } from './configOptions';
import { Diagnostic, DiagnosticAction, DiagnosticCategory } from './diagnostic';
import { convertOffsetsToRange } from './positionUtils';
import { hashString } from './stringUtils';
import { Range, TextRange } from './textRange';
import { TextRangeCollection } from './textRangeCollection';
import { Uri } from './uri/uri';

// Represents a collection of diagnostics within a file.
export interface FileDiagnostics {
    fileUri: Uri;
    version: number | undefined;
    diagnostics: Diagnostic[];
}

// Creates and tracks a list of diagnostics.
export class DiagnosticSink {
    diagnosticList: Diagnostic[];
    diagnosticMap: Map<string, Diagnostic>;

    constructor(diagnostics?: Diagnostic[]) {
        this.diagnosticList = diagnostics || [];
        this.diagnosticMap = new Map<string, Diagnostic>();
    }

    fetchAndClear() {
        const prevDiagnostics = this.diagnosticList;
        this.diagnosticList = [];
        this.diagnosticMap.clear();
        return prevDiagnostics;
    }

    addError(message: string, range: Range) {
        return this.addDiagnostic(new Diagnostic(DiagnosticCategory.Error, message, range));
    }

    addWarning(message: string, range: Range) {
        return this.addDiagnostic(new Diagnostic(DiagnosticCategory.Warning, message, range));
    }

    addInformation(message: string, range: Range) {
        return this.addDiagnostic(new Diagnostic(DiagnosticCategory.Information, message, range));
    }

    addUnusedCode(message: string, range: Range, action?: DiagnosticAction) {
        const diag = new Diagnostic(DiagnosticCategory.UnusedCode, message, range);
        if (action) {
            diag.addAction(action);
        }
        return this.addDiagnostic(diag);
    }

    addUnreachableCode(message: string, range: Range, action?: DiagnosticAction) {
        const diag = new Diagnostic(DiagnosticCategory.UnreachableCode, message, range);
        if (action) {
            diag.addAction(action);
        }
        return this.addDiagnostic(diag);
    }

    addDeprecated(message: string, range: Range, action?: DiagnosticAction) {
        const diag = new Diagnostic(DiagnosticCategory.Deprecated, message, range);
        if (action) {
            diag.addAction(action);
        }
        return this.addDiagnostic(diag);
    }

    addDiagnostic(diag: Diagnostic) {
        // Create a unique key for the diagnostic to prevent
        // adding duplicates.
        const key =
            `${diag.range.start.line},${diag.range.start.character}-` +
            `${diag.range.end.line}-${diag.range.end.character}:${hashString(diag.message)}}`;
        if (!this.diagnosticMap.has(key)) {
            this.diagnosticList.push(diag);
            this.diagnosticMap.set(key, diag);
        }
        return diag;
    }

    addDiagnostics(diagsToAdd: Diagnostic[]) {
        appendArray(this.diagnosticList, diagsToAdd);
    }

    getErrors() {
        return this.diagnosticList.filter((diag) => diag.category === DiagnosticCategory.Error);
    }

    getWarnings() {
        return this.diagnosticList.filter((diag) => diag.category === DiagnosticCategory.Warning);
    }

    getInformation() {
        return this.diagnosticList.filter((diag) => diag.category === DiagnosticCategory.Information);
    }

    getUnusedCode() {
        return this.diagnosticList.filter((diag) => diag.category === DiagnosticCategory.UnusedCode);
    }

    getUnreachableCode() {
        return this.diagnosticList.filter((diag) => diag.category === DiagnosticCategory.UnreachableCode);
    }

    getDeprecated() {
        return this.diagnosticList.filter((diag) => diag.category === DiagnosticCategory.Deprecated);
    }

    copy() {
        let self = new DiagnosticSink(this.diagnosticList.map(diag => diag.copy()))
        self.diagnosticMap = new Map(Array.from(this.diagnosticMap.entries(), ([k, v]) => [k, v.copy()]))

        return self
    }
}

// Specialized version of DiagnosticSink that works with TextRange objects
// and converts text ranges to line and column numbers.
export class TextRangeDiagnosticSink extends DiagnosticSink {
    lines: TextRangeCollection<TextRange>;

    constructor(lines: TextRangeCollection<TextRange>, diagnostics?: Diagnostic[]) {
        super(diagnostics);
        this.lines = lines;
    }

    addDiagnosticWithTextRange(level: DiagnosticLevel, message: string, range: TextRange) {
        const positionRange = convertOffsetsToRange(range.start, range.start + range.length, this.lines);
        switch (level) {
            case 'error':
                return this.addError(message, positionRange);

            case 'warning':
                return this.addWarning(message, positionRange);

            case 'information':
                return this.addInformation(message, positionRange);

            default:
                throw new Error(`${level} is not expected value`);
        }
    }

    addUnusedCodeWithTextRange(message: string, range: TextRange, action?: DiagnosticAction) {
        return this.addUnusedCode(
            message,
            convertOffsetsToRange(range.start, range.start + range.length, this.lines),
            action
        );
    }

    addUnreachableCodeWithTextRange(message: string, range: TextRange, action?: DiagnosticAction) {
        return this.addUnreachableCode(
            message,
            convertOffsetsToRange(range.start, range.start + range.length, this.lines),
            action
        );
    }

    addDeprecatedWithTextRange(message: string, range: TextRange, action?: DiagnosticAction) {
        return this.addDeprecated(
            message,
            convertOffsetsToRange(range.start, range.start + range.length, this.lines),
            action
        );
    }

    override copy() {
        let self = new TextRangeDiagnosticSink(this.lines.copy(), this.diagnosticList.map(diag => diag.copy()))
        self.diagnosticMap = new Map(Array.from(this.diagnosticMap.entries(), ([k, v]) => [k, v.copy()]))

        return self
    }
}
