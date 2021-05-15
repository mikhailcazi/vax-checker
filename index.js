var url, statusText, resultText, resultTable, tBody, intervalID, age, refreshText, storedDistrict, enableNotifications;
var refreshTime = 60000;

window.onload = function() {
    statusText = document.getElementById('status');
    resultText = document.getElementById('result');
    resultTable = document.getElementById('resultTable');
    tBody = document.getElementById('tBody');
    storedDistrict = localStorage.getItem("district");
    if(storedDistrict) {
        document.getElementById('district').value = storedDistrict;
    }
    enableNotifications = document.getElementById('notif-check').checked;
    if(enableNotifications && window.Notification) {

        if (Notification.permission !== 'granted') {
            Notification.requestPermission().then(function (permission) {
            }).catch(function (err) {
                console.error(err);
            });
        }

    }
};

window.addEventListener("keyup", function(event) {
    if (event.keyCode === 13) {
        startChecking();
    }
});

function getAge() {
    if (document.getElementById('under44').checked) {age = 18}
    else if(document.getElementById('above45').checked) {age = 45}
    else if (document.getElementById('all').checked) {age = 0}
}

function sendNotif(openSessions) {
    var notify = new Notification('Vaccination Slot Found!', {
                        body: openSessions + ' vaccination slot(s) found! Click to open the CoWin App.',
                        icon: './assets/images/vaccine.jpg',
                    });
    notify.onclick = function(event) {
        event.preventDefault();
        window.open('https://selfregistration.cowin.gov.in/appointment', '_blank');
    }
}

function notifyMe(openSessions) {
    if (window.Notification && Notification.permission === 'granted') { 
        sendNotif(openSessions);
    }
}

function sortDistricts(a, b) {
    //sort by state
    var stateA = a.state.toUpperCase();
    var stateB = b.state.toUpperCase();
    if (stateA < stateB) {
        return -1;
    }
    if (stateA > stateB) {
        return 1;
    }
    //then by dist name
    var distA = a.district_name.toUpperCase();
    var distB = b.district_name.toUpperCase();
    if (distA < distB) {
        return -1;
    }
    if (distA > distB) {
        return 1;
    }
    return 0;
}

function downloadDistrictFile(allDistricts) {
    const replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here
    const header = Object.keys(allDistricts[0])
    const csv = [
    header.join(','), // header row first
    ...allDistricts.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
    ].join('\r\n')

    console.log(csv);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, 'District List.csv');
    } else {
        var link = document.createElement("a");
        if (link.download !== undefined) { // feature detection
            // Browsers that support HTML5 download attribute
            var url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", 'District List.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

function getStates() {
    return JSON.parse(httpGet('https://cdn-api.co-vin.in/api/v2/admin/location/states')).states;
}

function getDistrictForState(stateID) {
    return JSON.parse(httpGet('https://cdn-api.co-vin.in/api/v2/admin/location/districts/' + stateID));
}

function getAllDistricts() {
    var allStates = getStates();
    var allDistricts = [];
    allStates.forEach(state => {
        let district = getDistrictForState(state.state_id);
        allDistricts = allDistricts.concat(district.districts.map(d => ({... d,'state': state.state_name})))
    });
    allDistricts.sort(sortDistricts)
    downloadDistrictFile(allDistricts);
}

function httpGet(theUrl)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", theUrl, false ); // false for synchronous request
    xmlHttp.send( null );
    return xmlHttp.responseText;
}

async function httpGetFetch(theUrl)
{
    const response = await fetch(theUrl);
    return response.json();
}

function getDate(date) {
    return date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear()
}

function startChecking() {
    const district = document.getElementById('district').value;
    refreshTime = document.getElementById('time').value * 1000;

    if(!district) {
        return window.alert('Please enter District ID!');
    }
    localStorage.setItem("district", district);

    if(!refreshTime) {
        refreshTime = 60000;
    }
    
    if(intervalID) {
        clearInterval(intervalID);
    } else {
        var img = document.getElementById('gifCanvas').innerHTML ='<img id="loading" src="./assets/images/loading.gif">'
    }


    const date = getDate(new Date());
    getAge();
    url = 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=' + district + '&date=' + date;
    
    makeCall();
    intervalID = setInterval(makeCall, refreshTime);
}

function stopChecking() {
    if(intervalID) {
        clearInterval(intervalID);
        document.getElementById('gifCanvas').innerHTML = '';
        intervalID = 0;
        statusText.innerText = refreshText;
        document.getElementById('stopButton').disabled = true;
    }
}

function getRefreshText() {
    refreshText = "Last refreshed: " + Date().toLocaleString();
    return refreshText;
}

function makeCall(){ 
    let sessionFound = false, openSessions = 0, gridEmpty = true;
    clearTable(false);
    httpGetFetch(url).then(result => {
        statusText.innerText = getRefreshText() + '\nRefreshing every ' +(refreshTime/1000) +' seconds...';
        document.getElementById('stopButton').disabled = false;

        result.centers.forEach(centre => {
            centre.sessions.forEach(sesh => {
                if((age && sesh["min_age_limit"] === age) || !age) {
                    gridEmpty = false;
                    if(sesh["available_capacity"] > 0) {
                        sessionFound = true;
                        openSessions++;
                        addToTable(centre, sesh, true);
                    } else {
                        addToTable(centre, sesh);
                    }
                }
            })
        });

        if(gridEmpty) {
            clearTable(true)
        }
        
        if(sessionFound && document.getElementById('notif-check').checked) {
            notifyMe(openSessions);
        }
    });   
}

function addToTable(centre, session, isAvailable) {
    var tr = tBody.insertRow();
    if(isAvailable) {
        tr.style.backgroundColor = '#82c137'
    }
    tr.insertCell().appendChild(document.createTextNode(centre.name));
    tr.insertCell().appendChild(document.createTextNode(centre.address));
    tr.insertCell().appendChild(document.createTextNode(session.vaccine));
    tr.insertCell().appendChild(document.createTextNode(session.available_capacity));
    tr.insertCell().appendChild(document.createTextNode(session.date));
}

function clearTable (noSessions) {
    if(noSessions) {
        tBody.innerHTML = '<tr><td colspan="4">There are no slots currently available.</td></tr>'
    } else {
        tBody.innerText = ''
    }
}