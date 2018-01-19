var server = require('../server');
var async = require('async');
var resolveComments = require('../lib/resolveComments');
var resolveReactions = require('../lib/resolveReactions');

var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

module.exports = function resolveReactionsCommentsAndProfiles(posts, done) {

	async.map(posts, function (post, doneMap) {
		debug('resolveReactionsCommentsAndProfiles ' + post.uuid);

		var postEndpoint = post.source + '/post/' + post.uuid;
		async.series([
			function (cb) {
				resolveComments([post], 'post', cb);
			},
			function (cb) {
				resolveReactions([post], 'post', cb);
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
