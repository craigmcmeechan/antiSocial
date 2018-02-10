(function ($) {

	function postActionsController(elem) {
		this.element = $(elem);

		var self = this;

		this.isMine = this.element.data('is-mine');
		this.postId = this.element.data('post-id');

		this.start = function () {
			if (self.isMine) {
				this.element.on('click', '.delete-post', function (e) {
					e.preventDefault();
				});

				this.element.on('click', '.edit-post', function (e) {
					e.preventDefault();
					var modal = $('#edit-post-form');
					modal.find('.modal-body').empty().append('loading...');
					modal.modal();
					modal.find('.modal-body').load('/post/' + self.postId, function () {
						didInjectContent(modal);
					});
				});
			}
		};

		this.stop = function () {
			if (self.isMine) {
				this.element.off('click', '.delete-post');
				this.element.off('click', '.edit-post');
			}
		};

	}

	$.fn.postActionsController = GetJQueryPlugin('postActionsController', postActionsController);

})(jQuery);
