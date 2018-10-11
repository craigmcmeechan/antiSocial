// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function () {
	return function globalSettings(req, res, next) {
		var reqContext = req.getCurrentContext();
		req.app.models.Settings.findOne({
			'where': {
				'group': 'global'
			},
			'include': ['uploads']
		}, function (err, group) {
			if (err) {
				return next(err);
			}

			var settings = {
				'multiUser': process.env.REGISTER_POLICY ? process.env.REGISTER_POLICY : 'invite',
				'serverOperator': 'Anonymous Operator',
				'serverTitle': 'A myAntisocial.net node',
				'serverDescription': 'Your server. Your data. Your network.'
			};

			if (group) {
				settings = group.settings;
				settings.instance = group;
			}

			reqContext.set('globalSettings', settings);
			next();
		});
	};
};
