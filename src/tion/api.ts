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

    private stateRequest?: Promise<ILocation[]>;

    constructor(log: ILog, config: ITionPlatformConfig, authApi: ITionAuthApi) {
        this.log = log;
        this.config = config;
        this.authApi = authApi;
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
        let stateResult;
        try {
            stateResult = await this.stateRequest;
        } finally {
            if (firstRequest) {
                this.stateRequest = undefined;
            }
        }
        if (this.config.homeName) {
            const lower = this.config.homeName.toLowerCase();
            const location = stateResult.find(loc => loc.name.toLowerCase() === lower);
            if (location) {
                return location;
            } else {
                this.log.warn(`Location ${this.config.homeName} not found, using first appropriate`);
            }
        }
        return stateResult.find(loc => loc.zones.length) || stateResult[0];
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
            let attempts = 0;
            while (result.status !== 'completed' && attempts++ < 4) {
                switch (result.status) {
                    default:
                        this.log.error(`Unknown command status`);
                        this.log.error(result);
                        throw new Error('Status');
                        break;
                    case 'delivered':
                    case 'queued':
                        await new Promise(resolve => setTimeout(resolve, attempts * 100));
                        result = await this._internalRequest('get', `/task/${commandId}`, {json: true});
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

    private async _internalRequest(method: 'get' | 'post', endpoint: string, options: any = {}): Promise<any> {
        let accessToken = this.authApi.getAccessToken();
        let state: AuthState = accessToken ? AuthState.HasToken : AuthState.NoToken;
        let internalServerErrorAttempts = 0;
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
                            this.log.error('TionApi - token_expired: ', err.message || err.statusCode);
                            state = AuthState.TokenExpired;
                        } else if (err.statusCode === 500 && internalServerErrorAttempts++ < 2) {
                            this.log.error(`TionApi - got internal server error, retrying attempt ${internalServerErrorAttempts}:`, err.message || err.statusCode);
                            await new Promise(resolve => setTimeout(resolve, internalServerErrorAttempts * 500));
                        } else {
                            this.wrapError(err);
                            throw err;
                        }
                    }
                    break;

                case AuthState.NoToken:
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
}
