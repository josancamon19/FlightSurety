import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        this.config = Config[network];
        this.initialize(callback);

        this.owner = null;
        this.airlines = [];
        this.passengers = [];
    }

    async initialize(callback) {
        if (window.ethereum) {
            this.web3 = window.ethereum;
            try {
                // Request account access
                await window.ethereum.enable();
            } catch (error) {
                // User denied account access...
                console.error("User denied account access")
            }
        }
        // Legacy dapp browsers...
        else if (window.web3) {
            this.web3 = window.web3.currentProvider;
        }
        // If no injected web3 instance is detected, fall back to Ganache
        else {
            this.web3 = new Web3.providers.HttpProvider('http://localhost:7545');
        }
        this.web3 = new Web3(this.web3);

        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, this.config.appAddress);
        this.getAccounts();
        callback();
    }

    getAccounts() {

        let self = this;
        // Retrieving accounts
        self.web3.eth.getAccounts(function (err, res) {
            if (err) {
                console.log('Error:', err);
                return;
            }
            self.owner = res[0];
        })
    }

    async isPaused(callback) {
        let self = this;
        let isPaused = await self.flightSuretyApp.methods.isPaused().call(callback);
    }

    fetchFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: Math.floor(Date.now() / 1000)
        }
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({
                from: self.owner
            }, (error, result) => {
                callback(error, payload);
            });
    }
}