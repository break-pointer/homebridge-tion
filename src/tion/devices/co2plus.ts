import {IHomebridgeAccessory} from 'homebridge/framework';
import {TionDeviceBase} from './base';
import {ILocation, IDevice} from 'tion/state';

export class TionCO2Plus extends TionDeviceBase {
    public co2Level: number = 0;
    public temperature: number = 0;
    public humidity: number = 0;

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
        });
    }

    protected parseState(state: ILocation): boolean {
        const device: IDevice = this.findDeviceInState(state);
        if (!device) {
            return false;
        }

        this.isOnline = device.is_online;
        this.co2Level = device.data?.co2 || 0;
        this.temperature = device.data?.temperature || 0;
        this.humidity = device.data?.humidity || 0;

        return true;
    }

    private carbonDioxideDetected(): 0 | 1 {
        return this.co2Level > this.config.co2Threshold ? 1 : 0;
    }
}
