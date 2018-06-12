// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var ensureAdminUser = require('../middleware/context-ensureAdminUser');

module.exports = function serverSettings(server) {
	var router = server.loopback.Router();

	router.patch('/server-settings', getCurrentUser(), ensureLoggedIn(), ensureAdminUser(), function (req, res, next) {
		var ctx = req.myContext;
		var settings = ctx.get('globalSettings');
		var payload = req.body;

		req.app.models.Settings.findOrCreate({
			'where': {
				'group': 'global'
			}
		}, {
			'group': 'global',
			'settings': settings
		}, function (err, group) {
			if (err) {
				return next(err);
			}

			for (var prop in payload) {
				if (payload[prop] === 'true') {
					payload[prop] = true;
				}
				if (payload[prop] === 'false') {
					payload[prop] = false;
				}
				group.settings[prop] = payload[prop];
			}

			group.save(function (err) {
				if (err) {
					return next(err);
				}
				res.send('ok');
			});
		});
	});
	server.use(router);

};
