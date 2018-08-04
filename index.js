var program = require('commander');

program
  .version("vNext")
  .option('-p, --port <port>', 'Port')
  .option('-a, --addr <addr>', 'Address to be bound to', "0.0.0.0")
  .option('-d, --dir', 'Enables / Disables dir listing (default true)', true)
  .option('-c, --cors', 'Enables / Disables cors (default true)', true)
  // .option('-s, --socketio <io>', 'Enables / Disables socket io (default true)', true)
  .option('-h, --cache <cache>', 'Cache time (max-age) in seconds [-1], e.g. -c10 for 10 seconds. \n To disable caching, use -c-1.', -1)
  .option('-D, --data <keys>', 'enabled data keys', '')
  .option('--datafile <filename>', 'data file name (db.json)', 'db.json')
  .option('-o, --open', 'open browser (default false)')
  .arguments("Root Path")
  .parse(process.argv);


var opts = {
  cache: program.cache,
  port: program.port ? parseInt(program.port) : undefined,
  addr: program.addr,
  cors: program.cors,
  dir: program.dir,
  socketio: program.socketio,
  data: program.data || undefined,
  open: program.open || false,
  root: program.args[0] || process.cwd()
};

console.log("Options Dump");
console.log(opts);

require('./entry.js').start(opts);
