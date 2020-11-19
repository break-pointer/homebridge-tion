import path from 'path';

import {TionAuthApi, TionFilesystemAuthStorage} from '../src/tion/auth';
import {TionApi} from '../src/tion/api';

import {MockLog, MockPlatformConfig} from './mocks';

jest.mock('node-fetch');

describe('Test Tion API', () => {
    const config = new MockPlatformConfig();

    const authStorage = new TionFilesystemAuthStorage(MockLog, path.join(__dirname, 'data'));
    const authApi = new TionAuthApi(MockLog, config, authStorage);
    const api = new TionApi(MockLog, config, authApi);

    test('It should login and recieve state', async () => {
        await expect(api.init()).resolves.toBeUndefined();
        const systemState = await api.getSystemState();
        expect(systemState).toBeDefined();
        expect(systemState.name).toEqual('Home');
    });
});
