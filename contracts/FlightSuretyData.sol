// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract FlightSuretyData is Ownable, Pausable {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }

    mapping(bytes32 => Flight) private flights;

    enum AirlineStatus {
        NOT_APPROVED,
        APPROVED,
        PARTICIPATING
    }

    // what if insurance is instead
    // flightKey => {passenger => amount}

    // passenger => (flightKey => insuredAmount)
    mapping(bytes32 => mapping(address => uint256)) passengersInsurances;
    mapping(bytes32 => address[]) insuredFlights;

    mapping(address => AirlineStatus) airlines;
    mapping(address => uint256) airlinesFunds;
    mapping(address => uint256) passengersFunds;

    mapping(address => address[]) approvals;

    uint256 airlinesCount = 0;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event NewAirlineStatus(address airline, AirlineStatus status);
    event InsuredFlight(address passenger, uint256 insuredAmount);
    event InsureePayout(
        address passenger,
        string flightKey,
        uint256 payoutAmount
    );

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    modifier isAirline(address airline) {
        if (airlinesCount != 0) {
            require(
                airlines[airline] != AirlineStatus.NOT_APPROVED,
                "The sender is not an approved airline"
            );
        }
        _;
    }

    modifier isAirlineParticipating(address airline) {
        if (airlinesCount != 0) {
            require(
                airlines[airline] == AirlineStatus.PARTICIPATING,
                "Airline is not yet ready to participate into the contract."
            );
        }
        _;
    }

    modifier flightExists(bytes32 flightKey) {
        require(flights[flightKey].isRegistered, "Flight not found.");
        _;
    }

    modifier flightInsured(address passenger, bytes32 flightKey) {
        require(
            passengersInsurances[flightKey][passenger] > 0,
            "Flight is not insured by passenger."
        );
        _;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     ********** Airlines registration **********
     */

    function getAirlinesCount() public view returns (uint256) {
        return airlinesCount;
    }

    function getAirlineStatus(address airline) external view returns (uint8) {
        return uint8(airlines[airline]);
    }

    function registerAirline(address sender, address newAirline)
        external
        isAirline(sender)
        returns (bool)
    {
        // airline has to be not registered yet.
        require(
            airlines[newAirline] == AirlineStatus.NOT_APPROVED,
            "Airline is already registered"
        );

        airlines[newAirline] = AirlineStatus.APPROVED;
        airlinesCount += 1;
        emit NewAirlineStatus(newAirline, AirlineStatus.APPROVED);
        return true;
    }

    function getAirlineApproversCount(address airline)
        external
        view
        returns (uint256)
    {
        return approvals[airline].length;
    }

    function addAirlineApprover(address airline, address approver)
        external
        isAirline(approver)
    {
        approvals[airline].push(approver);
    }

    /**
     ********** Airlines funds **********
     */

    function getAirlineFunds(address airline) external view returns (uint256) {
        return airlinesFunds[airline];
    }

    function depositFundsToAirline(address airline)
        external
        payable
        returns (uint256)
    {
        airlinesFunds[airline] += msg.value;
        return airlinesFunds[airline];
    }

    function setAirlineAsParticipant(address airline)
        external
        isAirline(airline)
    {
        airlines[airline] = AirlineStatus.PARTICIPATING;
        emit NewAirlineStatus(airline, AirlineStatus.PARTICIPATING);
    }

    /**
     ********** Flights details **********
     */

    function isFlightRegistered(bytes32 flightKey)
        external
        view
        returns (bool)
    {
        return flights[flightKey].isRegistered;
    }

    function registerFlight(
        address airline,
        string memory flight,
        uint8 statusCode,
        uint256 timestamp
    ) external isAirlineParticipating(airline) {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flights[flightKey] = Flight(true, statusCode, timestamp, airline);
    }

    function setFlightStatusCode(
        address airline,
        string memory flight,
        uint8 newStatusCode,
        uint256 timestamp
    ) external {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flights[flightKey].statusCode = newStatusCode;
    }

    /**
     ********** Passengers operations **********
     */

    function getPassengersInsuredForFlight(bytes32 flightKey)
        external
        view
        returns (address[] memory)
    {
        return insuredFlights[flightKey];
    }

    function cleanAllInsuredPassengersForFlight(bytes32 flightKey) external {
        delete insuredFlights[flightKey];
    }

    function cleanPassengerInsuranceForFlight(
        address passenger,
        address airline,
        bytes32 flightKey
    ) external {
        uint256 amountInsured = passengersInsurances[flightKey][passenger];
        passengersInsurances[flightKey][passenger] = 0;
        airlinesFunds[airline] -= amountInsured;
    }

    function buyInsuranceForFlight(address passenger, bytes32 flightKey)
        external
        payable
        flightExists(flightKey)
    {
        passengersInsurances[flightKey][passenger] = msg.value;
        insuredFlights[flightKey].push(passenger);
        emit InsuredFlight(passenger, msg.value);
    }

    function passengerClaimsInsuredMoney(address passenger) external {
        uint256 amount = passengersFunds[passenger];
        passengersFunds[passenger] = 0;

        payable(passenger).transfer(amount);
    }

    function getPassengerInsuranceForFlight(
        address passenger,
        bytes32 flightKey
    ) external view returns (uint256) {
        return passengersInsurances[flightKey][passenger];
    }

    function payPassengerInsuranceForFlight(
        address passenger,
        address airline,
        bytes32 flightKey,
        uint256 amountToPayout
    ) external flightExists(flightKey) flightInsured(passenger, flightKey) {
        passengersInsurances[flightKey][passenger] = 0;

        insuredFlights[flightKey];

        airlinesFunds[airline] -= amountToPayout;
        passengersFunds[passenger] += amountToPayout;
    }

    /**
     ********** Utilities **********
     */

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }
}
