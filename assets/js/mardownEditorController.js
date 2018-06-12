// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {

	function markdownEditorController(elem) {
		this.element = $(elem);

		this.target = this.element.data('target');
		this.lookupDebounce = null;
		this.turndownService = null;
		this.inModal = this.element.data('in-modal');
		this.placeholder = this.element.data('placeholder');
		this.cache = {};

		var self = this;

		this.start = function () {
			var options = {
				toolbar: {
					'allowMultiParagraphSelection': false,
					'buttons': ['bold', 'italic', 'h1', 'h2', 'quote', 'unorderedlist', 'orderedlist', 'anchor']
				},
				'buttonLabels': 'fontawesome',
				'placeholder': {
					'text': self.placeholder
				}
			};

			if (self.inModal) {
				options.elementsContainer = self.element.closest('.modal')[0];
			}

			self.editor = new MediumEditor(self.element, options);

			self.turndownService = new TurndownService();

			self.updateMarkdown();

			self.editor.subscribe('editableInput', function (event, editable) {
				self.updateMarkdown();
				self.element.closest('form').find(self.target).trigger('change');
			});

			self.element.on('keyup', function (e) {
				if (self.lookupDebounce) {
					clearTimeout(self.lookupDebounce);
				}
				self.lookupDebounce = setTimeout(function () {
					self.lookupDebounce = undefined;
					var markup = self.element.html().replace('&nbsp', ' ');

					// url on a line by itself - preview "<p>some url<br>" or "<p>some url</p>" perhaps some spaces after url
					// TODO not optimal. URLs would notmally be pasted in not typed so it works for that but a pause while typeing would trigger the preview as soon as the url was valid even though partially typed
					var urls = markup.match(/<p>(http[^<]+)\s*<[/b]/g);
					if (urls) {
						var value = self.element.html();
						var selection = self.editor.exportSelection();
						var deltaLength = 0;
						for (var i = 0; i < urls.length; i++) {
							var original = urls[i].replace(/^<p>/, '').replace(/\s*<[/b]$/, '');
							var url = original.replace(/&amp;/g, '&');
							if (url.match(/(^|\s)((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)/gi)) {
								var previewTag = '<p><br></p><div class="ogPreview in-editor" data-jsclass="OgTagPreview" data-src="/api/OgTags/scrape" data-url="' + encodeURIComponent(url) + '" data-type="json" contentEditable=false></div><!--endog--><p><br></p>';
								value = value.replace(original, previewTag);
								deltaLength -= original.length;
							}
						}
						self.element.html(value);
						selection.start += deltaLength;
						selection.end = selection.start;
						self.editor.importSelection(selection);
						self.updateMarkdown()
						didInjectContent(self.element);
					}

					// hashtags
					var matches = markup.match(/(#[a-zA-Z][a-zA-Z0-9]+)/g);
					if (matches) {
						var value = self.element.html();
						var selection = self.editor.exportSelection();
						var deltaLength = 0;

						for (var i = 0; i < matches.length; i++) {
							var tag = matches[i].replace('#', '');
							var formatted = '<a class="in-editor tag-hash" href="tag-hash-' + tag + '"><span class="em-hashtag"></span>' + tag + '</a>';
							value = value.replace(matches[i], formatted);
							deltaLength -= 1;
						}

						self.element.html(value);
						selection.start += deltaLength;
						selection.end = selection.start;
						self.editor.importSelection(selection);
						self.updateMarkdown();
						self.element.closest('form').find(self.target).trigger('change');
						didInjectContent(self.element);
					}

					// usertags
					matches = markup.match(/(@(([\w]+)[\s]?){0,3})/g);
					async.map(matches, function (match, cb) {
							var q = match.replace(/[@]/, '');
							var punctuation = q.match(/([\W]+$)/);
							if (punctuation) {
								q = q.replace(/[\W]+$/, '');
							}

							if (self.cache[q]) {
								return cb(null, self.cache[q]);
							}

							var get = $.get('/api/MyUsers/me/tag?value=' + encodeURIComponent(q))
								.done(function (data, textStatus, jqXHR) {
									data.match = match;
									data.q = q;
									data.punctuation = punctuation ? punctuation[1] : '';

									self.cache[q] = data;

									cb(null, data);
								})
								.fail(function () {
									cb(null);
								});
						},
						function (err, replacements) {
							var value = self.element.html();
							var selection = self.editor.exportSelection();
							var deltaLength = 0;
							var didit = false;
							for (var i = 0; i < replacements.length; i++) {
								if (replacements[i].found.length) {
									if (replacements[i].found.length == 1) {
										var formatted = '<a class="in-editor tag-user" href="' + replacements[i].found[0].endPoint + '"><span class="em-usertag"></span>' + replacements[i].found[0].name + '</a>' + replacements[i].punctuation;
										value = value.replace(replacements[i].match, formatted);
										deltaLength += (replacements[i].found[0].name.length - replacements[i].match.length);
										didit = true;
									}
								}
							}

							if (didit) {
								self.element.html(value);
								selection.start += deltaLength;
								selection.end = selection.start;
								self.editor.importSelection(selection);
								self.updateMarkdown();
								self.element.closest('form').find(self.target).trigger('change');
							}
						});
				}, 2000);
			});
		};

		this.stop = function () {
			if (self.editor) {
				self.editor.destroy();
				self.editor = null;
			}
		};

		this.updateMarkdown = function () {
			var html = self.element.html();
			html = html.replace(/<div class="ogPreview.*?" data-jsclass="OgTagPreview" data-src="\/api\/OgTags\/scrape" data-url="([^"]+)" data-type="json"[^>]*>[\s\S]*?<\/div><!--endog-->/g, function (match, p1) {
				var url = decodeURIComponent(p1);
				return '<a href="' + url + '"></a>';
			});

			// turndownService converts html escaped angle brackets which seems odd
			// wrap any escaped markup in markdown code tag so form validator has a signal
			// that there is pasted escaped markup
			html = html.replace(/(&lt;.*?&gt;)/g, '`$1`');

			var markdown = self.turndownService.turndown(html);
			self.element.closest('form').find(self.target).val(markdown);
		};

	}

	$.fn.markdownEditorController = GetJQueryPlugin('markdownEditorController', markdownEditorController);

})(jQuery);
