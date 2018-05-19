(function ($) {
	function responsiveCarousel(elem, options) {
		this.element = $(elem);
		var self = this;

		this.id = elem.id;

		// merge our default settings with incoming options, if any
		this.settings = $.extend({
			src: $(this.element).data('src'),
			endpoint: $(this.element).data('endpoint'),
			wantReactions: $(this.element).data('want-reactions')
		}, options || {});

		this.start = function () {
			var data = $(this.element.data('data')).html();
			var json = JSON.parse(data);
			self.ready(json);

			// listen for 'slide' events from the bootstrap carousel
			this.element.on('slide.bs.carousel', function (e) {
				self.doLazy();
			});

			// listen for  'slid' events from the bootstrap carousel
			this.element.on('slid.bs.carousel', function (e) {
				self.doLazy();
			});

			this.element.on('click', '.carousel-control.left', function (e) {
				e.preventDefault();
				self.element.carousel('prev');
			});

			this.element.on('click', '.carousel-control.right', function (e) {
				e.preventDefault();
				self.element.carousel('next');
			});

			this.element.hover(function () {
				self.element.find('.carousel-control').show();
			}, function () {
				self.element.find('.carousel-control').hide();
			});

			this.element.on('click', '.full-screen', function (e) {
				e.preventDefault();
				self.doFullScreen();
			});

			this.element.on('click', '.comments-tab-header', function (e) {
				e.preventDefault();
				var commentsTab = $(this).closest('.comments-tab');
				var endpoint = commentsTab.data('endpoint');
				var photo = commentsTab.data('photo-id');

				if (commentsTab.hasClass('open')) {
					commentsTab.removeClass('open').find('.photo-reactions').empty();
				}
				else {
					commentsTab.removeClass('open').find('.photo-reactions').append($('<div class="photo-reactions-and-comments">'));
					self.loadPhotoComments(endpoint + '/reactions', commentsTab);
					self.loadPhotoComments(endpoint + '/comments', commentsTab);
				}
			});
		};

		// stop and clean up
		this.stop = function () {
			//flash('stopping responsiveCarousel');
			this.element.carousel('pause');
			this.element.off('slide.bs.carousel');
			this.element.off('slid.bs.carousel');
			this.element.off('click', '.carousel-control.left');
			this.element.off('click', '.carousel-control.right');
			this.element.off('click', '.comments-tab-header');
		};

		this.doFullScreen = function () {
			var isFullScreen = self.element.closest('.carousel-container').hasClass('full-screen');
			if (isFullScreen) {
				this.element.carousel('pause');
				$(this).html('<span class="fa fa-expand"></span>');
				self.element.closest('.carousel-container').hide();
			}
			else {
				$(this).html('<span class="fa fa-compress"></span>');
				this.element.carousel('cycle');
			}
			self.element.closest('.carousel-container').toggleClass('full-screen');
			setTimeout(function () {
				self.element.trigger('DigitopiaDidResize').find('.DigitopiaInstance').each(function () {
					$(this).trigger('DigitopiaDidResize');
				});
			}, 0);
		}

		this.doLazy = function () {
			// find all the slides
			var slides = self.element.find('.carousel-inner').find('.item');

			// find the index of the current slide
			var index = self.element.find('.carousel-inner').find('.active').data('sequence');

			if (!$(slides[index]).find('img').data('digitopiaLazyImg').loaded) {
				$(slides[index]).find('img').trigger('DigitopiaLazy', true);
			}

			// if we are not on the last slide, preload the next slide
			if (index < slides.length - 1) {
				if (!$(slides[index + 1]).find('img').data('digitopiaLazyImg').loaded) {
					$(slides[index + 1]).find('img').trigger('DigitopiaLazy', true);
				}
			}
		};

		this.ready = function (json) {
			this.json = json;

			// bootstrap carousel holds the slides in a div of class .carousel-inner
			var inner = this.element.find('.carousel-inner');

			// clear it
			inner.empty();

			// inner should always be the same size as the carousel element
			inner.digitopiaContainer({
				fillContainer: this.element
			});

			// bootstrap carousel dot navigation container
			var indicators = this.element.find('.carousel-indicators');
			indicators.empty();

			// iterate over the json objects
			for (var i = 0; i < this.json.length; i++) {
				// create a slide with the class .item which boostrap carousel will manage
				var slide = $('<div class="item" data-sequence="' + i + '">');

				// if it's the first one mark it a active
				if (i === 0) {
					slide.addClass('active');
				}

				// create a viewport for centering the image in the container
				var viewport = $('<div>');

				// create an lazy loading image
				var photo = this.json[i].uploads[0].imageSet.large ? this.json[i].uploads[0].imageSet.large : this.json[i].uploads[0].imageSet.original;
				var img = $('<img data-lazy-src="' + photo.url + '"  data-width="' + photo.width + '" data-height="' + photo.height + '">');

				// put the image in the viewport
				viewport.append(img);

				// put the viewport in the slide
				slide.append(viewport);

				// create a caption for slide
				var caption = '';

				if (this.json[i].title) {
					caption += '<h3>' + this.json[i].title + '</h3>';
				}

				if (this.json[i].description || this.json[i].credit) {
					caption += '<p>';

					if (this.json[i].description) {
						caption += this.json[i].description;
					}

					if (this.json[i].credit) {
						caption += '<small class="pull-right">by: <cite>' + this.json[i].credit + '</cite></small>';
					}

					caption += '</p>';
				}

				var captionContainer = $('<div class="carousel-caption">');
				captionContainer.append(caption);
				slide.append(captionContainer);

				if (self.settings.wantReactions) {
					var commentsTab = $('<div class="comments-tab" data-endpoint="' + self.settings.endpoint + '/photo/' + this.json[i].uuid + '">');
					var commentsTabHeader = $('<div class="comments-tab-header"><i class="fa fa-comments"></i></div>');
					commentsTab.append(commentsTabHeader);
					commentsTab.append('<div class="reactions-and-comments photo-reactions">');
					slide.append(commentsTab)
				}

				// put the slide in the .carousel-inner container
				inner.append(slide);

				// make the viewport a container that is always the same size as the carousel
				viewport.digitopiaContainer({
					fillContainer: inner
				});

				// make the viewport a digitopiaViewport
				viewport.digitopiaViewport({
					crop: false,
					align: 'center',
					listenTo: viewport
				});

				// make the image lazy
				img.digitopiaLazyImg();

				// add the dot indicator for the slide

				var indicator = $('<li data-target="#' + this.element.attr('id') + '" data-slide-to="' + i + '">');
				if (i === 0) {
					indicator.addClass('active');
				}
				indicators.append(indicator);

				setTimeout(function () {
					self.doLazy();
				}, 500);
			}

			// boot the bootstrap carousel plugin
			if (this.json.length > 1) {
				this.element.carousel({
					pause: 'hover'
				});
			}
			else {
				indicators.hide();
				this.element.find('.left,.right').hide();
			}
		};

		this.loadPhotoComments = function (endpoint, targetElement) {
			$.ajax({
				type: 'GET',
				url: endpoint
			}).done(function (data) {
				$(targetElement).addClass('open').find('.photo-reactions-and-comments').append(data);
				didInjectContent($(targetElement));
			}).fail(function (jqXHR, textStatus, errorThrown) {
				flashAjaxStatus('danger', 'could not load endpoint ' + endpoint, textStatus);
			});
		};
	}

	// wrap the object in a jquery plugin
	$.fn.responsiveCarousel = GetJQueryPlugin('responsiveCarousel', responsiveCarousel);
})(jQuery);
