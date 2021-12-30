var FlightSuretyApp = require('../../build/contracts/FlightSuretyApp.json');
var Config = require('./config.json');
var Web3 = require('web3');
const Web3WsProvider = require('web3-providers-ws');
const express = require('express');


const {
    web
} = require('webpack');

let provider;
let web3;
let accounts;
let flightSuretyApp;

async function initWeb3() {
    let config = Config['localhost'];
    let uri = config.url.replace('http', 'ws');
    provider = new Web3WsProvider(uri, {
        clientConfig: {
            keepalive: false,
            keepaliveInterval: 6000
        }
    });

    web3 = new Web3(provider);
    accounts = await web3.eth.getAccounts();
    flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
}

const oracles = [];

async function submitOracleResponse(data, account) {
    const {
        oracleIndex,
        airline,
        flight,
        timestamp
    } = data;

    let statusCode = 20; // TODo: Randomize

    try {
        await flightSuretyApp.methods.submitOracleResponse(
            oracleIndex,
            airline,
            flight,
            timestamp,
            statusCode, {
                from: account
            });
    } catch (e) {
        console.log(e.reason);
    }
}

async function listenRequests() {
    flightSuretyApp.events.OracleRequest({}, function (error, event) {
        if (error) console.log(error)
        if (event) {
            setTimeout(1000, function () {
                for (let i = 0; i < oracles.length; i++) {
                    submitOracleResponse(event.returnValues, oracles[i]);
                }
            })
        }
    });

}

async function registerOracles() {
    let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
    console.log('Oracle registration Fee:', fee);
    for (let i = 0; i < accounts.length; i++) {
        try {
            await flightSuretyApp.methods.registerOracle().send({
                from: accounts[i],
                value: fee,
                gas: 3000000
            });
            oracles.push(accounts[i]);
            console.log(`Oracle ${i} registered.`);
        } catch (e) {
            // console.log(e);
        }
    }

    console.log(`Registered Oracles: ${oracles.length}`);
}

async function init() {
    try {
        await initWeb3();
        await registerOracles();
        listenRequests();
    } catch (e) {
        console.log(e);
        console.log(provider.clients)
        provider.disconnect();
    }
}

init();

const app = express();
app.get('/', (req, res) => {});

app.listen(3000, () => {});