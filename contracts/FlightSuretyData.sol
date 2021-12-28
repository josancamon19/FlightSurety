// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Pausable.sol";

contract FlightSuretyData is Ownable, Pausable {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    mapping(address => uint256) private authorizedContracts;

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

    mapping(bytes32 => mapping(address => uint256))
        private passengersInsurances;
    mapping(bytes32 => address[]) private insuredFlights;

    mapping(address => AirlineStatus) public airlines;
    mapping(address => uint256) private airlinesFunds;
    mapping(address => uint256) private passengersFunds;

    mapping(address => address[]) private approvals;

    uint256 public airlinesCount = 0;
    uint256 public airlinesParticipating = 0;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
     ********** Airlines registration **********
     */
    event NewAirlineStatus(address airline, AirlineStatus status);

    /**
     ********** Flights registration **********
     */
    event NewFlightRegistered(address airline, bytes32 flightKey);
    event FlightStatusCodeFound(
        address airline,
        bytes32 flightKey,
        uint256 statusCode
    );

    /**
     ********** Insurances operations **********
     */

    event NewInsuredFlight(
        address passenger,
        bytes32 flightKey,
        uint256 insuredAmount
    );

    event AirlineFlightArrivedOnTime(address airline, bytes32 flightKey);

    event AirlinePaysInsurance(
        address airline,
        address passenger,
        bytes32 flight,
        uint256 amount
    );
    event PassengerGetsInsuredMoney(address passenger, uint256 amount);

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/
    modifier isCallerAuthorized() {
        require(
            authorizedContracts[msg.sender] == 1,
            "Caller is not contract owner"
        );
        _;
    }

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
     ********** Callers authorization **********
     */
    function authorizeContract(address contractAddress) external onlyOwner {
        authorizedContracts[contractAddress] = 1;
    }

    function deauthorizeContract(address contractAddress) external onlyOwner {
        delete authorizedContracts[contractAddress];
    }

    /**
     ********** Airlines registration **********
     */

    function getAirlinesCount() external view returns (uint256) {
        return airlinesCount;
    }

    function getAirlinesParticipatingCount() external view returns (uint256) {
        return airlinesParticipating;
    }

    function getAirlineStatus(address airline) external view returns (uint8) {
        return uint8(airlines[airline]);
    }

    function registerAirline(address sender, address newAirline)
        external
        whenNotPaused
        isCallerAuthorized
        isAirlineParticipating(sender)
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
        whenNotPaused
        isCallerAuthorized
        isAirlineParticipating(approver)
    {
        approvals[airline].push(approver);

        if (approvals[airline].length == 1) {
            emit NewAirlineStatus(airline, AirlineStatus.NOT_APPROVED);
        }
    }

    /**
     ********** Airlines funds **********
     */

    function getAirlineFunds(address airline)
        external
        view
        isCallerAuthorized
        returns (uint256)
    {
        return airlinesFunds[airline];
    }

    function depositFundsToAirline(address airline)
        external
        payable
        whenNotPaused
        isCallerAuthorized
        isAirline(airline)
        returns (uint256)
    {
        airlinesFunds[airline] += msg.value;
        return airlinesFunds[airline];
    }

    function setAirlineAsParticipant(address airline)
        external
        whenNotPaused
        isCallerAuthorized
        isAirline(airline)
    {
        airlines[airline] = AirlineStatus.PARTICIPATING;
        airlinesParticipating += 1;

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
    )
        external
        whenNotPaused
        isCallerAuthorized
        isAirlineParticipating(airline)
    {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flights[flightKey] = Flight(true, statusCode, timestamp, airline);

        emit NewFlightRegistered(airline, flightKey);
    }

    function setFlightStatusCode(
        address airline,
        string memory flight,
        uint8 newStatusCode,
        uint256 timestamp
    ) external whenNotPaused isCallerAuthorized {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flights[flightKey].statusCode = newStatusCode;

        emit FlightStatusCodeFound(airline, flightKey, newStatusCode);
    }

    function getFlightDetails(
        address airline,
        string memory flight,
        uint256 timestamp
    ) external view returns (bool isRegistered, uint8 statusCode) {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        return (flights[flightKey].isRegistered, flights[flightKey].statusCode);
    }

    /**
     ********** Passengers operations **********
     */

    function getPassengersInsuredForFlight(bytes32 flightKey)
        public
        view
        isCallerAuthorized
        flightExists(flightKey)
        returns (address[] memory)
    {
        return insuredFlights[flightKey];
    }

    function cleanAllInsuredPassengersForFlight(bytes32 flightKey)
        external
        whenNotPaused
        isCallerAuthorized
    {
        delete insuredFlights[flightKey];
    }

    function transferToAirlinePassengersInsuredFundsForFlight(
        address airline,
        bytes32 flightKey
    )
        external
        whenNotPaused
        isCallerAuthorized
        isAirlineParticipating(airline)
        flightExists(flightKey)
    {
        address[] memory passengers = getPassengersInsuredForFlight(flightKey);

        for (uint256 i = 0; i < passengers.length; i++) {
            uint256 amountInsured = passengersInsurances[flightKey][
                passengers[i]
            ];
            delete passengersInsurances[flightKey][passengers[i]];
            airlinesFunds[airline] += amountInsured;
        }

        emit AirlineFlightArrivedOnTime(airline, flightKey);
    }

    function buyInsuranceForFlight(address passenger, bytes32 flightKey)
        external
        payable
        whenNotPaused
        flightExists(flightKey)
    {
        passengersInsurances[flightKey][passenger] = msg.value;
        insuredFlights[flightKey].push(passenger);

        emit NewInsuredFlight(passenger, flightKey, msg.value);
    }

    function passengerClaimsInsuredMoney(address passenger)
        external
        whenNotPaused
        isCallerAuthorized
    {
        uint256 amount = passengersFunds[passenger];
        require(amount > 0, "You have no funds to claim.");
        passengersFunds[passenger] = 0;
        payable(passenger).transfer(amount);

        emit PassengerGetsInsuredMoney(passenger, amount);
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
    )
        external
        whenNotPaused
        isCallerAuthorized
        flightExists(flightKey)
        flightInsured(passenger, flightKey)
    {
        passengersInsurances[flightKey][passenger] = 0;

        airlinesFunds[airline] -= amountToPayout;
        passengersFunds[passenger] += amountToPayout;

        emit AirlinePaysInsurance(
            airline,
            passenger,
            flightKey,
            amountToPayout
        );
    }

    /**
     ********** Utilities **********
     */

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }
}
