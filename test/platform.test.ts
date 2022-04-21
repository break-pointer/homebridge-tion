import { TionAuthApi } from '../src/tion/auth';
import { TionApi } from '../src/tion/api';
import { TionDevicesFactory } from '../src/tion/devices/factory';
import { AccessoriesFactory } from '../src/accessories_factory';
import { TionPlatform } from '../src/platform';

import {MockLog, MockTionAuthStorage, MockPlatformConfig, MockHomebridge, MockHomebridgeApi} from './mocks';

jest.mock('node-fetch');

function setup(): [MockHomebridgeApi, TionPlatform] {
    const homebridge = new MockHomebridge();
    const homebridgeApi = new MockHomebridgeApi();
        
    const config = new MockPlatformConfig();

    const authStorage = new MockTionAuthStorage();
    const authApi = new TionAuthApi(MockLog, config, authStorage);
    const api = new TionApi(MockLog, config, authApi);
    const devicesFactory = new TionDevicesFactory(MockLog, config, api, homebridge.hap.Service, homebridge.hap.Characteristic);
    const accessoriesFactory = new AccessoriesFactory(MockLog, homebridge.hap.Service, homebridge.hap.Characteristic, homebridge.platformAccessory, homebridge.hap.uuid.generate);

    const platform = new TionPlatform(MockLog, homebridgeApi, api, devicesFactory, accessoriesFactory);

    return [homebridgeApi, platform];
}

describe('Test Tion Platform', () => {
    let homebridgeApi: MockHomebridgeApi;
    let platform: TionPlatform;

    beforeEach(async () => {
        [homebridgeApi, platform] = setup();
        homebridgeApi.send("didFinishLaunching");
        await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    afterEach(() => {
        homebridgeApi.send('shutdown');
    });

    test('It should register in homebridge', async () => {
        expect(platform['tionDevices'].length).toBeGreaterThan(0);
        expect(platform['hbAccessories'].length).toBeGreaterThan(0);
    });
});
