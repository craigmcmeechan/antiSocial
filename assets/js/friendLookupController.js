// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function friendLookupController(elem, options) {
		this.element = $(elem);

		var self = this;

		this.start = function () {
			this.element.on('submit', function (e) {
				e.preventDefault();
				var endpoint = self.element.find('[name="endpoint"]').val();
				if (!endpoint.match(/^htt/)) {
					try {
						endpoint = base64.decode(endpoint);
					}
					catch (e) {}
				}
				var match = endpoint.match(/(^|\s)((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)/gi);
				if (match) {
					loadPage('/proxy-profile?endpoint=' + encodeURIComponent(endpoint));
				}
				else {
					flashAjaxStatus('warning', 'unable to retrieve endpoint');
				}
			});
		};

		this.stop = function () {
			this.element.off('submit');
		};
	}

	$.fn.friendLookupController = GetJQueryPlugin('friendLookupController', friendLookupController);
})(jQuery);
