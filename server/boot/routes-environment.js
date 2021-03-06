// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var fs = require('fs');
var exec = require('child_process').exec;
var isInitialized = require('../middleware/context-initialized');
var ensureSuperUser = require('../middleware/context-ensureSuperUser');


var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

// valid environment variables for env file
var variables = [
	'PORT',
	'PUBLIC_HOST',
	'PUBLIC_PROTOCOL',
	'PUBLIC_PORT',
	'BEHIND_PROXY',

	'HTTPS_LISTENER',
	'SSL_KEY_PATH',
	'SSL_CERT_PATH',
	'S3_SSL_KEY_PATH',
	'S3_SSL_CERT_PATH',
	'LETS_ENCRYPT',

	'OUTBOUND_MAIL',
	'OUTBOUND_MAIL_SENDER',
	'OUTBOUND_MAIL_SMTP_HOST',
	'OUTBOUND_MAIL_SMTP_PORT',
	'OUTBOUND_MAIL_SMTP_USER',
	'OUTBOUND_MAIL_SMTP_PASSWORD',
	'OUTBOUND_MAIL_SMTP_SSL',
	'OUTBOUND_MAIL_SENDMAIL_PATH',
	'SES_KEY',
	'SES_KEY_ID',

	'CONNECTOR',
	'MONGO_HOSTNAME',
	'MONGO_DB_NAME',
	'MEMORY_CONNECTOR_BACKING_FILE',

	'NODE_ENV',
	'ADMIN',
	'AUTOUPDATE',
	'DEBUG',

	'FACEBOOK_CLIENT_ID',
	'FACEBOOK_CLIENT_SECRET',
	'GOOGLE_MAPS_API_KEY',

	'KEEP_FEEDS_OPEN',
	'LOG_LEVEL',
	'AWS_REGION',

	'RAVEN_DSN',
	'RAVEN_DSN_PUBLIC',

	'AWS_S3_BUCKET',
	'AWS_S3_REGION',

	'ACCESS_LOG',

	'SUBSCRIPTION',
	'STRIPE_PK',
	'STRIPE_SK',
	'SUBSCRIPTION_TRIAL_PERIOD',
	'SUBSCRIPTION_STRIPE_PLAN_ID',

	'ENVFILE',
	'LOCAL_UPLOADS'
];

module.exports = function (server) {
	var router = server.loopback.Router();

	router.get('/letsencrypt', isInitialized(), getCurrentUser(), ensureSuperUser(), function (req, res, next) {
		var ctx = req.myContext;

		if (!process.env.ENVFILE) {
			return res.send('Environment file not defined. (ENVFILE)');
		}

		res.render('pages/letsencrypt', {
			'user': ctx.get('currentUser'),
			'globalSettings': ctx.get('globalSettings'),
			'env': process.env,
			'pageTitle': 'Environment'
		});
	});

	router.post('/letsencrypt', isInitialized(), getCurrentUser(), ensureSuperUser(), function (req, res, next) {
		var ctx = req.myContext;

		if (!process.env.ENVFILE) {
			return res.send('Environment file not defined. (ENVFILE)');
		}

		if (!req.body.PUBLIC_HOST || !req.body.email) {
			return res.sendStatus(400);
		}

		var domain = req.body.PUBLIC_HOST;
		var email = req.body.email;

		var command = '/usr/local/bin/certbot-auto certonly --debug --webroot -w /var/app/current/client -m ' + email + ' -d ' + domain + ' --agree-tos';

		exec(command, function (err, stdout, stderr) {
			if (err) {
				console.log(err, stdout, stderr);
				res.send(stderr);
			}

			process.env['SSL_KEY_PATH'] = '/etc/letsencrypt/live/' + domain + '/privkey.pem';
			process.env['SSL_CERT_PATH'] = '/etc/letsencrypt/live/' + domain + '/fullchain.pem';
			process.env['HTTPS_LISTENER'] = 'true';
			process.env['PUBLIC_HOST'] = domain;
			process.env['PUBLIC_PORT'] = '443';
			process.env['PUBLIC_PROTOCOL'] = 'https';
			process.env['PORT'] = '443';
			process.env['LETS_ENCRYPT'] = 'true';

			var toSave = '';
			for (var prop in process.env) {
				if (variables.indexOf(prop) !== -1) {
					toSave += prop + '=' + process.env[prop] + '\n';
				}
			}

			fs.writeFile(process.env.ENVFILE, toSave, function (err) {
				if (err) {
					return res.sendStatus(500);
				}
				res.send('SSL configured. Restarting server - please wait a bit then <a href="https://' + domain + '/environment">Click Here</a> to continue.');
				process.exit();
			});
		});
	});

	router.get('/environment', isInitialized(), getCurrentUser(), ensureSuperUser(), function (req, res, next) {
		var ctx = req.myContext;

		if (!process.env.ENVFILE) {
			return res.send('Environment file not defined. (ENVFILE)');
		}

		res.render('pages/environment', {
			'user': ctx.get('currentUser'),
			'globalSettings': ctx.get('globalSettings'),
			'env': process.env,
			'pageTitle': 'Environment'
		});
	});

	router.post('/environment', isInitialized(), getCurrentUser(), ensureSuperUser(), function (req, res, next) {
		var ctx = req.myContext;

		if (!process.env.ENVFILE) {
			return res.send('Environment file not defined. (ENVFILE)');
		}

		// make a list of defined + editable environment vars
		var current = require('dotenv').config({
			path: process.env.ENVFILE
		});

		for (var prop in req.body) {
			process.env[prop] = req.body[prop];
		}

		var toSave = '';
		for (var prop in process.env) {
			if (variables.indexOf(prop) !== -1) {
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
