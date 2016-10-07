exports.path = require( './lib/getPath' );

exports.cwd = function() {

	return exports.path( process.cwd() );

};
