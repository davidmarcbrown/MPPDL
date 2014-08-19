$( function(){
  // scale the gameDiv to fit the visible space better,
  // and change the scale if the visible space changes (ie mobile device changes orientation, window resize).
  // Phaser actually hates this. We're doing it anyway.
  var availHeight = Math.floor( window.innerHeight - (window.innerHeight * 0.25) );
  var availWidth = Math.floor( window.innerWidth - (window.innerWidth * 0.10) );
  $('#gameDiv').width( ( availHeight > availWidth ? availWidth : availHeight ) +'px' );
  $('#gameDiv').height( ( availHeight > availWidth ? availWidth : availHeight ) +'px' );
  $('body').height( window.innerHeight + 60 + 'px' );
  $(window).resize(function(){
    availHeight = Math.floor( window.innerHeight - (window.innerHeight * 0.25) );
    availWidth = Math.floor( window.innerWidth - (window.innerWidth * 0.10) );
    $('#gameDiv').width( ( availHeight > availWidth ? availWidth : availHeight ) +'px' );
    $('#gameDiv').height( ( availHeight > availWidth ? availWidth : availHeight ) +'px' );
    $('body').height( window.innerHeight + 60 + 'px' );
  });
});
