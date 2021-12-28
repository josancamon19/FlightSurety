// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp is Ownable {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    IFlightSuretyDataInterface private dataContract;

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    constructor(address contractAddress) {
        dataContract = IFlightSuretyDataInterface(contractAddress);
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    function registerAirline(address airline) external returns (bool) {
        uint256 airlinesCount = dataContract.getAirlinesParticipatingCount();

        if (airlinesCount < 4) {
            return dataContract.registerAirline(msg.sender, airline);
        } else {
            require(msg.sender != airline, "You can't approve yourself");

            // M of N algorithm
            dataContract.addAirlineApprover(airline, msg.sender);

            // Get M>N from participating airlines
            uint256 expectedApprovalSize = airlinesCount.div(2) + 1;

            if (
                dataContract.getAirlineApproversCount(airline) >=
                expectedApprovalSize
            ) {
                return dataContract.registerAirline(msg.sender, airline);
            }
        }
        return false;
    }

    function airlineDepositsFunds() external payable {
        dataContract.depositFundsToAirline{value: msg.value}(msg.sender);
        if (
            dataContract.getAirlineStatus(msg.sender) != 2 &&
            dataContract.getAirlineFunds(msg.sender) >= 10 ether
        ) {
            dataContract.setAirlineAsParticipant(msg.sender);
        }
    }

    function registerFlight(string memory flight, uint256 timestamp) external {
        // require(block.timestamp < timestamp, "Flight timestamp is not a future time.");

        address airline = msg.sender;
        require(
            !dataContract.isFlightRegistered(
                getFlightKey(airline, flight, timestamp)
            ),
            "Flight is registered already"
        );

        dataContract.registerFlight(
            airline,
            flight,
            STATUS_CODE_UNKNOWN,
            timestamp
        );
    }

    function processFlightStatus(
        address airline,
        string memory flight,
        uint256 timestamp,
        uint8 statusCode,
        bytes32 oracleRequestKey
    ) private {
        // oracles consensus was done from where this is being called.
        dataContract.setFlightStatusCode(
            airline,
            flight,
            statusCode,
            timestamp
        );
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);

        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            address[] memory passengers = dataContract
                .getPassengersInsuredForFlight(flightKey);
            for (uint256 i = 0; i < passengers.length; i++) {
                insurePassenger(passengers[i], airline, flightKey);
            }
            dataContract.cleanAllInsuredPassengersForFlight(flightKey);
            closeOracleRequest(oracleRequestKey);
        } else {
            // if (block.timestamp >= timestamp) {
            dataContract.transferToAirlinePassengersInsuredFundsForFlight(
                airline,
                flightKey
            );

            dataContract.cleanAllInsuredPassengersForFlight(flightKey);
            closeOracleRequest(oracleRequestKey);
            // }
        }
    }

    function buyInsurance(
        address airline,
        string memory flight,
        uint256 timestamp
    ) external payable {
        require(
            msg.value > 0 && msg.value <= 1 ether,
            "Amount sent is invalid (has to be > 0 and <= 1 ether)."
        );

        bytes32 flightKey = getFlightKey(airline, flight, timestamp);

        require(
            dataContract.getPassengerInsuranceForFlight(
                msg.sender,
                flightKey
            ) == 0,
            "You already have an insurance for the flight."
        );

        dataContract.buyInsuranceForFlight{value: msg.value}(
            msg.sender,
            flightKey
        );
    }

    function insurePassenger(
        address passenger,
        address airline,
        bytes32 flightKey
    ) private {
        uint256 amountInsured = dataContract.getPassengerInsuranceForFlight(
            passenger,
            flightKey
        );
        uint256 amountToPayout = amountInsured.mul(3).div(2);
        dataContract.payPassengerInsuranceForFlight(
            passenger,
            airline,
            flightKey,
            amountToPayout
        );
    }

    function passengerClaimsInsuredMoney() external {
        dataContract.passengerClaimsInsuredMoney(msg.sender);
    }

    /********************************************************************************************/
    /*                                     ORACLES FUNCTIONS                                    */
    /********************************************************************************************/

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(
        address airline,
        string memory flight,
        uint256 timestamp
    ) external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );

        ResponseInfo storage info = oracleResponses[key];
        info.requester = msg.sender;
        info.isOpen = true;

        emit OracleRequest(index, airline, flight, timestamp);
    }

    function closeOracleRequest(bytes32 oracleRequestKey) private {
        oracleResponses[oracleRequestKey].isOpen = false;
        emit OracleRequestClosed(oracleRequestKey);
    }

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 2;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester; // Account that requested status
        bool isOpen; // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    event OracleReport(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp
    );

    event OracleRequestClosed(bytes32 oracleRequestKey);

    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({isRegistered: true, indexes: indexes});
    }

    function getMyIndexes() external view returns (uint8[3] memory) {
        require(
            oracles[msg.sender].isRegistered,
            "Not registered as an oracle"
        );

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(
        uint8 index,
        address airline,
        string memory flight,
        uint256 timestamp,
        uint8 statusCode
    ) external {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request"
        );

        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        require(oracleResponses[key].isOpen, "Oracle submissions needed completed. Request is closed. | Or does not exists.");

        // TODO: how is msg.sender not duplicated?

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (
            oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES
        ) {
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode, key);
        }
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account)
        internal
        returns (uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }
}

interface IFlightSuretyDataInterface {
    // https://cryptomarketpool.com/interface-in-solidity-smart-contracts/

    /**
     ********** Airlines registration **********
     */

    function getAirlinesCount() external view returns (uint256);

    function getAirlinesParticipatingCount() external view returns (uint256);

    function getAirlineStatus(address airline) external view returns (uint8);

    function registerAirline(address sender, address newAirline)
        external
        returns (bool);

    function getAirlineApproversCount(address airline)
        external
        view
        returns (uint256);

    function addAirlineApprover(address airline, address approver) external;

    /**
     ********** Airlines funds **********
     */

    function getAirlineFunds(address airline) external view returns (uint256);

    function depositFundsToAirline(address airline)
        external
        payable
        returns (uint256);

    function setAirlineAsParticipant(address airline) external;

    /**
     ********** Flights details **********
     */

    function isFlightRegistered(bytes32 flightKey) external returns (bool);

    function registerFlight(
        address airline,
        string memory flight,
        uint8 statusCode,
        uint256 timestamp
    ) external;

    function setFlightStatusCode(
        address airline,
        string memory flight,
        uint8 newStatusCode,
        uint256 timestamp
    ) external;

    /**
     ********** Passengers operations **********
     */

    function getPassengersInsuredForFlight(bytes32 flightKey)
        external
        view
        returns (address[] memory);

    function cleanAllInsuredPassengersForFlight(bytes32 flightKey) external;

    function transferToAirlinePassengersInsuredFundsForFlight(
        address airline,
        bytes32 flightKey
    ) external;

    function buyInsuranceForFlight(address passenger, bytes32 flightKey)
        external
        payable;

    function passengerClaimsInsuredMoney(address passenger) external;

    function getPassengerInsuranceForFlight(
        address passenger,
        bytes32 flightKey
    ) external view returns (uint256);

    function payPassengerInsuranceForFlight(
        address passenger,
        address airline,
        bytes32 flightKey,
        uint256 amountToPayout
    ) external;
}
