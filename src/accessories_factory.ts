import {ILog, IHomebridgeAccessory, UuidGen} from './homebridge/framework';

import {TionDeviceBase} from './tion/devices/base';
import {TionMagicAirStation} from './tion/devices/station';
import {TionBreezer} from './tion/devices/breezer';

export interface IAccessoriesFactory {
    createAccessories(device: TionDeviceBase): IHomebridgeAccessory[];
}

export class AccessoriesFactory implements IAccessoriesFactory {
    private readonly log: ILog;
    private readonly serviceRegistry: any;
    private readonly characteristicRegistry: any;
    private readonly accessoryClass: any;
    private readonly generateUuid: UuidGen;

    constructor(
        log: ILog,
        serviceRegistry: any,
        characteristicRegistry: any,
        accessoryClass: any,
        generateUuid: UuidGen
    ) {
        this.log = log;
        this.serviceRegistry = serviceRegistry;
        this.characteristicRegistry = characteristicRegistry;
        this.accessoryClass = accessoryClass;
        this.generateUuid = generateUuid;
    }

    public createAccessories(device: TionDeviceBase): IHomebridgeAccessory[] {
        if (device instanceof TionMagicAirStation) {
            return this.createMagicAirStationAccessories(device);
        } else if (device instanceof TionBreezer) {
            return this.createBreezerAccessories(device);
        } else {
            throw new Error(`Unsupported device type ${device.constructor.name}`);
        }
    }

    private createMagicAirStationAccessories(device: TionMagicAirStation): IHomebridgeAccessory[] {
        const ret: IHomebridgeAccessory[] = [];
        const Accessory = this.accessoryClass;

        const accessory: IHomebridgeAccessory = new Accessory('MagicAir Station', this.generateUuid(device.id));
        accessory.context = {
            id: device.id,
        };

        accessory.on('identify', (paired, callback) => {
            this.log.info(`Identify ${device.id}`);

            callback();
        });

        accessory
            .getService(this.serviceRegistry.AccessoryInformation)
            .setCharacteristic(this.characteristicRegistry.Manufacturer, 'Tion')
            .setCharacteristic(this.characteristicRegistry.Model, device.modelName)
            .setCharacteristic(this.characteristicRegistry.SerialNumber, device.mac)
            .setCharacteristic(this.characteristicRegistry.FirmwareRevision, device.firmwareRevision)
            .setCharacteristic(this.characteristicRegistry.HardwareRevision, device.hardwareRevision);

        accessory
            .addService(this.serviceRegistry.CarbonDioxideSensor, 'CO2')
            .setCharacteristic(this.characteristicRegistry.CarbonDioxideDetected, 0)
            .setCharacteristic(this.characteristicRegistry.CarbonDioxideLevel, 0);

        accessory
            .addService(this.serviceRegistry.TemperatureSensor, 'Температура')
            .setCharacteristic(this.characteristicRegistry.CurrentTemperature, 0);

        accessory
            .addService(this.serviceRegistry.HumiditySensor, 'Влажность')
            .setCharacteristic(this.characteristicRegistry.CurrentRelativeHumidity, 0);

        ret.push(accessory);

        return ret;
    }

    private createBreezerAccessories(device: TionBreezer): IHomebridgeAccessory[] {
        const ret: IHomebridgeAccessory[] = [];
        const Accessory = this.accessoryClass;

        const breezerAccessory: IHomebridgeAccessory = new Accessory(device.name, this.generateUuid(device.id));
        breezerAccessory.context = {
            id: device.id,
        };

        breezerAccessory.on('identify', (paired, callback) => {
            this.log.info(`Identify ${device.id}`);

            callback();
        });

        breezerAccessory
            .getService(this.serviceRegistry.AccessoryInformation)
            .setCharacteristic(this.characteristicRegistry.Manufacturer, 'Tion')
            .setCharacteristic(this.characteristicRegistry.Model, device.modelName)
            .setCharacteristic(this.characteristicRegistry.SerialNumber, device.mac)
            .setCharacteristic(this.characteristicRegistry.FirmwareRevision, device.firmwareRevision)
            .setCharacteristic(this.characteristicRegistry.HardwareRevision, device.hardwareRevision);

        const airPurifier = breezerAccessory
            .addService(this.serviceRegistry.AirPurifier, 'Приток')
            .setCharacteristic(this.characteristicRegistry.Active, 0)
            .setCharacteristic(this.characteristicRegistry.CurrentAirPurifierState, 0)
            .setCharacteristic(this.characteristicRegistry.TargetAirPurifierState, 1)
            .setCharacteristic(this.characteristicRegistry.RotationSpeed, 1);

        const filter = breezerAccessory
            .addService(this.serviceRegistry.FilterMaintenance, 'Фильтр')
            .setCharacteristic(this.characteristicRegistry.FilterChangeIndication, 0)
            .setCharacteristic(this.characteristicRegistry.FilterLifeLevel, 0);

        airPurifier.addLinkedService(filter);

        if (device.isHeaterInstalled) {
            breezerAccessory
                .addService(this.serviceRegistry.HeaterCooler, 'Нагрев')
                .setCharacteristic(this.characteristicRegistry.Active, 0)
                .setCharacteristic(this.characteristicRegistry.CurrentHeaterCoolerState, 0)
                .setCharacteristic(this.characteristicRegistry.TargetHeaterCoolerState, 1)
                .setCharacteristic(this.characteristicRegistry.CurrentTemperature, 0)
                .setCharacteristic(this.characteristicRegistry.HeatingThresholdTemperature, 0);
        }

        ret.push(breezerAccessory);

        const tempSensorAccessory: IHomebridgeAccessory = new Accessory(device.name, this.generateUuid(`${device.id}:outside_temperature`));
        tempSensorAccessory.context = {
            id: device.id,
        };

        tempSensorAccessory
            .getService(this.serviceRegistry.AccessoryInformation)
            .setCharacteristic(this.characteristicRegistry.Manufacturer, 'Tion')
            .setCharacteristic(this.characteristicRegistry.Model, device.modelName)
            .setCharacteristic(this.characteristicRegistry.SerialNumber, device.mac)
            .setCharacteristic(this.characteristicRegistry.FirmwareRevision, device.firmwareRevision)
            .setCharacteristic(this.characteristicRegistry.HardwareRevision, device.hardwareRevision);


        tempSensorAccessory.addService(this.serviceRegistry.TemperatureSensor, 'Температура уличного воздуха')
            .setCharacteristic(this.characteristicRegistry.StatusActive, 0)
            .setCharacteristic(this.characteristicRegistry.CurrentTemperature, 0);

        ret.push(tempSensorAccessory);

        return ret;
    }
}
