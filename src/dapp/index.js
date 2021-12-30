import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


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
        contract.listenEvents((content) => {
            DOM.elid('events').innerHTML += `<div class="alert alert-success" role="alert">${content}</div>`;
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
                    text = `Flight Details:\nRegistered: ${res.isRegistered}\nStatus: ${res.statusCode}`;
                }
                console.log(text);
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
            contract.fetchFlightStatus(airline, flight, time, (err, res) => {});
        });
    }

    function setupAirlinePage() {

        DOM.elid('btn-register-airline').addEventListener('click', () => {
            let airline = DOM.elid('register-airline-address').value;
            contract.registerAirline(airline, (err, res) => {});
        });
        DOM.elid('btn-deposit-funds').addEventListener('click', () => {
            let amount = DOM.elid('deposit-amount').value;
            contract.airlineDeposit(amount, (err, res) => {});
        });
        DOM.elid('btn-register-flight').addEventListener('click', () => {
            let flight = DOM.elid('register-flight-number').value;
            let time = DOM.elid('register-flight-time').value;
            if (time != null) {
                time = Date.parse(time);
                time = time / 1000;
            }
            contract.registerFlight(flight, time, (err, res) => {

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
                console.log(err);
                console.log(res);
            });
        });

        DOM.elid('btn-claim-insured-funds').addEventListener('click', () => {
            contract.claimInsuredMoney((err, res) => {});
        });
    }

})();