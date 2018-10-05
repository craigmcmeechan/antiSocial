var debug = require('debug')('antisocial-friends');

module.exports = function (server) {
	function dbHandler() {
		var self = this;

		self.models = {
			'users': 'MyUser',
			'friends': 'Friend',
			'invitations': 'Invite',
			'blocks': 'Block'
		};

		// store an item
		this.newInstance = function (collectionName, data, cb) {
			server.models[self.models[collectionName]].create(data, function (err, instance) {
				if (cb) {
					cb(err, instance);
				}
				else {
					return instance;
				}
			});
		};

		// get an item by matching some properties
		this.getInstances = function (collectionName, pairs, cb) {
			var query = {
				'where': {
					'and': []
				}
			};

			for (var i = 0; i < pairs.length; i++) {
				var prop = pairs[i].property;
				var value = pairs[i].value;
				var pair = {};
				pair[prop] = value;
				query.where.and.push(pair);
			}

			server.models[self.models[collectionName]].find(query, function (err, found) {
				if (cb) {
					cb(err, found);
				}
				else {
					return found;
				}
			});
		};

		// update item properties by id
		this.updateInstance = function (collectionName, id, patch, cb) {
			server.models[self.models[collectionName]].findById(id, function (err, instance) {
				if (err) {
					if (cb) {
						return cb(new Error('error reading ' + collectionName));
					}
					return;
				}
				if (!instance) {
					if (cb) {
						return cb(new Error('error ' + collectionName + ' id ' + id + ' not found'));
					}
					return;
				}

				instance.updateAttributes(patch, function (err, updated) {
					if (err) {
						debug('error updating instance %j', err);
						if (cb) {
							return cb(err);
						}
						return;
					}
					if (cb) {
						cb(null, updated);
					}
					else {
						return updated;
					}
				});
			});
		};

		this.deleteInstance = function (collectionName, id, cb) {
			server.models[self.models[collectionName]].destroyById(id, function (err) {
				if (cb) {
					cb(err);
				}
			});
		};
	}

	return new dbHandler();
};
