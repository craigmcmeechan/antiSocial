var nodemailer = require('nodemailer');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var pug = require('pug');
var debug = require('debug')('mail');
var debugVerbose = require('debug')('mail:verbose');

module.exports = function (server, template, options, cb) {
	if (!process.env.SES_KEY_ID) {
		return cb();
	}

	var transporter = nodemailer.createTransport({
		service: 'SES-US-EAST-1',
		auth: {
			user: process.env.SES_KEY_ID,
			pass: process.env.SES_KEY
		}
	});

	debug('payload %j', options);

	pug.renderFile(server.get('views') + '/' + template + '.pug', options, function (err, html) {
		if (err) {
			var e = new VError(err, 'could not render email');
			return cb(e);
		}
		options.html = html;
		transporter.sendMail(options, function (err, info) {
			if (err) {
				var e = new VError(err, 'could not send email');
				return cb(e);
			}
			cb();
		});
	});
};
