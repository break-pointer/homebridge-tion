import {EventEmitter} from 'events';
import {createHash} from 'crypto';

import {ITionAuthStorage, ITionAuthData} from '../src/tion/auth';
import {ITionPlatformConfig} from '../src/platform_config';
import {IHomebridge, HomebridgePlatform, IHomebridgeApi} from '../src/homebridge/framework';

export const MockLog = (...args) => console.log(...args);
MockLog.debug = MockLog;
MockLog.info = MockLog;
MockLog.warn = MockLog;
MockLog.error = MockLog;
MockLog.log = MockLog;

export class MockTionAuthStorage implements ITionAuthStorage {
    private auth: ITionAuthData;

    public save = jest.fn(async (authData: ITionAuthData) => {
        this.auth = authData;
    });

    public load = jest.fn(async () => {
        return this.auth;
    });
}

export class MockPlatformConfig implements ITionPlatformConfig {
    name: string;
    homeName: string;
    stationName?: string;
    co2Threshold: number;
    apiRequestTimeout: number;
    userName: string;
    password: string;
    percentSpeed: boolean;
    getStateDebounce: number;

    constructor() {
        this.homeName = 'Home';
        this.userName = 'test';
        this.password = 'test';
        this.co2Threshold = 799;
        this.apiRequestTimeout = 1001;
        this.percentSpeed = true;
        this.getStateDebounce = 5000;
    }
}

export class MockPlatformAccessory {
    private services: MockServiceBase[];
    private displayName: string;
    private UUID: string;

    constructor(displayName: string, uuid: string) {
        this.displayName = displayName;
        this.UUID = uuid;
        this.services = [];
        this.services.push(new AccessoryInformation(displayName));
    }

    addService(service: typeof MockServiceBase, name: string): MockServiceBase {
        const ret = new service(name);
        this.services.push(ret);
        return ret;
    }

    getService(sClass: typeof MockServiceBase): MockServiceBase | undefined {
        const ret = this.services.find(s => s instanceof sClass);
        if (!ret) {
            const firstService = this.services.find(s => !(s instanceof AccessoryInformation));
            console.log(`Accessory ${this.displayName} with main service ${firstService!.name} is being requested service ${sClass.toString().split(' ')[1]}, but none registered`);
        }
        return ret;
    }

    on = jest.fn((event: string, callback: () => {}) => {});
}

class MockServiceBase {
    name: string;
    characteristics: MockCharacteristicBase[];
    linkedServices: MockServiceBase[];

    constructor(name: string) {
        this.name = name;
        this.characteristics = [];
        this.linkedServices = [];
    }

    addCharacteristic(characteristic: typeof MockCharacteristicBase): MockServiceBase {
        this.characteristics.push(new characteristic(''));
        return this;
    }

    getCharacteristic(characteristic: typeof MockCharacteristicBase): MockCharacteristicBase {
        let ret = this.characteristics.find(ch => ch instanceof characteristic);
        if (!ret) {
            try {
                ret = new characteristic('');
                this.characteristics.push(ret);
            } catch (err) {
                console.log(characteristic);
                throw new Error(`No characteristic ${characteristic}`);
            }
        }
        return ret;
    }

    setCharacteristic(chClass: typeof MockCharacteristicBase, value: string | number): MockServiceBase {
        const ret = this.getCharacteristic(chClass);
        ret.value = value;
        return this;
    }

    updateCharacteristic(chClass: typeof MockCharacteristicBase, value: string | number): MockServiceBase {
        const ret = this.getCharacteristic(chClass);
        ret.value = value;
        return this;
    }

    addLinkedService(linkedService: MockServiceBase): void {
        this.linkedServices.push(linkedService);
    }
}

class AccessoryInformation extends MockServiceBase {}

class CarbonDioxideSensor extends MockServiceBase {}

class TemperatureSensor extends MockServiceBase {}

class HumiditySensor extends MockServiceBase {}

class AirPurifier extends MockServiceBase {}

class FilterMaintenance extends MockServiceBase {}

class HeaterCooler extends MockServiceBase {}

class Switch extends MockServiceBase {}

class MockCharacteristicBase {
    value: string | number;
    events: {};
    props: {};

    constructor(value: string | number) {
        this.value = value;
        this.events = {};
        this.props = {};
    }

    on(direction: 'get' | 'set', fn: any) {
        this.events[direction] = fn;
        return this;
    }

    setValue(value: string | number) {
        this.value = value;
    }

    setProps(props) {
        Object.assign(this.props, props);
        return this;
    }
}

class Manufacturer extends MockCharacteristicBase {}

class Model extends MockCharacteristicBase {}

class SerialNumber extends MockCharacteristicBase {}

class FirmwareRevision extends MockCharacteristicBase {}

class HardwareRevision extends MockCharacteristicBase {}

class CarbonDioxideLevel extends MockCharacteristicBase {}

class CarbonDioxideDetected extends MockCharacteristicBase {}

class CurrentTemperature extends MockCharacteristicBase {}

class CurrentRelativeHumidity extends MockCharacteristicBase {}

class Active extends MockCharacteristicBase {}

class StatusActive extends MockCharacteristicBase {}

class CurrentAirPurifierState extends MockCharacteristicBase {}

class TargetAirPurifierState extends MockCharacteristicBase {}

class RotationSpeed extends MockCharacteristicBase {}

class FilterChangeIndication extends MockCharacteristicBase {}

class FilterLifeLevel extends MockCharacteristicBase {}

class CurrentHeaterCoolerState extends MockCharacteristicBase {}

class TargetHeaterCoolerState extends MockCharacteristicBase {}

class HeatingThresholdTemperature extends MockCharacteristicBase {}

class On extends MockCharacteristicBase {}

export class MockHomebridge implements IHomebridge {
    public hap = {
        Service: {
            AccessoryInformation,
            CarbonDioxideSensor,
            TemperatureSensor,
            HumiditySensor,
            AirPurifier,
            FilterMaintenance,
            HeaterCooler,
            Switch,
        },
        Characteristic: {
            Manufacturer,
            Model,
            SerialNumber,
            FirmwareRevision,
            HardwareRevision,
            CarbonDioxideLevel,
            CarbonDioxideDetected,
            CurrentTemperature,
            CurrentRelativeHumidity,
            Active,
            StatusActive,
            CurrentAirPurifierState,
            TargetAirPurifierState,
            RotationSpeed,
            FilterChangeIndication,
            FilterLifeLevel,
            CurrentHeaterCoolerState,
            TargetHeaterCoolerState,
            HeatingThresholdTemperature,
            On,
        },
        uuid: {
            generate: (x: string) =>
                createHash('md5')
                    .update(x)
                    .digest('hex'),
        },
    };
    public user = {};

    public platformAccessory = MockPlatformAccessory;

    public registerPlatform = jest.fn(
        (identifier: string, name: string, platform: typeof HomebridgePlatform, dynamic: boolean) => {}
    );
}

export class MockHomebridgeApi implements IHomebridgeApi {
    private eventEmitter = new EventEmitter();

    public registerPlatformAccessories = jest.fn((identifier: string, name: string, accessories: any[]) => {});
    public unregisterPlatformAccessories = jest.fn((identifier: string, name: string, accessories: any[]) => {});

    public on(eventName: string, callback: () => void) {
        this.eventEmitter.on(eventName, callback);
    }

    public send(event: 'didFinishLaunching' | 'shutdown') {
        this.eventEmitter.emit(event);
    }

    public clear() {
        this.eventEmitter.removeAllListeners();
    }
}
