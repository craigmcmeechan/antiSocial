(function ($) {
	function loadMoreController(elem, options) {
		this.element = $(elem);
		this.loading = false;
		this.atEnd = false;

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
			var endpoint = location.pathname + '?more=1';
			$.get(endpoint, function (html) {
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
					self.element.before(chunk);
					didInjectContent(chunk);
					self.loading = false;
				}
			});
		};
	}
	$.fn.loadMoreController = GetJQueryPlugin('loadMoreController', loadMoreController);
})(jQuery);
