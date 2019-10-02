import {IHomebridgeAccessory, IHomebridgeApi, ILog} from './homebridge/framework';
import {ITionApi} from './tion/api';
import {TionDeviceBase} from './tion/devices/base';
import {PlatformName, PluginName} from './platform_config';
import {ITionDevicesFactory} from './tion/devices/factory';
import {IAccessoriesFactory} from './accessories_factory';
import {ILocation} from 'tion/state';

export class TionPlatform {
    private readonly log: ILog;
    private readonly hbApi: IHomebridgeApi;
    private readonly tionApi: ITionApi;
    private readonly tionDevicesFactory: ITionDevicesFactory;
    private readonly accessoriesFactory: IAccessoriesFactory;

    private tionDevices: TionDeviceBase[];
    private hbAccessories: IHomebridgeAccessory[];
    private pollInterval: NodeJS.Timeout;

    constructor(
        log: ILog,
        hbApi: IHomebridgeApi,
        api: ITionApi,
        devicesFactory: ITionDevicesFactory,
        accessoriesFactory: IAccessoriesFactory
    ) {
        this.log = log;
        this.hbApi = hbApi;
        this.tionApi = api;
        this.tionDevicesFactory = devicesFactory;
        this.accessoriesFactory = accessoriesFactory;

        this.tionDevices = [];
        this.hbAccessories = [];

        hbApi.on('didFinishLaunching', this.init);
        hbApi.on('shutdown', this.shutdown);
    }

    public loadCachedAccessory = (accessory: IHomebridgeAccessory) => {
        this.log.debug(`Received accessory for ${accessory.context.id}`);

        if (!this.hbAccessories.find(a => a.UUID === accessory.UUID)) {
            this.hbAccessories.push(accessory);
        }
    }

    private init = async () => {
        this.log.debug('Initializing');
        try {
            await this.tionApi.init();
            const location = await this.tionApi.getSystemState();
            this.tionDevices = this.tionDevicesFactory.createDevices([], location);
            this.mergeAccessories();

            this.pollInterval = setInterval(this.poll, 60000);
        } catch (err) {
            this.log.error('Initialization error');
            this.log.error(err);
        }
    }

    private shutdown = async () => {
        this.log.debug('Shutting down');
        clearInterval(this.pollInterval);
    }

    private poll = async () => {
        const location = await this.tionApi.getSystemState();
        this.tionDevices = this.tionDevicesFactory.createDevices(this.tionDevices, location);
        this.mergeAccessories();
        this.updateState(location);
    }

    private mergeAccessories(): void {
        this.log.debug(`Merging ${this.tionDevices.length} devices and ${this.hbAccessories.length} accessories`);
        // create new devices
        this.tionDevices.forEach(device => {
            const registeredAccessories = this.hbAccessories.filter(a => a.context.id === device.id);
            if (registeredAccessories.length) {
                registeredAccessories.forEach(a => device.addEventHandlers(a));
            } else {
                const newAccessories = this.accessoriesFactory.createAccessories(device);
                this.hbAccessories.push.apply(this.hbAccessories, newAccessories);
                newAccessories.forEach(a => device.addEventHandlers(a));

                this.hbApi.registerPlatformAccessories(PluginName, PlatformName, newAccessories);
            }
        });

        this.log.debug(`Got ${this.hbAccessories.length} accessories after creating new`);

        // remove outdated accessories
        const byId = this.hbAccessories.reduce((all, cur) => {
            if (!all[cur.context.id]) {
                all[cur.context.id] = [];
            }
            all[cur.context.id].push(cur);
            return all;
        }, {});

        const toRemove: IHomebridgeAccessory[] = [];
        Object.keys(byId).forEach(id => {
            const device = this.tionDevices.find(d => d.id === id);
            if (!device) {
                toRemove.push.apply(toRemove, byId[id]);
            }
        });

        if (toRemove.length) {
            this.hbApi.unregisterPlatformAccessories(PluginName, PlatformName, toRemove);
            this.hbAccessories = this.hbAccessories.filter(a => !toRemove.find(b => b.context.id === a.context.id));
        }

        this.log.debug(
            `Got ${this.hbAccessories.length} accessories after removing ${toRemove.length} outdated accessories`
        );
    }

    private updateState(location: ILocation) {
        this.tionDevices.forEach(device => device.updateState(location));
    }
}
