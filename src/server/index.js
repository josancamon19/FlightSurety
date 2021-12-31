var FlightSuretyApp = require('../../build/contracts/FlightSuretyApp.json');
var Config = require('./config.json');
var Web3 = require('web3');
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
    provider = new Web3.providers.WebsocketProvider(uri, {

    });
    // provider = new Web3.providers.HttpProvider(config.url);
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

    console.log(oracleIndex, airline, flight, timestamp);

    const statusAvailable = [0, 10, 20, 30, 40, 50];
    let statusCode = Math.floor(Math.random() * statusAvailable.length);

    try {
        await flightSuretyApp.methods.submitOracleResponse(
            oracleIndex,
            airline,
            flight,
            timestamp,
            statusCode
        ).send({
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
            await (new Promise(resolve => setTimeout(resolve, 1000)));
            for (let i = 0; i < oracles.length; i++) {
                submitOracleResponse(event.returnValues, oracles[i]);
            }
        }
    });

}

async function registerOracles() {
    let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
    console.log('Oracle registration Fee:', fee);
    for (let i = 0; i < accounts.length; i++) {
        if (oracles.length == 20) break;
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
        provider.disconnect();
    }
}

init();

const app = express();
app.get('/', (req, res) => {});

app.listen(3000, () => {});