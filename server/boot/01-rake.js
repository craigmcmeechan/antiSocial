var async = require('async');
var crc = require('crc');
module.exports = function rake(server) {
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
		if (group.settings.version >= 1) {
			return;
		}

		group.settings.version = 1;
		group.save();

		server.models.Friend.find({}, function (err, friends) {
			async.map(friends, function (friend, cb) {
				if (!friend.hash) {
					friend.hash = crc.crc32(friend.remoteEndPoint).toString(16);
					friend.save();
				}
				cb();
			}, function (err) {
				console.log('data upgrade complete');
			});
		});
	});
};
