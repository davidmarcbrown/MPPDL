var express = require('express');
var bodyParser = require( 'body-parser' );
var http = require('http'); 
var app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }))
app.use( express.static(__dirname + '/public' ));

var server = app.listen(8085);

var game = require('./game/game.js')( server );

console.log( 'Ready for adventure!' );

app.get('/', function(req, res){
  // start a new public game
  var newGame = game.newGame();
  res.redirect('/dungeon/' + newGame );
});

app.get('/dungeon/:name', function(req, res){
  gameName = req.params.name;
  var exists = game.exists(gameName);
  if ( exists ){
    // load the game
    res.render( 'game', { 'gameName': gameName } );
  } else {
    // start a new game (with a new name)
    var newGame = game.newGame();
    res.redirect('/dungeon/' + newGame );
  }
});

app.get('/status', function(req, res){
  console.log('Serving status page');
  res.render('status', game.getStatus() );
});

app.post('/api/game', function ( req, res ){
  if ( req.body.command === 'requestDungeon' ){
    res.json( game.clientDungeon( req.body.gameName ) );
    console.log( req.body.gameName + '\'s dungeon data sent to ' + req.body.playerName );
  }
  else { 
    res.json( 'Command \'' + req.body.command + '\' not understood.' );
  }
});

app.get("/*", function( req, res){
  console.log('Bad request or 404: ' + req.path );
  res.redirect('/status');
});
