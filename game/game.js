// 'game' manages existing gameInstances, creates new ones,
// and routes socket input and output

var io = require('socket.io')

var games = []; // array of gameInstances
var gamesCreated = 0;
var cumulativePlayersConnected = 0;
var stepsTaken = 0;
var serverLaunched = new Date();

var namer = require('./namer.js'); // provides unique names for dungeons and players
var gameInstance = require('./gameInstance.js'); // gameInstance constructor

module.exports = function ( server ){
  setUpSocketListener( server );

  var game = {}; // the object returned by this function

  function newGame (){ // create a new gameInstance with a unique name and add it to games[]
    var newGameInstance = gameInstance.newGameInstance( namer.randomGameName( games ), io, destroyGameInstance );
    games.push( newGameInstance );

    // no players connect within 30 sec? Destroy the game instance
    newGameInstance.timeout = setTimeout( function(){ console.log(newGameInstance.name + ' timeout fired'); destroyGameInstance( newGameInstance.name ); }, 30000 );

    gamesCreated++;

    return newGameInstance.name;
  };
  game.newGame = newGame;

  // does game with 'name' exist? returns bool
  function exists ( name ){
    if ( games ){
      for ( var i = 0; i<games.length; i++ ){
        if ( games[i] && games[i].name === name ) {
         return true;
        }
      }
    }
    return false;
  };
  game.exists = exists;

  // builds the dungeonData object sent to client via ajax (see server.js)
  function clientDungeon ( gameName ) {
    var gameIndex = findIndexOfGameInstanceByName( gameName );
    if ( gameIndex >= 0 ){
      return games[ gameIndex ].dungeon;
    } else {
      console.log( gameName + ' not found, clientDungeon() failed.');
      return null;
    }
  };
  game.clientDungeon = clientDungeon;

  function getStatus(){
    var status = {};
    status.serverTime = new Date();
    status.games = [];
    status.gamesCreated = gamesCreated;
    status.stepsTaken = stepsTaken;
    status.cumulativePlayersConnected = cumulativePlayersConnected;
    status.totalPlayerCount = 0;
    status.serverLaunched = serverLaunched;

    for ( var i = 0; i < games.length; i++ ){
      status.games[i] = {};
      status.games[i].gameName = games[i].name;
      status.games[i].createdDate = games[i].createdDate;
      status.games[i].isPrivate = games[i].isPrivate;
      status.games[i].roster = [];
      for ( var j = 0; j < games[i].roster.length; j++ ){
        status.totalPlayerCount++;
        status.games[i].roster[j] = {};
        status.games[i].roster[j].playerName = games[i].roster[j].name;
        status.games[i].roster[j].level = games[i].roster[j].location.depth;
        status.games[i].roster[j].playerClass = games[i].roster[j].playerClass;
        status.games[i].roster[j].socket = games[i].roster[j].socket.id;
      }
    }

    return status;
  }
  game.getStatus = getStatus;

  return game;
};

// route socket traffic to respective gameinstances
function setUpSocketListener( server ){
  io = io.listen(server);

  io.sockets.on('connection', function( socket ){
    socket.on('joinGame', function(){
      var referer = socket.request.headers.referer;
      var n = referer.lastIndexOf('/');
      var room = referer.substring(n + 1);
    
      var index = findIndexOfGameInstanceByName( room );
      if ( index >= 0 ){
        if ( games[index].roster.length >= 10 ){
          console.log( room + ' is full and a player was turned away.' );
          socket.emit( 'tryagain', 'This dungeon is full.' );
        } else {
          cumulativePlayersConnected++;
          socket.join( room );
          games[index].addPlayerToRoster( socket );

          socket.on('requestDungeon', function(){
            socket.emit( 'loadDungeon', games[index].dungeon );
          });

          // can't choose class until a game is joined
          socket.on('chosePlayerClass', function ( playerClass ){
            if ( games[index] ) games[index].chosePlayerClass( socket, playerClass );

            // can't register movement until player chose a class
            socket.on('move', function( direction ){
              stepsTaken++;
              if ( games[index] ) games[index].move( socket, direction );
            });

            socket.on('stairs', function( direction ){
              if ( games[index] ) games[index].stairs( socket, direction );
            });
          });

          socket.on( 'ping', function( timeSentFromClient ){
            if ( games[index] ) games[index].updateLastAction( socket );
            socket.emit('pong', timeSentFromClient );
          });

          // disconnections don't really matter unless the socket
          // is associated with a room. socket.io docs say that
          // rooms are destroyed after all joined users d/c
          socket.on('disconnect', function(){
            if ( games[index] ) games[index].leaveGame( socket );
            if ( games[index] && games[index].roster.length < 1 ){
              destroyGameInstance( room );
            }
          });
        }
      } else {
        console.log( room + ' doesn\'t exist but ' + socket.id + ' tried to join it anyway.' );
        socket.emit('tryagain', 'That game doesn\'t exist.' );
      }
    });
  });
}

// given a gameInstance name, splice it from games[]
function destroyGameInstance( gameName ){
  var index = findIndexOfGameInstanceByName( gameName );
  if ( index >= 0 ){
    clearInterval( games[index].idlerCheckInterval );
    games.splice( index, 1 );
    console.log( gameName + ' was destroyed.' );
  } else {
    console.log( gameName + ' could not be destroyed.' );
  }
}

// given a name, returns the index of the game in games[]
function findIndexOfGameInstanceByName( name ){
  for ( var j = 0; j<games.length; j++ ){
    if ( games && games[j] && games[j].name == name ) return j;
  }
  console.log( name + ' not found by fIOGIBN()' );
  return -1;
}
