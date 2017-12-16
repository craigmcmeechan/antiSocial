var resolveProfiles = require('./resolveProfiles');
var server = require('../server');
var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');

module.exports = function newsFeedItemResolve(currentUser, myNewsFeedItem, done) {
	resolveProfiles(myNewsFeedItem, function (err) {
		var myEndPoint = server.locals.config.publicHost + '/' + currentUser.username;

		var sourceProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.source];
		var aboutProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.about];
		var whoAbout = myNewsFeedItem.about.replace(/\/post\/.*$/, '');

		if (myNewsFeedItem.type === 'friend') {
			debug(myNewsFeedItem.source + ' and ' + myNewsFeedItem.about + ' are now friends');

			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + sourceProfile.profile.name + '</a>';
			if (whoAbout === myEndPoint) {
				myNewsFeedItem.humanReadable += ' accepted.';
			}
			else {
				myNewsFeedItem.humanReadable += ' added <a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">' + aboutProfile.profile.name + '</a>';
			}
		}

		if (myNewsFeedItem.type === 'post') {
			if (myNewsFeedItem.target === myEndPoint) {
				debug('my friend "' + sourceProfile.profile.name + '" posted ' + myNewsFeedItem.about + ' to my wall');
			}
			else {
				debug('my friend "' + sourceProfile.profile.name + '" posted ' + myNewsFeedItem.about);
			}
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + sourceProfile.profile.name + '</a>';
			myNewsFeedItem.humanReadable += ' posted <a href="/proxy-post?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">this</a>';
			if (myNewsFeedItem.target === myEndPoint) {
				myNewsFeedItem.humanReadable += ' on my wall';
			}
		}

		if (myNewsFeedItem.type === 'comment') {
			var author = aboutProfile.profile.name;

			var postDesc = 'this post';

			if (whoAbout === myEndPoint) {
				postDesc = 'my post';
				author = '';
			}

			debug('my friend "' + sourceProfile.profile.name + '" commented on ' + myNewsFeedItem.about);
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + sourceProfile.profile.name + '</a>';
			myNewsFeedItem.humanReadable += ' commented on <a href="/proxy-post?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">' + postDesc + '</a>';
			if (author) {
				myNewsFeedItem.humanReadable += ' by ' + author;
			}
		}

		if (myNewsFeedItem.type === 'react') {
			var author = aboutProfile.profile.name;
			var postDesc = 'this post';
			if (whoAbout === myEndPoint) {
				postDesc = 'my post';
				author = '';
			}

			var reaction = '<span class="em em-' + myNewsFeedItem.details.reaction + '"></span>';

			debug('my friend "' + sourceProfile.profile.name + '" liked ' + author);
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + sourceProfile.profile.name + '</a>';
			myNewsFeedItem.humanReadable += ' ' + reaction + ' <a href="/proxy-post?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">' + postDesc + '</a>';
			if (author) {
				myNewsFeedItem.humanReadable += ' by ' + author;
			}
		}

		done(null, myNewsFeedItem);
	});
};
