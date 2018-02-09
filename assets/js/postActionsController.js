(function ($) {

	function postActionsController(elem) {
		this.element = $(elem);

		var self = this;

		this.isMine = this.element.data('is-mine');
		this.endpoint = this.element.data('endpoint');

		this.start = function () {
			this.element.on('click', '.delete-post', function (e) {

			});
			this.element.on('click', '.edit-post', function (e) {

			});
		};

		this.stop = function () {
			this.element.off('click', '.delete-post');
			this.element.off('click', '.edit-post');
		};

	}

	$.fn.postActionsController = GetJQueryPlugin('postActionsController', postActionsController);

})(jQuery);
