var namer = require('./namer.js'); // provides unique names for dungeons and players
var dungeon = require('./dungeon.js'); // maze generation, entity handling, etc

// A new game instance needs access to the sockets.io server
// It probably should be rewritten to not need those things.
module.exports.newGameInstance = function ( name, io, destroyGameInstance ){
  console.log( name + ' is being created.' );
  var gameInstance = {}; // the object that we will eventually return
  gameInstance.name = name; // convenience
  gameInstance.createdDate = new Date();
  gameInstance.roster = []; // array of players currently connected
  gameInstance.isPrivate = false; // shows up in public game browser?
  gameInstance.dungeon = dungeon.newDungeon(); // builds the entire dungeon, see dungeon.js

  gameInstance.idlerCheckInterval = setInterval( function(){ checkForIdlers() }, 15000 );

  function checkForIdlers(){
    var rightNow = new Date();
    for ( var i = 0; i < gameInstance.roster.length; i++ ){
      if ( rightNow - gameInstance.roster[i].lastActive > 15000 ){
        console.log( gameInstance.name + ' is booting ' + gameInstance.roster[i].name );
        gameInstance.roster[i].socket.emit('tryagain', 'You have been kicked for inactivity.' );
        gameInstance.leaveGame( gameInstance.roster[i].socket );
        if ( gameInstance.roster.length < 1 ) destroyGameInstance( gameInstance.name );
      }
    }
  }

  gameInstance.addPlayerToRoster = function ( socket ){
    // timeout was set in game.js
    if ( gameInstance.timeout ) {
      clearTimeout( gameInstance.timeout );
      gameInstance.timeout = null;
      console.log( gameInstance.name + '\'s timeout has been cleared.' );
    }
    var player = new Player();
    player.socket = socket;
    gameInstance.roster.push( player );
    console.log( name + ' has been breached by ' + player.name + '. There are now ' + gameInstance.playerCount() + ' players' );
    socket.emit( 'joinedGame', { gameName: gameInstance.name, 'playerName': player.name });
  };

  gameInstance.chosePlayerClass = function( socket, playerClass ){
    var index = findPlayerBySocketID( socket.id );
    if ( index >= 0 ){
      var player = gameInstance.roster[ index ];
      console.log( gameInstance.name + '\'s ' + player.name + ' is a ' + playerClass );
      player.playerClass = playerClass;
      player.location.x = gameInstance.dungeon.levels[0].spawn.x;
      player.location.y = gameInstance.dungeon.levels[0].spawn.y;
      player.location.depth = 0;
      player.ready = true;
      player.alive = true;
      // all players except player that just chose a class get this event
      // because client doesn't listen for PCJoined until after PCRoster
      io.sockets.to(gameInstance.name).emit('PCJoined', { playerName: player.name,
                                                    location: { x: player.location.x,
                                                                y: player.location.y,
                                                                depth: player.location.depth },
                                                    playerClass: player.playerClass } );
      // only the player that just joined gets the current roster
      socket.emit('PCRoster', buildClientFriendlyRoster() );
    } else {
      console.log('chosePlayerClass(), couldn\'t find player in roster' );
    }
  };

  gameInstance.updateLastAction = function( socket ){
    var index = findPlayerBySocketID( socket.id );
    if ( index >= 0 ){
      var player = gameInstance.roster[ index ];
      player.lastActive = new Date();
    } else {
      console.log('got heartbeat from player not in roster' );
    }
  };

  gameInstance.move = function( socket, direction ){
    var playerIndex = findPlayerBySocketID( socket.id ) ;
    if ( playerIndex >= 0 ){
      var player = gameInstance.roster[ playerIndex ];
      var x = player.location.x;
      var y = player.location.y;
      var levelMap = gameInstance.dungeon.levels[player.location.depth].levelMap;

      if ( direction === 'N' ){
        y -= 1;
      } else if ( direction === 'S' ){
        y += 1;
      } else if ( direction === 'E' ){
        x += 1;
      } else if ( direction === 'W' ){
        x -= 1;
      } else if ( direction === 'NW' ){
        x -= 1;
        y -= 1;
      } else if ( direction === 'NE' ){
        x += 1;
        y -= 1;
      } else if ( direction === 'SW' ){
        x -= 1;
        y += 1;
      } else if ( direction === 'SE' ){
        x += 1;
        y += 1;
      }
      if ( !levelMap[x][y].isWall ) {
        player.location.x = x;
        player.location.y = y;

        var updateData = {};
        updateData.playerName = player.name;
        updateData.location = player.location;
        updateData.playerClass = player.playerClass;
        io.sockets.to(gameInstance.name).emit( 'PCMoved', updateData );
      }
    } else {
      console.log( gameInstance.name + ' got move signal from unnamed adventurer.' );
    }
  };

  gameInstance.stairs = function ( socket, direction ){
    // direction is true: go to next level in dungeon (descend)
    // direction is false: go to previous level in dungeon (ascend)
    var playerIndex = findPlayerBySocketID( socket.id );
    if ( playerIndex >= 0 ){
      var fromStairs = ( direction ? 'exit' : 'spawn' );
      var toStairs = ( !direction ? 'exit' : 'spawn' );
      var player = gameInstance.roster[playerIndex];
      if ( player.location.x === gameInstance.dungeon.levels[ player.location.depth ][ fromStairs ].x &&
           player.location.y === gameInstance.dungeon.levels[ player.location.depth ][ fromStairs ].y &&
           player.location.depth !== ( direction ? 4 : 0 )
      ){
        player.location.depth += ( direction ? 1 : -1 );
        player.location.x = gameInstance.dungeon.levels[ player.location.depth ][ toStairs ].x;
        player.location.y = gameInstance.dungeon.levels[ player.location.depth ][ toStairs ].y;

        var updateData = {};
        updateData.playerName = player.name;
        updateData.location = player.location;
        updateData.playerClass = player.playerClass;
        socket.emit( 'PCStairs', updateData );
        io.sockets.to(gameInstance.name).emit( 'PCMoved', updateData );
      }
    } else {
      console.log( gameInstance.name + ' got stairs signal from unnamed adventurer.' );
    }
  };

  gameInstance.leaveGame = function ( socket ){
    var playerIndex = findPlayerBySocketID( socket.id );

    // splice the disconnected player from roster
    if ( playerIndex >= 0 ) {
      var player = gameInstance.roster[ playerIndex ];
      gameInstance.roster.splice( playerIndex, 1 );

      var updateData = {};
      updateData.playerName = player.name;
      updateData.location = {};
      updateData.location.x = player.location.x;
      updateData.location.y = player.location.y;
      updateData.location.depth = player.location.depth;

      io.sockets.to(gameInstance.name).emit( 'PCDied', updateData );
      console.log( gameInstance.name + ' frightened away ' + player.name + '. ' + gameInstance.playerCount() + ' players remain.');
    } else {
      console.log( gameInstance.name + ' frightened away an unnamed adventurer. ' + gameInstance.playerCount() + ' players remain.' );
    }
  };

  // player constructor
  function Player ( socket ){
    this.socket = socket;
    this.level = 0;
    this.location = { x: 0, y: 0, depth: 0 };
    this.ready = false;
    this.dead = false;
    this.health = 100;
    this.playerClass;
    this.lastActive = new Date();
    this.name = namer.randomPlayerName( gameInstance.roster );
  }

  // returns number of players connected to server
  gameInstance.playerCount = function ( ) {
    return gameInstance.roster.length;
  };

  // returns array with list of player names
  gameInstance.playerList = function(){
    if ( gameInstance.roster && gameInstance.roster.length > 0 ){
      var list = [];
      for ( var j = 0; j<gameInstance.roster.length; j++ ){
        list.push( gameInstance.roster[j].name );
      }
      return list;
    } else return [];
  };

  // returns index of player with socket ID in roster[]
  function findPlayerBySocketID( id ){
    if ( gameInstance.roster && gameInstance.roster.length > 0 ){
      for ( var j = 0; j<gameInstance.roster.length; j++ ){
        if ( gameInstance.roster[j].socket.id == id ) return j;
      }
    } else {
      console.log( 'fPBSID() failed' );
      return -1;
    }
  }

  
  function buildClientFriendlyRoster(){
    pcfRoster = []
    for ( var i = 0; i < gameInstance.roster.length; i++ ){
      // only include players that have already chosen their class
      if ( gameInstance.roster[i].playerClass ){
        pcfRoster.push({
          playerName: gameInstance.roster[i].name,
          playerClass: gameInstance.roster[i].playerClass,
          location: {
            x: gameInstance.roster[i].location.x,
            y: gameInstance.roster[i].location.y,
            depth: gameInstance.roster[i].location.depth
          }
        });
      }
    }
    return pcfRoster;
  }

  return gameInstance;
}
