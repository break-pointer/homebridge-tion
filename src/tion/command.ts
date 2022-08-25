export interface ICommandResult {
    task_id: string;
    status: 'queued' | 'delivered' | 'completed';
    type: 'setDeviceMode';
    target_guid: string;
    user_guid: string;
    email: string;
}

export interface IDeviceCommand {
    is_on: boolean;
    speed: number;
    speed_min_set: number;
    speed_max_set: number;
    heater_enabled?: boolean;
    heater_mode?: string; // new in Tion 4S
    heater_power?: number; // new in Tion 4S
    t_set?: number;
    gate?: GateState;
}

export interface IZoneCommand {
    mode: 'auto' | 'manual';
    co2: number;
}

export enum GateState {
    Inside = 0,
    Outside3S = 2,
    Outside4S = 1,
}
