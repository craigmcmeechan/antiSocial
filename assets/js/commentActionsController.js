(function ($) {

	function commentActionsController(elem) {
		this.element = $(elem);

		var self = this;

		this.isMine = this.element.data('is-mine');
		this.commentId = this.element.data('comment-id');

		this.start = function () {
			if (self.isMine) {
				this.element.on('click', '.delete-comment', function (e) {
					e.preventDefault();

					var endpoint = '/comment/' + self.commentId;
					$.ajax({
						'method': 'DELETE',
						url: endpoint
					}).done(function (data) {
						if (_.get(data, 'result.status') === 'ok') {
							flashAjaxStatus('info', 'deleted');
						}
						else {
							flashAjaxStatus('danger', _.get(data, 'result.status') ? _.get(data, 'result.status') : 'an error occured');
						}
					}).fail(function (jqXHR, textStatus, errorThrown) {
						flashAjaxStatus('danger', 'could not delete ', textStatus);
					});
				});

				this.element.on('click', '.edit-comment', function (e) {
					e.preventDefault();
					var modal = $('#edit-comment-form');
					modal.find('.modal-body').empty().append('loading...');
					modal.modal();
					modal.find('.modal-body').load('/comment/' + self.commentId, function () {
						didInjectContent(modal);
					});
				});
			}
		};

		this.stop = function () {
			if (self.isMine) {
				this.element.off('click', '.delete-comment');
				this.element.off('click', '.edit-comment');
			}
		};

	}

	$.fn.commentActionsController = GetJQueryPlugin('commentActionsController', commentActionsController);

})(jQuery);
