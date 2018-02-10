(function ($) {
	function liveElementsController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			this.element.on('NotifyLiveElement', function (e, type, about, endpoint) {
				e.stopPropagation();
				self.element.find('.live-element[data-watch="' + about + '"]').each(function () {
					var element = $(this);
					element.addClass('changed');
					if (type === 'post edit' && element.data('watch-type') === type) {
						var item = $('<div>');
						item.load(proxyEndPoint(endpoint), function () {
							element.empty().append(item.find('.post').html());
							didInjectContent(element);
						});
					}
					else if (type === 'comment' && element.data('watch-type') === type) {
						var item = $('<div>');
						item.load(proxyEndPoint(endpoint), function () {
							var comment = item.find('.a-comment');
							var summary = item.find('.comments-label').html();
							element.find('.comments').append(comment);
							element.find('.comments-label').empty().append(summary);
							didInjectContent(element);
						})
					}
					else if (type === 'react' && element.data('watch-type') === type) {
						var item = $('<div>');
						item.load(proxyEndPoint(endpoint), function () {
							var reactions = item.find('.post-reactions').html();
							element.find('.post-reactions').find('.DigitopiaInstance').trigger('DigitopiaStop');
							element.find('.post-reactions').empty().append(reactions);
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
