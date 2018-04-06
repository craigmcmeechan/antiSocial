module.exports = function (grunt) {

	var lessFiles = [
		'assets/less/*.less'
	];

	var stylusFiles = [
		'assets/stylus/*.styl'
	];

	var jsFiles = [
		'node_modules/bootstrap/dist/js/bootstrap.js',
		'node_modules/digitopia/dist/js/digitopia.js',
		'node_modules/moment/moment.js',
		'node_modules/moment-timezone/builds/moment-timezone-with-data.js',
		'node_modules/lodash/lodash.js',
		'node_modules/jquery-serializejson/jquery.serializejson.js',
		'node_modules/async/dist/async.js',
		'node_modules/marked/lib/marked.js',
		'node_modules/node-vibrant/dist/vibrant.js',
		'node_modules/medium-editor/dist/js/medium-editor.js',
		'node_modules/turndown/dist/turndown.js',
		'node_modules/base-64/base64.js',
		'node_modules/eonasdan-bootstrap-datetimepicker/build/js/bootstrap-datetimepicker.min.js',
		'assets/vendor/*.js',
		'assets/js/*.js'
	];

	var cssFiles = [
		'node_modules/digitopia/dist/css/digitopia.css',
		'node_modules/vis/dist/vis.css',
		'node_modules/medium-editor/dist/css/medium-editor.css',
		'node_modules/medium-editor/dist/css/themes/default.css',
		'node_modules/eonasdan-bootstrap-datetimepicker/build/css/bootstrap-datetimepicker.css',
		'assets/vendor/*.css',
		'working/css/*.css',
		'assets/css/*.css',
		'assets/vendor/fa/*.css',
	];

	var copyCommand = [{
		expand: true,
		cwd: 'node_modules/vis/dist/',
		src: ['vis.js', 'vis.min.js'],
		dest: 'client/dist/js/',
		filter: 'isFile'
	}, {
		expand: true,
		cwd: 'node_modules/vis/dist/',
		src: ['vis.css', 'vis.min.css'],
		dest: 'client/dist/css/',
		filter: 'isFile'
	}, {
		expand: true,
		cwd: 'node_modules/jquery/dist/',
		src: ['jquery.js', 'jquery.min.js'],
		dest: 'client/dist/js/',
		filter: 'isFile'
	}, {
		expand: true,
		cwd: 'node_modules/bootstrap/',
		src: ['fonts/*'],
		dest: 'client/dist/',
		filter: 'isFile'
	}, {
		expand: true,
		cwd: 'node_modules/digitopia/',
		src: ['images/*'],
		dest: 'client/digitopia/',
		filter: 'isFile'
	}, {
		expand: true,
		cwd: 'assets/vendor/fa/fonts',
		src: ['*'],
		dest: 'client/dist/fonts/',
		filter: 'isFile'
	}];

	var allFiles = [];
	allFiles = allFiles.concat(
		jsFiles,
		stylusFiles,
		cssFiles,
		lessFiles
	);
	grunt.initConfig({
		jsDistDir: 'client/dist/js/',
		cssDistDir: 'client/dist/css/',
		pkg: grunt.file.readJSON('package.json'),
		mkdir: {
			all: {
				options: {
					create: ['working', 'locales']
				}
			}
		},
		copy: {
			main: {
				files: copyCommand
			}
		},
		less: {
			boostrap: {
				files: {
					'./working/css/base.css': './assets/less/base.less'
				}
			}
		},
		stylus: {
			options: {
				compress: false
			},
			compile: {
				files: {
					'working/css/<%= pkg.name %>-compiled.css': stylusFiles
				}
			}
		},
		concat: {
			js: {
				options: {
					separator: grunt.util.linefeed + ';' + grunt.util.linefeed
				},
				src: jsFiles,
				dest: '<%=jsDistDir%><%= pkg.name %>.js',
				nonull: true

			},
			css: {
				src: cssFiles,
				dest: '<%=cssDistDir%><%= pkg.name %>.css',
				nonull: true
			}
		},
		uglify: {
			dist: {
				options: {
					sourceMap: true
				},
				files: {
					'<%=jsDistDir%><%= pkg.name %>.min.js': ['<%= concat.js.dest %>']
				}
			}
		},
		cssmin: {
			dist: {
				options: {
					rebase: false
				},
				files: {
					'<%=cssDistDir%><%= pkg.name %>.min.css': ['<%= concat.css.dest %>']
				}
			}
		},
		watch: {
			files: allFiles,
			tasks: ['less', 'stylus', 'concat']
		}
	});

	grunt.loadNpmTasks('grunt-mkdir');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-stylus');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('default', [
		'mkdir',
		'copy',
		'less',
		'stylus',
		'concat',
		'uglify',
		'cssmin'
	]);

	grunt.registerTask('devel', [
		'mkdir',
		'copy',
		'less',
		'stylus',
		'concat',
		'watch'
	]);
};
