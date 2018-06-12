// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function subnavController(elem) {
		// handy reference in jQuery context
		this.element = $(elem);

		// handy reference for callbacks where 'this' is not this 'this'
		var self = this;

		// start the controller
		this.start = function () {
			// listen for HIJAX controller event DigitopiaDidLoadNewPage which is triggered after the new page is loaded
			this.element.on('DigitopiaDidLoadNewPage', function (e, path) {
				self.highlight(path);
			});
			// call on startup (first page)
			self.highlight(document.location.pathname);
		};

		// clean up
		this.stop = function () {
			this.element.off('DigitopiaDidLoadNewPage');
		};

		// change the class of the nav element for the current section
		this.highlight = function (path) {
			// split the path /some/path/page will end up with 'some' in index 1 of the array
			path = path.replace(/\?.*$/, '');
			var root = path.split('/');
			$(self.element).find('.active').removeClass('active');

			if (!root[2]) {
				$('#subnav-posts a').addClass('active');
			}
			else {
				if (root[2] === 'photos') {
					$('#subnav-photos a').addClass('active');
				}
				if (root[2] === 'friends') {
					$('#subnav-friends a').addClass('active');
				}
			}
			// deselect last nav item
			// select new nave item which has id #nav- followed by section name

		};
	}

	// build jquery plugin
	$.fn.subnavController = GetJQueryPlugin('subnavController', subnavController);
})(jQuery);
