(function ($) {

	function tagController(elem) {
		this.element = $(elem);

		var self = this;
		this.start = function () {
			$(window).bind('hashchange.tagController', function () {
				var tag = location.hash;
				if (tag && tag !== '#' && tag !== '#_#') {
					loadPage(location.pathname + '?tags=["' + encodeURIComponent(tag) + '"]');
				}
			});
		};


		this.stop = function () {
			$(window).unbind('hashchange.tagController');
		};
	}

	$.fn.tagController = GetJQueryPlugin('tagController', tagController);
})(jQuery);
