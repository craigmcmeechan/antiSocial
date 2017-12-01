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

  // initial setup onboarding page - do only once
  router.get('/setup', isInitialized(), getCurrentUser(), function (req, res, next) {
    var ctx = req.myContext;
    if (ctx.get('nodeIsInitialized')) {
      res.set('x-digitopia-hijax-flash-level', 'error');
      res.set('x-digitopia-hijax-flash-message', 'already initialized');
      if (req.headers['x-digitopia-hijax']) {
        return res.set('x-digitopia-hijax-location', '/').send('redirect to ' + '/');
      }
      res.redirect('/');
    }
    else {
      res.render('pages/setup', {
        'user': ctx.get('currentUser'),
        'globalSettings': ctx.get('globalSettings')
      });
    }
  });

  server.use(router);
};
