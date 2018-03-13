(function ($) {

	function markdownEditorController(elem) {
		this.element = $(elem);

		this.target = this.element.data('target');
		this.lookupDebounce = null;
		this.turndownService = null;
		this.cache = {};

		var self = this;

		this.start = function () {
			self.editor = new MediumEditor(self.element, {
				toolbar: {
					buttons: ['bold', 'italic', 'h1', 'h2', 'h3', 'h4', 'quote', 'unorderedlist', 'orderedlist', 'anchor', 'image']
				}
			});

			self.turndownService = new TurndownService()

			self.editor.subscribe('editableInput', function (event, editable) {
				self.updateMarkdown();
			});

			self.element.on('keyup', function (e) {
				if (self.lookupDebounce) {
					clearTimeout(self.lookupDebounce);
				}
				self.lookupDebounce = setTimeout(function () {
					self.lookupDebounce = undefined;
					var markup = self.element.html();

					urls = markup.match(/[>\s](http[^<\s]+)/g);
					if (urls) {
						var value = self.element.html();
						var selection = self.editor.exportSelection();
						var deltaLength = 0;
						for (var i = 0; i < urls.length; i++) {
							var url = urls[i].substr(1);
							value = value.replace(url, '<div class="ogPreview" data-jsclass="OgTagPreview" data-src="/api/OgTags/scrape" data-url="' + url + '" data-type="json" contentEditable=false></div>');
							deltaLength -= url.length;
						}
						self.element.html(value);
						selection.start += deltaLength;
						selection.end = selection.start;
						self.editor.importSelection(selection);
						didInjectContent(self.element);
					}

					var matches = markup.match(/(@(([\w]+)[\s]?){0,3})/g);
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
									console.log(match, data);
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
										var formatted = '<a class="tag-user" href="' + replacements[i].found[0].endPoint + '"><span class="em-usertag"></span>' + replacements[i].found[0].name + '</a>' + replacements[i].punctuation;
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
			html = html.replace(/<div class="ogPreview.*?" data-jsclass="OgTagPreview" data-src="\/api\/OgTags\/scrape" data-url="([^"]+)" data-type="json"[^>]*>.*?<\/div>/, "$1");
			$(self.target).text(self.turndownService.turndown(html));
		};

	}

	$.fn.markdownEditorController = GetJQueryPlugin('markdownEditorController', markdownEditorController);

})(jQuery);
