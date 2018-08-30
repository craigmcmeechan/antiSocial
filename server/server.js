// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

if (process.env.ENVFILE) {
  require('dotenv').config({
    path: process.env.ENVFILE
  });
}
var loopback = require('loopback');
var boot = require('loopback-boot');
var bunyan = require('bunyan');
var uuid = require('uuid');
var NodeCache = require('node-cache');
var proxyEndPoint = require('./lib/proxy-endpoint');
var websockets = require('./lib/websocketAuthenticate');
var async = require('async');

var app = module.exports = loopback();

if (process.env.XRAY) {
  console.log('setting up AWS XRAY');
  var AWSXray = require('aws-xray-sdk');
  AWSXray.config([
    AWSXray.plugins.ECSPlugin // Add the ECS plugin
  ]);
  app.use(AWSXray.express.openSegment('myAntiSocial'));
  AWSXray.middleware.enableDynamicNaming('*.myantisocial.net');
  AWSXray.captureHTTPsGlobal(require('https'));
  app.middleware('routes:after', AWSXray.express.closeSegment());
}

var FPOImages = [
  '/images/bg1.jpg', '/images/bg2.jpg', '/images/bg3.jpg', '/images/bg4.jpg'
];

function randomFPO() {
  return FPOImages[Math.floor(Math.random() * FPOImages.length)];
}

app.enable('trust proxy');

// use jade templating language
app.set('views', 'server/views');
app.set('view engine', 'pug');
app.locals.pretty = true;

// expose the running environment name to jade
app.locals.env = app.get('env');
app.locals.environment = process.env;
app.locals.getUploadForProperty = require('./lib/getUploadForProperty');
app.locals.moment = require('moment');
app.locals._ = require('lodash');
app.locals.config = require('./config-' + app.get('env'));
app.locals.headshotFPO = app.locals.config.publicHost + '/images/slug.png';
app.locals.FPO = app.locals.config.publicHost + randomFPO();
app.locals.nonce = uuid.v4();
app.locals.myCache = new NodeCache();
app.locals.appDir = __dirname;
app.locals.math = require('mathjs');
app.locals.base64 = require('base-64');

// markdown renderer
var marked = require('marked');
var myRenderer = new marked.Renderer();
myRenderer.image = function (href, title, text) {
  return '<img class="img-responsive" src="' + href + '">';
};
myRenderer.link = function (href, title, text) {
  if (text && text.match(/^http/i)) {
    return '<div class="ogPreview" data-jsclass="OgTagPreview" data-src="/api/OgTags/scrape" data-url="' + encodeURIComponent(href) + '" data-type="json"></div><!--endog-->';
  }
  else {
    if (!text) {
      href = href.replace(/&amp;/g, '&');
      return '<div class="ogPreview" data-jsclass="OgTagPreview" data-src="/api/OgTags/scrape" data-url="' + encodeURIComponent(href) + '" data-type="json"></div><!--endog-->';
    }
    else {
      if (href.match(/^http/i)) {
        return '<a href="' + href + '" target="_blank">' + text + '</a>';
      }
      return '<a href="' + href + '">' + text + '</a>';
    }
  }
};

marked.setOptions({
  'renderer': myRenderer,
  'smartypants': true
});

function renderMarkdown(markdown, editing) {
  if (!markdown) {
    return '';
  }

  var tagged;

  if (editing) {
    tagged = markdown;
  }
  else {
    tagged = markdown.replace(/\[[^\]]+\]\(tag-hash-([^)]+)\)/g, function (tag) {
      tag = tag.replace(/tag-hash-/, '#');
      tag = tag.replace(/\[/, '[#');
      return tag;
    });

    tagged = tagged.replace(/\[[^\]]+\]\(tag-user-([^)]+)\)/g, function (tag) {
      var friendEndPoint = tag;
      friendEndPoint = friendEndPoint.replace(/.*\(tag-user-/, '');
      friendEndPoint = friendEndPoint.replace(/\)$/, '');
      tag = tag.replace(/\(.*\)/, '(' + proxyEndPoint(friendEndPoint) + ')');
      tag = tag.replace(/^\[/, '[@');
      return tag;
    });
  }

  var html = marked(tagged);

  if (editing) {
    html = html.replace(/<a href="tag-user-[^>]+>/g, function (usertag) {
      var forEditor = usertag.replace('<a href="', '<a class="in-editor tag-user" href="');
      forEditor = forEditor.replace(/>/, '><span class="em-usertag"></span>');
      return forEditor;
    });

    html = html.replace(/<a href="tag-hash-[^>]+>/g, function (hashtag) {
      var forEditor = hashtag.replace('<a href="', '<a class="in-editor tag-hash" href="');
      forEditor = forEditor.replace(/>/, '><span class="em-hashtag"></span>');
      return forEditor;
    });

    html = html.replace(/<div class="ogPreview"/g, function (preview) {
      return preview.replace('<div class="ogPreview"', '<div class="ogPreview in-editor tag-hash"');
    });
  }

  return html;
}
app.locals.marked = renderMarkdown;

app.locals.proxyEndPoint = proxyEndPoint;

// localization config
if (process.env.i18n) {
  var i18n = require('i18n');

  i18n.configure({
    locales: ['en', 'es'],
    cookie: 'locale',
    defaultLocale: 'en',
    directory: './locales',
    fallbacks: {
      'es': 'en'
    },
    autoReload: true,
    updateFiles: false
  });
  app.use(i18n.init);
  app.set('i18n', i18n);
}

// setup component storage for s3
if (process.env.LOCAL_UPLOADS !== 'true') {
  var ds = loopback.createDataSource({
    connector: require('loopback-component-storage'),
    provider: 'amazon',
    key: process.env.AWS_S3_KEY,
    keyId: process.env.AWS_S3_KEY_ID,
  });
  var container = ds.createModel('container', {}, {
    base: 'Model'
  });
  app.model(container, {
    'dataSource': ds,
    'public': true
  });
}

if (process.env.CORS) {
  var cors = require('cors');
  app.use(cors({
    'origin': true,
    'exposedHeaders': 'x-digitopia-hijax-flash-level,x-digitopia-hijax-flash-message,x-digitopia-hijax-location,x-digitopia-hijax-did-login,x-digitopia-hijax-did-logout,x-highwater'
  }));
}

// use loopback.token middleware on all routes
// setup gear for authentication using cookie (access_token)
// Note: requires cookie-parser (defined in middleware.json)
app.use(loopback.token({
  model: app.models.accessToken,
  currentUserLiteral: 'me',
  searchDefaultTokenKeys: false,
  cookies: ['access_token'],
  headers: ['access_token', 'X-Access-Token'],
  params: ['access_token']
}));

// rolling ttl on access token
// if ttl is within one week add two weeks
// getTime is in milliseconds. ttl is in seconds
app.use(function (req, res, next) {
  var oneDay = 60 * 60 * 24; // seconds
  var oneWeek = oneDay * 7;
  var twoWeeks = oneDay * 14;
  if (!req.accessToken) {
    return next();
  }
  var now = new Date();

  // if the date the token expires (in seconds) > one week from now (in seconds) do nothing
  if ((req.accessToken.created.getTime() / 1000) + req.accessToken.ttl > (now.getTime() / 1000) + oneWeek) {
    return next();
  }

  // otherwise add two weeks
  req.accessToken.ttl += twoWeeks;
  res.cookie('access_token', req.accessToken.id, {
    'signed': req.signedCookies ? true : false,
    'maxAge': 1000 * req.accessToken.ttl
  });
  req.accessToken.save(next);
});

var myContext = require('./middleware/context-myContext')();
app.use(myContext);

// logging

if (process.env.ACCESS_LOG) {
  app.use(require('morgan')(process.env.ACCESS_LOG));
}

var options = {
  'name': 'anti-social',
  'serializers': {
    'err': bunyan.stdSerializers.err,
    'req': bunyan.stdSerializers.req
  },
  'src': true
};

options.streams = [{
  'level': process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'error',
  'stream': process.stdout
}];

if (process.env.RAVEN_DSN) {
  app.raven = require('raven');
  app.raven.config(process.env.RAVEN_DSN, {
    'environment': process.env.NODE_ENV,
    'logger': 'default',
    'autoBreadcrumbs': true,
    'stacktrace': true
  }).install();

  var sentryStream = require('bunyan-sentry-stream');
  options.streams.push(sentryStream(app.raven));
}

app.locals.logger = bunyan.createLogger(options);

// attach logger to request
app.use(function (req, res, next) {
  req.logger = app.locals.logger.child({
    'reqId': uuid()
  });
  next();
});

if (process.env.CSP) {
  var csp = require('helmet-csp');

  app.use(csp({
    'directives': {
      'defaultSrc': ['\'self\''],
      'connect-src': ['\'self\'', 'sentry.io', app.locals.config.websockets, 'checkout.stripe.com'],
      'scriptSrc': ['\'self\'', 'sentry.io', 'maps.googleapis.com', 'csi.gstatic.com', 'cdn.ravenjs.com', 'checkout.stripe.com', 's3.amazonaws.com', '\'unsafe-eval\'', function (req, res) {
        return '\'nonce-' + app.locals.nonce + '\'';
      }],
      'fontSrc': ['\'self\'', 'fonts.googleapis.com', 'fonts.gstatic.com'],
      'styleSrc': ['\'self\'', 'fonts.googleapis.com', 'checkout.stripe.com', '\'unsafe-inline\''],
      'frameSrc': ['\'self\'', 's3.amazonaws.com', '*'],
      'mediaSrc': ['\'self\'', '*'],
      'imgSrc': ['\'self\'', 'data:', '*'],
      'sandbox': ['allow-forms', 'allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-modals'],
      'reportUri': '/csp-violation',
      'objectSrc': ['\'none\''],
      'upgradeInsecureRequests': false
    },
    'loose': false,
    'reportOnly': false,
    'setAllHeaders': false,
    'disableAndroid': false,
    'browserSniff': false
  }));
}

// attach settings to req
var globalSettings = require('./middleware/context-globalSettings')();
app.use(globalSettings);

// put currentUser in req.context on /api routes
var getCurrentUserApi = require('./middleware/context-currentUserApi')();
app.use(getCurrentUserApi);

// use basic-auth for development environment
if (process.env.BASIC_AUTH) {
  var basicAuth = require('./middleware/basicAuth')();
  app.use(basicAuth);
}

var listener;

app.stop = function (done) {
  async.series([
    function (cb) {
      app.ioActivity.close(cb);
    },
    function (cb) {
      app.ioNotifications.close(cb);
    },
    function (cb) {
      listener.close(cb);
    }
  ], function (err) {
    done();
  });
};

app.start = function () {
  app.locals.logger.info('app staring');

  if (process.env.HTTPS_LISTENER !== 'true') {
    var http = require('http');
    listener = http.createServer(app).listen(app.locals.config.port, function (err) {
      if (err) {
        app.locals.logger.error('http could not be started', err);
        return;
      }
      app.emit('started');
      app.locals.logger.info('http started');
      websockets.mount(app, listener);

    });
  }
  else {
    // set up a connection upgrade redirect for http -> https
    var http = require('http');
    http.createServer(function (req, res) {
      res.writeHead(302, {
        'Location': app.locals.config.publicHost + req.url
      });
      res.end();
    }).listen(80);

    // listen for https and websocket requests
    var setupHTTPS = require('./lib/setupHTTPS');
    setupHTTPS(app, function (err, sslListener) {
      listener = sslListener;
      if (err) {
        app.locals.logger.info('https could not start', err);
        return;
      }
      app.locals.logger.info('https started');
      websockets.mount(app, listener);
    });
  }
};

boot(app, __dirname, function (err) {
  if (err) throw err;
  // start the server if `$ node server.js`
  if (require.main === module) {
    app.start();
  }
});
