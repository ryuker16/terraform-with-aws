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
const babel = require('gulp-babel')
const injectModules = require('gulp-inject-modules')

const paths = {
  ts: ['src/**/*.ts'],
  watch: [
    'src/**/*.ts',
    'test/unit/**/*.js'
  ],
  tsOut: 'dist',
  src: ['src/**/*.ts'],
  srcOut: 'dist',
  srcLib: 'distlib',
  srcjs: ['dist/**/*.js'],
  testjs: ['test/unit/**/*.js']
}

let isWatching = false
const watching = function (cb) {
  gutil.log('WATCHING...')
  isWatching = true
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
  return isWatching ? stream.on('error', handleError(task, doNotEnd)) : stream.on('error', function (err) {
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
  return wrap(gulp.src(paths.src)
    .pipe(tsLibProject()), 'build-lib')
    .js.pipe(gulp.dest(paths.srcLib))
})

let tsEsProject = tsc.createProject('tsconfig.json', { module: 'es2015', typescript: require('typescript') })

gulp.task('build-es', function () {
  return watch(gulp.src(paths.src)
    .pipe(tsEsProject(), 'build-es'))
    .js.pipe(gulp.dest('es/'))
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
  return gulp.src(paths.src)
    .pipe(gulp.dest('dts'))
}))

//* *****************************************************************************
//* TESTS NODE
//* *****************************************************************************
let tstProject = tsc.createProject('tsconfig.json', {
  typescript: require('typescript')
})

gulp.task('build-src', function () {
  return wrap(gulp.src(paths.src)
    .pipe(sourcemaps.init()) // This means sourcemaps will be generated
    .pipe(tstProject()), 'build-src')
    .js
    .pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file
    .pipe(gulp.dest(paths.srcOut))
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
  return gulp.src(['coverage/html-report/index.html'])
    .pipe(open())
}))

const test = function () {
  return wrap(gulp.src(paths.testjs)
    .pipe(babel())
    .pipe(injectModules())
    .pipe(wrap(mocha({
      require: ['./test/testpaths.js']
    }), 'mocha'))
    .pipe(istanbul.writeReports({
      reporters: ['lcovonly', 'json', 'text', 'text-summary', 'html']
    }))
    .pipe(istanbul.enforceThresholds({
      thresholds: {
        global: {
          statements: 95,
          branches: 85,
          lines: 95,
          functions: 95
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
gulp.task('build', gulp.series(gulp.parallel('clean-tsc', 'lint'), gulp.parallel('build-lib', 'build-src')))
gulp.task('test', gulp.series('clean-tsc', 'build-src', 'mocha', 'remap-istanbul'))
gulp.task('testjs', gulp.series('clean-tsc', gulp.parallel('build-src'), 'mocha'))
gulp.task('test-coverage', gulp.series(watching, 'clean-tsc', 'build-src', 'mocha', 'remap-istanbul', 'open-report'))
gulp.task('testjs-coverage', gulp.series(watching, 'clean-tsc', 'build-src', 'mocha', 'open-report'))

//* *****************************************************************************
//* WATCH
//* *****************************************************************************

const watch = function () {
  wrap(gulp.watch(paths.watch, gulp.series('test')), 'watch')
}
gulp.task('watch', gulp.series(watching, 'test', watch))
