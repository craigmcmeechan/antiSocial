var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var ensureAdmin = require('../middleware/context-ensureAdminUser');
var async = require('async');
var mailer = require('../../server/lib/mail');
var base64 = require('base-64');
var uuid = require('uuid');
var debug = require('debug')('invitation');
var VError = require('verror').VError;
var WError = require('verror').WError;

module.exports = function (server) {
	var router = server.loopback.Router();

	router.post('/batch-invite', getCurrentUser(), ensureLoggedIn(), ensureAdmin(), function (req, res) {
		var ctx = req.myContext;
		var currentUser = ctx.get('currentUser');

		async.map(req.body.batch, function (address, done) {

			var payload = {
				'type': 'friend',
				'email': address,
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
							return cb(e);
						}
						cb(null, invitation);
					});
				},
				function (invitation, cb) {

					var url = server.locals.config.publicHost + '/invite/' + invitation.token;
					var endpoint = server.locals.config.publicHost + '/' + invitation.user().username;

					var options = {
						'to': invitation.email,
						'from': process.env.OUTBOUND_MAIL_SENDER,
						'subject': 'Friend request from ' + invitation.user().name,
						'user': invitation.user().name,
						'email': invitation.user().email,
						'url': url,
						'endpoint': base64.encode(endpoint),
						'note': invitation.note,
						'config': server.locals.config
					};

					mailer(server, 'emails/invite-friend', options, function (err) {
						if (err) {
							var e = new VError(err, 'could not send invite email');
							debug(e.toString());
							debug(e.stack);
						}
					});
					cb();

				}
			], function (err) {
				done(err);
			});
		}, function (err) {
			if (err) {
				return res.send(err);
			}
			res.send(req.body);
		});
	});

	server.use(router);
};
