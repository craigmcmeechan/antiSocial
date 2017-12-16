(function ($) {
	function liveElementsController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			this.element.on('NotifyLiveElement', function (e, type, about, endpoint) {
				e.stopPropagation();
				self.element.find('.live-element[data-watch="' + about + '"]').each(function () {
					var element = $(this);
					var commentList = element.find('.comments-list');
					element.addClass('changed');
					if (type === 'comment' && element.data('watch-type') === type) {
						var item = $('<div>');
						item.load(endpoint, function () {
							var comment = item.find('.comment');
							var summary = item.find('.comments-label').html();
							self.element.find('.comments').append(comment);
							self.element.find('.comments-label').empty().append(summary);
							didInjectContent(element);
						})
					}
				});
			});
		};

		this.stop = function () {
			this.element.off('NotifyLiveElement');
		};
	}

	$.fn.liveElementsController = GetJQueryPlugin('liveElementsController', liveElementsController);
})(jQuery);
