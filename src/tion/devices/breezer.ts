import {IHomebridgeAccessory, ILog} from 'homebridge/framework';
import {TionDeviceBase} from './base';
import {ILocation, IDevice} from 'tion/state';
import {ITionPlatformConfig} from 'platform_config';
import {ITionApi} from 'tion/api';

export class TionBreezer extends TionDeviceBase {
    public isOn: boolean;
    public currentSpeed: number;
    public speedLimit: number;

    public readonly isHeaterInstalled: boolean;
    public isHeaterOn: boolean;
    public targetTemperature: number;
    public currentTemperature: number;
    public outsideTemperature: number;

    public filterChangeIndication: boolean;
    public filterLifeLevel: number;

    public airIntake: number | undefined;

    private readonly maxSpeed: number;
    private readonly maxTargetTemperature: number;

    constructor(
        device: IDevice,
        log: ILog,
        config: ITionPlatformConfig,
        api: ITionApi,
        serviceRegistry: any,
        characteristicRegistry: any
    ) {
        super(device, log, config, api, serviceRegistry, characteristicRegistry);

        this.isHeaterInstalled = device.data.heater_installed || false;
        this.maxSpeed = device.max_speed || 0;
        this.maxTargetTemperature = device.t_max || 0;
    }

    public addEventHandlers(accessory: IHomebridgeAccessory): void {
        accessory.reachable = true;

        if (this.accessories.find(a => a.UUID === accessory.UUID)) {
            return;
        }

        this.accessories.push(accessory);

        const airPurifier = accessory.getService(this.serviceRegistry.AirPurifier);
        const filter = accessory.getService(this.serviceRegistry.FilterMaintenance);
        const heater = accessory.getService(this.serviceRegistry.HeaterCooler);
        if (airPurifier) {
            airPurifier
                .getCharacteristic(this.characteristicRegistry.Active)
                .on('get', callback => this.getState(callback, () => (this.isOn ? 1 : 0)))
                .on('set', async (value, callback) => {
                    try {
                        value = Boolean(value);
                        if (value !== this.isOn) {
                            await this.setState({
                                is_on: value,
                                speed: this.currentSpeed,
                                speed_min_set: 0,
                                speed_max_set: Math.min(this.speedLimit, this.maxSpeed),
                                heater_enabled: this.isHeaterOn,
                                t_set: this.targetTemperature,
                                gate: this.airIntake,
                            });
                        }
                        this.isOn = value;
                        airPurifier.setCharacteristic(
                            this.characteristicRegistry.CurrentAirPurifierState,
                            value ? 2 : 0
                        );
                        heater.updateCharacteristic(
                            this.characteristicRegistry.Active,
                            value ? this.isHeaterOn : false
                        );
                        callback();
                    } catch (err) {
                        callback(err.message || err);
                    }
                });

            airPurifier
                .getCharacteristic(this.characteristicRegistry.CurrentAirPurifierState)
                .on('get', callback => this.getState(callback, () => (this.isOn ? 2 : 0)));

            airPurifier
                .getCharacteristic(this.characteristicRegistry.TargetAirPurifierState)
                .setProps({
                    minValue: 0,
                    maxValue: 1,
                    validValues: [1],
                })
                .on('get', callback => this.getState(callback, () => 1));

            airPurifier
                .getCharacteristic(this.characteristicRegistry.RotationSpeed)
                .setProps({
                    minValue: 0,
                    maxValue: Math.min(this.maxSpeed),
                })
                .on('get', callback => this.getState(callback, () => this.currentSpeed))
                .on('set', async (value, callback) => {
                    try {
                        if (value && value !== this.currentSpeed) {
                            await this.setState({speed: value});
                        }
                        this.currentSpeed = value;
                        callback();
                    } catch (err) {
                        callback(err.message || err);
                    }
                });
        }

        if (filter) {
            filter
                .getCharacteristic(this.characteristicRegistry.FilterChangeIndication)
                .on('get', callback => this.getState(callback, () => this.filterChangeIndication));

            filter
                .getCharacteristic(this.characteristicRegistry.FilterLifeLevel, 0)
                .on('get', callback => this.getState(callback, () => this.filterLifeLevel));
        }

        if (heater) {
            heater
                .getCharacteristic(this.characteristicRegistry.Active)
                .on('get', callback => this.getState(callback, () => (this.isOn && this.isHeaterOn ? 1 : 0)))
                .on('set', async (value, callback) => {
                    try {
                        if (!this.isOn) {
                            return callback('Off');
                        }
                        value = Boolean(value);
                        if (value !== this.isHeaterOn) {
                            await this.setState({
                                is_on: true,
                                speed: this.currentSpeed,
                                speed_min_set: 0,
                                speed_max_set: Math.min(this.speedLimit, this.maxSpeed),
                                heater_enabled: value,
                                t_set: this.targetTemperature,
                                gate: this.airIntake,
                            });
                        }
                        this.isHeaterOn = Boolean(value);
                        callback();
                    } catch (err) {
                        callback(err.message || err);
                    }
                });

            heater
                .getCharacteristic(this.characteristicRegistry.CurrentHeaterCoolerState)
                .on('get', callback => this.getState(callback, () => (this.isOn && this.isHeaterOn ? 2 : 0)));

            heater
                .getCharacteristic(this.characteristicRegistry.TargetHeaterCoolerState)
                .setProps({
                    maxValue: 2,
                    minValue: 0,
                    validValues: [1],
                })
                .on('get', callback => this.getState(callback, () => 1));

            heater
                .getCharacteristic(this.characteristicRegistry.CurrentTemperature)
                .on('get', callback => this.getState(callback, () => this.currentTemperature));

            heater
                .getCharacteristic(this.characteristicRegistry.HeatingThresholdTemperature)
                .setProps({
                    minValue: 0,
                    maxValue: this.maxTargetTemperature,
                    minStep: 1,
                })
                .on('get', callback => this.getState(callback, () => this.targetTemperature))
                .on('set', async (value, callback) => {
                    try {
                        if (!this.isOn) {
                            return callback('Off');
                        }
                        if (value !== this.targetTemperature) {
                            await this.setState({
                                is_on: true,
                                speed: this.currentSpeed,
                                speed_min_set: 0,
                                speed_max_set: Math.min(this.speedLimit, this.maxSpeed),
                                heater_enabled: true,
                                t_set: value,
                                gate: this.airIntake,
                            });
                        }
                        this.targetTemperature = value;
                        callback();
                    } catch (err) {
                        callback(err.message || err);
                    }
                });
        }
    }

    public updateState(state: ILocation): void {
        const action = this.isCommandRunning ? 'updateCharacteristic' : 'setCharacteristic';

        this.parseState(state);

        this.accessories.forEach(accessory => {
            accessory.reachable = this.isOnline;

            const airPurifier = accessory.getService(this.serviceRegistry.AirPurifier);
            if (airPurifier) {
                airPurifier[action](this.characteristicRegistry.Active, this.isOn ? 1 : 0);

                airPurifier[action](this.characteristicRegistry.CurrentAirPurifierState, this.isOn ? 2 : 0);

                airPurifier[action](this.characteristicRegistry.TargetAirPurifierState, 1);

                airPurifier[action](this.characteristicRegistry.RotationSpeed, this.currentSpeed);
            }

            const filter = accessory.getService(this.serviceRegistry.FilterMaintenance);
            if (filter) {
                filter[action](this.characteristicRegistry.FilterChangeIndication, this.filterChangeIndication ? 1 : 0);

                filter[action](this.characteristicRegistry.FilterLifeLevel, this.filterLifeLevel);
            }

            const heater = accessory.getService(this.serviceRegistry.HeaterCooler);
            if (heater) {
                heater[action](this.characteristicRegistry.Active, this.isOn && this.isHeaterOn ? 1 : 0);

                heater[action](
                    this.characteristicRegistry.CurrentHeaterCoolerState,
                    this.isOn && this.isHeaterOn ? 2 : 0
                );

                heater[action](this.characteristicRegistry.TargetHeaterCoolerState, 1);

                heater[action](this.characteristicRegistry.CurrentTemperature, this.currentTemperature);

                heater[action](this.characteristicRegistry.HeatingThresholdTemperature, this.targetTemperature);
            }
        });
    }

    protected parseState(state: ILocation): boolean {
        const device: IDevice = this.findDeviceInState(state);
        if (!device) {
            return false;
        }

        this.isOnline = device.is_online;

        this.isOn = device.data.is_on || false;
        this.currentSpeed = device.data.speed || 0;
        this.speedLimit = device.data.speed_limit || 0;

        if (this.isHeaterInstalled) {
            this.isHeaterOn = device.data.heater_enabled || false;
            this.targetTemperature = device.data.t_set || 0;
            this.outsideTemperature = device.data.t_in || 0;
            this.currentTemperature = device.data.t_out || 0;
        }

        this.filterChangeIndication = device.data.filter_need_replace || false;
        this.filterLifeLevel = device.data.filter_time_seconds
            ? device.data.filter_time_seconds / (device.data.filter_time_seconds + (device.data.run_seconds || 0))
            : 0;

        this.airIntake = device.data.gate;

        return true;
    }
}