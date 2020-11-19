import {
    HomebridgePlatform,
    IHomebridgeAccessory,
    ILog,
    IHomebridgeApi,
    IHomebridge,
    UuidGen,
} from 'homebridge/framework';
import {TionPlatform} from 'platform';
import {ITionPlatformConfig, PluginName, PlatformName, sanitize, validate} from 'platform_config';
import {TionFilesystemAuthStorage, TionAuthApi} from 'tion/auth';
import {TionApi} from 'tion/api';
import {TionDevicesFactory} from 'tion/devices/factory';
import {AccessoriesFactory} from 'accessories_factory';

let GenerateUuid: UuidGen;
let Service: any;
let Characteristic: any;
let Accessory: any;
let User: any;

class TionPlatformWrapper extends HomebridgePlatform {
    private readonly instance: TionPlatform;

    constructor(log: ILog, config: ITionPlatformConfig, hbApi: IHomebridgeApi) {
        super(log, config, hbApi);

        if (!log) {
            throw new Error('Tion: log service not found. Probably incompatible Homebridge version');
        }
        if (!config || typeof config !== 'object') {
            log.error('config not set, stopping platform');
            return;
        }
        if (!hbApi) {
            log.error('api service not found, probably incompatible Homebridge version, stopping platform');
            return;
        }

        if (!validate(log, sanitize(log, config))) {
            this.log.error('config invalid, stopping platform');
            return;
        }

        const authStorage = new TionFilesystemAuthStorage(log, User.persistPath());
        const authApi = new TionAuthApi(log, config, authStorage);
        const api = new TionApi(log, config, authApi);
        const devicesFactory = new TionDevicesFactory(log, config, api, Service, Characteristic);
        const accessoriesFactory = new AccessoriesFactory(log, Service, Characteristic, Accessory, GenerateUuid);

        this.instance = new TionPlatform(log, hbApi, api, devicesFactory, accessoriesFactory);
    }

    public configureAccessory = (accessory: IHomebridgeAccessory) => {
        return this.instance && this.instance.loadCachedAccessory(accessory);
    };
}

export default (homebridge: IHomebridge): void => {
    GenerateUuid = homebridge.hap.uuid.generate;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.platformAccessory;
    User = homebridge.user;

    homebridge.registerPlatform(PluginName, PlatformName, TionPlatformWrapper, true);
};
