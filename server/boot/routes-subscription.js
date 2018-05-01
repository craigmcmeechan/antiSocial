var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');

var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/subscription', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		res.render('pages/subscription', {
			'globalSettings': ctx.get('globalSettings'),
			'currentUser': ctx.get('currentUser')
		});
	});

	server.use(router);
};
