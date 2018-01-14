var checkProxyRE = /^\/([a-zA-Z0-9\-]+)/;
var debug = require('debug')('proxy');
var debugVerbose = require('debug')('proxy:verbose');

module.exports = function (view) {
	return function rewriteUrls(req, res, next) {

		var ctx = req.myContext;
		var matches = req.url.match(checkProxyRE);
		if (!matches) {
			return next();
		}

		var username = matches[1];
		var currentUser = ctx.get('currentUser');
		if (!currentUser) {
			return next();
		}

		req.app.models.MyUser.findOne({
			'where': {
				'username': username
			},
			'include': ['uploads']
		}, function (err, user) {
			if (err) {
				return next(err);
			}

			if (user) {
				return next();
			}

			var query = {
				'where': {
					'and': [{
						'userId': currentUser.id
					}, {
						'remoteUsername': username
					}]
				}
			};

			req.app.models.Friend.findOne(query, function (err, friend) {
				if (err) {
					return next(err);
				}
				if (!friend) {
					return next();
				}
				debug('found non resident user as a friend of currentUser rewite url as proxy:', friend.remoteEndPoint);
				var rewrite = req.url;
				req.query.endpoint = friend.remoteHost + rewrite;
				req.url = '/proxy-' + view;
				ctx.set('redirectProxy', true);
				return next();
			});
		});
	};
};
