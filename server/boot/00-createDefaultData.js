// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var async = require('async');

module.exports = function createDefaultData(server, done) {
	if (!process.env.AUTOUPDATE) {
		return done();
	}

	var ds = server.dataSources.db;
	if (ds.connected) {
		doAutoUpdate(done);
	}
	else {
		ds.once('connected', function () {
			doAutoUpdate(done);
		});
	}

	function doAutoUpdate(done) {
		server.dataSources.db.autoupdate(function (err) {
			if (err) {
				console.log('** autoupdate error', err);
			}
			done(err);
		});
	}
};
