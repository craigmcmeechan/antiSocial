this.start = function () {

	if (Modernizr.touchevents) {
		self.element[0].addEventListener("touchstart", self.touchStart);
	}
};
}

this.stop = function () {
	if (Modernizr.touchevents) {
		self.element[0].removeEventListener("touchstart", self.touchStart);
	}
};

this.touchStart = function (e) {

	self.slideWidth = self.element.width();
	self.maxMove = self.slides.length * self.slideWidth;
	self.currentPosition = (self.slides.length * self.slideWidth) * -1;

	self.startX = event.touches[0].pageX;
	self.startY = event.touches[0].pageY;
	var canvas = self.element.find('.canvas');

	self.startLeft = parseInt(canvas.css('margin-left'));

	self.timerCounter = 0;
	self.timer = setInterval(function () {
		self.timerCounter++;
	}, 10);
	self.touching = true;

	self.element[0].addEventListener("touchmove", self.touchMove);

	self.element[0].addEventListener("touchend", self.touchEnd);
}

this.touchMove = function (event) {
	if (self.touching) {
		self.deltaX = event.touches[0].pageX - self.startX;
		self.deltaY = event.touches[0].pageY - self.startY;

		if (Math.abs(self.deltaY) > Math.abs(self.deltaX)) {
			self.comeBack();
			self.touchDone();
		}
		else {
			event.preventDefault();
			var left = self.startLeft + self.deltaX;
			var canvas = self.element.find('.canvas');
			console.log('oldleft:', self.startLeft, 'delta:', self.deltaX, 'new left:', left);
			$(canvas).css('margin-left', left);
		}
	}
}

this.touchEnd = function (event) {
	if (self.touching) {
		if ((self.deltaX > 0 && self.currentPosition == 0) || (self.deltaX < 0 && self.currentPosition == -(self.maxMove - self.slideWidth))) {
			self.scroll(null, self.currentIndex);
		}
		else if ((self.timerCounter < 30 && self.deltaX > 100) || (self.deltaX >= (self.slideWidth / 2))) {
			self.scroll(null, self.currentIndex - 1);
		}
		else if ((self.timerCounter < 30 && self.deltaX < -100) || (self.deltaX <= -(self.slideWidth / 2))) {
			self.scroll(null, self.currentIndex + 1);
		}
		else {
			self.scroll(null, self.currentIndex);
		}

		clearInterval(this.timer);
		self.timerCounter = 0;
		self.touching = false;
		self.deltaX = 0;
		self.element[0].removeEventListener("touchmove", self.touchMove);
		self.element[0].removeEventListener("touchend", self.souchEnd);
	}
}


this.touchDone = function () {
	self.touching = false;
}

this.comeBack = function () {
	this.scroll(null, this.currentIndex);
}


(function ($) {
	function socialButtons(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {};

		this.stop = function () {};

		this.render = function (chunk) {

			if (FB) {
				FB.XFBML.parse($(chunk)[0]);
			}
			else {
				console.log('facebook not loaded yet?');
			}

			if (twttr) {
				twttr.widgets.load();
			}
			else {
				console.log('twitter not loaded yet?');
			}

		};
	}

	$.fn.socialButtons = GetJQueryPlugin('socialButtons', socialButtons);

})(jQuery);

this.element.on('click', '.social-share-fb', function () {
	FB.ui({
			method: 'share',
			href: $(this).data('href'),
		},
		function (response) {
			if (response && !response.error_code) {
				//alert('Posting completed.');
			}
			else {
				//alert('Error while posting.');
			}
		}
	);
});

(function (d, s, id) {
	var js, fjs = d.getElementsByTagName(s)[0];
	if (d.getElementById(id)) {
		return;
	}
	js = d.createElement(s);
	js.id = id;
	js.src = "//connect.facebook.net/en_US/sdk.js";
	fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

// facebook API
window.fbAsyncInit = function () {
	FB.init({
		appId: '765213753523438',
		xfbml: true,
		version: 'v2.1'
	});
};
