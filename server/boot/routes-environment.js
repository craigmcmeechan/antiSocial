var getCurrentUser = require('../middleware/context-currentUser');
var fs = require('fs');
var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (server) {
	var router = server.loopback.Router();

	// initial setup onboarding page - do only once
	router.get('/environment', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;

		if (!process.env.ENVFILE) {
			return res.send('Environment file not defined. (ENVFILE)');
		}

		// if not first run need to be superuser
		if (ctx.get('nodeIsInitialized')) {
			var roles = ctx.get('currentUserRoles');
			if (roles && roles.length) {
				for (var i = 0; i < roles.length; i++) {
					if (roles[i].role().name === 'superuser') {
						ctx.set('isSuperUser', 'true');
					}
				}
			}
			if (!ctx.get('currentUser') || !ctx.get('isSuperUser')) {
				return res.sendStatus(401);
			}
		}

		res.render('pages/environment', {
			'user': ctx.get('currentUser'),
			'globalSettings': ctx.get('globalSettings'),
			'env': process.env
		});
	});

	router.post('/environment', getCurrentUser(), function (req, res, next) {
		var ctx = req.myContext;

		if (!process.env.ENVFILE) {
			return res.send('Environment file not defined. (ENVFILE)');
		}

		// if not first run need to be superuser
		if (ctx.get('nodeIsInitialized')) {
			var roles = ctx.get('currentUserRoles');
			if (roles && roles.length) {
				for (var i = 0; i < roles.length; i++) {
					if (roles[i].role().name === 'superuser') {
						ctx.set('isSuperUser', 'true');
					}
				}
			}
			if (!ctx.get('currentUser') || !ctx.get('isSuperUser')) {
				return res.sendStatus(401);
			}
		}

		// make a list of defined + editable environment vars
		var current = require('dotenv').config({
			path: process.env.ENVFILE
		});

		var variables = {};
		for (var prop in current.parsed) {
			variables[prop] = 1;
		}
		variables['PUBLIC_HOST'] = 1;
		variables['PUBLIC_PROTOCOL'] = 1;
		variables['PUBLIC_PORT'] = 1;
		variables['BEHIND_PROXY'] = 1;

		for (var prop in req.body) {
			process.env[prop] = req.body[prop];
		}

		var toSave = '';
		for (var prop in process.env) {
			if (variables[prop]) {
				toSave += prop + '=' + process.env[prop] + '\n';
			}
		}

		fs.writeFile(process.env.ENVFILE, toSave, function (err) {
			if (err) {
				res.sendStatus(500);
			}
			res.send('Saved. Restarting server - please wait a bit then <a href="/">Click Here</a> to continue.');
			process.exit();
		});
	});

	server.use(router);
};
