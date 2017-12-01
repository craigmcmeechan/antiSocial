(function ($) {
	function liveNewsFeedController(elem, options) {
		this.element = $(elem);
		var self = this;
		this.src = null;
		this.active = false;

		this.start = function () {
			self.element.on('DidLogOut DidLogIn DigitopiaDidLoadNewPage DigitopiaDidResize DigitopiaScaleChanged', function () {
				self.checkActive();
			});
			self.checkActive();
		};

		this.stop = function () {
			if (self.active) {
				self.disconnect();
			}
			self.element.off('DidLogOut DidLogIn DigitopiaDidLoadNewPage DigitopiaDidResize DigitopiaScaleChanged');
		};

		// check if state has changed and connect/disconnect if needed
		this.checkActive = function () {
			var state = $('#document-body').hasClass('is-logged-in') && !$('#document-body').hasClass('digitopia-xsmall');

			if (state !== self.active) {
				if (self.active) {
					self.disconnect();
				}
				else {
					self.connect();
				}
			}

			self.active = state;

			self.setTop();
		};

		// position and maintain visibility
		this.setTop = function () {
			if (self.active) {
				if ($('#newsfeed-here').length) {
					var top = $('#newsfeed-here').offset().top;
					var width = $('#newsfeed-here').width();
					var left = $('#newsfeed-here').offset().left;
					self.element.css({
						'top': top,
						'width': width,
						'left': left
					});
					self.element.show();
				}
				else {
					self.element.hide();
				}
			}
			else {
				self.element.hide();
			}
		};

		this.connect = function () {
			self.element.find('ul').empty();
			var endpoint = '/api/NewsFeeds/me/live';
			self.src = new EventSource(endpoint);
			self.src.addEventListener('data', self.processNews);
			self.src.addEventListener('error', self.errors);
			self.setTop();
		};

		this.disconnect = function () {
			self.element.find('.news-feed-items').empty();
			if (self.src) {
				self.src.close();
				self.src.removeEventListener('data', self.processNews);
				self.src.removeEventListener('error', self.errors);
				self.src = null;
			}
			self.element.hide();
		};

		this.processNews = function (msg) {
			self.element.find('.status').removeClass('offline');
			var event = JSON.parse(msg.data);
			var li = $('<div class="news-feed-item">');

			var formatted = event.data.humanReadable.replace(/>/, '><div>');
			formatted += '</div>';
			li.append(formatted);
			self.element.find('.news-feed-items').prepend(li);
			if (!event.backfill) {
				$('body').trigger('NotifyLiveElement', [event.data.type, event.data.about, event.data.details.rendered]);
			}
		};

		this.errors = function (e) {
			self.element.find('.news-feed-items').empty();
			self.element.find('.status').addClass('offline');
		};
	}

	$.fn.liveNewsFeedController = GetJQueryPlugin('liveNewsFeedController', liveNewsFeedController);
})(jQuery);
