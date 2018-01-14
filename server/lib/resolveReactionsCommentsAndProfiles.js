var server = require('../server');
var async = require('async');
var resolveComments = require('../lib/resolveComments');
var resolveReactions = require('../lib/resolveReactions');

var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

module.exports = function resolveReactionsCommentsAndProfiles(posts, done) {
	debug('resolveReactionsCommentsAndProfiles');

	async.map(posts, function (post, doneMap) {
		var postEndpoint = post.source + '/post/' + post.uuid;
		async.series([
			function (cb) {
				resolveComments(posts, 'post', cb);
			},
			function (cb) {
				resolveReactions(posts, 'post', cb);
			}
		], function (err) {
			if (err) {
				doneMap(err);
			}
			doneMap();
		});
	}, function (err) {
		resolveProfilesForPosts(posts, done);
	});
};
