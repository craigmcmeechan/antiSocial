module.exports = getDB();

function getDB() {
	var db;

	if (process.env.CONNECTOR === 'mysql') {
		db = {
			'db': {
				'name': 'db',
				'connector': 'mysql',
				'host': process.env.RDS_HOSTNAME ? process.env.RDS_HOSTNAME : 'localhost',
				'port': process.env.RDS_PORT ? process.env.RDS_PORT : 3306,
				'database': process.env.RDS_DB_NAME ? process.env.RDS_DB_NAME : 'antisocial',
				'user': process.env.RDS_USERNAME ? process.env.RDS_USERNAME : '',
				'password': process.env.RDS_PASSWORD ? process.env.RDS_PASSWORD : ''
			}
		};

		console.log('using mysql connector');
	}

	else if (process.env.CONNECTOR === 'mongo') {
		db = {
			'db': {
				'name': 'db',
				'connector': 'mongodb',
				'host': process.env.MONGO_HOSTNAME ? process.env.MONGO_HOSTNAME : 'localhost',
				'port': process.env.MONGO_PORT ? process.env.MONGO_PORT : 27017,
				'database': process.env.MONGO_DB_NAME ? process.env.MONGO_DB_NAME : 'antisocial',
				'user': process.env.MONGO_USERNAME ? process.env.MONGO_USERNAME : '',
				'password': process.env.MONGO_PASSWORD ? process.env.MONGO_PASSWORD : '',
				'url': process.env.MONGO_URL
			}
		};
		console.log('using mongodb connector');
	}
	else {
		db = {
			'db': {
				'name': 'db',
				'connector': 'memory',
				'file': 'working/memory-db.json'
			}
		}
		console.log('using memory connector');
	}

	return db;
}
