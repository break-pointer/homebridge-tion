import {IHomebridgeAccessory, ILog} from 'homebridge/framework';
import {TionDeviceBase} from './base';
import {IDevice, IDeviceData, ILocation, IZone, Mode} from 'tion/state';
import {CommandType, GateState, HeaterMode4S, IBreezerCommand, ZoneMode} from 'tion/command';
import {ITionPlatformConfig} from 'platform_config';
import {ITionApi} from 'tion/api';
import {SupportedDeviceTypes} from './supported_device_types';

export class TionBreezer extends TionDeviceBase {
    public isOn: boolean;
    public isAuto: boolean;
    public currentSpeed: number;
    public currentSpeedHomekit: number;
    public speedLimit: number;

    public readonly isHeaterInstalled: boolean;
    public isHeaterOn: boolean;
    public targetTemperature: number;
    public currentTemperature: number;
    public outsideTemperature: number;

    public filterChangeIndication: boolean;
    public filterLifeLevel: number;

    public readonly isAirIntakeInstalled: boolean;
    public isAirIntakeOn: boolean;

    private maxSpeed: number;
    private maxTargetTemperature: number;

    private speedTick: number;

    private firstParse: boolean;

    constructor(
        device: IDevice,
        zone: IZone,
        log: ILog,
        config: ITionPlatformConfig,
        api: ITionApi,
        serviceRegistry: any,
        characteristicRegistry: any
    ) {
        super(device, zone, log, config, api, serviceRegistry, characteristicRegistry);

        this.isOn = false;
        this.currentSpeed = 0;
        this.currentSpeedHomekit = 0;
        this.speedLimit = device.max_speed || 0;
        this.maxSpeed = device.max_speed || 0;
        this.maxTargetTemperature = device.t_max || 0;

        this.speedTick = this.maxSpeed ? 1 / this.maxSpeed : 1;

        if (device.data.heater_installed !== undefined) {
            // o2 and 3s
            this.isHeaterInstalled = Boolean(device.data.heater_installed);
        } else if (device.data.heater_type !== undefined) {
            // 4s
            this.isHeaterInstalled = true;
        } else {
            log.warn(`Cannot determine heater state ${device.name} for device . Please contact plugin developer.`);
            log.warn(`Device debug data: ${JSON.stringify(device)}`);
            this.isHeaterInstalled = false;
        }

        this.isHeaterOn = false;
        this.targetTemperature = 22;
        this.currentTemperature = 22;
        this.outsideTemperature = 22;

        this.filterChangeIndication = false;
        this.filterLifeLevel = 1;

        this.isAirIntakeInstalled = [SupportedDeviceTypes.Breezer3S, SupportedDeviceTypes.Breezer4S].includes(
            this.modelName as any
        );
        this.isAirIntakeOn = false;

        this.firstParse = true;
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
        const outsideTemperature = accessory.getService(this.serviceRegistry.TemperatureSensor);
        const airIntakeSwitch = accessory.getService(this.serviceRegistry.Switch);
        if (airPurifier) {
            airPurifier
                .getCharacteristic(this.characteristicRegistry.Active)
                .on('get', callback => this.getState(callback, () => (this.isOn ? 1 : 0)))
                .on('set', async (value, callback) => {
                    try {
                        if (!this.isOnline) {
                            this.log.error(`Device ${this.name} (${this.id}) not reachable`);
                            return callback('Not reachable');
                        }
                        value = Boolean(value);
                        if (value !== this.isOn) {
                            if (this.isAuto) {
                                await this.setAutoMode(false);
                            }
                            await this.setState(CommandType.Mode, this.getCommandData(
                                value,
                                this.currentSpeed,
                                this.isHeaterOn,
                                this.targetTemperature,
                                this.isAirIntakeOn
                            ));
                        }
                        this.isOn = value;
                        airPurifier.setCharacteristic(
                            this.characteristicRegistry.CurrentAirPurifierState,
                            value ? 2 : 0
                        );
                        if (heater) {
                            heater.updateCharacteristic(
                                this.characteristicRegistry.Active,
                                value
                                    ? this.isAirIntakeOn
                                        ? 0
                                        : this.isHeaterOn
                                        ? 1
                                        : 0
                                    : 0
                            );
                        }
                        if (this.config.percentSpeed) {
                            if (value) {
                                this.currentSpeedHomekit = this.getHomekitSpeed(this.currentSpeed);
                                airPurifier.updateCharacteristic(
                                    this.characteristicRegistry.RotationSpeed,
                                    this.currentSpeedHomekit
                                );
                            }
                        }
                        if (airIntakeSwitch) {
                            airIntakeSwitch.updateCharacteristic(
                                this.characteristicRegistry.On,
                                value ? this.isAirIntakeOn : false
                            );
                        }
                        callback();
                    } catch (err) {
                        this.log.error(err.message || err);
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

            const rotationSpeedCharacteristic = airPurifier.getCharacteristic(
                this.characteristicRegistry.RotationSpeed
            );
            if (!this.config.percentSpeed) {
                rotationSpeedCharacteristic.setProps({
                    minValue: 0,
                    maxValue: this.maxSpeed,
                    minStep: 1,
                });
            }

            rotationSpeedCharacteristic
                .on('get', callback => this.getState(callback, () => this.currentSpeedHomekit))
                .on('set', async (homekitSpeed, callback) => {
                    try {
                        if (!this.isOnline) {
                            this.log.error(`Device ${this.name} (${this.id}) not reachable`);
                            return callback('Not reachable');
                        }
                        const tionSpeed = this.getTionSpeed(homekitSpeed);
                        if (tionSpeed && tionSpeed !== this.currentSpeed) {
                            if (this.isAuto) {
                                await this.setAutoMode(false);
                            }
                            await this.setState(CommandType.Mode, this.getCommandData(
                                this.isOn,
                                tionSpeed || 1,
                                this.isHeaterOn,
                                this.targetTemperature,
                                this.isAirIntakeOn
                            ));
                        }
                        this.currentSpeed = tionSpeed || 1;
                        this.currentSpeedHomekit = homekitSpeed;

                        callback();
                    } catch (err) {
                        this.log.error(err.message || err);
                        callback(err.message || err);
                    }
                });
        }

        if (filter) {
            filter
                .getCharacteristic(this.characteristicRegistry.FilterChangeIndication)
                .on('get', callback => this.getState(callback, () => this.filterChangeIndication));

            filter
                .getCharacteristic(this.characteristicRegistry.FilterLifeLevel)
                .on('get', callback => this.getState(callback, () => this.filterLifeLevel));
        }

        if (heater) {
            heater
                .getCharacteristic(this.characteristicRegistry.Active)
                .on('get', callback => this.getState(callback, () => (this.isOn && this.isHeaterOn ? 1 : 0)))
                .on('set', async (value, callback) => {
                    try {
                        if (!this.isOnline) {
                            this.log.error(`Device ${this.name} (${this.id}) not reachable`);
                            return callback('Not reachable');
                        }
                        if (!this.isOn || this.isAirIntakeOn) {
                            this.rollbackCharacteristic(heater, this.characteristicRegistry.Active, 0);
                            return callback();
                        }
                        value = Boolean(value);
                        if (value !== this.isHeaterOn) {
                            if (this.isAuto) {
                                await this.setAutoMode(false);
                            }
                            await this.setState(CommandType.Mode, this.getCommandData(
                                this.isOn,
                                this.currentSpeed,
                                value,
                                this.targetTemperature,
                                this.isAirIntakeOn
                            ));
                        }
                        this.isHeaterOn = value;
                        callback();
                    } catch (err) {
                        this.log.error(err.message || err);
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
                        if (!this.isOnline) {
                            this.log.error(`Device ${this.name} (${this.id}) not reachable`);
                            return callback('Not reachable');
                        }
                        if (!this.isOn || this.isAirIntakeOn) {
                            this.rollbackCharacteristic(
                                heater,
                                this.characteristicRegistry.HeatingThresholdTemperature,
                                this.targetTemperature
                            );
                            return callback();
                        }
                        if (value !== this.targetTemperature) {
                            if (this.isAuto) {
                                await this.setAutoMode(false);
                            }
                            await this.setState(CommandType.Mode, this.getCommandData(
                                this.isOn,
                                this.currentSpeed,
                                this.isHeaterOn,
                                value,
                                this.isAirIntakeOn
                            ));
                        }
                        this.targetTemperature = value;
                        callback();
                    } catch (err) {
                        this.log.error(err.message || err);
                        callback(err.message || err);
                    }
                });
        }

        if (outsideTemperature) {
            outsideTemperature
                .getCharacteristic(this.characteristicRegistry.StatusActive)
                .on('get', callback => this.getState(callback, () => (this.isOn ? 1 : 0)));

            outsideTemperature
                .getCharacteristic(this.characteristicRegistry.CurrentTemperature)
                .setProps({
                    minValue: -100,
                    maxValue: 100,
                })
                .on('get', callback => this.getState(callback, () => this.outsideTemperature));
        }

        if (airIntakeSwitch) {
            airIntakeSwitch
                .getCharacteristic(this.characteristicRegistry.On)
                .on('get', callback => this.getState(callback, () => this.isOn && this.isAirIntakeOn))
                .on('set', async (value, callback) => {
                    try {
                        if (!this.isOnline) {
                            this.log.error(`Device ${this.name} (${this.id}) not reachable`);
                            return callback('Not reachable');
                        }
                        if (!this.isOn) {
                            this.rollbackCharacteristic(airIntakeSwitch, this.characteristicRegistry.On, false);
                            return callback();
                        }
                        value = Boolean(value);
                        if (value !== this.isAirIntakeOn) {
                            if (this.isAuto) {
                                await this.setAutoMode(false);
                            }
                            await this.setState(CommandType.Mode, this.getCommandData(
                                this.isOn,
                                this.currentSpeed,
                                this.isHeaterOn,
                                this.targetTemperature,
                                value
                            ));
                        }
                        if (heater) {
                            heater.updateCharacteristic(
                                this.characteristicRegistry.Active,
                                value ? 0 : this.isHeaterOn ? 1 : 0
                            );
                        }
                        this.isAirIntakeOn = value;
                        callback();
                    } catch (err) {
                        this.log.error(err.message || err);
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

                airPurifier[action](this.characteristicRegistry.RotationSpeed, this.currentSpeedHomekit);
            }

            const filter = accessory.getService(this.serviceRegistry.FilterMaintenance);
            if (filter) {
                filter[action](this.characteristicRegistry.FilterChangeIndication, this.filterChangeIndication ? 1 : 0);

                filter[action](this.characteristicRegistry.FilterLifeLevel, this.filterLifeLevel);
            }

            const heater = accessory.getService(this.serviceRegistry.HeaterCooler);
            if (heater) {
                heater[action](
                    this.characteristicRegistry.Active,
                    this.isAirIntakeOn
                        ? 0
                        : this.isOn && this.isHeaterOn
                        ? 1
                        : 0
                );

                heater[action](
                    this.characteristicRegistry.CurrentHeaterCoolerState,
                    this.isAirIntakeOn
                        ? 0
                        : this.isOn && this.isHeaterOn
                        ? 2
                        : 0
                );

                heater[action](this.characteristicRegistry.TargetHeaterCoolerState, 1);

                heater[action](this.characteristicRegistry.CurrentTemperature, this.currentTemperature);

                heater[action](this.characteristicRegistry.HeatingThresholdTemperature, this.targetTemperature);
            }

            const outsideTemperature = accessory.getService(this.serviceRegistry.TemperatureSensor);
            if (outsideTemperature) {
                outsideTemperature[action](this.characteristicRegistry.StatusActive, this.isOn ? 1 : 0);
                outsideTemperature[action](this.characteristicRegistry.CurrentTemperature, this.outsideTemperature);
            }

            const airIntakeAccessory = accessory.getService(this.serviceRegistry.Switch);
            if (airIntakeAccessory) {
                airIntakeAccessory[action](
                    this.characteristicRegistry.On,
                    this.isOn && this.isAirIntakeOn
                );
            }
        });
    }

    protected parseState(state: ILocation): boolean {
        const {device, zone} = this.findDeviceInState(state);
        if (!device) {
            return false;
        }

        this.isOnline = device.is_online;

        this.isOn = device.data.is_on || false;
        this.speedLimit = device.data.speed_limit || this.maxSpeed;
        this.maxSpeed = device.max_speed || 0;
        this.maxTargetTemperature = device.t_max || 0;
        this.speedTick = this.maxSpeed ? 1 / this.maxSpeed : 1;

        const newCurrentSpeed = device.data.speed || 1;
        if (newCurrentSpeed !== this.currentSpeed) {
            this.currentSpeedHomekit = this.getHomekitSpeed(newCurrentSpeed);
        }
        this.currentSpeed = newCurrentSpeed;

        if (this.isHeaterInstalled) {
            this.isHeaterOn = this.getHomekitHeaterIsOn(device.data);
            this.targetTemperature = device.data.t_set || 0;
            this.currentTemperature = device.data.t_out || 0;
        }

        if (this.isOn && !this.firstParse) {
            this.outsideTemperature = device.data.t_in || 0;
        }

        this.filterChangeIndication = device.data.filter_need_replace || false;
        this.filterLifeLevel = device.data.filter_time_seconds
            ? device.data.filter_time_seconds / (device.data.filter_time_seconds + (device.data.run_seconds || 0))
            : 0;

        // noinspection SuspiciousTypeOfGuard
        if (device.data.gate !== undefined && typeof device.data.gate === 'number') {
            this.isAirIntakeOn = this.getHomekitAirIntakeIsOn(device.data.gate);
        }

        this.isAuto = zone!.mode?.current === Mode.Auto;

        this.firstParse = false;

        return true;
    }

    private getHomekitSpeed(tionSpeed: number): number {
        if (this.config.percentSpeed) {
            return Math.trunc(this.speedTick * tionSpeed * 100);
        } else {
            return tionSpeed;
        }
    }

    private getTionSpeed(homekitSpeed): number {
        if (this.config.percentSpeed) {
            return Math.ceil(homekitSpeed / 100 / this.speedTick);
        } else {
            return homekitSpeed;
        }
    }

    private getTionAirIntakeData(isOn: boolean): any {
        switch (this.modelName) {
            default:
                return {};
            case SupportedDeviceTypes.Breezer3S:
                return {
                    gate: isOn ? GateState.Inside3S : GateState.Outside3S,
                };
            case SupportedDeviceTypes.Breezer4S:
                return {
                    gate: isOn ? GateState.Inside4S : GateState.Outside4S,
                };
        }
    }

    private getHomekitAirIntakeIsOn(gateState: GateState): boolean {
        switch (this.modelName) {
            default:
                return false;
            case SupportedDeviceTypes.Breezer3S:
                return gateState !== GateState.Outside3S; // has intermediate state, treat it as on
            case SupportedDeviceTypes.Breezer4S:
                return gateState === GateState.Inside4S;
        }
    }

    private getTionHeaterData(isHeaterOn: boolean, temperature: number): any {
        if (!this.isHeaterInstalled) {
            return {};
        }
        if (this.modelName === SupportedDeviceTypes.Breezer4S) {
            return  {
                heater_mode: isHeaterOn ? HeaterMode4S.On : HeaterMode4S.Off,
                t_set: temperature,
            };
        } else {
            return  {
                heater_enabled: isHeaterOn,
                t_set: temperature,
            };
        }
    }

    private getHomekitHeaterIsOn(device: IDeviceData): boolean {
        if (!this.isHeaterInstalled) {
            return false;
        }
        switch (this.modelName) {
            default:
                return !!device.heater_enabled;
            case SupportedDeviceTypes.Breezer4S:
                return device.heater_mode === HeaterMode4S.On;
        }
    }

    private getCommandData(
        isOn: boolean,
        speed: number,
        isHeaterOn: boolean,
        temperature: number,
        isAirIntakeOn: boolean
    ): IBreezerCommand {
        const heaterData = this.getTionHeaterData(isHeaterOn, temperature);
        const airIntakeData = this.getTionAirIntakeData(isAirIntakeOn);

        return {
            is_on: isOn,
            speed,
            speed_min_set: 0,
            speed_max_set: Math.min(this.speedLimit, this.maxSpeed),
            ...heaterData,
            ...airIntakeData,
        };
    }

    private async setAutoMode(isAuto: boolean): Promise<void> {
        await this.api.execZoneCommand(this.zoneId, {
            mode: isAuto ? ZoneMode.Auto : ZoneMode.Manual,
            co2: this.config.co2Threshold,
        });
        this.isAuto = isAuto;
    }
}
