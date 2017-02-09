blinkPin = 4 -- Represent wifi connecting status.
gpio.mode(blinkPin, gpio.OUTPUT)
gpio.write(blinkPin, gpio.HIGH)
state = 0

function checkBoth ()
    status, temp, humi = dht.read(4)
    bmp085.init(6, 5)
    
    local t = bmp085.temperature() / 10
    local p = bmp085.pressure() / 100
    local output = {temp = temp, pres = p}
    if humi > 0 then
        output.humi = humi
    end
	
    return output
end

function readNext ()
    pms3003.read(function()
        pm01 = pms3003.pm01 or 'null'
        pm25 = pms3003.pm25 or 'null'
        pm10 = pms3003.pm10 or 'null'

        output = checkBoth()
        
        output.pm1 = pm01
        output.pm2 = pm25
        output.pm10 = pm10
        print2(cjson.encode(output))
		
        readNext ()
    end)
end

function readFromArduino ()
    do
        PMset=7
        require('pms3003')
        pms3003.model=5 -- Even for model 7003
        pms3003.init(PMset)
        pms3003.verbose=true
        readNext ()
    end
end

function print2 (str)
    sk:send(str)
end

function connectToWifi (callback)
    local mytimer = tmr.create()
    wifi.setmode(wifi.STATION)
    wifi.sta.config("WIFI-ID","WIFI-PASSWORD") -- CHANGE THIS
    function checkWifiConnection ()
        if wifi.sta.getip() == nil then
            if (state==0) then
                state = 1
                gpio.write(blinkPin, gpio.HIGH)
            else
                state = 0
                gpio.write(blinkPin, gpio.LOW)     
            end
        else
            gpio.write(blinkPin, gpio.LOW)
            mytimer:stop()
            connectToSocket(callback)
        end
    end
    
    mytimer:register(1000, 1, checkWifiConnection)
    mytimer:start()
end

function connectToSocket (callback)
    sk=net.createConnection(net.TCP, 0)
    sk:connect("SERVER-PORT", "SERVER-IP") -- CHANGE THIS
    sk:on("connection", function(sck,c)
        print2("Connected to socket\n")
        gpio.write(blinkPin, gpio.HIGH)
        if type(callback) == "lightfunction" or type(callback) == "function" then
            callback()
        end
    end)
end

-- in case of infinite loops.
tmr.create():alarm(10000, tmr.ALARM_SINGLE, function()
    connectToWifi(readFromArduino)
end)
