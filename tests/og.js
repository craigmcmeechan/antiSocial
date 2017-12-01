var request = require('superagent');
var assert = require('assert');
var expect = require('expect.js');

describe('upload', function () {
	this.timeout(10000);

	it('http should be up', function (done) {
		request
			.get('http://localhost:3000')
			.end(function (err, res) {
				expect(res.status).to.equal(200);
				done();
			});
	});

	it('should be able to scrape a url', function (done) {
		request
			.get('http://localhost:3000/api/OgTags/scrape?url=https://www.facebook.com/')
			.set('Accept', 'application/json')
			.end(function (err, res) {
				assert.equal(res.status, 200);
				expect(res.body).to.be.an('object');
				expect(res.body.result).to.be.an('object');
				expect(res.body.result.ogData.success).to.equal(true);
				done();
			});

	});
});
