import {IHomebridgePlatformConfig, ILog} from 'homebridge/framework';

export const PluginName = 'homebridge-tion';
export const PlatformName = 'Tion';

export interface ITionPlatformConfig extends IHomebridgePlatformConfig {
    name: string;
    stationName: string;
    userName: string;
    password: string;
    co2Threshold: number;

    [key: string]: number | string;
}

export function validate(log: ILog, config: ITionPlatformConfig): boolean {
    if (!config.userName || !config.password) {
        log.error('config has invalid credentials');
        return false;
    }

    return true;
}

export function sanitize(log: ILog, config: ITionPlatformConfig): ITionPlatformConfig {
    if (!config.name || typeof config.name !== 'string') {
        log.warn(`config.name has incompatible value, setting "Tion"`);
        Object.assign(config, {name: 'Tion'});
    }
    if ('stationName' in config && typeof config.stationName !== 'string') {
        log.warn(`config.stationName has incompatible value, removing`);
        delete config.stationName;
    }
    if ('userName' in config && typeof config.userName !== 'string') {
        log.warn(`config.userName has incompatible value, removing`);
        delete config.userName;
    }
    if ('password' in config && typeof config.password !== 'string') {
        log.warn(`config.password has incompatible value, removing`);
        delete config.password;
    }
    if ('co2Threshold' in config) {
        if (!Number.isInteger(config.co2Threshold) || config.co2Threshold < 0 || config.co2Threshold > 2500) {
            log.warn(`config.co2Threshold has incompatible value, setting 800`);
            Object.assign(config, {co2Threshold: 800});
        }
    } else {
        Object.assign(config, {co2Threshold: 800});
    }
    return config;
}