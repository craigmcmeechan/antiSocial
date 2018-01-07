/*! modernizr 3.5.0 (Custom Build) | MIT *
 * https://modernizr.com/download/?-history-touchevents-setclasses !*/
! function (e, n, o) {
  function t(e, n) {
    return typeof e === n
  }

  function s() {
    var e, n, o, s, i, a, r;
    for (var l in d)
      if (d.hasOwnProperty(l)) {
        if (e = [], n = d[l], n.name && (e.push(n.name.toLowerCase()), n.options && n.options.aliases && n.options.aliases.length))
          for (o = 0; o < n.options.aliases.length; o++) e.push(n.options.aliases[o].toLowerCase());
        for (s = t(n.fn, "function") ? n.fn() : n.fn, i = 0; i < e.length; i++) a = e[i], r = a.split("."), 1 === r.length ? Modernizr[r[0]] = s : (!Modernizr[r[0]] || Modernizr[r[0]] instanceof Boolean || (Modernizr[r[0]] = new Boolean(Modernizr[r[0]])), Modernizr[r[0]][r[1]] = s), f.push((s ? "" : "no-") + r.join("-"))
      }
  }

  function i(e) {
    var n = u.className,
      o = Modernizr._config.classPrefix || "";
    if (p && (n = n.baseVal), Modernizr._config.enableJSClass) {
      var t = new RegExp("(^|\\s)" + o + "no-js(\\s|$)");
      n = n.replace(t, "$1" + o + "js$2")
    }
    Modernizr._config.enableClasses && (n += " " + o + e.join(" " + o), p ? u.className.baseVal = n : u.className = n)
  }

  function a() {
    return "function" != typeof n.createElement ? n.createElement(arguments[0]) : p ? n.createElementNS.call(n, "http://www.w3.org/2000/svg", arguments[0]) : n.createElement.apply(n, arguments)
  }

  function r() {
    var e = n.body;
    return e || (e = a(p ? "svg" : "body"), e.fake = !0), e
  }

  function l(e, o, t, s) {
    var i, l, f, d, c = "modernizr",
      p = a("div"),
      h = r();
    if (parseInt(t, 10))
      for (; t--;) f = a("div"), f.id = s ? s[t] : c + (t + 1), p.appendChild(f);
    return i = a("style"), i.type = "text/css", i.id = "s" + c, (h.fake ? h : p).appendChild(i), h.appendChild(p), i.styleSheet ? i.styleSheet.cssText = e : i.appendChild(n.createTextNode(e)), p.id = c, h.fake && (h.style.background = "", h.style.overflow = "hidden", d = u.style.overflow, u.style.overflow = "hidden", u.appendChild(h)), l = o(p, e), h.fake ? (h.parentNode.removeChild(h), u.style.overflow = d, u.offsetHeight) : p.parentNode.removeChild(p), !!l
  }
  var f = [],
    d = [],
    c = {
      _version: "3.5.0",
      _config: {
        classPrefix: "",
        enableClasses: !0,
        enableJSClass: !0,
        usePrefixes: !0
      },
      _q: [],
      on: function (e, n) {
        var o = this;
        setTimeout(function () {
          n(o[e])
        }, 0)
      },
      addTest: function (e, n, o) {
        d.push({
          name: e,
          fn: n,
          options: o
        })
      },
      addAsyncTest: function (e) {
        d.push({
          name: null,
          fn: e
        })
      }
    },
    Modernizr = function () {};
  Modernizr.prototype = c, Modernizr = new Modernizr, Modernizr.addTest("history", function () {
    var n = navigator.userAgent;
    return -1 === n.indexOf("Android 2.") && -1 === n.indexOf("Android 4.0") || -1 === n.indexOf("Mobile Safari") || -1 !== n.indexOf("Chrome") || -1 !== n.indexOf("Windows Phone") || "file:" === location.protocol ? e.history && "pushState" in e.history : !1
  });
  var u = n.documentElement,
    p = "svg" === u.nodeName.toLowerCase(),
    h = c._config.usePrefixes ? " -webkit- -moz- -o- -ms- ".split(" ") : ["", ""];
  c._prefixes = h;
  var m = c.testStyles = l;
  Modernizr.addTest("touchevents", function () {
    var o;
    if ("ontouchstart" in e || e.DocumentTouch && n instanceof DocumentTouch) o = !0;
    else {
      var t = ["@media (", h.join("touch-enabled),("), "heartz", ")", "{#modernizr{top:9px;position:absolute}}"].join("");
      m(t, function (e) {
        o = 9 === e.offsetTop
      })
    }
    return o
  }), s(), i(f), delete c.addTest, delete c.addAsyncTest;
  for (var v = 0; v < Modernizr._q.length; v++) Modernizr._q[v]();
  e.Modernizr = Modernizr
}(window, document);
