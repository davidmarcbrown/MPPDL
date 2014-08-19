// returns a five unit long array with a level of a dungeon in each array
// hopefully with ascending difficulty
module.exports.newDungeon = function(){
  var dungeon = {};
  dungeon.levels = [];
  for ( var i = 0; i < 5; i++ ){
    dungeon.levels[i] = new Level( i );
  };
  return dungeon;
};

// Returns an object with a single level of a dungeon in it.
function Level ( difficulty ) {
  var that = this;
  this.difficulty = difficulty; // doesn't do anything yet
  this.levelMap = []; // 2d array
  this.width = 64;
  this.height = 64;
  var maxRooms = 50 + ( difficulty * 10 ); // generally can't fit more than 100 rooms in a 64x64 field
  this.badguys = {}; // doesn't do anything yet
  this.spawn = {}; // where you enter the maze
  this.exit = {}; // where you exit the maze
  this.tileSet = getRandomInt( 1, 7 ); // which tileset to use in the client

  // fill the level with walls, we will carve out floors later
  for ( var i = 0; i < this.width; i++ ){
    this.levelMap[i] = [];
    for ( var j = 0; j < this.height; j++ ){
      this.levelMap[i][j] = new DungeonTile;
    }
  }

  // drawStartingRoom( this, startingRoom.x, startingRoom.y );
  drawStartingRoom( this, getRandomInt( 1, this.width - 4 ), getRandomInt( 1, this.height - 5) );  

  // add rooms where possible until we have the maximum amount of rooms
  var roomToTest;
  var centerOfLastRoom;
  var rooms = 0;
  for ( var i = 0; i < maxRooms; i++ ){
    roomToTest = addRoom( this );
    if ( roomToTest ) {
      centerOfLastRoom = roomToTest;
      rooms++;
    } else {
      break;
    }
  }

  // last room built contains the stairway to next level
  this.exit = centerOfLastRoom;
  
  // add some visually interesting clutter (no effect on gameplay)
  addClutter( this, maxRooms * 3 );
};

// dungeonTile constructor
function DungeonTile () {
  this.isWall = true;
  this.isDoor = false;
}

// creates 3x4 spawn room and generates coords for the spawn itself
function drawStartingRoom( level, x, y ){
  for ( var i = x; i < x+3; i++ ){
    for ( var j = y; j < y+4; j++ ){
      level.levelMap[i][j].isWall = false;
    }
  }
  // starting room is not inside the fog of war
  for ( var k = x-1; k < x+4; k++ ){
    for ( var l = y-1; l < y+5; l++ ){
      level.levelMap[k][l].isExplored = true;
    }
  }
  level.spawn.x = x + 1;
  level.spawn.y = y + 1;
}

function addRoom( level ){
  var thinking = true;
  var x;
  var y;
  var width;
  var height;

  var attempts = 0;
  var maxAttempts = 5000;

  var roomCenter = {};

  // loops until it can place a room
  while ( thinking && attempts < maxAttempts ) {
    attempts++;

    // pick random coordinates to see if we can add a room there
    x = getRandomInt( 1, level.width - 2 );
    y = getRandomInt( 1, level.height - 2 );

    // random room dimensions
    width = getRandomInt( 3, 7 );
    height = getRandomInt( 3, 7 );

    if ( width === 1 && height === 1 ){
      if ( getRandomInt( 0, 1 ) > 0 ) width = getRandomInt( 3, 8 );
      else height = getRandomInt( 3, 8 );
    }
    else if ( width === 1 ) height = getRandomInt( 5, 12 );
    else if ( height === 1 ) width = getRandomInt( 5, 12 );

    // if it's a wall, see if there's a floor next to it, and draw a room there.
    // after you draw a room, change our original random point to a door.
    // no doors near existing doors.
    if ( level.levelMap[x][y].isWall &&
         !(level.levelMap[x-1][y].isDoor) &&
         !(level.levelMap[x+1][y].isDoor) &&
         !(level.levelMap[x][y-1].isDoor) &&
         !(level.levelMap[x][y+1].isDoor) ){
      if (  level.levelMap[x-1] && 
            level.levelMap[x-1][y].isWall === false &&
            level.levelMap[x+1] && 
            level.levelMap[x+1][y].isWall === true ){
        roomCenter = drawRoom( level, x+1, y-Math.floor(height/2), width, height );
        if ( roomCenter ){
          level.levelMap[x][y].isWall = false;
          level.levelMap[x][y].isDoor = true;
          thinking = false;
        }
      }
      else if ( level.levelMap[x+1] &&
                level.levelMap[x+1][y].isWall === false &&
                level.levelMap[x-1] &&
                level.levelMap[x-1][y].isWall === true ){
        roomCenter = drawRoom( level, x-width, y-Math.floor(height/2), width, height );
        if ( roomCenter ){
          level.levelMap[x][y].isWall = false;
          level.levelMap[x][y].isDoor = true;
          thinking = false;
        }
      }
      else if ( level.levelMap[x][y-1] &&
                level.levelMap[x][y-1].isWall === false && 
                level.levelMap[x][y+1] &&
                level.levelMap[x][y+1].isWall === true ){
        roomCenter = drawRoom( level, x-Math.floor(width/2), y+1, width, height );
        if ( roomCenter ){
          level.levelMap[x][y].isWall = false;
          level.levelMap[x][y].isDoor = true;
          thinking = false;
        }
      }
      else if ( level.levelMap[x][y+1] &&
                level.levelMap[x][y+1].isWall === false &&
                level.levelMap[x][y-1] &&
                level.levelMap[x][y-1].isWall === true ){
        roomCenter = drawRoom( level, x-Math.floor(width/2), y-height, width, height );
        if ( roomCenter ){
          level.levelMap[x][y].isWall = false;
          level.levelMap[x][y].isDoor = true;
          thinking = false;
        }
      }
    }
  }
  if ( attempts >= maxAttempts ){
    return false;
  } else {
    return roomCenter;
  }
} // end drawRoom()

// draw a room here. return false if we can't
function drawRoom( level, x, y, width, height ){
  if ( checkRoom( level, x, y, width, height ) ){
    for ( var i = x; i < x + width; i++ ){
      for ( var j = y; j < y + height; j++ ){
        if ( level && level.levelMap && level.levelMap[i] && level.levelMap[i][j] ){
          level.levelMap[i][j].isWall = false;
        } else {
          console.log( 'drawRoom(), wacky data' );
          return false;
        }
      }
    }
    // returns the center of the room
    return { x: x + Math.floor(width/2), y: y + Math.floor(height/2) };
  } else {
    return false;
  }
}

// will a room fit here? (with a one unit buffer of walls)
function checkRoom( level, x, y, width, height ){
  for ( var i = x - 1; i < x + width + 1; i++ ){
    for ( var j = y - 1; j < y + height + 1; j++ ){
      if ( level && level.levelMap && level.levelMap[i] && level.levelMap[i][j] ){
        if ( level.levelMap[i][j].isWall === false ){
          return false;
        }
      } else {
        return false;
      }
    }
  }
  return true;
}

function addClutter( level, maxRooms ){
  // on average, three pieces of clutter per room
  var clutterCount = maxRooms;

  var levelMap = level.levelMap;
  var thinking;

  for ( var i = 0; i < clutterCount; i++ ){
    thinking = true;
    while ( thinking ){
      x = getRandomInt( 1, level.width - 2 );
      y = getRandomInt( 1, level.height - 2 );

      // don't put clutter on top of other clutter.
      // don't put clutter on doors or tiles adjacent to doors
      if (  levelMap[x][y].isWall === false &&
            !(levelMap[x][y].clutter) &&
            !(levelMap[x][y].isDoor) &&
            !( (x === level.exit.x) && (y === level.exit.y) ) 
      ){
        var doorAdjacent = false;
        for ( var j = x-1; j <= x+1; j++ ){
          for ( var k = y-1; k <= y+1; k++ ){
            if ( levelMap[j][k].isDoor === true ) doorAdjacent = true;
          }
        }
        if ( !doorAdjacent ){
          levelMap[x][y].clutter = { clutterType: getRandomInt( 0, 5 ) };
          thinking = false;
        }
      }
    }
  }
}

// handy dandy
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
