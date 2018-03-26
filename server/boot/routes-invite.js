var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var VError = require('verror').VError;
var WError = require('verror').WError;
var debug = require('debug')('invitation');
var uuid = require('uuid');
var async = require('async');
var mailer = require('../../server/lib/mail');

module.exports = function (server) {
	var router = server.loopback.Router();

	router.post('/invite', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		var payload = {
			'type': req.body.type,
			'email': req.body.email,
			'note': req.body.note,
			'token': uuid(),
			'status': 'pending',
			'userId': currentUser.id
		};

		debug('send invite');

		async.waterfall([
			function (cb) {
				server.models.Invitation.create(payload, function (err, invitation) {
					if (err) {
						var e = new VError(err, 'error saving invitation');
						return cb(e);
					}
					cb(null, invitation);
				});

			},
			function (invitation, cb) {

				server.models.Invitation.include([invitation], 'user', function (err) {
					if (err) {
						var e = new VError(err, 'could not render verification email');
						return next(e);
					}
					cb(null, invitation);
				});
			},
			function (invitation, cb) {

				var url = server.locals.config.publicHost + '/invite/' + invitation.token;
				var endpoint = server.locals.config.publicHost + '/' + invitation.user().username;

				var options = {
					'to': invitation.email,
					'from': 'mrhodes@myantisocial.net',
					'subject': 'Friend request from ' + invitation.user().name,
					'user': invitation.user().name,
					'email': invitation.user().email,
					'url': url,
					'endpoint': endpoint,
					'note': invitation.note
				};

				mailer(server, 'emails/invite-friend', options, function (err) {
					if (err) {
						var e = new VError(err, 'could not send invite email');
						return cb(e);
					}
					cb();
				});

			}
		], function (err) {
			if (err) {
				var e = new WError(err, 'could send invite');
				debug(e.toString());
				return next(e);
			}
			res.set('x-digitopia-hijax-flash-level', 'success');
			res.set('x-digitopia-hijax-flash-message', 'invitation sent');
			return res.send({
				'status': 'ok'
			});
		});
	});

	router.get('/invite/:token', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		server.models.Invitation.findOne({
			'where': {
				'token': req.params.token
			},
			'include': ['user']
		}, function (err, invite) {
			if (err) {
				return next(err);
			}

			if (!invite) {
				return res.sendStatus(404);
			}

			var endpoint = server.locals.config.publicHost + '/' + invite.user().username;

			if (invite.status === 'pending' || invite.status === 'processing') {

				invite.updateAttribute('status', 'processing', function (err) {
					if (err) {
						return next(err);
					}

					res.cookie('invite', invite.token, {
						signed: req.signedCookies ? true : false
					});

					res.redirect(endpoint);
				});
			}
			else {
				res.redirect(endpoint);
			}
		});
	});

	server.use(router);
};
