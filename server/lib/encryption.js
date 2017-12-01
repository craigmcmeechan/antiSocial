var crypto = require('crypto');
var uuid = require('uuid');
var debug = require('debug')('encryption');

var algorithm = 'aes-256-ctr';

// implement Hybrid Cryptosystem for PushNewsFeed
// - user to user encryption using exchanged public keys


// public key of recipient, private key of sender, data to encrypt
module.exports.encrypt = function (publicKey, privateKey, stringToEncrypt) {

	debug('encrypt %s', stringToEncrypt);

	var password = uuid();

	// sign message with private key
	const sign = crypto.createSign('RSA-SHA256');
	sign.write(stringToEncrypt);
	sign.end();
	var sig = sign.sign(privateKey, 'hex');

	// encrypt message with aes using random password as the key
	var cipher = crypto.createCipher(algorithm, password);
	var encrypted = cipher.update(stringToEncrypt, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	// encrypt random password using public key
	var pass = crypto.publicEncrypt(publicKey, new Buffer(password));

	var payload = {
		'data': encrypted,
		'pass': pass,
		'sig': sig
	};

	debug('encrypt payload %j', payload);

	return (payload);
};

// public key of sender, private key of recipient
// data, pass & sig from sender's call to encrypt
module.exports.decrypt = function (publicKey, privateKey, data, pass, sig) {
	debug('decrypt data %s pass %j sig %s', data, pass, sig);

	// decrypt password with private key
	var decryptedPass = crypto.privateDecrypt(privateKey, new Buffer(pass, 'base64')).toString('utf8');

	// decrypt message using decrypted password
	var decipher = crypto.createDecipher(algorithm, decryptedPass);
	var decrypted = decipher.update(data, 'hex', 'utf8');
	decrypted += decipher.final('utf8');

	// validate signature using public key
	const verify = crypto.createVerify('RSA-SHA256');
	verify.update(decrypted);
	var valid = verify.verify(publicKey, sig, 'hex');

	debug('decrypt decryptedPass %s valid %s decrypted %s', decryptedPass, valid, decrypted);

	return {
		'data': decrypted,
		'valid': valid
	};
};
