var getCurrentUser = require('../middleware/context-currentUser');

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/invite/:token', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		server.models.Invitation.findOne({
			'where': {
				'token': req.params.token,
				'status': 'pending'
			},
			'include': ['user']
		}, function (err, invite) {
			if (err) {
				return next(err);
			}

			if (!invite) {
				return res.sendStatus(404);
			}

			invite.updateAttribute('status', 'processing', function (err) {
				if (err) {
					return next(err);
				}

				res.cookie('invite', invite.token, {
					signed: req.signedCookies ? true : false
				});

				var endpoint = server.locals.config.publicHost + '/' + invite.user().username;

				res.redirect(endpoint);
			});
		});
	});

	server.use(router);
};
