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
		variables['PORT'] = 1;
		variables['PUBLIC_HOST'] = 1;
		variables['PUBLIC_PROTOCOL'] = 1;
		variables['PUBLIC_PORT'] = 1;
		variables['BEHIND_PROXY'] = 1;

		variables['HTTPS_LISTENER'] = 1;
		variables['SSL_KEY_PATH'] = 1;
		variables['SSL_CERT_PATH'] = 1;
		variables['S3_SSL_KEY_PATH'] = 1;
		variables['S3_SSL_CERT_PATH'] = 1;

		variables['OUTBOUND_MAIL'] = 1;
		variables['OUTBOUND_MAIL_SENDER'] = 1;
		variables['OUTBOUND_MAIL_SMTP_HOST'] = 1;
		variables['OUTBOUND_MAIL_SMTP_PORT'] = 1;
		variables['OUTBOUND_MAIL_SMTP_USER'] = 1;
		variables['OUTBOUND_MAIL_SMTP_PASSWORD'] = 1;
		variables['OUTBOUND_MAIL_SMTP_SSL'] = 1;
		variables['OUTBOUND_MAIL_SENDMAIL_PATH'] = 1;
		variables['SES_KEY'] = 1;
		variables['SES_KEY_ID'] = 1;
		variables['TEST'] = 1;

		variables['CONNECTOR'] = 1;
		variables['MONGO_HOSTNAME'] = 1;
		variables['MONGO_DB_NAME'] = 1;

		variables['NODE_ENV'] = 1;
		variables['ADMIN'] = 1;
		variables['AUTOUPDATE'] = 1;
		variables['DEBUG'] = 1;

		variables['FACEBOOK_CLIENT_ID'] = 1;
		variables['FACEBOOK_CLIENT_SECRET'] = 1;
		variables['GOOGLE_MAPS_API_KEY'] = 1;

		variables['KEEP_FEEDS_OPEN'] = 1;
		variables['LOG_LEVEL'] = 1;
		variables['AWS_REGION'] = 1;

		variables['RAVEN_DSN'] = 1;
		variables['RAVEN_DSN_PUBLIC'] = 1;

		variables['AWS_S3_BUCKET'] = 1;
		variables['AWS_S3_REGION'] = 1;

		variables['ACCESS_LOG'] = 1;

		variables['SUBSCRIPTION'] = 1;
		variables['STRIPE_PK'] = 1;
		variables['STRIPE_SK'] = 1;
		variables['SUBSCRIPTION_TRIAL_PERIOD'] = 1;
		variables['SUBSCRIPTION_STRIPE_PLAN_ID'] = 1;

		variables['ENVFILE'] = 1;

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
				return res.sendStatus(500);
			}
			res.send('Saved. Restarting server - please wait a bit then <a href="/">Click Here</a> to continue.');
			process.exit();
		});
	});

	server.use(router);
};
