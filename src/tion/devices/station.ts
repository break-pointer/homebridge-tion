import {IHomebridgeAccessory} from 'homebridge/framework';
import {TionDeviceBase} from './base';
import {ILocation} from 'tion/state';
import {CommandType} from '../command';

export class TionMagicAirStation extends TionDeviceBase {
    public co2Level: number = 0;
    public temperature: number = 0;
    public humidity: number = 0;
    public backlight: boolean = false;

    public addEventHandlers(accessory: IHomebridgeAccessory): void {
        accessory.reachable = true;

        if (this.accessories.find(a => a.UUID === accessory.UUID)) {
            return;
        }

        this.accessories.push(accessory);

        const co2Sensor = accessory.getService(this.serviceRegistry.CarbonDioxideSensor);
        if (co2Sensor) {
            co2Sensor
                .getCharacteristic(this.characteristicRegistry.CarbonDioxideDetected)
                .on('get', callback => this.getState(callback, () => this.carbonDioxideDetected()));

            co2Sensor
                .getCharacteristic(this.characteristicRegistry.CarbonDioxideLevel)
                .on('get', callback => this.getState(callback, () => this.co2Level));
        }

        const temperatureSensor = accessory.getService(this.serviceRegistry.TemperatureSensor);
        if (temperatureSensor) {
            temperatureSensor
                .getCharacteristic(this.characteristicRegistry.CurrentTemperature)
                .on('get', callback => this.getState(callback, () => this.temperature));
        }

        const humiditySensor = accessory.getService(this.serviceRegistry.HumiditySensor);
        if (humiditySensor) {
            humiditySensor
                .getCharacteristic(this.characteristicRegistry.CurrentRelativeHumidity)
                .on('get', callback => this.getState(callback, () => this.humidity));
        }

        const backlightSwitch = accessory.getService(this.serviceRegistry.Switch);
        if (backlightSwitch) {
            backlightSwitch
                .getCharacteristic(this.characteristicRegistry.On)
                .on('get', callback => this.getState(callback, () => this.backlight))
                .on('set', async (value, callback) => {
                    try {
                        if (!this.isOnline) {
                            this.log.error(`Device ${this.name} (${this.id}) not reachable`);
                            return callback('Not reachable');
                        }
                        value = Boolean(value);
                        if (value !== this.backlight) {
                            await this.setState(CommandType.Settings, {
                                backlight: value ? 1 : 0,
                            });
                        }
                        this.backlight = value;
                        callback();
                    } catch (err) {
                        this.log.error(err.message || err);
                        callback(err.message || err);
                    }
                });
        }

    }

    public updateState(state: ILocation): void {
        this.parseState(state);

        this.accessories.forEach(accessory => {
            accessory.reachable = this.isOnline;

            const co2Sensor = accessory.getService(this.serviceRegistry.CarbonDioxideSensor);
            if (co2Sensor) {
                co2Sensor.setCharacteristic(
                    this.characteristicRegistry.CarbonDioxideDetected,
                    this.carbonDioxideDetected()
                );

                co2Sensor.setCharacteristic(this.characteristicRegistry.CarbonDioxideLevel, this.co2Level);
            }

            const temperatureSensor = accessory.getService(this.serviceRegistry.TemperatureSensor);
            if (temperatureSensor) {
                temperatureSensor.setCharacteristic(this.characteristicRegistry.CurrentTemperature, this.temperature);
            }

            const humiditySensor = accessory.getService(this.serviceRegistry.HumiditySensor);
            if (humiditySensor) {
                humiditySensor.setCharacteristic(this.characteristicRegistry.CurrentRelativeHumidity, this.humidity);
            }

            const backlightSwitch = accessory.getService(this.serviceRegistry.Switch);
            if (backlightSwitch) {
                backlightSwitch.setCharacteristic(this.characteristicRegistry.On, this.backlight);
            }
        });
    }

    protected parseState(state: ILocation): boolean {
        const {device} = this.findDeviceInState(state);
        if (!device) {
            return false;
        }

        this.isOnline = device.is_online;
        this.co2Level = device.data?.co2 || 0;
        this.temperature = device.data?.temperature || 0;
        this.humidity = device.data?.humidity || 0;
        this.backlight = Boolean(device.data?.backlight);

        return true;
    }

    private carbonDioxideDetected(): 0 | 1 {
        return this.co2Level > this.config.co2Threshold ? 1 : 0;
    }
}
