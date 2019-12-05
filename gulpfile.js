var gulp = require('gulp');
var shell = require("gulp-shell");
var fs = require("fs");
var args = require('yargs').argv;
var assemblyInfo = require('gulp-dotnet-assembly-info');
var rename = require('gulp-rename');
var msbuild = require('gulp-msbuild');
var nuget = require('gulp-nuget');
var bump = require('gulp-bump');
var xunit = require('gulp-xunit-runner');

//optional, lets you do .pipe(debug()) to see whats going on

var debug = require("gulp-debug");
var project = JSON.parse(fs.readFileSync("./package.json"));

var config = {

  name: project.name,
  background: project.background,
  buildNumber: args.build || "000",
  version: project.version + "." + (args.build || "000"),
  mode: args.mode || "Debug",
  output: ".build/deploy",
  deployTarget: args.deployTarget,
  releasenotesfile: "ReleaseNotes.md"
}


var octopus = {
	apiKey: 'API-6QLJIB1ND6UOXNC6AKCRTS2OK',
	host: 'http://192.168.100.110:8888/',
	packages: '/nuget/packages'
}

gulp.task('default', [ "restore", "version", "compile", "test" ]);
gulp.task('deploy', [ "publish", "createRelease" ]);

gulp.task('restore', shell.task([
  '".build/tools/nuget.exe" restore ' + config.name + '.sln -configFile nuget.config'
]));

gulp.task('version', function() {
  return gulp
    .src('./.build/AssemblyVersion.base')
    .pipe(rename("AssemblyVersion.cs"))
    .pipe(assemblyInfo({
      version: config.version,
      fileVersion: config.version,
      description: "Build: " +  config.buildNumber
    }))
    .pipe(gulp.dest(config.name + '/Properties'))
    .pipe(gulp.dest(config.background + '/Properties'));
});

gulp.task('compile', [ "restore", "version" ], function() {
  return gulp
    .src(config.name + ".sln")
    .pipe(msbuild({
          targets: ["Clean", "Rebuild"],
          configuration: config.mode,
          toolsVersion: 14.0,
          nologo: false,
          nodeReuse: false,
          architecture: 'x64',
          errorOnFail: true,
          stdout: true,
          verbosity: "minimal",
          properties: {
              RunOctoPack: true,
              VisualStudioVersion: 15.0
          }
    }));
});

gulp.task('test', [ "compile" ], function() {
  return gulp
    .src(['**/bin/*/*.Tests.dll'], { read: false })
    .pipe(xunit({
      executable: 'packages/xunit.runner.console.2.1.0/tools/xunit.console.x86.exe',
      options: {
        nologo: true,
        verbose: true
      }
    }));
});

gulp.task('publish', [ "test" ], function() {
  return gulp
    .src([ "*/bin/*.nupkg", "*/bin/*/*.nupkg" ])
    .pipe(nuget.push({
      nuget: ".build/tools/nuget.exe",
      source: octopus.host + octopus.packages,
      apiKey: octopus.apiKey
    }));
});

gulp.task('createRelease', [ "publish" ], shell.task([
  '".build/tools/octo.exe" create-release' +
  ' --server ' + octopus.host +
  ' --apikey ' + octopus.apiKey +
  ' --project ' + config.name +
  ' --version ' + config.version +
  ' --defaultpackageversion ' + config.version +
  ' --deployto ' + config.deployTarget +
  ' --releasenotesfile ' + config.releasenotesfile,
  '".build/tools/octo.exe" create-release' +
  ' --server ' + octopus.host +
  ' --apikey ' + octopus.apiKey +
  ' --project ' + config.background +
  ' --version ' + config.version +
  ' --defaultpackageversion ' + config.version +
  ' --deployto ' + config.deployTarget +
  ' --releasenotesfile ' + config.releasenotesfile
]));
 
gulp.task('bump:patch', function() {
  return gulp
    .src("./package.json")
    .pipe(bump({ type: "patch"}))
    .pipe(gulp.dest('./'));
});
 
gulp.task('bump:minor', function() {
  return gulp
    .src("./package.json")
    .pipe(bump({ type: "minor"}))
    .pipe(gulp.dest('./'));
});

gulp.task('bump:major', function() {
  return gulp
    .src("./package.json")
    .pipe(bump({ type: "major"}))
    .pipe(gulp.dest('./'));
});