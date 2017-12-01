(function($){
	function navController(elem) {
		// handy reference in jQuery context
		this.element = $(elem);

		// handy reference for callbacks where 'this' is not this 'this'
		var self = this;

		// start the controller
		this.start = function() {
			// listen for HIJAX controller event DigitopiaDidLoadNewPage which is triggered after the new page is loaded
			this.element.on('DigitopiaDidLoadNewPage',function(e,path) {
				self.highlight(path);
			});
			// call on startup (first page)
			self.highlight(document.location.pathname);
		};

		// clean up
		this.stop = function() {
			this.element.off('DigitopiaDidLoadNewPage');
		};

		// change the class of the nav element for the current section
		this.highlight = function(path) {
			// split the path /some/path/page will end up with 'some' in index 1 of the array
			path = path.replace(/\?.*$/,'');
			var root = path.split('/');
			if(!root[1]) { root[1] = 'home'; }
			// deselect last nav item
			$(self.element).find('.active').removeClass('active');
			// select new nave item which has id #nav- followed by section name
			$('#nav-' + root[1]).addClass('active');
		};
	}

	// build jquery plugin
	$.fn.navController = GetJQueryPlugin('navController',navController);
})(jQuery);
