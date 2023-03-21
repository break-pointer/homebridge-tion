export enum CommandStatus {
    Queued = 'queued',
    Delivered = 'delivered',
    Completed = 'completed',
}

export interface ICommandResult {
    task_id: string;
    status: CommandStatus;
    type: 'setDeviceMode';
    target_guid: string;
    user_guid: string;
    email: string;
}

export enum HeaterMode4S {
    On = 'heat',
    Off = 'maintenance',
}

export enum GateState {
    Inside3S = 0,
    Outside3S = 2,
    Inside4S = 1,
    Outside4S = 0,
}

export enum CommandType {
    Device = 'device',
    Zone = 'zone',
}

export interface IDeviceCommand {
    is_on: boolean;
    speed: number;
    speed_min_set: number;
    speed_max_set: number;
    heater_enabled?: boolean;
    heater_mode?: HeaterMode4S; // new in Tion 4S
    t_set?: number;
    gate?: GateState;
}

export enum ZoneMode {
    Auto = 'auto',
    Manual = 'manual',
}

export interface IZoneCommand {
    mode: ZoneMode;
    co2: number;
}
