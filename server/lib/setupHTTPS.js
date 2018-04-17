var https = require('https');
var async = require('async');
var sslKey = null;
var sslCert = null;

module.exports = function setupSSL(app, finished) {
	async.series([
		function (cb) {
			// download the keys from s3
			var AWS = require('aws-sdk');
			AWS.config.update({
				'accessKeyId': process.env.AWS_S3_KEY_ID,
				'secretAccessKey': process.env.AWS_S3_KEY,
				'region': process.env.S3_REGION
			});
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

		var server = https.createServer({
			'key': sslKey,
			'cert': sslCert,
		}, app);

		server.listen(443);

		finished(err, server);
	});
};
