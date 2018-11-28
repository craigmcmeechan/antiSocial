to run it in browser:

	cordova run browser

To set up:

```
grunt
cd native-app
\rm -r www/dist
cp -r ../client/dist www/dist
cordova run ios --device --buildFlag='-UseModernBuildSystem=0'
```

www/index.html
	html body of home page
	add 'cordova' to body classes
	change script, image and css urls to relative
	remove content in:
		<div id="content" data-hijax="true"></div>
	end of body something like:
		<script type="text/javascript" src="cordova.js"></script>
		<script type="text/javascript" src="dist/js/jquery.min.js"></script>
		<script type="text/javascript" src="js/index.js"></script>
		<script type="text/javascript" src="dist/js/DigitopiaSocial.js" async defer></script>
	</body>

www/js/index.js hooks for hijax & authentication

function rewriteUrls(path) {
  if (window.Cordova && path.match(/^\//)) {
    return 'http://127.0.0.1:3000' + path;
  }
  else {
    return path;
  }
}

(function ($) {
  var accessToken;

  $(document).ajaxSend(function (event, jqxhr, settings) {
    if (window.Cordova) {
      if (settings.url.match(/^\//)) {
        settings.url = 'http://127.0.0.1:3000' + settings.url;
      }
      if (accessToken) {
        jqxhr.setRequestHeader('access_token', accessToken);
      }
    }
  });

  $(document).ajaxSuccess(function (event, xhr, settings) {
    if (window.Cordova) {
      if (settings.url.match(/\/login$/)) {
        accessToken = xhr.responseJSON ? xhr.responseJSON.id : null;
      }

      if (settings.url.match(/\/logout$/)) {
        accessToken = null;
      }
    }
  });

})(jQuery);
