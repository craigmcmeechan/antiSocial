// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var async = require('async');
var crc = require('crc');
module.exports = function rake(server, updateDone) {
	return updateDone(); // nothing to do at the moment

	/*
	var version = 2;

	server.models.Settings.findOrCreate({
		'where': {
			'group': 'db_version_history'
		}
	}, {
		'group': 'db_version_history',
		'settings': {
			'version': version
		}
	}, function (err, group) {
		async.series([
			function (done) {
				if (group.settings.version >= version) {
					return async.setImmediate(function () {
						done();
					});
				}
				server.models.Friend.find({}, function (err, friends) {
					async.map(friends, function (friend, cb) {
						if (typeof friend.highWater === 'string') {
							friend.highWater = {
								'as-post': friend.highWater
							};
							friend.save(function (err) {
								cb(err);
							});
						}
					}, function (err) {
						if (err) {
							return done(err);
						}
						console.log('data upgrade complete to v2');
						group.settings.version = 2;
						group.save(function (err) {
							done();
						});
					});
				});
			}
		], function (err) {
			if (err) {
				return updateDone(err);
			}
			console.log('data upgrade complete');
			updateDone();
		});
	});
	*/
};
