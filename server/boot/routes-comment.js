var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var isInitialized = require('../middleware/context-initialized');
var publicUsers = require('../middleware/context-publicUsers');
var pendingFriendRequests = require('../middleware/context-pendingFriendRequests');
var getRecentPosts = require('../middleware/context-getRecentPosts');
var getFriends = require('../middleware/context-getFriends');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var getFriendForEndpoint = require('../middleware/context-getFriendForEndpoint');
var collectFeed = require('../middleware/context-collectFeed');
var resolveProfiles = require('../lib/resolveProfiles');
var nodemailer = require('nodemailer');
var qs = require('querystring');


var uuid = require('uuid');

var url = require('url');
var uuid = require('uuid');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var request = require('request');
var _ = require('lodash');
var multer = require('multer');
var path = require('path');
var pug = require('pug');


var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();

  // create a new post
  router.post('/comment', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    var myEndPoint = req.app.locals.config.publicHost + '/' + currentUser.username;
    var whoAbout = req.body.about.replace(/\/post\/.*$/, '');
    var postuuid = req.body.about.replace(/^.*\/post\//, '');
    var photoId = req.body.photoId;

    var item = {
      'uuid': uuid(),
      'type': 'comment',
      'source': server.locals.config.publicHost + '/' + currentUser.username,
      'about': req.body.about,
      'visibility': ['public'],
      'details': {
        'body': req.body.body,
        'photoId': photoId
      }
    };

    var rendered = '<div class="comment"><a href="/proxy-profile?endpoint=' + encodeURIComponent(item.source) + '"><img class="profile-thumb" src="' + req.app.locals.getUploadForProperty('photo', currentUser.uploads(), 'thumb', req.app.locals.headshotFPO).url + '"><span class="profile-link">' + currentUser.name + '</span></a>' + server.locals.marked(item.details.body) + '</div><div class="clearfix"></div>';

    currentUser.pushNewsFeedItems.create(item, function (err, news) {
      if (err) {
        var e = new VError(err, 'could not save post');
        return next(e);
      }

      res.send({
        'status': 'ok',
        'rendered': rendered,
        'comment': item
      });
    });
  });

  server.use(router);
};
