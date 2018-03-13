// TODO: populate tags and resolvedTags when user types @xxxxx xxxx xxx or #xxxxx-xxx
(function ($) {
	function postingFormController(elem) {
		this.element = $(elem);
		var self = this;

		this.lastValue = '';

		this.endpoint = this.element.data('endpoint');
		this.about = this.element.data('about');
		this.photoId = this.element.data('photoId');
		this.renderer = new marked.Renderer();
		this.previewMode = false;
		this.currentTop = 0;
		self.categories = [];
		self.dropzone = undefined;
		this.lookupDebounce = null;
		this.singleUpload = this.element.data('single-upload');
		this.modal = this.element.data('modal');

		this.renderer.link = function (href, title, text) {
			if (text && text.match(/^http/i)) {
				return '<div class="ogPreview" data-jsclass="OgTagPreview" data-src="/api/OgTags/scrape" data-url="' + href + '" data-type="json"></div>';
			}
			else {
				return '<a href="' + href + '" target="_blank">' + text + '</a>';
			}
		};

		this.start = function () {
			autosize(this.element.find('textarea'));

			self.element.on('keyup', '.posting-body', function (e) {
				if (self.lookupDebounce) {
					clearTimeout(self.lookupDebounce);
				}
				var theElement = $(this);
				self.lookupDebounce = setTimeout(function () {
					self.lookupDebounce = undefined;
					var matches = theElement.val().match(/\@\[([^\]]+)\]/g);
					async.map(matches, function (match, cb) {
						var q = match.replace(/[\@\[\]]/, '');
						var get = $.get('/api/MyUsers/me/tag?value=' + encodeURIComponent(q))
							.done(function (data, textStatus, jqXHR) {
								console.log(match, data);
								data.match = match;
								data.q = q;
								cb(null, data);
							})
							.fail(function () {
								cb(null);
							});
					}, function (err, replacements) {
						var value = theElement.val();
						for (var i = 0; i < replacements.length; i++) {
							if (replacements[i].found.length) {
								var formatted = '[' + replacements[i].found[0].name + '](tag-' + replacements[i].found[0].endPoint + ')';
								value = value.replace(replacements[i].match, formatted);
							}
						}
						theElement.val(value);
					});
				}, 500);
			});

			if (self.element.find('.upload-zone')) {
				var previewTemplate =
					'\
					<div class="dz-preview dz-file-preview container-fluid">\
						<div class="row">\
							<div class="col-sm-4">\
								<div class="dz-image">\
									<img data-dz-thumbnail>\
								</div>\
								<div class="dz-details">\
									<div class="dz-size">\
										<span data-dz-size></span>\
									</div>\
									<div class="dz-filename">\
										<span data-dz-name></span>\
									</div>\
								</div>\
							<div class="dz-progress">\
								<span class="dz-upload" data-dz-uploadprogress></span>\
							</div>\
							<div class="dz-error-message">\
								<span data-dz-errormessage></span>\
							</div>\
						</div>\
						<div class="metadata col-sm-8">\
							<div class="form-group">\
								<input type="text" class="form-control title" placeholder="Title">\
								<br>\
								<textarea class="form-control description" type="text" placeholder="Description"></textarea>\
							</div>\
						</div>\
					</div>';

				if (self.singleUpload) {
					previewTemplate =
						'\
						<div class="dz-preview dz-file-preview container-fluid">\
							<div class="row">\
								<div class="col-sm-3">\
									<div class="dz-image">\
										<img data-dz-thumbnail>\
									</div>\
									<div class="dz-details">\
										<div class="dz-size">\
											<span data-dz-size></span>\
										</div>\
										<div class="dz-filename">\
											<span data-dz-name></span>\
										</div>\
									</div>\
								<div class="dz-progress">\
									<span class="dz-upload" data-dz-uploadprogress></span>\
								</div>\
								<div class="dz-error-message">\
									<span data-dz-errormessage></span>\
								</div>\
							</div>\
						</div>';
				}

				self.element.find('.upload-zone').addClass('dropzone').dropzone({
					'url': '/pending-upload',
					'autoProcessQueue': true,
					'parallelUploads': 1,
					'dictDefaultMessage': 'Drop photos here to attach to this post',
					'addRemoveLinks': true,
					'previewTemplate': previewTemplate,
					'maxFiles': self.singleUpload ? 1 : undefined,
					'uploadMultiple': self.singleUpload ? false : undefined,
					'paramName': 'file',
					'init': function () {
						this.on('maxfilesexceeded', function (file) {
							this.removeAllFiles();
							this.addFile(file);
						});
						this.on('success', function (file, response) {
							file.serverPhotoId = response.id;
							//file.previewTemplate.appendChild(document.createTextNode(file.serverPhotoId));
							$(file.previewElement).data('photoId', response.id);

							var preview = _.get(response, 'uploads[0].imageSet.thumb.url');
							if (preview) {
								file.previewElement.querySelector('img').src = preview;
							}
						});
						this.on('removedfile', function (file) {
							var endpoint = '/api/MyUsers/me/photos/' + file.serverPhotoId;
							$.ajax({
								'method': 'DELETE',
								url: endpoint
							});
						});

						var thisDropzone = this;

						$.getJSON('/api/MyUsers/me/photos?filter=%7B%22where%22%3A%7B%22status%22%3A%22pending%22%7D%2C%22include%22%3A%5B%22uploads%22%5D%7D', function (data) {

							$.each(data, function (index, item) {

								var mockFile = {
									name: item.AttachmentID,
									size: 12345,
									serverPhotoId: item.id
								};

								// Call the default addedfile event handler
								thisDropzone.emit('addedfile', mockFile);

								// And optionally show the thumbnail of the file:
								thisDropzone.emit("thumbnail", mockFile, item.uploads[0].imageSet.thumb.url);
								thisDropzone.emit("complete", mockFile);
								thisDropzone.options.processing.call(thisDropzone, mockFile);
								thisDropzone.options.success.call(thisDropzone, mockFile);

							});
						});
					}
				});
			}

			self.element.find('.upload-zone').sortable({
				'placeholder': 'ui-state-highlight'
			});

			this.element.on('focus', this.element.data('focus-target'), function () {
				self.element.addClass('focused');
				didInjectContent(self.element);
			});

			this.element.on('click', '.post-submit-button', function (e) {
				e.preventDefault();

				// collect id's of files in dropzone
				var photos = [];
				if (self.element.find('.upload-zone')) {
					var order = self.element.find('.upload-zone').find('.dz-complete');
					for (var i = 0; i < order.length; i++) {
						var photoId = $(order[i]).data('photoId');
						var photoTitle = $(order[i]).find('.title').val();
						var photoDescription = $(order[i]).find('.description').val();
						photos.push({
							'id': photoId,
							'title': photoTitle,
							'description': photoDescription
						});
					}
				}

				var geo = self.element.find('#geo-location').val();
				if (!geo) {
					geo = '{}';
				}
				geo = JSON.parse(geo);

				var tags = self.element.find('.tags').val();
				if (!tags) {
					tags = '[]';
				}
				tags = JSON.parse(tags);

				var resolvedTags = self.element.find('.resolved-tags').val();
				if (!resolvedTags) {
					resolvedTags = '{}';
				}
				resolvedTags = JSON.parse(resolvedTags);

				var payload = {
					'body': self.element.find('.posting-body').val(),
					'geoDescription': geo.description,
					'geoLocation': geo.loc,
					'visibility': self.element.find('.posting-visibility').val(),
					'categories': JSON.stringify(self.categories),
					'about': self.about,
					'photos': photos,
					'photoId': photoId,
					'tags': tags,
					'resolvedTags': resolvedTags
				};

				$.post(self.endpoint, payload, function (data, status, xhr) {
					if (status !== 'success') {
						flashAjaxStatus('danger', xhr.statusText);
					}
					else {
						self.hideForm();
						if (self.modal) {
							$(self.modal).find('.DigitopiaInstance').trigger('DigitopiaStop');
							$(self.modal).find('.modal-body').empty().append('loading...');
							$(self.modal).modal('hide');
						}
					}
				}, 'json');
			});

			this.element.on('click', '#post-cancel-button', function (e) {
				e.preventDefault();
				self.hideForm();
				if (self.modal) {
					$(self.modal).find('.DigitopiaInstance').trigger('DigitopiaStop');
					$(self.modal).find('.modal-body').empty().append('loading...');
					$(self.modal).modal('hide');
				}
			});

			this.element.on('click', '#post-upload-button', function (e) {
				e.preventDefault();
				self.element.find('.upload-zone').toggle();
				didInjectContent(self.element);
			});

			this.element.on('click', '#post-geo-button', function (e) {
				e.preventDefault();
				if ($('.geo-zone').is(':visible')) {
					$('.geo-zone').find('input').val('');
				}
				self.element.find('.geo-zone').toggle();
				didInjectContent(self.element);
			});

			this.element.on('click', '#post-preview-button', function (e) {
				e.preventDefault();
				if (self.previewMode) {
					$(window).scrollTop(self.currentTop);
					self.previewMode = false;
					self.element.find('#form-tab').show();
					self.element.find('#preview-tab').hide();
					$(this).text('preview');
				}
				else {
					self.currentTop = $(window).scrollTop();
					self.renderPreview();
					self.previewMode = true;
					self.element.find('#form-tab').hide();
					self.element.find('#preview-tab').show();
					$(this).text('edit');
				}
			});

		};

		this.stop = function () {
			this.element.off('focusin', this.element.data('focus-target'));
			this.element.off('click', '#post-submit');
			this.element.off('click', '#post-cancel');
			this.element.off('click', '#post-preview');
			this.element.off('click', '#post-upload-button');
			this.element.off('click', '#post-geo-button');
			self.element.off('keyup', '.posting-body');
		};

		this.hideForm = function () {
			self.element.removeClass('focused');
			self.element.find('.posting-body').val('');
			self.element.find('.touched').removeClass('touched input-error input-ok');
			if (self.previewMode) {
				$('#post-preview-button').click();
			}
			self.element.find('.posting-body').css('height', 'auto');
		};

		this.renderPreview = function () {
			var markdown = self.element.find('.posting-body').val();

			markdown = self.parseTags(markdown);

			var rendered = marked(markdown, {
				'renderer': self.renderer,
				'smartypants': true
			});
			rendered = rendered.replace(/\<table\>/g, '<table class="table">');
			rendered = rendered.replace(/:([A-Za-z0-9_\-\+]+?):/g, function (emoji) {
				return '<span class="em em-' + emoji.replace(/:/g, '') + '"></span>';
			});

			self.element.find('#preview-tab').empty().html(rendered);
			didInjectContent('#preview-tab');
		};

		this.parseTags = function (markdown) {
			self.categories = [];
			var tagged = markdown.replace(/\#([A-Za-z0-9\-\_\.])+/g, function (tag) {
				self.categories.push(tag.substr(1));
				return '[' + tag + '](' + tag + ')';
			});

			return tagged;
		}
	}

	$.fn.postingFormController = GetJQueryPlugin('postingFormController', postingFormController);
})(jQuery);
