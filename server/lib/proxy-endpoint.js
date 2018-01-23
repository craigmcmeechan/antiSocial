var url = require('url');

module.exports = function (endpoint) {
	if (!endpoint) {
		return;
	}
	return url.parse(endpoint).pathname;
};
