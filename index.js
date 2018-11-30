const config = require('./config.json');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const http = require('http').Server(app);
const io = require('socket.io')(http);

var globalData;
var currentHalte = config.timingPointCode;
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));


//a mess... just for testing
app.get('/:tpc', (req,res,next) => {
    tpc = req.params.tpc
    getHalte(tpc)
    .then(d => {
        getBusses(tpc).then(a => {
            res.status(200).json(a);
        })
        .catch(e => console.log(e))
    })
    .catch(e => res.send(e));
});

//change the timingPointCode temporary
app.post('/changeHalte/:tpc', (req,res,next) => {
    res.status(200).json({changedFrom: currentHalte, currentHalte: req.params.tpc});
    currentHalte = req.params.tpc;
});

io.on('connection', function(socket){
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

http.listen(config.port, () => {
    console.log('listening on: '+config.port);
});

var getHalte = function(halteNumber) {
    return new Promise(function(resolve, reject) {
        axios.get(config.timingPointCodeGetUrl + halteNumber)
        .then(response => {
            resolve(response.data);
            globalData = response.data;
        })
        .catch(e => console.log(e));
    });
}

var getBusses = function(tpc) {
    return new Promise(function(resolve, reject) {
        let busses = [];
        for(let a in globalData) {
            for(let i in globalData[a]['Passes']) {
                if(getMinutes(globalData[a]['Passes'][i]['ExpectedArrivalTime']) < 60) {
                   busses.push({
                       DestinationName50: globalData[a]['Passes'][i]['DestinationName50'],
                       LinePublicNumber: globalData[a]['Passes'][i]['LinePublicNumber'],
                       TargetArrivalTime: globalData[a]['Passes'][i]['TargetArrivalTime'],
                       ExpectedArrivalTime: globalData[a]['Passes'][i]['ExpectedArrivalTime'],
                       ArrivalInMinutes: getMinutes(globalData[a]['Passes'][i]['ExpectedArrivalTime']),
                       Halted: checkHalted(getMinutes(globalData[a]['Passes'][i]['ExpectedArrivalTime']))
                   });
               }
            }
        }
        //sort array by arrivalTime
         resolve(busses.sort(function(a,b) {
            return a['ArrivalInMinutes'] - b['ArrivalInMinutes'];
        }));
    })
}

function getMinutes(time) {
    let expectedBusTme = new Date(time).getTime();;
    let currentTime = new Date().getTime();
    let difference = Math.round((expectedBusTme - currentTime)/(1000*60));
    return difference;
}

function checkHalted(a) {
    if(a <= 0) {
        return true;
    } else {
        return false;
    }
}

setInterval(() => {
    getHalte(currentHalte)
    .then(a => {
        getBusses(currentHalte)
        .then(e => {
            io.emit(config.timingPointCode, e);
        })
        .catch(e => {
            console.log(e);
        })
    })
    .catch(e => {
        console.log(e);
    })
}, 30000);