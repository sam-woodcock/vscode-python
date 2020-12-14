// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { Event } from 'vscode';
import { getSearchPathEntries } from '../../../../common/utils/exec';
import { Disposables, IDisposable } from '../../../../common/utils/resourceLifecycle';
import { isStandardPythonBinary } from '../../../common/commonUtils';
import { PythonEnvInfo, PythonEnvKind } from '../../info';
import {
    ILocator,
    IPythonEnvsIterator,
    PythonLocatorQuery,
} from '../../locator';
import { Locators } from '../../locators';
import { getEnvs } from '../../locatorUtils';
import { PythonEnvsChangedEvent } from '../../watcher';
import { DirFilesLocator } from './filesLocator';

/**
 * A locator for Windows locators found under the $PATH env var.
 *
 * Note that we assume $PATH won't change, so we don't need to watch
 * it for changes.
 */
export class WindowsPathEnvVarLocator implements ILocator, IDisposable {
    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    private readonly locators: Locators;

    private readonly disposables = new Disposables();

    constructor() {
        const dirLocators: (ILocator & IDisposable)[] = getSearchPathEntries()
            .map((dirname) => getDirFilesLocator(dirname, PythonEnvKind.Unknown));
        this.disposables.push(...dirLocators);
        this.locators = new Locators(dirLocators);
        this.onChanged = this.locators.onChanged;
    }

    public async dispose(): Promise<void> {
        this.locators.dispose();
        await this.disposables.dispose();
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        // Note that we do no filtering here, including to check if files
        // are valid executables.  That is left to callers (e.g. composite
        // locators).
        return this.locators.iterEnvs(query);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        return this.locators.resolveEnv(env);
    }
}

function getDirFilesLocator(
    dirname: string,
    kind: PythonEnvKind,
): ILocator & IDisposable {
    const locator = new DirFilesLocator(dirname, kind);
    // Really we should be checking for symlinks or something more
    // sophisticated.  Also, this should be done in ReducingLocator
    // rather than in each low-level locator.  In the meantime we
    // take a naive approach.
    async function* iterEnvs(query: PythonLocatorQuery): IPythonEnvsIterator {
        const envs = await getEnvs(locator.iterEnvs(query));
        for (const env of envs) {
            if (isStandardPythonBinary(env.executable?.filename || '')) {
                yield env;
            }
        }
    }
    async function resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        const executable = typeof env === 'string' ? env : env.executable?.filename || '';
        if (!isStandardPythonBinary(executable)) {
            return undefined;
        }
        return locator.resolveEnv(env);
    }
    return {
        iterEnvs,
        resolveEnv,
        onChanged: locator.onChanged,
        dispose: () => locator.dispose(),
    };
}
