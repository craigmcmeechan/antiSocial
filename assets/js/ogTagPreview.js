// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function OgTagPreview(elem, options) {
		this.element = $(elem);
		var self = this;

		self.url = decodeURIComponent(this.element.data('url'));
		self.debug = this.element.data('debug');

		self.source = this.element.closest('.post').data('source');
		self.hatTip = this.element.closest('.post').data('hat-tip');

		this.start = function () {
			if (self.debug) {
				$(self.debug).empty().text('Loading...').show();
			}
			// once digitopiaAjax has loaded the data from the endpoint, build the ui
			this.element.on('data', function (e, data) {
				self.data = data.result;

				if (self.debug) {
					$(self.debug).empty().text(JSON.stringify(data, null, 4)).show();
				}

				var upload = getUploadForProperty('image', data.result.uploads, 'large', true);
				var src = upload.url;
				var img = $('<img src="' + src + '" data-width=' + upload.width + ' data-height=' + upload.height + '>');
				var caption = $('<div class="caption">');
				var site = data.result.ogData.data.ogSiteName ? data.result.ogData.data.ogSiteName : parseUri(self.url).host;
				var title = data.result.ogData.data.ogTitle ? data.result.ogData.data.ogTitle : 'Link'
				if (data.result.ogData.data.contentType && data.result.ogData.data.contentType.match(/^image\//i)) {
					title = "Image";
				}
				var description = data.result.ogData.data.ogDescription;

				if (data.result.ogData.success === false) {
					self.element.addClass('no-preview');
					self.element.append('<p>Go to <a href="' + self.url + '" target="_blank">' + parseUri(self.url).host + '</a> <i class="fa fa-chevron-right"></i></p>');
					return;
				}

				caption.append('<div class="share-link"><i class="fa fa-share-square"></i></div>');
				caption.append('<h3>' + title + '<i class="fa fa-chevron-right"></i></h3>');
				if (description) {
					caption.append('<h4>' + description + '</h4>');
				}
				caption.append('<h4>go to ' + parseUri(self.url).host + ' <i class="fa fa-chevron-right"></i></h4>');
				caption.append('<small><em>' + site + '</em></small>');
				caption.append('</div>');
				self.element.append(img);
				self.element.append(caption);
				if (data.result.ogData.data.ogVideo) {
					self.element.append('<div class="play"><i class="fa fa-play-circle"></i></div>');
				}
				self.element.digitopiaViewport({
					'crop': true,
					'blowup': true
				});
				didInjectContent(self.element);
			});

			// do we have the json in the document?
			var hash = 0,
				i, chr;
			if (self.url.length) {
				for (i = 0; i < self.url.length; i++) {
					chr = self.url.charCodeAt(i);
					hash = ((hash << 5) - hash) + chr;
					hash |= 0; // Convert to 32bit integer
				}
			}
			var jsonElement = $('#json-og-' + hash);
			if (jsonElement && jsonElement.length) {
				var data = JSON.parse(jsonElement.html());
				this.element.trigger('data', {
					'result': data
				});
			}
			else {
				// set up arguments to ajax call to OgTag endpoint specified in element's data-src
				self.element.digitopiaAjax({
					args: {
						url: self.url
					}
				});
			}

			self.element.on('click', '.share-link', function (e) {
				// scroll to top of window, open posting form, put link in form
				// add h/t of poster
				e.stopPropagation();
				e.preventDefault();

				scrollToElement('#the-posting-form');
				$('#the-posting-form').find('.posting-body').html('<p>' + self.url + '</p><p>h/t <a class="in-editor tag-user" href="tag-user-' + self.source + '"><span class="em-usertag"></span>' + self.hatTip + '</a><br></p>');
				$('#the-posting-form').find('.posting-body').click().keyup().focus();
			});

			// open url on click
			self.element.on('click', function (e) {
				// if video inject player
				if (self.data && self.data.ogData.data.ogVideo) {
					if (self.data.ogData.data.ogVideo.type = 'text/html') {
						self.element.empty().append('<iframe width="100%" height="100%" src="' + self.data.ogData.data.ogVideo.url + '?autoplay=1" frameborder="0" allowfullscreen></iframe>')
					}
					else {
						var video = self.data.ogData.data.ogVideo;
						var embed = '<video width="100%" height="auto" data-width="' + video.width + '" data-height="' + video.height + '" controls autoplay><source src="' + video.url + '" type="' + video.type + '"></video>';
						self.element.empty().append(embed);
						self.element.css('height', 'auto');
					}
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
