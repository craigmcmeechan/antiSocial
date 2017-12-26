var checkProxyRE = /^\/([a-zA-Z0-9\-]+)/;
var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (view) {
	return function rewriteUrls(req, res, next) {
		// EXPERIMENTAL - check to see if the username is not on this server try to map it
		// to a friend. Perhaps re-write the url in the proxy form. Issue is an edge case
		// the user could have more than one friend with the same username on different
		// servers. Possible solution - instead of using the user supplied username, use a
		// hash of username and server as the username so that they are globally unique.
		// cons: not human readabel http://xx.xx.xx/some-user becomes http://xx.xx.xx/<hex hash>
		// pros: eliminate need for proxy form of url being exposed to users
		var ctx = req.myContext;
		var matches = req.url.match(checkProxyRE);
		if (!matches) {
			return next();
		}

		var username = matches[1];
		var currentUser = ctx.get('currentUser');

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
