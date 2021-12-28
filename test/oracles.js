var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Oracles', async (accounts) => {

    const TEST_ORACLES_COUNT = 10;
    var config;
    var oracleIndex;

    const passengerInsurance = web3.utils.toWei("1", "ether");

    async function testSetup() {
        await config.flightSuretyApp.registerAirline(accounts[1]);
        await config.flightSuretyApp.airlineDepositsFunds({
            from: accounts[1],
            value: web3.utils.toWei("10", "ether")
        });
        await config.flightSuretyApp.registerFlight(
            config.flights[0].flight,
            config.flights[0].timestamp, {
                from: accounts[1]
            }
        );
        await config.flightSuretyApp.buyInsurance(
            accounts[1],
            config.flights[0].flight,
            config.flights[0].timestamp, {
                from: accounts[6],
                value: passengerInsurance
            }
        );
        await config.flightSuretyApp.registerFlight(
            config.flights[1].flight,
            config.flights[1].timestamp, {
                from: accounts[1]
            }
        );
        await config.flightSuretyApp.buyInsurance(
            accounts[1],
            config.flights[1].flight,
            config.flights[1].timestamp, {
                from: accounts[6],
                value: passengerInsurance
            }
        );
    }

    beforeEach('setup contract', async () => {
        if (config == null) {
            config = await Test.Config(accounts);
            await testSetup();
        }
        // Watch contract events
    });
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;


    it('can register oracles', async () => {

        // ARRANGE
        let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

        // ACT
        for (let a = 0; a < TEST_ORACLES_COUNT; a++) {
            await config.flightSuretyApp.registerOracle({
                from: accounts[a],
                value: fee
            });
            console.log(`Oracle ${a} registered.`);
        }
    });

    async function oraclesSubmission(airline, flightData, statusCode) {
        let flight = flightData.flight;
        let timestamp = flightData.timestamp;

        // Submit a request for oracles to get status information for a flight

        await config.flightSuretyApp.fetchFlightStatus(airline, flight, timestamp);

        let events = await config.flightSuretyApp.getPastEvents('OracleRequest');
        oracleIndex = parseInt(events[0].returnValues.index);
        console.log(`\nFiltering oracles by index: ${oracleIndex}\n`);
        // ACT

        for (let a = 0; a < TEST_ORACLES_COUNT; a++) {

            let result = await config.flightSuretyApp.getMyIndexes.call({
                from: accounts[a]
            });

            if (parseInt(result[0]) != oracleIndex && parseInt(result[1]) != oracleIndex && parseInt(result[2]) != oracleIndex) {
                continue;
            }

            try {
                // Submit a response...it will only be accepted if there is an Index match
                await config.flightSuretyApp.submitOracleResponse(
                    oracleIndex,
                    airline,
                    flight,
                    timestamp,
                    statusCode, {
                        from: accounts[a]
                    });
                console.log(`Oracle ${a} submited response`);
            } catch (e) {
                console.log(`Oracle ${a} error -> ${e.reason}`);
            }
        }
    }

    it('Oracles can submit AIRLINE_ON_TIME responses', async () => {

        await oraclesSubmission(accounts[1], config.flights[0], STATUS_CODE_ON_TIME);
        let details = await config.flightSuretyData.getFlightDetails(accounts[1], config.flights[0].flight, config.flights[0].timestamp);
        assert.equal(details.statusCode.toNumber(), STATUS_CODE_ON_TIME, "Flight status is not correct")
    });

    it('Oracles can submit STATUS_CODE_LATE_AIRLINE responses', async () => {
        await oraclesSubmission(accounts[1], config.flights[1], STATUS_CODE_LATE_AIRLINE);
        let details = await config.flightSuretyData.getFlightDetails(accounts[1], config.flights[1].flight, config.flights[1].timestamp);
        assert.equal(details.statusCode.toNumber(), STATUS_CODE_LATE_AIRLINE, "Flight status is not correct")
    });

    it('Passenger can withdraw insured funds', async () => {

        var initialBalance = await web3.eth.getBalance(accounts[6]);

        await config.flightSuretyApp.passengerClaimsInsuredMoney({
            from: accounts[6]
        });

        var balance = await web3.eth.getBalance(accounts[6]);
        expect(parseInt(balance)).to.be.greaterThan(parseInt(initialBalance));
    });

});