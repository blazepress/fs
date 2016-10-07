'use strict';

var nutil	= require( 'util' );
var nfs		= require( 'fs' );

var EventEmitter = require( 'events' ).EventEmitter;

var events = require( './events' );

var cache = {};

var proto = {

	getSubs: function() {

		var subs = {};

		var paths = this.path.getSubs();

		var fn, stats, path;

		for( fn in paths ) {
			path = paths[ fn ];
			stats = path.getStats();
			subs[ fn ] = {
				path:	path,
				mtime:	stats.mtime.getTime()
			};
		}

		return subs;

	},

	track: function() {

		var osubs = this.subs;
		var nsubs = this.getSubs();
		var osub, nsub;

		var fn;

		for( fn in osubs ) {

			osub = osubs[ fn ];
			nsub = nsubs[ fn ];

			if( !nsub ) {

				this.emitDirEvent( osub.path, 'removed' );

			}

		}

		for( fn in nsubs ) {

			osub = osubs[ fn ];
			nsub = nsubs[ fn ];

			if( !osub ) {

				this.emitDirEvent( nsub.path, 'created' );

			} else {

				if( osub.mtime !== nsub.mtime ) {

					this.emitDirEvent( nsub.path, 'modified' );

				}

			}

		}

		this.subs = nsubs;

	},

	emitSelfEvent: function( event ) {

		this.update();
		this.emit( event );

	},

	emitDirEvent: function( path, event ) {

		var em = getEmitter( path );

		em.emitSelfEvent( event );

		this.emitTreeEvent( path, event );

		if( this.dirCount ) {

			this.emit( 'dir_event', path, event );

		}

	},

	emitTreeEvent: function( path, event ) {

		if( this.isUnderTree() ) {
			if( this.treeCount ) this.emit( 'tree_event', path, event );
			if( this.parent ) this.parent.emitTreeEvent( path, event );
		}

	},

	needsParentWatch: function() {

		if( this.path.is_root ) return false;
		return this.watchCount || this.dirCount;

	},

	needsWatch: function() {

		if( !this.path.isDirectory() ) return false;

		return this.watchCount || this.dirCount || this.isUnderTree();

	},

	update: function( forceWatch ) {

		if( this.needsParentWatch() ) {
			if( !this.parentNotified ) {
				this.parent.dirCount++;
				this.parent.update();
				this.parentNotified = true;
			}
		} else if( this.parentNotified ) {
			this.parent.dirCount--;
			this.parent.update();
			this.parentNotified = false;
		}

		if( this.needsWatch() || forceWatch ) {
			if( !this.watch ) this.startWatch();
		} else {
			if( this.watch ) {
				this.watch.close();
				this.watch = undefined;
				delete this.watch;
			}
		}

	},

	updateSubDir: function( sub ) {

		var em;

		if( sub.isDirectory() ) {


			em = getEmitter( sub );
			em.update();
			em.updateAllSubDirs();

		}

	},

	updateAllSubDirs: function() {

		this.path.mapSubs( this.updateSubDir );

	},

	isUnderTree: function() {

		if( this.treeCount ) return true;

		return this.parent && this.parent.isUnderTree();

	},

	startWatch: function() {

		var self = this;

		if( self.path.isDirectory() ) {

			self.subs = self.getSubs();

			self.watch = nfs.watch( self.path.str, function() {

				if( self.path.isDirectory() ) self.track();

			});

		}

	},

	toString: function() {
		return this.inspect();
	},

	inspect: function() {

		return '[ Emitter: (' + [this.watchCount, this.dirCount, this.treeCount].join() +
			')-('+needs.join()+') '+ this.path + ' ]';

	}

};

nutil.inherits( Emitter, EventEmitter );

(function() {

	var p;

	for( p in proto ) Emitter.prototype[ p ] = proto[ p ];

})();

Object.defineProperties( Emitter.prototype, {

	parent: {
		get: function() {
			return getEmitter( this.path.parent );
		}
	}

});

module.exports = getEmitter;

function getEmitter( path ) {

	if( path ) return cache[ path.str ] || new Emitter( path );
	return null;

}

function Emitter( path ) {

	EventEmitter.call( this );

	this.isParentNotified = false;
	this.path = path;
	this.watchCount = 0;
	this.dirCount = 0;
	this.subCount = 0;
	this.treeCount = 0;
	this.on( 'newListener', onNewListener );
	this.on( 'removedListener', onRemovedListener );

	cache[ path.str ] = this;

}


function onNewListener( event ) {

	if( events.isWatch( event ) ) {

		++this.watchCount;
		if( event === 'dir_event' ) ++this.dirCount;
		if( event === 'tree_event' ) {
			++this.treeCount;
			this.update();
			if( this.treeCount === 1 ) this.updateAllSubDirs();
		}

		this.update();

	}

}

function onRemovedListener( event ) {

	if( events.isWatch( event ) ) {

		--this.watchCount;

		if( event === 'dir_event' ) --this.dirCount;
		if( event === 'tree_event' && --this.treeCount === 0 ) this.updateAllSubDirs();

		this.update();

	}

}
