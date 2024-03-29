import fetch from 'node-fetch';

import {ILog} from 'homebridge/framework';

import {ITionAuthApi} from './auth';
import {ILocation} from './state';
import {ITionPlatformConfig} from 'platform_config';
import {
    CommandStatus,
    CommandTarget,
    CommandType,
    IBreezerCommand,
    ICommandResult,
    IStationCommand,
    IZoneCommand,
} from './command';

enum AuthState {
    NoToken = 'no_token',
    HasToken = 'has_token',
    TokenExpired = 'token_expired',
}

export interface ITionApi {
    init(): Promise<any>;
    getSystemState(): Promise<ILocation>;
    execDeviceCommand(
        commandType: CommandType,
        deviceId: string,
        payload: IBreezerCommand | IStationCommand
    ): Promise<ICommandResult>;
    execZoneCommand(zoneId: string, payload: IZoneCommand): Promise<ICommandResult>;
}

export class TionApi implements ITionApi {
    private static ApiBasePath = 'https://api2.magicair.tion.ru';

    private readonly log: ILog;

    private readonly authApi: ITionAuthApi;
    private readonly config: ITionPlatformConfig;

    private stateRequest?: Promise<ILocation[]>;
    private stateResult?: ILocation[];

    private lastStateRequestTimestamp: number;
    private lastCommandTimestamp: number;

    constructor(log: ILog, config: ITionPlatformConfig, authApi: ITionAuthApi) {
        this.log = log;
        this.config = config;
        this.authApi = authApi;
        this.lastStateRequestTimestamp = 0;
        this.lastCommandTimestamp = 0;
    }

    public async init(): Promise<any> {
        await this.authApi.init();
    }

    public async getSystemState(): Promise<ILocation> {
        // force last received state if it's not older than config.getStateDebounce
        // and there were no commands since it was received
        const now = Date.now();
        if (
            this.stateResult &&
            now < this.lastStateRequestTimestamp + this.config.getStateDebounce &&
            this.lastCommandTimestamp < this.lastStateRequestTimestamp
        ) {
            return this.parseStateResult(this.stateResult);
        }

        // debounce sequential state retrieval, while HTTP request is running
        let firstRequest = false;
        if (!this.stateRequest) {
            this.log.debug('Loading system state');
            this.lastStateRequestTimestamp = Date.now();
            this.stateRequest = this.apiRequest('get', '/location', {
                timeout: this.config.apiRequestTimeout,
            });
            firstRequest = true;
        }
        let stateResult: ILocation[] | undefined;
        try {
            stateResult = await this.stateRequest;
        } finally {
            if (firstRequest) {
                this.stateRequest = undefined;
                this.stateResult = stateResult;
            }
        }
        return this.parseStateResult(stateResult);
    }

    public async execDeviceCommand(
        commandType: CommandType,
        deviceId: string,
        payload: IBreezerCommand | IStationCommand
    ): Promise<ICommandResult> {
        return this.execCommandInternal(commandType, CommandTarget.Device, deviceId, payload);
    }

    public async execZoneCommand(zoneId: string, payload: IZoneCommand): Promise<ICommandResult> {
        return this.execCommandInternal(CommandType.Mode, CommandTarget.Zone, zoneId, payload);
    }

    private async execCommandInternal(
        type: CommandType,
        target: CommandTarget,
        targetId: string,
        payload: IBreezerCommand | IStationCommand | IZoneCommand
    ): Promise<ICommandResult> {
        this.log.debug(
            `TionApi.execCommand(type = ${type}, target: ${target}, targetId = ${targetId}, payload = ${JSON.stringify(
                payload
            )})`
        );
        this.lastCommandTimestamp = Date.now();
        try {
            let result: ICommandResult = await this.apiRequest('post', `/${target}/${targetId}/${type}`, {
                body: payload,
                timeout: this.config.apiRequestTimeout,
            });
            const commandId = result.task_id;
            this.log.debug(
                `TionApi.execCommand(objectId = ${targetId}, commandType: ${target}, result = ${JSON.stringify(
                    result
                )})`
            );
            let attempts = 0;
            while (result.status !== CommandStatus.Completed && attempts++ < 4) {
                switch (result.status) {
                    default:
                        this.log.error(`Unknown command status`);
                        this.log.error(result);
                        // noinspection ExceptionCaughtLocallyJS
                        throw new Error('Status');
                    case CommandStatus.Delivered:
                    case CommandStatus.Queued:
                        await new Promise(resolve => setTimeout(resolve, attempts * 100));
                        result = await this.apiRequest('get', `/task/${commandId}`, {
                            timeout: this.config.apiRequestTimeout,
                        });
                        this.log.debug(`TionApi.execCommand(result = ${JSON.stringify(result)})`);
                        break;
                }
            }
            return result;
        } catch (err) {
            this.log.error('Failed to execute command');
            this.wrapError(err);
            this.log.error(err);
            throw err;
        }
    }

    private wrapError(err: any) {
        if (err.response) {
            err.response = undefined;
        }
    }

    private async apiRequest(method: 'get' | 'post', endpoint: string, options: any): Promise<any> {
        let accessToken = this.authApi.getAccessToken();
        let state: AuthState = accessToken ? AuthState.HasToken : AuthState.NoToken;
        let internalServerErrorAttempts = 0;
        while (true) {
            switch (state) {
                case AuthState.HasToken:
                    this.log.debug('TionApi - has token');
                    try {
                        const headers = Object.assign({}, options.headers || {}, {
                            Authorization: `Bearer ${accessToken}`,
                        });
                        if (options.body !== undefined) {
                            headers['Content-Type'] = 'application/json';
                            options.body = JSON.stringify(options.body);
                        }
                        const result = await fetch(`${TionApi.ApiBasePath}${endpoint}`, {
                            ...options,
                            headers,
                            method: method.toUpperCase(),
                        });

                        if (result.ok) {
                            return result.json();
                        }

                        if (result.status === 401) {
                            this.log.error('TionApi - token_expired: ', result.statusText);
                            state = AuthState.TokenExpired;
                        } else if (result.status === 500 && internalServerErrorAttempts++ < 2) {
                            this.log.error(
                                `TionApi - got internal server error, retrying attempt ${internalServerErrorAttempts}:`,
                                result.statusText
                            );
                            await new Promise(resolve => setTimeout(resolve, internalServerErrorAttempts * 500));
                        } else {
                            let payload: Buffer | null = null;
                            try {
                                payload = await result.buffer();
                            } catch {
                                // relax lint
                            }
                            // noinspection ExceptionCaughtLocallyJS
                            throw new Error(
                                `TionApi - error ${result.status} ${result.statusText} ${payload?.toString()}`
                            );
                        }
                    } catch (err) {
                        if (
                            (err.code === 'ESOCKETTIMEDOUT' || err.type === 'request-timeout') &&
                            internalServerErrorAttempts++ < 2
                        ) {
                            this.log.error(
                                `TionApi - got timeout, retrying attempt ${internalServerErrorAttempts}:`,
                                err.message
                            );
                            await new Promise(resolve => setTimeout(resolve, internalServerErrorAttempts * 500));
                        } else {
                            this.wrapError(err);
                            throw err;
                        }
                    }
                    break;

                case AuthState.NoToken:
                    this.log.debug('TionApi - no token');

                    internalServerErrorAttempts = 0;
                    try {
                        accessToken = await this.authApi.authenticateUsingPassword();
                        state = AuthState.HasToken;
                    } catch (err) {
                        this.log.error('TionApi - no_token:', err.message || err.statusCode);
                        this.wrapError(err);
                        throw err;
                    }
                    break;

                case AuthState.TokenExpired:
                    this.log.debug('TionApi - token expired');

                    internalServerErrorAttempts = 0;
                    try {
                        accessToken = await this.authApi.authenticateUsingRefreshToken();
                        state = AuthState.HasToken;
                    } catch (err) {
                        this.log.error('TionApi - token_expired:', err.message || err.statusCode);
                        if (err.statusCode >= 400 && err.statusCode < 500) {
                            state = AuthState.NoToken;
                        } else {
                            this.wrapError(err);
                            throw err;
                        }
                    }
                    break;
            }
        }
    }

    private parseStateResult(stateResult: ILocation[]): ILocation {
        let ret: ILocation | undefined;
        if (this.config.homeName) {
            const lower = this.config.homeName.toLowerCase().trim();
            const location = stateResult.find(loc => loc.name.toLowerCase().trim() === lower);
            if (location) {
                ret = location;
            } else {
                this.log.warn(`Location ${this.config.homeName} not found, using first suitable`);
            }
        }
        if (!ret) {
            ret = stateResult.find(loc => loc.zones.length) || stateResult[0];
        }

        return ret!;
    }
}
