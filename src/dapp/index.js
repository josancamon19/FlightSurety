import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';
import * as bootstrap from 'bootstrap';

(async () => {

    let contract = new Contract('localhost', () => {

        if (window.location.pathname == '/') {
            DOM.elid('go-airlines').addEventListener('click', () => {
                window.location.href = 'airlines.html';
            });
            DOM.elid('go-passengers').addEventListener('click', () => {
                window.location.href = 'passengers.html';
            });
        } else if (window.location.pathname == '/airlines.html') {
            setupSharedOperations();
            setupAirlinePage();
        } else if (window.location.pathname == '/passengers.html') {
            setupSharedOperations();
            setupPassengerPage();
        }
    });

    function setupSharedOperations() {
        let eventsText = [];
        contract.listenEvents((content) => {
            if (!eventsText.includes(content)) {
                console.log(content);
                DOM.elid('events').innerHTML += `<div class="alert alert-success" role="alert">${content}</div>`;
                eventsText.push(content);
            }
        });

        DOM.elid('btn-get-flight-details').addEventListener('click', () => {
            let flight = DOM.elid('details-flight-number').value;
            let time = DOM.elid('details-flight-time').value;
            let airline = DOM.elid('details-flight-airline').value;
            if (time != null) {
                time = Date.parse(time);
                time = time / 1000;
            }
            contract.getFlightDetails(airline, flight, time, (err, res) => {
                let text;
                if (err == null) {
                    text = `Registered: ${res.isRegistered}<br>Status: ${contract.mapFlightStatus(res.statusCode)}`;
                }
                showModal(err, 'Flight details', text);
            });
        });

        DOM.elid('btn-request-flight-status-update').addEventListener('click', () => {
            let flight = DOM.elid('status-update-number').value;
            let time = DOM.elid('status-update-time').value;
            let airline = DOM.elid('status-update-airline').value;
            if (time != null) {
                time = Date.parse(time);
                time = time / 1000;
            }
            contract.fetchFlightStatus(airline, flight, time, (err, res) => {
                let text;
                if (err == null) {
                    text = `A request was sent to our operators to update the
                     status for the flight ${flight}.<br>It will be ready in a second.`;
                }
                showModal(err, 'Flight status update', text)
            });
        });
    }

    function setupAirlinePage() {

        DOM.elid('btn-register-airline').addEventListener('click', () => {
            let airline = DOM.elid('register-airline-address').value;
            contract.registerAirline(airline, (err, res) => {
                showModal(err, 'Register Airline', 'Request was sent successfully, we will let you know when its ready.');
            });
        });
        DOM.elid('btn-deposit-funds').addEventListener('click', () => {
            let amount = DOM.elid('deposit-amount').value;
            contract.airlineDeposit(amount, (err, res) => {
                showModal(err, 'Deposit funds', 'Funds transfered to the contract successfully. They will be reflected in a second.');
            });
        });
        DOM.elid('btn-register-flight').addEventListener('click', () => {
            let flight = DOM.elid('register-flight-number').value;
            let time = DOM.elid('register-flight-time').value;
            if (time != null) {
                time = Date.parse(time);
                time = time / 1000;
            }
            contract.registerFlight(flight, time, (err, res) => {
                showModal(err, 'Flight registration', `Creating flight ${flight} with departure time at ${time}. 
                        We'll let you know when the flight gets available.`);
            });
        });
    }

    function setupPassengerPage() {
        DOM.elid('btn-buy-insurance').addEventListener('click', () => {
            let flight = DOM.elid('buy-insurance-flight-number').value;
            let time = DOM.elid('buy-insurance-flight-time').value;
            let airline = DOM.elid('buy-insurance-flight-airline').value;
            if (time != null) {
                time = Date.parse(time);
                time = time / 1000;
            }
            let amount = DOM.elid('buy-insurance-amount').value;
            contract.buyInsurance(airline, flight, time, amount, (err, res) => {
                showModal(err, 'Insuring flight', `Request sent for insuring flight ${flight} 
                    with departure time of ${time} for a value of ${amount} ETH`);
            });
        });

        DOM.elid('btn-claim-insured-funds').addEventListener('click', () => {
            contract.claimInsuredMoney((err, res) => {
                showModal(err, 'Claiming insured money', `Money transfered succesfully to your account. The transaction will be reflected shortly.`);
            });
        });
    }

    function showModal(err, title, message) {
        var modal = new bootstrap.Modal(document.getElementById('modal'));

        document.getElementById('modal').addEventListener('shown.bs.modal', function (event) {
            document.getElementById('modal-title').innerHTML = title;
            if (err != null) {
                document.getElementById('modal-body').innerHTML = `Error: ${err}`;
            } else {
                document.getElementById('modal-body').innerHTML = message;
            }
        })
        modal.toggle();
    }
})();