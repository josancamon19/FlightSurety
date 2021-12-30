import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        this.config = Config[network];
        this.account = null;

        this.initialize(callback);
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
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, this.config.dataAddress);
        await this.getAccounts();

        callback();
    }

    async getAccounts() {
        // Only loads the selected account (1)
        let res = await this.web3.eth.getAccounts();
        this.account = res[0];
    }

    async listenEvents(callback) {
        let self = this;
        this.flightSuretyData.events.NewAirlineStatus().on('data', function (event) {
            let data = event.returnValues;
            callback(`Airline ${data.airline} new status found = ${self.mapAirlineStatus(data.status)}`);
        });
        this.flightSuretyData.events.NewFlightRegistered().on('data', function (event) {
            let data = event.returnValues;
            callback(`Airline ${data.airline} registered flight ${data.flightKey}`);
        });
        this.flightSuretyData.events.FlightStatusCodeFound().on('data', function (event) {
            let data = event.returnValues;
            callback(`New code found for - Airline ${data.airline} - Flight ${data.flightKey} = ${self.mapFlightStatus(data.status)}`);
        });
        this.flightSuretyData.events.NewInsuredFlight().on('data', function (event) {
            let data = event.returnValues;
            callback(`Passenger ${data.passenger} insured ${self.web3.utils.fromWei(data.insuredAmount, "ether")} ETH for flight ${data.flightKey}`);
        });
        this.flightSuretyData.events.AirlineFlightArrivedOnTime().on('data', function (event) {
            let data = event.returnValues;
            callback(`Airline ${data.airline} arrived ON TIME for flight ${data.flightKey}`);
        });
        this.flightSuretyData.events.AirlinePaysInsurance().on('data', function (event) {
            let data = event.returnValues;
            callback(`Airline ${data.airline} arrived LATE for flight ${data.flightKey} and is insuring passenger ${data.passenger} the amount of ${data.amount}`);
        });
        this.flightSuretyData.events.PassengerGetsInsuredMoney().on('data', function (event) {
            let data = event.returnValues;
            callback(`Passenger ${data.passenger} withdrawed ${self.web3.utils.fromWei(data.amount, "ether")} ETH from insured funds`);
        });
    }


    /**
     * UTILS OPERATIONS
     */

    async isPaused(callback) {
        await this.flightSuretyApp.methods.isPaused().call((err, res) => {
            callback(this.formatErrorMessage(err), res);
        });
    }

    /**
     * AIRLINE OPERATIONS
     */

    async registerAirline(airline, callback) {
        await this.flightSuretyApp.methods.registerAirline(airline).send({
            from: this.account
        }, (err, res) => {
            callback(this.formatErrorMessage(err), res);
        });
    }

    async airlineDeposit(ethAmount, callback) {
        let weiAmount = this.web3.utils.toWei(ethAmount.toString(), "ether");
        await this.flightSuretyApp.methods.airlineDepositsFunds().send({
            from: this.account,
            value: weiAmount
        }, (err, res) => {
            callback(this.formatErrorMessage(err), res);
        });
    }

    async registerFlight(flight, timestamp, callback) {
        await this.flightSuretyApp.methods.registerFlight(flight, timestamp).send({
            from: this.account
        }, (err, res) => {
            callback(this.formatErrorMessage(err), res);
        });
    }

    /**
     * PASSENGER OPERATIONS
     */

    async buyInsurance(airline, flight, timestamp, insuranceValue, callback) {
        let weiAmount = this.web3.utils.toWei(insuranceValue.toString(), "ether");
        await this.flightSuretyApp.methods.buyInsurance(airline, flight, timestamp).send({
            from: this.account,
            value: weiAmount
        }, (err, res) => {
            callback(this.formatErrorMessage(err), res);
        });
    }

    async claimInsuredMoney(callback) {
        await this.flightSuretyApp.methods.passengerClaimsInsuredMoney().send({
            from: this.account,
        }, (err, res) => {
            callback(this.formatErrorMessage(err), res);
        });
    }

    /**
     * SHARED OPERATIONS
     */

    async getFlightDetails(airline, flight, timestamp, callback) {
        await this.flightSuretyData.methods.getFlightDetails(airline, flight, timestamp).call({
            from: this.account
        }, (err, res) => {
            callback(this.formatErrorMessage(err), res);
        });
    }

    fetchFlightStatus(airline, flight, timestamp, callback) {
        this.flightSuretyApp.methods
            .fetchFlightStatus(airline, flight, timestamp)
            .send({
                from: this.account
            }, (err, res) => {
                callback(this.formatErrorMessage(err), res);
            });
    }
    /**
     * OTHERS
     */
    mapAirlineStatus(statusInt) {
        let status;
        switch (parseInt(statusInt)) {
            case 0:
                status = 'NOT APPROVED';
                break;
            case 1:
                status = 'APPROVED';
                break;
            case 2:
                status = 'PARTICIPATING';
                break;

        }
        return status;
    }

    mapFlightStatus(statusInt) {
        let status;
        switch (parseInt(statusInt)) {
            case 0:
                status = 'UNKNOWN';
                break;
            case 1:
                status = 'ON TIME';
                break;
            case 2:
                status = 'AIRLINE IS LATE';
                break;

        }
        return status;
    }

    formatErrorMessage(err) {
        if (err != null) {
            var errorMessageInJson = JSON.parse(
                err.message.slice(58, err.message.length - 2)
            );

            var errorMessageToShow = errorMessageInJson.data.data[Object.keys(errorMessageInJson.data.data)[0]].reason;
            console.log(`Error: ${errorMessageToShow}`);
            return errorMessageToShow;
        }
        return null;
    }
}