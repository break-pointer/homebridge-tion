import {ILog} from 'homebridge/framework';
import {ITionPlatformConfig} from 'platform_config';

import {ILocation, IDevice, IZone} from 'tion/state';
import {ITionApi} from 'tion/api';
import {TionDeviceBase} from './base';
import {TionMagicAirStation} from './station';
import {TionBreezer} from './breezer';
import {TionCO2Plus} from './co2plus';
import {SupportedDeviceTypes} from './supported_device_types';

export interface ITionDevicesFactory {
    createDevices(existingDevices: TionDeviceBase[], location: ILocation): TionDeviceBase[];
}

export class TionDevicesFactory implements ITionDevicesFactory {
    private readonly log: ILog;
    private readonly config: ITionPlatformConfig;
    private readonly api: ITionApi;
    private readonly serviceRegistry: any;
    private readonly characteristicRegistry: any;

    constructor(
        log: ILog,
        config: ITionPlatformConfig,
        api: ITionApi,
        serviceRegistry: any,
        characteristicRegistry: any
    ) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.serviceRegistry = serviceRegistry;
        this.characteristicRegistry = characteristicRegistry;
    }

    public createDevices(existingDevices: TionDeviceBase[], location: ILocation): TionDeviceBase[] {
        const devices = location.zones.reduce((all: TionDeviceBase[], zone: IZone) => {
            const zoneDevices: TionDeviceBase[] = [];
            zone.devices.forEach(d => {
                if (!existingDevices.find(ex => ex.id === d.guid)) {
                    const device = this.createDevice(d, zone);
                    if (device) {
                        zoneDevices.push(device);
                    }
                }
            });

            return all.concat(zoneDevices);
        }, []);

        return existingDevices.concat(devices);
    }

    private createDevice(device: IDevice, zone: IZone): TionDeviceBase | null {
        switch (device.type) {
            default:
                this.log.warn(
                    `Unsupported device type ${device.type}. Please contact plugin developer to add device support.`
                );
                return null;
            case SupportedDeviceTypes.MagicAirStation:
                return new TionMagicAirStation(
                    device,
                    zone,
                    this.log,
                    this.config,
                    this.api,
                    this.serviceRegistry,
                    this.characteristicRegistry
                );
            case SupportedDeviceTypes.Breezer4S:
            case SupportedDeviceTypes.Breezer3S:
            case SupportedDeviceTypes.BreezerO2:
                return new TionBreezer(
                    device,
                    zone,
                    this.log,
                    this.config,
                    this.api,
                    this.serviceRegistry,
                    this.characteristicRegistry
                );
            case SupportedDeviceTypes.CO2Plus:
                return new TionCO2Plus(
                    device,
                    zone,
                    this.log,
                    this.config,
                    this.api,
                    this.serviceRegistry,
                    this.characteristicRegistry
                );
        }
    }
}
