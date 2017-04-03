'use strict'

//* *****************************************************************************
//* DEPENDENCIES
//* *****************************************************************************

const gulp = require('gulp')
const tsc = require('gulp-typescript')
const tslint = require('gulp-tslint')
const sourcemaps = require('gulp-sourcemaps')
const mocha = require('gulp-mocha')
const istanbul = require('gulp-istanbul')
const remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul')
const open = require('gulp-open')
const del = require('del')
const gutil = require('gulp-util')

const paths = {
  ts: [
    'src/**/*.ts',
    'test/**/*.ts'
  ],
  src: ['src/**/*.ts'],
  srcjs: ['dist/src/**/*.js'],
  testts: ['test/**/*.ts'],
  testjs: ['test/unit/**/*.test.js', 'dist/test/unit/**/*.test.js']
}

let watchingMode = false
const watching = function (cb) {
  watchingMode = true
  cb()
}
let testjsMode = false
const testjs = function (cb) {
  testjsMode = true
  cb()
}
const handleError = function (task, doNotEnd) {
  return function (err) {
    gutil.log(gutil.colors.blue(task), gutil.colors.red(err))
    if (!doNotEnd) {
      this.emit('end')
    }
  }
}
const wrap = function (stream, task, doNotEnd) {
  gutil.log(gutil.colors.blue('wrapping ', task))
  return watchingMode ? stream.on('error', handleError(task, doNotEnd)) : stream.on('error', function (err) {
    gutil.log(gutil.colors.blue(task), gutil.colors.red(err))
    process.exit(1)
  })
}

//* *****************************************************************************
//* LINT
//* *****************************************************************************
gulp.task('lint', function () {
  let config = { formatter: 'verbose', emitError: !process.env.CI }
  return wrap(gulp.src(paths.ts)
    .pipe(tslint(config))
    .pipe(tslint.report()), 'lint')
})

//* *****************************************************************************
//* BUILD
//* *****************************************************************************
let tsLibProject = tsc.createProject('tsconfig.json', { module: 'commonjs', typescript: require('typescript') })

gulp.task('build-lib', function () {
  return wrap(gulp.src([
    'src/**/*.ts'
  ])
    .pipe(tsLibProject()))
    .js.pipe(gulp.dest('distlib/'))
})

let tsEsProject = tsc.createProject('tsconfig.json', { module: 'es2015', typescript: require('typescript') })

gulp.task('build-es', function () {
  return watch(gulp.src(paths.src)
    .pipe(tsEsProject())
    .on('error', function () {
      process.exit(1)
    })
    .js.pipe(gulp.dest('es/')), 'build-es')
})

let tsDtsProject = tsc.createProject('tsconfig.json', {
  declaration: true,
  noResolve: false,
  typescript: require('typescript')
})

gulp.task('build-dts', gulp.series(function () {
  return wrap(gulp.src(paths.src)
    .pipe(tsDtsProject()), 'build-dts')
    .dts.pipe(gulp.dest('dts'))
}, function () {
  return gulp.src(['src/**/*.d.ts'])
    .pipe(gulp.dest('dts'))
}))

//* *****************************************************************************
//* TESTS NODE
//* *****************************************************************************
let tstProject = tsc.createProject('tsconfig.json', {
  typescript: require('typescript'),
  noEmitOnError: true
})

gulp.task('build-src', function () {
  return wrap(gulp.src(paths.src)
    .pipe(sourcemaps.init()) // This means sourcemaps will be generated
    .pipe(tstProject()), 'build-src')
    .js
    .pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file
    .pipe(gulp.dest('dist/src'))
})

let tsTestProject = tsc.createProject('tsconfig.json', {
  typescript: require('typescript'),
  allowJs: true,
  noEmitOnError: true
})

gulp.task('build-test', function () {
  return wrap(gulp.src(paths.testts)
    .pipe(tsTestProject()), 'build-test')
    .js.pipe(gulp.dest('dist/test'))
})

gulp.task('istanbul:hook', function () {
  return gulp.src(paths.srcjs)
    .pipe(istanbul())
    .pipe(istanbul.hookRequire())
})

const remap = function () {
  return gulp.src('coverage/coverage-final.json')
    .pipe(remapIstanbul({
      reports: {
        'json': 'coverage/coverage.json',
        'html': 'coverage/html-report'
      }
    }))
}
gulp.task('remap-istanbul', remap)

gulp.task('open-report', gulp.series(function () {
  let report = testjsMode
    ? 'coverage/index.html'
    : 'coverage/html-report/index.html'
  return gulp.src(report)
    .pipe(open())
}))

const test = function () {
  let reporters = ['lcovonly', 'json', 'text', 'text-summary']
  if (testjsMode) {
    reporters.push('html')
  }
  return wrap(gulp.src(paths.testjs)
    .pipe(wrap(mocha(), 'mocha'))
    .pipe(istanbul.writeReports({ reporters }))
    .pipe(istanbul.enforceThresholds({
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          lines: 80,
          functions: 80
        }
      }
    })), 'test', true)
}

gulp.task('mocha', gulp.series('istanbul:hook', test))

//* *****************************************************************************
//* CLEAN
//* *****************************************************************************
gulp.task('clean-tsc', gulp.series(() => del(['coverage', 'dist', 'dts', 'distlib'])))
//* *****************************************************************************
//* DEFAULT
//* *****************************************************************************
gulp.task('build', gulp.series(gulp.parallel('clean-tsc', 'lint'), gulp.parallel('build-lib', 'build-src', 'build-test')))
gulp.task('test', gulp.series('clean-tsc', gulp.parallel('build-src', 'build-test'), 'mocha', 'remap-istanbul'))
gulp.task('testjs', gulp.series(testjs, 'clean-tsc', gulp.parallel('build-src'), 'mocha'))
gulp.task('test-coverage', gulp.series(watching, 'clean-tsc', gulp.parallel('build-src', 'build-test'), 'mocha', 'remap-istanbul', 'open-report'))
gulp.task('testjs-coverage', gulp.series(watching, testjs, 'clean-tsc', gulp.parallel('build-src', 'build-test'), 'mocha', 'open-report'))

//* *****************************************************************************
//* WATCH
//* *****************************************************************************

const watch = function () {
  wrap(gulp.watch(paths.ts, gulp.series('test')), 'watch')
}
gulp.task('watch', gulp.series(watching, 'test', watch))
