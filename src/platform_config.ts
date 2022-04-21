import {IHomebridgePlatformConfig, ILog} from 'homebridge/framework';

export const PluginName = 'homebridge-tion';
export const PlatformName = 'Tion';

export interface ITionPlatformConfig extends IHomebridgePlatformConfig {
    name: string;
    stationName?: string; // deprecated since 1.0.4
    homeName: string;
    userName: string;
    password: string;
    co2Threshold: number;
    apiRequestTimeout: number;
    percentSpeed: boolean;
    getStateDebounce: number;
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
    if (config.stationName) {
        if (!config.homeName) {
            config.homeName = config.stationName;
        }

        delete config.stationName;
    }
    if ('homeName' in config && typeof config.homeName !== 'string') {
        log.warn(`config.homeName has incompatible value, removing`);
        // @ts-expect-error The operand of a 'delete' operator must be optional.
        delete config.homeName;
    }
    if ('userName' in config && typeof config.userName !== 'string') {
        log.warn(`config.userName has incompatible value, removing`);
        // @ts-expect-error The operand of a 'delete' operator must be optional.
        delete config.userName;
    }
    if ('password' in config && typeof config.password !== 'string') {
        log.warn(`config.password has incompatible value, removing`);
        // @ts-expect-error The operand of a 'delete' operator must be optional.
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
    if ('apiRequestTimeout' in config) {
        if (
            !Number.isInteger(config.apiRequestTimeout) ||
            config.apiRequestTimeout < 1000 ||
            config.apiRequestTimeout > 30000
        ) {
            log.warn(`config.apiRequestTimeout has incompatible value, setting 1500`);
            Object.assign(config, {apiRequestTimeout: 1500});
        }
    } else {
        Object.assign(config, {apiRequestTimeout: 1500});
    }
    if ('percentSpeed' in config) {
        if (
            config.percentSpeed !== false &&
            config.percentSpeed !== true
        ) {
            log.warn(`config.percentSpeed has incompatible value, setting false`);
            Object.assign(config, {percentSpeed: false});
        }
    } else {
        Object.assign(config, {percentSpeed: false});
    }
    if ('getStateDebounce' in config) {
        if (
            !Number.isInteger(config.getStateDebounce) ||
            config.getStateDebounce < 1000 ||
            config.getStateDebounce > 30000
        ) {
            log.warn(`config.getStateDebounce has incompatible value, setting 5000`);
            Object.assign(config, {getStateDebounce: 5000});
        }
    } else {
        Object.assign(config, {getStateDebounce: 5000});
    }
    return config;
}
