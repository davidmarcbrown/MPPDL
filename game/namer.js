var fs = require('fs');

// Load dungeonNames file synchronously
try {
  var words = fs.readFileSync('./game/dungeonNames.txt', { encoding: 'UTF-8', flag: 'r' } );
}
catch (e) {
  console.log( "Couldn't load dungeon word list from file.");
  console.log( e );
  process.exit(1);
}
console.log( "Read ancient scrolls of haunted dungeons..." );
words = words.split( '\n' ); // create array from words
words.pop(); // the last element is an empty string

// Load names file synchronously.
try {
  var names = fs.readFileSync('./game/playerNames.txt', { encoding: 'UTF-8', flag: 'r' } );
}
catch (e) {
  console.log( "ERROR: Couldn't load player names list from file.");
  console.log( e );
  process.exit(1);
}
console.log( "Took census of brave heroes..." );
names = names.split( '\n' );
names.pop();

// handy dandy
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// returns a random game name that hasn't been used yet
// needs array of gameInstances as argument
module.exports.randomGameName = function randomName ( games ) {
  function newPossibly () {
    return words[ getRandomInt( 0, words.length - 1 ) ] + '-' + words[ getRandomInt( 0, words.length - 1 ) ];
  };
  var possibly = newPossibly();

  if ( games.length === 0 ) return possibly;

  return function nameCheck( nameToTest ){
    for ( var i = 0; i < games.length; i++ ){
      if ( games[i].name === nameToTest ) return nameCheck( newPossibly() );
    }
    return nameToTest;
  }( possibly );
};

// returns a random player name that hasn't been used yet
// needs a player roster from a gameInstance as argument
module.exports.randomPlayerName = function ( roster ) {
  function newPossibly () {
    return names[ getRandomInt( 0, names.length - 1 ) ];
  };
  var possibly = newPossibly();  

  if ( roster.length === 0 ) return possibly;

  return function nameCheck( nameToTest ){
    for ( var i = 0; i < roster.length; i++ ){
      if ( roster[i].name === nameToTest ) return nameCheck( newPossibly() );
    }
    return nameToTest;
  }( possibly );
};
