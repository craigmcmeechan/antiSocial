(function ($) {
	function loadMoreController(elem, options) {
		this.element = $(elem);
		this.loading = false;
		this.atEnd = false;
		this.highwater = this.element.data('highwater');

		this.endpoint = location.pathname;
		if (location.search) {
			this.endpoint += location.search + '&';
		}
		else {
			this.endpoint += '?';
		}
		this.endpoint += 'more=1';

		this.pendingRequest = null;
		this.aborted = false;

		var self = this;

		this.start = function () {
			$(window).on('scroll.loadMore', function () {
				if ($.inviewport(self.element, {
						'threshold': 1000
					})) {
					self.loadMore();
				}
			});
			this.element.on('DigitopiaWillLoadNewPage', function () {
				self.abort();
			})
		};

		this.stop = function () {
			var element = scrollViewport;
			if (element === 'html, body') {
				element = document;
			}
			$(element).off('scroll.loadMore');
			this.element.off('DigitopiaWillLoadNewPage');
		};

		this.abort = function () {
			self.aborted = true;
			if (self.pendingRequest) {
				console.log('abort load more');
				self.pendingRequest.abort();
			}
		};

		this.loadMore = function () {
			if (self.loading || self.atEnd) {
				return;
			}

			console.log('loading more');

			self.loading = true;

			if (self.highwater) {
				self.endpoint += '&highwater=' + self.highwater;
			}

			self.pendingRequest = $.get(self.endpoint).done(function (html, textStatus, jqXHR) {
				self.pendingRequest = null;
				self.loading = false;

				if (self.aborted) {
					console.log('load more got content after abort');
				}
				else {
					self.highwater = jqXHR.getResponseHeader('x-highwater');
					var doc = html.split(/(<body[^>]*>|<\/body>)/ig);
					var docBody = $(doc[2]);
					var chunk = $(docBody).find('#scope-post-list');
					if (!chunk || chunk.length === 0) {
						chunk = $(docBody).filter('#scope-post-list');
					}

					if (!chunk.html() || !chunk.html().replace(/^\s+$/, '')) {
						self.element.css({
							'opacity': 0
						});
						self.atEnd = true;
						console.log('load more at end');
					}
					else {
						console.log('load more done');
						$('#scope-post-list').append(chunk.html());
						didInjectContent('#scope-post-list');
					}
				}
			}).fail(function (jqXHR, textStatus, errorThrown) {
				flashAjaxStatus('danger', 'error loading');
			});
		};
	}
	$.fn.loadMoreController = GetJQueryPlugin('loadMoreController', loadMoreController);
})(jQuery);
