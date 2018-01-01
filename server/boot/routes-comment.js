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

  // create a new post
  router.post('/comment', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');
    var myEndPoint = req.app.locals.config.publicHost + '/' + currentUser.username;
    var whoAbout = req.body.about.replace(/\/post\/.*$/, '');
    var postuuid = req.body.about.replace(/^.*\/post\//, '');
    var photoId = req.body.photoId;

    async.waterfall([
      function findFriend(cb) {
        var query = {
          'where': {
            'and': [{
              'userId': currentUser.id
            }, {
              'remoteEndPoint': whoAbout
            }]
          }
        };

        req.app.models.Friend.findOne(query, function (err, friend) {
          if (err) {
            var e = new VError(err, 'could not find friend');
            return next(err);
          }
          cb(null, friend);
        });
      },
      function makePushNewsFeedItem(friend, cb) { // notify network
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

        currentUser.pushNewsFeedItems.create(item, function (err, pushNews) {
          if (err) {
            var e = new VError(err, 'could not save pushNewsFeedItems');
            return cb(e);
          }
          cb(err, friend, pushNews);
        });
      },
      function makeNewsFeedItem(friend, news, cb) { // notify self
        var item = {
          'uuid': news.uuid,
          'type': 'comment',
          'source': news.source,
          'about': news.about,
          'details': {
            'body': news.details.body,
            'photoId': news.details.photoId
          },
          'userId': currentUser.id,
          'createdOn': news.createdOn,
          'updatedOn': news.updatedOn
        };

        req.app.models.NewsFeedItem.create(item, function (err, item) {
          if (err) {
            var e = new VError(err, 'could not save NewsFeedItem');
            return cb(e);
          }

          cb(err, item);
        });
      }

    ], function (err, item) {
      if (err) {
        var e = new WError(err, 'could not save comment');
        return next(err);
      }

      res.send({
        'status': 'ok',
        'comment': item
      });

    });
  });
  server.use(router);
};
