var i18n = require('i18n');
var async = require('async');
var fs = require('fs');
var path = require('path');

module.exports = function (server, done) {
	return done();

	console.log('syncing i18n json with db');

	var locales = i18n.getLocales();
	var catalog = i18n.getCatalog();

	var pairs = [];

	for (var i = 0; i < locales.length; i++) {
		var locale = locales[i];
		for (var k in catalog[locale]) {
			var v = catalog[locale][k];
			pairs.push({
				'locale': locale,
				'key': k,
				'value': v
			});
		}
	}

	// copy i18n json file data into db
	async.mapSeries(pairs, findOrCreateEntry, function (err, results) {
		if (err) {
			return done(err);
		}

		console.log('i18n json -> db sync complete');

		done();
	});


	function findOrCreateEntry(translate, cb) {
		var query = {
			'where': {
				'and': [{
					'locale': translate.locale
				}, {
					'key': translate.key
				}]
			}
		};

		server.models.I18n.findOrCreate(query, translate, function (err, instance, created) {
			if (err) {
				return cb(err);
			}

			if (created) {
				console.log(instance);
			}

			instance.value = translate.value;
			instance.save();

			cb(err, instance);
		});
	}
}
