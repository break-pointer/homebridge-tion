import { TionAuthApi } from '../src/tion/auth';
import { TionApi } from '../src/tion/api';

import {MockLog, MockTionAuthStorage, MockPlatformConfig} from './mocks';

jest.mock('request-promise-native');

describe('Test Tion API', () => {
    const config = new MockPlatformConfig();

    const authStorage = new MockTionAuthStorage();
    const authApi = new TionAuthApi(MockLog, config, authStorage);
    const api = new TionApi(MockLog, config, authApi);

    test('It should login and recieve state', async () => {
        await expect(api.init()).resolves.toBeUndefined();
        await expect(api.getSystemState()).resolves.toBeDefined();
    });
});
