// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var https = require('https');
var async = require('async');
var sslKey = null;
var sslCert = null;

module.exports = function setupSSL(app, finished) {
	async.series([
		function (cb) {
			if (!process.env.SSL_KEY_PATH || !process.env.SSL_CERT_PATH) {
				return cb();
			}
			var fs = require('fs');
			sslKey = fs.readFileSync(process.env.SSL_KEY_PATH, 'utf8');
			sslCert = fs.readFileSync(process.env.SSL_CERT_PATH, 'utf8');
			cb();
		},
		function (cb) {
			if (!process.env.S3_SSL_KEY_PATH || !process.env.S3_SSL_CERT_PATH) {
				return cb();
			}

			// download the keys from s3
			var AWS = require('aws-sdk');

			if (process.env.AWS_S3_KEY_ID && process.env.AWS_S3_KEY && process.env.AWS_S3_REGION) {
				AWS.config.update({
					'accessKeyId': process.env.AWS_S3_KEY_ID,
					'secretAccessKey': process.env.AWS_S3_KEY,
					'region': process.env.AWS_S3_REGION
				});
			}
			else if (process.env.AWS_CONFIG) {
				AWS.config.loadFromPath(process.env.AWS_CONFIG);
			}
			else {
				AWS.config.credentials = new AWS.EC2MetadataCredentials();
			}

			var s3 = new AWS.S3();

			// get the key
			var keyfile = process.env.S3_SSL_KEY_PATH.split('/');
			var keybucket = keyfile[1];
			var keypath = keyfile.slice(2).join('/');

			var certfile = process.env.S3_SSL_CERT_PATH.split('/');
			var certbucket = certfile[1];
			var certpath = certfile.slice(2).join('/');

			//get the files
			async.series([
				function (done) {
					s3.getObject({
						'Bucket': keybucket,
						'Key': keypath,
					}, function (err, data) {
						sslKey = data.Body.toString();
						done(err);
					});
				},
				function (done) {
					s3.getObject({
						'Bucket': certbucket,
						'Key': certpath,
					}, function (err, data) {
						sslCert = data.Body.toString();
						done(err);
					});
				}
			], function (err) {
				cb(err);
			});
		}
	], function (err) {
		if (err) {
			return finished(err);
		}
		var listener = https.createServer({
			'key': sslKey,
			'cert': sslCert,
		}, app).listen(443, function (err) {
			finished(err, listener);
		});
	});
};
