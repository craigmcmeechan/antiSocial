var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var isInitialized = require('../middleware/context-initialized');
var publicUsers = require('../middleware/context-publicUsers');

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
    var photoId = req.body.photoId;

    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');

    async.waterfall([
      function (cb) { // save comment and notify network
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
            var e = new VError(err, 'could not create reaction');
            return cb(e);
          }
          cb(null, news);
        });
      },
      function (news, cb) { // notify self
        var item = {
          'uuid': news.uuid,
          'type': 'react',
          'source': news.source,
          'about': news.about,
          'userId': currentUser.id,
          'createdOn': news.createdOn,
          'updatedOn': news.updatedOn,
          'details': {
            'reaction': reaction,
            'photoId': photoId
          }
        };

        req.app.models.NewsFeedItem.create(item, function (err, item) {
          if (err) {
            var e = new VError(err, 'could not save NewsFeedItem');
            return cb(e);
          }
          cb();
        });
      }
    ], function (err) {
      if (err) {
        return next(err);
      }
      res.send({
        'status': 'ok'
      });
    });
  });

  server.use(router);
};
