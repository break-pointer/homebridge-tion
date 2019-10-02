export type UuidGen = (...messages: any) => void;

export interface IHomebridge {
    hap: {
        Service: any;
        Characteristic: any;
        uuid: any;
    };
    user: any;
    platformAccessory: any;
    registerPlatform: (identifier: string, name: string, platform: typeof HomebridgePlatform, dynamic: boolean) => void;
}

export interface IHomebridgeAccessory {
    UUID: string;
    on: (event: string, eventHandler: any) => any;
    addCharacteristic: (characteristic: any) => any;
    getCharacteristic: (characteristic: any) => any;
    setCharacteristic: (characteristic: any, value: any) => any;
    updateCharacteristic: (characteristic: any, value: any) => any;
    addService: (service: any, name: string) => any;
    getService: (service: any) => any;
    setPower: (on: boolean) => any;
    reachable: boolean;
    displayName: string;
    context: {
        id: string;
    };
}

type LogFunction = (...messages: any) => void;
export interface ILog {
    readonly debug: LogFunction;
    readonly info: LogFunction;
    readonly warn: LogFunction;
    readonly error: LogFunction;
    readonly log: LogFunction;
    (...messages: any): void;
}

export interface IHomebridgeApi {
    registerPlatformAccessories: (identifier: string, name: string, accessories: any[]) => void;
    unregisterPlatformAccessories: (identifier: string, name: string, accessories: any[]) => void;
    on: (eventName: string, callback: () => void) => void;
}

export interface IHomebridgePlatformConfig {}

export abstract class HomebridgePlatform {
    public abstract configureAccessory: (accessory: IHomebridgeAccessory) => void;

    protected readonly log: ILog;
    protected readonly config: IHomebridgePlatformConfig;
    protected readonly hbApi: IHomebridgeApi;

    constructor(log: ILog, config: IHomebridgePlatformConfig, hbApi: IHomebridgeApi) {
        this.log = log;
        this.config = config;
        this.hbApi = hbApi;
    }
}
