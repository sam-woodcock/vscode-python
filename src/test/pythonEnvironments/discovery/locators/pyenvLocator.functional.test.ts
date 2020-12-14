// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as sinon from 'sinon';
import * as fsWatcher from '../../../../client/common/platform/fileSystemWatcher';
import * as platformUtils from '../../../../client/common/utils/platform';
import { PythonEnvInfo, PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import { buildEnvInfo } from '../../../../client/pythonEnvironments/base/info/env';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PyenvLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/pyenvLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertEnvEqual, assertEnvsEqual } from './envTestUtils';

suite('Pyenv Locator Tests', () => {
    let getEnvVariableStub: sinon.SinonStub;
    let getOsTypeStub: sinon.SinonStub;
    let locator: PyenvLocator;
    let watchLocationForPatternStub: sinon.SinonStub;

    const testPyenvRoot = path.join(TEST_LAYOUT_ROOT, 'pyenvhome', '.pyenv');
    const testPyenvVersionsDir = path.join(testPyenvRoot, 'versions');

    setup(async () => {
        getEnvVariableStub = sinon.stub(platformUtils, 'getEnvironmentVariable');
        getEnvVariableStub.withArgs('PYENV_ROOT').returns(testPyenvRoot);

        getOsTypeStub = sinon.stub(platformUtils, 'getOSType');
        getOsTypeStub.returns(platformUtils.OSType.Linux);

        watchLocationForPatternStub = sinon.stub(fsWatcher, 'watchLocationForPattern');
        watchLocationForPatternStub.returns({ dispose: () => { /* do nothing */ } });

        locator = new PyenvLocator();
    });

    teardown(() => {
        getEnvVariableStub.restore();
        getOsTypeStub.restore();
        watchLocationForPatternStub.restore();
    });

    function getExpectedPyenvInfo(name:string) : PythonEnvInfo | undefined {
        if (name === '3.9.0') {
            const envInfo = buildEnvInfo({
                kind: PythonEnvKind.Pyenv,
                executable: path.join(testPyenvVersionsDir, '3.9.0', 'bin', 'python'),
                version: {
                    major: 3,
                    minor: 9,
                    micro: 0,
                },
            });
            envInfo.defaultDisplayName = '3.9.0:pyenv';
            envInfo.location = path.join(testPyenvVersionsDir, '3.9.0');
            envInfo.name = '3.9.0';
            return envInfo;
        }

        if (name === 'conda1') {
            const envInfo = buildEnvInfo({
                kind: PythonEnvKind.Pyenv,
                executable: path.join(testPyenvVersionsDir, 'conda1', 'bin', 'python'),
                version: {
                    major: 3,
                    minor: 8,
                    micro: 5,
                },
            });
            envInfo.defaultDisplayName = 'conda1:pyenv';
            envInfo.location = path.join(testPyenvVersionsDir, 'conda1');
            envInfo.name = 'conda1';
            return envInfo;
        }

        if (name === 'miniconda') {
            const envInfo = buildEnvInfo({
                kind: PythonEnvKind.Pyenv,
                executable: path.join(testPyenvVersionsDir, 'miniconda3-4.7.12', 'bin', 'python'),
                version: {
                    major: 3,
                    minor: 7,
                    micro: -1,
                },
            });
            envInfo.defaultDisplayName = 'miniconda3-4.7.12:pyenv';
            envInfo.location = path.join(testPyenvVersionsDir, 'miniconda3-4.7.12');
            envInfo.name = 'miniconda3-4.7.12';
            envInfo.distro.org = 'miniconda3';
            return envInfo;
        }

        if (name === 'venv1') {
            const envInfo = buildEnvInfo({
                kind: PythonEnvKind.Pyenv,
                executable: path.join(testPyenvVersionsDir, 'venv1', 'bin', 'python'),
                version: {
                    major: 3,
                    minor: 9,
                    micro: 0,
                },
            });
            envInfo.defaultDisplayName = 'venv1:pyenv';
            envInfo.location = path.join(testPyenvVersionsDir, 'venv1');
            envInfo.name = 'venv1';
            return envInfo;
        }
        return undefined;
    }

    test('iterEnvs()', async () => {
        const expectedEnvs = [
            getExpectedPyenvInfo('3.9.0'),
            getExpectedPyenvInfo('conda1'),
            getExpectedPyenvInfo('miniconda'),
            getExpectedPyenvInfo('venv1'),
        ].filter((e) => e !== undefined).sort((a, b) => {
            if (a && b) {
                return a.executable.filename.localeCompare(b.executable.filename);
            }
            return 0;
        });

        const actualEnvs = (await getEnvs(locator.iterEnvs()))
            .sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('resolveEnv(string)', async () => {
        const pythonPath = path.join(testPyenvVersionsDir, '3.9.0', 'bin', 'python');
        const expected = getExpectedPyenvInfo('3.9.0');

        const actual = await locator.resolveEnv(pythonPath);
        assertEnvEqual(actual, expected);
    });
    test('resolveEnv(PythonEnvInfo)', async () => {
        const pythonPath = path.join(testPyenvVersionsDir, '3.9.0', 'bin', 'python');
        const expected = getExpectedPyenvInfo('3.9.0');

        // Partially filled in env info object
        const input:PythonEnvInfo = {
            name: '',
            location: '',
            kind: PythonEnvKind.Unknown,
            distro: { org: '' },
            arch: platformUtils.Architecture.Unknown,
            executable: {
                filename: pythonPath,
                sysPrefix: '',
                ctime: -1,
                mtime: -1,
            },
            version: {
                major: -1,
                minor: -1,
                micro: -1,
            },
        };

        const actual = await locator.resolveEnv(input);

        assertEnvEqual(actual, expected);
    });
});
