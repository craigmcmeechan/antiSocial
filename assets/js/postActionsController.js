(function ($) {

	function postActionsController(elem) {
		this.element = $(elem);

		var self = this;

		this.isMine = this.element.data('is-mine');
		this.postId = this.element.data('post-id');
		this.postEndPoint = this.element.closest('.post').data('endpoint');
		this.isOnMyWall = this.element.data('is-on-my-wall');

		this.start = function () {
			if (self.isMine || this.isOnMyWall) {
				this.element.find('.delete-post').confirmation({
					'container': 'body',
					'title': 'Confirm',
					'placement': 'bottom',
					'onCancel': function () {},
					'onConfirm': function () {
						var endpoint = '/post/' + self.postId;
						$.ajax({
							'method': 'DELETE',
							url: endpoint
						}).done(function (data) {
							if (_.get(data, 'result.status') === 'ok') {
								flashAjaxStatus('info', 'deleted');
								self.element.closest('.newsfeed-item').remove();
							}
							else {
								flashAjaxStatus('danger', _.get(data, 'result.status') ? _.get(data, 'result.status') : 'an error occured');
							}
						}).fail(function (jqXHR, textStatus, errorThrown) {
							flashAjaxStatus('danger', 'could not delete ', textStatus);
						});
					}
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
			this.element.on('click', '.share-post', function (e) {
				e.stopPropagation();
				e.preventDefault();
				$('#post-form').find('form').data('postingFormController').setShareMode(self.postEndPoint);
				$('#post-form').find('.posting-body').click().keyup().focus();
				$('#post-form').modal();
			});
		};

		this.stop = function () {
			if (self.isMine) {
				this.element.off('click', '.edit-post');
				this.element.off('click', '.share-post');
				this.element.find('.delete-post').confirmation('dispose');
			}
		};

	}

	$.fn.postActionsController = GetJQueryPlugin('postActionsController', postActionsController);

})(jQuery);
