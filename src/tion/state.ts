export interface ILocation {
    guid: string;
    name: string;
    comment?: string;
    timezone: number;
    type: string;
    access_level: string;
    repository: string;
    mac: string;
    connection: IConnection;
    update: IUpdate;
    unique_key: string;
    replace_in_progress: boolean;
    struct_received: boolean;
    order: number;
    zones: IZone[];
    creation_time_iso: string;
    creation_time: number;
    update_time_iso: string;
    update_time: number;
}

export interface IConnection {
    state: string;
    is_online: boolean;
    last_seen_iso: string;
    last_seen: number;
    last_packet_time_iso: string;
    last_packet_time: number;
    data_state: string;
    last_seen_delta: number;
}

export interface IUpdate {
    state: string;
    device_type: string;
    mac: number;
    mac_human: string;
    progress: number;
}

export interface IZone {
    guid: string;
    name: string;
    type: string;
    color: string;
    is_virtual: boolean;
    mode: IMode;
    schedule: ISchedule;
    sensors_average: ISensorsAverage[];
    hw_id: number;
    devices: IDevice[];
    order: number;
    creation_time_iso: string;
    creation_time: number;
    update_time_iso: string;
    update_time: number;
}

export interface IDevice {
    guid: string;
    name: string;
    type: string;
    subtype_d: number;
    control_type: string;
    mac: string;
    mac_long: number;
    is_online: boolean;
    last_seen_delta: number;
    zone_hwid: number;
    serial_number: string;
    order: number;
    data: IDeviceData;
    firmware: string;
    hardware: string;
    creation_time: number;
    update_time: number;
    temperature_control?: string;
    max_speed?: number;
    t_max?: number;
    t_min?: number;
}

export interface IDeviceData {
    status: string;
    'wi-fi'?: number;
    pairing?: IPairing;
    co2?: number;
    temperature?: number;
    humidity?: number;
    pm25?: string;
    pm10?: string;
    signal_level: number;
    backlight?: number;
    reliability_code?: string;
    last_seen_iso?: string;
    last_seen?: number;
    measurement_time_iso: string;
    measurement_time: number;
    is_on?: boolean;
    data_valid?: boolean;
    heater_installed?: boolean;
    heater_enabled?: boolean;
    heater_type?: string; // new in Tion 4S
    heater_mode?: string; // new in Tion 4S
    heater_power?: number; // new in Tion 4S
    speed?: number;
    speed_m3h?: number;
    speed_max_set?: number;
    speed_min_set?: number;
    speed_limit?: number;
    t_in?: number;
    t_set?: number;
    t_out?: number;
    gate?: number;
    run_seconds?: number;
    filter_time_seconds?: number;
    rc_controlled?: boolean;
    filter_need_replace?: boolean;
    errors?: IErrors;
}

export interface IErrors {
    code: string;
    list: any[];
}

export interface IPairing {
    stage: string;
    time_left: number;
    pairing_result: boolean;
    mac: string;
    device_type: string;
    subtype: string;
    subtype_d: number;
}

export interface IMode {
    current: 'auto' | 'manual';
    auto_set: IAutoSet;
}

export interface IAutoSet {
    co2: number;
    temperature: number;
    humidity: number;
    noise: number;
    pm25: number;
    pm10: number;
}

export interface ISchedule {
    is_schedule_sync: boolean;
    is_active: boolean;
    is_mode_sync: boolean;
    current_preset: ICurrentPreset;
    next_preset_starts_at: number;
    next_starts_iso: string;
}

export interface ICurrentPreset {}

export interface ISensorsAverage {
    data_type: string;
    have_sensors: string[];
    data: ISensorsAverageData;
}

export interface ISensorsAverageData {
    co2: number | string;
    temperature: number | string;
    humidity: number | string;
    pm25: string;
    pm10: string;
    radon: number;
    measurement_time_iso: string;
    measurement_time: number;
}
