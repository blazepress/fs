'use strict';

var events = {};

events.watch = [
	'created',
	'removed',
	'modified',
	'changed',
	'accessed',
	'dir_event',
	'tree_event'
];

events.isWatch = function( event ) {
	return events.watch.indexOf( event ) !== -1;
};

module.exports = events;
