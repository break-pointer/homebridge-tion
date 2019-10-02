import request from 'request-promise-native';

import {ILog} from 'homebridge/framework';

import {ITionAuthApi} from './auth';
import {ILocation} from './state';
import {ITionPlatformConfig} from 'platform_config';
import {ICommand, ICommandResult} from './command';

enum AuthState {
    NoToken = 'no_token',
    HasToken = 'has_token',
    TokenExpired = 'token_expired',
}

export interface ITionApi {
    init(): Promise<any>;
    getSystemState(): Promise<ILocation>;
    execCommand(deviceId: string, payload: ICommand): Promise<ICommandResult>;
}

export class TionApi implements ITionApi {
    private static ApiBasePath = 'https://api2.magicair.tion.ru';

    private readonly log: ILog;

    private readonly authApi: ITionAuthApi;
    private readonly config: ITionPlatformConfig;

    private stateRequest: Promise<ILocation[]> | null;

    constructor(log: ILog, config: ITionPlatformConfig, authApi: ITionAuthApi) {
        this.log = log;
        this.config = config;
        this.authApi = authApi;

        this.stateRequest = null;
    }

    public async init(): Promise<any> {
        await this.authApi.init();
    }

    public async getSystemState(): Promise<ILocation> {
        let firstRequest = false;
        if (!this.stateRequest) {
            this.log.debug('Loading system state');
            this.stateRequest = this._internalRequest('get', '/location', {json: true});
            firstRequest = true;
        }
        const ret = await this.stateRequest;
        if (firstRequest) {
            this.stateRequest = null;
        }
        if (this.config.stationName) {
            const lower = this.config.stationName.toLowerCase();
            const location = ret.find(loc => loc.name.toLowerCase() === lower);
            if (location) {
                return location;
            } else {
                this.log.warn(`Location ${this.config.stationName} not found`);
            }
        }
        return ret[0];
    }

    public async execCommand(deviceId: string, payload: ICommand): Promise<ICommandResult> {
        this.log.debug(`TionApi.execCommand(deviceId = ${deviceId}, payload = ${JSON.stringify(payload)})`);
        try {
            let result: ICommandResult = await this._internalRequest(
                'post', 
                `/device/${deviceId}/mode`, 
                {body: payload, json: true}
            );
            const commandId = result.task_id;
            this.log.debug(`TionApi.execCommand(commandId = ${commandId}, result = ${JSON.stringify(result)})`);
            while (result.status !== 'completed') {
                switch (result.status) {
                    default:
                        this.log.error(`Unknown command status`);
                        this.log.error(result);
                        throw new Error('Status');
                        break;
                    case 'delivered':
                    case 'queued':
                        // await new Promise((resolve) => setTimeout(resolve, 250));
                        result = await this._internalRequest('get', `/task/${commandId}`, {json: true});
                        this.log.debug(`TionApi.execCommand(result = ${JSON.stringify(result)})`);
                        break;
                }
            }
            return result;
        } catch (err) {
            this.log.error('Failed to execte command');
            this.log.error(err);
            throw err;
        }
    }

    private async _internalRequest(method: 'get' | 'post', endpoint: string, options: any = {}): Promise<any> {
        let accessToken = this.authApi.getAccessToken();
        let state: AuthState = accessToken ? AuthState.HasToken : AuthState.NoToken;
        while (true) {
            switch (state) {
                case AuthState.HasToken:
                    try {
                        const headers = Object.assign({}, options.headers || {}, {
                            Authorization: `Bearer ${accessToken}`,
                        });
                        const result = await request[method](`${TionApi.ApiBasePath}${endpoint}`, {
                            ...options,
                            headers,
                        });
                        return result;
                    } catch (err) {
                        if (err.statusCode === 401) {
                            this.log.error('TionApi  token_expired:', err.message || err.statusCode);
                            state = AuthState.TokenExpired;
                        } else {
                            throw err;
                        }
                    }
                    break;

                case AuthState.NoToken:
                    try {
                        accessToken = await this.authApi.authenticateUsingPassword();
                        state = AuthState.HasToken;
                    } catch (err) {
                        this.log.error('TionApi - no_token:', err.message || err.statusCode);
                        throw err;
                    }
                    break;

                case AuthState.TokenExpired:
                    try {
                        accessToken = await this.authApi.authenticateUsingRefreshToken();
                        state = AuthState.HasToken;
                    } catch (err) {
                        this.log.error('TionApi - token_expired:', err.message || err.statusCode);
                        if (err.statusCode >= 400 && err.statusCode < 500) {
                            state = AuthState.NoToken;
                        } else {
                            throw err;
                        }
                    }
                    break;
            }
        }
    }
}
