'use strict'
const gulp = require('gulp')
require('./gulp.build')
require('./gulp.deploy')
gulp.task('default', gulp.series('test'))
