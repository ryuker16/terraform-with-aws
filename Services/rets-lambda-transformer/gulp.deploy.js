var gulp = require('gulp')
var zip = require('gulp-zip')
var del = require('del')
var yarn = require('gulp-yarn')
var awsLambda = require('node-aws-lambda')
const path = require('path')
var config = require('config')
var fs = require('fs')

var paths = {
  js: 'distlib/**/*',
  config: ['config/*'],
  distlambda: './distlambda',
  package: './distlambda.zip',
  zip: ['distlambda/**/*', '!distlambda/package.json']
}
gulp.task('clean', function () {
  return del(['distlambda', 'distlib', 'dist'])
})

gulp.task('js', gulp.parallel(function () {
  return gulp.src(paths.js)
    .pipe(gulp.dest(paths.distlambda))
}, function () {
  return gulp.src(paths.config, { base: './' })
    .pipe(gulp.dest(paths.distlambda))
}))

gulp.task('node-mods', function () {
  return gulp.src(['./package.json', './yarn.lock'])
    .pipe(gulp.dest(paths.distlambda))
    .pipe(yarn({ production: true }))
})

gulp.task('zip', function () {
  return gulp.src(paths.zip, { dot: true })
    .pipe(zip(paths.package))
    .pipe(gulp.dest('./'))
})

gulp.task('upload', function (callback) {
  awsLambda.deploy(paths.package, config.get('lambdaConfig'), callback)
})

gulp.task('artifact', gulp.series([
  'clean',
  'build-lib',
  gulp.series('js', 'node-mods'),
  'zip'
]))

gulp.task('deploy', gulp.series([
  'artifact',
  'upload'
]))
