var RemoteRouting = require('loopback-remote-routing');
var request = require('request');
var url = require('url');

module.exports = function (Friend) {
	if (!process.env.ADMIN) {
		RemoteRouting(Friend, {
			'only': []
		});
	}

	Friend.observe('after save', function (ctx, next) {
		if (!ctx.instance || ctx.isNewInstance) {
			return next();
		}

		var friend = ctx.instance;
		var payload = {
			'accessToken': friend.remoteAccessToken
		};
		var options = {
			'form': payload,
			'json': true
		};

		// TODO improve error handling
		if (ctx.instance.status === 'canceled') {
			options.url = friend.remoteEndPoint + '/friend-webhook/friend-request-canceled';
			request.post(options, function (err, response, body) {
				friend.destroy();
				next();
			});
		}
		else if (ctx.instance.status === 'declined' || ctx.instance.status === 'blocked') {
			options.url = friend.remoteEndPoint + '/friend-webhook/friend-request-declined';
			request.post(options, function (err, response, body) {
				if (ctx.instance.status === 'declined') {
					friend.destroy();
				}
				next();
			});
		}
		else {
			next();
		}
	});

};
