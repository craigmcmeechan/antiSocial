var getCurrentUser = require('../middleware/context-currentUser');
var VError = require('verror').VError;
var WError = require('verror').WError;
var watchFeed = require('../lib/watchFeed');

var timers = {};

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/ping', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');
		var message = '';
		if (currentUser) {
			message = currentUser.online ? 'online' : 'offline';
			if (timers[currentUser.username]) {
				clearTimeout(timers[currentUser.username]);
				delete timers[currentUser.username];
			}

			timers[currentUser.username] = setTimeout(function () {
				console.log('zombie ' + currentUser.username);
				watchFeed.disconnectAll(currentUser);
				delete timers[currentUser.username];
				if (req.app.openClients[currentUser.username]) {
					req.app.openClients[currentUser.username].end();
				}
			}, 20000);
		}
		res.send({
			'status': message
		});
	});

	server.use(router);
};
