//
// Copyright (c) 2016 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a Cisco Spark bot that:
 *   - sends a welcome message as he joins a room, 
 *   - answers to a /hello command, and greets the user that chatted him
 *   - supports /help and a fallback helper message
 *
 * + leverages the "node-sparkclient" library for Bot to Cisco Spark communications.
 * 
 */

var SparkBot = require("node-sparkbot");
var moment = require('moment-timezone');

var bot = new SparkBot();
//bot.interpreter.prefix = "#"; // Remove comment to overlad default / prefix to identify bot commands

var SparkAPIWrapper = require("node-sparkclient");
if (!process.env.SPARK_TOKEN) {
    console.log("Could not start as this bot requires a Cisco Spark API access token.");
    console.log("Please add env variable SPARK_TOKEN on the command line");
    console.log("Example: ");
    console.log("> SPARK_TOKEN=XXXXXXXXXXXX DEBUG=sparkbot* node helloworld.js");
    process.exit(1);
}
var spark = new SparkAPIWrapper(process.env.SPARK_TOKEN);


//Helper functions
var inactive_time = 3*60*1000;

var current_time = new Date();

var building9 = [];

var showcase = {};
var donkeykong = {};
var tetris = {};
var cerf = {};

// var new_room = createNewRoom(room, building)

var showcase = createNewRoom('Showcase', '8', 'RTP Ridge 1');
var donkeykong = createNewRoom('DonkeyKong', '12', 'RTP Ridge 2');
var tetris = createNewRoom('Tetris', '12', 'RTP Ridge 2');
var bonjovi = createNewRoom('BonJovi', '8', 'RTP Ridge 3');
var einstein = createNewRoom('Einstein', '5', 'RTP Ridge 3');
var cerf = createNewRoom('Cerf', '5', 'RTP Ridge 3');


var ridge1 = {};
var ridge2 = {};
var ridge3 = {};

ridge1['showcase'] = showcase;
ridge2['donkeykong']=donkeykong;
ridge2['tetris'] = tetris;
ridge3['cerf'] = cerf;
ridge3['bonjovi'] = bonjovi;
ridge3['einstein'] = einstein;

var floor = {};

floor['1st'] = 'first';
floor['1'] = 'first';
floor['first'] = 'first';
floor['one'] = 'first';
floor['ridge1'] = 'first'

floor['2nd'] = 'second';
floor['2'] = 'second';
floor['second'] = 'second';
floor['two'] = 'second';
floor['ridge2'] = 'second'

floor['3rd'] = 'third';
floor['3'] = 'third';
floor['third'] = 'third';
floor['three'] = 'third';
floor['ridge3'] = 'third'

var room_building_map = {'showcase':'ridge1', 'donkeykong':'ridge2', 'tetris':'ridge2', 'cerf':'ridge3', 'einstein':'ridge3'};

var room_list = [bonjovi, showcase, donkeykong, tetris, cerf, einstein];

var available_keywords = ['available', 'free', 'open', 'empty'];
var occupied_keywords = ['occupied', 'inuse', 'taken', 'busy', 'unavailable'];

//process.stdout.write(ridge1);

// INCOMING NOTIFICATIONS
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());

app.get('/blah', function(req, res) {
  res.send('Hello Seattle\n');
});
app.post('/motion', function(req, res) {
  console.log("Got motion from IFTTT: " + JSON.stringify(req.body))
  //var body_dict = JSON.parse(req.body);
  
  updateRoomStatusForMotion(req.body);

  res.send('Got it!\n');
});
app.listen(8082);
console.log('Listening on port 8082...');

///
// Help and fallback commands
//
bot.onCommand("help", function (command) {
    
    var outputString = "<h2> I can help you find empty meeting rooms in your building!"
                    + "</h2> <h3> Here are some commands that you can use! </h3>"
                    + "<p> Don't forget to tag me before every command! (@MeetBotHuron)  <ul> <li> RoomStatus {roomname} </li> <li> Find {status} rooms on {floor-specifier} </li> </ul> "
                    + "	</ul> <ul> <li> Status: {available, open, free, empty, inuse, occupied, taken, unavailable, any, all} </li> </ul> "
                    + "	<ul> <li> Floor Specifiers: {first floor, 1st floor, floor 1, floor one} </li> "
                    + "	</ul>"
                    + "<b> Note: </b> Unfortunately building specifiers are not yet ready! \n\n<br>"
                    + "<b> Examples </b>: "
                    + " <ul> <li> RoomStatus </li> <li> Roomstatus CERF </li> <li> Find available rooms on the 1st floor </li>"
                    + "<li> find any rooms on floor 3 </li> <li> Find all occupied rooms on the floor two</li> <li> find available rooms on the second floor </li> </ul>"
                    + "I encourage you to try all kinds of possibilities and let us know your result! "
                    + "</p> "

    
    spark.createMessage(command.message.roomId, outputString, { "markdown":true }, function(err, message) {
        if (err) {
            console.log("WARNING: could not post message to room: " + command.message.roomId);
            return;
        }
    });
});
bot.onCommand("fallback", function (command) {
    spark.createMessage(command.message.roomId, "Sorry, I did not understand.\n\n. {Did you mean find or roomstatus?} Try help", { "markdown":true }, function(err, response) {
        if (err) {
            console.log("WARNING: could not post Fallback message to room: " + command.message.roomId);
            return;
        }
    });
});


//
// Bots commands here
//
bot.onCommand("hello", function (command) {
    var email = command.message.personEmail; // Spark User that created the message orginally 
    spark.createMessage(command.message.roomId, "Hello <@personEmail:" + email + ">", { "markdown":true }, function(err, message) {
        if (err) {
            console.log("WARNING: could not post Hello message to room: " + command.message.roomId);
            return;
        }
    });
});

bot.onCommand("Roomstatus", function(command) {
        handleRoomStatus(command, 'Roomstatus')
});

bot.onCommand("roomStatus", function(command) {
        handleRoomStatus(command, 'roomStatus')
});

bot.onCommand("roomstatus", function(command) {
        handleRoomStatus(command, 'roomstatus')
});

bot.onCommand("RoomStatus", function(command) {
        handleRoomStatus(command, 'RoomStatus')
});

bot.onCommand("find", function (command) {
    handleFindMessage(command);
});

bot.onCommand("Find", function (command) {
      handleFindMessage(command);
});

//
// Welcome message 
// sent as the bot is added to a Room
//
bot.onEvent("memberships", "created", function (trigger) {
    var newMembership = trigger.data; // see specs here: https://developer.ciscospark.com/endpoint-memberships-get.html
    if (newMembership.personId != bot.interpreter.person.id) {
        // ignoring
        console.log("new membership fired, but it is not us being added to a room. Ignoring...");
        return;
    }

    // so happy to join
    console.log("bot's just added to room: " + trigger.data.roomId);
    
    spark.createMessage(trigger.data.roomId, "Hi, I am the Meeting bot !\n\nType help to see me in action.", { "markdown":true }, function(err, message) {
        if (err) {
            console.log("WARNING: could not post Hello message to room: " + trigger.data.roomId);
            return;
        }

        if (message.roomType == "group") {
            spark.createMessage(trigger.data.roomId, "**Note that this is a 'Group' room. I will wake up only when mentionned.**", { "markdown":true }, function(err, message) {
                if (err) {
                    console.log("WARNING: could not post Mention message to room: " + trigger.data.roomId);
                    return;
                }
            });
        }      
    }); 
});

function createOutputString(room)
{
    var utc_time = new Date(room['timestamp']);
    var local_time = moment.tz(utc_time, "America/New_York");
    console.log("room timestamp "+ room['timestamp'])
    console.log("local time " + local_time.format())

    var outputString = "<h2> "+room['name']+ "<ul><li> Status: <b> "+ room['status'] + "</b> <li> Last Known In-use time: "+ local_time.format('LLL') + "<li> Max Occupancy: "+ room['occupancy'] + " <li> Location: "+ room['location']+ "</ul>";
    return outputString;
}

function findRooms(building, floor, status)
{
    var outputString = "";
    
    switch (building)
    {
        case 'ridge':
            switch (floor)
            {
                case 'first':
                    outputString = findRoomsByStatus(ridge1, status);
                    break;
                case 'second': 
                    outputString = findRoomsByStatus(ridge2, status);
                    break;
                case 'third':
                    outputString = findRoomsByStatus(ridge3, status);
                    console.log("I am coming here")
                    break;
                default:
                    outputString = findRoomsByStatus(ridge1, status) + findRoomsByStatus(ridge2, status) + findRoomsByStatus(ridge3, status);
            }
    }
    return outputString;
}

function findRoomsByStatus(floor, expected_status)
{
    var key, room;
    var outputString = "";
    for (key in floor)
    {
        room = floor[key];
        console.log("expected status" + expected_status)
        if(room['status'] == expected_status)
        {
            outputString+=createOutputString(room);
        }
    }
    return outputString;
}

function findStatus(inputString)
{
    var showavailablestatus = false;
    var showoccuppiedstatus = false;
    
    var i;
    
    for(i=0;i<available_keywords.length;i++)
    {
        if(inputString.indexOf(available_keywords[i]) != -1)
        {
            showavailablestatus = true;
            break;
        }
    }
    
    for(i=0;i<occupied_keywords.length;i++)
    {
        if(inputString.indexOf(occupied_keywords[i]) != -1)
        {
            showoccuppiedstatus = true;
            break;
        }
    }

    return [showavailablestatus, showoccuppiedstatus];
}


function findFloor(inputString)
{
    var floorIndex = inputString.indexOf('floor');
    
    var found = false;
    var i;
    
    if(floorIndex != -1)
    {
        var tokens = inputString.split(" ");
        var floortoken;
        
        for (i=2; i<tokens.length;i++)
        {                
            console.log(tokens[i])

            if(tokens[i] == 'floor')
            {
                floortoken = i;
                //console.log("floortoken is:", floortoken);
                break;
            }
        }
        
        if (tokens[floortoken-1] in floor)
        {
            return floor[tokens[floortoken-1]];
        }
        if (tokens[floortoken+1] in floor)
        {
            return floor[tokens[floortoken+1]];
        }
    }
    return 0;
}

function processAnyAll(inputString, floor, email)
{
    var outputString = "";
    console.log(inputString);

    if (inputString.indexOf('any') != -1 || inputString.indexOf('all') != -1)
    {
        switch (floor)
        {
            case 'first':
                outputString = findRoomsByStatus(ridge1, 'available') + findRoomsByStatus(ridge1, 'inuse');
                break;
            case 'second':
                outputString = findRoomsByStatus(ridge2, 'available') + findRoomsByStatus(ridge2, 'inuse');
                break;
            case 'third':
                outputString = findRoomsByStatus(ridge3, 'available') + findRoomsByStatus(ridge3, 'inuse');
                break;
            default:
                outputString = "Sorry <@personEmail:"+email+"> Invalid floor. Please use RoomStatus to see status of all rooms or specify a floor ";                
        }
    }
    else
    {
        outputString = "Sorry <@personEmail:"+email+"> cannot match any rooms for the above query ";
    }
    return outputString;
}


function updateRoomStatusForMotion(request_body)
{
    var roomname = request_body['DeviceName'].toLowerCase();

    var old_time_string = request_body['DetectedAt'].replace(" at "," ").replace(",", "").replace("PM", " pm").replace("AM", " am");
    console.log("old_time_string "+old_time_string)
    var old_time = new Date(old_time_string);

    switch (roomname) {
        case 'cerf':
            cerf['status'] = 'inuse';
            cerf['timestamp'] = old_time;
            // code
            break;
        case 'einstein':
            einstein['status'] = 'inuse';
            einstein['timestamp'] = old_time;
            break;
        default:
            // code
    }
}

function updateStatusForAllRooms()
{
    updateRoomStatusForSingleRoom(cerf);
    updateRoomStatusForSingleRoom(einstein);
    updateRoomStatusForSingleRoom(showcase);
    updateRoomStatusForSingleRoom(donkeykong);
    updateRoomStatusForSingleRoom(tetris);
}

function handleFindMessage(command)
{
    var current_time = new Date();
    updateStatusForAllRooms(current_time);

     var text = command.message.text;
     var statuses = findStatus(text.toLowerCase());
     var floor = findFloor(text.toLowerCase());
     var email =  command.message.personEmail;
     var outputString = "";
     
     console.log("statuses "+statuses)
     
     if (statuses[0] == true)
     {
         outputString += findRooms('ridge', floor, 'available');
     }

     if (statuses[1] == true)
     {
         outputString += findRooms('ridge', floor, 'inuse');
     }
     
     if (statuses[0] == false && statuses[1] == false)
     {
         outputString = processAnyAll(text.toLowerCase(), floor, email);
         if (outputString.indexOf('Sorry') == -1)
            {
                outputString = "Hello <@personEmail:"+email+">, here's what I got! \n\n"+outputString;
            }
         console.log(outputString);
     }
     else
     {
         if (outputString)
         {
             outputString = "Hello <@personEmail:"+email+">, here's what I got! \n\n"+outputString;
         }
         else
         {
              outputString = "Sorry <@personEmail:"+email+"> cannot match any rooms for the above query ";                
         }
     }

    spark.createMessage(command.message.roomId, outputString, { "markdown":true }, function(err, message) {
        if (err) {
            console.log("WARNING: could not post Hello message to room: " + command.message.roomId);
            return;
        }
    });
}

function handleRoomStatus(command, input_message)
{
        //var roomname = roomname;
    console.log("Hello RoomStatus");
    updateStatusForAllRooms();

    var text = command.message.text;
    var email =  command.message.personEmail;

    var indexOfRoomStatus = text.indexOf(input_message);
    var indexOfRoomName = indexOfRoomStatus + input_message.length+1;
    var roomname = text.substring(indexOfRoomName).trimLeft().toLowerCase();
    console.log("Roomname "+roomname);
    var building = 'unknown';

    if (roomname in room_building_map)
    {
        building = room_building_map[roomname];
    }
    var room;
    var allrooms = false;
    
    if (!roomname)
    {
        building = 'allrooms';
    }
    var outputString;
    console.log("RoomStatus: roomname" + roomname + "building: " + building )
    
    switch (building)
    {
        case 'ridge1':
            outputString = createOutputString(ridge1[roomname]);
            break;
        case 'ridge2':
            outputString = createOutputString(ridge2[roomname]);
            break;
        case 'ridge3':
            outputString = createOutputString(ridge3[roomname]);
            break;
        case 'allrooms':
            outputString  = createAllRoomOutputString();
            break;
        default:
            room = 'unknown'
    }
    
    if (outputString)
    {
        outputString = "Hello <@personEmail:"+email+">, here's what I got! \n\n"+outputString+ " ";
    }
    else
    {
        outputString = "Sorry <@personEmail:"+email+"> cannot match any rooms for the above query ";
    }
    
    //If we have roomname -> we search for that roomname and return the 3 variables
    // If we don't then -> Room name unknown 
    spark.createMessage(command.message.roomId, "" + outputString + " ", { "markdown":true }, function(err, message) {
        if (err) {
            console.log("WARNING: could not post Hello message to room: " + command.message.roomId);
            return;
        }
    });
}


function updateRoomStatusForSingleRoom(room)
{
    var current_time = new Date();

    var difference = current_time.getTime() - room['timestamp'].getTime();
    
    //console.log("old time "+old_time + " new time " +current_time)
    console.log(" difference = "+difference)
    
    if(difference > inactive_time)
    {
        room['status'] = 'available';
    }    
}

function createNewRoom(roomname, occupancy, location)
{
    var room = {};
    room['name'] = roomname;
    room['timestamp'] = current_time;
    room['status'] = 'available';
    room['occupancy'] = occupancy;
    room['location'] = location;
    
    return room;
    
}

function createAllRoomOutputString()
{
    var i;
    var outputString=" ";
    for (i=0; i<room_list.length;i++)
    {
        outputString+=createOutputString(room_list[i]);
    }
    
    return outputString;
}
