module.exports = function () {
	return function globalSettings(req, res, next) {
		var reqContext = req.getCurrentContext();
		req.app.models.Settings.findOne({
			'where': {
				'group': 'global'
			}
		}, function (err, group) {
			if (err) {
				return next(err);
			}
			reqContext.set('globalSettings', group ? group.settings : {
				'multiUser': process.env.REGISTER_POLICY ? process.env.REGISTER_POLICY : 'invite',
				'serverName': 'AntiSocial',
				'serverTitle': 'User centered Distibuted Social Networking',
				'serverDescription': 'Your server. Your data. Your network.',
				'communityChannel': true
			});
			next();
		});
	};
};
