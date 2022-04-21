import {ILog, IHomebridgeAccessory} from 'homebridge/framework';
import {ITionPlatformConfig} from 'platform_config';
import {ITionApi} from 'tion/api';
import {ILocation, IDevice, IZone} from 'tion/state';
import {IDeviceCommand} from 'tion/command';

export abstract class TionDeviceBase {
    public readonly zoneId: string;
    public readonly id: string;
    public readonly name: string;
    public readonly modelName: string;
    public readonly mac: string;
    public readonly firmwareRevision: string;
    public readonly hardwareRevision: string;
    public isOnline: boolean;
    public isCommandRunning: boolean;

    protected readonly log: ILog;
    protected readonly config: ITionPlatformConfig;
    protected readonly api: ITionApi;
    protected readonly serviceRegistry: any;
    protected readonly characteristicRegistry: any;

    protected readonly accessories: IHomebridgeAccessory[];

    constructor(
        device: IDevice,
        zone: IZone,
        log: ILog,
        config: ITionPlatformConfig,
        api: ITionApi,
        serviceRegistry: any,
        characteristicRegistry: any
    ) {
        this.zoneId = zone.guid;
        this.id = device.guid;
        this.name = device.name;
        this.modelName = device.type;
        this.mac = device.mac;
        this.firmwareRevision = device.firmware;
        this.hardwareRevision = device.hardware;
        this.isOnline = true;
        this.isCommandRunning = false;

        this.log = log;
        this.config = config;
        this.api = api;
        this.serviceRegistry = serviceRegistry;
        this.characteristicRegistry = characteristicRegistry;
        this.accessories = [];
    }

    public abstract addEventHandlers(accessory: IHomebridgeAccessory): void;
    public abstract updateState(state: ILocation): void;

    protected abstract parseState(state: ILocation): boolean;

    protected findDeviceInState(state: ILocation): {device: IDevice| null; zone: IZone| null} {
        let device: IDevice | null = null;
        let zone: IZone | null = null;

        state.zones.forEach(z => {
            if (device) {
                return;
            }
            z.devices.forEach(d => {
                if (device) {
                    return;
                }
                if (d.guid === this.id) {
                    device = d;
                    zone = z;
                }
            });
        });
        if (!device) {
            this.log.error(`Device ${this.name} (${this.id}) not found in remote state`);
        }
        return {
            device, 
            zone,
        };
    }

    protected async setState(command: IDeviceCommand): Promise<void> {
        try {
            this.isCommandRunning = true;
            await this.api.execDeviceCommand(this.id, command);
        } finally {
            this.isCommandRunning = false;
        }
    }

    protected async getState(callback: (err: any, value?: any) => any, getter: () => any): Promise<void> {
        try {
            const state = await this.api.getSystemState();
            if (this.parseState(state)) {
                if (!this.isOnline) {
                    this.accessories.forEach(a => (a.reachable = false));
                    this.log.error(`Device ${this.name} (${this.id}) not reachable`);
                    return callback('Not reachable');
                }

                callback(null, getter());
            } else {
                this.log.error(`Device ${this.name} (${this.id}) cannot parse state`);
                callback('Cannot parse state');
            }
        } catch (err) {
            this.log.error('Cannot get system state');
            this.log.error(err);
            callback('Cannot get state');
        }
    }

    protected rollbackCharacteristic(service: any, characteristic: any, value: string | number | boolean) {
        setTimeout(() => {
            service.updateCharacteristic(characteristic, value);
        }, 100);
    }
}
