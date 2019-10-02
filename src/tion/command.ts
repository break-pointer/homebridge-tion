export interface ICommandResult {
    task_id: string;
    status: 'queued' | 'delivered' | 'completed';
    type: 'setDeviceMode';
    target_guid: string;
    user_guid: string;
    email: string;
}

export interface ICommand {
    is_on?: boolean;
    speed?: number;
    speed_min_set?: number;
    speed_max_set?: number;
    heater_enabled?: boolean;
    t_set?: number;
    gate?: number;
}
