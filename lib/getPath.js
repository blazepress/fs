'use strict';

var nfs		= require( 'fs' );
var npath	= require( 'path' );

var getEmitter = require( './getEmitter' );

var cache = {};


Path.prototype = {

	toLib: function( cb ) {
		const lib = {}
		if( cb ) {
			//TODO: implement async
			throw new Error( 'async fs.Path.toLib not impelemented' )
		} else {
			this.mapSubs( ( sub ) => {
				let parse = sub.parse()
				if( sub.isDirectory() ) {
					Object.defineProperty( lib, sub.basename, {
						get: function() {
							let sublib = sub.toLib()
							let def = { value: sublib }
							Object.defineProperty( this, parse.name, def )
							return sublib
						},
						configurable: true,
						enumerable: true
					})
				} else if( parse.name !== 'index' ) {
					if( parse.ext === '.js' || sub.parse.ext === '.json' ) {
						Object.defineProperty( lib, parse.name, {
							get: function() {
								let mod = sub.require()
								let def = { value: mod }
								Object.defineProperty( this, parse.name, def )
								return mod
							},
							configurable: true,
							enumerable: true
						})
					}
				}
			})
		}
		return lib
	},

	require: function() {

		return require( this.str )

	},

	read: function() {

		return nfs.readFileSync( this.str );

	},

	write: function( content, options ) {

		nfs.writeFileSync( this.str, content, options );

	},

	exists: function() {

		return nfs.existsSync( this.str );

	},

	getStats: function() {

		return nfs.statSync( this.str );

	},

	getSubs: function() {

		var self = this;
		var subs = {};

		nfs.readdirSync( this.str ).map( function( fn ) {
			subs[ fn ] = self.sub( fn );
		});

		return subs;

	},

	inspect: function() {

		return '[ Path: ' + this.str + ' ]';

	},

	isDirectory: function() {

		return this.exists() && this.getStats().isDirectory();

	},

	mapSubs: function( cb ) {

		var fn, subs = this.getSubs();

		for( fn in subs ) {
			cb( subs[ fn ] );
		}

	},

	mkdir: function() {

		nfs.mkdirSync( this.str );

	},

	rel: function( sub ) {
		return npath.relative( this.str, sub.str );
	},

	rm: function( force ) {

		if( this.isDirectory() ) {
			this.rmdir( force );
		} else {
			this.unlink();
		}

	},

	rmdir: function( force ) {

		if( force ) this.mapSubs( function( sub ) {
			if( sub.isDirectory() ) {
				sub.rmdir( true );
			} else {
				sub.unlink();
			}
		});

		nfs.rmdirSync( this.str );
	},

	sub: function( str ) {

		return getPath( npath.join( this.str, str ) );

	},

	toString: function() {
		return this.inspect();
	},

	touch: function( cb ) {
		if( cb ) {
			nfs.open( this.str, 'a', function( err, fd ) {
				if( err ) cb( err );
				else nfs.close( fd, cb );
			});
		} else {
			return nfs.closeSync( nfs.openSync( this.str, 'a' ) );
		}
	},

	unlink:	function( cb ) {
		if( cb ) nfs.unlink( this.str, cb );
		else return nfs.unlinkSync( this.str );
	},

	parseJSON: function() {

		return JSON.parse( this.read() );

	},

	parse: function() {

		return npath.parse( this.str )

	}

};

/*	Whenever path.on, path.off, or path.once is called, it will
	create a special path EventEmitter, if necessary, and pass the
	arguments to it. */

['on', 'removeListener', 'once'].map( function( method ) {

	Path.prototype[ method ] = function( event, listener ) {

		getEmitter( this )[ method ]( event, listener );

	};

});


Object.defineProperties( Path.prototype, {

	basename: {
		get: function() {
			let basename = npath.basename( this.str )
			let def = { value: basename }
			Object.defineProperty( this, 'basename', def )
			return basename
		}
	},

	is_root: {
		get: function() {
			return ( this.is_root = ( this.str === '/' || this.str.toLowerCase() === 'c:/' ) );
		}
	},

	parent: {
		get: function() {
			return ( this.parent = ( this.is_root ? null : this.sub( '..' ) ) );
		}
	}

});

module.exports = getPath;


function getPath( arg0 ) {

	var len, str;

	// for objects: use 'str' property

	if( typeof arg0 === 'object' ) {

		arg0 =  arg0.str || arg0.toString();

	}

	if( typeof arg0 !== 'string' ) {

		throw new TypeError( 'Bad argument passed to vlaf-fs.path()' );

	}

	str = npath.normalize( arg0 );

	len = str.length;

	if( len > 1 && str.substr( -1 ) === npath.sep ) {

		str = str.substr( 0, len - 1 );

	}

	return cache[ str ] || ( cache[ str ] = new Path( str ) );

}

function Path( str ) {

	Object.defineProperty( this, 'str', { value: str } );

}
