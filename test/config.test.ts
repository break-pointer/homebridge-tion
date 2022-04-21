import {MockLog, MockPlatformConfig} from './mocks';
import { validate, sanitize } from '../src/platform_config';

describe('Test Platform Config', () => {

    test('Correct config should pass validation', () => {
        const config = new MockPlatformConfig();

        expect(validate(MockLog, config)).toBeTruthy();
        expect(sanitize(MockLog, config)).toEqual({
            name: 'Tion',
            homeName: 'Home',
            userName: 'test',
            password: 'test',
            co2Threshold: 799,
            apiRequestTimeout: 1001,
            percentSpeed: true,
            getStateDebounce: 5000
        });
    });

    test('Invalid config should not pass validation', () => {
        const config = new MockPlatformConfig();
        // @ts-expect-error The operand of a 'delete' operator must be optional.
        delete config.password;

        expect(validate(MockLog, config)).toBeFalsy();
    });

    test('Invalid config should be sanitized', () => {
        const config = new MockPlatformConfig();
        Object.assign(config, {
            name: 123,
            homeName: 123,
            userName: 123,
            password: 123,
            co2Threshold: -100,
            apiRequestTimeout: 0,
            percentSpeed: -1
        });

        expect(sanitize(MockLog, config)).toEqual({
            name: 'Tion',
            co2Threshold: 800,
            apiRequestTimeout: 1500,
            percentSpeed: false,
            getStateDebounce: 5000
        });
    });
});
