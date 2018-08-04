var fs = require('fs');
var shortid = require('shortid');
_ = require("lodash");
var jsonpath = require('jsonpath');
var jexl = require('jexl');
var bparser = require('body-parser');

var express = require('express');

function defered(method, bufferTime) {
    return () => {
        clearTimeout(method.timeout);
        method.timeout = setTimeout(method, bufferTime);
    };
}

module.exports.start = function (options) {

    options.data_flexible = true; // for now.. extremely unsafe.
    options.data_edit_root = false;
    options.data_route = options.data;
    options.data_autoId = true;

    var db = {};
    var file = options.data_file;
    function save() {
        fs.writeFileSync(file, JSON.stringify(db));
    }

    save = defered(save, 100); //100ms buffer time..
    function load() {
        db = JSON.parse(fs.readFileSync(file).toString());
    }

    load();

    function routeToCompletePath(path, str) {
        var s = path.split("/").filter((v) => {
            return v.trim();
        });
        if (str) {
            var ss = s[0];
            for (var i = 1; i < s.length; i++) {
                ss += "." + s[i];
            }
            s = ss;
        }
        return s;
    }

    function applyFilters(obj, filter) {
        if (!filter || Object.keys(filter).length == 0) {
            return obj;
        }
        if (!obj) return obj;

        var logicf = {};
        for (var i in filter) {
            if (!i.startsWith("$")) {
                logicf[i] = filter[i];
            }
        }

        // if (filter.jpath) {
        //     obj = jsonpath.query(obj, filter.jpath);
        // } else {
        obj = _.filter(obj, logicf);
        obj.filtered = true;
        // }
        return obj;
    }

    function filterDown(path, query, body, skipQuery) {
        var r = routeToCompletePath(path);
        var result = r.length == 0 ? db : _.get(db, r);
        if (result) {
            var qs = query;
            if (body) {
                for(var i in qs) {
                    qs[i] = qs[i] || body[i];
                }
            }
            if (!skipQuery) {
                result = applyFilters(result, qs);
            }
            return (result);
        }
        return undefined;
    }

    function filterView(a, query) {
        if (typeof a == 'object' && query["$toarr"]) {
            var b = [];
            for (var i in a) {
                b.push(a[i]);
            }
            a = b;
        }
        if (!Array.isArray(a)) return a;
        if (query["$sort"]) {
            a = _.sortBy(a, query["$sort"]);
        }
        if (query["$pageSize"] > 0 && query["$page"] >= 0) {
            a = _.take(a, query["$pageSize"] * (query["$page"] + 1));
            a = _.takeRight(a, query["$pageSize"]);
        }
        if (query["$skip"] > 0) {
            a = _.takeRight(a, a.length - query["$skip"]);
        }
        if (query["$take"] > 0) {
            a = _.take(a, query["$take"]);
        }
        return a;
    }

    function prepInsertion(p) {
        return Object.assign(p, {
            __timestamp: Date.now()
        });
    }

    var router = express.Router();
    router.use(bparser.json({}));
    router.use((req, res, next) => {
        req.query = require('qs').parse(require('url').parse(req.url).query, {
            decoder: function (str) {
                try {
                    return JSON.parse(str);
                }
                catch (e) {
                    return str;
                }
            }
        });
        if (req.method == 'GET') {
            var r = filterDown(req.path, req.query);
            if (r) {
                return res.json(filterView(r, req.query));
            }
        } else if (req.method = 'POST' && options.data_flexible) { //add data to list
            if (routeToCompletePath(req.path).length == 0 && !options.data_edit_root) {
                return res.status(400).send("edit denied due to defined policy :(").end();
            }
            var r = filterDown(req.path, req.query, req.body, false);

            if (r.filtered && r.length == 1) {
                r = r[0]; //precision modification
            }

            if (r.filtered && r.length == 0) {
                r = filterDown(req.path, req.query, req.body, true);
            }

            var d = prepInsertion(req.body);
            if (Array.isArray(r) && !r.filtered) {
                if (options.data_autoId && typeof d == 'object') {
                    d['__id'] = shortid.generate();
                }
                r.push(d);
                save();
                return res.json(d);
            }
            else if (Array.isArray(r) && r.filtered) {
                //modify all..
                for (var t = 0; t < r.length; t++) {
                    for (var i in req.body) {
                        r[t][i] = d[i];
                    }
                }
                save();
                return res.json(r);
            }
            else if (typeof r == 'object') {
                for (var i in req.body) {
                    r[i] = d[i];
                }
                save();
                return res.json(r);
            } else {
                _.set(db, routeToCompletePath(req.path), d);
                save();
                return res.json(d);
            }
        }
        next(); //didnt caught it :(
    })
    console.log(options.data_route);
    options.app.use(options.data_route, router);
}