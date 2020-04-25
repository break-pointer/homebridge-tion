import fs from 'fs';
import path from 'path';
import request from 'request-promise-native';

import {ILog} from 'homebridge/framework';
import {ITionPlatformConfig} from '../platform_config';

export interface ITionAuthData {
    access_token: string;
    expires_in: number;
    token_type: string;
    refresh_token: string;
    username: string;
    user_guid: string;
    client_id: string;
    '.issued': string;
    '.expires': string;
}

interface ITionAuthPayload {
    grant_type: 'password' | 'refresh_token';
    username?: string;
    password?: string;
    refresh_token?: string;
    client_id: string;
    client_secret: string;
}

export interface ITionAuthApi {
    init(): Promise<void>;
    getAccessToken(): string;
    authenticateUsingPassword(): Promise<string>;
    authenticateUsingRefreshToken(): Promise<string>;
}

export interface ITionAuthStorage {
    save(authData: ITionAuthData): Promise<void>;
    load(): Promise<ITionAuthData>;
}

export class TionAuthApi implements ITionAuthApi {
    private static oAuthUrl = 'https://api2.magicair.tion.ru/idsrv/oauth2/token';
    private static clientId = 'a750d720-e146-47b0-b414-35e3b1dd7862';
    private static clientSecret = 'DTT2jJnY3k2H2GyZ';

    private log: ILog;
    private config: ITionPlatformConfig;
    private myAuthData: ITionAuthData;
    private authStorage: ITionAuthStorage;

    constructor(log: ILog, config: ITionPlatformConfig, storage: ITionAuthStorage) {
        this.log = log;
        this.config = config;
        this.authStorage = storage;
    }

    public async init(): Promise<void> {
        try {
            this.myAuthData = await this.authStorage.load();
        } catch (err) {
            err = null; // relax lint
        }
    }

    public getAccessToken(): string {
        return this.myAuthData && this.myAuthData.access_token;
    }

    public async authenticateUsingPassword(): Promise<string> {
        await this._internalAuthenticate({
            grant_type: 'password',
            username: this.config.userName,
            password: this.config.password,
            client_id: TionAuthApi.clientId,
            client_secret: TionAuthApi.clientSecret,
        });
        await this.authStorage.save(this.myAuthData);

        return this.myAuthData && this.myAuthData.access_token;
    }

    public async authenticateUsingRefreshToken(): Promise<string> {
        await this._internalAuthenticate({
            grant_type: 'refresh_token',
            refresh_token: this.myAuthData.refresh_token,
            client_id: TionAuthApi.clientId,
            client_secret: TionAuthApi.clientSecret,
        });

        return this.myAuthData.access_token;
    }

    private async _internalAuthenticate(params: ITionAuthPayload): Promise<void> {
        try {
            this.myAuthData = await request.post(TionAuthApi.oAuthUrl, {form: params, json: true});
        } catch (err) {
            this.log.error('TionAuthApi._internalAuthenticate: ', err.message || err.statusCode);
            throw err;
        }
    }
}

export class TionFilesystemAuthStorage implements ITionAuthStorage {
    private basePath: string;
    private log: ILog;

    constructor(log: ILog, basePath: string) {
        this.log = log;
        this.basePath = basePath;
    }

    public async save(authData: ITionAuthData): Promise<void> {
        fs.writeFileSync(this.getStatePath(), JSON.stringify(authData, null, 4), {encoding: 'utf8'});
        this.log.debug('Auth tokens persisted');
    }

    public async load(): Promise<ITionAuthData> {
        try {
            const text = fs.readFileSync(this.getStatePath(), {encoding: 'utf8'});
            const ret = JSON.parse(text);
            this.log.debug('Got persisted auth tokens');
            return ret;
        } catch (err) {
            this.log.debug('Auth tokens not persisted');
            throw err;
        }
    }

    private getStatePath(): string {
        return path.join(this.basePath, 'homebridge-tion.auth.json');
    }
}
