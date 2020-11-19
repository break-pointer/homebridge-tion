const authTestData = require('./data/auth.json');
const locationTestData = require('./data/location.json');

const node_fetch = jest.genMockFromModule('node-fetch');

function auth(options) {
    return {
        ok: true,
        json: () => Promise.resolve(authTestData)
    };
}

function location(options) {
    return {
        ok: true,
        json: () => Promise.resolve(locationTestData)
    };
}

node_fetch.__initialize = () => {
}

node_fetch.default = (url, options) => {
    switch (url) {
        default: 
            throw new Error('Unknown url');
        case 'https://api2.magicair.tion.ru/idsrv/oauth2/token': 
            return auth(options);
        case 'https://api2.magicair.tion.ru/location':
            return location(options);
    }
}

module.exports = node_fetch;
