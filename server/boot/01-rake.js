// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var async = require('async');
var crc = require('crc');
module.exports = function rake(server, updateDone) {
	return updateDone(); // nothing to do at the moment
	/*
	server.models.Settings.findOrCreate({
		'where': {
			'group': 'db_version_history'
		}
	}, {
		'group': 'db_version_history',
		'settings': {
			'version': 0
		}
	}, function (err, group) {
		async.series([
			function (done) {
				if (group.settings.version >= 1) {
					return async.setImmediate(function () {
						done();
					});
				}
				server.models.Friend.find({}, function (err, friends) {
					async.map(friends, function (friend, cb) {
						if (!friend.hash) {
							friend.hash = crc.crc32(friend.remoteEndPoint).toString(16);
							friend.save();
						}
						cb();
					}, function (err) {
						console.log('data upgrade complete to v1');
						group.settings.version = 1;
						group.save();
						done();
					});
				});
			},
			function (done) {
				if (group.settings.version >= 2) {
					return async.setImmediate(function () {
						done();
					});
				}

				server.models.Post.find({}, function (err, posts) {
					async.map(posts, function (post, cb) {
						post.posted = true;
						post.save();
						cb();
					}, function (err) {
						console.log('data upgrade complete to v2');
						group.settings.version = 2;
						group.save();
						done();
					});
				});
			}
		], function (err) {
			console.log('data upgrade complete');
			updateDone();
		});
	});
	*/
};
