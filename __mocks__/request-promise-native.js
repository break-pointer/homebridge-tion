const locationTestData = require('./data/location.json');
const authTestData = require('./data/auth.json');

const request_promise_native = jest.genMockFromModule('request-promise-native');

function auth(options) {
    return authTestData;
}

function location(options) {
    return locationTestData;
}

request_promise_native.__initialize = () => {

}

request_promise_native.post = (url, options) => {
    switch (url) {
        default: 
            throw new Error('Unknown url');
        case 'https://api2.magicair.tion.ru/idsrv/oauth2/token': 
            return auth(options);
        break;
    }
}

request_promise_native.get = (url, options) => {
    switch (url) {
        default: 
            throw new Error('Unknown url');
        case 'https://api2.magicair.tion.ru/location':
            return location(options);
    }
}

module.exports = request_promise_native;
