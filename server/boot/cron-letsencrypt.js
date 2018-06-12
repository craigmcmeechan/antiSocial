// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var cron = require('node-cron');
var async = require('async');
var debug = require('debug')('tasks');
var exec = require('child_process').exec;

module.exports = function autopost(server) {
	if (process.env.LETS_ENCRYPT !== 'true') {
		return;
	}
	debug('starting letsencrypt renewal daemon');

	cron.schedule('0 3 * * *', function () {
		var command = '/usr/local/bin/certbot-auto --no-bootstrap renew --deploy-hook "supervisorctl restart antisocial"';
		exec(command, function (err, stdout, stderr) {});
	});
};
