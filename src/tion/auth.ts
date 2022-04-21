import fs from 'fs';
import path from 'path';
import url from 'url';
import fetch from 'node-fetch';

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

export class AuthError extends Error {
    public statusCode: number;
    constructor(message: string, statusCode: number) {
        const trueProto = new.target.prototype;
        super(message);
        Object.setPrototypeOf(this, trueProto);

        this.statusCode = statusCode;
    }
}

export class TionAuthApi implements ITionAuthApi {
    private static oAuthUrl = 'https://api2.magicair.tion.ru/idsrv/oauth2/token';
    private static clientId = 'a750d720-e146-47b0-b414-35e3b1dd7862';
    private static clientSecret = 'DTT2jJnY3k2H2GyZ';
    private static refreshClientId = '8b96527d-7632-4d56-bf75-3d1097e99d0e';
    private static refreshClientSecret = 'qwerty';

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
        this.log.debug('TionAuthApi - authenticating using password');
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
        this.log.debug('TionAuthApi - authenticating using refresh token');
        await this._internalAuthenticate({
            grant_type: 'refresh_token',
            refresh_token: this.myAuthData.refresh_token,
            client_id: TionAuthApi.clientId,
            client_secret: TionAuthApi.clientSecret,
        });
        await this.authStorage.save(this.myAuthData);

        return this.myAuthData.access_token;
    }

    private async _internalAuthenticate(params: ITionAuthPayload): Promise<void> {
        try {
            const authResult = await fetch(TionAuthApi.oAuthUrl, {
                method: 'POST',
                body: new url.URLSearchParams(params as any),
            });

            if (authResult.ok) {
                this.myAuthData = await authResult.json();
            } else {
                throw new AuthError(authResult.statusText, authResult.status);
            }
        } catch (err) {
            this.log.error('TionAuthApi._internalAuthenticate: ', err.message);
            this.log.debug('TionAuthApi._internalAuthenticate: ', err);
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
        if (!fs.existsSync(basePath)) {
            fs.mkdirSync(basePath, {recursive: true});
        }
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
