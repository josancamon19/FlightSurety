const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = async function (deployer) {

    await deployer.deploy(FlightSuretyData);
    await deployer.deploy(FlightSuretyApp, FlightSuretyData.address);

    // Get deployed instance of Data contract, and set App as a valid caller.
    const instance = await FlightSuretyData.deployed();
    await instance.authorizeContract(FlightSuretyApp.address);

    // if (deployer.network === 'development') {
    //     const appInstance = await FlightSuretyApp.deployed();
    //     appInstance.registerAirline();
    // }

    let config = {
        localhost: {
            url: 'http://localhost:7545',
            dataAddress: FlightSuretyData.address,
            appAddress: FlightSuretyApp.address
        }
    }
    fs.writeFileSync(__dirname + '/../src/dapp/config.json', JSON.stringify(config, null, '\t'), 'utf-8');
    fs.writeFileSync(__dirname + '/../src/server/config.json', JSON.stringify(config, null, '\t'), 'utf-8');
}