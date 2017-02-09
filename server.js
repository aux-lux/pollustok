var fs = require('fs');
var net = require('net');
var http = require('http');
var request = require('request');
var path = 'data.json';
var currentData = JSON.parse(fs.readFileSync(path));
var tmpData = [];
var avgSamples = 10;

var mySensor = '[UID]'; // CHANGE THIS
var url = 'http://ird0002api-opensmog-dev.azurewebsites.net/sensors/' + mySensor + '/readings';

var sendToAPI = function (object) {
	var apiData = [{
		timestamp: Math.round((new Date()).getTime() / 1000),
		
		readings: {
			//pm1: object.pm1,
			pm2_5: object.pm2,
			pm10: object.pm10,
			temp: object.temp,
			hum: object.humi,
			pres: object.pres,
		}
	}];
	var formData = JSON.stringify(apiData);
	var options = {
		method: 'POST',
		url: url,
		body: formData,
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': formData.length
		}
	};
	
	request(options, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log('Data sent to api');
		}
	});
}

var server = net.createServer(function(socket) {
	console.log('Server created!');
	socket.on('data', function (data) {
		var textChunk = data.toString('utf8');
		var object;
		try {
			object = JSON.parse(textChunk)
		} catch (e) {}
		
		if (object) {
			tmpData.push(object)
			if (tmpData.length === avgSamples) {
				var avgs = {};
				var mins = {};
				var maxs = {};
				for(var i=0;i<avgSamples;i++) {
					var ob = tmpData[i];
					for (var name in ob) {
						if (typeof avgs[name] === 'undefined') {
							avgs[name] = ob[name];
						} else {
							avgs[name] += ob[name];
						}
						
						if (typeof mins[name] === 'undefined') {
							mins[name] = ob[name];
						} else {
							mins[name] = Math.min(mins[name], ob[name]);
						}
						
						if (typeof maxs[name] === 'undefined') {
							maxs[name] = ob[name];
						} else {
							maxs[name] = Math.max(maxs[name], ob[name]);
						}
					}
				}
				for(var name in avgs) {
					avgs[name] -= mins[name];
					avgs[name] -= maxs[name];
					avgs[name] /= (avgSamples - 2);
				}
				avgs.time = (new Date()).getTime();
				currentData.push(avgs);
				fs.writeFileSync(path, JSON.stringify(currentData));
				
				sendToAPI(avgs);
				tmpData = [];
			}
		}
	});
	socket.on('end', function (e) {
		console.log('kuniec: ', e);
	});
	socket.on('error', function(e){
		console.log('no ups: ', e);
	});
}).listen(3003);


http.createServer(function (req, res) {
	var body = JSON.stringify(currentData);
	res.setHeader('Content-Type', 'text/json');
	res.setHeader('Access-Control-Allow-Origin', 'http://vps.donreptile.com:1234');
	res.setHeader('Content-Length', body.length);
	
	res.end(body);
}).listen(3004);