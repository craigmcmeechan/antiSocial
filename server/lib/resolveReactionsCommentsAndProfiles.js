// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var server = require('../server');
var async = require('async');
var resolveComments = require('../lib/resolveComments');
var resolveReactions = require('../lib/resolveReactions');

var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

module.exports = function resolveReactionsCommentsAndProfiles(posts, isMe, done) {

	async.map(posts, function (post, doneMap) {
		debug('resolveReactionsCommentsAndProfiles ' + post.uuid);

		var postEndpoint = post.source + '/post/' + post.uuid;
		async.series([
			function (cb) {
				resolveComments([post], 'post', isMe, cb);
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
