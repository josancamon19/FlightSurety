import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async () => {

    let result = null;

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
        // FIX: BUG can register flight if airlinesCount is 0 
    });

    function setupSharedOperations() {
        DOM.elid('btn-get-flight-details').addEventListener('click', () => {
            let flight = DOM.elid('details-flight-number').value;
            let time = DOM.elid('details-flight-time').value;
            let airline = DOM.elid('details-flight-airline').value;
            if (time != null) {
                time = Date.parse(time);
                time = time / 1000;
            }
            contract.getFlightDetails(airline, flight, time, (err, res) => {
                console.log(`Flight Details:\nRegistered: ${res.isRegistered}\nStatus: ${res.statusCode}`);
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
                console.log(res);
            });
        });
    }

    function setupAirlinePage() {
        contract.loadAirlineStatus();
        DOM.elid('btn-get-flight-details').addEventListener('click', () => {
            let flight = DOM.elid('details-flight-number').value;
            let time = DOM.elid('details-flight-time').value;
            let airline = DOM.elid('details-flight-airline').value;
            if (time != null) {
                // FIX check tests js time is in millis and sol in secs
                time = Date.parse(time);
                time = time / 1000;
            }
            contract.getFlightDetails(airline, flight, time, (err, res) => {
                console.log(`Flight Details:\nRegistered: ${res.isRegistered}\n Status: ${res.statusCode}`);
            });
        });
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
            contract.buyInsurance(airline, flight, time, amount, (err, res) => {});
        });

        DOM.elid('btn-claim-insured-funds').addEventListener('click', () => {
            contract.claimInsuredMoney((err, res) => {});
        });
    }
})();

function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({
            className: 'row'
        }));
        row.appendChild(DOM.div({
            className: 'col-sm-4 field'
        }, result.label));
        row.appendChild(DOM.div({
            className: 'col-sm-8 field-value'
        }, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}