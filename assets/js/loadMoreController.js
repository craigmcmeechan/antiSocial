(function ($) {
	function loadMoreController(elem, options) {
		this.element = $(elem);
		this.loading = false;
		this.atEnd = false;
		this.highwater = this.element.data('highwater');

		var self = this;

		this.start = function () {
			$(window).scroll(function () {
				if (self.element.is(':in-viewport')) {
					self.loadMore();
				}
			});
		};

		this.stop = function () {};

		this.loadMore = function () {
			if (self.loading) {
				return;
			}
			self.loading = true;
			var endpoint = location.pathname;
			if (location.search) {
				endpoint += location.search + '&';
			}
			else {
				endpoint += '?';
			}

			endpoint += 'more=1';

			if (self.highwater) {
				endpoint += '&highwater=' + self.highwater;
			}

			var req = $.get(endpoint).done(function (html, textStatus, jqXHR) {
				self.highwater = jqXHR.getResponseHeader('x-highwater');
				var doc = html.split(/(<body[^>]*>|<\/body>)/ig);
				var docBody = $(doc[2]);
				var chunk = $(docBody).find('#scope-post-list');
				if (!chunk || chunk.length === 0) {
					chunk = $(docBody).filter('#scope-post-list');
				}

				if (!chunk.html().replace(/^\s+$/, '')) {
					self.element.css({
						'opacity': 0
					});
				}
				else {
					$('#scope-post-list').append(chunk.html());
					didInjectContent('#scope-post-list');
					self.loading = false;
				}
			}).fail(function (jqXHR, textStatus, errorThrown) {
				alert('error loading');
			});
		};
	}
	$.fn.loadMoreController = GetJQueryPlugin('loadMoreController', loadMoreController);
})(jQuery);
