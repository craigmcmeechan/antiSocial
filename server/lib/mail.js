// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var nodemailer = require('nodemailer');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var pug = require('pug');
var debug = require('debug')('mail');
var debugVerbose = require('debug')('mail:verbose');
var rateLimit = require('function-rate-limit');

function mail(server, template, options, cb) {
	var transporter;
	if (process.env.OUTBOUND_MAIL === 'SES') {
		var config;
		if (process.env.SES_KEY_ID && process.env.SES_KEY) {
			config = {
				'service': 'SES-US-EAST-1',
				'auth': {
					'user': process.env.SES_KEY_ID,
					'pass': process.env.SES_KEY
				}
			};
		}
		else {
			var AWS = require('aws-sdk');
			if (process.env.AWS_CONFIG) {
				AWS.config.loadFromPath(process.env.AWS_CONFIG);
			}
			else {
				AWS.config.credentials = new AWS.EC2MetadataCredentials();
			}
			config = {
				SES: new AWS.SES({
					apiVersion: '2010-12-01'
				})
			};
		}

		transporter = nodemailer.createTransport(config);
	}
	else if (process.env.OUTBOUND_MAIL === 'SENDMAIL') {
		transporter = nodemailer.createTransport({
			'sendmail': true,
			'newline': 'unix',
			'path': process.env.OUTBOUND_MAIL_SENDMAIL_PATH || '/usr/sbin/sendmail'
		});
	}
	else if (process.env.OUTBOUND_MAIL === 'SMTP') {
		var config = {
			host: process.env.OUTBOUND_MAIL_SMTP_HOST,
			port: process.env.OUTBOUND_MAIL_SMTP_PORT || 25,
			secure: process.env.OUTBOUND_MAIL_SMTP_SSL === 'true' ? true : false,
			'logger': true,
			'debug': true
		};

		if (process.env.OUTBOUND_MAIL_SMTP_USER && process.env.OUTBOUND_MAIL_SMTP_PASSWORD) {
			config.auth = {
				user: process.env.OUTBOUND_MAIL_SMTP_USER,
				pass: process.env.OUTBOUND_MAIL_SMTP_PASSWORD
			};
		}

		transporter = nodemailer.createTransport(config);
	}
	else {
		return cb();
	}

	debug('payload %j', options);

	pug.renderFile(server.get('views') + '/' + template + '.pug', options, function (err, html) {
		if (err) {
			debug('render errors %j', err);
			var e = new VError(err, 'could not render email');
			return cb(e);
		}
		options.html = html;
		transporter.sendMail(options, function (err, info) {
			debug('email result %j %j', err, info);
			if (err) {
				var e = new VError(err, 'could not send email');
				return cb(e);
			}
			cb(null, info);
		});
	});
}

var rateLimited = rateLimit(2, 1000, mail);

module.exports = rateLimited;
