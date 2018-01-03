var uuid = require('uuid');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var mailer = require('../../server/lib/mail');

var debug = require('debug')('invites');
var debugVerbose = require('debug')('invites:verbose');
var RemoteRouting = require('loopback-remote-routing');

module.exports = function (Invitation) {

	if (!process.env.ADMIN) {
		RemoteRouting(Invitation, {
			'only': []
		});
	}

	Invitation.observe('before save', setToken);
	Invitation.observe('after save', sendInvite);

	function setToken(ctx, next) {
		if (!ctx.isNewInstance) {
			return next();
		}

		debug('create invite token');

		if (ctx.instance) {
			ctx.instance.token = uuid();
			ctx.instance.status = 'pending';
		}
		else {
			ctx.data.token = uuid();
			ctx.data.status = 'pending';
		}

		next();
	}

	function sendInvite(ctx, next) {
		if (!ctx.isNewInstance) {
			return next();
		}

		debug('send invite');

		var server = Invitation.app;

		async.series([
			function (cb) {
				debug('include user %j', ctx.instance);

				Invitation.include([ctx.instance], 'user', function (err) {
					if (err) {
						var e = new VError(err, 'could not render verification email');
						return next(e);
					}
					cb();
				});
			},
			function (cb) {
				debug('send email %j', ctx.instance.user());

				var url = server.locals.config.publicHost + '/api/Invites/' + ctx.instance.token;
				var endpoint = server.locals.config.publicHost + '/' + ctx.instance.user().username;

				var options = {
					'to': ctx.instance.email,
					'from': 'mrhodes@myantisocial.net',
					'subject': 'Friend request from ' + ctx.instance.user().name,
					'user': ctx.instance.user().name,
					'email': ctx.instance.user().email,
					'url': url,
					'endpoint': endpoint,
					'note': ctx.instance.note
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
			next();
		});
	}
};
