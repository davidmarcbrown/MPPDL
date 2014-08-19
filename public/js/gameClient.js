$( function(){
  // sockets
  var socket = io('/');

  // ping
  var ping = new Date(); // now
  var pong; // to be defined by response

  console.log('Trying to join game...');
  socket.emit( 'joinGame' );

  // if we don't get a player after 10s, we're probably not going to
  var timeout = setTimeout( function(){tooslow();}, 10000 );

  // pong contains game name and player name
  socket.on('joinedGame', function( gameInfo ){
    var gameName = gameInfo.gameName;
  
    $('#loading').text('Badgering the cartographers...');
    if ( timeout ) clearTimeout( timeout );

    var playerName = gameInfo.playerName;

    // fills in the playername in the EJS template (with jquery, not templating)
    $('#playerName').text( playerName );

    // what's the response time?
    pong = new Date();
    console.log( 'Joined game ' + gameName + ' after ' + (pong-ping) + " ms" );

    // acquire dungeon data
    ping = new Date();
    $.post("/api/game", { gameName : gameName, command : 'requestDungeon', playerName: playerName }, function ( data ){
      // what's the response time?
      pong = new Date();
      console.log( 'Recieved dungeon data in ' + (pong-ping) + " ms" );

      // lets get this party started
      // (gets started drawing the dungeon while the player
      // chooses their player class)
      phaserLaunch( data, socket, playerName );
    }, 'json');

    // set up repeating ping
    socket.emit( 'ping', new Date() );
    socket.on( 'pong', function( timeSentFromClient ){
      timeSentFromClient = new Date( timeSentFromClient );
      $('#ping').text( new Date() - timeSentFromClient + 'ms' );
      setTimeout( function(){pingFunc();},2000);
    });
  });

  // some kind of booboo that the server will hopefully try to explain
  socket.on('tryagain', function( reason ){
      $('#err').text('Something went wrong: ' + reason + ' Reload the page and try again.' );
      $('#err').fadeIn();
  });

  // that probably wasn't supposed to happen
  socket.on('disconnect', function(){
    $('#ping').text('NOPE');
    $('#err').text('You have lost contact with the dungeon master. Reload the page and try again.');
    $('#err').fadeIn();
  });

  // see repeating ping mechanism above
  function pingFunc(){
    $('#ping').text( 'updating...' );
    socket.emit( 'ping', new Date() );
  }

  // too slow getting response from sockets
  function tooslow(){
    console.log("Didn't get 'pong' back from server before the timeout");
    $('#err').text('You were unable to forge a psychic link with the dungeon master. Reload the page and try again.');
    $('#err').fadeIn();
  }
});

// launches phaser after receiving static dungeon info from server
function phaserLaunch ( dungeonData, socket, playerName ) {
  var game = new Phaser.Game( 256, 256, Phaser.AUTO, 'canvasDiv', { preload: preload, create: create, update: update, render: render });

  var map; // the phaser tilemap, we use this for all levels and just redraw it with new levels when player ascends/descends
  var layer; // should probably just be using map (see above), since the tilemap is a single layer
  var player = {}; // you/us, the player, this client
  var roster = []; // all players on server, including this client

  // keyboard controls
  var Qkey, Wkey, Ekey;
  var Akey, Dkey;
  var Zkey, Xkey, Ckey;

  // numpad controls
  var num7, num8, num9;
  var num4, num6;
  var num1, num2, num3;

  // more movement business
  var cursors;
  var lastMove = new Date();
  var movementDirection = false;

  // phaser loads and caches visual assets here
  function preload() {
    $('#loading').text('Collecting decorative stone...');
    game.load.image('dungeonTiles', '/assets/dungeon.png');

    $('#loading').text('Gathering elf tears...');
    game.load.spritesheet('GUI0', '/assets/GUI0.png', 16, 16, 304);

    $('#loading').text('Poking through driftwood...');
    game.load.spritesheet('doors0', '/assets/doors0.png', 16, 16, 40);

    $('#loading').text('Still poking...');
    game.load.spritesheet('doors1', '/assets/doors1.png', 16, 16, 40);

    $('#loading').text('Petitioning heroes...');
    game.load.spritesheet('player0', '/assets/player0.png', 16, 16, 120);

    $('#loading').text('Teasing the cowards...');
    game.load.spritesheet('player1', '/assets/player1.png', 16, 16, 120);

    $('#loading').text('Finding tapestries to tie the room together...');
    game.load.spritesheet('decor0', '/assets/decor0.png', 16, 16, 176);

    $('#loading').text('Looking for stairs to fall down...');
    game.load.spritesheet('ground', '/assets/ground.png', 16, 16, 56 );

    $('#loading').text('Importing exotic dirt...');
    game.load.spritesheet('tile', '/assets/tile.png', 16, 16, 32);

    $('#loading').text('Digging the dungeon...');
  }

  // run once. include class selection and first time drawing dungeon
  function create() {
    $('#loading').text('Clearing space in a dank underground hole...');
    game.stage.backgroundColor = '#000000';

    // dungeon drawing
    map = game.add.tilemap();
    map.addTilesetImage('dungeonTiles', 'dungeonTiles', 16, 16, 0, 0 );
    layer = map.create('dungeon', 64, 64, 16, 16);
    drawDungeon( 0 );
    layer.resizeWorld();

    // camera placement
    game.camera.x = dungeonData.levels[0].spawn.x * 16 - 112;
    game.camera.y = dungeonData.levels[0].spawn.y * 16 - 112;

    // ok, ready to put the player in the game.
    // just have to get one little detail out of the way...
    // what class is this client?
    $('#loading').fadeOut();
    $('#classPicker').fadeIn();
    $('#knight').click('knight', choosePlayerClass );
    $('#mage').click('mage', choosePlayerClass );
    $('#rogue').click('rogue', choosePlayerClass );

    // can continue after choosing class
    function choosePlayerClass( event ){
      // can only choose class once
      $('#classPicker').fadeOut();
      $('#loading').text('Fetching your weapons and armor...');
      $('#loading').fadeIn();

      // add important info to the player object
      player.playerName = playerName;
      player.playerClass = event.data;
      player.location = {};
      player.location.x = dungeonData.levels[0].spawn.x
      player.location.y = dungeonData.levels[0].spawn.y
      player.location.depth = 0;
      player.ready = false;

      // set the player's sprite and frame of 'player' spritesheet
      var frame = 0;
      if ( player.playerClass === 'knight' ) frame = 25; // knight
      if ( player.playerClass === 'mage' ) frame = 30; // mage
      if ( player.playerClass === 'rogue' ) frame = 34; // rogue

      // place player sprite at world coords of the spawn tile
      var spawnTile = map.getTile( dungeonData.levels[0].spawn.x, dungeonData.levels[0].spawn.y);
      player.sprite = game.add.sprite( spawnTile.worldX, spawnTile.worldY, 'player0', frame );

      // add nametag
      player.nameTag = game.add.text( spawnTile.worldX, spawnTile.worldY-16, player.playerName, {font: "12px Smythe", fill: "#fff" } );

      // camera follows client's PC on stage
      game.camera.follow( player.sprite );

      // tell the server this player chose a class.
      // server responds by sending the current player roster
      socket.emit('chosePlayerClass', player.playerClass);

      // no controls or player character network events until we have the roster
      socket.on('PCRoster', function( rosterData ){
        $('#loading').text('Looking for friends...');

        console.log( 'Received roster from server' );
        // local roster now in sync with server
        roster = rosterData;

        // replaces the player's reference in the server supplied roster
        // with the local reference to the player
        var index = getPlayerIndexByName( player.playerName );
        if ( index >= 0 ){
          roster[index] = player;
        } else {
          console.log('PCRoster, couldn\'t find self in roster');
        }

        // create sprites for existing players, not including self
        for ( var i = 0; i < roster.length; i++ ){
          if ( i !== index ){
            var frame = 0;
            if ( roster[i].playerClass === 'knight' ) frame = 25; // knight
            if ( roster[i].playerClass === 'mage' ) frame = 30; // mage
            if ( roster[i].playerClass === 'rogue' ) frame = 34; // rogue
            var targetTile = map.getTile( roster[i].location.x, roster[i].location.y );
            roster[i].sprite = game.add.sprite( targetTile.worldX, targetTile.worldY, 'player0', frame );
            roster[i].nameTag = game.add.text( targetTile.worldX, targetTile.worldY-16, roster[i].playerName, {font: "12px Smythe", fill: "#fff" } );
            if ( roster[i].location.depth !== player.location.depth ){
              roster[i].sprite.visible = false;
              roster[i].nameTag.visible = false;
            }
          }
        }

        // show the game canvas
        $('#loading').fadeOut();
        $('#canvasDiv').fadeIn();

        // show the onscreen controls
        $('#controlsDiv').css({ display: 'table' });

        // controls
        console.log( 'Enabling controls');
        
        // keyboard controls - use QWE/ASD/ZXC
        Qkey = game.input.keyboard.addKey(81).onUp.add( function(){if(movementDirection==='NW')movementDirection=null;});
        Wkey = game.input.keyboard.addKey(87).onUp.add( function(){if(movementDirection==='N')movementDirection=null;});
        Ekey = game.input.keyboard.addKey(69).onUp.add( function(){if(movementDirection==='NE')movementDirection=null;});
        Akey = game.input.keyboard.addKey(65).onUp.add( function(){if(movementDirection==='W')movementDirection=null;});
        Dkey = game.input.keyboard.addKey(68).onUp.add( function(){if(movementDirection==='E')movementDirection=null;});
        Zkey = game.input.keyboard.addKey(90).onUp.add( function(){if(movementDirection==='SW')movementDirection=null;});
        Xkey = game.input.keyboard.addKey(88).onUp.add( function(){if(movementDirection==='S')movementDirection=null;});
        Ckey = game.input.keyboard.addKey(67).onUp.add( function(){if(movementDirection==='SE')movementDirection=null;});

        Qkey = game.input.keyboard.addKey(81).onDown.add( function(){movementDirection = 'NW';});
        Wkey = game.input.keyboard.addKey(87).onDown.add( function(){movementDirection = 'N';});
        Ekey = game.input.keyboard.addKey(69).onDown.add( function(){movementDirection = 'NE';});
        Akey = game.input.keyboard.addKey(65).onDown.add( function(){movementDirection = 'W';});
        Dkey = game.input.keyboard.addKey(68).onDown.add( function(){movementDirection = 'E';});
        Zkey = game.input.keyboard.addKey(90).onDown.add( function(){movementDirection = 'SW';});
        Xkey = game.input.keyboard.addKey(88).onDown.add( function(){movementDirection = 'S';});
        Ckey = game.input.keyboard.addKey(67).onDown.add( function(){movementDirection = 'SE';});   

        // numeric pad
        num7 = game.input.keyboard.addKey(103).onUp.add( function(){if(movementDirection==='NW')movementDirection=null;});
        num8 = game.input.keyboard.addKey(104).onUp.add( function(){if(movementDirection==='N')movementDirection=null;});
        num9 = game.input.keyboard.addKey(105).onUp.add( function(){if(movementDirection==='NE')movementDirection=null;});
        num4 = game.input.keyboard.addKey(100).onUp.add( function(){if(movementDirection==='W')movementDirection=null;});
        num6 = game.input.keyboard.addKey(102).onUp.add( function(){if(movementDirection==='E')movementDirection=null;});
        num1 = game.input.keyboard.addKey(97).onUp.add( function(){if(movementDirection==='SW')movementDirection=null;});
        num2 = game.input.keyboard.addKey(98).onUp.add( function(){if(movementDirection==='S')movementDirection=null;});
        num3 = game.input.keyboard.addKey(99).onUp.add( function(){if(movementDirection==='SE')movementDirection=null;});

        num7 = game.input.keyboard.addKey(103).onDown.add( function(){movementDirection = 'NW';});
        num8 = game.input.keyboard.addKey(104).onDown.add( function(){movementDirection = 'N';});
        num9 = game.input.keyboard.addKey(105).onDown.add( function(){movementDirection = 'NE';});
        num4 = game.input.keyboard.addKey(100).onDown.add( function(){movementDirection = 'W';});
        num6 = game.input.keyboard.addKey(102).onDown.add( function(){movementDirection = 'E';});
        num1 = game.input.keyboard.addKey(97).onDown.add( function(){movementDirection = 'SW';});
        num2 = game.input.keyboard.addKey(98).onDown.add( function(){movementDirection = 'S';});
        num3 = game.input.keyboard.addKey(99).onDown.add( function(){movementDirection = 'SE';}); 

        // touch controls
        $('#NW').on('mousedown touchstart', function(event){ event.preventDefault(); movementDirection = 'NW'; });
        $('#N').on('mousedown touchstart', function(event){ event.preventDefault(); movementDirection = 'N'; });
        $('#NE').on('mousedown touchstart', function(event){ event.preventDefault(); movementDirection = 'NE'; });
        $('#W').on('mousedown touchstart', function(event){ event.preventDefault(); movementDirection = 'W'; });
        $('#E').on('mousedown touchstart', function(event){ event.preventDefault(); movementDirection = 'E'; });
        $('#SW').on('mousedown touchstart', function(event){ event.preventDefault(); movementDirection = 'SW'; });
        $('#S').on('mousedown touchstart', function(event){ event.preventDefault(); movementDirection = 'S'; });
        $('#SE').on('mousedown touchstart', function(event){ event.preventDefault(); movementDirection = 'SE'; });


        $('#NW').on('mouseup touchend', function(event){ event.preventDefault(); if(movementDirection==='NW')movementDirection=null;; });
        $('#N').on('mouseup touchend', function(event){ event.preventDefault(); if(movementDirection==='N')movementDirection=null;; });
        $('#NE').on('mouseup touchend', function(event){ event.preventDefault(); if(movementDirection==='NE')movementDirection=null;; });
        $('#W').on('mouseup touchend', function(event){ event.preventDefault(); if(movementDirection==='W')movementDirection=null;; });
        $('#E').on('mouseup touchend', function(event){ event.preventDefault(); if(movementDirection==='E')movementDirection=null;; });
        $('#SW').on('mouseup touchend', function(event){ event.preventDefault(); if(movementDirection==='SW')movementDirection=null;; });
        $('#S').on('mouseup touchend', function(event){ event.preventDefault(); if(movementDirection==='S')movementDirection=null;; });
        $('#SE').on('mouseup touchend', function(event){ event.preventDefault(); if(movementDirection==='SE')movementDirection=null;; });


        // cursors
        cursors = game.input.keyboard.createCursorKeys();

        // player character network events
        console.log( 'Setting up player character events' );
        socket.on('PCJoined', function( PCData ){ PCJoined( PCData );} );
        socket.on('PCDied', function( PCData ){ PCDied( PCData );} );
        socket.on('PCMoved', function( PCData ){ PCMoved( PCData ); } );
        socket.on('PCStairs', function( PCData ){ PCStairs( PCData ); } ); 

        // player can move and do stuff now, we're all set
        player.ready = true;

      }); // end socket.on('PCRoster')
    } // end choosePlayerClass()
  }

  function update(){
    var rightNow;
    if ( player.ready && movementDirection ){
      rightNow = new Date();
      if ( (rightNow-lastMove) > 150 ){
        move(movementDirection);
        lastMove = rightNow;
      } 
    }
  }

  function render(){

  }

  // anytime a new player enters the game, server
  // broadcasts PCJoined to all players
  function PCJoined( PCData ){
    // set up the new player
    var newPlayer = {};
    newPlayer.playerName = PCData.playerName;
    newPlayer.location = PCData.location;

    // set up new player's sprite animation frame
    var frame = 0;
    if ( PCData.playerClass === 'knight' ) frame = 25; // knight
    if ( PCData.playerClass === 'mage' ) frame = 30; // mage
    if ( PCData.playerClass === 'rogue' ) frame = 34; // rogue

    // create sprite and nametag
    var targetTile = map.getTile( PCData.location.x, PCData.location.y );
    newPlayer.sprite = game.add.sprite( targetTile.worldX, targetTile.worldY, 'player0', frame );
    newPlayer.nameTag = game.add.text( targetTile.worldX, targetTile.worldY-16, newPlayer.playerName, {font: "12px Smythe", fill: "#fff" } );

    // should be invisible if this client isn't on the same depth as newPlayer
    if ( newPlayer.location.depth != player.location.depth ){
      newPlayer.sprite.visible = false;
      newPlayer.nameTag.visible = false;
    }

    // add them to the roster
    roster.push( newPlayer );
  }

  // at this time, PCDied is only broadcast by server when a player's
  // socket disconnects
  function PCDied( PCData ){
    console.log('got PCDied()');
    if ( PCData.playerName ){
      var index = getPlayerIndexByName( PCData.playerName );
      if ( index >= 0 ){
        // don't put a tombstone on top of doors, stairwells, treasure, etc
        if ( isInterestingTile( PCData.location ) ){
          roster[index].sprite.destroy();
        } else {
          // tombstones persist and are tracked with an array attached to the level
          if ( !( dungeonData.levels[PCData.location.depth].graves ) ){
            dungeonData.levels[PCData.location.depth].graves = [];
          }
          // max five tombstones
          if ( dungeonData.levels[PCData.location.depth].graves.length > 4 ){
            dungeonData.levels[PCData.location.depth].graves.shift();
          }
          // tombstones persist and will be visible while client is on the level
          roster[index].sprite.loadTexture( 'decor0', 136 );
          dungeonData.levels[PCData.location.depth].graves.push( roster[index].sprite );
        }
        // whether or not we draw a tombstone, the nametag must be destroyed
        roster[index].nameTag.destroy();

        // remove dead player from roster
        roster.splice( index, 1 );

      } else console.log('PCDied(), PC not found in roster');
    } else console.log('PCDied(), no playerName');
  }

  // after movement keypress or onscreen control touch
  function move ( dir ) {
    if ( player.ready ) {
      // don't send socket even if movement doesn't make sense.
      // this is checked server side also.
      var x = player.location.x;
      var y = player.location.y;
      if ( dir === 'N' ){
        y -= 1;
      } else if ( dir === 'S' ){
        y += 1;
      } else if ( dir === 'E' ){
        x += 1;
      } else if ( dir === 'W' ){
        x -= 1;
      } else if ( dir === 'NW' ){
        x -= 1;
        y -= 1;
      } else if ( dir === 'NE' ){
        x += 1;
        y -= 1;
      } else if ( dir === 'SW' ){
        x -= 1;
        y += 1;
      } else if ( dir === 'SE' ){
        x += 1;
        y += 1;
      }
      if ( !dungeonData.levels[player.location.depth].levelMap[x][y].isWall ){
        // server responds to ALL clients with PCMoved
        socket.emit( 'move', dir );
      }
    }
  }

  // broadcast by server anytime any player changes location
  function PCMoved( PCData ){
    if ( PCData.playerName ){
      var index = getPlayerIndexByName( PCData.playerName );
      if ( PCData.location && PCData.playerClass ){
        if ( index >= 0 ){
          // update relevant player's location in local roster
          roster[index].location = PCData.location;
          if ( roster[index].location.depth === player.location.depth ){
            var targetTile = map.getTile( roster[index].location.x, roster[index].location.y );

            // last to move gets draw priority
            roster[index].sprite.bringToTop();
            roster[index].nameTag.parent.bringToTop(roster[index].nameTag);

            // reduce the jerkiness
            var smoothMove = game.add.tween( roster[index].sprite );
            smoothMove.to({x: targetTile.worldX, y: targetTile.worldY}, 150, Phaser.Easing.Linear.InOut, true );
            var smoothMoveText = game.add.tween( roster[index].nameTag );
            smoothMoveText.to({x: targetTile.worldX, y: targetTile.worldY-16}, 150, Phaser.Easing.Linear.InOut, true );

            // change animation frame
            var changeSheet = ( roster[index].sprite.key === 'player0' ) ? 'player1' : 'player0';
            roster[index].sprite.loadTexture( changeSheet, roster[index].sprite.frame );
            roster[index].sprite.visible = true;
            roster[index].nameTag.visible = true;
          } else {
            // don't draw the moved PC's sprite if they're not on the same level as this client
            roster[index].sprite.visible = false;
            roster[index].nameTag.visible = false;
          }

          // moved player charact is this client?
          if ( roster[index].playerName === player.playerName ){
            // clear possible actions on this tile
            $('#actionDiv').empty();

            // add action buttons to local client's UI if local client can
            // do something here

            // show UI button to take stairs up if we're not at the top already
            if ( player.location.depth !== 0 &&
                 player.location.x === dungeonData.levels[ player.location.depth ].spawn.x &&
                 player.location.y === dungeonData.levels[ player.location.depth ].spawn.y ){
              $('#actionDiv').append( "<div id='stairs' class='actionButton'>Ascend</div>" );
              $('#stairs').click( function(){ stairs( false ); });
            }
            // show UI button to take stairs down if we're not on the bottom already
            if ( player.location.depth !== 4 &&
                 player.location.x === dungeonData.levels[ player.location.depth ].exit.x &&
                 player.location.y === dungeonData.levels[ player.location.depth ].exit.y ){
              $('#actionDiv').append( "<div id='stairs' class='actionButton'>Descend</div>" );
              $('#stairs').click( function(){ stairs( true ); });
            }
            // open the door if it's closed and explore beyond if it hasn't been explored yet
            var theLevel = dungeonData.levels[player.location.depth];
            if ( theLevel.levelMap[player.location.x][player.location.y].isDoor === true ){
              for ( var i = 0; i < theLevel.doors.length; i++ ){
                if ( theLevel.doors[i].x === player.location.x &&
                     theLevel.doors[i].y === player.location.y )
                {
                  if ( theLevel.doors[i].sprite ){
                    theLevel.doors[i].sprite.loadTexture( 'doors1', theLevel.doors[i].sprite.frame );
                  }
                }
              }
              explore( player.location );
            }
          }
        } else console.log('PCMoved(), PC not found in roster');
      } else console.log('PCMoved(), goofy PCData' );
    } else console.log('PCMoved(), no playerName' );
  }

  // when standing on a stairwell and this client presses the stairs button
  function stairs( direction ){
      // true is deeper into dungeon (current level + 1)
      // false is closer to the starting level (current level - 1) 
      if ( direction ){
        $('#loading').text('Descending deeper into the dungeon...');
      } else {
        $('#loading').text('Ascending back from whence you came...');
      }
      $('#loading').show();
      // server will respond with 'PCStairs' socket event
      socket.emit('stairs', direction );
  }

  // server's response to 'stairs'
  // this is only sent to the client that climbed the stairs.
  // all other clients recieve PCMoved
  function PCStairs( PCData ){
    if ( PCData.playerName && PCData.location && PCData.playerClass ){
      // remove or hide all static dungeon visual assets from level we're leaving
      clearDungeon( player.location.depth );

      // update player location
      player.location = PCData.location;

      // draw the next level of the dungeon
      drawDungeon( player.location.depth );

      // hide players on other levels
      // show players on our level
      for ( var i = 0; i < roster.length; i++ ){
        if ( roster[i].location.depth === player.location.depth ){
          if (roster[i].sprite) roster[i].sprite.visible = true;
          if (roster[i].nameTag) roster[i].nameTag.visible = true;
        } else {
          if ( roster[i].sprite ) roster[i].sprite.visible = false;
          if ( roster[i].nameTag ) roster[i].nameTag.visible = false;
        }
      }

      $('#loading').fadeOut();

    } else console.log('PCStairs(), goofy PCData' );
  }

  // most socket events sent by server include a playerName,
  // this finds that player in the local roster and returns
  // the index in the local roster
  function getPlayerIndexByName( nameToFind ){
    for ( var i = 0; i < roster.length; i++ ){
      if ( roster[i].playerName === nameToFind ){
        return i;
      }
    }
    return -1;
  }

  // returns true is location indicates an interesting tile.
  // primarily used to prevent placing a tombstone on something important
  // and obscuring the important bit from the player
  function isInterestingTile( location ){
    // location should have x, y, and depth components.
    // interesting tiles are:
    //  spawns
    //  exits
    //  treasure
    //  doors
    var theLevel = dungeonData.levels[ location.depth ];
    if ( theLevel.spawn.x === location.x && theLevel.spawn.y === location.y ) return true;  // spawn?
    if ( theLevel.exit.x === location.x && theLevel.exit.y === location.y ) return true;    // exit?
    if ( theLevel.levelMap[location.x][location.y].isDoor === true ) return true;           // door?
  }

  // marks newly discovered tiles as explored
  // and draws them
  function explore( location ){
    var theLevel = dungeonData.levels[location.depth];
    var levelMap = theLevel.levelMap;
    var x = location.x;
    var y = location.y;

    if ( levelMap[x][y].isDoor === true ){
      if ( levelMap[x-1][y].isWall === false && !levelMap[x-1][y].isExplored ){
        explore( { x: x-1, y: y, depth: location.depth } );
      } else if ( levelMap[x+1][y].isWall === false && !levelMap[x+1][y].isExplored ){
        explore( { x: x+1, y: y, depth: location.depth } );
      } else if ( levelMap[x][y-1].isWall === false && !levelMap[x][y-1].isExplored ){
        explore( { x: x, y: y-1, depth: location.depth } );
      } else if ( levelMap[x][y+1].isWall === false && !levelMap[x][y+1].isExplored ){
        explore( { x: x, y: y+1, depth: location.depth } );
      }
    } else {
      var upperBound = y;
      var lowerBound = y;
      var leftBound = x;
      var rightBound = x;

      // find upper boundary
      while (true){
        upperBound -= 1;
        if ( levelMap[x][upperBound].isWall === true || levelMap[x][upperBound].isDoor === true ) break;
      }
      while (true){
        lowerBound += 1;
        if ( levelMap[x][lowerBound].isWall === true || levelMap[x][lowerBound].isDoor === true ) break;
      }
      while (true){
        leftBound -= 1;
        if ( levelMap[leftBound][y].isWall === true || levelMap[leftBound][y].isDoor === true ) break;
      }
      while (true){
        rightBound += 1;
        if ( levelMap[rightBound][y].isWall === true || levelMap[rightBound][y].isDoor === true ) break;
      }
      for ( var i = leftBound; i <= rightBound; i++ ){
        for ( var j = upperBound; j <= lowerBound; j++ ){
          if ( !levelMap[i][j].isExplored ){
            if ( levelMap[i][j].isWall ) drawWall( i, j, levelMap, setUpTheme( theLevel.tileSet ) );
            else {
              // draw the floor
              drawFloor( i, j, location.depth, levelMap, setUpTheme( theLevel.tileSet ) );
              // draw the things on the floor just discovered: treasure, badguys, exits
              discover( i, j, theLevel );
            }
          }
          levelMap[i][j].isExplored = true;
        }
      }
    }
  }

  // when explore() draws a floor, discover (and draw) the clutter, treasure, badguys, etc. in
  // the newly discovered tiles
  function discover( x, y, level ){
    var levelMap = level.levelMap;

    // discover exits (entrances always start discovered)
    if ( level.exit.x === x && level.exit.y === y ){
      level.exit.sprite.visible = true;
    }

  }

  // removes or hides static dungeon visual assets in preparation for
  // drawing a different level on the tilemap
  function clearDungeon( depth ){
    var theLevel = dungeonData.levels[depth];

    // clear old spawn
    if ( theLevel.spawn.sprite ) theLevel.spawn.sprite.destroy( true );

    // clear old exit
    if ( theLevel.exit.sprite ) theLevel.exit.sprite.destroy( true );

    // destroy old doors, drawDungeon() will make new ones if
    // the player later returns to the level we're clearing now
    for ( var i = 0; i < theLevel.doors.length; i++ ){
      theLevel.doors[i].sprite.destroy( true );
    }

    // destroy old clutter, drawDungeon() will make new clutter
    // if the player later returns to the level we're clearing now
    for ( var i = 0; i < theLevel.clutter.length; i++ ){
      theLevel.clutter[i].destroy( true );
    }

    // hide old graves
    if ( theLevel.graves && theLevel.graves.length > 0 ){
      for ( var j = 0; j < theLevel.graves.length; j++ ){
        theLevel.graves[j].visible = false;
      }
    }
  }

  function drawDungeon( depth ){
    if ( dungeonData && dungeonData.levels && dungeonData.levels[ depth ] && dungeonData.levels[depth].tileSet ){
      console.log( 'This level is using tileSet theme ' + dungeonData.levels[depth].tileSet );
      var theme = setUpTheme( dungeonData.levels[depth].tileSet );
      var levelMap = dungeonData.levels[depth].levelMap;
      dungeonData.levels[depth].doors = [];
      dungeonData.levels[depth].clutter = [];

      $('#loading').text('Displacing solid earth...');
      map.fill( theme.wall_base, 0, 0, dungeonData.width, dungeonData.height );

      $('#loading').text('Carving out the dungeon...');
      for ( var i = 0; i < dungeonData.levels[depth].width; i++ ){
        for ( var j = 0; j < dungeonData.levels[depth].height; j++ ){
          if ( levelMap[i][j].isExplored === true ){
            if ( levelMap[i][j].isWall ){
              drawWall( i, j, levelMap, theme );
            } else {
              // drawfloor also draws doors if necessary
              drawFloor( i, j, depth, levelMap, theme );
            }
          }
        }
      }

      // add the exit
      var theTile = map.getTile( dungeonData.levels[depth].exit.x, dungeonData.levels[depth].exit.y );
      dungeonData.levels[depth].exit.sprite = game.add.sprite( theTile.worldX, theTile.worldY, 'tile', 11 );
      if ( !levelMap[ theTile.x ][ theTile.y ].isExplored ) dungeonData.levels[ depth ].exit.sprite.visible = false;

      // add the spawn (if not on first level)
      if ( depth > 0 ){
        var theTile = map.getTile( dungeonData.levels[depth].spawn.x, dungeonData.levels[depth].spawn.y );
        dungeonData.levels[depth].spawn.sprite = game.add.sprite( theTile.worldX, theTile.worldY, 'tile', 10 );
      }

      // add the tombstones
      if ( dungeonData.levels[depth].graves && dungeonData.levels[depth].graves.length > 0 ){
        for ( var k = 0; k < dungeonData.levels[depth].graves.length; k++ ){
          dungeonData.levels[depth].graves[k].visible = true;
        }
      }
    } else {
      console.log ( 'drawDungeon(), issue with dungeonData' );
      throw 'issue with dungeonData';
    }
  }

  function drawFloor( x, y, depth, levelMap, theme ){
    // surrounded by other floors
    if (  levelMap[x-1][y].isWall === false &&
          levelMap[x+1][y].isWall === false &&
          levelMap[x][y-1].isWall === false &&
          levelMap[x][y+1].isWall === false ){
      map.putTile( theme.floor_base, x, y );
    }
    // walls above and below
    else if (   levelMap[x-1][y].isWall === false &&
                levelMap[x+1][y].isWall === false &&
                levelMap[x][y-1].isWall === true &&
                levelMap[x][y+1].isWall === true ){
      map.putTile( theme.floor_horiz, x, y );
    }
    // walls left and right
    else if (   levelMap[x-1][y].isWall === true &&
                levelMap[x+1][y].isWall === true &&
                levelMap[x][y-1].isWall === false &&
                levelMap[x][y+1].isWall === false ){
      map.putTile( theme.floor_vert, x, y );
    }
    // walls above and left
    else if (   levelMap[x-1][y].isWall === true &&
                levelMap[x+1][y].isWall === false &&
                levelMap[x][y-1].isWall === true &&
                levelMap[x][y+1].isWall === false ){
      map.putTile( theme.floor_upperleft, x, y );
    }
    // walls above and right
    else if (   levelMap[x-1][y].isWall === false &&
                levelMap[x+1][y].isWall === true &&
                levelMap[x][y-1].isWall === true &&
                levelMap[x][y+1].isWall === false ){
      map.putTile( theme.floor_upperright, x, y );
    }
    // walls below and right
    else if (   levelMap[x-1][y].isWall === false &&
                levelMap[x+1][y].isWall === true &&
                levelMap[x][y-1].isWall === false &&
                levelMap[x][y+1].isWall === true ){
      map.putTile( theme.floor_lowerright, x, y );
    }
    // walls below and left
    else if (   levelMap[x-1][y].isWall === true &&
                levelMap[x+1][y].isWall === false &&
                levelMap[x][y-1].isWall === false &&
                levelMap[x][y+1].isWall === true ){
      map.putTile( theme.floor_lowerleft, x, y );
    }
    // wall left
    else if (   levelMap[x-1][y].isWall === true &&
                levelMap[x+1][y].isWall === false &&
                levelMap[x][y-1].isWall === false &&
                levelMap[x][y+1].isWall === false ){
      map.putTile( theme.floor_left, x, y );
    }
    // wall right
    else if (   levelMap[x-1][y].isWall === false &&
                levelMap[x+1][y].isWall === true &&
                levelMap[x][y-1].isWall === false &&
                levelMap[x][y+1].isWall === false ){
      map.putTile( theme.floor_right, x, y );
    }
    // wall above
    else if (   levelMap[x-1][y].isWall === false &&
                levelMap[x+1][y].isWall === false &&
                levelMap[x][y-1].isWall === true &&
                levelMap[x][y+1].isWall === false ){
      map.putTile( theme.floor_upper, x, y );
    }
    // wall below
    else if (   levelMap[x-1][y].isWall === false &&
                levelMap[x+1][y].isWall === false &&
                levelMap[x][y-1].isWall === false &&
                levelMap[x][y+1].isWall === true ){
      map.putTile( theme.floor_lower, x, y );
    }
    // endcap up
    else if (   levelMap[x-1][y].isWall === true &&
                levelMap[x+1][y].isWall === true &&
                levelMap[x][y-1].isWall === true &&
                levelMap[x][y+1].isWall === false ){
      map.putTile( theme.floor_endup, x, y );
    }
    // endcap down
    else if (   levelMap[x-1][y].isWall === true &&
                levelMap[x+1][y].isWall === true &&
                levelMap[x][y-1].isWall === false &&
                levelMap[x][y+1].isWall === true ){
      map.putTile( theme.floor_enddown, x, y );
    }
    // endcap left
    else if (   levelMap[x-1][y].isWall === true &&
                levelMap[x+1][y].isWall === false &&
                levelMap[x][y-1].isWall === true &&
                levelMap[x][y+1].isWall === true ){
      map.putTile( theme.floor_endleft, x, y );
    }
    // endcap right
    else if (   levelMap[x-1][y].isWall === false &&
                levelMap[x+1][y].isWall === true &&
                levelMap[x][y-1].isWall === true &&
                levelMap[x][y+1].isWall === true ){
      map.putTile( theme.floor_endright, x, y );
    }

    // doors
    if ( levelMap[x][y].isDoor === true ){
      var theTile = map.getTile( x, y );
      var theSprite = game.add.sprite( theTile.worldX, theTile.worldY, 'doors0', theme.door );
      dungeonData.levels[depth].doors.push( { 'sprite': theSprite, 'x': x, 'y': y } );
    }

    // clutter
    if ( levelMap[x][y].clutter ){
      var theTile = map.getTile( x, y );
      var theSprite = game.add.sprite( theTile.worldX, theTile.worldY, 'ground', theme.clutter[levelMap[x][y].clutter.clutterType] );
      dungeonData.levels[depth].clutter.push( theSprite );
    }
  }

  function drawWall( x, y, levelMap, theme ){
    // vars are are true if tested coords are wall or off the map
    var u = levelMap[x][y-1] ? levelMap[x][y-1].isWall : true; // upper tile
    var b = levelMap[x][y+1] ? levelMap[x][y+1].isWall : true; // tile below
    var r = levelMap[x+1] ? levelMap[x+1][y].isWall : true; // tile to the right
    var l = levelMap[x-1] ? levelMap[x-1][y].isWall : true; // tile to the left
    var ur = levelMap[x+1] && levelMap[x+1][y-1] ? levelMap[x+1][y-1].isWall : true; // upper right
    var ul = levelMap[x-1] && levelMap[x-1][y-1] ? levelMap[x-1][y-1].isWall : true; // upper left
    var br = levelMap[x+1] && levelMap[x+1][y+1] ? levelMap[x+1][y+1].isWall : true; // below right
    var bl = levelMap[x-1] && levelMap[x-1][y+1] ? levelMap[x-1][y+1].isWall : true; // below left

    // floor below 
    if ( !b ){
      map.putTile( theme.wall_horiz, x, y );
    }
    // floor right 
    if ( !r ){
      map.putTile( theme.wall_vert, x, y );
    }
    // floor above 
    if ( !u ){
      map.putTile( theme.wall_horiz, x, y );
    }
    // floor left 
    if ( !l ){
      map.putTile( theme.wall_vert, x, y );
    }

    // wall above and below
    if ( ( u || b ) && ( !r || !l ) ){
      map.putTile( theme.wall_vert, x, y );
    }
    // wall left and right 
    if ( ( l || r ) && ( !u || !b ) ){
      map.putTile( theme.wall_horiz, x, y );
    }

    // corner pieces
    if ( ( !br && b && r ) || ( !ul && !u && !l && b && br && r ) ){       // |-
      map.putTile( theme.wall_upperleft, x, y );
    }
    if ( ( !bl && l && b ) || ( !ur && !u && !r && b && bl && l ) ){       // -|
      map.putTile( theme.wall_upperright, x, y );
    }
    if ( ( !ul && u && l ) || ( !br && !r && !b && u && ul && l ) ){       // _|
      map.putTile( theme.wall_lowerright, x, y );
    }
    if ( ( !ur && u && r ) || ( !bl && !b && !l && u && ur && r ) ){       // |_
      map.putTile( theme.wall_lowerleft, x, y );
    }

    // endcaps
    if ( !l && !r && !b && u ){
      map.putTile( theme.wall_endcap, x, y );
    }

    // letter T
    if (  ( r && l && b ) &&
          ( ul && u && ur ) &&
          ( !bl && !br )
        ) { 
      map.putTile( theme.wall_tee, x, y );
    }
    if (  ( r && l && b ) &&
          ( !ul && !u && !ur ) &&
          ( ( !bl && br ) || ( bl && !br ) ||  ( !bl && !br ) )
        ) { 
      map.putTile( theme.wall_tee, x, y );
    }
    if ( r && l && b && !u && !( bl && br ) ){
      map.putTile( theme.wall_tee, x, y );
    }
    // inverted letter T
    if (  ( r && l && u ) &&
          ( bl && b && br ) &&
          ( !ul && !ur )
        ) { 
      map.putTile( theme.wall_inversetee, x, y );
    }
    if (  ( r && l && u ) &&
          ( !bl && !b && !br ) &&
          ( ( !ul && ur ) || ( ul && !ur ) ||  ( !ul && !ur ) )
        ) { 
      map.putTile( theme.wall_inversetee, x, y );
    }
    if ( r && l && u && !b && !( ul && ur ) ){
      map.putTile( theme.wall_inversetee, x, y );
    }
    // counter clockwise letter T
    if (  ( r && u && b ) &&
          ( ul && l && bl ) &&
          ( !ur && !br )
        ) { 
      map.putTile( theme.wall_ccwtee, x, y );
    }
    if (  ( r && u && b ) &&
          ( !bl && !l && !ul ) &&
          ( ( !ur && br ) || ( ur && !br ) ||  ( !ur && !br ) )
        ) { 
      map.putTile( theme.wall_ccwtee, x, y );
    }
    if ( r && u && b && !l && !( ur && br ) ){
      map.putTile( theme.wall_ccwtee, x, y );
    }
    // clockwise letter T
    if (  ( l && u && b ) &&
          ( ur && r && br ) &&
          ( !ul && !bl )
        ) { 
      map.putTile( theme.wall_cwtee, x, y );
    }
    if (  ( l && u && b ) &&
          ( !br && !r && !ur ) &&
          ( ( !ul && bl ) || ( ul && !bl ) ||  ( !ul && !bl ) )
        ) { 
      map.putTile( theme.wall_cwtee, x, y );
    }
    if ( l && u && b && !r && !( ul && bl ) ){
      map.putTile( theme.wall_cwtee, x, y );
    }

    // plus sign
    if ( u && r && b && l && !ul && !ur && !bl && !br ){
      map.putTile( theme.wall_cross, x, y );
    }
    if ( u && r && b && l && ( ( !ul && !br ) || ( !ur && !bl ) ) ){
      map.putTile( theme.wall_cross, x, y );
    }
  }

  // themed dungeons
  function setUpTheme( theme ){
    var tset = {};

    // clutter catch-all
    tset.clutter = [];
    tset.clutter[0] = 0;
    tset.clutter[1] = 1;
    tset.clutter[2] = 8;
    tset.clutter[3] = 9;
    tset.clutter[4] = 16;
    tset.clutter[5] = 17;

    if ( theme === 7 ) {
      // doors
      tset.door = 8;

      // floors
      tset.floor_base = 85 + 455;
      tset.floor_horiz = 89 + 455;
      tset.floor_vert = 87 + 455;
      tset.floor_upperright = 65 + 455;
      tset.floor_upperleft = 63 + 455;
      tset.floor_lowerright = 107 + 455;
      tset.floor_lowerleft = 105 + 455;
      tset.floor_left = 84 + 455;
      tset.floor_right = 86 + 455;
      tset.floor_upper = 64 + 455;
      tset.floor_lower = 106 + 455;
      tset.floor_endup = 66 + 455;
      tset.floor_enddown = 108 + 455;
      tset.floor_endleft = 88 + 455;
      tset.floor_endright = 90 + 455;

      // walls
      tset.wall_base = 10 || 885 + 896;
      tset.wall_horiz = 883 + 896;
      tset.wall_vert = 903 + 896;
      tset.wall_upperleft = 882 + 896;
      tset.wall_upperright = 884 + 896;
      tset.wall_lowerright = 926 + 896;
      tset.wall_lowerleft = 924 + 896;
      tset.wall_endcap = 904 + 896;
      tset.wall_tee = 886 + 896;
      tset.wall_inversetee = 928 + 896;
      tset.wall_ccwtee = 906 + 896;
      tset.wall_cwtee = 908 + 896;
      tset.wall_cross = 907 + 896;

      tset.clutter[0] = 4;
      tset.clutter[1] = 5;
      tset.clutter[2] = 12;
      tset.clutter[3] = 13;
      tset.clutter[4] = 20;
      tset.clutter[5] = 21;
    } else if ( theme === 6 ){
      // doors
      tset.door = 8;

      // floors
      tset.floor_base = 85 + 189;
      tset.floor_horiz = 89 + 189;
      tset.floor_vert = 87 + 189;
      tset.floor_upperright = 65 + 189;
      tset.floor_upperleft = 63 + 189;
      tset.floor_lowerright = 107 + 189;
      tset.floor_lowerleft = 105 + 189;
      tset.floor_left = 84 + 189;
      tset.floor_right = 86 + 189;
      tset.floor_upper = 64 + 189;
      tset.floor_lower = 106 + 189;
      tset.floor_endup = 66 + 189;
      tset.floor_enddown = 108 + 189;
      tset.floor_endleft = 88 + 189;
      tset.floor_endright = 90 + 189;

      // walls
      tset.wall_base = 885 + 189;
      tset.wall_horiz = 883 + 189;
      tset.wall_vert = 903 + 189;
      tset.wall_upperleft = 882 + 189;
      tset.wall_upperright = 884 + 189;
      tset.wall_lowerright = 926 + 189;
      tset.wall_lowerleft = 924 + 189;
      tset.wall_endcap = 904 + 189;
      tset.wall_tee = 886 + 189;
      tset.wall_inversetee = 928 + 189;
      tset.wall_ccwtee = 906 + 189;
      tset.wall_cwtee = 908 + 189;
      tset.wall_cross = 907 + 189;
    } else if ( theme === 5 ){
      // doors
      tset.door = 0;

      // floors
      tset.floor_base = 85 + 203;
      tset.floor_horiz = 89 + 203;
      tset.floor_vert = 87 + 203;
      tset.floor_upperright = 65 + 203;
      tset.floor_upperleft = 63 + 203;
      tset.floor_lowerright = 107 + 203;
      tset.floor_lowerleft = 105 + 203;
      tset.floor_left = 84 + 203;
      tset.floor_right = 86 + 203;
      tset.floor_upper = 64 + 203;
      tset.floor_lower = 106 + 203;
      tset.floor_endup = 66 + 203;
      tset.floor_enddown = 108 + 203;
      tset.floor_endleft = 88 + 203;
      tset.floor_endright = 90 + 203;

      // walls
      tset.wall_base = 10 || 885 + 203;
      tset.wall_horiz = 883 + 203;
      tset.wall_vert = 903 + 203;
      tset.wall_upperleft = 882 + 203;
      tset.wall_upperright = 884 + 203;
      tset.wall_lowerright = 926 + 203;
      tset.wall_lowerleft = 924 + 203;
      tset.wall_endcap = 904 + 203;
      tset.wall_tee = 886 + 203;
      tset.wall_inversetee = 928 + 203;
      tset.wall_ccwtee = 906 + 203;
      tset.wall_cwtee = 908 + 203;
      tset.wall_cross = 907 + 203;

      tset.clutter[0] = 4;
      tset.clutter[1] = 5;
      tset.clutter[2] = 12;
      tset.clutter[3] = 13;
      tset.clutter[4] = 20;
      tset.clutter[5] = 21;
    } else if ( theme === 4 ){
      // doors
      tset.door = 0;

      // floors
      tset.floor_base = 85 + 385;
      tset.floor_horiz = 89 + 385;
      tset.floor_vert = 87 + 385;
      tset.floor_upperright = 65 + 385;
      tset.floor_upperleft = 63 + 385;
      tset.floor_lowerright = 107 + 385;
      tset.floor_lowerleft = 105 + 385;
      tset.floor_left = 84 + 385;
      tset.floor_right = 86 + 385;
      tset.floor_upper = 64 + 385;
      tset.floor_lower = 106 + 385;
      tset.floor_endup = 66 + 385;
      tset.floor_enddown = 108 + 385;
      tset.floor_endleft = 88 + 385;
      tset.floor_endright = 90 + 385;

      // walls
      tset.wall_base = 885 + 385;
      tset.wall_horiz = 883 + 385;
      tset.wall_vert = 903 + 385;
      tset.wall_upperleft = 882 + 385;
      tset.wall_upperright = 884 + 385;
      tset.wall_lowerright = 926 + 385;
      tset.wall_lowerleft = 924 + 385;
      tset.wall_endcap = 904 + 385;
      tset.wall_tee = 886 + 385;
      tset.wall_inversetee = 928 + 385;
      tset.wall_ccwtee = 906 + 385;
      tset.wall_cwtee = 908 + 385;
      tset.wall_cross = 907 + 385;

      tset.clutter[0] = 2;
      tset.clutter[1] = 3;
      tset.clutter[2] = 10;
      tset.clutter[3] = 11;
      tset.clutter[4] = 18;
      tset.clutter[5] = 19;
    } else if ( theme === 3 ){
      // doors
      tset.door = 0;

      // floors
      tset.floor_base = 85 + 7;
      tset.floor_horiz = 89 + 7;
      tset.floor_vert = 87 + 7;
      tset.floor_upperright = 65 + 7;
      tset.floor_upperleft = 63 + 7;
      tset.floor_lowerright = 107 + 7;
      tset.floor_lowerleft = 105 + 7;
      tset.floor_left = 84 + 7;
      tset.floor_right = 86 + 7;
      tset.floor_upper = 64 + 7;
      tset.floor_lower = 106 + 7;
      tset.floor_endup = 66 + 7;
      tset.floor_enddown = 108 + 7;
      tset.floor_endleft = 88 + 7;
      tset.floor_endright = 90 + 7;

      // walls
      tset.wall_base = 10 || 885 + 7;
      tset.wall_horiz = 883 + 7;
      tset.wall_vert = 903 + 7;
      tset.wall_upperleft = 882 + 7;
      tset.wall_upperright = 884 + 7;
      tset.wall_lowerright = 926 + 7;
      tset.wall_lowerleft = 924 + 7;
      tset.wall_endcap = 904 + 7;
      tset.wall_tee = 886 + 7;
      tset.wall_inversetee = 928 + 7;
      tset.wall_ccwtee = 906 + 7;
      tset.wall_cwtee = 908 + 7;
      tset.wall_cross = 907 + 7;

      tset.clutter[0] = 2;
      tset.clutter[1] = 3;
      tset.clutter[2] = 10;
      tset.clutter[3] = 11;
      tset.clutter[4] = 18;
      tset.clutter[5] = 19;
    } else if ( theme === 2 ){
      // doors
      tset.door = 0;

      // floors
      tset.floor_base = 85 + 378;
      tset.floor_horiz = 89 + 378;
      tset.floor_vert = 87 + 378;
      tset.floor_upperright = 65 + 378;
      tset.floor_upperleft = 63 + 378;
      tset.floor_lowerright = 107 + 378;
      tset.floor_lowerleft = 105 + 378;
      tset.floor_left = 84 + 378;
      tset.floor_right = 86 + 378;
      tset.floor_upper = 64 + 378;
      tset.floor_lower = 106 + 378;
      tset.floor_endup = 66 + 378;
      tset.floor_enddown = 108 + 378;
      tset.floor_endleft = 88 + 378;
      tset.floor_endright = 90 + 378;

      // walls
      tset.wall_base = 885 + 378;
      tset.wall_horiz = 883 + 378;
      tset.wall_vert = 903 + 378;
      tset.wall_upperleft = 882 + 378;
      tset.wall_upperright = 884 + 378;
      tset.wall_lowerright = 926 + 378;
      tset.wall_lowerleft = 924 + 378;
      tset.wall_endcap = 904 + 378;
      tset.wall_tee = 886 + 378;
      tset.wall_inversetee = 928 + 378;
      tset.wall_ccwtee = 906 + 378;
      tset.wall_cwtee = 908 + 378;
      tset.wall_cross = 907 + 378;

      tset.clutter[0] = 6;
      tset.clutter[1] = 7;
      tset.clutter[2] = 14;
      tset.clutter[3] = 15;
      tset.clutter[4] = 22;
      tset.clutter[5] = 23;
    } else if ( theme === 1 ){
      // doors
      tset.door = 8;

      // floors
      tset.floor_base = 85;
      tset.floor_horiz = 89;
      tset.floor_vert = 87;
      tset.floor_upperright = 65;
      tset.floor_upperleft = 63;
      tset.floor_lowerright = 107;
      tset.floor_lowerleft = 105;
      tset.floor_left = 84;
      tset.floor_right = 86;
      tset.floor_upper = 64;
      tset.floor_lower = 106;
      tset.floor_endup = 66;
      tset.floor_enddown = 108;
      tset.floor_endleft = 88;
      tset.floor_endright = 90;

      // walls
      tset.wall_base = 885;
      tset.wall_horiz = 883;
      tset.wall_vert = 903;
      tset.wall_upperleft = 882;
      tset.wall_upperright = 884;
      tset.wall_lowerright = 926;
      tset.wall_lowerleft = 924;
      tset.wall_endcap = 904;
      tset.wall_tee = 886;
      tset.wall_inversetee = 928;
      tset.wall_ccwtee = 906;
      tset.wall_cwtee = 908;
      tset.wall_cross = 907;

    }
    tset.wall_base = 10;
    return tset;
  }

} // end phaser function
