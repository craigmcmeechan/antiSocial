// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

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
