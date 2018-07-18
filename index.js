#!/usr/bin/env node

'use strict';

var colors = require('colors/safe'),
  os = require('os'),
  pipe = require('./pipe.js'),
  portfinder = require('portfinder'),
  opener = require('opener'),
  argv = require('optimist')
    .boolean('cors')
    .argv;

var ifaces = os.networkInterfaces();

if (argv.h || argv.help) {
  console.log([
    'usage: http-server [path] [options]',
    '',
    'options:',
    '  -p           Port to use [8080]',
    '  -a           Address to use [0.0.0.0]',
    '  -d           Show directory listings [true]',
    '  --cors       Enable CORS',
    '  -o [path]    Open browser window after starting the server',
    '  -c           Cache time (max-age) in seconds [3600], e.g. -c10 for 10 seconds.',
    '               To disable caching, use -c-1.',
    '  -s           Silent Mode',
    '',
    '  -io          Enable / Disable Socket.io pipe (default true)',
    '',
    '  -h --help    Print this list and exit.'
  ].join('\n'));
  process.exit();
}

var port = argv.p || parseInt(process.env.PORT, 10),
  host = argv.a || '0.0.0.0',
  ssl = !!argv.S || !!argv.ssl,
  // proxy = argv.P || argv.proxy,
  // utc = argv.U || argv.utc,
  logger;

if (!argv.s && !argv.silent) {
  logger = {
    info: console.log,
    request: function (req, res, error) {
      var date = utc ? new Date().toUTCString() : new Date();
      if (error) {
        logger.info(
          '[%s] "%s %s" Error (%s): "%s"',
          date, colors.red(req.method), colors.red(req.url),
          colors.red(error.status.toString()), colors.red(error.message)
        );
      }
      else {
        logger.info(
          '[%s] "%s %s" "%s"',
          date, colors.cyan(req.method), colors.cyan(req.url),
          req.headers['user-agent']
        );
      }
    }
  };
}
else if (colors) {
  logger = {
    info: function () { },
    request: function () { }
  };
}

if (!port) {
  portfinder.basePort = 8080;
  portfinder.getPort(function (err, port) {
    if (err) { throw err; }
    listen(port);
  });
}
else {
  listen(port);
}

function listen(port) {
  var options = {
    root: argv._[0] || process.cwd(),
    cache: argv.c,
    io: argv.io == undefined ? true : (argv.io),
    showDir: argv.d == undefined ? true : (argv.d),
    logFn: logger.request,
  };

  if (argv.cors) {
    options.cors = true;
  }

  //   if (ssl) {
  //     options.https = {
  //       cert: argv.C || argv.cert || 'cert.pem',
  //       key: argv.K || argv.key || 'key.pem'
  //     };
  //   }

  var server = pipe.createServer(options);
  server.listen(port, host, function () {
    var canonicalHost = host === '0.0.0.0' ? '127.0.0.1' : host,
      protocol = ssl ? 'https://' : 'http://';

    logger.info([colors.yellow('Starting up http-server, serving '),
    colors.cyan(options.root),
    ssl ? (colors.yellow(' through') + colors.cyan(' https')) : '',
      colors.yellow('\nAvailable on:')
    ].join(''));

    if (argv.a && host !== '0.0.0.0') {
      logger.info(('  ' + protocol + canonicalHost + ':' + colors.green(port.toString())));
    }
    else {
      Object.keys(ifaces).forEach(function (dev) {
        ifaces[dev].forEach(function (details) {
          if (details.family === 'IPv4') {
            logger.info(('  ' + protocol + details.address + ':' + colors.green(port.toString())));
          }
        });
      });
    }

    if (typeof proxy === 'string') {
      logger.info('Unhandled requests will be served from: ' + proxy);
    }

    logger.info('Hit CTRL-C to stop the server');
    if (argv.o) {
      opener(
        protocol + canonicalHost + ':' + port,
        { command: argv.o !== true ? argv.o : null }
      );
    }
  });
}

if (process.platform === 'win32') {
  require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  }).on('SIGINT', function () {
    process.emit('SIGINT');
  });
}

process.on('SIGINT', function () {
  logger.info(colors.red('http-server stopped.'));
  process.exit();
});

process.on('SIGTERM', function () {
  logger.info(colors.red('http-server stopped.'));
  process.exit();
});