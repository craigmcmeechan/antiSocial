(function ($) {
	function liveElementsController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			this.element.on('NotifyLiveElement', function (e, type, endpoint, rendered) {
				e.stopPropagation();
				self.element.find('.live-element[data-watch="' + endpoint + '"]').each(function () {
					$(this).addClass('changed');
					if (type === 'new comment') {
						$(this).find('.comments-list').append(rendered).append('<div class="clearfix"></div>');
						didInjectContent($(this).find('.comments-list'));
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
