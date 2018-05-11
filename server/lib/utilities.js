var proxyEndPoint = require('./proxy-endpoint');

module.exports.fixNameYou = function fixNameYou(endpoint, myendpoint, name, your) {
	if (endpoint === myendpoint) {
		if (your) {
			return 'your';
		}
		return 'you';
	}
	if (your) {
		return name + '\'s';
	}
	return name;
};

module.exports.kindOfThing = function kindOfThing(about) {
	var kind = 'post';
	if (about.match('/post/')) {
		if (about.match('/photo/')) {
			kind = 'photo';
		}
		if (about.match('/comment/')) {
			kind = 'comment';
		}
	}
	return kind;
};

module.exports.whatAbout = function (endpoint, user) {
	endpoint = endpoint.replace(/\/photo\/.*/, '');
	endpoint = endpoint.replace(/\/comment\/.*/, '');
	endpoint = proxyEndPoint(endpoint, user);
	return (endpoint);
};
