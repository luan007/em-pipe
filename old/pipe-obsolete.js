var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var serveIndex = require('serve-index')
var serveStatic = require('serve-static')
var cors = require('cors')
var states = {};

module.exports.createServer = function (options) {

    console.log(options);
    if (options.cors) {
        app.use(cors());
    }
    app.use(function (req, res, next) {
        res.setHeader('X-Powered-By', 'EM-PIPE')
        next()
    })

    var cacheOptions = {};

    if (options.cache) {
        cacheOptions['maxAge'] = options.cache;
    }

    function broadcast(event, data, _owner) {
        var clients = io.sockets.sockets;
        for (var e in clients) {
            if (clients[e] != _owner) {
                clients[e].emit(event, data);
            }
        }
    }

    function stateChange(key, value, _owner) {
        if (states[key] == value) return;
        states[key] = value;
        broadcast('state', states);
        broadcast('state/' + key, value, _owner);
    }

    io.on('connection', function (socket) {
        socket.emit('state', states);
        for (var i in states) {
            socket.emit('state/' + i, states[i]);
        }
        socket.on('state', (data) => {
            stateChange(data.key, data.value, socket);
        });
        socket.on('boardcast', (data) => {
            if (data.path && data.data) {
                broadcast('boardcast/' + data.path, data.data, socket);
            }
            broadcast('boardcast', data, socket);
        });
        socket.on('all', (data) => {
            if (data.path && data.data) {
                broadcast('all/' + data.path, data.data);
            }
            broadcast('all', data);
        });
    });

    app.use(bodyParser({ extended: true }));

    app.get("/socket-test", (req, res) => {
        res.send(`
        <script src="/socket.io/socket.io.js"></script>

        <script>
            var socket = io();
            socket.on('state', (data) => {
                document.writeln("state info<br>");
                document.writeln(JSON.stringify(data) + "<br>");
                console.log(data);
                socket.emit("all", { "test": 1 });
            });
        
            socket.on("all", (data) => {
                document.writeln("all<br>");
                document.writeln(JSON.stringify(data) + "<br>");
            });
        </script>
        `);
    });

    app.get("/state", (req, res) => {
        res.json(states).end();
    });

    app.get("/state/:key", (req, res) => {
        res.json(states[req.params['key']]).end();
    });

    app.post("/state/:key", (req, res) => {
        stateChange(req.params['key'], req.body);
        res.json(states[req.params['key']]).end();
    });

    app.get("/setState/:key", (req, res) => {
        if (req.query) {
            stateChange(req.params['key'], req.query);
        }
        res.json(states[req.params['key']]).end();
    });

    if (options.showDir) {
        app.use('/', serveStatic(options.root, cacheOptions), serveIndex(options.root, { 'icons': true }));
    } else {
        app.use('/', serveStatic(options.root, cacheOptions));
    }

    return server;
};