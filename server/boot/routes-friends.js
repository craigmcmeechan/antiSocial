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

  // friends page
  router.get('/friends', getCurrentUser(), ensureLoggedIn(), getFriends(), function (req, res, next) {
    var ctx = req.myContext;
    res.render('pages/friends', {
      'user': ctx.get('currentUser'),
      'globalSettings': ctx.get('globalSettings'),
      'friends': ctx.get('friends')
    });
  });

  // friends page lookup endpoint
  router.post('/friends', getCurrentUser(), ensureLoggedIn(), getFriends(), function (req, res, next) {
    var ctx = req.myContext;
    var currentUser = ctx.get('currentUser');

    var options = {
      'url': req.body.endpoint + '/profile.json',
      'json': true
    };

    request.get(options, function (err, response, body) {
      var e;

      if (err) {
        e = 'could not load ' + options.url;
      }

      if (!e && response.statusCode !== 200) {
        e = 'could not load ' + options.url + ' http status:' + response.statusCode;
        body = undefined;
      }

      console.log('profile %j', body);

      res.app.models.MyUser.include([currentUser], 'friends', function (err, instances) {
        res.render('pages/friends', {
          'user': ctx.get('currentUser'),
          'friends': ctx.get('friends'),
          'globalSettings': ctx.get('globalSettings'),
          'endpoint': req.body.endpoint,
          'profile': body,
          'error': e
        });
      });
    });
  });

  server.use(router);
};
