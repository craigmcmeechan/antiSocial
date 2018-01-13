var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var isInitialized = require('../middleware/context-initialized');
var publicUsers = require('../middleware/context-publicUsers');
var pendingFriendRequests = require('../middleware/context-pendingFriendRequests');

var url = require('url');
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

  // preferences and activity
  router.get('/settings', getCurrentUser(), ensureLoggedIn(), pendingFriendRequests(), function (req, res, next) {
    var ctx = req.myContext;
    res.render('pages/settings', {
      'user': ctx.get('currentUser'),
      'globalSettings': ctx.get('globalSettings'),
      'pendingFriendRequests': ctx.get('pendingFriendRequests')
    });
  });

  server.use(router);
};
