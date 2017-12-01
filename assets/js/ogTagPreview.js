(function ($) {
	function OgTagPreview(elem, options) {
		this.element = $(elem);
		var self = this;

		self.url = this.element.data('url');
		self.debug = this.element.data('debug');

		this.start = function () {
			if(self.debug) {
				$(self.debug).empty().text('Loading...').show();
			}
			// once digitopiaAjax has loaded the data from the endpoint, build the ui
			this.element.on('data', function (e, data) {
				self.data = data.result;

				if(self.debug) {
					$(self.debug).empty().text(JSON.stringify(data, null, 4)).show();
				}

				var src = getUploadForProperty('image', data.result.uploads, 'large', true).url;
				var img = $('<img data-jsclass="digitopiaLazyImg" data-lazy-src="' + src + '">');
				var caption = $('<div class="caption">');
				var site = data.result.ogData.data.ogSiteName ? data.result.ogData.data.ogSiteName : parseUri(self.url).host;
				var title = data.result.ogData.data.ogTitle ? data.result.ogData.data.ogTitle : 'Link'
				if (data.result.ogData.data.contentType && data.result.ogData.data.contentType.match(/^image\//i)) {
					title = "Image";
				}
				var description = data.result.ogData.data.ogDescription;

				if (data.result.ogData.success === false) {
					title = 'Page not found';
					description = '<div>Link preview not available</div>';
					img = '';
				}

				caption.append('<h3>' + title + '<i class="glyphicon glyphicon-chevron-right"></i></h3>');
				if (description) {
					caption.append('<h4>' + description + '</h4>');
				}
				caption.append('<h4>go to ' + parseUri(self.url).host + ' <i class="glyphicon glyphicon-chevron-right"></i></h4>');
				caption.append('<small><em>' + site + '</em></small>');
				caption.append('</div>');
				self.element.append(img);
				self.element.append(caption);
				if (data.result.ogData.data.ogVideo) {
					self.element.append('<div class="play"><i class="glyphicon glyphicon-play-circle"></i></div>');
				}
				self.element.digitopiaViewport({
					'crop': true,
					'blowup': true
				});
				didInjectContent(self.element);
			});

			// set up arguments to ajax call to OgTag endpoint specified in element's data-src
			self.element.digitopiaAjax({
				args: {
					url: self.url
				}
			});

			// open url on click
			self.element.on('click', function (e) {
				// if video inject player
				if (self.data && self.data.ogData.data.ogVideo) {
					self.element.empty().append('<iframe width="100%" height="100%" src="' + self.data.ogData.data.ogVideo.url + '?autoplay=1" frameborder="0" allowfullscreen></iframe>')
				}
				else {
					var ref = window.open(self.url, '_blank');
				}
			});

			// do hover behavior by adding 'hovering' class to the element
			self.element.on('mouseenter focus', function () {
				self.element.addClass('hovering');
			});
			self.element.on('mouseleave', function () {
				self.element.removeClass('hovering');
			});
		};

		self.stop = function () {
			this.element.off('data');
			this.element.off('click');
		};
	}
	$.fn.OgTagPreview = GetJQueryPlugin('OgTagPreview', OgTagPreview);
})(jQuery);
