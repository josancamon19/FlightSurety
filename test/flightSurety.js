var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;

    const airline1 = accounts[1];
    const airline2 = accounts[2];
    const airline3 = accounts[3];
    const airline4 = accounts[4];
    const airline5 = accounts[5];
    const passenger = accounts[6];

    const airlineRegistrationFee = web3.utils.toWei("10", "ether");
    const passengerInsurance = web3.utils.toWei("1", "ether");

    beforeEach(async () => {
        if (config == null) {
            config = await Test.Config(accounts);
            await config.flightSuretyData.authorizeContract(config.flightSuretyApp.address);
            await config.flightSuretyApp.registerAirline(airline1);
        }
    });

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/


    /**
     * ******************************** Contract Pausability  *******************************
     */

    it(`Contract cannot be paused by non contract owners`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let canBePausedByNonOwner = true;

        try {
            await config.flightSuretyData.pause({
                from: accounts[1]
            });
        } catch (e) {
            canBePausedByNonOwner = false;
        }
        assert.equal(canBePausedByNonOwner, false, "Pause functionallity not restricted properly to Contract Owner");

    });

    it(`Contract can be paused by contract owner`, async function () {

        // Ensure that access is allowed for Contract Owner account
        await config.flightSuretyData.pause();

        let events = await config.flightSuretyData.getPastEvents('Paused');
        let isPaused = await config.flightSuretyData.isPaused.call();

        assert.equal(events.length, 1, "Paused contract event not received.");
        assert.equal(isPaused, true, "Contract Owner cannot pause the contract");
    });

    it(`Access to contract is blocked when is paused`, async function () {
        var failureReason;
        try {
            await config.flightSuretyApp.registerAirline(accounts[2], {
                from: airline1
            });
        } catch (e) {
            failureReason = e.reason;
        }
        assert.equal(failureReason, "Can't use contract as it's paused.",
            "Access to contract was not blocked by it's paused state.");
    });

    it(`Contract can be unpaused by contract owner`, async function () {

        // Ensure that access is allowed for Contract Owner account
        await config.flightSuretyData.unpause();

        let events = await config.flightSuretyData.getPastEvents('Unpaused');
        let isPaused = await config.flightSuretyData.isPaused.call();

        assert.equal(events.length, 1, "Unpaused contract event not received.");
        assert.equal(isPaused, false, "Contract Owner cannot unpause the contract.");
    });

    /****************************************************************************************/
    /* APP CONTRACT INTERACTION                                                             */
    /****************************************************************************************/


    /**
     * ******************************** Airline  *******************************
     */

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
        var failureReason;
        try {
            await config.flightSuretyApp.registerAirline(accounts[2], {
                from: airline1
            });
        } catch (e) {
            failureReason = e.reason;
        }
        assert.equal(failureReason,
            'Airline is not yet ready to participate into the contract.',
            "Airline can register if it is not funded.")
    });

    it('(airline) deposits using airlineDepositsFunds() enough funds to participate', async () => {

        let state1 = await config.flightSuretyData.getAirlineStatus(airline1);

        await config.flightSuretyApp.airlineDepositsFunds({
            from: airline1,
            value: airlineRegistrationFee
        });

        let state2 = await config.flightSuretyData.getAirlineStatus(airline1);
        let events = await config.flightSuretyData.getPastEvents('NewAirlineStatus');

        assert.equal(events.length, 1, "Airline updated status event not found.");
        assert.equal(state1, 1, "Airline initial status was not APPROVED.");
        assert.equal(state2, 2, "Fee sent didn't modify airline status to PARTICIPATING.");
    });

    it('(airline) can register an Airline using registerAirline()', async () => {
        let airlinesCount1 = await config.flightSuretyData.getAirlinesCount.call();
        await config.flightSuretyApp.registerAirline(accounts[2], {
            from: airline1
        });
        let airlinesCount2 = await config.flightSuretyData.getAirlinesCount.call();

        assert.equal(parseInt(airlinesCount1) + 1, parseInt(airlinesCount2),
            `Airlines count 1 is ${airlinesCount1} and airlines count 2 is ${airlinesCount2}`);
    });

    it('(airlines) consensus registration for approving a new Airline when airlines.length >= 4 using registerAirline()', async () => {

        // Airline 2
        await config.flightSuretyApp.airlineDepositsFunds({
            from: airline2,
            value: airlineRegistrationFee
        });

        // Airline 3
        await config.flightSuretyApp.registerAirline(airline3, {
            from: airline1
        });
        await config.flightSuretyApp.airlineDepositsFunds({
            from: airline3,
            value: airlineRegistrationFee
        });

        // Airline 4
        await config.flightSuretyApp.registerAirline(airline4, {
            from: airline1
        });
        await config.flightSuretyApp.airlineDepositsFunds({
            from: airline4,
            value: airlineRegistrationFee
        });

        // Airline 5
        await config.flightSuretyApp.registerAirline(airline5, {
            from: airline1
        });

        let status4 = await config.flightSuretyData.getAirlineStatus(airline4);
        let status5 = await config.flightSuretyData.getAirlineStatus(airline5);

        assert.equal(status4, 2, "Airline 4 was not registered propperly");
        assert.equal(status5, 0, "Airline 5 registration not subjected to multi approval.");


        await config.flightSuretyApp.registerAirline(airline5, {
            from: airline2
        });
        await config.flightSuretyApp.registerAirline(airline5, {
            from: airline3
        });
        let status5_2 = await config.flightSuretyData.getAirlineStatus(airline5);

        assert.equal(status5_2, 1, "Airline 5 registration consensus not working.");


    });

    it('(airline) can register a flight using registerFlight()', async () => {
        await config.flightSuretyApp.registerFlight(
            config.flights[0].flight,
            config.flights[0].timestamp, {
                from: accounts[1]
            });

        let events = await config.flightSuretyData.getPastEvents('NewFlightRegistered');
        assert.equal(events.length, 1, "Flight registered event not found.");

        let flightKey = events[0].returnValues.flightKey;
        let isRegistered = await config.flightSuretyData.isFlightRegistered.call(flightKey);

        assert.equal(isRegistered, true, "Flight appears to not be registered.")
    });

    /**
     * ******************************** Passenger  *******************************
     */

    it('(passenger) can buy insurance for a flight', async () => {
        // address airline,
        // string memory flight,
        // uint256 timestamp

        await config.flightSuretyApp.buyInsurance(
            airline1,
            config.flights[0].flight,
            config.flights[0].timestamp, {
                from: passenger,
                value: passengerInsurance
            });

        let events = await config.flightSuretyData.getPastEvents('NewInsuredFlight');
        assert.equal(events.length, 1, "NewInsuredFlight event not found.");

        let flightKey = events[0].returnValues.flightKey;
        let insuredAmount = await config.flightSuretyData.getPassengerInsuranceForFlight(
            passenger,
            flightKey, {
                from: passenger
            })

        assert.equal((new BigNumber(insuredAmount)).toNumber(), passengerInsurance, "Insured amount and amount sent do not match.")
    });

});