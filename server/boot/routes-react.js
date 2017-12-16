var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var isInitialized = require('../middleware/context-initialized');
var publicUsers = require('../middleware/context-publicUsers');
var pendingFriendRequests = require('../middleware/context-pendingFriendRequests');
var getRecentPosts = require('../middleware/context-getRecentPosts');
var getFriends = require('../middleware/context-getFriends');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var getFriendForEndpoint = require('../middleware/context-getFriendForEndpoint');
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



  router.post('/react', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var reaction = req.body.reaction;
    var endpoint = req.body.endpoint;
    var postAuthorName = req.body.postAuthorName;
    var photoId = req.body.photoId;

    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');

    currentUser.pushNewsFeedItems.create({
      'uuid': uuid(),
      'type': 'react',
      'source': server.locals.config.publicHost + '/' + currentUser.username,
      'about': endpoint,
      'visibility': ['friends'],
      'details': {
        'reaction': reaction,
        'photoId': photoId
      }
    }, function (err, news) {
      if (err) {
        var e = new VError(err, 'could not reaction');
        return next(e);
      }
      res.send({
        'status': 'ok'
      });
    });
  });


  server.use(router);
};
