'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var manifest = require('./manifest.json');
var RoutesManifestJson = require('./routes-manifest.json');
var Stream = require('stream');
var zlib = require('zlib');
var http = require('http');
require('perf_hooks');
var Url = require('url');
var punycode = require('punycode');
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');
var require$$1$2 = require('path');
var require$$0$3 = require('events');
var util$1 = require('util');
var tty = require('tty');
var require$$2 = require('net');
var os = require('os');
var buffer = require('buffer');
require('http2');
var process$1 = require('process');
var child_process = require('child_process');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var manifest__default = /*#__PURE__*/_interopDefaultLegacy(manifest);
var RoutesManifestJson__default = /*#__PURE__*/_interopDefaultLegacy(RoutesManifestJson);
var Stream__default = /*#__PURE__*/_interopDefaultLegacy(Stream);
var zlib__default = /*#__PURE__*/_interopDefaultLegacy(zlib);
var http__default = /*#__PURE__*/_interopDefaultLegacy(http);
var Url__default = /*#__PURE__*/_interopDefaultLegacy(Url);
var punycode__default = /*#__PURE__*/_interopDefaultLegacy(punycode);
var https__default = /*#__PURE__*/_interopDefaultLegacy(https);
var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var require$$1__default = /*#__PURE__*/_interopDefaultLegacy(require$$1$2);
var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0$3);
var util__default = /*#__PURE__*/_interopDefaultLegacy(util$1);
var tty__default = /*#__PURE__*/_interopDefaultLegacy(tty);
var require$$2__default = /*#__PURE__*/_interopDefaultLegacy(require$$2);

const specialNodeHeaders = [
  "age",
  "authorization",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "user-agent"
];

const readOnlyCloudFrontHeaders = {
  "accept-encoding": true,
  "content-length": true,
  "if-modified-since": true,
  "if-none-match": true,
  "if-range": true,
  "if-unmodified-since": true,
  "transfer-encoding": true,
  via: true
};

const HttpStatusCodes = {
  202: "Accepted",
  502: "Bad Gateway",
  400: "Bad Request",
  409: "Conflict",
  100: "Continue",
  201: "Created",
  417: "Expectation Failed",
  424: "Failed Dependency",
  403: "Forbidden",
  504: "Gateway Timeout",
  410: "Gone",
  505: "HTTP Version Not Supported",
  418: "I'm a teapot",
  419: "Insufficient Space on Resource",
  507: "Insufficient Storage",
  500: "Server Error",
  411: "Length Required",
  423: "Locked",
  420: "Method Failure",
  405: "Method Not Allowed",
  301: "Moved Permanently",
  302: "Moved Temporarily",
  207: "Multi-Status",
  300: "Multiple Choices",
  511: "Network Authentication Required",
  204: "No Content",
  203: "Non Authoritative Information",
  406: "Not Acceptable",
  404: "Not Found",
  501: "Not Implemented",
  304: "Not Modified",
  200: "OK",
  206: "Partial Content",
  402: "Payment Required",
  308: "Permanent Redirect",
  412: "Precondition Failed",
  428: "Precondition Required",
  102: "Processing",
  407: "Proxy Authentication Required",
  431: "Request Header Fields Too Large",
  408: "Request Timeout",
  413: "Request Entity Too Large",
  414: "Request-URI Too Long",
  416: "Requested Range Not Satisfiable",
  205: "Reset Content",
  303: "See Other",
  503: "Service Unavailable",
  101: "Switching Protocols",
  307: "Temporary Redirect",
  429: "Too Many Requests",
  401: "Unauthorized",
  422: "Unprocessable Entity",
  415: "Unsupported Media Type",
  305: "Use Proxy"
};

const toCloudFrontHeaders = (headers, headerNames, originalHeaders) => {
  const result = {};

  Object.entries(originalHeaders).forEach(([headerName, headerValue]) => {
    result[headerName.toLowerCase()] = headerValue;
  });

  Object.entries(headers).forEach(([headerName, headerValue]) => {
    const headerKey = headerName.toLowerCase();
    headerName = headerNames[headerKey] || headerName;

    if (readOnlyCloudFrontHeaders[headerKey]) {
      return;
    }

    result[headerKey] = [];

    if (headerValue instanceof Array) {
      headerValue.forEach((val) => {
        if (val) {
          result[headerKey].push({
            key: headerName,
            value: val.toString()
          });
        }
      });
    } else {
      if (headerValue) {
        result[headerKey].push({
          key: headerName,
          value: headerValue.toString()
        });
      }
    }
  });

  return result;
};

const isGzipSupported = (headers) => {
  let gz = false;
  const ae = headers["accept-encoding"];
  if (ae) {
    for (let i = 0; i < ae.length; i++) {
      const { value } = ae[i];
      const bits = value.split(",").map((x) => x.split(";")[0].trim());
      if (bits.indexOf("gzip") !== -1) {
        gz = true;
      }
    }
  }
  return gz;
};

const defaultOptions$3 = {
  enableHTTPCompression: false
};

const handler$1 = (
  event,
  { enableHTTPCompression, rewrittenUri } = defaultOptions$3
) => {
  const { request: cfRequest, response: cfResponse = { headers: {} } } = event;

  const response = {
    headers: {}
  };

  const newStream = new Stream__default["default"].Readable();

  const req = Object.assign(newStream, http__default["default"].IncomingMessage.prototype);
  req.url = rewrittenUri || cfRequest.uri;
  req.method = cfRequest.method;
  req.rawHeaders = [];
  req.headers = {};
  req.connection = {};

  if (cfRequest.querystring) {
    req.url = req.url + `?` + cfRequest.querystring;
  }

  const headers = cfRequest.headers || {};

  for (const lowercaseKey of Object.keys(headers)) {
    const headerKeyValPairs = headers[lowercaseKey];

    headerKeyValPairs.forEach((keyVal) => {
      req.rawHeaders.push(keyVal.key);
      req.rawHeaders.push(keyVal.value);
    });

    req.headers[lowercaseKey] = headerKeyValPairs[0].value;
  }

  req.getHeader = (name) => {
    return req.headers[name.toLowerCase()];
  };

  req.getHeaders = () => {
    return req.headers;
  };

  if (cfRequest.body && cfRequest.body.data) {
    req.push(
      cfRequest.body.data,
      cfRequest.body.encoding ? "base64" : undefined
    );
  }

  req.push(null);

  const res = new Stream__default["default"]();
  res.finished = false;

  Object.defineProperty(res, "statusCode", {
    get() {
      return response.status;
    },
    set(statusCode) {
      response.status = statusCode.toString();
      response.statusDescription = HttpStatusCodes[statusCode];
    }
  });

  res.headers = {};
  const headerNames = {};
  res.writeHead = (status, headers) => {
    response.status = status.toString();
    response.statusDescription = HttpStatusCodes[status];

    if (headers) {
      res.headers = Object.assign(res.headers, headers);
    }
    return res;
  };
  res.write = (chunk) => {
    if (!response.body) {
      response.body = Buffer.from("");
    }

    response.body = Buffer.concat([
      response.body,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    ]);
  };

  let shouldGzip = enableHTTPCompression && isGzipSupported(headers);

  const responsePromise = new Promise((resolve) => {
    res.end = (text) => {
      if (res.finished === true) {
        return;
      }

      res.finished = true;

      if (text) res.write(text);

      if (!res.statusCode) {
        res.statusCode = 200;
      }

      if (response.body) {
        response.bodyEncoding = "base64";
        response.body = shouldGzip
          ? zlib__default["default"].gzipSync(response.body).toString("base64")
          : Buffer.from(response.body).toString("base64");
      }

      response.headers = toCloudFrontHeaders(
        res.headers,
        headerNames,
        cfResponse.headers
      );

      if (shouldGzip) {
        response.headers["content-encoding"] = [
          { key: "Content-Encoding", value: "gzip" }
        ];
      }
      resolve(response);
    };
  });

  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
    headerNames[name.toLowerCase()] = name;
  };
  res.removeHeader = (name) => {
    delete res.headers[name.toLowerCase()];
  };
  res.getHeader = (name) => {
    return res.headers[name.toLowerCase()];
  };
  res.getHeaders = () => {
    return res.headers;
  };
  res.hasHeader = (name) => {
    return !!res.getHeader(name);
  };

  return {
    req,
    res,
    responsePromise
  };
};

handler$1.SPECIAL_NODE_HEADERS = specialNodeHeaders;

var nextAwsCloudfront = handler$1;

/**
 * Tokenize input string.
 */
function lexer(str) {
    var tokens = [];
    var i = 0;
    while (i < str.length) {
        var char = str[i];
        if (char === "*" || char === "+" || char === "?") {
            tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
            continue;
        }
        if (char === "\\") {
            tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
            continue;
        }
        if (char === "{") {
            tokens.push({ type: "OPEN", index: i, value: str[i++] });
            continue;
        }
        if (char === "}") {
            tokens.push({ type: "CLOSE", index: i, value: str[i++] });
            continue;
        }
        if (char === ":") {
            var name = "";
            var j = i + 1;
            while (j < str.length) {
                var code = str.charCodeAt(j);
                if (
                // `0-9`
                (code >= 48 && code <= 57) ||
                    // `A-Z`
                    (code >= 65 && code <= 90) ||
                    // `a-z`
                    (code >= 97 && code <= 122) ||
                    // `_`
                    code === 95) {
                    name += str[j++];
                    continue;
                }
                break;
            }
            if (!name)
                throw new TypeError("Missing parameter name at " + i);
            tokens.push({ type: "NAME", index: i, value: name });
            i = j;
            continue;
        }
        if (char === "(") {
            var count = 1;
            var pattern = "";
            var j = i + 1;
            if (str[j] === "?") {
                throw new TypeError("Pattern cannot start with \"?\" at " + j);
            }
            while (j < str.length) {
                if (str[j] === "\\") {
                    pattern += str[j++] + str[j++];
                    continue;
                }
                if (str[j] === ")") {
                    count--;
                    if (count === 0) {
                        j++;
                        break;
                    }
                }
                else if (str[j] === "(") {
                    count++;
                    if (str[j + 1] !== "?") {
                        throw new TypeError("Capturing groups are not allowed at " + j);
                    }
                }
                pattern += str[j++];
            }
            if (count)
                throw new TypeError("Unbalanced pattern at " + i);
            if (!pattern)
                throw new TypeError("Missing pattern at " + i);
            tokens.push({ type: "PATTERN", index: i, value: pattern });
            i = j;
            continue;
        }
        tokens.push({ type: "CHAR", index: i, value: str[i++] });
    }
    tokens.push({ type: "END", index: i, value: "" });
    return tokens;
}
/**
 * Parse a string for the raw tokens.
 */
function parse$3(str, options) {
    if (options === void 0) { options = {}; }
    var tokens = lexer(str);
    var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a;
    var defaultPattern = "[^" + escapeString(options.delimiter || "/#?") + "]+?";
    var result = [];
    var key = 0;
    var i = 0;
    var path = "";
    var tryConsume = function (type) {
        if (i < tokens.length && tokens[i].type === type)
            return tokens[i++].value;
    };
    var mustConsume = function (type) {
        var value = tryConsume(type);
        if (value !== undefined)
            return value;
        var _a = tokens[i], nextType = _a.type, index = _a.index;
        throw new TypeError("Unexpected " + nextType + " at " + index + ", expected " + type);
    };
    var consumeText = function () {
        var result = "";
        var value;
        // tslint:disable-next-line
        while ((value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR"))) {
            result += value;
        }
        return result;
    };
    while (i < tokens.length) {
        var char = tryConsume("CHAR");
        var name = tryConsume("NAME");
        var pattern = tryConsume("PATTERN");
        if (name || pattern) {
            var prefix = char || "";
            if (prefixes.indexOf(prefix) === -1) {
                path += prefix;
                prefix = "";
            }
            if (path) {
                result.push(path);
                path = "";
            }
            result.push({
                name: name || key++,
                prefix: prefix,
                suffix: "",
                pattern: pattern || defaultPattern,
                modifier: tryConsume("MODIFIER") || ""
            });
            continue;
        }
        var value = char || tryConsume("ESCAPED_CHAR");
        if (value) {
            path += value;
            continue;
        }
        if (path) {
            result.push(path);
            path = "";
        }
        var open = tryConsume("OPEN");
        if (open) {
            var prefix = consumeText();
            var name_1 = tryConsume("NAME") || "";
            var pattern_1 = tryConsume("PATTERN") || "";
            var suffix = consumeText();
            mustConsume("CLOSE");
            result.push({
                name: name_1 || (pattern_1 ? key++ : ""),
                pattern: name_1 && !pattern_1 ? defaultPattern : pattern_1,
                prefix: prefix,
                suffix: suffix,
                modifier: tryConsume("MODIFIER") || ""
            });
            continue;
        }
        mustConsume("END");
    }
    return result;
}
/**
 * Create path match function from `path-to-regexp` spec.
 */
function match(str, options) {
    var keys = [];
    var re = pathToRegexp(str, keys, options);
    return regexpToFunction(re, keys, options);
}
/**
 * Create a path match function from `path-to-regexp` output.
 */
function regexpToFunction(re, keys, options) {
    if (options === void 0) { options = {}; }
    var _a = options.decode, decode = _a === void 0 ? function (x) { return x; } : _a;
    return function (pathname) {
        var m = re.exec(pathname);
        if (!m)
            return false;
        var path = m[0], index = m.index;
        var params = Object.create(null);
        var _loop_1 = function (i) {
            // tslint:disable-next-line
            if (m[i] === undefined)
                return "continue";
            var key = keys[i - 1];
            if (key.modifier === "*" || key.modifier === "+") {
                params[key.name] = m[i].split(key.prefix + key.suffix).map(function (value) {
                    return decode(value, key);
                });
            }
            else {
                params[key.name] = decode(m[i], key);
            }
        };
        for (var i = 1; i < m.length; i++) {
            _loop_1(i);
        }
        return { path: path, index: index, params: params };
    };
}
/**
 * Escape a regular expression string.
 */
function escapeString(str) {
    return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
/**
 * Get the flags for a regexp from the options.
 */
function flags(options) {
    return options && options.sensitive ? "" : "i";
}
/**
 * Pull out keys from a regexp.
 */
function regexpToRegexp(path, keys) {
    if (!keys)
        return path;
    var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
    var index = 0;
    var execResult = groupsRegex.exec(path.source);
    while (execResult) {
        keys.push({
            // Use parenthesized substring match if available, index otherwise
            name: execResult[1] || index++,
            prefix: "",
            suffix: "",
            modifier: "",
            pattern: ""
        });
        execResult = groupsRegex.exec(path.source);
    }
    return path;
}
/**
 * Transform an array into a regexp.
 */
function arrayToRegexp(paths, keys, options) {
    var parts = paths.map(function (path) { return pathToRegexp(path, keys, options).source; });
    return new RegExp("(?:" + parts.join("|") + ")", flags(options));
}
/**
 * Create a path regexp from string input.
 */
function stringToRegexp(path, keys, options) {
    return tokensToRegexp(parse$3(path, options), keys, options);
}
/**
 * Expose a function for taking tokens and returning a RegExp.
 */
function tokensToRegexp(tokens, keys, options) {
    if (options === void 0) { options = {}; }
    var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function (x) { return x; } : _d;
    var endsWith = "[" + escapeString(options.endsWith || "") + "]|$";
    var delimiter = "[" + escapeString(options.delimiter || "/#?") + "]";
    var route = start ? "^" : "";
    // Iterate over the tokens and create our regexp string.
    for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
        var token = tokens_1[_i];
        if (typeof token === "string") {
            route += escapeString(encode(token));
        }
        else {
            var prefix = escapeString(encode(token.prefix));
            var suffix = escapeString(encode(token.suffix));
            if (token.pattern) {
                if (keys)
                    keys.push(token);
                if (prefix || suffix) {
                    if (token.modifier === "+" || token.modifier === "*") {
                        var mod = token.modifier === "*" ? "?" : "";
                        route += "(?:" + prefix + "((?:" + token.pattern + ")(?:" + suffix + prefix + "(?:" + token.pattern + "))*)" + suffix + ")" + mod;
                    }
                    else {
                        route += "(?:" + prefix + "(" + token.pattern + ")" + suffix + ")" + token.modifier;
                    }
                }
                else {
                    route += "(" + token.pattern + ")" + token.modifier;
                }
            }
            else {
                route += "(?:" + prefix + suffix + ")" + token.modifier;
            }
        }
    }
    if (end) {
        if (!strict)
            route += delimiter + "?";
        route += !options.endsWith ? "$" : "(?=" + endsWith + ")";
    }
    else {
        var endToken = tokens[tokens.length - 1];
        var isEndDelimited = typeof endToken === "string"
            ? delimiter.indexOf(endToken[endToken.length - 1]) > -1
            : // tslint:disable-next-line
                endToken === undefined;
        if (!strict) {
            route += "(?:" + delimiter + "(?=" + endsWith + "))?";
        }
        if (!isEndDelimited) {
            route += "(?=" + delimiter + "|" + endsWith + ")";
        }
    }
    return new RegExp(route, flags(options));
}
/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 */
function pathToRegexp(path, keys, options) {
    if (path instanceof RegExp)
        return regexpToRegexp(path, keys);
    if (Array.isArray(path))
        return arrayToRegexp(path, keys, options);
    return stringToRegexp(path, keys, options);
}

function addDefaultLocaleToPath(path, routesManifest, forceLocale = null) {
    if (routesManifest.i18n) {
        const defaultLocale = forceLocale !== null && forceLocale !== void 0 ? forceLocale : routesManifest.i18n.defaultLocale;
        const locales = routesManifest.i18n.locales;
        const basePath = path.startsWith(routesManifest.basePath)
            ? routesManifest.basePath
            : "";
        // If prefixed with a locale, return that path with normalized locale
        const pathLowerCase = path.toLowerCase();
        for (const locale of locales) {
            if (pathLowerCase === `${basePath}/${locale}`.toLowerCase() ||
                pathLowerCase.startsWith(`${basePath}/${locale}/`.toLowerCase())) {
                return path.replace(new RegExp(`${basePath}/${locale}`, "i"), `${basePath}/${forceLocale !== null && forceLocale !== void 0 ? forceLocale : locale}`);
            }
        }
        // Otherwise, prefix with default locale
        if (path === "/" || path === `${basePath}`) {
            return `${basePath}/${defaultLocale}`;
        }
        else {
            return path.replace(`${basePath}/`, `${basePath}/${defaultLocale}/`);
        }
    }
    return path;
}

/**
 Provides matching capabilities to support custom redirects, rewrites, and headers.
 */
/**
 * Match the given path against a source path.
 * @param path
 * @param source
 */
function matchPath(path, source) {
    const matcher = match(source, { decode: decodeURIComponent });
    return matcher(path);
}

const getCustomHeaders = (uri, routesManifest) => {
    const localized = addDefaultLocaleToPath(uri, routesManifest);
    const headers = {};
    for (const headerData of routesManifest.headers) {
        if (!matchPath(localized, headerData.source)) {
            continue;
        }
        for (const { key, value } of headerData.headers) {
            if (key) {
                // Header overriding behavior as per:
                // https://nextjs.org/docs/api-reference/next.config.js/headers
                headers[key.toLowerCase()] = [{ key, value }];
            }
        }
    }
    return headers;
};
const setCustomHeaders = (event, routesManifest) => {
    var _a;
    const [uri] = ((_a = event.req.url) !== null && _a !== void 0 ? _a : "").split("?");
    const headers = getCustomHeaders(uri, routesManifest);
    for (const [{ key, value }] of Object.values(headers)) {
        if (key) {
            event.res.setHeader(key, value);
        }
    }
};

function getUnauthenticatedResponse(authorizationHeaders, authentication) {
    var _a;
    if (authentication && authentication.username && authentication.password) {
        const validAuth = "Basic " +
            Buffer.from(authentication.username + ":" + authentication.password).toString("base64");
        if (!authorizationHeaders || ((_a = authorizationHeaders[0]) === null || _a === void 0 ? void 0 : _a.value) !== validAuth) {
            return {
                isUnauthorized: true,
                status: 401,
                statusDescription: "Unauthorized",
                body: "Unauthorized",
                headers: {
                    "www-authenticate": [{ key: "WWW-Authenticate", value: "Basic" }]
                }
            };
        }
    }
}

/**
 * Create a redirect response with the given status code
 * @param uri
 * @param querystring
 * @param statusCode
 */
function createRedirectResponse(uri, querystring, statusCode) {
    let location;
    // Properly join query strings
    if (querystring) {
        const [uriPath, uriQuery] = uri.split("?");
        location = `${uriPath}?${querystring}${uriQuery ? `&${uriQuery}` : ""}`;
    }
    else {
        location = uri;
    }
    const status = statusCode;
    const statusDescription = http.STATUS_CODES[status];
    const refresh = statusCode === 308
        ? [
            // Required for IE11 compatibility
            {
                key: "Refresh",
                value: `0;url=${location}`
            }
        ]
        : [];
    const cacheControl = [
        {
            key: "Cache-Control",
            value: "s-maxage=0"
        }
    ];
    return {
        isRedirect: true,
        status: status,
        statusDescription: statusDescription || "",
        headers: {
            location: [
                {
                    key: "Location",
                    value: location
                }
            ],
            refresh: refresh,
            "cache-control": cacheControl
        }
    };
}
/**
 * Get a domain redirect such as redirecting www to non-www domain.
 * @param request
 * @param manifest
 */
function getDomainRedirectPath(request, manifest) {
    const hostHeaders = request.headers["host"];
    if (hostHeaders && hostHeaders.length > 0) {
        const host = hostHeaders[0].value;
        const domainRedirects = manifest.domainRedirects;
        if (domainRedirects && domainRedirects[host]) {
            return `${domainRedirects[host]}${request.uri}`;
        }
    }
}

const handleAuth = (req, manifest) => {
    const { headers } = req;
    return getUnauthenticatedResponse(headers.authorization, manifest.authentication);
};
const handleDomainRedirects = (req, manifest) => {
    const path = getDomainRedirectPath(req, manifest);
    if (path) {
        return createRedirectResponse(path, req.querystring, 308);
    }
};

var esm=(()=>{var e={343:(e,t,r)=>{r.r(t);r.d(t,{Observable:()=>Observable,combineLatest:()=>combineLatest,default:()=>l,merge:()=>merge,zip:()=>zip});const n=()=>typeof Symbol==="function";const o=e=>n()&&Boolean(Symbol[e]);const i=e=>o(e)?Symbol[e]:"@@"+e;if(n()&&!o("observable")){Symbol.observable=Symbol("observable");}const s=i("iterator");const u=i("observable");const c=i("species");function getMethod(e,t){let r=e[t];if(r==null)return undefined;if(typeof r!=="function")throw new TypeError(r+" is not a function");return r}function getSpecies(e){let t=e.constructor;if(t!==undefined){t=t[c];if(t===null){t=undefined;}}return t!==undefined?t:Observable}function isObservable(e){return e instanceof Observable}function hostReportError(e){if(hostReportError.log){hostReportError.log(e);}else {setTimeout(()=>{throw e});}}function enqueue(e){Promise.resolve().then(()=>{try{e();}catch(e){hostReportError(e);}});}function cleanupSubscription(e){let t=e._cleanup;if(t===undefined)return;e._cleanup=undefined;if(!t){return}try{if(typeof t==="function"){t();}else {let e=getMethod(t,"unsubscribe");if(e){e.call(t);}}}catch(e){hostReportError(e);}}function closeSubscription(e){e._observer=undefined;e._queue=undefined;e._state="closed";}function flushSubscription(e){let t=e._queue;if(!t){return}e._queue=undefined;e._state="ready";for(let r=0;r<t.length;++r){notifySubscription(e,t[r].type,t[r].value);if(e._state==="closed")break}}function notifySubscription(e,t,r){e._state="running";let n=e._observer;try{let o=getMethod(n,t);switch(t){case"next":if(o)o.call(n,r);break;case"error":closeSubscription(e);if(o)o.call(n,r);else throw r;break;case"complete":closeSubscription(e);if(o)o.call(n);break}}catch(e){hostReportError(e);}if(e._state==="closed")cleanupSubscription(e);else if(e._state==="running")e._state="ready";}function onNotify(e,t,r){if(e._state==="closed")return;if(e._state==="buffering"){e._queue.push({type:t,value:r});return}if(e._state!=="ready"){e._state="buffering";e._queue=[{type:t,value:r}];enqueue(()=>flushSubscription(e));return}notifySubscription(e,t,r);}class Subscription{constructor(e,t){this._cleanup=undefined;this._observer=e;this._queue=undefined;this._state="initializing";let r=new SubscriptionObserver(this);try{this._cleanup=t.call(undefined,r);}catch(e){r.error(e);}if(this._state==="initializing")this._state="ready";}get closed(){return this._state==="closed"}unsubscribe(){if(this._state!=="closed"){closeSubscription(this);cleanupSubscription(this);}}}class SubscriptionObserver{constructor(e){this._subscription=e;}get closed(){return this._subscription._state==="closed"}next(e){onNotify(this._subscription,"next",e);}error(e){onNotify(this._subscription,"error",e);}complete(){onNotify(this._subscription,"complete");}}class Observable{constructor(e){if(!(this instanceof Observable))throw new TypeError("Observable cannot be called as a function");if(typeof e!=="function")throw new TypeError("Observable initializer must be a function");this._subscriber=e;}subscribe(e){if(typeof e!=="object"||e===null){e={next:e,error:arguments[1],complete:arguments[2]};}return new Subscription(e,this._subscriber)}forEach(e){return new Promise((t,r)=>{if(typeof e!=="function"){r(new TypeError(e+" is not a function"));return}function done(){n.unsubscribe();t();}let n=this.subscribe({next(t){try{e(t,done);}catch(e){r(e);n.unsubscribe();}},error:r,complete:t});})}map(e){if(typeof e!=="function")throw new TypeError(e+" is not a function");let t=getSpecies(this);return new t(t=>this.subscribe({next(r){try{r=e(r);}catch(e){return t.error(e)}t.next(r);},error(e){t.error(e);},complete(){t.complete();}}))}filter(e){if(typeof e!=="function")throw new TypeError(e+" is not a function");let t=getSpecies(this);return new t(t=>this.subscribe({next(r){try{if(!e(r))return}catch(e){return t.error(e)}t.next(r);},error(e){t.error(e);},complete(){t.complete();}}))}reduce(e){if(typeof e!=="function")throw new TypeError(e+" is not a function");let t=getSpecies(this);let r=arguments.length>1;let n=false;let o=arguments[1];let i=o;return new t(t=>this.subscribe({next(o){let s=!n;n=true;if(!s||r){try{i=e(i,o);}catch(e){return t.error(e)}}else {i=o;}},error(e){t.error(e);},complete(){if(!n&&!r)return t.error(new TypeError("Cannot reduce an empty sequence"));t.next(i);t.complete();}}))}concat(...e){let t=getSpecies(this);return new t(r=>{let n;let o=0;function startNext(i){n=i.subscribe({next(e){r.next(e);},error(e){r.error(e);},complete(){if(o===e.length){n=undefined;r.complete();}else {startNext(t.from(e[o++]));}}});}startNext(this);return ()=>{if(n){n.unsubscribe();n=undefined;}}})}flatMap(e){if(typeof e!=="function")throw new TypeError(e+" is not a function");let t=getSpecies(this);return new t(r=>{let n=[];let o=this.subscribe({next(o){if(e){try{o=e(o);}catch(e){return r.error(e)}}let i=t.from(o).subscribe({next(e){r.next(e);},error(e){r.error(e);},complete(){let e=n.indexOf(i);if(e>=0)n.splice(e,1);completeIfDone();}});n.push(i);},error(e){r.error(e);},complete(){completeIfDone();}});function completeIfDone(){if(o.closed&&n.length===0)r.complete();}return ()=>{n.forEach(e=>e.unsubscribe());o.unsubscribe();}})}[u](){return this}static from(e){let t=typeof this==="function"?this:Observable;if(e==null)throw new TypeError(e+" is not an object");let r=getMethod(e,u);if(r){let n=r.call(e);if(Object(n)!==n)throw new TypeError(n+" is not an object");if(isObservable(n)&&n.constructor===t)return n;return new t(e=>n.subscribe(e))}if(o("iterator")){r=getMethod(e,s);if(r){return new t(t=>{enqueue(()=>{if(t.closed)return;for(let n of r.call(e)){t.next(n);if(t.closed)return}t.complete();});})}}if(Array.isArray(e)){return new t(t=>{enqueue(()=>{if(t.closed)return;for(let r=0;r<e.length;++r){t.next(e[r]);if(t.closed)return}t.complete();});})}throw new TypeError(e+" is not observable")}static of(...e){let t=typeof this==="function"?this:Observable;return new t(t=>{enqueue(()=>{if(t.closed)return;for(let r=0;r<e.length;++r){t.next(e[r]);if(t.closed)return}t.complete();});})}static get[c](){return this}}if(n()){Object.defineProperty(Observable,Symbol("extensions"),{value:{symbol:u,hostReportError:hostReportError},configurable:true});}function merge(...e){return new Observable(t=>{if(e.length===0)return Observable.from([]);let r=e.length;let n=e.map(e=>Observable.from(e).subscribe({next(e){t.next(e);},error(e){t.error(e);},complete(){if(--r===0)t.complete();}}));return ()=>n.forEach(e=>e.unsubscribe())})}function combineLatest(...e){return new Observable(t=>{if(e.length===0)return Observable.from([]);let r=e.length;let n=new Set;let o=false;let i=e.map(()=>undefined);let s=e.map((s,u)=>Observable.from(s).subscribe({next(r){i[u]=r;if(!o){n.add(u);if(n.size!==e.length)return;n=null;o=true;}t.next(Array.from(i));},error(e){t.error(e);},complete(){if(--r===0)t.complete();}}));return ()=>s.forEach(e=>e.unsubscribe())})}function zip(...e){return new Observable(t=>{if(e.length===0)return Observable.from([]);let r=e.map(()=>[]);function done(){return r.some((e,t)=>e.length===0&&n[t].closed)}let n=e.map((e,n)=>Observable.from(e).subscribe({next(e){r[n].push(e);if(r.every(e=>e.length>0)){t.next(r.map(e=>e.shift()));if(done())t.complete();}},error(e){t.error(e);},complete(){if(done())t.complete();}}));return ()=>n.forEach(e=>e.unsubscribe())})}const l=Observable;}};var t={};function __nccwpck_require__(r){if(t[r]){return t[r].exports}var n=t[r]={exports:{}};var o=true;try{e[r](n,n.exports,__nccwpck_require__);o=false;}finally{if(o)delete t[r];}return n.exports}(()=>{__nccwpck_require__.d=((e,t)=>{for(var r in t){if(__nccwpck_require__.o(t,r)&&!__nccwpck_require__.o(e,r)){Object.defineProperty(e,r,{enumerable:true,get:t[r]});}}});})();(()=>{__nccwpck_require__.o=((e,t)=>Object.prototype.hasOwnProperty.call(e,t));})();(()=>{__nccwpck_require__.r=(e=>{if(typeof Symbol!=="undefined"&&Symbol.toStringTag){Object.defineProperty(e,Symbol.toStringTag,{value:"Module"});}Object.defineProperty(e,"__esModule",{value:true});});})();__nccwpck_require__.ab=__dirname+"/";return __nccwpck_require__(343)})();

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getAugmentedNamespace(n) {
	if (n.__esModule) return n;
	var a = Object.defineProperty({}, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

function createCommonjsModule(fn) {
  var module = { exports: {} };
	return fn(module, module.exports), module.exports;
}

createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.SERVER_DIRECTORY = exports.PAGES_MANIFEST = exports.SERVER_PROPS_ID = exports.CLIENT_STATIC_FILES_RUNTIME_WEBPACK = exports.PERMANENT_REDIRECT_STATUS = exports.SERVER_FILES_MANIFEST = exports.STATIC_PROPS_ID = exports.BUILD_MANIFEST = exports.BLOCKED_PAGES = exports.STATIC_STATUS_PAGES = exports.PRERENDER_MANIFEST = exports.DEV_CLIENT_PAGES_MANIFEST = exports.OPTIMIZED_FONT_PROVIDERS = exports.TEMPORARY_REDIRECT_STATUS = exports.SERVERLESS_DIRECTORY = exports.EXPORT_MARKER = exports.GOOGLE_FONT_PROVIDER = exports.PHASE_PRODUCTION_BUILD = exports.CLIENT_STATIC_FILES_RUNTIME_MAIN = exports.BUILD_ID_FILE = exports.CONFIG_FILE = exports.CLIENT_STATIC_FILES_RUNTIME = exports.PHASE_PRODUCTION_SERVER = exports.EXPORT_DETAIL = exports.IMAGES_MANIFEST = exports.CLIENT_STATIC_FILES_RUNTIME_AMP = exports.CLIENT_PUBLIC_FILES_PATH = exports.CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL = exports.STRING_LITERAL_DROP_BUNDLE = exports.TRACE_OUTPUT_VERSION = exports.CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH = exports.FONT_MANIFEST = exports.REACT_LOADABLE_MANIFEST = exports.ROUTES_MANIFEST = exports.CLIENT_STATIC_FILES_PATH = exports.BODY_RENDER_TARGET = exports.PHASE_EXPORT = exports.PHASE_DEVELOPMENT_SERVER = void 0;
const PHASE_EXPORT = 'phase-export';
exports.PHASE_EXPORT = PHASE_EXPORT;
const PHASE_PRODUCTION_BUILD = 'phase-production-build';
exports.PHASE_PRODUCTION_BUILD = PHASE_PRODUCTION_BUILD;
const PHASE_PRODUCTION_SERVER = 'phase-production-server';
exports.PHASE_PRODUCTION_SERVER = PHASE_PRODUCTION_SERVER;
const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';
exports.PHASE_DEVELOPMENT_SERVER = PHASE_DEVELOPMENT_SERVER;
const PAGES_MANIFEST = 'pages-manifest.json';
exports.PAGES_MANIFEST = PAGES_MANIFEST;
const BUILD_MANIFEST = 'build-manifest.json';
exports.BUILD_MANIFEST = BUILD_MANIFEST;
const EXPORT_MARKER = 'export-marker.json';
exports.EXPORT_MARKER = EXPORT_MARKER;
const EXPORT_DETAIL = 'export-detail.json';
exports.EXPORT_DETAIL = EXPORT_DETAIL;
const PRERENDER_MANIFEST = 'prerender-manifest.json';
exports.PRERENDER_MANIFEST = PRERENDER_MANIFEST;
const ROUTES_MANIFEST = 'routes-manifest.json';
exports.ROUTES_MANIFEST = ROUTES_MANIFEST;
const IMAGES_MANIFEST = 'images-manifest.json';
exports.IMAGES_MANIFEST = IMAGES_MANIFEST;
const SERVER_FILES_MANIFEST = 'required-server-files.json';
exports.SERVER_FILES_MANIFEST = SERVER_FILES_MANIFEST;
const DEV_CLIENT_PAGES_MANIFEST = '_devPagesManifest.json';
exports.DEV_CLIENT_PAGES_MANIFEST = DEV_CLIENT_PAGES_MANIFEST;
const REACT_LOADABLE_MANIFEST = 'react-loadable-manifest.json';
exports.REACT_LOADABLE_MANIFEST = REACT_LOADABLE_MANIFEST;
const FONT_MANIFEST = 'font-manifest.json';
exports.FONT_MANIFEST = FONT_MANIFEST;
const SERVER_DIRECTORY = 'server';
exports.SERVER_DIRECTORY = SERVER_DIRECTORY;
const SERVERLESS_DIRECTORY = 'serverless';
exports.SERVERLESS_DIRECTORY = SERVERLESS_DIRECTORY;
const CONFIG_FILE = 'next.config.js';
exports.CONFIG_FILE = CONFIG_FILE;
const BUILD_ID_FILE = 'BUILD_ID';
exports.BUILD_ID_FILE = BUILD_ID_FILE;
const BLOCKED_PAGES = [
    '/_document',
    '/_app',
    '/_error'
];
exports.BLOCKED_PAGES = BLOCKED_PAGES;
const CLIENT_PUBLIC_FILES_PATH = 'public';
exports.CLIENT_PUBLIC_FILES_PATH = CLIENT_PUBLIC_FILES_PATH;
const CLIENT_STATIC_FILES_PATH = 'static';
exports.CLIENT_STATIC_FILES_PATH = CLIENT_STATIC_FILES_PATH;
const CLIENT_STATIC_FILES_RUNTIME = 'runtime';
exports.CLIENT_STATIC_FILES_RUNTIME = CLIENT_STATIC_FILES_RUNTIME;
const BODY_RENDER_TARGET = '__NEXT_BODY_RENDER_TARGET__';
exports.BODY_RENDER_TARGET = BODY_RENDER_TARGET;
const STRING_LITERAL_DROP_BUNDLE = '__NEXT_DROP_CLIENT_FILE__';
exports.STRING_LITERAL_DROP_BUNDLE = STRING_LITERAL_DROP_BUNDLE;
const CLIENT_STATIC_FILES_RUNTIME_MAIN = `main`;
exports.CLIENT_STATIC_FILES_RUNTIME_MAIN = CLIENT_STATIC_FILES_RUNTIME_MAIN;
const CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH = `react-refresh`;
exports.CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH = CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH;
const CLIENT_STATIC_FILES_RUNTIME_AMP = `amp`;
exports.CLIENT_STATIC_FILES_RUNTIME_AMP = CLIENT_STATIC_FILES_RUNTIME_AMP;
const CLIENT_STATIC_FILES_RUNTIME_WEBPACK = `webpack`;
exports.CLIENT_STATIC_FILES_RUNTIME_WEBPACK = CLIENT_STATIC_FILES_RUNTIME_WEBPACK;
const CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL = Symbol(`polyfills`);
exports.CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL = CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL;
const TEMPORARY_REDIRECT_STATUS = 307;
exports.TEMPORARY_REDIRECT_STATUS = TEMPORARY_REDIRECT_STATUS;
const PERMANENT_REDIRECT_STATUS = 308;
exports.PERMANENT_REDIRECT_STATUS = PERMANENT_REDIRECT_STATUS;
const STATIC_PROPS_ID = '__N_SSG';
exports.STATIC_PROPS_ID = STATIC_PROPS_ID;
const SERVER_PROPS_ID = '__N_SSP';
exports.SERVER_PROPS_ID = SERVER_PROPS_ID;
const GOOGLE_FONT_PROVIDER = 'https://fonts.googleapis.com/css';
exports.GOOGLE_FONT_PROVIDER = GOOGLE_FONT_PROVIDER;
const OPTIMIZED_FONT_PROVIDERS = [
    {
        url: GOOGLE_FONT_PROVIDER,
        preconnect: 'https://fonts.gstatic.com'
    },
    {
        url: 'https://use.typekit.net',
        preconnect: 'https://use.typekit.net'
    }, 
];
exports.OPTIMIZED_FONT_PROVIDERS = OPTIMIZED_FONT_PROVIDERS;
const STATIC_STATUS_PAGES = [
    '/500'
];
exports.STATIC_STATUS_PAGES = STATIC_STATUS_PAGES;
const TRACE_OUTPUT_VERSION = 1;
exports.TRACE_OUTPUT_VERSION = TRACE_OUTPUT_VERSION;


});

_interopRequireDefault(esm);

function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}

var conversions = {};
var lib$5 = conversions;

function sign(x) {
    return x < 0 ? -1 : 1;
}

function evenRound(x) {
    // Round x to the nearest integer, choosing the even integer if it lies halfway between two.
    if ((x % 1) === 0.5 && (x & 1) === 0) { // [even number].5; round down (i.e. floor)
        return Math.floor(x);
    } else {
        return Math.round(x);
    }
}

function createNumberConversion(bitLength, typeOpts) {
    if (!typeOpts.unsigned) {
        --bitLength;
    }
    const lowerBound = typeOpts.unsigned ? 0 : -Math.pow(2, bitLength);
    const upperBound = Math.pow(2, bitLength) - 1;

    const moduloVal = typeOpts.moduloBitLength ? Math.pow(2, typeOpts.moduloBitLength) : Math.pow(2, bitLength);
    const moduloBound = typeOpts.moduloBitLength ? Math.pow(2, typeOpts.moduloBitLength - 1) : Math.pow(2, bitLength - 1);

    return function(V, opts) {
        if (!opts) opts = {};

        let x = +V;

        if (opts.enforceRange) {
            if (!Number.isFinite(x)) {
                throw new TypeError("Argument is not a finite number");
            }

            x = sign(x) * Math.floor(Math.abs(x));
            if (x < lowerBound || x > upperBound) {
                throw new TypeError("Argument is not in byte range");
            }

            return x;
        }

        if (!isNaN(x) && opts.clamp) {
            x = evenRound(x);

            if (x < lowerBound) x = lowerBound;
            if (x > upperBound) x = upperBound;
            return x;
        }

        if (!Number.isFinite(x) || x === 0) {
            return 0;
        }

        x = sign(x) * Math.floor(Math.abs(x));
        x = x % moduloVal;

        if (!typeOpts.unsigned && x >= moduloBound) {
            return x - moduloVal;
        } else if (typeOpts.unsigned) {
            if (x < 0) {
              x += moduloVal;
            } else if (x === -0) { // don't return negative zero
              return 0;
            }
        }

        return x;
    }
}

conversions["void"] = function () {
    return undefined;
};

conversions["boolean"] = function (val) {
    return !!val;
};

conversions["byte"] = createNumberConversion(8, { unsigned: false });
conversions["octet"] = createNumberConversion(8, { unsigned: true });

conversions["short"] = createNumberConversion(16, { unsigned: false });
conversions["unsigned short"] = createNumberConversion(16, { unsigned: true });

conversions["long"] = createNumberConversion(32, { unsigned: false });
conversions["unsigned long"] = createNumberConversion(32, { unsigned: true });

conversions["long long"] = createNumberConversion(32, { unsigned: false, moduloBitLength: 64 });
conversions["unsigned long long"] = createNumberConversion(32, { unsigned: true, moduloBitLength: 64 });

conversions["double"] = function (V) {
    const x = +V;

    if (!Number.isFinite(x)) {
        throw new TypeError("Argument is not a finite floating-point value");
    }

    return x;
};

conversions["unrestricted double"] = function (V) {
    const x = +V;

    if (isNaN(x)) {
        throw new TypeError("Argument is NaN");
    }

    return x;
};

// not quite valid, but good enough for JS
conversions["float"] = conversions["double"];
conversions["unrestricted float"] = conversions["unrestricted double"];

conversions["DOMString"] = function (V, opts) {
    if (!opts) opts = {};

    if (opts.treatNullAsEmptyString && V === null) {
        return "";
    }

    return String(V);
};

conversions["ByteString"] = function (V, opts) {
    const x = String(V);
    let c = undefined;
    for (let i = 0; (c = x.codePointAt(i)) !== undefined; ++i) {
        if (c > 255) {
            throw new TypeError("Argument is not a valid bytestring");
        }
    }

    return x;
};

conversions["USVString"] = function (V) {
    const S = String(V);
    const n = S.length;
    const U = [];
    for (let i = 0; i < n; ++i) {
        const c = S.charCodeAt(i);
        if (c < 0xD800 || c > 0xDFFF) {
            U.push(String.fromCodePoint(c));
        } else if (0xDC00 <= c && c <= 0xDFFF) {
            U.push(String.fromCodePoint(0xFFFD));
        } else {
            if (i === n - 1) {
                U.push(String.fromCodePoint(0xFFFD));
            } else {
                const d = S.charCodeAt(i + 1);
                if (0xDC00 <= d && d <= 0xDFFF) {
                    const a = c & 0x3FF;
                    const b = d & 0x3FF;
                    U.push(String.fromCodePoint((2 << 15) + (2 << 9) * a + b));
                    ++i;
                } else {
                    U.push(String.fromCodePoint(0xFFFD));
                }
            }
        }
    }

    return U.join('');
};

conversions["Date"] = function (V, opts) {
    if (!(V instanceof Date)) {
        throw new TypeError("Argument is not a Date object");
    }
    if (isNaN(V)) {
        return undefined;
    }

    return V;
};

conversions["RegExp"] = function (V, opts) {
    if (!(V instanceof RegExp)) {
        V = new RegExp(V);
    }

    return V;
};

var utils$1 = createCommonjsModule(function (module) {

module.exports.mixin = function mixin(target, source) {
  const keys = Object.getOwnPropertyNames(source);
  for (let i = 0; i < keys.length; ++i) {
    Object.defineProperty(target, keys[i], Object.getOwnPropertyDescriptor(source, keys[i]));
  }
};

module.exports.wrapperSymbol = Symbol("wrapper");
module.exports.implSymbol = Symbol("impl");

module.exports.wrapperForImpl = function (impl) {
  return impl[module.exports.wrapperSymbol];
};

module.exports.implForWrapper = function (wrapper) {
  return wrapper[module.exports.implSymbol];
};
});

var mappingTable = [
	[
		[
			0,
			44
		],
		"disallowed_STD3_valid"
	],
	[
		[
			45,
			46
		],
		"valid"
	],
	[
		[
			47,
			47
		],
		"disallowed_STD3_valid"
	],
	[
		[
			48,
			57
		],
		"valid"
	],
	[
		[
			58,
			64
		],
		"disallowed_STD3_valid"
	],
	[
		[
			65,
			65
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			66,
			66
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			67,
			67
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			68,
			68
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			69,
			69
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			70,
			70
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			71,
			71
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			72,
			72
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			73,
			73
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			74,
			74
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			75,
			75
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			76,
			76
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			77,
			77
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			78,
			78
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			79,
			79
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			80,
			80
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			81,
			81
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			82,
			82
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			83,
			83
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			84,
			84
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			85,
			85
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			86,
			86
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			87,
			87
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			88,
			88
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			89,
			89
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			90,
			90
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			91,
			96
		],
		"disallowed_STD3_valid"
	],
	[
		[
			97,
			122
		],
		"valid"
	],
	[
		[
			123,
			127
		],
		"disallowed_STD3_valid"
	],
	[
		[
			128,
			159
		],
		"disallowed"
	],
	[
		[
			160,
			160
		],
		"disallowed_STD3_mapped",
		[
			32
		]
	],
	[
		[
			161,
			167
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			168,
			168
		],
		"disallowed_STD3_mapped",
		[
			32,
			776
		]
	],
	[
		[
			169,
			169
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			170,
			170
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			171,
			172
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			173,
			173
		],
		"ignored"
	],
	[
		[
			174,
			174
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			175,
			175
		],
		"disallowed_STD3_mapped",
		[
			32,
			772
		]
	],
	[
		[
			176,
			177
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			178,
			178
		],
		"mapped",
		[
			50
		]
	],
	[
		[
			179,
			179
		],
		"mapped",
		[
			51
		]
	],
	[
		[
			180,
			180
		],
		"disallowed_STD3_mapped",
		[
			32,
			769
		]
	],
	[
		[
			181,
			181
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			182,
			182
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			183,
			183
		],
		"valid"
	],
	[
		[
			184,
			184
		],
		"disallowed_STD3_mapped",
		[
			32,
			807
		]
	],
	[
		[
			185,
			185
		],
		"mapped",
		[
			49
		]
	],
	[
		[
			186,
			186
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			187,
			187
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			188,
			188
		],
		"mapped",
		[
			49,
			8260,
			52
		]
	],
	[
		[
			189,
			189
		],
		"mapped",
		[
			49,
			8260,
			50
		]
	],
	[
		[
			190,
			190
		],
		"mapped",
		[
			51,
			8260,
			52
		]
	],
	[
		[
			191,
			191
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			192,
			192
		],
		"mapped",
		[
			224
		]
	],
	[
		[
			193,
			193
		],
		"mapped",
		[
			225
		]
	],
	[
		[
			194,
			194
		],
		"mapped",
		[
			226
		]
	],
	[
		[
			195,
			195
		],
		"mapped",
		[
			227
		]
	],
	[
		[
			196,
			196
		],
		"mapped",
		[
			228
		]
	],
	[
		[
			197,
			197
		],
		"mapped",
		[
			229
		]
	],
	[
		[
			198,
			198
		],
		"mapped",
		[
			230
		]
	],
	[
		[
			199,
			199
		],
		"mapped",
		[
			231
		]
	],
	[
		[
			200,
			200
		],
		"mapped",
		[
			232
		]
	],
	[
		[
			201,
			201
		],
		"mapped",
		[
			233
		]
	],
	[
		[
			202,
			202
		],
		"mapped",
		[
			234
		]
	],
	[
		[
			203,
			203
		],
		"mapped",
		[
			235
		]
	],
	[
		[
			204,
			204
		],
		"mapped",
		[
			236
		]
	],
	[
		[
			205,
			205
		],
		"mapped",
		[
			237
		]
	],
	[
		[
			206,
			206
		],
		"mapped",
		[
			238
		]
	],
	[
		[
			207,
			207
		],
		"mapped",
		[
			239
		]
	],
	[
		[
			208,
			208
		],
		"mapped",
		[
			240
		]
	],
	[
		[
			209,
			209
		],
		"mapped",
		[
			241
		]
	],
	[
		[
			210,
			210
		],
		"mapped",
		[
			242
		]
	],
	[
		[
			211,
			211
		],
		"mapped",
		[
			243
		]
	],
	[
		[
			212,
			212
		],
		"mapped",
		[
			244
		]
	],
	[
		[
			213,
			213
		],
		"mapped",
		[
			245
		]
	],
	[
		[
			214,
			214
		],
		"mapped",
		[
			246
		]
	],
	[
		[
			215,
			215
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			216,
			216
		],
		"mapped",
		[
			248
		]
	],
	[
		[
			217,
			217
		],
		"mapped",
		[
			249
		]
	],
	[
		[
			218,
			218
		],
		"mapped",
		[
			250
		]
	],
	[
		[
			219,
			219
		],
		"mapped",
		[
			251
		]
	],
	[
		[
			220,
			220
		],
		"mapped",
		[
			252
		]
	],
	[
		[
			221,
			221
		],
		"mapped",
		[
			253
		]
	],
	[
		[
			222,
			222
		],
		"mapped",
		[
			254
		]
	],
	[
		[
			223,
			223
		],
		"deviation",
		[
			115,
			115
		]
	],
	[
		[
			224,
			246
		],
		"valid"
	],
	[
		[
			247,
			247
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			248,
			255
		],
		"valid"
	],
	[
		[
			256,
			256
		],
		"mapped",
		[
			257
		]
	],
	[
		[
			257,
			257
		],
		"valid"
	],
	[
		[
			258,
			258
		],
		"mapped",
		[
			259
		]
	],
	[
		[
			259,
			259
		],
		"valid"
	],
	[
		[
			260,
			260
		],
		"mapped",
		[
			261
		]
	],
	[
		[
			261,
			261
		],
		"valid"
	],
	[
		[
			262,
			262
		],
		"mapped",
		[
			263
		]
	],
	[
		[
			263,
			263
		],
		"valid"
	],
	[
		[
			264,
			264
		],
		"mapped",
		[
			265
		]
	],
	[
		[
			265,
			265
		],
		"valid"
	],
	[
		[
			266,
			266
		],
		"mapped",
		[
			267
		]
	],
	[
		[
			267,
			267
		],
		"valid"
	],
	[
		[
			268,
			268
		],
		"mapped",
		[
			269
		]
	],
	[
		[
			269,
			269
		],
		"valid"
	],
	[
		[
			270,
			270
		],
		"mapped",
		[
			271
		]
	],
	[
		[
			271,
			271
		],
		"valid"
	],
	[
		[
			272,
			272
		],
		"mapped",
		[
			273
		]
	],
	[
		[
			273,
			273
		],
		"valid"
	],
	[
		[
			274,
			274
		],
		"mapped",
		[
			275
		]
	],
	[
		[
			275,
			275
		],
		"valid"
	],
	[
		[
			276,
			276
		],
		"mapped",
		[
			277
		]
	],
	[
		[
			277,
			277
		],
		"valid"
	],
	[
		[
			278,
			278
		],
		"mapped",
		[
			279
		]
	],
	[
		[
			279,
			279
		],
		"valid"
	],
	[
		[
			280,
			280
		],
		"mapped",
		[
			281
		]
	],
	[
		[
			281,
			281
		],
		"valid"
	],
	[
		[
			282,
			282
		],
		"mapped",
		[
			283
		]
	],
	[
		[
			283,
			283
		],
		"valid"
	],
	[
		[
			284,
			284
		],
		"mapped",
		[
			285
		]
	],
	[
		[
			285,
			285
		],
		"valid"
	],
	[
		[
			286,
			286
		],
		"mapped",
		[
			287
		]
	],
	[
		[
			287,
			287
		],
		"valid"
	],
	[
		[
			288,
			288
		],
		"mapped",
		[
			289
		]
	],
	[
		[
			289,
			289
		],
		"valid"
	],
	[
		[
			290,
			290
		],
		"mapped",
		[
			291
		]
	],
	[
		[
			291,
			291
		],
		"valid"
	],
	[
		[
			292,
			292
		],
		"mapped",
		[
			293
		]
	],
	[
		[
			293,
			293
		],
		"valid"
	],
	[
		[
			294,
			294
		],
		"mapped",
		[
			295
		]
	],
	[
		[
			295,
			295
		],
		"valid"
	],
	[
		[
			296,
			296
		],
		"mapped",
		[
			297
		]
	],
	[
		[
			297,
			297
		],
		"valid"
	],
	[
		[
			298,
			298
		],
		"mapped",
		[
			299
		]
	],
	[
		[
			299,
			299
		],
		"valid"
	],
	[
		[
			300,
			300
		],
		"mapped",
		[
			301
		]
	],
	[
		[
			301,
			301
		],
		"valid"
	],
	[
		[
			302,
			302
		],
		"mapped",
		[
			303
		]
	],
	[
		[
			303,
			303
		],
		"valid"
	],
	[
		[
			304,
			304
		],
		"mapped",
		[
			105,
			775
		]
	],
	[
		[
			305,
			305
		],
		"valid"
	],
	[
		[
			306,
			307
		],
		"mapped",
		[
			105,
			106
		]
	],
	[
		[
			308,
			308
		],
		"mapped",
		[
			309
		]
	],
	[
		[
			309,
			309
		],
		"valid"
	],
	[
		[
			310,
			310
		],
		"mapped",
		[
			311
		]
	],
	[
		[
			311,
			312
		],
		"valid"
	],
	[
		[
			313,
			313
		],
		"mapped",
		[
			314
		]
	],
	[
		[
			314,
			314
		],
		"valid"
	],
	[
		[
			315,
			315
		],
		"mapped",
		[
			316
		]
	],
	[
		[
			316,
			316
		],
		"valid"
	],
	[
		[
			317,
			317
		],
		"mapped",
		[
			318
		]
	],
	[
		[
			318,
			318
		],
		"valid"
	],
	[
		[
			319,
			320
		],
		"mapped",
		[
			108,
			183
		]
	],
	[
		[
			321,
			321
		],
		"mapped",
		[
			322
		]
	],
	[
		[
			322,
			322
		],
		"valid"
	],
	[
		[
			323,
			323
		],
		"mapped",
		[
			324
		]
	],
	[
		[
			324,
			324
		],
		"valid"
	],
	[
		[
			325,
			325
		],
		"mapped",
		[
			326
		]
	],
	[
		[
			326,
			326
		],
		"valid"
	],
	[
		[
			327,
			327
		],
		"mapped",
		[
			328
		]
	],
	[
		[
			328,
			328
		],
		"valid"
	],
	[
		[
			329,
			329
		],
		"mapped",
		[
			700,
			110
		]
	],
	[
		[
			330,
			330
		],
		"mapped",
		[
			331
		]
	],
	[
		[
			331,
			331
		],
		"valid"
	],
	[
		[
			332,
			332
		],
		"mapped",
		[
			333
		]
	],
	[
		[
			333,
			333
		],
		"valid"
	],
	[
		[
			334,
			334
		],
		"mapped",
		[
			335
		]
	],
	[
		[
			335,
			335
		],
		"valid"
	],
	[
		[
			336,
			336
		],
		"mapped",
		[
			337
		]
	],
	[
		[
			337,
			337
		],
		"valid"
	],
	[
		[
			338,
			338
		],
		"mapped",
		[
			339
		]
	],
	[
		[
			339,
			339
		],
		"valid"
	],
	[
		[
			340,
			340
		],
		"mapped",
		[
			341
		]
	],
	[
		[
			341,
			341
		],
		"valid"
	],
	[
		[
			342,
			342
		],
		"mapped",
		[
			343
		]
	],
	[
		[
			343,
			343
		],
		"valid"
	],
	[
		[
			344,
			344
		],
		"mapped",
		[
			345
		]
	],
	[
		[
			345,
			345
		],
		"valid"
	],
	[
		[
			346,
			346
		],
		"mapped",
		[
			347
		]
	],
	[
		[
			347,
			347
		],
		"valid"
	],
	[
		[
			348,
			348
		],
		"mapped",
		[
			349
		]
	],
	[
		[
			349,
			349
		],
		"valid"
	],
	[
		[
			350,
			350
		],
		"mapped",
		[
			351
		]
	],
	[
		[
			351,
			351
		],
		"valid"
	],
	[
		[
			352,
			352
		],
		"mapped",
		[
			353
		]
	],
	[
		[
			353,
			353
		],
		"valid"
	],
	[
		[
			354,
			354
		],
		"mapped",
		[
			355
		]
	],
	[
		[
			355,
			355
		],
		"valid"
	],
	[
		[
			356,
			356
		],
		"mapped",
		[
			357
		]
	],
	[
		[
			357,
			357
		],
		"valid"
	],
	[
		[
			358,
			358
		],
		"mapped",
		[
			359
		]
	],
	[
		[
			359,
			359
		],
		"valid"
	],
	[
		[
			360,
			360
		],
		"mapped",
		[
			361
		]
	],
	[
		[
			361,
			361
		],
		"valid"
	],
	[
		[
			362,
			362
		],
		"mapped",
		[
			363
		]
	],
	[
		[
			363,
			363
		],
		"valid"
	],
	[
		[
			364,
			364
		],
		"mapped",
		[
			365
		]
	],
	[
		[
			365,
			365
		],
		"valid"
	],
	[
		[
			366,
			366
		],
		"mapped",
		[
			367
		]
	],
	[
		[
			367,
			367
		],
		"valid"
	],
	[
		[
			368,
			368
		],
		"mapped",
		[
			369
		]
	],
	[
		[
			369,
			369
		],
		"valid"
	],
	[
		[
			370,
			370
		],
		"mapped",
		[
			371
		]
	],
	[
		[
			371,
			371
		],
		"valid"
	],
	[
		[
			372,
			372
		],
		"mapped",
		[
			373
		]
	],
	[
		[
			373,
			373
		],
		"valid"
	],
	[
		[
			374,
			374
		],
		"mapped",
		[
			375
		]
	],
	[
		[
			375,
			375
		],
		"valid"
	],
	[
		[
			376,
			376
		],
		"mapped",
		[
			255
		]
	],
	[
		[
			377,
			377
		],
		"mapped",
		[
			378
		]
	],
	[
		[
			378,
			378
		],
		"valid"
	],
	[
		[
			379,
			379
		],
		"mapped",
		[
			380
		]
	],
	[
		[
			380,
			380
		],
		"valid"
	],
	[
		[
			381,
			381
		],
		"mapped",
		[
			382
		]
	],
	[
		[
			382,
			382
		],
		"valid"
	],
	[
		[
			383,
			383
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			384,
			384
		],
		"valid"
	],
	[
		[
			385,
			385
		],
		"mapped",
		[
			595
		]
	],
	[
		[
			386,
			386
		],
		"mapped",
		[
			387
		]
	],
	[
		[
			387,
			387
		],
		"valid"
	],
	[
		[
			388,
			388
		],
		"mapped",
		[
			389
		]
	],
	[
		[
			389,
			389
		],
		"valid"
	],
	[
		[
			390,
			390
		],
		"mapped",
		[
			596
		]
	],
	[
		[
			391,
			391
		],
		"mapped",
		[
			392
		]
	],
	[
		[
			392,
			392
		],
		"valid"
	],
	[
		[
			393,
			393
		],
		"mapped",
		[
			598
		]
	],
	[
		[
			394,
			394
		],
		"mapped",
		[
			599
		]
	],
	[
		[
			395,
			395
		],
		"mapped",
		[
			396
		]
	],
	[
		[
			396,
			397
		],
		"valid"
	],
	[
		[
			398,
			398
		],
		"mapped",
		[
			477
		]
	],
	[
		[
			399,
			399
		],
		"mapped",
		[
			601
		]
	],
	[
		[
			400,
			400
		],
		"mapped",
		[
			603
		]
	],
	[
		[
			401,
			401
		],
		"mapped",
		[
			402
		]
	],
	[
		[
			402,
			402
		],
		"valid"
	],
	[
		[
			403,
			403
		],
		"mapped",
		[
			608
		]
	],
	[
		[
			404,
			404
		],
		"mapped",
		[
			611
		]
	],
	[
		[
			405,
			405
		],
		"valid"
	],
	[
		[
			406,
			406
		],
		"mapped",
		[
			617
		]
	],
	[
		[
			407,
			407
		],
		"mapped",
		[
			616
		]
	],
	[
		[
			408,
			408
		],
		"mapped",
		[
			409
		]
	],
	[
		[
			409,
			411
		],
		"valid"
	],
	[
		[
			412,
			412
		],
		"mapped",
		[
			623
		]
	],
	[
		[
			413,
			413
		],
		"mapped",
		[
			626
		]
	],
	[
		[
			414,
			414
		],
		"valid"
	],
	[
		[
			415,
			415
		],
		"mapped",
		[
			629
		]
	],
	[
		[
			416,
			416
		],
		"mapped",
		[
			417
		]
	],
	[
		[
			417,
			417
		],
		"valid"
	],
	[
		[
			418,
			418
		],
		"mapped",
		[
			419
		]
	],
	[
		[
			419,
			419
		],
		"valid"
	],
	[
		[
			420,
			420
		],
		"mapped",
		[
			421
		]
	],
	[
		[
			421,
			421
		],
		"valid"
	],
	[
		[
			422,
			422
		],
		"mapped",
		[
			640
		]
	],
	[
		[
			423,
			423
		],
		"mapped",
		[
			424
		]
	],
	[
		[
			424,
			424
		],
		"valid"
	],
	[
		[
			425,
			425
		],
		"mapped",
		[
			643
		]
	],
	[
		[
			426,
			427
		],
		"valid"
	],
	[
		[
			428,
			428
		],
		"mapped",
		[
			429
		]
	],
	[
		[
			429,
			429
		],
		"valid"
	],
	[
		[
			430,
			430
		],
		"mapped",
		[
			648
		]
	],
	[
		[
			431,
			431
		],
		"mapped",
		[
			432
		]
	],
	[
		[
			432,
			432
		],
		"valid"
	],
	[
		[
			433,
			433
		],
		"mapped",
		[
			650
		]
	],
	[
		[
			434,
			434
		],
		"mapped",
		[
			651
		]
	],
	[
		[
			435,
			435
		],
		"mapped",
		[
			436
		]
	],
	[
		[
			436,
			436
		],
		"valid"
	],
	[
		[
			437,
			437
		],
		"mapped",
		[
			438
		]
	],
	[
		[
			438,
			438
		],
		"valid"
	],
	[
		[
			439,
			439
		],
		"mapped",
		[
			658
		]
	],
	[
		[
			440,
			440
		],
		"mapped",
		[
			441
		]
	],
	[
		[
			441,
			443
		],
		"valid"
	],
	[
		[
			444,
			444
		],
		"mapped",
		[
			445
		]
	],
	[
		[
			445,
			451
		],
		"valid"
	],
	[
		[
			452,
			454
		],
		"mapped",
		[
			100,
			382
		]
	],
	[
		[
			455,
			457
		],
		"mapped",
		[
			108,
			106
		]
	],
	[
		[
			458,
			460
		],
		"mapped",
		[
			110,
			106
		]
	],
	[
		[
			461,
			461
		],
		"mapped",
		[
			462
		]
	],
	[
		[
			462,
			462
		],
		"valid"
	],
	[
		[
			463,
			463
		],
		"mapped",
		[
			464
		]
	],
	[
		[
			464,
			464
		],
		"valid"
	],
	[
		[
			465,
			465
		],
		"mapped",
		[
			466
		]
	],
	[
		[
			466,
			466
		],
		"valid"
	],
	[
		[
			467,
			467
		],
		"mapped",
		[
			468
		]
	],
	[
		[
			468,
			468
		],
		"valid"
	],
	[
		[
			469,
			469
		],
		"mapped",
		[
			470
		]
	],
	[
		[
			470,
			470
		],
		"valid"
	],
	[
		[
			471,
			471
		],
		"mapped",
		[
			472
		]
	],
	[
		[
			472,
			472
		],
		"valid"
	],
	[
		[
			473,
			473
		],
		"mapped",
		[
			474
		]
	],
	[
		[
			474,
			474
		],
		"valid"
	],
	[
		[
			475,
			475
		],
		"mapped",
		[
			476
		]
	],
	[
		[
			476,
			477
		],
		"valid"
	],
	[
		[
			478,
			478
		],
		"mapped",
		[
			479
		]
	],
	[
		[
			479,
			479
		],
		"valid"
	],
	[
		[
			480,
			480
		],
		"mapped",
		[
			481
		]
	],
	[
		[
			481,
			481
		],
		"valid"
	],
	[
		[
			482,
			482
		],
		"mapped",
		[
			483
		]
	],
	[
		[
			483,
			483
		],
		"valid"
	],
	[
		[
			484,
			484
		],
		"mapped",
		[
			485
		]
	],
	[
		[
			485,
			485
		],
		"valid"
	],
	[
		[
			486,
			486
		],
		"mapped",
		[
			487
		]
	],
	[
		[
			487,
			487
		],
		"valid"
	],
	[
		[
			488,
			488
		],
		"mapped",
		[
			489
		]
	],
	[
		[
			489,
			489
		],
		"valid"
	],
	[
		[
			490,
			490
		],
		"mapped",
		[
			491
		]
	],
	[
		[
			491,
			491
		],
		"valid"
	],
	[
		[
			492,
			492
		],
		"mapped",
		[
			493
		]
	],
	[
		[
			493,
			493
		],
		"valid"
	],
	[
		[
			494,
			494
		],
		"mapped",
		[
			495
		]
	],
	[
		[
			495,
			496
		],
		"valid"
	],
	[
		[
			497,
			499
		],
		"mapped",
		[
			100,
			122
		]
	],
	[
		[
			500,
			500
		],
		"mapped",
		[
			501
		]
	],
	[
		[
			501,
			501
		],
		"valid"
	],
	[
		[
			502,
			502
		],
		"mapped",
		[
			405
		]
	],
	[
		[
			503,
			503
		],
		"mapped",
		[
			447
		]
	],
	[
		[
			504,
			504
		],
		"mapped",
		[
			505
		]
	],
	[
		[
			505,
			505
		],
		"valid"
	],
	[
		[
			506,
			506
		],
		"mapped",
		[
			507
		]
	],
	[
		[
			507,
			507
		],
		"valid"
	],
	[
		[
			508,
			508
		],
		"mapped",
		[
			509
		]
	],
	[
		[
			509,
			509
		],
		"valid"
	],
	[
		[
			510,
			510
		],
		"mapped",
		[
			511
		]
	],
	[
		[
			511,
			511
		],
		"valid"
	],
	[
		[
			512,
			512
		],
		"mapped",
		[
			513
		]
	],
	[
		[
			513,
			513
		],
		"valid"
	],
	[
		[
			514,
			514
		],
		"mapped",
		[
			515
		]
	],
	[
		[
			515,
			515
		],
		"valid"
	],
	[
		[
			516,
			516
		],
		"mapped",
		[
			517
		]
	],
	[
		[
			517,
			517
		],
		"valid"
	],
	[
		[
			518,
			518
		],
		"mapped",
		[
			519
		]
	],
	[
		[
			519,
			519
		],
		"valid"
	],
	[
		[
			520,
			520
		],
		"mapped",
		[
			521
		]
	],
	[
		[
			521,
			521
		],
		"valid"
	],
	[
		[
			522,
			522
		],
		"mapped",
		[
			523
		]
	],
	[
		[
			523,
			523
		],
		"valid"
	],
	[
		[
			524,
			524
		],
		"mapped",
		[
			525
		]
	],
	[
		[
			525,
			525
		],
		"valid"
	],
	[
		[
			526,
			526
		],
		"mapped",
		[
			527
		]
	],
	[
		[
			527,
			527
		],
		"valid"
	],
	[
		[
			528,
			528
		],
		"mapped",
		[
			529
		]
	],
	[
		[
			529,
			529
		],
		"valid"
	],
	[
		[
			530,
			530
		],
		"mapped",
		[
			531
		]
	],
	[
		[
			531,
			531
		],
		"valid"
	],
	[
		[
			532,
			532
		],
		"mapped",
		[
			533
		]
	],
	[
		[
			533,
			533
		],
		"valid"
	],
	[
		[
			534,
			534
		],
		"mapped",
		[
			535
		]
	],
	[
		[
			535,
			535
		],
		"valid"
	],
	[
		[
			536,
			536
		],
		"mapped",
		[
			537
		]
	],
	[
		[
			537,
			537
		],
		"valid"
	],
	[
		[
			538,
			538
		],
		"mapped",
		[
			539
		]
	],
	[
		[
			539,
			539
		],
		"valid"
	],
	[
		[
			540,
			540
		],
		"mapped",
		[
			541
		]
	],
	[
		[
			541,
			541
		],
		"valid"
	],
	[
		[
			542,
			542
		],
		"mapped",
		[
			543
		]
	],
	[
		[
			543,
			543
		],
		"valid"
	],
	[
		[
			544,
			544
		],
		"mapped",
		[
			414
		]
	],
	[
		[
			545,
			545
		],
		"valid"
	],
	[
		[
			546,
			546
		],
		"mapped",
		[
			547
		]
	],
	[
		[
			547,
			547
		],
		"valid"
	],
	[
		[
			548,
			548
		],
		"mapped",
		[
			549
		]
	],
	[
		[
			549,
			549
		],
		"valid"
	],
	[
		[
			550,
			550
		],
		"mapped",
		[
			551
		]
	],
	[
		[
			551,
			551
		],
		"valid"
	],
	[
		[
			552,
			552
		],
		"mapped",
		[
			553
		]
	],
	[
		[
			553,
			553
		],
		"valid"
	],
	[
		[
			554,
			554
		],
		"mapped",
		[
			555
		]
	],
	[
		[
			555,
			555
		],
		"valid"
	],
	[
		[
			556,
			556
		],
		"mapped",
		[
			557
		]
	],
	[
		[
			557,
			557
		],
		"valid"
	],
	[
		[
			558,
			558
		],
		"mapped",
		[
			559
		]
	],
	[
		[
			559,
			559
		],
		"valid"
	],
	[
		[
			560,
			560
		],
		"mapped",
		[
			561
		]
	],
	[
		[
			561,
			561
		],
		"valid"
	],
	[
		[
			562,
			562
		],
		"mapped",
		[
			563
		]
	],
	[
		[
			563,
			563
		],
		"valid"
	],
	[
		[
			564,
			566
		],
		"valid"
	],
	[
		[
			567,
			569
		],
		"valid"
	],
	[
		[
			570,
			570
		],
		"mapped",
		[
			11365
		]
	],
	[
		[
			571,
			571
		],
		"mapped",
		[
			572
		]
	],
	[
		[
			572,
			572
		],
		"valid"
	],
	[
		[
			573,
			573
		],
		"mapped",
		[
			410
		]
	],
	[
		[
			574,
			574
		],
		"mapped",
		[
			11366
		]
	],
	[
		[
			575,
			576
		],
		"valid"
	],
	[
		[
			577,
			577
		],
		"mapped",
		[
			578
		]
	],
	[
		[
			578,
			578
		],
		"valid"
	],
	[
		[
			579,
			579
		],
		"mapped",
		[
			384
		]
	],
	[
		[
			580,
			580
		],
		"mapped",
		[
			649
		]
	],
	[
		[
			581,
			581
		],
		"mapped",
		[
			652
		]
	],
	[
		[
			582,
			582
		],
		"mapped",
		[
			583
		]
	],
	[
		[
			583,
			583
		],
		"valid"
	],
	[
		[
			584,
			584
		],
		"mapped",
		[
			585
		]
	],
	[
		[
			585,
			585
		],
		"valid"
	],
	[
		[
			586,
			586
		],
		"mapped",
		[
			587
		]
	],
	[
		[
			587,
			587
		],
		"valid"
	],
	[
		[
			588,
			588
		],
		"mapped",
		[
			589
		]
	],
	[
		[
			589,
			589
		],
		"valid"
	],
	[
		[
			590,
			590
		],
		"mapped",
		[
			591
		]
	],
	[
		[
			591,
			591
		],
		"valid"
	],
	[
		[
			592,
			680
		],
		"valid"
	],
	[
		[
			681,
			685
		],
		"valid"
	],
	[
		[
			686,
			687
		],
		"valid"
	],
	[
		[
			688,
			688
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			689,
			689
		],
		"mapped",
		[
			614
		]
	],
	[
		[
			690,
			690
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			691,
			691
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			692,
			692
		],
		"mapped",
		[
			633
		]
	],
	[
		[
			693,
			693
		],
		"mapped",
		[
			635
		]
	],
	[
		[
			694,
			694
		],
		"mapped",
		[
			641
		]
	],
	[
		[
			695,
			695
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			696,
			696
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			697,
			705
		],
		"valid"
	],
	[
		[
			706,
			709
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			710,
			721
		],
		"valid"
	],
	[
		[
			722,
			727
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			728,
			728
		],
		"disallowed_STD3_mapped",
		[
			32,
			774
		]
	],
	[
		[
			729,
			729
		],
		"disallowed_STD3_mapped",
		[
			32,
			775
		]
	],
	[
		[
			730,
			730
		],
		"disallowed_STD3_mapped",
		[
			32,
			778
		]
	],
	[
		[
			731,
			731
		],
		"disallowed_STD3_mapped",
		[
			32,
			808
		]
	],
	[
		[
			732,
			732
		],
		"disallowed_STD3_mapped",
		[
			32,
			771
		]
	],
	[
		[
			733,
			733
		],
		"disallowed_STD3_mapped",
		[
			32,
			779
		]
	],
	[
		[
			734,
			734
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			735,
			735
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			736,
			736
		],
		"mapped",
		[
			611
		]
	],
	[
		[
			737,
			737
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			738,
			738
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			739,
			739
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			740,
			740
		],
		"mapped",
		[
			661
		]
	],
	[
		[
			741,
			745
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			746,
			747
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			748,
			748
		],
		"valid"
	],
	[
		[
			749,
			749
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			750,
			750
		],
		"valid"
	],
	[
		[
			751,
			767
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			768,
			831
		],
		"valid"
	],
	[
		[
			832,
			832
		],
		"mapped",
		[
			768
		]
	],
	[
		[
			833,
			833
		],
		"mapped",
		[
			769
		]
	],
	[
		[
			834,
			834
		],
		"valid"
	],
	[
		[
			835,
			835
		],
		"mapped",
		[
			787
		]
	],
	[
		[
			836,
			836
		],
		"mapped",
		[
			776,
			769
		]
	],
	[
		[
			837,
			837
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			838,
			846
		],
		"valid"
	],
	[
		[
			847,
			847
		],
		"ignored"
	],
	[
		[
			848,
			855
		],
		"valid"
	],
	[
		[
			856,
			860
		],
		"valid"
	],
	[
		[
			861,
			863
		],
		"valid"
	],
	[
		[
			864,
			865
		],
		"valid"
	],
	[
		[
			866,
			866
		],
		"valid"
	],
	[
		[
			867,
			879
		],
		"valid"
	],
	[
		[
			880,
			880
		],
		"mapped",
		[
			881
		]
	],
	[
		[
			881,
			881
		],
		"valid"
	],
	[
		[
			882,
			882
		],
		"mapped",
		[
			883
		]
	],
	[
		[
			883,
			883
		],
		"valid"
	],
	[
		[
			884,
			884
		],
		"mapped",
		[
			697
		]
	],
	[
		[
			885,
			885
		],
		"valid"
	],
	[
		[
			886,
			886
		],
		"mapped",
		[
			887
		]
	],
	[
		[
			887,
			887
		],
		"valid"
	],
	[
		[
			888,
			889
		],
		"disallowed"
	],
	[
		[
			890,
			890
		],
		"disallowed_STD3_mapped",
		[
			32,
			953
		]
	],
	[
		[
			891,
			893
		],
		"valid"
	],
	[
		[
			894,
			894
		],
		"disallowed_STD3_mapped",
		[
			59
		]
	],
	[
		[
			895,
			895
		],
		"mapped",
		[
			1011
		]
	],
	[
		[
			896,
			899
		],
		"disallowed"
	],
	[
		[
			900,
			900
		],
		"disallowed_STD3_mapped",
		[
			32,
			769
		]
	],
	[
		[
			901,
			901
		],
		"disallowed_STD3_mapped",
		[
			32,
			776,
			769
		]
	],
	[
		[
			902,
			902
		],
		"mapped",
		[
			940
		]
	],
	[
		[
			903,
			903
		],
		"mapped",
		[
			183
		]
	],
	[
		[
			904,
			904
		],
		"mapped",
		[
			941
		]
	],
	[
		[
			905,
			905
		],
		"mapped",
		[
			942
		]
	],
	[
		[
			906,
			906
		],
		"mapped",
		[
			943
		]
	],
	[
		[
			907,
			907
		],
		"disallowed"
	],
	[
		[
			908,
			908
		],
		"mapped",
		[
			972
		]
	],
	[
		[
			909,
			909
		],
		"disallowed"
	],
	[
		[
			910,
			910
		],
		"mapped",
		[
			973
		]
	],
	[
		[
			911,
			911
		],
		"mapped",
		[
			974
		]
	],
	[
		[
			912,
			912
		],
		"valid"
	],
	[
		[
			913,
			913
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			914,
			914
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			915,
			915
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			916,
			916
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			917,
			917
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			918,
			918
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			919,
			919
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			920,
			920
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			921,
			921
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			922,
			922
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			923,
			923
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			924,
			924
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			925,
			925
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			926,
			926
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			927,
			927
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			928,
			928
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			929,
			929
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			930,
			930
		],
		"disallowed"
	],
	[
		[
			931,
			931
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			932,
			932
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			933,
			933
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			934,
			934
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			935,
			935
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			936,
			936
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			937,
			937
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			938,
			938
		],
		"mapped",
		[
			970
		]
	],
	[
		[
			939,
			939
		],
		"mapped",
		[
			971
		]
	],
	[
		[
			940,
			961
		],
		"valid"
	],
	[
		[
			962,
			962
		],
		"deviation",
		[
			963
		]
	],
	[
		[
			963,
			974
		],
		"valid"
	],
	[
		[
			975,
			975
		],
		"mapped",
		[
			983
		]
	],
	[
		[
			976,
			976
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			977,
			977
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			978,
			978
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			979,
			979
		],
		"mapped",
		[
			973
		]
	],
	[
		[
			980,
			980
		],
		"mapped",
		[
			971
		]
	],
	[
		[
			981,
			981
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			982,
			982
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			983,
			983
		],
		"valid"
	],
	[
		[
			984,
			984
		],
		"mapped",
		[
			985
		]
	],
	[
		[
			985,
			985
		],
		"valid"
	],
	[
		[
			986,
			986
		],
		"mapped",
		[
			987
		]
	],
	[
		[
			987,
			987
		],
		"valid"
	],
	[
		[
			988,
			988
		],
		"mapped",
		[
			989
		]
	],
	[
		[
			989,
			989
		],
		"valid"
	],
	[
		[
			990,
			990
		],
		"mapped",
		[
			991
		]
	],
	[
		[
			991,
			991
		],
		"valid"
	],
	[
		[
			992,
			992
		],
		"mapped",
		[
			993
		]
	],
	[
		[
			993,
			993
		],
		"valid"
	],
	[
		[
			994,
			994
		],
		"mapped",
		[
			995
		]
	],
	[
		[
			995,
			995
		],
		"valid"
	],
	[
		[
			996,
			996
		],
		"mapped",
		[
			997
		]
	],
	[
		[
			997,
			997
		],
		"valid"
	],
	[
		[
			998,
			998
		],
		"mapped",
		[
			999
		]
	],
	[
		[
			999,
			999
		],
		"valid"
	],
	[
		[
			1000,
			1000
		],
		"mapped",
		[
			1001
		]
	],
	[
		[
			1001,
			1001
		],
		"valid"
	],
	[
		[
			1002,
			1002
		],
		"mapped",
		[
			1003
		]
	],
	[
		[
			1003,
			1003
		],
		"valid"
	],
	[
		[
			1004,
			1004
		],
		"mapped",
		[
			1005
		]
	],
	[
		[
			1005,
			1005
		],
		"valid"
	],
	[
		[
			1006,
			1006
		],
		"mapped",
		[
			1007
		]
	],
	[
		[
			1007,
			1007
		],
		"valid"
	],
	[
		[
			1008,
			1008
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			1009,
			1009
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			1010,
			1010
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			1011,
			1011
		],
		"valid"
	],
	[
		[
			1012,
			1012
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			1013,
			1013
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			1014,
			1014
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1015,
			1015
		],
		"mapped",
		[
			1016
		]
	],
	[
		[
			1016,
			1016
		],
		"valid"
	],
	[
		[
			1017,
			1017
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			1018,
			1018
		],
		"mapped",
		[
			1019
		]
	],
	[
		[
			1019,
			1019
		],
		"valid"
	],
	[
		[
			1020,
			1020
		],
		"valid"
	],
	[
		[
			1021,
			1021
		],
		"mapped",
		[
			891
		]
	],
	[
		[
			1022,
			1022
		],
		"mapped",
		[
			892
		]
	],
	[
		[
			1023,
			1023
		],
		"mapped",
		[
			893
		]
	],
	[
		[
			1024,
			1024
		],
		"mapped",
		[
			1104
		]
	],
	[
		[
			1025,
			1025
		],
		"mapped",
		[
			1105
		]
	],
	[
		[
			1026,
			1026
		],
		"mapped",
		[
			1106
		]
	],
	[
		[
			1027,
			1027
		],
		"mapped",
		[
			1107
		]
	],
	[
		[
			1028,
			1028
		],
		"mapped",
		[
			1108
		]
	],
	[
		[
			1029,
			1029
		],
		"mapped",
		[
			1109
		]
	],
	[
		[
			1030,
			1030
		],
		"mapped",
		[
			1110
		]
	],
	[
		[
			1031,
			1031
		],
		"mapped",
		[
			1111
		]
	],
	[
		[
			1032,
			1032
		],
		"mapped",
		[
			1112
		]
	],
	[
		[
			1033,
			1033
		],
		"mapped",
		[
			1113
		]
	],
	[
		[
			1034,
			1034
		],
		"mapped",
		[
			1114
		]
	],
	[
		[
			1035,
			1035
		],
		"mapped",
		[
			1115
		]
	],
	[
		[
			1036,
			1036
		],
		"mapped",
		[
			1116
		]
	],
	[
		[
			1037,
			1037
		],
		"mapped",
		[
			1117
		]
	],
	[
		[
			1038,
			1038
		],
		"mapped",
		[
			1118
		]
	],
	[
		[
			1039,
			1039
		],
		"mapped",
		[
			1119
		]
	],
	[
		[
			1040,
			1040
		],
		"mapped",
		[
			1072
		]
	],
	[
		[
			1041,
			1041
		],
		"mapped",
		[
			1073
		]
	],
	[
		[
			1042,
			1042
		],
		"mapped",
		[
			1074
		]
	],
	[
		[
			1043,
			1043
		],
		"mapped",
		[
			1075
		]
	],
	[
		[
			1044,
			1044
		],
		"mapped",
		[
			1076
		]
	],
	[
		[
			1045,
			1045
		],
		"mapped",
		[
			1077
		]
	],
	[
		[
			1046,
			1046
		],
		"mapped",
		[
			1078
		]
	],
	[
		[
			1047,
			1047
		],
		"mapped",
		[
			1079
		]
	],
	[
		[
			1048,
			1048
		],
		"mapped",
		[
			1080
		]
	],
	[
		[
			1049,
			1049
		],
		"mapped",
		[
			1081
		]
	],
	[
		[
			1050,
			1050
		],
		"mapped",
		[
			1082
		]
	],
	[
		[
			1051,
			1051
		],
		"mapped",
		[
			1083
		]
	],
	[
		[
			1052,
			1052
		],
		"mapped",
		[
			1084
		]
	],
	[
		[
			1053,
			1053
		],
		"mapped",
		[
			1085
		]
	],
	[
		[
			1054,
			1054
		],
		"mapped",
		[
			1086
		]
	],
	[
		[
			1055,
			1055
		],
		"mapped",
		[
			1087
		]
	],
	[
		[
			1056,
			1056
		],
		"mapped",
		[
			1088
		]
	],
	[
		[
			1057,
			1057
		],
		"mapped",
		[
			1089
		]
	],
	[
		[
			1058,
			1058
		],
		"mapped",
		[
			1090
		]
	],
	[
		[
			1059,
			1059
		],
		"mapped",
		[
			1091
		]
	],
	[
		[
			1060,
			1060
		],
		"mapped",
		[
			1092
		]
	],
	[
		[
			1061,
			1061
		],
		"mapped",
		[
			1093
		]
	],
	[
		[
			1062,
			1062
		],
		"mapped",
		[
			1094
		]
	],
	[
		[
			1063,
			1063
		],
		"mapped",
		[
			1095
		]
	],
	[
		[
			1064,
			1064
		],
		"mapped",
		[
			1096
		]
	],
	[
		[
			1065,
			1065
		],
		"mapped",
		[
			1097
		]
	],
	[
		[
			1066,
			1066
		],
		"mapped",
		[
			1098
		]
	],
	[
		[
			1067,
			1067
		],
		"mapped",
		[
			1099
		]
	],
	[
		[
			1068,
			1068
		],
		"mapped",
		[
			1100
		]
	],
	[
		[
			1069,
			1069
		],
		"mapped",
		[
			1101
		]
	],
	[
		[
			1070,
			1070
		],
		"mapped",
		[
			1102
		]
	],
	[
		[
			1071,
			1071
		],
		"mapped",
		[
			1103
		]
	],
	[
		[
			1072,
			1103
		],
		"valid"
	],
	[
		[
			1104,
			1104
		],
		"valid"
	],
	[
		[
			1105,
			1116
		],
		"valid"
	],
	[
		[
			1117,
			1117
		],
		"valid"
	],
	[
		[
			1118,
			1119
		],
		"valid"
	],
	[
		[
			1120,
			1120
		],
		"mapped",
		[
			1121
		]
	],
	[
		[
			1121,
			1121
		],
		"valid"
	],
	[
		[
			1122,
			1122
		],
		"mapped",
		[
			1123
		]
	],
	[
		[
			1123,
			1123
		],
		"valid"
	],
	[
		[
			1124,
			1124
		],
		"mapped",
		[
			1125
		]
	],
	[
		[
			1125,
			1125
		],
		"valid"
	],
	[
		[
			1126,
			1126
		],
		"mapped",
		[
			1127
		]
	],
	[
		[
			1127,
			1127
		],
		"valid"
	],
	[
		[
			1128,
			1128
		],
		"mapped",
		[
			1129
		]
	],
	[
		[
			1129,
			1129
		],
		"valid"
	],
	[
		[
			1130,
			1130
		],
		"mapped",
		[
			1131
		]
	],
	[
		[
			1131,
			1131
		],
		"valid"
	],
	[
		[
			1132,
			1132
		],
		"mapped",
		[
			1133
		]
	],
	[
		[
			1133,
			1133
		],
		"valid"
	],
	[
		[
			1134,
			1134
		],
		"mapped",
		[
			1135
		]
	],
	[
		[
			1135,
			1135
		],
		"valid"
	],
	[
		[
			1136,
			1136
		],
		"mapped",
		[
			1137
		]
	],
	[
		[
			1137,
			1137
		],
		"valid"
	],
	[
		[
			1138,
			1138
		],
		"mapped",
		[
			1139
		]
	],
	[
		[
			1139,
			1139
		],
		"valid"
	],
	[
		[
			1140,
			1140
		],
		"mapped",
		[
			1141
		]
	],
	[
		[
			1141,
			1141
		],
		"valid"
	],
	[
		[
			1142,
			1142
		],
		"mapped",
		[
			1143
		]
	],
	[
		[
			1143,
			1143
		],
		"valid"
	],
	[
		[
			1144,
			1144
		],
		"mapped",
		[
			1145
		]
	],
	[
		[
			1145,
			1145
		],
		"valid"
	],
	[
		[
			1146,
			1146
		],
		"mapped",
		[
			1147
		]
	],
	[
		[
			1147,
			1147
		],
		"valid"
	],
	[
		[
			1148,
			1148
		],
		"mapped",
		[
			1149
		]
	],
	[
		[
			1149,
			1149
		],
		"valid"
	],
	[
		[
			1150,
			1150
		],
		"mapped",
		[
			1151
		]
	],
	[
		[
			1151,
			1151
		],
		"valid"
	],
	[
		[
			1152,
			1152
		],
		"mapped",
		[
			1153
		]
	],
	[
		[
			1153,
			1153
		],
		"valid"
	],
	[
		[
			1154,
			1154
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1155,
			1158
		],
		"valid"
	],
	[
		[
			1159,
			1159
		],
		"valid"
	],
	[
		[
			1160,
			1161
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1162,
			1162
		],
		"mapped",
		[
			1163
		]
	],
	[
		[
			1163,
			1163
		],
		"valid"
	],
	[
		[
			1164,
			1164
		],
		"mapped",
		[
			1165
		]
	],
	[
		[
			1165,
			1165
		],
		"valid"
	],
	[
		[
			1166,
			1166
		],
		"mapped",
		[
			1167
		]
	],
	[
		[
			1167,
			1167
		],
		"valid"
	],
	[
		[
			1168,
			1168
		],
		"mapped",
		[
			1169
		]
	],
	[
		[
			1169,
			1169
		],
		"valid"
	],
	[
		[
			1170,
			1170
		],
		"mapped",
		[
			1171
		]
	],
	[
		[
			1171,
			1171
		],
		"valid"
	],
	[
		[
			1172,
			1172
		],
		"mapped",
		[
			1173
		]
	],
	[
		[
			1173,
			1173
		],
		"valid"
	],
	[
		[
			1174,
			1174
		],
		"mapped",
		[
			1175
		]
	],
	[
		[
			1175,
			1175
		],
		"valid"
	],
	[
		[
			1176,
			1176
		],
		"mapped",
		[
			1177
		]
	],
	[
		[
			1177,
			1177
		],
		"valid"
	],
	[
		[
			1178,
			1178
		],
		"mapped",
		[
			1179
		]
	],
	[
		[
			1179,
			1179
		],
		"valid"
	],
	[
		[
			1180,
			1180
		],
		"mapped",
		[
			1181
		]
	],
	[
		[
			1181,
			1181
		],
		"valid"
	],
	[
		[
			1182,
			1182
		],
		"mapped",
		[
			1183
		]
	],
	[
		[
			1183,
			1183
		],
		"valid"
	],
	[
		[
			1184,
			1184
		],
		"mapped",
		[
			1185
		]
	],
	[
		[
			1185,
			1185
		],
		"valid"
	],
	[
		[
			1186,
			1186
		],
		"mapped",
		[
			1187
		]
	],
	[
		[
			1187,
			1187
		],
		"valid"
	],
	[
		[
			1188,
			1188
		],
		"mapped",
		[
			1189
		]
	],
	[
		[
			1189,
			1189
		],
		"valid"
	],
	[
		[
			1190,
			1190
		],
		"mapped",
		[
			1191
		]
	],
	[
		[
			1191,
			1191
		],
		"valid"
	],
	[
		[
			1192,
			1192
		],
		"mapped",
		[
			1193
		]
	],
	[
		[
			1193,
			1193
		],
		"valid"
	],
	[
		[
			1194,
			1194
		],
		"mapped",
		[
			1195
		]
	],
	[
		[
			1195,
			1195
		],
		"valid"
	],
	[
		[
			1196,
			1196
		],
		"mapped",
		[
			1197
		]
	],
	[
		[
			1197,
			1197
		],
		"valid"
	],
	[
		[
			1198,
			1198
		],
		"mapped",
		[
			1199
		]
	],
	[
		[
			1199,
			1199
		],
		"valid"
	],
	[
		[
			1200,
			1200
		],
		"mapped",
		[
			1201
		]
	],
	[
		[
			1201,
			1201
		],
		"valid"
	],
	[
		[
			1202,
			1202
		],
		"mapped",
		[
			1203
		]
	],
	[
		[
			1203,
			1203
		],
		"valid"
	],
	[
		[
			1204,
			1204
		],
		"mapped",
		[
			1205
		]
	],
	[
		[
			1205,
			1205
		],
		"valid"
	],
	[
		[
			1206,
			1206
		],
		"mapped",
		[
			1207
		]
	],
	[
		[
			1207,
			1207
		],
		"valid"
	],
	[
		[
			1208,
			1208
		],
		"mapped",
		[
			1209
		]
	],
	[
		[
			1209,
			1209
		],
		"valid"
	],
	[
		[
			1210,
			1210
		],
		"mapped",
		[
			1211
		]
	],
	[
		[
			1211,
			1211
		],
		"valid"
	],
	[
		[
			1212,
			1212
		],
		"mapped",
		[
			1213
		]
	],
	[
		[
			1213,
			1213
		],
		"valid"
	],
	[
		[
			1214,
			1214
		],
		"mapped",
		[
			1215
		]
	],
	[
		[
			1215,
			1215
		],
		"valid"
	],
	[
		[
			1216,
			1216
		],
		"disallowed"
	],
	[
		[
			1217,
			1217
		],
		"mapped",
		[
			1218
		]
	],
	[
		[
			1218,
			1218
		],
		"valid"
	],
	[
		[
			1219,
			1219
		],
		"mapped",
		[
			1220
		]
	],
	[
		[
			1220,
			1220
		],
		"valid"
	],
	[
		[
			1221,
			1221
		],
		"mapped",
		[
			1222
		]
	],
	[
		[
			1222,
			1222
		],
		"valid"
	],
	[
		[
			1223,
			1223
		],
		"mapped",
		[
			1224
		]
	],
	[
		[
			1224,
			1224
		],
		"valid"
	],
	[
		[
			1225,
			1225
		],
		"mapped",
		[
			1226
		]
	],
	[
		[
			1226,
			1226
		],
		"valid"
	],
	[
		[
			1227,
			1227
		],
		"mapped",
		[
			1228
		]
	],
	[
		[
			1228,
			1228
		],
		"valid"
	],
	[
		[
			1229,
			1229
		],
		"mapped",
		[
			1230
		]
	],
	[
		[
			1230,
			1230
		],
		"valid"
	],
	[
		[
			1231,
			1231
		],
		"valid"
	],
	[
		[
			1232,
			1232
		],
		"mapped",
		[
			1233
		]
	],
	[
		[
			1233,
			1233
		],
		"valid"
	],
	[
		[
			1234,
			1234
		],
		"mapped",
		[
			1235
		]
	],
	[
		[
			1235,
			1235
		],
		"valid"
	],
	[
		[
			1236,
			1236
		],
		"mapped",
		[
			1237
		]
	],
	[
		[
			1237,
			1237
		],
		"valid"
	],
	[
		[
			1238,
			1238
		],
		"mapped",
		[
			1239
		]
	],
	[
		[
			1239,
			1239
		],
		"valid"
	],
	[
		[
			1240,
			1240
		],
		"mapped",
		[
			1241
		]
	],
	[
		[
			1241,
			1241
		],
		"valid"
	],
	[
		[
			1242,
			1242
		],
		"mapped",
		[
			1243
		]
	],
	[
		[
			1243,
			1243
		],
		"valid"
	],
	[
		[
			1244,
			1244
		],
		"mapped",
		[
			1245
		]
	],
	[
		[
			1245,
			1245
		],
		"valid"
	],
	[
		[
			1246,
			1246
		],
		"mapped",
		[
			1247
		]
	],
	[
		[
			1247,
			1247
		],
		"valid"
	],
	[
		[
			1248,
			1248
		],
		"mapped",
		[
			1249
		]
	],
	[
		[
			1249,
			1249
		],
		"valid"
	],
	[
		[
			1250,
			1250
		],
		"mapped",
		[
			1251
		]
	],
	[
		[
			1251,
			1251
		],
		"valid"
	],
	[
		[
			1252,
			1252
		],
		"mapped",
		[
			1253
		]
	],
	[
		[
			1253,
			1253
		],
		"valid"
	],
	[
		[
			1254,
			1254
		],
		"mapped",
		[
			1255
		]
	],
	[
		[
			1255,
			1255
		],
		"valid"
	],
	[
		[
			1256,
			1256
		],
		"mapped",
		[
			1257
		]
	],
	[
		[
			1257,
			1257
		],
		"valid"
	],
	[
		[
			1258,
			1258
		],
		"mapped",
		[
			1259
		]
	],
	[
		[
			1259,
			1259
		],
		"valid"
	],
	[
		[
			1260,
			1260
		],
		"mapped",
		[
			1261
		]
	],
	[
		[
			1261,
			1261
		],
		"valid"
	],
	[
		[
			1262,
			1262
		],
		"mapped",
		[
			1263
		]
	],
	[
		[
			1263,
			1263
		],
		"valid"
	],
	[
		[
			1264,
			1264
		],
		"mapped",
		[
			1265
		]
	],
	[
		[
			1265,
			1265
		],
		"valid"
	],
	[
		[
			1266,
			1266
		],
		"mapped",
		[
			1267
		]
	],
	[
		[
			1267,
			1267
		],
		"valid"
	],
	[
		[
			1268,
			1268
		],
		"mapped",
		[
			1269
		]
	],
	[
		[
			1269,
			1269
		],
		"valid"
	],
	[
		[
			1270,
			1270
		],
		"mapped",
		[
			1271
		]
	],
	[
		[
			1271,
			1271
		],
		"valid"
	],
	[
		[
			1272,
			1272
		],
		"mapped",
		[
			1273
		]
	],
	[
		[
			1273,
			1273
		],
		"valid"
	],
	[
		[
			1274,
			1274
		],
		"mapped",
		[
			1275
		]
	],
	[
		[
			1275,
			1275
		],
		"valid"
	],
	[
		[
			1276,
			1276
		],
		"mapped",
		[
			1277
		]
	],
	[
		[
			1277,
			1277
		],
		"valid"
	],
	[
		[
			1278,
			1278
		],
		"mapped",
		[
			1279
		]
	],
	[
		[
			1279,
			1279
		],
		"valid"
	],
	[
		[
			1280,
			1280
		],
		"mapped",
		[
			1281
		]
	],
	[
		[
			1281,
			1281
		],
		"valid"
	],
	[
		[
			1282,
			1282
		],
		"mapped",
		[
			1283
		]
	],
	[
		[
			1283,
			1283
		],
		"valid"
	],
	[
		[
			1284,
			1284
		],
		"mapped",
		[
			1285
		]
	],
	[
		[
			1285,
			1285
		],
		"valid"
	],
	[
		[
			1286,
			1286
		],
		"mapped",
		[
			1287
		]
	],
	[
		[
			1287,
			1287
		],
		"valid"
	],
	[
		[
			1288,
			1288
		],
		"mapped",
		[
			1289
		]
	],
	[
		[
			1289,
			1289
		],
		"valid"
	],
	[
		[
			1290,
			1290
		],
		"mapped",
		[
			1291
		]
	],
	[
		[
			1291,
			1291
		],
		"valid"
	],
	[
		[
			1292,
			1292
		],
		"mapped",
		[
			1293
		]
	],
	[
		[
			1293,
			1293
		],
		"valid"
	],
	[
		[
			1294,
			1294
		],
		"mapped",
		[
			1295
		]
	],
	[
		[
			1295,
			1295
		],
		"valid"
	],
	[
		[
			1296,
			1296
		],
		"mapped",
		[
			1297
		]
	],
	[
		[
			1297,
			1297
		],
		"valid"
	],
	[
		[
			1298,
			1298
		],
		"mapped",
		[
			1299
		]
	],
	[
		[
			1299,
			1299
		],
		"valid"
	],
	[
		[
			1300,
			1300
		],
		"mapped",
		[
			1301
		]
	],
	[
		[
			1301,
			1301
		],
		"valid"
	],
	[
		[
			1302,
			1302
		],
		"mapped",
		[
			1303
		]
	],
	[
		[
			1303,
			1303
		],
		"valid"
	],
	[
		[
			1304,
			1304
		],
		"mapped",
		[
			1305
		]
	],
	[
		[
			1305,
			1305
		],
		"valid"
	],
	[
		[
			1306,
			1306
		],
		"mapped",
		[
			1307
		]
	],
	[
		[
			1307,
			1307
		],
		"valid"
	],
	[
		[
			1308,
			1308
		],
		"mapped",
		[
			1309
		]
	],
	[
		[
			1309,
			1309
		],
		"valid"
	],
	[
		[
			1310,
			1310
		],
		"mapped",
		[
			1311
		]
	],
	[
		[
			1311,
			1311
		],
		"valid"
	],
	[
		[
			1312,
			1312
		],
		"mapped",
		[
			1313
		]
	],
	[
		[
			1313,
			1313
		],
		"valid"
	],
	[
		[
			1314,
			1314
		],
		"mapped",
		[
			1315
		]
	],
	[
		[
			1315,
			1315
		],
		"valid"
	],
	[
		[
			1316,
			1316
		],
		"mapped",
		[
			1317
		]
	],
	[
		[
			1317,
			1317
		],
		"valid"
	],
	[
		[
			1318,
			1318
		],
		"mapped",
		[
			1319
		]
	],
	[
		[
			1319,
			1319
		],
		"valid"
	],
	[
		[
			1320,
			1320
		],
		"mapped",
		[
			1321
		]
	],
	[
		[
			1321,
			1321
		],
		"valid"
	],
	[
		[
			1322,
			1322
		],
		"mapped",
		[
			1323
		]
	],
	[
		[
			1323,
			1323
		],
		"valid"
	],
	[
		[
			1324,
			1324
		],
		"mapped",
		[
			1325
		]
	],
	[
		[
			1325,
			1325
		],
		"valid"
	],
	[
		[
			1326,
			1326
		],
		"mapped",
		[
			1327
		]
	],
	[
		[
			1327,
			1327
		],
		"valid"
	],
	[
		[
			1328,
			1328
		],
		"disallowed"
	],
	[
		[
			1329,
			1329
		],
		"mapped",
		[
			1377
		]
	],
	[
		[
			1330,
			1330
		],
		"mapped",
		[
			1378
		]
	],
	[
		[
			1331,
			1331
		],
		"mapped",
		[
			1379
		]
	],
	[
		[
			1332,
			1332
		],
		"mapped",
		[
			1380
		]
	],
	[
		[
			1333,
			1333
		],
		"mapped",
		[
			1381
		]
	],
	[
		[
			1334,
			1334
		],
		"mapped",
		[
			1382
		]
	],
	[
		[
			1335,
			1335
		],
		"mapped",
		[
			1383
		]
	],
	[
		[
			1336,
			1336
		],
		"mapped",
		[
			1384
		]
	],
	[
		[
			1337,
			1337
		],
		"mapped",
		[
			1385
		]
	],
	[
		[
			1338,
			1338
		],
		"mapped",
		[
			1386
		]
	],
	[
		[
			1339,
			1339
		],
		"mapped",
		[
			1387
		]
	],
	[
		[
			1340,
			1340
		],
		"mapped",
		[
			1388
		]
	],
	[
		[
			1341,
			1341
		],
		"mapped",
		[
			1389
		]
	],
	[
		[
			1342,
			1342
		],
		"mapped",
		[
			1390
		]
	],
	[
		[
			1343,
			1343
		],
		"mapped",
		[
			1391
		]
	],
	[
		[
			1344,
			1344
		],
		"mapped",
		[
			1392
		]
	],
	[
		[
			1345,
			1345
		],
		"mapped",
		[
			1393
		]
	],
	[
		[
			1346,
			1346
		],
		"mapped",
		[
			1394
		]
	],
	[
		[
			1347,
			1347
		],
		"mapped",
		[
			1395
		]
	],
	[
		[
			1348,
			1348
		],
		"mapped",
		[
			1396
		]
	],
	[
		[
			1349,
			1349
		],
		"mapped",
		[
			1397
		]
	],
	[
		[
			1350,
			1350
		],
		"mapped",
		[
			1398
		]
	],
	[
		[
			1351,
			1351
		],
		"mapped",
		[
			1399
		]
	],
	[
		[
			1352,
			1352
		],
		"mapped",
		[
			1400
		]
	],
	[
		[
			1353,
			1353
		],
		"mapped",
		[
			1401
		]
	],
	[
		[
			1354,
			1354
		],
		"mapped",
		[
			1402
		]
	],
	[
		[
			1355,
			1355
		],
		"mapped",
		[
			1403
		]
	],
	[
		[
			1356,
			1356
		],
		"mapped",
		[
			1404
		]
	],
	[
		[
			1357,
			1357
		],
		"mapped",
		[
			1405
		]
	],
	[
		[
			1358,
			1358
		],
		"mapped",
		[
			1406
		]
	],
	[
		[
			1359,
			1359
		],
		"mapped",
		[
			1407
		]
	],
	[
		[
			1360,
			1360
		],
		"mapped",
		[
			1408
		]
	],
	[
		[
			1361,
			1361
		],
		"mapped",
		[
			1409
		]
	],
	[
		[
			1362,
			1362
		],
		"mapped",
		[
			1410
		]
	],
	[
		[
			1363,
			1363
		],
		"mapped",
		[
			1411
		]
	],
	[
		[
			1364,
			1364
		],
		"mapped",
		[
			1412
		]
	],
	[
		[
			1365,
			1365
		],
		"mapped",
		[
			1413
		]
	],
	[
		[
			1366,
			1366
		],
		"mapped",
		[
			1414
		]
	],
	[
		[
			1367,
			1368
		],
		"disallowed"
	],
	[
		[
			1369,
			1369
		],
		"valid"
	],
	[
		[
			1370,
			1375
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1376,
			1376
		],
		"disallowed"
	],
	[
		[
			1377,
			1414
		],
		"valid"
	],
	[
		[
			1415,
			1415
		],
		"mapped",
		[
			1381,
			1410
		]
	],
	[
		[
			1416,
			1416
		],
		"disallowed"
	],
	[
		[
			1417,
			1417
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1418,
			1418
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1419,
			1420
		],
		"disallowed"
	],
	[
		[
			1421,
			1422
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1423,
			1423
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1424,
			1424
		],
		"disallowed"
	],
	[
		[
			1425,
			1441
		],
		"valid"
	],
	[
		[
			1442,
			1442
		],
		"valid"
	],
	[
		[
			1443,
			1455
		],
		"valid"
	],
	[
		[
			1456,
			1465
		],
		"valid"
	],
	[
		[
			1466,
			1466
		],
		"valid"
	],
	[
		[
			1467,
			1469
		],
		"valid"
	],
	[
		[
			1470,
			1470
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1471,
			1471
		],
		"valid"
	],
	[
		[
			1472,
			1472
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1473,
			1474
		],
		"valid"
	],
	[
		[
			1475,
			1475
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1476,
			1476
		],
		"valid"
	],
	[
		[
			1477,
			1477
		],
		"valid"
	],
	[
		[
			1478,
			1478
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1479,
			1479
		],
		"valid"
	],
	[
		[
			1480,
			1487
		],
		"disallowed"
	],
	[
		[
			1488,
			1514
		],
		"valid"
	],
	[
		[
			1515,
			1519
		],
		"disallowed"
	],
	[
		[
			1520,
			1524
		],
		"valid"
	],
	[
		[
			1525,
			1535
		],
		"disallowed"
	],
	[
		[
			1536,
			1539
		],
		"disallowed"
	],
	[
		[
			1540,
			1540
		],
		"disallowed"
	],
	[
		[
			1541,
			1541
		],
		"disallowed"
	],
	[
		[
			1542,
			1546
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1547,
			1547
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1548,
			1548
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1549,
			1551
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1552,
			1557
		],
		"valid"
	],
	[
		[
			1558,
			1562
		],
		"valid"
	],
	[
		[
			1563,
			1563
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1564,
			1564
		],
		"disallowed"
	],
	[
		[
			1565,
			1565
		],
		"disallowed"
	],
	[
		[
			1566,
			1566
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1567,
			1567
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1568,
			1568
		],
		"valid"
	],
	[
		[
			1569,
			1594
		],
		"valid"
	],
	[
		[
			1595,
			1599
		],
		"valid"
	],
	[
		[
			1600,
			1600
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1601,
			1618
		],
		"valid"
	],
	[
		[
			1619,
			1621
		],
		"valid"
	],
	[
		[
			1622,
			1624
		],
		"valid"
	],
	[
		[
			1625,
			1630
		],
		"valid"
	],
	[
		[
			1631,
			1631
		],
		"valid"
	],
	[
		[
			1632,
			1641
		],
		"valid"
	],
	[
		[
			1642,
			1645
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1646,
			1647
		],
		"valid"
	],
	[
		[
			1648,
			1652
		],
		"valid"
	],
	[
		[
			1653,
			1653
		],
		"mapped",
		[
			1575,
			1652
		]
	],
	[
		[
			1654,
			1654
		],
		"mapped",
		[
			1608,
			1652
		]
	],
	[
		[
			1655,
			1655
		],
		"mapped",
		[
			1735,
			1652
		]
	],
	[
		[
			1656,
			1656
		],
		"mapped",
		[
			1610,
			1652
		]
	],
	[
		[
			1657,
			1719
		],
		"valid"
	],
	[
		[
			1720,
			1721
		],
		"valid"
	],
	[
		[
			1722,
			1726
		],
		"valid"
	],
	[
		[
			1727,
			1727
		],
		"valid"
	],
	[
		[
			1728,
			1742
		],
		"valid"
	],
	[
		[
			1743,
			1743
		],
		"valid"
	],
	[
		[
			1744,
			1747
		],
		"valid"
	],
	[
		[
			1748,
			1748
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1749,
			1756
		],
		"valid"
	],
	[
		[
			1757,
			1757
		],
		"disallowed"
	],
	[
		[
			1758,
			1758
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1759,
			1768
		],
		"valid"
	],
	[
		[
			1769,
			1769
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1770,
			1773
		],
		"valid"
	],
	[
		[
			1774,
			1775
		],
		"valid"
	],
	[
		[
			1776,
			1785
		],
		"valid"
	],
	[
		[
			1786,
			1790
		],
		"valid"
	],
	[
		[
			1791,
			1791
		],
		"valid"
	],
	[
		[
			1792,
			1805
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			1806,
			1806
		],
		"disallowed"
	],
	[
		[
			1807,
			1807
		],
		"disallowed"
	],
	[
		[
			1808,
			1836
		],
		"valid"
	],
	[
		[
			1837,
			1839
		],
		"valid"
	],
	[
		[
			1840,
			1866
		],
		"valid"
	],
	[
		[
			1867,
			1868
		],
		"disallowed"
	],
	[
		[
			1869,
			1871
		],
		"valid"
	],
	[
		[
			1872,
			1901
		],
		"valid"
	],
	[
		[
			1902,
			1919
		],
		"valid"
	],
	[
		[
			1920,
			1968
		],
		"valid"
	],
	[
		[
			1969,
			1969
		],
		"valid"
	],
	[
		[
			1970,
			1983
		],
		"disallowed"
	],
	[
		[
			1984,
			2037
		],
		"valid"
	],
	[
		[
			2038,
			2042
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2043,
			2047
		],
		"disallowed"
	],
	[
		[
			2048,
			2093
		],
		"valid"
	],
	[
		[
			2094,
			2095
		],
		"disallowed"
	],
	[
		[
			2096,
			2110
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2111,
			2111
		],
		"disallowed"
	],
	[
		[
			2112,
			2139
		],
		"valid"
	],
	[
		[
			2140,
			2141
		],
		"disallowed"
	],
	[
		[
			2142,
			2142
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2143,
			2207
		],
		"disallowed"
	],
	[
		[
			2208,
			2208
		],
		"valid"
	],
	[
		[
			2209,
			2209
		],
		"valid"
	],
	[
		[
			2210,
			2220
		],
		"valid"
	],
	[
		[
			2221,
			2226
		],
		"valid"
	],
	[
		[
			2227,
			2228
		],
		"valid"
	],
	[
		[
			2229,
			2274
		],
		"disallowed"
	],
	[
		[
			2275,
			2275
		],
		"valid"
	],
	[
		[
			2276,
			2302
		],
		"valid"
	],
	[
		[
			2303,
			2303
		],
		"valid"
	],
	[
		[
			2304,
			2304
		],
		"valid"
	],
	[
		[
			2305,
			2307
		],
		"valid"
	],
	[
		[
			2308,
			2308
		],
		"valid"
	],
	[
		[
			2309,
			2361
		],
		"valid"
	],
	[
		[
			2362,
			2363
		],
		"valid"
	],
	[
		[
			2364,
			2381
		],
		"valid"
	],
	[
		[
			2382,
			2382
		],
		"valid"
	],
	[
		[
			2383,
			2383
		],
		"valid"
	],
	[
		[
			2384,
			2388
		],
		"valid"
	],
	[
		[
			2389,
			2389
		],
		"valid"
	],
	[
		[
			2390,
			2391
		],
		"valid"
	],
	[
		[
			2392,
			2392
		],
		"mapped",
		[
			2325,
			2364
		]
	],
	[
		[
			2393,
			2393
		],
		"mapped",
		[
			2326,
			2364
		]
	],
	[
		[
			2394,
			2394
		],
		"mapped",
		[
			2327,
			2364
		]
	],
	[
		[
			2395,
			2395
		],
		"mapped",
		[
			2332,
			2364
		]
	],
	[
		[
			2396,
			2396
		],
		"mapped",
		[
			2337,
			2364
		]
	],
	[
		[
			2397,
			2397
		],
		"mapped",
		[
			2338,
			2364
		]
	],
	[
		[
			2398,
			2398
		],
		"mapped",
		[
			2347,
			2364
		]
	],
	[
		[
			2399,
			2399
		],
		"mapped",
		[
			2351,
			2364
		]
	],
	[
		[
			2400,
			2403
		],
		"valid"
	],
	[
		[
			2404,
			2405
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2406,
			2415
		],
		"valid"
	],
	[
		[
			2416,
			2416
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2417,
			2418
		],
		"valid"
	],
	[
		[
			2419,
			2423
		],
		"valid"
	],
	[
		[
			2424,
			2424
		],
		"valid"
	],
	[
		[
			2425,
			2426
		],
		"valid"
	],
	[
		[
			2427,
			2428
		],
		"valid"
	],
	[
		[
			2429,
			2429
		],
		"valid"
	],
	[
		[
			2430,
			2431
		],
		"valid"
	],
	[
		[
			2432,
			2432
		],
		"valid"
	],
	[
		[
			2433,
			2435
		],
		"valid"
	],
	[
		[
			2436,
			2436
		],
		"disallowed"
	],
	[
		[
			2437,
			2444
		],
		"valid"
	],
	[
		[
			2445,
			2446
		],
		"disallowed"
	],
	[
		[
			2447,
			2448
		],
		"valid"
	],
	[
		[
			2449,
			2450
		],
		"disallowed"
	],
	[
		[
			2451,
			2472
		],
		"valid"
	],
	[
		[
			2473,
			2473
		],
		"disallowed"
	],
	[
		[
			2474,
			2480
		],
		"valid"
	],
	[
		[
			2481,
			2481
		],
		"disallowed"
	],
	[
		[
			2482,
			2482
		],
		"valid"
	],
	[
		[
			2483,
			2485
		],
		"disallowed"
	],
	[
		[
			2486,
			2489
		],
		"valid"
	],
	[
		[
			2490,
			2491
		],
		"disallowed"
	],
	[
		[
			2492,
			2492
		],
		"valid"
	],
	[
		[
			2493,
			2493
		],
		"valid"
	],
	[
		[
			2494,
			2500
		],
		"valid"
	],
	[
		[
			2501,
			2502
		],
		"disallowed"
	],
	[
		[
			2503,
			2504
		],
		"valid"
	],
	[
		[
			2505,
			2506
		],
		"disallowed"
	],
	[
		[
			2507,
			2509
		],
		"valid"
	],
	[
		[
			2510,
			2510
		],
		"valid"
	],
	[
		[
			2511,
			2518
		],
		"disallowed"
	],
	[
		[
			2519,
			2519
		],
		"valid"
	],
	[
		[
			2520,
			2523
		],
		"disallowed"
	],
	[
		[
			2524,
			2524
		],
		"mapped",
		[
			2465,
			2492
		]
	],
	[
		[
			2525,
			2525
		],
		"mapped",
		[
			2466,
			2492
		]
	],
	[
		[
			2526,
			2526
		],
		"disallowed"
	],
	[
		[
			2527,
			2527
		],
		"mapped",
		[
			2479,
			2492
		]
	],
	[
		[
			2528,
			2531
		],
		"valid"
	],
	[
		[
			2532,
			2533
		],
		"disallowed"
	],
	[
		[
			2534,
			2545
		],
		"valid"
	],
	[
		[
			2546,
			2554
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2555,
			2555
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2556,
			2560
		],
		"disallowed"
	],
	[
		[
			2561,
			2561
		],
		"valid"
	],
	[
		[
			2562,
			2562
		],
		"valid"
	],
	[
		[
			2563,
			2563
		],
		"valid"
	],
	[
		[
			2564,
			2564
		],
		"disallowed"
	],
	[
		[
			2565,
			2570
		],
		"valid"
	],
	[
		[
			2571,
			2574
		],
		"disallowed"
	],
	[
		[
			2575,
			2576
		],
		"valid"
	],
	[
		[
			2577,
			2578
		],
		"disallowed"
	],
	[
		[
			2579,
			2600
		],
		"valid"
	],
	[
		[
			2601,
			2601
		],
		"disallowed"
	],
	[
		[
			2602,
			2608
		],
		"valid"
	],
	[
		[
			2609,
			2609
		],
		"disallowed"
	],
	[
		[
			2610,
			2610
		],
		"valid"
	],
	[
		[
			2611,
			2611
		],
		"mapped",
		[
			2610,
			2620
		]
	],
	[
		[
			2612,
			2612
		],
		"disallowed"
	],
	[
		[
			2613,
			2613
		],
		"valid"
	],
	[
		[
			2614,
			2614
		],
		"mapped",
		[
			2616,
			2620
		]
	],
	[
		[
			2615,
			2615
		],
		"disallowed"
	],
	[
		[
			2616,
			2617
		],
		"valid"
	],
	[
		[
			2618,
			2619
		],
		"disallowed"
	],
	[
		[
			2620,
			2620
		],
		"valid"
	],
	[
		[
			2621,
			2621
		],
		"disallowed"
	],
	[
		[
			2622,
			2626
		],
		"valid"
	],
	[
		[
			2627,
			2630
		],
		"disallowed"
	],
	[
		[
			2631,
			2632
		],
		"valid"
	],
	[
		[
			2633,
			2634
		],
		"disallowed"
	],
	[
		[
			2635,
			2637
		],
		"valid"
	],
	[
		[
			2638,
			2640
		],
		"disallowed"
	],
	[
		[
			2641,
			2641
		],
		"valid"
	],
	[
		[
			2642,
			2648
		],
		"disallowed"
	],
	[
		[
			2649,
			2649
		],
		"mapped",
		[
			2582,
			2620
		]
	],
	[
		[
			2650,
			2650
		],
		"mapped",
		[
			2583,
			2620
		]
	],
	[
		[
			2651,
			2651
		],
		"mapped",
		[
			2588,
			2620
		]
	],
	[
		[
			2652,
			2652
		],
		"valid"
	],
	[
		[
			2653,
			2653
		],
		"disallowed"
	],
	[
		[
			2654,
			2654
		],
		"mapped",
		[
			2603,
			2620
		]
	],
	[
		[
			2655,
			2661
		],
		"disallowed"
	],
	[
		[
			2662,
			2676
		],
		"valid"
	],
	[
		[
			2677,
			2677
		],
		"valid"
	],
	[
		[
			2678,
			2688
		],
		"disallowed"
	],
	[
		[
			2689,
			2691
		],
		"valid"
	],
	[
		[
			2692,
			2692
		],
		"disallowed"
	],
	[
		[
			2693,
			2699
		],
		"valid"
	],
	[
		[
			2700,
			2700
		],
		"valid"
	],
	[
		[
			2701,
			2701
		],
		"valid"
	],
	[
		[
			2702,
			2702
		],
		"disallowed"
	],
	[
		[
			2703,
			2705
		],
		"valid"
	],
	[
		[
			2706,
			2706
		],
		"disallowed"
	],
	[
		[
			2707,
			2728
		],
		"valid"
	],
	[
		[
			2729,
			2729
		],
		"disallowed"
	],
	[
		[
			2730,
			2736
		],
		"valid"
	],
	[
		[
			2737,
			2737
		],
		"disallowed"
	],
	[
		[
			2738,
			2739
		],
		"valid"
	],
	[
		[
			2740,
			2740
		],
		"disallowed"
	],
	[
		[
			2741,
			2745
		],
		"valid"
	],
	[
		[
			2746,
			2747
		],
		"disallowed"
	],
	[
		[
			2748,
			2757
		],
		"valid"
	],
	[
		[
			2758,
			2758
		],
		"disallowed"
	],
	[
		[
			2759,
			2761
		],
		"valid"
	],
	[
		[
			2762,
			2762
		],
		"disallowed"
	],
	[
		[
			2763,
			2765
		],
		"valid"
	],
	[
		[
			2766,
			2767
		],
		"disallowed"
	],
	[
		[
			2768,
			2768
		],
		"valid"
	],
	[
		[
			2769,
			2783
		],
		"disallowed"
	],
	[
		[
			2784,
			2784
		],
		"valid"
	],
	[
		[
			2785,
			2787
		],
		"valid"
	],
	[
		[
			2788,
			2789
		],
		"disallowed"
	],
	[
		[
			2790,
			2799
		],
		"valid"
	],
	[
		[
			2800,
			2800
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2801,
			2801
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2802,
			2808
		],
		"disallowed"
	],
	[
		[
			2809,
			2809
		],
		"valid"
	],
	[
		[
			2810,
			2816
		],
		"disallowed"
	],
	[
		[
			2817,
			2819
		],
		"valid"
	],
	[
		[
			2820,
			2820
		],
		"disallowed"
	],
	[
		[
			2821,
			2828
		],
		"valid"
	],
	[
		[
			2829,
			2830
		],
		"disallowed"
	],
	[
		[
			2831,
			2832
		],
		"valid"
	],
	[
		[
			2833,
			2834
		],
		"disallowed"
	],
	[
		[
			2835,
			2856
		],
		"valid"
	],
	[
		[
			2857,
			2857
		],
		"disallowed"
	],
	[
		[
			2858,
			2864
		],
		"valid"
	],
	[
		[
			2865,
			2865
		],
		"disallowed"
	],
	[
		[
			2866,
			2867
		],
		"valid"
	],
	[
		[
			2868,
			2868
		],
		"disallowed"
	],
	[
		[
			2869,
			2869
		],
		"valid"
	],
	[
		[
			2870,
			2873
		],
		"valid"
	],
	[
		[
			2874,
			2875
		],
		"disallowed"
	],
	[
		[
			2876,
			2883
		],
		"valid"
	],
	[
		[
			2884,
			2884
		],
		"valid"
	],
	[
		[
			2885,
			2886
		],
		"disallowed"
	],
	[
		[
			2887,
			2888
		],
		"valid"
	],
	[
		[
			2889,
			2890
		],
		"disallowed"
	],
	[
		[
			2891,
			2893
		],
		"valid"
	],
	[
		[
			2894,
			2901
		],
		"disallowed"
	],
	[
		[
			2902,
			2903
		],
		"valid"
	],
	[
		[
			2904,
			2907
		],
		"disallowed"
	],
	[
		[
			2908,
			2908
		],
		"mapped",
		[
			2849,
			2876
		]
	],
	[
		[
			2909,
			2909
		],
		"mapped",
		[
			2850,
			2876
		]
	],
	[
		[
			2910,
			2910
		],
		"disallowed"
	],
	[
		[
			2911,
			2913
		],
		"valid"
	],
	[
		[
			2914,
			2915
		],
		"valid"
	],
	[
		[
			2916,
			2917
		],
		"disallowed"
	],
	[
		[
			2918,
			2927
		],
		"valid"
	],
	[
		[
			2928,
			2928
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2929,
			2929
		],
		"valid"
	],
	[
		[
			2930,
			2935
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			2936,
			2945
		],
		"disallowed"
	],
	[
		[
			2946,
			2947
		],
		"valid"
	],
	[
		[
			2948,
			2948
		],
		"disallowed"
	],
	[
		[
			2949,
			2954
		],
		"valid"
	],
	[
		[
			2955,
			2957
		],
		"disallowed"
	],
	[
		[
			2958,
			2960
		],
		"valid"
	],
	[
		[
			2961,
			2961
		],
		"disallowed"
	],
	[
		[
			2962,
			2965
		],
		"valid"
	],
	[
		[
			2966,
			2968
		],
		"disallowed"
	],
	[
		[
			2969,
			2970
		],
		"valid"
	],
	[
		[
			2971,
			2971
		],
		"disallowed"
	],
	[
		[
			2972,
			2972
		],
		"valid"
	],
	[
		[
			2973,
			2973
		],
		"disallowed"
	],
	[
		[
			2974,
			2975
		],
		"valid"
	],
	[
		[
			2976,
			2978
		],
		"disallowed"
	],
	[
		[
			2979,
			2980
		],
		"valid"
	],
	[
		[
			2981,
			2983
		],
		"disallowed"
	],
	[
		[
			2984,
			2986
		],
		"valid"
	],
	[
		[
			2987,
			2989
		],
		"disallowed"
	],
	[
		[
			2990,
			2997
		],
		"valid"
	],
	[
		[
			2998,
			2998
		],
		"valid"
	],
	[
		[
			2999,
			3001
		],
		"valid"
	],
	[
		[
			3002,
			3005
		],
		"disallowed"
	],
	[
		[
			3006,
			3010
		],
		"valid"
	],
	[
		[
			3011,
			3013
		],
		"disallowed"
	],
	[
		[
			3014,
			3016
		],
		"valid"
	],
	[
		[
			3017,
			3017
		],
		"disallowed"
	],
	[
		[
			3018,
			3021
		],
		"valid"
	],
	[
		[
			3022,
			3023
		],
		"disallowed"
	],
	[
		[
			3024,
			3024
		],
		"valid"
	],
	[
		[
			3025,
			3030
		],
		"disallowed"
	],
	[
		[
			3031,
			3031
		],
		"valid"
	],
	[
		[
			3032,
			3045
		],
		"disallowed"
	],
	[
		[
			3046,
			3046
		],
		"valid"
	],
	[
		[
			3047,
			3055
		],
		"valid"
	],
	[
		[
			3056,
			3058
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3059,
			3066
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3067,
			3071
		],
		"disallowed"
	],
	[
		[
			3072,
			3072
		],
		"valid"
	],
	[
		[
			3073,
			3075
		],
		"valid"
	],
	[
		[
			3076,
			3076
		],
		"disallowed"
	],
	[
		[
			3077,
			3084
		],
		"valid"
	],
	[
		[
			3085,
			3085
		],
		"disallowed"
	],
	[
		[
			3086,
			3088
		],
		"valid"
	],
	[
		[
			3089,
			3089
		],
		"disallowed"
	],
	[
		[
			3090,
			3112
		],
		"valid"
	],
	[
		[
			3113,
			3113
		],
		"disallowed"
	],
	[
		[
			3114,
			3123
		],
		"valid"
	],
	[
		[
			3124,
			3124
		],
		"valid"
	],
	[
		[
			3125,
			3129
		],
		"valid"
	],
	[
		[
			3130,
			3132
		],
		"disallowed"
	],
	[
		[
			3133,
			3133
		],
		"valid"
	],
	[
		[
			3134,
			3140
		],
		"valid"
	],
	[
		[
			3141,
			3141
		],
		"disallowed"
	],
	[
		[
			3142,
			3144
		],
		"valid"
	],
	[
		[
			3145,
			3145
		],
		"disallowed"
	],
	[
		[
			3146,
			3149
		],
		"valid"
	],
	[
		[
			3150,
			3156
		],
		"disallowed"
	],
	[
		[
			3157,
			3158
		],
		"valid"
	],
	[
		[
			3159,
			3159
		],
		"disallowed"
	],
	[
		[
			3160,
			3161
		],
		"valid"
	],
	[
		[
			3162,
			3162
		],
		"valid"
	],
	[
		[
			3163,
			3167
		],
		"disallowed"
	],
	[
		[
			3168,
			3169
		],
		"valid"
	],
	[
		[
			3170,
			3171
		],
		"valid"
	],
	[
		[
			3172,
			3173
		],
		"disallowed"
	],
	[
		[
			3174,
			3183
		],
		"valid"
	],
	[
		[
			3184,
			3191
		],
		"disallowed"
	],
	[
		[
			3192,
			3199
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3200,
			3200
		],
		"disallowed"
	],
	[
		[
			3201,
			3201
		],
		"valid"
	],
	[
		[
			3202,
			3203
		],
		"valid"
	],
	[
		[
			3204,
			3204
		],
		"disallowed"
	],
	[
		[
			3205,
			3212
		],
		"valid"
	],
	[
		[
			3213,
			3213
		],
		"disallowed"
	],
	[
		[
			3214,
			3216
		],
		"valid"
	],
	[
		[
			3217,
			3217
		],
		"disallowed"
	],
	[
		[
			3218,
			3240
		],
		"valid"
	],
	[
		[
			3241,
			3241
		],
		"disallowed"
	],
	[
		[
			3242,
			3251
		],
		"valid"
	],
	[
		[
			3252,
			3252
		],
		"disallowed"
	],
	[
		[
			3253,
			3257
		],
		"valid"
	],
	[
		[
			3258,
			3259
		],
		"disallowed"
	],
	[
		[
			3260,
			3261
		],
		"valid"
	],
	[
		[
			3262,
			3268
		],
		"valid"
	],
	[
		[
			3269,
			3269
		],
		"disallowed"
	],
	[
		[
			3270,
			3272
		],
		"valid"
	],
	[
		[
			3273,
			3273
		],
		"disallowed"
	],
	[
		[
			3274,
			3277
		],
		"valid"
	],
	[
		[
			3278,
			3284
		],
		"disallowed"
	],
	[
		[
			3285,
			3286
		],
		"valid"
	],
	[
		[
			3287,
			3293
		],
		"disallowed"
	],
	[
		[
			3294,
			3294
		],
		"valid"
	],
	[
		[
			3295,
			3295
		],
		"disallowed"
	],
	[
		[
			3296,
			3297
		],
		"valid"
	],
	[
		[
			3298,
			3299
		],
		"valid"
	],
	[
		[
			3300,
			3301
		],
		"disallowed"
	],
	[
		[
			3302,
			3311
		],
		"valid"
	],
	[
		[
			3312,
			3312
		],
		"disallowed"
	],
	[
		[
			3313,
			3314
		],
		"valid"
	],
	[
		[
			3315,
			3328
		],
		"disallowed"
	],
	[
		[
			3329,
			3329
		],
		"valid"
	],
	[
		[
			3330,
			3331
		],
		"valid"
	],
	[
		[
			3332,
			3332
		],
		"disallowed"
	],
	[
		[
			3333,
			3340
		],
		"valid"
	],
	[
		[
			3341,
			3341
		],
		"disallowed"
	],
	[
		[
			3342,
			3344
		],
		"valid"
	],
	[
		[
			3345,
			3345
		],
		"disallowed"
	],
	[
		[
			3346,
			3368
		],
		"valid"
	],
	[
		[
			3369,
			3369
		],
		"valid"
	],
	[
		[
			3370,
			3385
		],
		"valid"
	],
	[
		[
			3386,
			3386
		],
		"valid"
	],
	[
		[
			3387,
			3388
		],
		"disallowed"
	],
	[
		[
			3389,
			3389
		],
		"valid"
	],
	[
		[
			3390,
			3395
		],
		"valid"
	],
	[
		[
			3396,
			3396
		],
		"valid"
	],
	[
		[
			3397,
			3397
		],
		"disallowed"
	],
	[
		[
			3398,
			3400
		],
		"valid"
	],
	[
		[
			3401,
			3401
		],
		"disallowed"
	],
	[
		[
			3402,
			3405
		],
		"valid"
	],
	[
		[
			3406,
			3406
		],
		"valid"
	],
	[
		[
			3407,
			3414
		],
		"disallowed"
	],
	[
		[
			3415,
			3415
		],
		"valid"
	],
	[
		[
			3416,
			3422
		],
		"disallowed"
	],
	[
		[
			3423,
			3423
		],
		"valid"
	],
	[
		[
			3424,
			3425
		],
		"valid"
	],
	[
		[
			3426,
			3427
		],
		"valid"
	],
	[
		[
			3428,
			3429
		],
		"disallowed"
	],
	[
		[
			3430,
			3439
		],
		"valid"
	],
	[
		[
			3440,
			3445
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3446,
			3448
		],
		"disallowed"
	],
	[
		[
			3449,
			3449
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3450,
			3455
		],
		"valid"
	],
	[
		[
			3456,
			3457
		],
		"disallowed"
	],
	[
		[
			3458,
			3459
		],
		"valid"
	],
	[
		[
			3460,
			3460
		],
		"disallowed"
	],
	[
		[
			3461,
			3478
		],
		"valid"
	],
	[
		[
			3479,
			3481
		],
		"disallowed"
	],
	[
		[
			3482,
			3505
		],
		"valid"
	],
	[
		[
			3506,
			3506
		],
		"disallowed"
	],
	[
		[
			3507,
			3515
		],
		"valid"
	],
	[
		[
			3516,
			3516
		],
		"disallowed"
	],
	[
		[
			3517,
			3517
		],
		"valid"
	],
	[
		[
			3518,
			3519
		],
		"disallowed"
	],
	[
		[
			3520,
			3526
		],
		"valid"
	],
	[
		[
			3527,
			3529
		],
		"disallowed"
	],
	[
		[
			3530,
			3530
		],
		"valid"
	],
	[
		[
			3531,
			3534
		],
		"disallowed"
	],
	[
		[
			3535,
			3540
		],
		"valid"
	],
	[
		[
			3541,
			3541
		],
		"disallowed"
	],
	[
		[
			3542,
			3542
		],
		"valid"
	],
	[
		[
			3543,
			3543
		],
		"disallowed"
	],
	[
		[
			3544,
			3551
		],
		"valid"
	],
	[
		[
			3552,
			3557
		],
		"disallowed"
	],
	[
		[
			3558,
			3567
		],
		"valid"
	],
	[
		[
			3568,
			3569
		],
		"disallowed"
	],
	[
		[
			3570,
			3571
		],
		"valid"
	],
	[
		[
			3572,
			3572
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3573,
			3584
		],
		"disallowed"
	],
	[
		[
			3585,
			3634
		],
		"valid"
	],
	[
		[
			3635,
			3635
		],
		"mapped",
		[
			3661,
			3634
		]
	],
	[
		[
			3636,
			3642
		],
		"valid"
	],
	[
		[
			3643,
			3646
		],
		"disallowed"
	],
	[
		[
			3647,
			3647
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3648,
			3662
		],
		"valid"
	],
	[
		[
			3663,
			3663
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3664,
			3673
		],
		"valid"
	],
	[
		[
			3674,
			3675
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3676,
			3712
		],
		"disallowed"
	],
	[
		[
			3713,
			3714
		],
		"valid"
	],
	[
		[
			3715,
			3715
		],
		"disallowed"
	],
	[
		[
			3716,
			3716
		],
		"valid"
	],
	[
		[
			3717,
			3718
		],
		"disallowed"
	],
	[
		[
			3719,
			3720
		],
		"valid"
	],
	[
		[
			3721,
			3721
		],
		"disallowed"
	],
	[
		[
			3722,
			3722
		],
		"valid"
	],
	[
		[
			3723,
			3724
		],
		"disallowed"
	],
	[
		[
			3725,
			3725
		],
		"valid"
	],
	[
		[
			3726,
			3731
		],
		"disallowed"
	],
	[
		[
			3732,
			3735
		],
		"valid"
	],
	[
		[
			3736,
			3736
		],
		"disallowed"
	],
	[
		[
			3737,
			3743
		],
		"valid"
	],
	[
		[
			3744,
			3744
		],
		"disallowed"
	],
	[
		[
			3745,
			3747
		],
		"valid"
	],
	[
		[
			3748,
			3748
		],
		"disallowed"
	],
	[
		[
			3749,
			3749
		],
		"valid"
	],
	[
		[
			3750,
			3750
		],
		"disallowed"
	],
	[
		[
			3751,
			3751
		],
		"valid"
	],
	[
		[
			3752,
			3753
		],
		"disallowed"
	],
	[
		[
			3754,
			3755
		],
		"valid"
	],
	[
		[
			3756,
			3756
		],
		"disallowed"
	],
	[
		[
			3757,
			3762
		],
		"valid"
	],
	[
		[
			3763,
			3763
		],
		"mapped",
		[
			3789,
			3762
		]
	],
	[
		[
			3764,
			3769
		],
		"valid"
	],
	[
		[
			3770,
			3770
		],
		"disallowed"
	],
	[
		[
			3771,
			3773
		],
		"valid"
	],
	[
		[
			3774,
			3775
		],
		"disallowed"
	],
	[
		[
			3776,
			3780
		],
		"valid"
	],
	[
		[
			3781,
			3781
		],
		"disallowed"
	],
	[
		[
			3782,
			3782
		],
		"valid"
	],
	[
		[
			3783,
			3783
		],
		"disallowed"
	],
	[
		[
			3784,
			3789
		],
		"valid"
	],
	[
		[
			3790,
			3791
		],
		"disallowed"
	],
	[
		[
			3792,
			3801
		],
		"valid"
	],
	[
		[
			3802,
			3803
		],
		"disallowed"
	],
	[
		[
			3804,
			3804
		],
		"mapped",
		[
			3755,
			3737
		]
	],
	[
		[
			3805,
			3805
		],
		"mapped",
		[
			3755,
			3745
		]
	],
	[
		[
			3806,
			3807
		],
		"valid"
	],
	[
		[
			3808,
			3839
		],
		"disallowed"
	],
	[
		[
			3840,
			3840
		],
		"valid"
	],
	[
		[
			3841,
			3850
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3851,
			3851
		],
		"valid"
	],
	[
		[
			3852,
			3852
		],
		"mapped",
		[
			3851
		]
	],
	[
		[
			3853,
			3863
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3864,
			3865
		],
		"valid"
	],
	[
		[
			3866,
			3871
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3872,
			3881
		],
		"valid"
	],
	[
		[
			3882,
			3892
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3893,
			3893
		],
		"valid"
	],
	[
		[
			3894,
			3894
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3895,
			3895
		],
		"valid"
	],
	[
		[
			3896,
			3896
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3897,
			3897
		],
		"valid"
	],
	[
		[
			3898,
			3901
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3902,
			3906
		],
		"valid"
	],
	[
		[
			3907,
			3907
		],
		"mapped",
		[
			3906,
			4023
		]
	],
	[
		[
			3908,
			3911
		],
		"valid"
	],
	[
		[
			3912,
			3912
		],
		"disallowed"
	],
	[
		[
			3913,
			3916
		],
		"valid"
	],
	[
		[
			3917,
			3917
		],
		"mapped",
		[
			3916,
			4023
		]
	],
	[
		[
			3918,
			3921
		],
		"valid"
	],
	[
		[
			3922,
			3922
		],
		"mapped",
		[
			3921,
			4023
		]
	],
	[
		[
			3923,
			3926
		],
		"valid"
	],
	[
		[
			3927,
			3927
		],
		"mapped",
		[
			3926,
			4023
		]
	],
	[
		[
			3928,
			3931
		],
		"valid"
	],
	[
		[
			3932,
			3932
		],
		"mapped",
		[
			3931,
			4023
		]
	],
	[
		[
			3933,
			3944
		],
		"valid"
	],
	[
		[
			3945,
			3945
		],
		"mapped",
		[
			3904,
			4021
		]
	],
	[
		[
			3946,
			3946
		],
		"valid"
	],
	[
		[
			3947,
			3948
		],
		"valid"
	],
	[
		[
			3949,
			3952
		],
		"disallowed"
	],
	[
		[
			3953,
			3954
		],
		"valid"
	],
	[
		[
			3955,
			3955
		],
		"mapped",
		[
			3953,
			3954
		]
	],
	[
		[
			3956,
			3956
		],
		"valid"
	],
	[
		[
			3957,
			3957
		],
		"mapped",
		[
			3953,
			3956
		]
	],
	[
		[
			3958,
			3958
		],
		"mapped",
		[
			4018,
			3968
		]
	],
	[
		[
			3959,
			3959
		],
		"mapped",
		[
			4018,
			3953,
			3968
		]
	],
	[
		[
			3960,
			3960
		],
		"mapped",
		[
			4019,
			3968
		]
	],
	[
		[
			3961,
			3961
		],
		"mapped",
		[
			4019,
			3953,
			3968
		]
	],
	[
		[
			3962,
			3968
		],
		"valid"
	],
	[
		[
			3969,
			3969
		],
		"mapped",
		[
			3953,
			3968
		]
	],
	[
		[
			3970,
			3972
		],
		"valid"
	],
	[
		[
			3973,
			3973
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			3974,
			3979
		],
		"valid"
	],
	[
		[
			3980,
			3983
		],
		"valid"
	],
	[
		[
			3984,
			3986
		],
		"valid"
	],
	[
		[
			3987,
			3987
		],
		"mapped",
		[
			3986,
			4023
		]
	],
	[
		[
			3988,
			3989
		],
		"valid"
	],
	[
		[
			3990,
			3990
		],
		"valid"
	],
	[
		[
			3991,
			3991
		],
		"valid"
	],
	[
		[
			3992,
			3992
		],
		"disallowed"
	],
	[
		[
			3993,
			3996
		],
		"valid"
	],
	[
		[
			3997,
			3997
		],
		"mapped",
		[
			3996,
			4023
		]
	],
	[
		[
			3998,
			4001
		],
		"valid"
	],
	[
		[
			4002,
			4002
		],
		"mapped",
		[
			4001,
			4023
		]
	],
	[
		[
			4003,
			4006
		],
		"valid"
	],
	[
		[
			4007,
			4007
		],
		"mapped",
		[
			4006,
			4023
		]
	],
	[
		[
			4008,
			4011
		],
		"valid"
	],
	[
		[
			4012,
			4012
		],
		"mapped",
		[
			4011,
			4023
		]
	],
	[
		[
			4013,
			4013
		],
		"valid"
	],
	[
		[
			4014,
			4016
		],
		"valid"
	],
	[
		[
			4017,
			4023
		],
		"valid"
	],
	[
		[
			4024,
			4024
		],
		"valid"
	],
	[
		[
			4025,
			4025
		],
		"mapped",
		[
			3984,
			4021
		]
	],
	[
		[
			4026,
			4028
		],
		"valid"
	],
	[
		[
			4029,
			4029
		],
		"disallowed"
	],
	[
		[
			4030,
			4037
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4038,
			4038
		],
		"valid"
	],
	[
		[
			4039,
			4044
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4045,
			4045
		],
		"disallowed"
	],
	[
		[
			4046,
			4046
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4047,
			4047
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4048,
			4049
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4050,
			4052
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4053,
			4056
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4057,
			4058
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4059,
			4095
		],
		"disallowed"
	],
	[
		[
			4096,
			4129
		],
		"valid"
	],
	[
		[
			4130,
			4130
		],
		"valid"
	],
	[
		[
			4131,
			4135
		],
		"valid"
	],
	[
		[
			4136,
			4136
		],
		"valid"
	],
	[
		[
			4137,
			4138
		],
		"valid"
	],
	[
		[
			4139,
			4139
		],
		"valid"
	],
	[
		[
			4140,
			4146
		],
		"valid"
	],
	[
		[
			4147,
			4149
		],
		"valid"
	],
	[
		[
			4150,
			4153
		],
		"valid"
	],
	[
		[
			4154,
			4159
		],
		"valid"
	],
	[
		[
			4160,
			4169
		],
		"valid"
	],
	[
		[
			4170,
			4175
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4176,
			4185
		],
		"valid"
	],
	[
		[
			4186,
			4249
		],
		"valid"
	],
	[
		[
			4250,
			4253
		],
		"valid"
	],
	[
		[
			4254,
			4255
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4256,
			4293
		],
		"disallowed"
	],
	[
		[
			4294,
			4294
		],
		"disallowed"
	],
	[
		[
			4295,
			4295
		],
		"mapped",
		[
			11559
		]
	],
	[
		[
			4296,
			4300
		],
		"disallowed"
	],
	[
		[
			4301,
			4301
		],
		"mapped",
		[
			11565
		]
	],
	[
		[
			4302,
			4303
		],
		"disallowed"
	],
	[
		[
			4304,
			4342
		],
		"valid"
	],
	[
		[
			4343,
			4344
		],
		"valid"
	],
	[
		[
			4345,
			4346
		],
		"valid"
	],
	[
		[
			4347,
			4347
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4348,
			4348
		],
		"mapped",
		[
			4316
		]
	],
	[
		[
			4349,
			4351
		],
		"valid"
	],
	[
		[
			4352,
			4441
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4442,
			4446
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4447,
			4448
		],
		"disallowed"
	],
	[
		[
			4449,
			4514
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4515,
			4519
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4520,
			4601
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4602,
			4607
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4608,
			4614
		],
		"valid"
	],
	[
		[
			4615,
			4615
		],
		"valid"
	],
	[
		[
			4616,
			4678
		],
		"valid"
	],
	[
		[
			4679,
			4679
		],
		"valid"
	],
	[
		[
			4680,
			4680
		],
		"valid"
	],
	[
		[
			4681,
			4681
		],
		"disallowed"
	],
	[
		[
			4682,
			4685
		],
		"valid"
	],
	[
		[
			4686,
			4687
		],
		"disallowed"
	],
	[
		[
			4688,
			4694
		],
		"valid"
	],
	[
		[
			4695,
			4695
		],
		"disallowed"
	],
	[
		[
			4696,
			4696
		],
		"valid"
	],
	[
		[
			4697,
			4697
		],
		"disallowed"
	],
	[
		[
			4698,
			4701
		],
		"valid"
	],
	[
		[
			4702,
			4703
		],
		"disallowed"
	],
	[
		[
			4704,
			4742
		],
		"valid"
	],
	[
		[
			4743,
			4743
		],
		"valid"
	],
	[
		[
			4744,
			4744
		],
		"valid"
	],
	[
		[
			4745,
			4745
		],
		"disallowed"
	],
	[
		[
			4746,
			4749
		],
		"valid"
	],
	[
		[
			4750,
			4751
		],
		"disallowed"
	],
	[
		[
			4752,
			4782
		],
		"valid"
	],
	[
		[
			4783,
			4783
		],
		"valid"
	],
	[
		[
			4784,
			4784
		],
		"valid"
	],
	[
		[
			4785,
			4785
		],
		"disallowed"
	],
	[
		[
			4786,
			4789
		],
		"valid"
	],
	[
		[
			4790,
			4791
		],
		"disallowed"
	],
	[
		[
			4792,
			4798
		],
		"valid"
	],
	[
		[
			4799,
			4799
		],
		"disallowed"
	],
	[
		[
			4800,
			4800
		],
		"valid"
	],
	[
		[
			4801,
			4801
		],
		"disallowed"
	],
	[
		[
			4802,
			4805
		],
		"valid"
	],
	[
		[
			4806,
			4807
		],
		"disallowed"
	],
	[
		[
			4808,
			4814
		],
		"valid"
	],
	[
		[
			4815,
			4815
		],
		"valid"
	],
	[
		[
			4816,
			4822
		],
		"valid"
	],
	[
		[
			4823,
			4823
		],
		"disallowed"
	],
	[
		[
			4824,
			4846
		],
		"valid"
	],
	[
		[
			4847,
			4847
		],
		"valid"
	],
	[
		[
			4848,
			4878
		],
		"valid"
	],
	[
		[
			4879,
			4879
		],
		"valid"
	],
	[
		[
			4880,
			4880
		],
		"valid"
	],
	[
		[
			4881,
			4881
		],
		"disallowed"
	],
	[
		[
			4882,
			4885
		],
		"valid"
	],
	[
		[
			4886,
			4887
		],
		"disallowed"
	],
	[
		[
			4888,
			4894
		],
		"valid"
	],
	[
		[
			4895,
			4895
		],
		"valid"
	],
	[
		[
			4896,
			4934
		],
		"valid"
	],
	[
		[
			4935,
			4935
		],
		"valid"
	],
	[
		[
			4936,
			4954
		],
		"valid"
	],
	[
		[
			4955,
			4956
		],
		"disallowed"
	],
	[
		[
			4957,
			4958
		],
		"valid"
	],
	[
		[
			4959,
			4959
		],
		"valid"
	],
	[
		[
			4960,
			4960
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4961,
			4988
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			4989,
			4991
		],
		"disallowed"
	],
	[
		[
			4992,
			5007
		],
		"valid"
	],
	[
		[
			5008,
			5017
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			5018,
			5023
		],
		"disallowed"
	],
	[
		[
			5024,
			5108
		],
		"valid"
	],
	[
		[
			5109,
			5109
		],
		"valid"
	],
	[
		[
			5110,
			5111
		],
		"disallowed"
	],
	[
		[
			5112,
			5112
		],
		"mapped",
		[
			5104
		]
	],
	[
		[
			5113,
			5113
		],
		"mapped",
		[
			5105
		]
	],
	[
		[
			5114,
			5114
		],
		"mapped",
		[
			5106
		]
	],
	[
		[
			5115,
			5115
		],
		"mapped",
		[
			5107
		]
	],
	[
		[
			5116,
			5116
		],
		"mapped",
		[
			5108
		]
	],
	[
		[
			5117,
			5117
		],
		"mapped",
		[
			5109
		]
	],
	[
		[
			5118,
			5119
		],
		"disallowed"
	],
	[
		[
			5120,
			5120
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			5121,
			5740
		],
		"valid"
	],
	[
		[
			5741,
			5742
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			5743,
			5750
		],
		"valid"
	],
	[
		[
			5751,
			5759
		],
		"valid"
	],
	[
		[
			5760,
			5760
		],
		"disallowed"
	],
	[
		[
			5761,
			5786
		],
		"valid"
	],
	[
		[
			5787,
			5788
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			5789,
			5791
		],
		"disallowed"
	],
	[
		[
			5792,
			5866
		],
		"valid"
	],
	[
		[
			5867,
			5872
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			5873,
			5880
		],
		"valid"
	],
	[
		[
			5881,
			5887
		],
		"disallowed"
	],
	[
		[
			5888,
			5900
		],
		"valid"
	],
	[
		[
			5901,
			5901
		],
		"disallowed"
	],
	[
		[
			5902,
			5908
		],
		"valid"
	],
	[
		[
			5909,
			5919
		],
		"disallowed"
	],
	[
		[
			5920,
			5940
		],
		"valid"
	],
	[
		[
			5941,
			5942
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			5943,
			5951
		],
		"disallowed"
	],
	[
		[
			5952,
			5971
		],
		"valid"
	],
	[
		[
			5972,
			5983
		],
		"disallowed"
	],
	[
		[
			5984,
			5996
		],
		"valid"
	],
	[
		[
			5997,
			5997
		],
		"disallowed"
	],
	[
		[
			5998,
			6000
		],
		"valid"
	],
	[
		[
			6001,
			6001
		],
		"disallowed"
	],
	[
		[
			6002,
			6003
		],
		"valid"
	],
	[
		[
			6004,
			6015
		],
		"disallowed"
	],
	[
		[
			6016,
			6067
		],
		"valid"
	],
	[
		[
			6068,
			6069
		],
		"disallowed"
	],
	[
		[
			6070,
			6099
		],
		"valid"
	],
	[
		[
			6100,
			6102
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6103,
			6103
		],
		"valid"
	],
	[
		[
			6104,
			6107
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6108,
			6108
		],
		"valid"
	],
	[
		[
			6109,
			6109
		],
		"valid"
	],
	[
		[
			6110,
			6111
		],
		"disallowed"
	],
	[
		[
			6112,
			6121
		],
		"valid"
	],
	[
		[
			6122,
			6127
		],
		"disallowed"
	],
	[
		[
			6128,
			6137
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6138,
			6143
		],
		"disallowed"
	],
	[
		[
			6144,
			6149
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6150,
			6150
		],
		"disallowed"
	],
	[
		[
			6151,
			6154
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6155,
			6157
		],
		"ignored"
	],
	[
		[
			6158,
			6158
		],
		"disallowed"
	],
	[
		[
			6159,
			6159
		],
		"disallowed"
	],
	[
		[
			6160,
			6169
		],
		"valid"
	],
	[
		[
			6170,
			6175
		],
		"disallowed"
	],
	[
		[
			6176,
			6263
		],
		"valid"
	],
	[
		[
			6264,
			6271
		],
		"disallowed"
	],
	[
		[
			6272,
			6313
		],
		"valid"
	],
	[
		[
			6314,
			6314
		],
		"valid"
	],
	[
		[
			6315,
			6319
		],
		"disallowed"
	],
	[
		[
			6320,
			6389
		],
		"valid"
	],
	[
		[
			6390,
			6399
		],
		"disallowed"
	],
	[
		[
			6400,
			6428
		],
		"valid"
	],
	[
		[
			6429,
			6430
		],
		"valid"
	],
	[
		[
			6431,
			6431
		],
		"disallowed"
	],
	[
		[
			6432,
			6443
		],
		"valid"
	],
	[
		[
			6444,
			6447
		],
		"disallowed"
	],
	[
		[
			6448,
			6459
		],
		"valid"
	],
	[
		[
			6460,
			6463
		],
		"disallowed"
	],
	[
		[
			6464,
			6464
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6465,
			6467
		],
		"disallowed"
	],
	[
		[
			6468,
			6469
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6470,
			6509
		],
		"valid"
	],
	[
		[
			6510,
			6511
		],
		"disallowed"
	],
	[
		[
			6512,
			6516
		],
		"valid"
	],
	[
		[
			6517,
			6527
		],
		"disallowed"
	],
	[
		[
			6528,
			6569
		],
		"valid"
	],
	[
		[
			6570,
			6571
		],
		"valid"
	],
	[
		[
			6572,
			6575
		],
		"disallowed"
	],
	[
		[
			6576,
			6601
		],
		"valid"
	],
	[
		[
			6602,
			6607
		],
		"disallowed"
	],
	[
		[
			6608,
			6617
		],
		"valid"
	],
	[
		[
			6618,
			6618
		],
		"valid",
		[
		],
		"XV8"
	],
	[
		[
			6619,
			6621
		],
		"disallowed"
	],
	[
		[
			6622,
			6623
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6624,
			6655
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6656,
			6683
		],
		"valid"
	],
	[
		[
			6684,
			6685
		],
		"disallowed"
	],
	[
		[
			6686,
			6687
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6688,
			6750
		],
		"valid"
	],
	[
		[
			6751,
			6751
		],
		"disallowed"
	],
	[
		[
			6752,
			6780
		],
		"valid"
	],
	[
		[
			6781,
			6782
		],
		"disallowed"
	],
	[
		[
			6783,
			6793
		],
		"valid"
	],
	[
		[
			6794,
			6799
		],
		"disallowed"
	],
	[
		[
			6800,
			6809
		],
		"valid"
	],
	[
		[
			6810,
			6815
		],
		"disallowed"
	],
	[
		[
			6816,
			6822
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6823,
			6823
		],
		"valid"
	],
	[
		[
			6824,
			6829
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6830,
			6831
		],
		"disallowed"
	],
	[
		[
			6832,
			6845
		],
		"valid"
	],
	[
		[
			6846,
			6846
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			6847,
			6911
		],
		"disallowed"
	],
	[
		[
			6912,
			6987
		],
		"valid"
	],
	[
		[
			6988,
			6991
		],
		"disallowed"
	],
	[
		[
			6992,
			7001
		],
		"valid"
	],
	[
		[
			7002,
			7018
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			7019,
			7027
		],
		"valid"
	],
	[
		[
			7028,
			7036
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			7037,
			7039
		],
		"disallowed"
	],
	[
		[
			7040,
			7082
		],
		"valid"
	],
	[
		[
			7083,
			7085
		],
		"valid"
	],
	[
		[
			7086,
			7097
		],
		"valid"
	],
	[
		[
			7098,
			7103
		],
		"valid"
	],
	[
		[
			7104,
			7155
		],
		"valid"
	],
	[
		[
			7156,
			7163
		],
		"disallowed"
	],
	[
		[
			7164,
			7167
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			7168,
			7223
		],
		"valid"
	],
	[
		[
			7224,
			7226
		],
		"disallowed"
	],
	[
		[
			7227,
			7231
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			7232,
			7241
		],
		"valid"
	],
	[
		[
			7242,
			7244
		],
		"disallowed"
	],
	[
		[
			7245,
			7293
		],
		"valid"
	],
	[
		[
			7294,
			7295
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			7296,
			7359
		],
		"disallowed"
	],
	[
		[
			7360,
			7367
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			7368,
			7375
		],
		"disallowed"
	],
	[
		[
			7376,
			7378
		],
		"valid"
	],
	[
		[
			7379,
			7379
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			7380,
			7410
		],
		"valid"
	],
	[
		[
			7411,
			7414
		],
		"valid"
	],
	[
		[
			7415,
			7415
		],
		"disallowed"
	],
	[
		[
			7416,
			7417
		],
		"valid"
	],
	[
		[
			7418,
			7423
		],
		"disallowed"
	],
	[
		[
			7424,
			7467
		],
		"valid"
	],
	[
		[
			7468,
			7468
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			7469,
			7469
		],
		"mapped",
		[
			230
		]
	],
	[
		[
			7470,
			7470
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			7471,
			7471
		],
		"valid"
	],
	[
		[
			7472,
			7472
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			7473,
			7473
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			7474,
			7474
		],
		"mapped",
		[
			477
		]
	],
	[
		[
			7475,
			7475
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			7476,
			7476
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			7477,
			7477
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			7478,
			7478
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			7479,
			7479
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			7480,
			7480
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			7481,
			7481
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			7482,
			7482
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			7483,
			7483
		],
		"valid"
	],
	[
		[
			7484,
			7484
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			7485,
			7485
		],
		"mapped",
		[
			547
		]
	],
	[
		[
			7486,
			7486
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			7487,
			7487
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			7488,
			7488
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			7489,
			7489
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			7490,
			7490
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			7491,
			7491
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			7492,
			7492
		],
		"mapped",
		[
			592
		]
	],
	[
		[
			7493,
			7493
		],
		"mapped",
		[
			593
		]
	],
	[
		[
			7494,
			7494
		],
		"mapped",
		[
			7426
		]
	],
	[
		[
			7495,
			7495
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			7496,
			7496
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			7497,
			7497
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			7498,
			7498
		],
		"mapped",
		[
			601
		]
	],
	[
		[
			7499,
			7499
		],
		"mapped",
		[
			603
		]
	],
	[
		[
			7500,
			7500
		],
		"mapped",
		[
			604
		]
	],
	[
		[
			7501,
			7501
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			7502,
			7502
		],
		"valid"
	],
	[
		[
			7503,
			7503
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			7504,
			7504
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			7505,
			7505
		],
		"mapped",
		[
			331
		]
	],
	[
		[
			7506,
			7506
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			7507,
			7507
		],
		"mapped",
		[
			596
		]
	],
	[
		[
			7508,
			7508
		],
		"mapped",
		[
			7446
		]
	],
	[
		[
			7509,
			7509
		],
		"mapped",
		[
			7447
		]
	],
	[
		[
			7510,
			7510
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			7511,
			7511
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			7512,
			7512
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			7513,
			7513
		],
		"mapped",
		[
			7453
		]
	],
	[
		[
			7514,
			7514
		],
		"mapped",
		[
			623
		]
	],
	[
		[
			7515,
			7515
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			7516,
			7516
		],
		"mapped",
		[
			7461
		]
	],
	[
		[
			7517,
			7517
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			7518,
			7518
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			7519,
			7519
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			7520,
			7520
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			7521,
			7521
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			7522,
			7522
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			7523,
			7523
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			7524,
			7524
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			7525,
			7525
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			7526,
			7526
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			7527,
			7527
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			7528,
			7528
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			7529,
			7529
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			7530,
			7530
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			7531,
			7531
		],
		"valid"
	],
	[
		[
			7532,
			7543
		],
		"valid"
	],
	[
		[
			7544,
			7544
		],
		"mapped",
		[
			1085
		]
	],
	[
		[
			7545,
			7578
		],
		"valid"
	],
	[
		[
			7579,
			7579
		],
		"mapped",
		[
			594
		]
	],
	[
		[
			7580,
			7580
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			7581,
			7581
		],
		"mapped",
		[
			597
		]
	],
	[
		[
			7582,
			7582
		],
		"mapped",
		[
			240
		]
	],
	[
		[
			7583,
			7583
		],
		"mapped",
		[
			604
		]
	],
	[
		[
			7584,
			7584
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			7585,
			7585
		],
		"mapped",
		[
			607
		]
	],
	[
		[
			7586,
			7586
		],
		"mapped",
		[
			609
		]
	],
	[
		[
			7587,
			7587
		],
		"mapped",
		[
			613
		]
	],
	[
		[
			7588,
			7588
		],
		"mapped",
		[
			616
		]
	],
	[
		[
			7589,
			7589
		],
		"mapped",
		[
			617
		]
	],
	[
		[
			7590,
			7590
		],
		"mapped",
		[
			618
		]
	],
	[
		[
			7591,
			7591
		],
		"mapped",
		[
			7547
		]
	],
	[
		[
			7592,
			7592
		],
		"mapped",
		[
			669
		]
	],
	[
		[
			7593,
			7593
		],
		"mapped",
		[
			621
		]
	],
	[
		[
			7594,
			7594
		],
		"mapped",
		[
			7557
		]
	],
	[
		[
			7595,
			7595
		],
		"mapped",
		[
			671
		]
	],
	[
		[
			7596,
			7596
		],
		"mapped",
		[
			625
		]
	],
	[
		[
			7597,
			7597
		],
		"mapped",
		[
			624
		]
	],
	[
		[
			7598,
			7598
		],
		"mapped",
		[
			626
		]
	],
	[
		[
			7599,
			7599
		],
		"mapped",
		[
			627
		]
	],
	[
		[
			7600,
			7600
		],
		"mapped",
		[
			628
		]
	],
	[
		[
			7601,
			7601
		],
		"mapped",
		[
			629
		]
	],
	[
		[
			7602,
			7602
		],
		"mapped",
		[
			632
		]
	],
	[
		[
			7603,
			7603
		],
		"mapped",
		[
			642
		]
	],
	[
		[
			7604,
			7604
		],
		"mapped",
		[
			643
		]
	],
	[
		[
			7605,
			7605
		],
		"mapped",
		[
			427
		]
	],
	[
		[
			7606,
			7606
		],
		"mapped",
		[
			649
		]
	],
	[
		[
			7607,
			7607
		],
		"mapped",
		[
			650
		]
	],
	[
		[
			7608,
			7608
		],
		"mapped",
		[
			7452
		]
	],
	[
		[
			7609,
			7609
		],
		"mapped",
		[
			651
		]
	],
	[
		[
			7610,
			7610
		],
		"mapped",
		[
			652
		]
	],
	[
		[
			7611,
			7611
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			7612,
			7612
		],
		"mapped",
		[
			656
		]
	],
	[
		[
			7613,
			7613
		],
		"mapped",
		[
			657
		]
	],
	[
		[
			7614,
			7614
		],
		"mapped",
		[
			658
		]
	],
	[
		[
			7615,
			7615
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			7616,
			7619
		],
		"valid"
	],
	[
		[
			7620,
			7626
		],
		"valid"
	],
	[
		[
			7627,
			7654
		],
		"valid"
	],
	[
		[
			7655,
			7669
		],
		"valid"
	],
	[
		[
			7670,
			7675
		],
		"disallowed"
	],
	[
		[
			7676,
			7676
		],
		"valid"
	],
	[
		[
			7677,
			7677
		],
		"valid"
	],
	[
		[
			7678,
			7679
		],
		"valid"
	],
	[
		[
			7680,
			7680
		],
		"mapped",
		[
			7681
		]
	],
	[
		[
			7681,
			7681
		],
		"valid"
	],
	[
		[
			7682,
			7682
		],
		"mapped",
		[
			7683
		]
	],
	[
		[
			7683,
			7683
		],
		"valid"
	],
	[
		[
			7684,
			7684
		],
		"mapped",
		[
			7685
		]
	],
	[
		[
			7685,
			7685
		],
		"valid"
	],
	[
		[
			7686,
			7686
		],
		"mapped",
		[
			7687
		]
	],
	[
		[
			7687,
			7687
		],
		"valid"
	],
	[
		[
			7688,
			7688
		],
		"mapped",
		[
			7689
		]
	],
	[
		[
			7689,
			7689
		],
		"valid"
	],
	[
		[
			7690,
			7690
		],
		"mapped",
		[
			7691
		]
	],
	[
		[
			7691,
			7691
		],
		"valid"
	],
	[
		[
			7692,
			7692
		],
		"mapped",
		[
			7693
		]
	],
	[
		[
			7693,
			7693
		],
		"valid"
	],
	[
		[
			7694,
			7694
		],
		"mapped",
		[
			7695
		]
	],
	[
		[
			7695,
			7695
		],
		"valid"
	],
	[
		[
			7696,
			7696
		],
		"mapped",
		[
			7697
		]
	],
	[
		[
			7697,
			7697
		],
		"valid"
	],
	[
		[
			7698,
			7698
		],
		"mapped",
		[
			7699
		]
	],
	[
		[
			7699,
			7699
		],
		"valid"
	],
	[
		[
			7700,
			7700
		],
		"mapped",
		[
			7701
		]
	],
	[
		[
			7701,
			7701
		],
		"valid"
	],
	[
		[
			7702,
			7702
		],
		"mapped",
		[
			7703
		]
	],
	[
		[
			7703,
			7703
		],
		"valid"
	],
	[
		[
			7704,
			7704
		],
		"mapped",
		[
			7705
		]
	],
	[
		[
			7705,
			7705
		],
		"valid"
	],
	[
		[
			7706,
			7706
		],
		"mapped",
		[
			7707
		]
	],
	[
		[
			7707,
			7707
		],
		"valid"
	],
	[
		[
			7708,
			7708
		],
		"mapped",
		[
			7709
		]
	],
	[
		[
			7709,
			7709
		],
		"valid"
	],
	[
		[
			7710,
			7710
		],
		"mapped",
		[
			7711
		]
	],
	[
		[
			7711,
			7711
		],
		"valid"
	],
	[
		[
			7712,
			7712
		],
		"mapped",
		[
			7713
		]
	],
	[
		[
			7713,
			7713
		],
		"valid"
	],
	[
		[
			7714,
			7714
		],
		"mapped",
		[
			7715
		]
	],
	[
		[
			7715,
			7715
		],
		"valid"
	],
	[
		[
			7716,
			7716
		],
		"mapped",
		[
			7717
		]
	],
	[
		[
			7717,
			7717
		],
		"valid"
	],
	[
		[
			7718,
			7718
		],
		"mapped",
		[
			7719
		]
	],
	[
		[
			7719,
			7719
		],
		"valid"
	],
	[
		[
			7720,
			7720
		],
		"mapped",
		[
			7721
		]
	],
	[
		[
			7721,
			7721
		],
		"valid"
	],
	[
		[
			7722,
			7722
		],
		"mapped",
		[
			7723
		]
	],
	[
		[
			7723,
			7723
		],
		"valid"
	],
	[
		[
			7724,
			7724
		],
		"mapped",
		[
			7725
		]
	],
	[
		[
			7725,
			7725
		],
		"valid"
	],
	[
		[
			7726,
			7726
		],
		"mapped",
		[
			7727
		]
	],
	[
		[
			7727,
			7727
		],
		"valid"
	],
	[
		[
			7728,
			7728
		],
		"mapped",
		[
			7729
		]
	],
	[
		[
			7729,
			7729
		],
		"valid"
	],
	[
		[
			7730,
			7730
		],
		"mapped",
		[
			7731
		]
	],
	[
		[
			7731,
			7731
		],
		"valid"
	],
	[
		[
			7732,
			7732
		],
		"mapped",
		[
			7733
		]
	],
	[
		[
			7733,
			7733
		],
		"valid"
	],
	[
		[
			7734,
			7734
		],
		"mapped",
		[
			7735
		]
	],
	[
		[
			7735,
			7735
		],
		"valid"
	],
	[
		[
			7736,
			7736
		],
		"mapped",
		[
			7737
		]
	],
	[
		[
			7737,
			7737
		],
		"valid"
	],
	[
		[
			7738,
			7738
		],
		"mapped",
		[
			7739
		]
	],
	[
		[
			7739,
			7739
		],
		"valid"
	],
	[
		[
			7740,
			7740
		],
		"mapped",
		[
			7741
		]
	],
	[
		[
			7741,
			7741
		],
		"valid"
	],
	[
		[
			7742,
			7742
		],
		"mapped",
		[
			7743
		]
	],
	[
		[
			7743,
			7743
		],
		"valid"
	],
	[
		[
			7744,
			7744
		],
		"mapped",
		[
			7745
		]
	],
	[
		[
			7745,
			7745
		],
		"valid"
	],
	[
		[
			7746,
			7746
		],
		"mapped",
		[
			7747
		]
	],
	[
		[
			7747,
			7747
		],
		"valid"
	],
	[
		[
			7748,
			7748
		],
		"mapped",
		[
			7749
		]
	],
	[
		[
			7749,
			7749
		],
		"valid"
	],
	[
		[
			7750,
			7750
		],
		"mapped",
		[
			7751
		]
	],
	[
		[
			7751,
			7751
		],
		"valid"
	],
	[
		[
			7752,
			7752
		],
		"mapped",
		[
			7753
		]
	],
	[
		[
			7753,
			7753
		],
		"valid"
	],
	[
		[
			7754,
			7754
		],
		"mapped",
		[
			7755
		]
	],
	[
		[
			7755,
			7755
		],
		"valid"
	],
	[
		[
			7756,
			7756
		],
		"mapped",
		[
			7757
		]
	],
	[
		[
			7757,
			7757
		],
		"valid"
	],
	[
		[
			7758,
			7758
		],
		"mapped",
		[
			7759
		]
	],
	[
		[
			7759,
			7759
		],
		"valid"
	],
	[
		[
			7760,
			7760
		],
		"mapped",
		[
			7761
		]
	],
	[
		[
			7761,
			7761
		],
		"valid"
	],
	[
		[
			7762,
			7762
		],
		"mapped",
		[
			7763
		]
	],
	[
		[
			7763,
			7763
		],
		"valid"
	],
	[
		[
			7764,
			7764
		],
		"mapped",
		[
			7765
		]
	],
	[
		[
			7765,
			7765
		],
		"valid"
	],
	[
		[
			7766,
			7766
		],
		"mapped",
		[
			7767
		]
	],
	[
		[
			7767,
			7767
		],
		"valid"
	],
	[
		[
			7768,
			7768
		],
		"mapped",
		[
			7769
		]
	],
	[
		[
			7769,
			7769
		],
		"valid"
	],
	[
		[
			7770,
			7770
		],
		"mapped",
		[
			7771
		]
	],
	[
		[
			7771,
			7771
		],
		"valid"
	],
	[
		[
			7772,
			7772
		],
		"mapped",
		[
			7773
		]
	],
	[
		[
			7773,
			7773
		],
		"valid"
	],
	[
		[
			7774,
			7774
		],
		"mapped",
		[
			7775
		]
	],
	[
		[
			7775,
			7775
		],
		"valid"
	],
	[
		[
			7776,
			7776
		],
		"mapped",
		[
			7777
		]
	],
	[
		[
			7777,
			7777
		],
		"valid"
	],
	[
		[
			7778,
			7778
		],
		"mapped",
		[
			7779
		]
	],
	[
		[
			7779,
			7779
		],
		"valid"
	],
	[
		[
			7780,
			7780
		],
		"mapped",
		[
			7781
		]
	],
	[
		[
			7781,
			7781
		],
		"valid"
	],
	[
		[
			7782,
			7782
		],
		"mapped",
		[
			7783
		]
	],
	[
		[
			7783,
			7783
		],
		"valid"
	],
	[
		[
			7784,
			7784
		],
		"mapped",
		[
			7785
		]
	],
	[
		[
			7785,
			7785
		],
		"valid"
	],
	[
		[
			7786,
			7786
		],
		"mapped",
		[
			7787
		]
	],
	[
		[
			7787,
			7787
		],
		"valid"
	],
	[
		[
			7788,
			7788
		],
		"mapped",
		[
			7789
		]
	],
	[
		[
			7789,
			7789
		],
		"valid"
	],
	[
		[
			7790,
			7790
		],
		"mapped",
		[
			7791
		]
	],
	[
		[
			7791,
			7791
		],
		"valid"
	],
	[
		[
			7792,
			7792
		],
		"mapped",
		[
			7793
		]
	],
	[
		[
			7793,
			7793
		],
		"valid"
	],
	[
		[
			7794,
			7794
		],
		"mapped",
		[
			7795
		]
	],
	[
		[
			7795,
			7795
		],
		"valid"
	],
	[
		[
			7796,
			7796
		],
		"mapped",
		[
			7797
		]
	],
	[
		[
			7797,
			7797
		],
		"valid"
	],
	[
		[
			7798,
			7798
		],
		"mapped",
		[
			7799
		]
	],
	[
		[
			7799,
			7799
		],
		"valid"
	],
	[
		[
			7800,
			7800
		],
		"mapped",
		[
			7801
		]
	],
	[
		[
			7801,
			7801
		],
		"valid"
	],
	[
		[
			7802,
			7802
		],
		"mapped",
		[
			7803
		]
	],
	[
		[
			7803,
			7803
		],
		"valid"
	],
	[
		[
			7804,
			7804
		],
		"mapped",
		[
			7805
		]
	],
	[
		[
			7805,
			7805
		],
		"valid"
	],
	[
		[
			7806,
			7806
		],
		"mapped",
		[
			7807
		]
	],
	[
		[
			7807,
			7807
		],
		"valid"
	],
	[
		[
			7808,
			7808
		],
		"mapped",
		[
			7809
		]
	],
	[
		[
			7809,
			7809
		],
		"valid"
	],
	[
		[
			7810,
			7810
		],
		"mapped",
		[
			7811
		]
	],
	[
		[
			7811,
			7811
		],
		"valid"
	],
	[
		[
			7812,
			7812
		],
		"mapped",
		[
			7813
		]
	],
	[
		[
			7813,
			7813
		],
		"valid"
	],
	[
		[
			7814,
			7814
		],
		"mapped",
		[
			7815
		]
	],
	[
		[
			7815,
			7815
		],
		"valid"
	],
	[
		[
			7816,
			7816
		],
		"mapped",
		[
			7817
		]
	],
	[
		[
			7817,
			7817
		],
		"valid"
	],
	[
		[
			7818,
			7818
		],
		"mapped",
		[
			7819
		]
	],
	[
		[
			7819,
			7819
		],
		"valid"
	],
	[
		[
			7820,
			7820
		],
		"mapped",
		[
			7821
		]
	],
	[
		[
			7821,
			7821
		],
		"valid"
	],
	[
		[
			7822,
			7822
		],
		"mapped",
		[
			7823
		]
	],
	[
		[
			7823,
			7823
		],
		"valid"
	],
	[
		[
			7824,
			7824
		],
		"mapped",
		[
			7825
		]
	],
	[
		[
			7825,
			7825
		],
		"valid"
	],
	[
		[
			7826,
			7826
		],
		"mapped",
		[
			7827
		]
	],
	[
		[
			7827,
			7827
		],
		"valid"
	],
	[
		[
			7828,
			7828
		],
		"mapped",
		[
			7829
		]
	],
	[
		[
			7829,
			7833
		],
		"valid"
	],
	[
		[
			7834,
			7834
		],
		"mapped",
		[
			97,
			702
		]
	],
	[
		[
			7835,
			7835
		],
		"mapped",
		[
			7777
		]
	],
	[
		[
			7836,
			7837
		],
		"valid"
	],
	[
		[
			7838,
			7838
		],
		"mapped",
		[
			115,
			115
		]
	],
	[
		[
			7839,
			7839
		],
		"valid"
	],
	[
		[
			7840,
			7840
		],
		"mapped",
		[
			7841
		]
	],
	[
		[
			7841,
			7841
		],
		"valid"
	],
	[
		[
			7842,
			7842
		],
		"mapped",
		[
			7843
		]
	],
	[
		[
			7843,
			7843
		],
		"valid"
	],
	[
		[
			7844,
			7844
		],
		"mapped",
		[
			7845
		]
	],
	[
		[
			7845,
			7845
		],
		"valid"
	],
	[
		[
			7846,
			7846
		],
		"mapped",
		[
			7847
		]
	],
	[
		[
			7847,
			7847
		],
		"valid"
	],
	[
		[
			7848,
			7848
		],
		"mapped",
		[
			7849
		]
	],
	[
		[
			7849,
			7849
		],
		"valid"
	],
	[
		[
			7850,
			7850
		],
		"mapped",
		[
			7851
		]
	],
	[
		[
			7851,
			7851
		],
		"valid"
	],
	[
		[
			7852,
			7852
		],
		"mapped",
		[
			7853
		]
	],
	[
		[
			7853,
			7853
		],
		"valid"
	],
	[
		[
			7854,
			7854
		],
		"mapped",
		[
			7855
		]
	],
	[
		[
			7855,
			7855
		],
		"valid"
	],
	[
		[
			7856,
			7856
		],
		"mapped",
		[
			7857
		]
	],
	[
		[
			7857,
			7857
		],
		"valid"
	],
	[
		[
			7858,
			7858
		],
		"mapped",
		[
			7859
		]
	],
	[
		[
			7859,
			7859
		],
		"valid"
	],
	[
		[
			7860,
			7860
		],
		"mapped",
		[
			7861
		]
	],
	[
		[
			7861,
			7861
		],
		"valid"
	],
	[
		[
			7862,
			7862
		],
		"mapped",
		[
			7863
		]
	],
	[
		[
			7863,
			7863
		],
		"valid"
	],
	[
		[
			7864,
			7864
		],
		"mapped",
		[
			7865
		]
	],
	[
		[
			7865,
			7865
		],
		"valid"
	],
	[
		[
			7866,
			7866
		],
		"mapped",
		[
			7867
		]
	],
	[
		[
			7867,
			7867
		],
		"valid"
	],
	[
		[
			7868,
			7868
		],
		"mapped",
		[
			7869
		]
	],
	[
		[
			7869,
			7869
		],
		"valid"
	],
	[
		[
			7870,
			7870
		],
		"mapped",
		[
			7871
		]
	],
	[
		[
			7871,
			7871
		],
		"valid"
	],
	[
		[
			7872,
			7872
		],
		"mapped",
		[
			7873
		]
	],
	[
		[
			7873,
			7873
		],
		"valid"
	],
	[
		[
			7874,
			7874
		],
		"mapped",
		[
			7875
		]
	],
	[
		[
			7875,
			7875
		],
		"valid"
	],
	[
		[
			7876,
			7876
		],
		"mapped",
		[
			7877
		]
	],
	[
		[
			7877,
			7877
		],
		"valid"
	],
	[
		[
			7878,
			7878
		],
		"mapped",
		[
			7879
		]
	],
	[
		[
			7879,
			7879
		],
		"valid"
	],
	[
		[
			7880,
			7880
		],
		"mapped",
		[
			7881
		]
	],
	[
		[
			7881,
			7881
		],
		"valid"
	],
	[
		[
			7882,
			7882
		],
		"mapped",
		[
			7883
		]
	],
	[
		[
			7883,
			7883
		],
		"valid"
	],
	[
		[
			7884,
			7884
		],
		"mapped",
		[
			7885
		]
	],
	[
		[
			7885,
			7885
		],
		"valid"
	],
	[
		[
			7886,
			7886
		],
		"mapped",
		[
			7887
		]
	],
	[
		[
			7887,
			7887
		],
		"valid"
	],
	[
		[
			7888,
			7888
		],
		"mapped",
		[
			7889
		]
	],
	[
		[
			7889,
			7889
		],
		"valid"
	],
	[
		[
			7890,
			7890
		],
		"mapped",
		[
			7891
		]
	],
	[
		[
			7891,
			7891
		],
		"valid"
	],
	[
		[
			7892,
			7892
		],
		"mapped",
		[
			7893
		]
	],
	[
		[
			7893,
			7893
		],
		"valid"
	],
	[
		[
			7894,
			7894
		],
		"mapped",
		[
			7895
		]
	],
	[
		[
			7895,
			7895
		],
		"valid"
	],
	[
		[
			7896,
			7896
		],
		"mapped",
		[
			7897
		]
	],
	[
		[
			7897,
			7897
		],
		"valid"
	],
	[
		[
			7898,
			7898
		],
		"mapped",
		[
			7899
		]
	],
	[
		[
			7899,
			7899
		],
		"valid"
	],
	[
		[
			7900,
			7900
		],
		"mapped",
		[
			7901
		]
	],
	[
		[
			7901,
			7901
		],
		"valid"
	],
	[
		[
			7902,
			7902
		],
		"mapped",
		[
			7903
		]
	],
	[
		[
			7903,
			7903
		],
		"valid"
	],
	[
		[
			7904,
			7904
		],
		"mapped",
		[
			7905
		]
	],
	[
		[
			7905,
			7905
		],
		"valid"
	],
	[
		[
			7906,
			7906
		],
		"mapped",
		[
			7907
		]
	],
	[
		[
			7907,
			7907
		],
		"valid"
	],
	[
		[
			7908,
			7908
		],
		"mapped",
		[
			7909
		]
	],
	[
		[
			7909,
			7909
		],
		"valid"
	],
	[
		[
			7910,
			7910
		],
		"mapped",
		[
			7911
		]
	],
	[
		[
			7911,
			7911
		],
		"valid"
	],
	[
		[
			7912,
			7912
		],
		"mapped",
		[
			7913
		]
	],
	[
		[
			7913,
			7913
		],
		"valid"
	],
	[
		[
			7914,
			7914
		],
		"mapped",
		[
			7915
		]
	],
	[
		[
			7915,
			7915
		],
		"valid"
	],
	[
		[
			7916,
			7916
		],
		"mapped",
		[
			7917
		]
	],
	[
		[
			7917,
			7917
		],
		"valid"
	],
	[
		[
			7918,
			7918
		],
		"mapped",
		[
			7919
		]
	],
	[
		[
			7919,
			7919
		],
		"valid"
	],
	[
		[
			7920,
			7920
		],
		"mapped",
		[
			7921
		]
	],
	[
		[
			7921,
			7921
		],
		"valid"
	],
	[
		[
			7922,
			7922
		],
		"mapped",
		[
			7923
		]
	],
	[
		[
			7923,
			7923
		],
		"valid"
	],
	[
		[
			7924,
			7924
		],
		"mapped",
		[
			7925
		]
	],
	[
		[
			7925,
			7925
		],
		"valid"
	],
	[
		[
			7926,
			7926
		],
		"mapped",
		[
			7927
		]
	],
	[
		[
			7927,
			7927
		],
		"valid"
	],
	[
		[
			7928,
			7928
		],
		"mapped",
		[
			7929
		]
	],
	[
		[
			7929,
			7929
		],
		"valid"
	],
	[
		[
			7930,
			7930
		],
		"mapped",
		[
			7931
		]
	],
	[
		[
			7931,
			7931
		],
		"valid"
	],
	[
		[
			7932,
			7932
		],
		"mapped",
		[
			7933
		]
	],
	[
		[
			7933,
			7933
		],
		"valid"
	],
	[
		[
			7934,
			7934
		],
		"mapped",
		[
			7935
		]
	],
	[
		[
			7935,
			7935
		],
		"valid"
	],
	[
		[
			7936,
			7943
		],
		"valid"
	],
	[
		[
			7944,
			7944
		],
		"mapped",
		[
			7936
		]
	],
	[
		[
			7945,
			7945
		],
		"mapped",
		[
			7937
		]
	],
	[
		[
			7946,
			7946
		],
		"mapped",
		[
			7938
		]
	],
	[
		[
			7947,
			7947
		],
		"mapped",
		[
			7939
		]
	],
	[
		[
			7948,
			7948
		],
		"mapped",
		[
			7940
		]
	],
	[
		[
			7949,
			7949
		],
		"mapped",
		[
			7941
		]
	],
	[
		[
			7950,
			7950
		],
		"mapped",
		[
			7942
		]
	],
	[
		[
			7951,
			7951
		],
		"mapped",
		[
			7943
		]
	],
	[
		[
			7952,
			7957
		],
		"valid"
	],
	[
		[
			7958,
			7959
		],
		"disallowed"
	],
	[
		[
			7960,
			7960
		],
		"mapped",
		[
			7952
		]
	],
	[
		[
			7961,
			7961
		],
		"mapped",
		[
			7953
		]
	],
	[
		[
			7962,
			7962
		],
		"mapped",
		[
			7954
		]
	],
	[
		[
			7963,
			7963
		],
		"mapped",
		[
			7955
		]
	],
	[
		[
			7964,
			7964
		],
		"mapped",
		[
			7956
		]
	],
	[
		[
			7965,
			7965
		],
		"mapped",
		[
			7957
		]
	],
	[
		[
			7966,
			7967
		],
		"disallowed"
	],
	[
		[
			7968,
			7975
		],
		"valid"
	],
	[
		[
			7976,
			7976
		],
		"mapped",
		[
			7968
		]
	],
	[
		[
			7977,
			7977
		],
		"mapped",
		[
			7969
		]
	],
	[
		[
			7978,
			7978
		],
		"mapped",
		[
			7970
		]
	],
	[
		[
			7979,
			7979
		],
		"mapped",
		[
			7971
		]
	],
	[
		[
			7980,
			7980
		],
		"mapped",
		[
			7972
		]
	],
	[
		[
			7981,
			7981
		],
		"mapped",
		[
			7973
		]
	],
	[
		[
			7982,
			7982
		],
		"mapped",
		[
			7974
		]
	],
	[
		[
			7983,
			7983
		],
		"mapped",
		[
			7975
		]
	],
	[
		[
			7984,
			7991
		],
		"valid"
	],
	[
		[
			7992,
			7992
		],
		"mapped",
		[
			7984
		]
	],
	[
		[
			7993,
			7993
		],
		"mapped",
		[
			7985
		]
	],
	[
		[
			7994,
			7994
		],
		"mapped",
		[
			7986
		]
	],
	[
		[
			7995,
			7995
		],
		"mapped",
		[
			7987
		]
	],
	[
		[
			7996,
			7996
		],
		"mapped",
		[
			7988
		]
	],
	[
		[
			7997,
			7997
		],
		"mapped",
		[
			7989
		]
	],
	[
		[
			7998,
			7998
		],
		"mapped",
		[
			7990
		]
	],
	[
		[
			7999,
			7999
		],
		"mapped",
		[
			7991
		]
	],
	[
		[
			8000,
			8005
		],
		"valid"
	],
	[
		[
			8006,
			8007
		],
		"disallowed"
	],
	[
		[
			8008,
			8008
		],
		"mapped",
		[
			8000
		]
	],
	[
		[
			8009,
			8009
		],
		"mapped",
		[
			8001
		]
	],
	[
		[
			8010,
			8010
		],
		"mapped",
		[
			8002
		]
	],
	[
		[
			8011,
			8011
		],
		"mapped",
		[
			8003
		]
	],
	[
		[
			8012,
			8012
		],
		"mapped",
		[
			8004
		]
	],
	[
		[
			8013,
			8013
		],
		"mapped",
		[
			8005
		]
	],
	[
		[
			8014,
			8015
		],
		"disallowed"
	],
	[
		[
			8016,
			8023
		],
		"valid"
	],
	[
		[
			8024,
			8024
		],
		"disallowed"
	],
	[
		[
			8025,
			8025
		],
		"mapped",
		[
			8017
		]
	],
	[
		[
			8026,
			8026
		],
		"disallowed"
	],
	[
		[
			8027,
			8027
		],
		"mapped",
		[
			8019
		]
	],
	[
		[
			8028,
			8028
		],
		"disallowed"
	],
	[
		[
			8029,
			8029
		],
		"mapped",
		[
			8021
		]
	],
	[
		[
			8030,
			8030
		],
		"disallowed"
	],
	[
		[
			8031,
			8031
		],
		"mapped",
		[
			8023
		]
	],
	[
		[
			8032,
			8039
		],
		"valid"
	],
	[
		[
			8040,
			8040
		],
		"mapped",
		[
			8032
		]
	],
	[
		[
			8041,
			8041
		],
		"mapped",
		[
			8033
		]
	],
	[
		[
			8042,
			8042
		],
		"mapped",
		[
			8034
		]
	],
	[
		[
			8043,
			8043
		],
		"mapped",
		[
			8035
		]
	],
	[
		[
			8044,
			8044
		],
		"mapped",
		[
			8036
		]
	],
	[
		[
			8045,
			8045
		],
		"mapped",
		[
			8037
		]
	],
	[
		[
			8046,
			8046
		],
		"mapped",
		[
			8038
		]
	],
	[
		[
			8047,
			8047
		],
		"mapped",
		[
			8039
		]
	],
	[
		[
			8048,
			8048
		],
		"valid"
	],
	[
		[
			8049,
			8049
		],
		"mapped",
		[
			940
		]
	],
	[
		[
			8050,
			8050
		],
		"valid"
	],
	[
		[
			8051,
			8051
		],
		"mapped",
		[
			941
		]
	],
	[
		[
			8052,
			8052
		],
		"valid"
	],
	[
		[
			8053,
			8053
		],
		"mapped",
		[
			942
		]
	],
	[
		[
			8054,
			8054
		],
		"valid"
	],
	[
		[
			8055,
			8055
		],
		"mapped",
		[
			943
		]
	],
	[
		[
			8056,
			8056
		],
		"valid"
	],
	[
		[
			8057,
			8057
		],
		"mapped",
		[
			972
		]
	],
	[
		[
			8058,
			8058
		],
		"valid"
	],
	[
		[
			8059,
			8059
		],
		"mapped",
		[
			973
		]
	],
	[
		[
			8060,
			8060
		],
		"valid"
	],
	[
		[
			8061,
			8061
		],
		"mapped",
		[
			974
		]
	],
	[
		[
			8062,
			8063
		],
		"disallowed"
	],
	[
		[
			8064,
			8064
		],
		"mapped",
		[
			7936,
			953
		]
	],
	[
		[
			8065,
			8065
		],
		"mapped",
		[
			7937,
			953
		]
	],
	[
		[
			8066,
			8066
		],
		"mapped",
		[
			7938,
			953
		]
	],
	[
		[
			8067,
			8067
		],
		"mapped",
		[
			7939,
			953
		]
	],
	[
		[
			8068,
			8068
		],
		"mapped",
		[
			7940,
			953
		]
	],
	[
		[
			8069,
			8069
		],
		"mapped",
		[
			7941,
			953
		]
	],
	[
		[
			8070,
			8070
		],
		"mapped",
		[
			7942,
			953
		]
	],
	[
		[
			8071,
			8071
		],
		"mapped",
		[
			7943,
			953
		]
	],
	[
		[
			8072,
			8072
		],
		"mapped",
		[
			7936,
			953
		]
	],
	[
		[
			8073,
			8073
		],
		"mapped",
		[
			7937,
			953
		]
	],
	[
		[
			8074,
			8074
		],
		"mapped",
		[
			7938,
			953
		]
	],
	[
		[
			8075,
			8075
		],
		"mapped",
		[
			7939,
			953
		]
	],
	[
		[
			8076,
			8076
		],
		"mapped",
		[
			7940,
			953
		]
	],
	[
		[
			8077,
			8077
		],
		"mapped",
		[
			7941,
			953
		]
	],
	[
		[
			8078,
			8078
		],
		"mapped",
		[
			7942,
			953
		]
	],
	[
		[
			8079,
			8079
		],
		"mapped",
		[
			7943,
			953
		]
	],
	[
		[
			8080,
			8080
		],
		"mapped",
		[
			7968,
			953
		]
	],
	[
		[
			8081,
			8081
		],
		"mapped",
		[
			7969,
			953
		]
	],
	[
		[
			8082,
			8082
		],
		"mapped",
		[
			7970,
			953
		]
	],
	[
		[
			8083,
			8083
		],
		"mapped",
		[
			7971,
			953
		]
	],
	[
		[
			8084,
			8084
		],
		"mapped",
		[
			7972,
			953
		]
	],
	[
		[
			8085,
			8085
		],
		"mapped",
		[
			7973,
			953
		]
	],
	[
		[
			8086,
			8086
		],
		"mapped",
		[
			7974,
			953
		]
	],
	[
		[
			8087,
			8087
		],
		"mapped",
		[
			7975,
			953
		]
	],
	[
		[
			8088,
			8088
		],
		"mapped",
		[
			7968,
			953
		]
	],
	[
		[
			8089,
			8089
		],
		"mapped",
		[
			7969,
			953
		]
	],
	[
		[
			8090,
			8090
		],
		"mapped",
		[
			7970,
			953
		]
	],
	[
		[
			8091,
			8091
		],
		"mapped",
		[
			7971,
			953
		]
	],
	[
		[
			8092,
			8092
		],
		"mapped",
		[
			7972,
			953
		]
	],
	[
		[
			8093,
			8093
		],
		"mapped",
		[
			7973,
			953
		]
	],
	[
		[
			8094,
			8094
		],
		"mapped",
		[
			7974,
			953
		]
	],
	[
		[
			8095,
			8095
		],
		"mapped",
		[
			7975,
			953
		]
	],
	[
		[
			8096,
			8096
		],
		"mapped",
		[
			8032,
			953
		]
	],
	[
		[
			8097,
			8097
		],
		"mapped",
		[
			8033,
			953
		]
	],
	[
		[
			8098,
			8098
		],
		"mapped",
		[
			8034,
			953
		]
	],
	[
		[
			8099,
			8099
		],
		"mapped",
		[
			8035,
			953
		]
	],
	[
		[
			8100,
			8100
		],
		"mapped",
		[
			8036,
			953
		]
	],
	[
		[
			8101,
			8101
		],
		"mapped",
		[
			8037,
			953
		]
	],
	[
		[
			8102,
			8102
		],
		"mapped",
		[
			8038,
			953
		]
	],
	[
		[
			8103,
			8103
		],
		"mapped",
		[
			8039,
			953
		]
	],
	[
		[
			8104,
			8104
		],
		"mapped",
		[
			8032,
			953
		]
	],
	[
		[
			8105,
			8105
		],
		"mapped",
		[
			8033,
			953
		]
	],
	[
		[
			8106,
			8106
		],
		"mapped",
		[
			8034,
			953
		]
	],
	[
		[
			8107,
			8107
		],
		"mapped",
		[
			8035,
			953
		]
	],
	[
		[
			8108,
			8108
		],
		"mapped",
		[
			8036,
			953
		]
	],
	[
		[
			8109,
			8109
		],
		"mapped",
		[
			8037,
			953
		]
	],
	[
		[
			8110,
			8110
		],
		"mapped",
		[
			8038,
			953
		]
	],
	[
		[
			8111,
			8111
		],
		"mapped",
		[
			8039,
			953
		]
	],
	[
		[
			8112,
			8113
		],
		"valid"
	],
	[
		[
			8114,
			8114
		],
		"mapped",
		[
			8048,
			953
		]
	],
	[
		[
			8115,
			8115
		],
		"mapped",
		[
			945,
			953
		]
	],
	[
		[
			8116,
			8116
		],
		"mapped",
		[
			940,
			953
		]
	],
	[
		[
			8117,
			8117
		],
		"disallowed"
	],
	[
		[
			8118,
			8118
		],
		"valid"
	],
	[
		[
			8119,
			8119
		],
		"mapped",
		[
			8118,
			953
		]
	],
	[
		[
			8120,
			8120
		],
		"mapped",
		[
			8112
		]
	],
	[
		[
			8121,
			8121
		],
		"mapped",
		[
			8113
		]
	],
	[
		[
			8122,
			8122
		],
		"mapped",
		[
			8048
		]
	],
	[
		[
			8123,
			8123
		],
		"mapped",
		[
			940
		]
	],
	[
		[
			8124,
			8124
		],
		"mapped",
		[
			945,
			953
		]
	],
	[
		[
			8125,
			8125
		],
		"disallowed_STD3_mapped",
		[
			32,
			787
		]
	],
	[
		[
			8126,
			8126
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			8127,
			8127
		],
		"disallowed_STD3_mapped",
		[
			32,
			787
		]
	],
	[
		[
			8128,
			8128
		],
		"disallowed_STD3_mapped",
		[
			32,
			834
		]
	],
	[
		[
			8129,
			8129
		],
		"disallowed_STD3_mapped",
		[
			32,
			776,
			834
		]
	],
	[
		[
			8130,
			8130
		],
		"mapped",
		[
			8052,
			953
		]
	],
	[
		[
			8131,
			8131
		],
		"mapped",
		[
			951,
			953
		]
	],
	[
		[
			8132,
			8132
		],
		"mapped",
		[
			942,
			953
		]
	],
	[
		[
			8133,
			8133
		],
		"disallowed"
	],
	[
		[
			8134,
			8134
		],
		"valid"
	],
	[
		[
			8135,
			8135
		],
		"mapped",
		[
			8134,
			953
		]
	],
	[
		[
			8136,
			8136
		],
		"mapped",
		[
			8050
		]
	],
	[
		[
			8137,
			8137
		],
		"mapped",
		[
			941
		]
	],
	[
		[
			8138,
			8138
		],
		"mapped",
		[
			8052
		]
	],
	[
		[
			8139,
			8139
		],
		"mapped",
		[
			942
		]
	],
	[
		[
			8140,
			8140
		],
		"mapped",
		[
			951,
			953
		]
	],
	[
		[
			8141,
			8141
		],
		"disallowed_STD3_mapped",
		[
			32,
			787,
			768
		]
	],
	[
		[
			8142,
			8142
		],
		"disallowed_STD3_mapped",
		[
			32,
			787,
			769
		]
	],
	[
		[
			8143,
			8143
		],
		"disallowed_STD3_mapped",
		[
			32,
			787,
			834
		]
	],
	[
		[
			8144,
			8146
		],
		"valid"
	],
	[
		[
			8147,
			8147
		],
		"mapped",
		[
			912
		]
	],
	[
		[
			8148,
			8149
		],
		"disallowed"
	],
	[
		[
			8150,
			8151
		],
		"valid"
	],
	[
		[
			8152,
			8152
		],
		"mapped",
		[
			8144
		]
	],
	[
		[
			8153,
			8153
		],
		"mapped",
		[
			8145
		]
	],
	[
		[
			8154,
			8154
		],
		"mapped",
		[
			8054
		]
	],
	[
		[
			8155,
			8155
		],
		"mapped",
		[
			943
		]
	],
	[
		[
			8156,
			8156
		],
		"disallowed"
	],
	[
		[
			8157,
			8157
		],
		"disallowed_STD3_mapped",
		[
			32,
			788,
			768
		]
	],
	[
		[
			8158,
			8158
		],
		"disallowed_STD3_mapped",
		[
			32,
			788,
			769
		]
	],
	[
		[
			8159,
			8159
		],
		"disallowed_STD3_mapped",
		[
			32,
			788,
			834
		]
	],
	[
		[
			8160,
			8162
		],
		"valid"
	],
	[
		[
			8163,
			8163
		],
		"mapped",
		[
			944
		]
	],
	[
		[
			8164,
			8167
		],
		"valid"
	],
	[
		[
			8168,
			8168
		],
		"mapped",
		[
			8160
		]
	],
	[
		[
			8169,
			8169
		],
		"mapped",
		[
			8161
		]
	],
	[
		[
			8170,
			8170
		],
		"mapped",
		[
			8058
		]
	],
	[
		[
			8171,
			8171
		],
		"mapped",
		[
			973
		]
	],
	[
		[
			8172,
			8172
		],
		"mapped",
		[
			8165
		]
	],
	[
		[
			8173,
			8173
		],
		"disallowed_STD3_mapped",
		[
			32,
			776,
			768
		]
	],
	[
		[
			8174,
			8174
		],
		"disallowed_STD3_mapped",
		[
			32,
			776,
			769
		]
	],
	[
		[
			8175,
			8175
		],
		"disallowed_STD3_mapped",
		[
			96
		]
	],
	[
		[
			8176,
			8177
		],
		"disallowed"
	],
	[
		[
			8178,
			8178
		],
		"mapped",
		[
			8060,
			953
		]
	],
	[
		[
			8179,
			8179
		],
		"mapped",
		[
			969,
			953
		]
	],
	[
		[
			8180,
			8180
		],
		"mapped",
		[
			974,
			953
		]
	],
	[
		[
			8181,
			8181
		],
		"disallowed"
	],
	[
		[
			8182,
			8182
		],
		"valid"
	],
	[
		[
			8183,
			8183
		],
		"mapped",
		[
			8182,
			953
		]
	],
	[
		[
			8184,
			8184
		],
		"mapped",
		[
			8056
		]
	],
	[
		[
			8185,
			8185
		],
		"mapped",
		[
			972
		]
	],
	[
		[
			8186,
			8186
		],
		"mapped",
		[
			8060
		]
	],
	[
		[
			8187,
			8187
		],
		"mapped",
		[
			974
		]
	],
	[
		[
			8188,
			8188
		],
		"mapped",
		[
			969,
			953
		]
	],
	[
		[
			8189,
			8189
		],
		"disallowed_STD3_mapped",
		[
			32,
			769
		]
	],
	[
		[
			8190,
			8190
		],
		"disallowed_STD3_mapped",
		[
			32,
			788
		]
	],
	[
		[
			8191,
			8191
		],
		"disallowed"
	],
	[
		[
			8192,
			8202
		],
		"disallowed_STD3_mapped",
		[
			32
		]
	],
	[
		[
			8203,
			8203
		],
		"ignored"
	],
	[
		[
			8204,
			8205
		],
		"deviation",
		[
		]
	],
	[
		[
			8206,
			8207
		],
		"disallowed"
	],
	[
		[
			8208,
			8208
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8209,
			8209
		],
		"mapped",
		[
			8208
		]
	],
	[
		[
			8210,
			8214
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8215,
			8215
		],
		"disallowed_STD3_mapped",
		[
			32,
			819
		]
	],
	[
		[
			8216,
			8227
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8228,
			8230
		],
		"disallowed"
	],
	[
		[
			8231,
			8231
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8232,
			8238
		],
		"disallowed"
	],
	[
		[
			8239,
			8239
		],
		"disallowed_STD3_mapped",
		[
			32
		]
	],
	[
		[
			8240,
			8242
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8243,
			8243
		],
		"mapped",
		[
			8242,
			8242
		]
	],
	[
		[
			8244,
			8244
		],
		"mapped",
		[
			8242,
			8242,
			8242
		]
	],
	[
		[
			8245,
			8245
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8246,
			8246
		],
		"mapped",
		[
			8245,
			8245
		]
	],
	[
		[
			8247,
			8247
		],
		"mapped",
		[
			8245,
			8245,
			8245
		]
	],
	[
		[
			8248,
			8251
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8252,
			8252
		],
		"disallowed_STD3_mapped",
		[
			33,
			33
		]
	],
	[
		[
			8253,
			8253
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8254,
			8254
		],
		"disallowed_STD3_mapped",
		[
			32,
			773
		]
	],
	[
		[
			8255,
			8262
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8263,
			8263
		],
		"disallowed_STD3_mapped",
		[
			63,
			63
		]
	],
	[
		[
			8264,
			8264
		],
		"disallowed_STD3_mapped",
		[
			63,
			33
		]
	],
	[
		[
			8265,
			8265
		],
		"disallowed_STD3_mapped",
		[
			33,
			63
		]
	],
	[
		[
			8266,
			8269
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8270,
			8274
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8275,
			8276
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8277,
			8278
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8279,
			8279
		],
		"mapped",
		[
			8242,
			8242,
			8242,
			8242
		]
	],
	[
		[
			8280,
			8286
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8287,
			8287
		],
		"disallowed_STD3_mapped",
		[
			32
		]
	],
	[
		[
			8288,
			8288
		],
		"ignored"
	],
	[
		[
			8289,
			8291
		],
		"disallowed"
	],
	[
		[
			8292,
			8292
		],
		"ignored"
	],
	[
		[
			8293,
			8293
		],
		"disallowed"
	],
	[
		[
			8294,
			8297
		],
		"disallowed"
	],
	[
		[
			8298,
			8303
		],
		"disallowed"
	],
	[
		[
			8304,
			8304
		],
		"mapped",
		[
			48
		]
	],
	[
		[
			8305,
			8305
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			8306,
			8307
		],
		"disallowed"
	],
	[
		[
			8308,
			8308
		],
		"mapped",
		[
			52
		]
	],
	[
		[
			8309,
			8309
		],
		"mapped",
		[
			53
		]
	],
	[
		[
			8310,
			8310
		],
		"mapped",
		[
			54
		]
	],
	[
		[
			8311,
			8311
		],
		"mapped",
		[
			55
		]
	],
	[
		[
			8312,
			8312
		],
		"mapped",
		[
			56
		]
	],
	[
		[
			8313,
			8313
		],
		"mapped",
		[
			57
		]
	],
	[
		[
			8314,
			8314
		],
		"disallowed_STD3_mapped",
		[
			43
		]
	],
	[
		[
			8315,
			8315
		],
		"mapped",
		[
			8722
		]
	],
	[
		[
			8316,
			8316
		],
		"disallowed_STD3_mapped",
		[
			61
		]
	],
	[
		[
			8317,
			8317
		],
		"disallowed_STD3_mapped",
		[
			40
		]
	],
	[
		[
			8318,
			8318
		],
		"disallowed_STD3_mapped",
		[
			41
		]
	],
	[
		[
			8319,
			8319
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			8320,
			8320
		],
		"mapped",
		[
			48
		]
	],
	[
		[
			8321,
			8321
		],
		"mapped",
		[
			49
		]
	],
	[
		[
			8322,
			8322
		],
		"mapped",
		[
			50
		]
	],
	[
		[
			8323,
			8323
		],
		"mapped",
		[
			51
		]
	],
	[
		[
			8324,
			8324
		],
		"mapped",
		[
			52
		]
	],
	[
		[
			8325,
			8325
		],
		"mapped",
		[
			53
		]
	],
	[
		[
			8326,
			8326
		],
		"mapped",
		[
			54
		]
	],
	[
		[
			8327,
			8327
		],
		"mapped",
		[
			55
		]
	],
	[
		[
			8328,
			8328
		],
		"mapped",
		[
			56
		]
	],
	[
		[
			8329,
			8329
		],
		"mapped",
		[
			57
		]
	],
	[
		[
			8330,
			8330
		],
		"disallowed_STD3_mapped",
		[
			43
		]
	],
	[
		[
			8331,
			8331
		],
		"mapped",
		[
			8722
		]
	],
	[
		[
			8332,
			8332
		],
		"disallowed_STD3_mapped",
		[
			61
		]
	],
	[
		[
			8333,
			8333
		],
		"disallowed_STD3_mapped",
		[
			40
		]
	],
	[
		[
			8334,
			8334
		],
		"disallowed_STD3_mapped",
		[
			41
		]
	],
	[
		[
			8335,
			8335
		],
		"disallowed"
	],
	[
		[
			8336,
			8336
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			8337,
			8337
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			8338,
			8338
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			8339,
			8339
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			8340,
			8340
		],
		"mapped",
		[
			601
		]
	],
	[
		[
			8341,
			8341
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			8342,
			8342
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			8343,
			8343
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			8344,
			8344
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			8345,
			8345
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			8346,
			8346
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			8347,
			8347
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			8348,
			8348
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			8349,
			8351
		],
		"disallowed"
	],
	[
		[
			8352,
			8359
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8360,
			8360
		],
		"mapped",
		[
			114,
			115
		]
	],
	[
		[
			8361,
			8362
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8363,
			8363
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8364,
			8364
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8365,
			8367
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8368,
			8369
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8370,
			8373
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8374,
			8376
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8377,
			8377
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8378,
			8378
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8379,
			8381
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8382,
			8382
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8383,
			8399
		],
		"disallowed"
	],
	[
		[
			8400,
			8417
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8418,
			8419
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8420,
			8426
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8427,
			8427
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8428,
			8431
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8432,
			8432
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8433,
			8447
		],
		"disallowed"
	],
	[
		[
			8448,
			8448
		],
		"disallowed_STD3_mapped",
		[
			97,
			47,
			99
		]
	],
	[
		[
			8449,
			8449
		],
		"disallowed_STD3_mapped",
		[
			97,
			47,
			115
		]
	],
	[
		[
			8450,
			8450
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			8451,
			8451
		],
		"mapped",
		[
			176,
			99
		]
	],
	[
		[
			8452,
			8452
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8453,
			8453
		],
		"disallowed_STD3_mapped",
		[
			99,
			47,
			111
		]
	],
	[
		[
			8454,
			8454
		],
		"disallowed_STD3_mapped",
		[
			99,
			47,
			117
		]
	],
	[
		[
			8455,
			8455
		],
		"mapped",
		[
			603
		]
	],
	[
		[
			8456,
			8456
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8457,
			8457
		],
		"mapped",
		[
			176,
			102
		]
	],
	[
		[
			8458,
			8458
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			8459,
			8462
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			8463,
			8463
		],
		"mapped",
		[
			295
		]
	],
	[
		[
			8464,
			8465
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			8466,
			8467
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			8468,
			8468
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8469,
			8469
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			8470,
			8470
		],
		"mapped",
		[
			110,
			111
		]
	],
	[
		[
			8471,
			8472
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8473,
			8473
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			8474,
			8474
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			8475,
			8477
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			8478,
			8479
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8480,
			8480
		],
		"mapped",
		[
			115,
			109
		]
	],
	[
		[
			8481,
			8481
		],
		"mapped",
		[
			116,
			101,
			108
		]
	],
	[
		[
			8482,
			8482
		],
		"mapped",
		[
			116,
			109
		]
	],
	[
		[
			8483,
			8483
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8484,
			8484
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			8485,
			8485
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8486,
			8486
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			8487,
			8487
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8488,
			8488
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			8489,
			8489
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8490,
			8490
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			8491,
			8491
		],
		"mapped",
		[
			229
		]
	],
	[
		[
			8492,
			8492
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			8493,
			8493
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			8494,
			8494
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8495,
			8496
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			8497,
			8497
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			8498,
			8498
		],
		"disallowed"
	],
	[
		[
			8499,
			8499
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			8500,
			8500
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			8501,
			8501
		],
		"mapped",
		[
			1488
		]
	],
	[
		[
			8502,
			8502
		],
		"mapped",
		[
			1489
		]
	],
	[
		[
			8503,
			8503
		],
		"mapped",
		[
			1490
		]
	],
	[
		[
			8504,
			8504
		],
		"mapped",
		[
			1491
		]
	],
	[
		[
			8505,
			8505
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			8506,
			8506
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8507,
			8507
		],
		"mapped",
		[
			102,
			97,
			120
		]
	],
	[
		[
			8508,
			8508
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			8509,
			8510
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			8511,
			8511
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			8512,
			8512
		],
		"mapped",
		[
			8721
		]
	],
	[
		[
			8513,
			8516
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8517,
			8518
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			8519,
			8519
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			8520,
			8520
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			8521,
			8521
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			8522,
			8523
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8524,
			8524
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8525,
			8525
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8526,
			8526
		],
		"valid"
	],
	[
		[
			8527,
			8527
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8528,
			8528
		],
		"mapped",
		[
			49,
			8260,
			55
		]
	],
	[
		[
			8529,
			8529
		],
		"mapped",
		[
			49,
			8260,
			57
		]
	],
	[
		[
			8530,
			8530
		],
		"mapped",
		[
			49,
			8260,
			49,
			48
		]
	],
	[
		[
			8531,
			8531
		],
		"mapped",
		[
			49,
			8260,
			51
		]
	],
	[
		[
			8532,
			8532
		],
		"mapped",
		[
			50,
			8260,
			51
		]
	],
	[
		[
			8533,
			8533
		],
		"mapped",
		[
			49,
			8260,
			53
		]
	],
	[
		[
			8534,
			8534
		],
		"mapped",
		[
			50,
			8260,
			53
		]
	],
	[
		[
			8535,
			8535
		],
		"mapped",
		[
			51,
			8260,
			53
		]
	],
	[
		[
			8536,
			8536
		],
		"mapped",
		[
			52,
			8260,
			53
		]
	],
	[
		[
			8537,
			8537
		],
		"mapped",
		[
			49,
			8260,
			54
		]
	],
	[
		[
			8538,
			8538
		],
		"mapped",
		[
			53,
			8260,
			54
		]
	],
	[
		[
			8539,
			8539
		],
		"mapped",
		[
			49,
			8260,
			56
		]
	],
	[
		[
			8540,
			8540
		],
		"mapped",
		[
			51,
			8260,
			56
		]
	],
	[
		[
			8541,
			8541
		],
		"mapped",
		[
			53,
			8260,
			56
		]
	],
	[
		[
			8542,
			8542
		],
		"mapped",
		[
			55,
			8260,
			56
		]
	],
	[
		[
			8543,
			8543
		],
		"mapped",
		[
			49,
			8260
		]
	],
	[
		[
			8544,
			8544
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			8545,
			8545
		],
		"mapped",
		[
			105,
			105
		]
	],
	[
		[
			8546,
			8546
		],
		"mapped",
		[
			105,
			105,
			105
		]
	],
	[
		[
			8547,
			8547
		],
		"mapped",
		[
			105,
			118
		]
	],
	[
		[
			8548,
			8548
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			8549,
			8549
		],
		"mapped",
		[
			118,
			105
		]
	],
	[
		[
			8550,
			8550
		],
		"mapped",
		[
			118,
			105,
			105
		]
	],
	[
		[
			8551,
			8551
		],
		"mapped",
		[
			118,
			105,
			105,
			105
		]
	],
	[
		[
			8552,
			8552
		],
		"mapped",
		[
			105,
			120
		]
	],
	[
		[
			8553,
			8553
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			8554,
			8554
		],
		"mapped",
		[
			120,
			105
		]
	],
	[
		[
			8555,
			8555
		],
		"mapped",
		[
			120,
			105,
			105
		]
	],
	[
		[
			8556,
			8556
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			8557,
			8557
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			8558,
			8558
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			8559,
			8559
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			8560,
			8560
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			8561,
			8561
		],
		"mapped",
		[
			105,
			105
		]
	],
	[
		[
			8562,
			8562
		],
		"mapped",
		[
			105,
			105,
			105
		]
	],
	[
		[
			8563,
			8563
		],
		"mapped",
		[
			105,
			118
		]
	],
	[
		[
			8564,
			8564
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			8565,
			8565
		],
		"mapped",
		[
			118,
			105
		]
	],
	[
		[
			8566,
			8566
		],
		"mapped",
		[
			118,
			105,
			105
		]
	],
	[
		[
			8567,
			8567
		],
		"mapped",
		[
			118,
			105,
			105,
			105
		]
	],
	[
		[
			8568,
			8568
		],
		"mapped",
		[
			105,
			120
		]
	],
	[
		[
			8569,
			8569
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			8570,
			8570
		],
		"mapped",
		[
			120,
			105
		]
	],
	[
		[
			8571,
			8571
		],
		"mapped",
		[
			120,
			105,
			105
		]
	],
	[
		[
			8572,
			8572
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			8573,
			8573
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			8574,
			8574
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			8575,
			8575
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			8576,
			8578
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8579,
			8579
		],
		"disallowed"
	],
	[
		[
			8580,
			8580
		],
		"valid"
	],
	[
		[
			8581,
			8584
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8585,
			8585
		],
		"mapped",
		[
			48,
			8260,
			51
		]
	],
	[
		[
			8586,
			8587
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8588,
			8591
		],
		"disallowed"
	],
	[
		[
			8592,
			8682
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8683,
			8691
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8692,
			8703
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8704,
			8747
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8748,
			8748
		],
		"mapped",
		[
			8747,
			8747
		]
	],
	[
		[
			8749,
			8749
		],
		"mapped",
		[
			8747,
			8747,
			8747
		]
	],
	[
		[
			8750,
			8750
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8751,
			8751
		],
		"mapped",
		[
			8750,
			8750
		]
	],
	[
		[
			8752,
			8752
		],
		"mapped",
		[
			8750,
			8750,
			8750
		]
	],
	[
		[
			8753,
			8799
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8800,
			8800
		],
		"disallowed_STD3_valid"
	],
	[
		[
			8801,
			8813
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8814,
			8815
		],
		"disallowed_STD3_valid"
	],
	[
		[
			8816,
			8945
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8946,
			8959
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8960,
			8960
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8961,
			8961
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			8962,
			9000
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9001,
			9001
		],
		"mapped",
		[
			12296
		]
	],
	[
		[
			9002,
			9002
		],
		"mapped",
		[
			12297
		]
	],
	[
		[
			9003,
			9082
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9083,
			9083
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9084,
			9084
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9085,
			9114
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9115,
			9166
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9167,
			9168
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9169,
			9179
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9180,
			9191
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9192,
			9192
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9193,
			9203
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9204,
			9210
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9211,
			9215
		],
		"disallowed"
	],
	[
		[
			9216,
			9252
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9253,
			9254
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9255,
			9279
		],
		"disallowed"
	],
	[
		[
			9280,
			9290
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9291,
			9311
		],
		"disallowed"
	],
	[
		[
			9312,
			9312
		],
		"mapped",
		[
			49
		]
	],
	[
		[
			9313,
			9313
		],
		"mapped",
		[
			50
		]
	],
	[
		[
			9314,
			9314
		],
		"mapped",
		[
			51
		]
	],
	[
		[
			9315,
			9315
		],
		"mapped",
		[
			52
		]
	],
	[
		[
			9316,
			9316
		],
		"mapped",
		[
			53
		]
	],
	[
		[
			9317,
			9317
		],
		"mapped",
		[
			54
		]
	],
	[
		[
			9318,
			9318
		],
		"mapped",
		[
			55
		]
	],
	[
		[
			9319,
			9319
		],
		"mapped",
		[
			56
		]
	],
	[
		[
			9320,
			9320
		],
		"mapped",
		[
			57
		]
	],
	[
		[
			9321,
			9321
		],
		"mapped",
		[
			49,
			48
		]
	],
	[
		[
			9322,
			9322
		],
		"mapped",
		[
			49,
			49
		]
	],
	[
		[
			9323,
			9323
		],
		"mapped",
		[
			49,
			50
		]
	],
	[
		[
			9324,
			9324
		],
		"mapped",
		[
			49,
			51
		]
	],
	[
		[
			9325,
			9325
		],
		"mapped",
		[
			49,
			52
		]
	],
	[
		[
			9326,
			9326
		],
		"mapped",
		[
			49,
			53
		]
	],
	[
		[
			9327,
			9327
		],
		"mapped",
		[
			49,
			54
		]
	],
	[
		[
			9328,
			9328
		],
		"mapped",
		[
			49,
			55
		]
	],
	[
		[
			9329,
			9329
		],
		"mapped",
		[
			49,
			56
		]
	],
	[
		[
			9330,
			9330
		],
		"mapped",
		[
			49,
			57
		]
	],
	[
		[
			9331,
			9331
		],
		"mapped",
		[
			50,
			48
		]
	],
	[
		[
			9332,
			9332
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			41
		]
	],
	[
		[
			9333,
			9333
		],
		"disallowed_STD3_mapped",
		[
			40,
			50,
			41
		]
	],
	[
		[
			9334,
			9334
		],
		"disallowed_STD3_mapped",
		[
			40,
			51,
			41
		]
	],
	[
		[
			9335,
			9335
		],
		"disallowed_STD3_mapped",
		[
			40,
			52,
			41
		]
	],
	[
		[
			9336,
			9336
		],
		"disallowed_STD3_mapped",
		[
			40,
			53,
			41
		]
	],
	[
		[
			9337,
			9337
		],
		"disallowed_STD3_mapped",
		[
			40,
			54,
			41
		]
	],
	[
		[
			9338,
			9338
		],
		"disallowed_STD3_mapped",
		[
			40,
			55,
			41
		]
	],
	[
		[
			9339,
			9339
		],
		"disallowed_STD3_mapped",
		[
			40,
			56,
			41
		]
	],
	[
		[
			9340,
			9340
		],
		"disallowed_STD3_mapped",
		[
			40,
			57,
			41
		]
	],
	[
		[
			9341,
			9341
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			48,
			41
		]
	],
	[
		[
			9342,
			9342
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			49,
			41
		]
	],
	[
		[
			9343,
			9343
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			50,
			41
		]
	],
	[
		[
			9344,
			9344
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			51,
			41
		]
	],
	[
		[
			9345,
			9345
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			52,
			41
		]
	],
	[
		[
			9346,
			9346
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			53,
			41
		]
	],
	[
		[
			9347,
			9347
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			54,
			41
		]
	],
	[
		[
			9348,
			9348
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			55,
			41
		]
	],
	[
		[
			9349,
			9349
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			56,
			41
		]
	],
	[
		[
			9350,
			9350
		],
		"disallowed_STD3_mapped",
		[
			40,
			49,
			57,
			41
		]
	],
	[
		[
			9351,
			9351
		],
		"disallowed_STD3_mapped",
		[
			40,
			50,
			48,
			41
		]
	],
	[
		[
			9352,
			9371
		],
		"disallowed"
	],
	[
		[
			9372,
			9372
		],
		"disallowed_STD3_mapped",
		[
			40,
			97,
			41
		]
	],
	[
		[
			9373,
			9373
		],
		"disallowed_STD3_mapped",
		[
			40,
			98,
			41
		]
	],
	[
		[
			9374,
			9374
		],
		"disallowed_STD3_mapped",
		[
			40,
			99,
			41
		]
	],
	[
		[
			9375,
			9375
		],
		"disallowed_STD3_mapped",
		[
			40,
			100,
			41
		]
	],
	[
		[
			9376,
			9376
		],
		"disallowed_STD3_mapped",
		[
			40,
			101,
			41
		]
	],
	[
		[
			9377,
			9377
		],
		"disallowed_STD3_mapped",
		[
			40,
			102,
			41
		]
	],
	[
		[
			9378,
			9378
		],
		"disallowed_STD3_mapped",
		[
			40,
			103,
			41
		]
	],
	[
		[
			9379,
			9379
		],
		"disallowed_STD3_mapped",
		[
			40,
			104,
			41
		]
	],
	[
		[
			9380,
			9380
		],
		"disallowed_STD3_mapped",
		[
			40,
			105,
			41
		]
	],
	[
		[
			9381,
			9381
		],
		"disallowed_STD3_mapped",
		[
			40,
			106,
			41
		]
	],
	[
		[
			9382,
			9382
		],
		"disallowed_STD3_mapped",
		[
			40,
			107,
			41
		]
	],
	[
		[
			9383,
			9383
		],
		"disallowed_STD3_mapped",
		[
			40,
			108,
			41
		]
	],
	[
		[
			9384,
			9384
		],
		"disallowed_STD3_mapped",
		[
			40,
			109,
			41
		]
	],
	[
		[
			9385,
			9385
		],
		"disallowed_STD3_mapped",
		[
			40,
			110,
			41
		]
	],
	[
		[
			9386,
			9386
		],
		"disallowed_STD3_mapped",
		[
			40,
			111,
			41
		]
	],
	[
		[
			9387,
			9387
		],
		"disallowed_STD3_mapped",
		[
			40,
			112,
			41
		]
	],
	[
		[
			9388,
			9388
		],
		"disallowed_STD3_mapped",
		[
			40,
			113,
			41
		]
	],
	[
		[
			9389,
			9389
		],
		"disallowed_STD3_mapped",
		[
			40,
			114,
			41
		]
	],
	[
		[
			9390,
			9390
		],
		"disallowed_STD3_mapped",
		[
			40,
			115,
			41
		]
	],
	[
		[
			9391,
			9391
		],
		"disallowed_STD3_mapped",
		[
			40,
			116,
			41
		]
	],
	[
		[
			9392,
			9392
		],
		"disallowed_STD3_mapped",
		[
			40,
			117,
			41
		]
	],
	[
		[
			9393,
			9393
		],
		"disallowed_STD3_mapped",
		[
			40,
			118,
			41
		]
	],
	[
		[
			9394,
			9394
		],
		"disallowed_STD3_mapped",
		[
			40,
			119,
			41
		]
	],
	[
		[
			9395,
			9395
		],
		"disallowed_STD3_mapped",
		[
			40,
			120,
			41
		]
	],
	[
		[
			9396,
			9396
		],
		"disallowed_STD3_mapped",
		[
			40,
			121,
			41
		]
	],
	[
		[
			9397,
			9397
		],
		"disallowed_STD3_mapped",
		[
			40,
			122,
			41
		]
	],
	[
		[
			9398,
			9398
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			9399,
			9399
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			9400,
			9400
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			9401,
			9401
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			9402,
			9402
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			9403,
			9403
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			9404,
			9404
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			9405,
			9405
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			9406,
			9406
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			9407,
			9407
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			9408,
			9408
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			9409,
			9409
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			9410,
			9410
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			9411,
			9411
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			9412,
			9412
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			9413,
			9413
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			9414,
			9414
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			9415,
			9415
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			9416,
			9416
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			9417,
			9417
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			9418,
			9418
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			9419,
			9419
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			9420,
			9420
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			9421,
			9421
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			9422,
			9422
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			9423,
			9423
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			9424,
			9424
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			9425,
			9425
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			9426,
			9426
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			9427,
			9427
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			9428,
			9428
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			9429,
			9429
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			9430,
			9430
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			9431,
			9431
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			9432,
			9432
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			9433,
			9433
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			9434,
			9434
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			9435,
			9435
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			9436,
			9436
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			9437,
			9437
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			9438,
			9438
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			9439,
			9439
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			9440,
			9440
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			9441,
			9441
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			9442,
			9442
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			9443,
			9443
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			9444,
			9444
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			9445,
			9445
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			9446,
			9446
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			9447,
			9447
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			9448,
			9448
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			9449,
			9449
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			9450,
			9450
		],
		"mapped",
		[
			48
		]
	],
	[
		[
			9451,
			9470
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9471,
			9471
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9472,
			9621
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9622,
			9631
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9632,
			9711
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9712,
			9719
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9720,
			9727
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9728,
			9747
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9748,
			9749
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9750,
			9751
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9752,
			9752
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9753,
			9753
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9754,
			9839
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9840,
			9841
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9842,
			9853
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9854,
			9855
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9856,
			9865
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9866,
			9873
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9874,
			9884
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9885,
			9885
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9886,
			9887
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9888,
			9889
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9890,
			9905
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9906,
			9906
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9907,
			9916
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9917,
			9919
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9920,
			9923
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9924,
			9933
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9934,
			9934
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9935,
			9953
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9954,
			9954
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9955,
			9955
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9956,
			9959
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9960,
			9983
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9984,
			9984
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9985,
			9988
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9989,
			9989
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9990,
			9993
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9994,
			9995
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			9996,
			10023
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10024,
			10024
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10025,
			10059
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10060,
			10060
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10061,
			10061
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10062,
			10062
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10063,
			10066
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10067,
			10069
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10070,
			10070
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10071,
			10071
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10072,
			10078
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10079,
			10080
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10081,
			10087
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10088,
			10101
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10102,
			10132
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10133,
			10135
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10136,
			10159
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10160,
			10160
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10161,
			10174
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10175,
			10175
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10176,
			10182
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10183,
			10186
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10187,
			10187
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10188,
			10188
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10189,
			10189
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10190,
			10191
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10192,
			10219
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10220,
			10223
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10224,
			10239
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10240,
			10495
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10496,
			10763
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10764,
			10764
		],
		"mapped",
		[
			8747,
			8747,
			8747,
			8747
		]
	],
	[
		[
			10765,
			10867
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10868,
			10868
		],
		"disallowed_STD3_mapped",
		[
			58,
			58,
			61
		]
	],
	[
		[
			10869,
			10869
		],
		"disallowed_STD3_mapped",
		[
			61,
			61
		]
	],
	[
		[
			10870,
			10870
		],
		"disallowed_STD3_mapped",
		[
			61,
			61,
			61
		]
	],
	[
		[
			10871,
			10971
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			10972,
			10972
		],
		"mapped",
		[
			10973,
			824
		]
	],
	[
		[
			10973,
			11007
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11008,
			11021
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11022,
			11027
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11028,
			11034
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11035,
			11039
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11040,
			11043
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11044,
			11084
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11085,
			11087
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11088,
			11092
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11093,
			11097
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11098,
			11123
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11124,
			11125
		],
		"disallowed"
	],
	[
		[
			11126,
			11157
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11158,
			11159
		],
		"disallowed"
	],
	[
		[
			11160,
			11193
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11194,
			11196
		],
		"disallowed"
	],
	[
		[
			11197,
			11208
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11209,
			11209
		],
		"disallowed"
	],
	[
		[
			11210,
			11217
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11218,
			11243
		],
		"disallowed"
	],
	[
		[
			11244,
			11247
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11248,
			11263
		],
		"disallowed"
	],
	[
		[
			11264,
			11264
		],
		"mapped",
		[
			11312
		]
	],
	[
		[
			11265,
			11265
		],
		"mapped",
		[
			11313
		]
	],
	[
		[
			11266,
			11266
		],
		"mapped",
		[
			11314
		]
	],
	[
		[
			11267,
			11267
		],
		"mapped",
		[
			11315
		]
	],
	[
		[
			11268,
			11268
		],
		"mapped",
		[
			11316
		]
	],
	[
		[
			11269,
			11269
		],
		"mapped",
		[
			11317
		]
	],
	[
		[
			11270,
			11270
		],
		"mapped",
		[
			11318
		]
	],
	[
		[
			11271,
			11271
		],
		"mapped",
		[
			11319
		]
	],
	[
		[
			11272,
			11272
		],
		"mapped",
		[
			11320
		]
	],
	[
		[
			11273,
			11273
		],
		"mapped",
		[
			11321
		]
	],
	[
		[
			11274,
			11274
		],
		"mapped",
		[
			11322
		]
	],
	[
		[
			11275,
			11275
		],
		"mapped",
		[
			11323
		]
	],
	[
		[
			11276,
			11276
		],
		"mapped",
		[
			11324
		]
	],
	[
		[
			11277,
			11277
		],
		"mapped",
		[
			11325
		]
	],
	[
		[
			11278,
			11278
		],
		"mapped",
		[
			11326
		]
	],
	[
		[
			11279,
			11279
		],
		"mapped",
		[
			11327
		]
	],
	[
		[
			11280,
			11280
		],
		"mapped",
		[
			11328
		]
	],
	[
		[
			11281,
			11281
		],
		"mapped",
		[
			11329
		]
	],
	[
		[
			11282,
			11282
		],
		"mapped",
		[
			11330
		]
	],
	[
		[
			11283,
			11283
		],
		"mapped",
		[
			11331
		]
	],
	[
		[
			11284,
			11284
		],
		"mapped",
		[
			11332
		]
	],
	[
		[
			11285,
			11285
		],
		"mapped",
		[
			11333
		]
	],
	[
		[
			11286,
			11286
		],
		"mapped",
		[
			11334
		]
	],
	[
		[
			11287,
			11287
		],
		"mapped",
		[
			11335
		]
	],
	[
		[
			11288,
			11288
		],
		"mapped",
		[
			11336
		]
	],
	[
		[
			11289,
			11289
		],
		"mapped",
		[
			11337
		]
	],
	[
		[
			11290,
			11290
		],
		"mapped",
		[
			11338
		]
	],
	[
		[
			11291,
			11291
		],
		"mapped",
		[
			11339
		]
	],
	[
		[
			11292,
			11292
		],
		"mapped",
		[
			11340
		]
	],
	[
		[
			11293,
			11293
		],
		"mapped",
		[
			11341
		]
	],
	[
		[
			11294,
			11294
		],
		"mapped",
		[
			11342
		]
	],
	[
		[
			11295,
			11295
		],
		"mapped",
		[
			11343
		]
	],
	[
		[
			11296,
			11296
		],
		"mapped",
		[
			11344
		]
	],
	[
		[
			11297,
			11297
		],
		"mapped",
		[
			11345
		]
	],
	[
		[
			11298,
			11298
		],
		"mapped",
		[
			11346
		]
	],
	[
		[
			11299,
			11299
		],
		"mapped",
		[
			11347
		]
	],
	[
		[
			11300,
			11300
		],
		"mapped",
		[
			11348
		]
	],
	[
		[
			11301,
			11301
		],
		"mapped",
		[
			11349
		]
	],
	[
		[
			11302,
			11302
		],
		"mapped",
		[
			11350
		]
	],
	[
		[
			11303,
			11303
		],
		"mapped",
		[
			11351
		]
	],
	[
		[
			11304,
			11304
		],
		"mapped",
		[
			11352
		]
	],
	[
		[
			11305,
			11305
		],
		"mapped",
		[
			11353
		]
	],
	[
		[
			11306,
			11306
		],
		"mapped",
		[
			11354
		]
	],
	[
		[
			11307,
			11307
		],
		"mapped",
		[
			11355
		]
	],
	[
		[
			11308,
			11308
		],
		"mapped",
		[
			11356
		]
	],
	[
		[
			11309,
			11309
		],
		"mapped",
		[
			11357
		]
	],
	[
		[
			11310,
			11310
		],
		"mapped",
		[
			11358
		]
	],
	[
		[
			11311,
			11311
		],
		"disallowed"
	],
	[
		[
			11312,
			11358
		],
		"valid"
	],
	[
		[
			11359,
			11359
		],
		"disallowed"
	],
	[
		[
			11360,
			11360
		],
		"mapped",
		[
			11361
		]
	],
	[
		[
			11361,
			11361
		],
		"valid"
	],
	[
		[
			11362,
			11362
		],
		"mapped",
		[
			619
		]
	],
	[
		[
			11363,
			11363
		],
		"mapped",
		[
			7549
		]
	],
	[
		[
			11364,
			11364
		],
		"mapped",
		[
			637
		]
	],
	[
		[
			11365,
			11366
		],
		"valid"
	],
	[
		[
			11367,
			11367
		],
		"mapped",
		[
			11368
		]
	],
	[
		[
			11368,
			11368
		],
		"valid"
	],
	[
		[
			11369,
			11369
		],
		"mapped",
		[
			11370
		]
	],
	[
		[
			11370,
			11370
		],
		"valid"
	],
	[
		[
			11371,
			11371
		],
		"mapped",
		[
			11372
		]
	],
	[
		[
			11372,
			11372
		],
		"valid"
	],
	[
		[
			11373,
			11373
		],
		"mapped",
		[
			593
		]
	],
	[
		[
			11374,
			11374
		],
		"mapped",
		[
			625
		]
	],
	[
		[
			11375,
			11375
		],
		"mapped",
		[
			592
		]
	],
	[
		[
			11376,
			11376
		],
		"mapped",
		[
			594
		]
	],
	[
		[
			11377,
			11377
		],
		"valid"
	],
	[
		[
			11378,
			11378
		],
		"mapped",
		[
			11379
		]
	],
	[
		[
			11379,
			11379
		],
		"valid"
	],
	[
		[
			11380,
			11380
		],
		"valid"
	],
	[
		[
			11381,
			11381
		],
		"mapped",
		[
			11382
		]
	],
	[
		[
			11382,
			11383
		],
		"valid"
	],
	[
		[
			11384,
			11387
		],
		"valid"
	],
	[
		[
			11388,
			11388
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			11389,
			11389
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			11390,
			11390
		],
		"mapped",
		[
			575
		]
	],
	[
		[
			11391,
			11391
		],
		"mapped",
		[
			576
		]
	],
	[
		[
			11392,
			11392
		],
		"mapped",
		[
			11393
		]
	],
	[
		[
			11393,
			11393
		],
		"valid"
	],
	[
		[
			11394,
			11394
		],
		"mapped",
		[
			11395
		]
	],
	[
		[
			11395,
			11395
		],
		"valid"
	],
	[
		[
			11396,
			11396
		],
		"mapped",
		[
			11397
		]
	],
	[
		[
			11397,
			11397
		],
		"valid"
	],
	[
		[
			11398,
			11398
		],
		"mapped",
		[
			11399
		]
	],
	[
		[
			11399,
			11399
		],
		"valid"
	],
	[
		[
			11400,
			11400
		],
		"mapped",
		[
			11401
		]
	],
	[
		[
			11401,
			11401
		],
		"valid"
	],
	[
		[
			11402,
			11402
		],
		"mapped",
		[
			11403
		]
	],
	[
		[
			11403,
			11403
		],
		"valid"
	],
	[
		[
			11404,
			11404
		],
		"mapped",
		[
			11405
		]
	],
	[
		[
			11405,
			11405
		],
		"valid"
	],
	[
		[
			11406,
			11406
		],
		"mapped",
		[
			11407
		]
	],
	[
		[
			11407,
			11407
		],
		"valid"
	],
	[
		[
			11408,
			11408
		],
		"mapped",
		[
			11409
		]
	],
	[
		[
			11409,
			11409
		],
		"valid"
	],
	[
		[
			11410,
			11410
		],
		"mapped",
		[
			11411
		]
	],
	[
		[
			11411,
			11411
		],
		"valid"
	],
	[
		[
			11412,
			11412
		],
		"mapped",
		[
			11413
		]
	],
	[
		[
			11413,
			11413
		],
		"valid"
	],
	[
		[
			11414,
			11414
		],
		"mapped",
		[
			11415
		]
	],
	[
		[
			11415,
			11415
		],
		"valid"
	],
	[
		[
			11416,
			11416
		],
		"mapped",
		[
			11417
		]
	],
	[
		[
			11417,
			11417
		],
		"valid"
	],
	[
		[
			11418,
			11418
		],
		"mapped",
		[
			11419
		]
	],
	[
		[
			11419,
			11419
		],
		"valid"
	],
	[
		[
			11420,
			11420
		],
		"mapped",
		[
			11421
		]
	],
	[
		[
			11421,
			11421
		],
		"valid"
	],
	[
		[
			11422,
			11422
		],
		"mapped",
		[
			11423
		]
	],
	[
		[
			11423,
			11423
		],
		"valid"
	],
	[
		[
			11424,
			11424
		],
		"mapped",
		[
			11425
		]
	],
	[
		[
			11425,
			11425
		],
		"valid"
	],
	[
		[
			11426,
			11426
		],
		"mapped",
		[
			11427
		]
	],
	[
		[
			11427,
			11427
		],
		"valid"
	],
	[
		[
			11428,
			11428
		],
		"mapped",
		[
			11429
		]
	],
	[
		[
			11429,
			11429
		],
		"valid"
	],
	[
		[
			11430,
			11430
		],
		"mapped",
		[
			11431
		]
	],
	[
		[
			11431,
			11431
		],
		"valid"
	],
	[
		[
			11432,
			11432
		],
		"mapped",
		[
			11433
		]
	],
	[
		[
			11433,
			11433
		],
		"valid"
	],
	[
		[
			11434,
			11434
		],
		"mapped",
		[
			11435
		]
	],
	[
		[
			11435,
			11435
		],
		"valid"
	],
	[
		[
			11436,
			11436
		],
		"mapped",
		[
			11437
		]
	],
	[
		[
			11437,
			11437
		],
		"valid"
	],
	[
		[
			11438,
			11438
		],
		"mapped",
		[
			11439
		]
	],
	[
		[
			11439,
			11439
		],
		"valid"
	],
	[
		[
			11440,
			11440
		],
		"mapped",
		[
			11441
		]
	],
	[
		[
			11441,
			11441
		],
		"valid"
	],
	[
		[
			11442,
			11442
		],
		"mapped",
		[
			11443
		]
	],
	[
		[
			11443,
			11443
		],
		"valid"
	],
	[
		[
			11444,
			11444
		],
		"mapped",
		[
			11445
		]
	],
	[
		[
			11445,
			11445
		],
		"valid"
	],
	[
		[
			11446,
			11446
		],
		"mapped",
		[
			11447
		]
	],
	[
		[
			11447,
			11447
		],
		"valid"
	],
	[
		[
			11448,
			11448
		],
		"mapped",
		[
			11449
		]
	],
	[
		[
			11449,
			11449
		],
		"valid"
	],
	[
		[
			11450,
			11450
		],
		"mapped",
		[
			11451
		]
	],
	[
		[
			11451,
			11451
		],
		"valid"
	],
	[
		[
			11452,
			11452
		],
		"mapped",
		[
			11453
		]
	],
	[
		[
			11453,
			11453
		],
		"valid"
	],
	[
		[
			11454,
			11454
		],
		"mapped",
		[
			11455
		]
	],
	[
		[
			11455,
			11455
		],
		"valid"
	],
	[
		[
			11456,
			11456
		],
		"mapped",
		[
			11457
		]
	],
	[
		[
			11457,
			11457
		],
		"valid"
	],
	[
		[
			11458,
			11458
		],
		"mapped",
		[
			11459
		]
	],
	[
		[
			11459,
			11459
		],
		"valid"
	],
	[
		[
			11460,
			11460
		],
		"mapped",
		[
			11461
		]
	],
	[
		[
			11461,
			11461
		],
		"valid"
	],
	[
		[
			11462,
			11462
		],
		"mapped",
		[
			11463
		]
	],
	[
		[
			11463,
			11463
		],
		"valid"
	],
	[
		[
			11464,
			11464
		],
		"mapped",
		[
			11465
		]
	],
	[
		[
			11465,
			11465
		],
		"valid"
	],
	[
		[
			11466,
			11466
		],
		"mapped",
		[
			11467
		]
	],
	[
		[
			11467,
			11467
		],
		"valid"
	],
	[
		[
			11468,
			11468
		],
		"mapped",
		[
			11469
		]
	],
	[
		[
			11469,
			11469
		],
		"valid"
	],
	[
		[
			11470,
			11470
		],
		"mapped",
		[
			11471
		]
	],
	[
		[
			11471,
			11471
		],
		"valid"
	],
	[
		[
			11472,
			11472
		],
		"mapped",
		[
			11473
		]
	],
	[
		[
			11473,
			11473
		],
		"valid"
	],
	[
		[
			11474,
			11474
		],
		"mapped",
		[
			11475
		]
	],
	[
		[
			11475,
			11475
		],
		"valid"
	],
	[
		[
			11476,
			11476
		],
		"mapped",
		[
			11477
		]
	],
	[
		[
			11477,
			11477
		],
		"valid"
	],
	[
		[
			11478,
			11478
		],
		"mapped",
		[
			11479
		]
	],
	[
		[
			11479,
			11479
		],
		"valid"
	],
	[
		[
			11480,
			11480
		],
		"mapped",
		[
			11481
		]
	],
	[
		[
			11481,
			11481
		],
		"valid"
	],
	[
		[
			11482,
			11482
		],
		"mapped",
		[
			11483
		]
	],
	[
		[
			11483,
			11483
		],
		"valid"
	],
	[
		[
			11484,
			11484
		],
		"mapped",
		[
			11485
		]
	],
	[
		[
			11485,
			11485
		],
		"valid"
	],
	[
		[
			11486,
			11486
		],
		"mapped",
		[
			11487
		]
	],
	[
		[
			11487,
			11487
		],
		"valid"
	],
	[
		[
			11488,
			11488
		],
		"mapped",
		[
			11489
		]
	],
	[
		[
			11489,
			11489
		],
		"valid"
	],
	[
		[
			11490,
			11490
		],
		"mapped",
		[
			11491
		]
	],
	[
		[
			11491,
			11492
		],
		"valid"
	],
	[
		[
			11493,
			11498
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11499,
			11499
		],
		"mapped",
		[
			11500
		]
	],
	[
		[
			11500,
			11500
		],
		"valid"
	],
	[
		[
			11501,
			11501
		],
		"mapped",
		[
			11502
		]
	],
	[
		[
			11502,
			11505
		],
		"valid"
	],
	[
		[
			11506,
			11506
		],
		"mapped",
		[
			11507
		]
	],
	[
		[
			11507,
			11507
		],
		"valid"
	],
	[
		[
			11508,
			11512
		],
		"disallowed"
	],
	[
		[
			11513,
			11519
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11520,
			11557
		],
		"valid"
	],
	[
		[
			11558,
			11558
		],
		"disallowed"
	],
	[
		[
			11559,
			11559
		],
		"valid"
	],
	[
		[
			11560,
			11564
		],
		"disallowed"
	],
	[
		[
			11565,
			11565
		],
		"valid"
	],
	[
		[
			11566,
			11567
		],
		"disallowed"
	],
	[
		[
			11568,
			11621
		],
		"valid"
	],
	[
		[
			11622,
			11623
		],
		"valid"
	],
	[
		[
			11624,
			11630
		],
		"disallowed"
	],
	[
		[
			11631,
			11631
		],
		"mapped",
		[
			11617
		]
	],
	[
		[
			11632,
			11632
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11633,
			11646
		],
		"disallowed"
	],
	[
		[
			11647,
			11647
		],
		"valid"
	],
	[
		[
			11648,
			11670
		],
		"valid"
	],
	[
		[
			11671,
			11679
		],
		"disallowed"
	],
	[
		[
			11680,
			11686
		],
		"valid"
	],
	[
		[
			11687,
			11687
		],
		"disallowed"
	],
	[
		[
			11688,
			11694
		],
		"valid"
	],
	[
		[
			11695,
			11695
		],
		"disallowed"
	],
	[
		[
			11696,
			11702
		],
		"valid"
	],
	[
		[
			11703,
			11703
		],
		"disallowed"
	],
	[
		[
			11704,
			11710
		],
		"valid"
	],
	[
		[
			11711,
			11711
		],
		"disallowed"
	],
	[
		[
			11712,
			11718
		],
		"valid"
	],
	[
		[
			11719,
			11719
		],
		"disallowed"
	],
	[
		[
			11720,
			11726
		],
		"valid"
	],
	[
		[
			11727,
			11727
		],
		"disallowed"
	],
	[
		[
			11728,
			11734
		],
		"valid"
	],
	[
		[
			11735,
			11735
		],
		"disallowed"
	],
	[
		[
			11736,
			11742
		],
		"valid"
	],
	[
		[
			11743,
			11743
		],
		"disallowed"
	],
	[
		[
			11744,
			11775
		],
		"valid"
	],
	[
		[
			11776,
			11799
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11800,
			11803
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11804,
			11805
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11806,
			11822
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11823,
			11823
		],
		"valid"
	],
	[
		[
			11824,
			11824
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11825,
			11825
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11826,
			11835
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11836,
			11842
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11843,
			11903
		],
		"disallowed"
	],
	[
		[
			11904,
			11929
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11930,
			11930
		],
		"disallowed"
	],
	[
		[
			11931,
			11934
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			11935,
			11935
		],
		"mapped",
		[
			27597
		]
	],
	[
		[
			11936,
			12018
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12019,
			12019
		],
		"mapped",
		[
			40863
		]
	],
	[
		[
			12020,
			12031
		],
		"disallowed"
	],
	[
		[
			12032,
			12032
		],
		"mapped",
		[
			19968
		]
	],
	[
		[
			12033,
			12033
		],
		"mapped",
		[
			20008
		]
	],
	[
		[
			12034,
			12034
		],
		"mapped",
		[
			20022
		]
	],
	[
		[
			12035,
			12035
		],
		"mapped",
		[
			20031
		]
	],
	[
		[
			12036,
			12036
		],
		"mapped",
		[
			20057
		]
	],
	[
		[
			12037,
			12037
		],
		"mapped",
		[
			20101
		]
	],
	[
		[
			12038,
			12038
		],
		"mapped",
		[
			20108
		]
	],
	[
		[
			12039,
			12039
		],
		"mapped",
		[
			20128
		]
	],
	[
		[
			12040,
			12040
		],
		"mapped",
		[
			20154
		]
	],
	[
		[
			12041,
			12041
		],
		"mapped",
		[
			20799
		]
	],
	[
		[
			12042,
			12042
		],
		"mapped",
		[
			20837
		]
	],
	[
		[
			12043,
			12043
		],
		"mapped",
		[
			20843
		]
	],
	[
		[
			12044,
			12044
		],
		"mapped",
		[
			20866
		]
	],
	[
		[
			12045,
			12045
		],
		"mapped",
		[
			20886
		]
	],
	[
		[
			12046,
			12046
		],
		"mapped",
		[
			20907
		]
	],
	[
		[
			12047,
			12047
		],
		"mapped",
		[
			20960
		]
	],
	[
		[
			12048,
			12048
		],
		"mapped",
		[
			20981
		]
	],
	[
		[
			12049,
			12049
		],
		"mapped",
		[
			20992
		]
	],
	[
		[
			12050,
			12050
		],
		"mapped",
		[
			21147
		]
	],
	[
		[
			12051,
			12051
		],
		"mapped",
		[
			21241
		]
	],
	[
		[
			12052,
			12052
		],
		"mapped",
		[
			21269
		]
	],
	[
		[
			12053,
			12053
		],
		"mapped",
		[
			21274
		]
	],
	[
		[
			12054,
			12054
		],
		"mapped",
		[
			21304
		]
	],
	[
		[
			12055,
			12055
		],
		"mapped",
		[
			21313
		]
	],
	[
		[
			12056,
			12056
		],
		"mapped",
		[
			21340
		]
	],
	[
		[
			12057,
			12057
		],
		"mapped",
		[
			21353
		]
	],
	[
		[
			12058,
			12058
		],
		"mapped",
		[
			21378
		]
	],
	[
		[
			12059,
			12059
		],
		"mapped",
		[
			21430
		]
	],
	[
		[
			12060,
			12060
		],
		"mapped",
		[
			21448
		]
	],
	[
		[
			12061,
			12061
		],
		"mapped",
		[
			21475
		]
	],
	[
		[
			12062,
			12062
		],
		"mapped",
		[
			22231
		]
	],
	[
		[
			12063,
			12063
		],
		"mapped",
		[
			22303
		]
	],
	[
		[
			12064,
			12064
		],
		"mapped",
		[
			22763
		]
	],
	[
		[
			12065,
			12065
		],
		"mapped",
		[
			22786
		]
	],
	[
		[
			12066,
			12066
		],
		"mapped",
		[
			22794
		]
	],
	[
		[
			12067,
			12067
		],
		"mapped",
		[
			22805
		]
	],
	[
		[
			12068,
			12068
		],
		"mapped",
		[
			22823
		]
	],
	[
		[
			12069,
			12069
		],
		"mapped",
		[
			22899
		]
	],
	[
		[
			12070,
			12070
		],
		"mapped",
		[
			23376
		]
	],
	[
		[
			12071,
			12071
		],
		"mapped",
		[
			23424
		]
	],
	[
		[
			12072,
			12072
		],
		"mapped",
		[
			23544
		]
	],
	[
		[
			12073,
			12073
		],
		"mapped",
		[
			23567
		]
	],
	[
		[
			12074,
			12074
		],
		"mapped",
		[
			23586
		]
	],
	[
		[
			12075,
			12075
		],
		"mapped",
		[
			23608
		]
	],
	[
		[
			12076,
			12076
		],
		"mapped",
		[
			23662
		]
	],
	[
		[
			12077,
			12077
		],
		"mapped",
		[
			23665
		]
	],
	[
		[
			12078,
			12078
		],
		"mapped",
		[
			24027
		]
	],
	[
		[
			12079,
			12079
		],
		"mapped",
		[
			24037
		]
	],
	[
		[
			12080,
			12080
		],
		"mapped",
		[
			24049
		]
	],
	[
		[
			12081,
			12081
		],
		"mapped",
		[
			24062
		]
	],
	[
		[
			12082,
			12082
		],
		"mapped",
		[
			24178
		]
	],
	[
		[
			12083,
			12083
		],
		"mapped",
		[
			24186
		]
	],
	[
		[
			12084,
			12084
		],
		"mapped",
		[
			24191
		]
	],
	[
		[
			12085,
			12085
		],
		"mapped",
		[
			24308
		]
	],
	[
		[
			12086,
			12086
		],
		"mapped",
		[
			24318
		]
	],
	[
		[
			12087,
			12087
		],
		"mapped",
		[
			24331
		]
	],
	[
		[
			12088,
			12088
		],
		"mapped",
		[
			24339
		]
	],
	[
		[
			12089,
			12089
		],
		"mapped",
		[
			24400
		]
	],
	[
		[
			12090,
			12090
		],
		"mapped",
		[
			24417
		]
	],
	[
		[
			12091,
			12091
		],
		"mapped",
		[
			24435
		]
	],
	[
		[
			12092,
			12092
		],
		"mapped",
		[
			24515
		]
	],
	[
		[
			12093,
			12093
		],
		"mapped",
		[
			25096
		]
	],
	[
		[
			12094,
			12094
		],
		"mapped",
		[
			25142
		]
	],
	[
		[
			12095,
			12095
		],
		"mapped",
		[
			25163
		]
	],
	[
		[
			12096,
			12096
		],
		"mapped",
		[
			25903
		]
	],
	[
		[
			12097,
			12097
		],
		"mapped",
		[
			25908
		]
	],
	[
		[
			12098,
			12098
		],
		"mapped",
		[
			25991
		]
	],
	[
		[
			12099,
			12099
		],
		"mapped",
		[
			26007
		]
	],
	[
		[
			12100,
			12100
		],
		"mapped",
		[
			26020
		]
	],
	[
		[
			12101,
			12101
		],
		"mapped",
		[
			26041
		]
	],
	[
		[
			12102,
			12102
		],
		"mapped",
		[
			26080
		]
	],
	[
		[
			12103,
			12103
		],
		"mapped",
		[
			26085
		]
	],
	[
		[
			12104,
			12104
		],
		"mapped",
		[
			26352
		]
	],
	[
		[
			12105,
			12105
		],
		"mapped",
		[
			26376
		]
	],
	[
		[
			12106,
			12106
		],
		"mapped",
		[
			26408
		]
	],
	[
		[
			12107,
			12107
		],
		"mapped",
		[
			27424
		]
	],
	[
		[
			12108,
			12108
		],
		"mapped",
		[
			27490
		]
	],
	[
		[
			12109,
			12109
		],
		"mapped",
		[
			27513
		]
	],
	[
		[
			12110,
			12110
		],
		"mapped",
		[
			27571
		]
	],
	[
		[
			12111,
			12111
		],
		"mapped",
		[
			27595
		]
	],
	[
		[
			12112,
			12112
		],
		"mapped",
		[
			27604
		]
	],
	[
		[
			12113,
			12113
		],
		"mapped",
		[
			27611
		]
	],
	[
		[
			12114,
			12114
		],
		"mapped",
		[
			27663
		]
	],
	[
		[
			12115,
			12115
		],
		"mapped",
		[
			27668
		]
	],
	[
		[
			12116,
			12116
		],
		"mapped",
		[
			27700
		]
	],
	[
		[
			12117,
			12117
		],
		"mapped",
		[
			28779
		]
	],
	[
		[
			12118,
			12118
		],
		"mapped",
		[
			29226
		]
	],
	[
		[
			12119,
			12119
		],
		"mapped",
		[
			29238
		]
	],
	[
		[
			12120,
			12120
		],
		"mapped",
		[
			29243
		]
	],
	[
		[
			12121,
			12121
		],
		"mapped",
		[
			29247
		]
	],
	[
		[
			12122,
			12122
		],
		"mapped",
		[
			29255
		]
	],
	[
		[
			12123,
			12123
		],
		"mapped",
		[
			29273
		]
	],
	[
		[
			12124,
			12124
		],
		"mapped",
		[
			29275
		]
	],
	[
		[
			12125,
			12125
		],
		"mapped",
		[
			29356
		]
	],
	[
		[
			12126,
			12126
		],
		"mapped",
		[
			29572
		]
	],
	[
		[
			12127,
			12127
		],
		"mapped",
		[
			29577
		]
	],
	[
		[
			12128,
			12128
		],
		"mapped",
		[
			29916
		]
	],
	[
		[
			12129,
			12129
		],
		"mapped",
		[
			29926
		]
	],
	[
		[
			12130,
			12130
		],
		"mapped",
		[
			29976
		]
	],
	[
		[
			12131,
			12131
		],
		"mapped",
		[
			29983
		]
	],
	[
		[
			12132,
			12132
		],
		"mapped",
		[
			29992
		]
	],
	[
		[
			12133,
			12133
		],
		"mapped",
		[
			30000
		]
	],
	[
		[
			12134,
			12134
		],
		"mapped",
		[
			30091
		]
	],
	[
		[
			12135,
			12135
		],
		"mapped",
		[
			30098
		]
	],
	[
		[
			12136,
			12136
		],
		"mapped",
		[
			30326
		]
	],
	[
		[
			12137,
			12137
		],
		"mapped",
		[
			30333
		]
	],
	[
		[
			12138,
			12138
		],
		"mapped",
		[
			30382
		]
	],
	[
		[
			12139,
			12139
		],
		"mapped",
		[
			30399
		]
	],
	[
		[
			12140,
			12140
		],
		"mapped",
		[
			30446
		]
	],
	[
		[
			12141,
			12141
		],
		"mapped",
		[
			30683
		]
	],
	[
		[
			12142,
			12142
		],
		"mapped",
		[
			30690
		]
	],
	[
		[
			12143,
			12143
		],
		"mapped",
		[
			30707
		]
	],
	[
		[
			12144,
			12144
		],
		"mapped",
		[
			31034
		]
	],
	[
		[
			12145,
			12145
		],
		"mapped",
		[
			31160
		]
	],
	[
		[
			12146,
			12146
		],
		"mapped",
		[
			31166
		]
	],
	[
		[
			12147,
			12147
		],
		"mapped",
		[
			31348
		]
	],
	[
		[
			12148,
			12148
		],
		"mapped",
		[
			31435
		]
	],
	[
		[
			12149,
			12149
		],
		"mapped",
		[
			31481
		]
	],
	[
		[
			12150,
			12150
		],
		"mapped",
		[
			31859
		]
	],
	[
		[
			12151,
			12151
		],
		"mapped",
		[
			31992
		]
	],
	[
		[
			12152,
			12152
		],
		"mapped",
		[
			32566
		]
	],
	[
		[
			12153,
			12153
		],
		"mapped",
		[
			32593
		]
	],
	[
		[
			12154,
			12154
		],
		"mapped",
		[
			32650
		]
	],
	[
		[
			12155,
			12155
		],
		"mapped",
		[
			32701
		]
	],
	[
		[
			12156,
			12156
		],
		"mapped",
		[
			32769
		]
	],
	[
		[
			12157,
			12157
		],
		"mapped",
		[
			32780
		]
	],
	[
		[
			12158,
			12158
		],
		"mapped",
		[
			32786
		]
	],
	[
		[
			12159,
			12159
		],
		"mapped",
		[
			32819
		]
	],
	[
		[
			12160,
			12160
		],
		"mapped",
		[
			32895
		]
	],
	[
		[
			12161,
			12161
		],
		"mapped",
		[
			32905
		]
	],
	[
		[
			12162,
			12162
		],
		"mapped",
		[
			33251
		]
	],
	[
		[
			12163,
			12163
		],
		"mapped",
		[
			33258
		]
	],
	[
		[
			12164,
			12164
		],
		"mapped",
		[
			33267
		]
	],
	[
		[
			12165,
			12165
		],
		"mapped",
		[
			33276
		]
	],
	[
		[
			12166,
			12166
		],
		"mapped",
		[
			33292
		]
	],
	[
		[
			12167,
			12167
		],
		"mapped",
		[
			33307
		]
	],
	[
		[
			12168,
			12168
		],
		"mapped",
		[
			33311
		]
	],
	[
		[
			12169,
			12169
		],
		"mapped",
		[
			33390
		]
	],
	[
		[
			12170,
			12170
		],
		"mapped",
		[
			33394
		]
	],
	[
		[
			12171,
			12171
		],
		"mapped",
		[
			33400
		]
	],
	[
		[
			12172,
			12172
		],
		"mapped",
		[
			34381
		]
	],
	[
		[
			12173,
			12173
		],
		"mapped",
		[
			34411
		]
	],
	[
		[
			12174,
			12174
		],
		"mapped",
		[
			34880
		]
	],
	[
		[
			12175,
			12175
		],
		"mapped",
		[
			34892
		]
	],
	[
		[
			12176,
			12176
		],
		"mapped",
		[
			34915
		]
	],
	[
		[
			12177,
			12177
		],
		"mapped",
		[
			35198
		]
	],
	[
		[
			12178,
			12178
		],
		"mapped",
		[
			35211
		]
	],
	[
		[
			12179,
			12179
		],
		"mapped",
		[
			35282
		]
	],
	[
		[
			12180,
			12180
		],
		"mapped",
		[
			35328
		]
	],
	[
		[
			12181,
			12181
		],
		"mapped",
		[
			35895
		]
	],
	[
		[
			12182,
			12182
		],
		"mapped",
		[
			35910
		]
	],
	[
		[
			12183,
			12183
		],
		"mapped",
		[
			35925
		]
	],
	[
		[
			12184,
			12184
		],
		"mapped",
		[
			35960
		]
	],
	[
		[
			12185,
			12185
		],
		"mapped",
		[
			35997
		]
	],
	[
		[
			12186,
			12186
		],
		"mapped",
		[
			36196
		]
	],
	[
		[
			12187,
			12187
		],
		"mapped",
		[
			36208
		]
	],
	[
		[
			12188,
			12188
		],
		"mapped",
		[
			36275
		]
	],
	[
		[
			12189,
			12189
		],
		"mapped",
		[
			36523
		]
	],
	[
		[
			12190,
			12190
		],
		"mapped",
		[
			36554
		]
	],
	[
		[
			12191,
			12191
		],
		"mapped",
		[
			36763
		]
	],
	[
		[
			12192,
			12192
		],
		"mapped",
		[
			36784
		]
	],
	[
		[
			12193,
			12193
		],
		"mapped",
		[
			36789
		]
	],
	[
		[
			12194,
			12194
		],
		"mapped",
		[
			37009
		]
	],
	[
		[
			12195,
			12195
		],
		"mapped",
		[
			37193
		]
	],
	[
		[
			12196,
			12196
		],
		"mapped",
		[
			37318
		]
	],
	[
		[
			12197,
			12197
		],
		"mapped",
		[
			37324
		]
	],
	[
		[
			12198,
			12198
		],
		"mapped",
		[
			37329
		]
	],
	[
		[
			12199,
			12199
		],
		"mapped",
		[
			38263
		]
	],
	[
		[
			12200,
			12200
		],
		"mapped",
		[
			38272
		]
	],
	[
		[
			12201,
			12201
		],
		"mapped",
		[
			38428
		]
	],
	[
		[
			12202,
			12202
		],
		"mapped",
		[
			38582
		]
	],
	[
		[
			12203,
			12203
		],
		"mapped",
		[
			38585
		]
	],
	[
		[
			12204,
			12204
		],
		"mapped",
		[
			38632
		]
	],
	[
		[
			12205,
			12205
		],
		"mapped",
		[
			38737
		]
	],
	[
		[
			12206,
			12206
		],
		"mapped",
		[
			38750
		]
	],
	[
		[
			12207,
			12207
		],
		"mapped",
		[
			38754
		]
	],
	[
		[
			12208,
			12208
		],
		"mapped",
		[
			38761
		]
	],
	[
		[
			12209,
			12209
		],
		"mapped",
		[
			38859
		]
	],
	[
		[
			12210,
			12210
		],
		"mapped",
		[
			38893
		]
	],
	[
		[
			12211,
			12211
		],
		"mapped",
		[
			38899
		]
	],
	[
		[
			12212,
			12212
		],
		"mapped",
		[
			38913
		]
	],
	[
		[
			12213,
			12213
		],
		"mapped",
		[
			39080
		]
	],
	[
		[
			12214,
			12214
		],
		"mapped",
		[
			39131
		]
	],
	[
		[
			12215,
			12215
		],
		"mapped",
		[
			39135
		]
	],
	[
		[
			12216,
			12216
		],
		"mapped",
		[
			39318
		]
	],
	[
		[
			12217,
			12217
		],
		"mapped",
		[
			39321
		]
	],
	[
		[
			12218,
			12218
		],
		"mapped",
		[
			39340
		]
	],
	[
		[
			12219,
			12219
		],
		"mapped",
		[
			39592
		]
	],
	[
		[
			12220,
			12220
		],
		"mapped",
		[
			39640
		]
	],
	[
		[
			12221,
			12221
		],
		"mapped",
		[
			39647
		]
	],
	[
		[
			12222,
			12222
		],
		"mapped",
		[
			39717
		]
	],
	[
		[
			12223,
			12223
		],
		"mapped",
		[
			39727
		]
	],
	[
		[
			12224,
			12224
		],
		"mapped",
		[
			39730
		]
	],
	[
		[
			12225,
			12225
		],
		"mapped",
		[
			39740
		]
	],
	[
		[
			12226,
			12226
		],
		"mapped",
		[
			39770
		]
	],
	[
		[
			12227,
			12227
		],
		"mapped",
		[
			40165
		]
	],
	[
		[
			12228,
			12228
		],
		"mapped",
		[
			40565
		]
	],
	[
		[
			12229,
			12229
		],
		"mapped",
		[
			40575
		]
	],
	[
		[
			12230,
			12230
		],
		"mapped",
		[
			40613
		]
	],
	[
		[
			12231,
			12231
		],
		"mapped",
		[
			40635
		]
	],
	[
		[
			12232,
			12232
		],
		"mapped",
		[
			40643
		]
	],
	[
		[
			12233,
			12233
		],
		"mapped",
		[
			40653
		]
	],
	[
		[
			12234,
			12234
		],
		"mapped",
		[
			40657
		]
	],
	[
		[
			12235,
			12235
		],
		"mapped",
		[
			40697
		]
	],
	[
		[
			12236,
			12236
		],
		"mapped",
		[
			40701
		]
	],
	[
		[
			12237,
			12237
		],
		"mapped",
		[
			40718
		]
	],
	[
		[
			12238,
			12238
		],
		"mapped",
		[
			40723
		]
	],
	[
		[
			12239,
			12239
		],
		"mapped",
		[
			40736
		]
	],
	[
		[
			12240,
			12240
		],
		"mapped",
		[
			40763
		]
	],
	[
		[
			12241,
			12241
		],
		"mapped",
		[
			40778
		]
	],
	[
		[
			12242,
			12242
		],
		"mapped",
		[
			40786
		]
	],
	[
		[
			12243,
			12243
		],
		"mapped",
		[
			40845
		]
	],
	[
		[
			12244,
			12244
		],
		"mapped",
		[
			40860
		]
	],
	[
		[
			12245,
			12245
		],
		"mapped",
		[
			40864
		]
	],
	[
		[
			12246,
			12271
		],
		"disallowed"
	],
	[
		[
			12272,
			12283
		],
		"disallowed"
	],
	[
		[
			12284,
			12287
		],
		"disallowed"
	],
	[
		[
			12288,
			12288
		],
		"disallowed_STD3_mapped",
		[
			32
		]
	],
	[
		[
			12289,
			12289
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12290,
			12290
		],
		"mapped",
		[
			46
		]
	],
	[
		[
			12291,
			12292
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12293,
			12295
		],
		"valid"
	],
	[
		[
			12296,
			12329
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12330,
			12333
		],
		"valid"
	],
	[
		[
			12334,
			12341
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12342,
			12342
		],
		"mapped",
		[
			12306
		]
	],
	[
		[
			12343,
			12343
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12344,
			12344
		],
		"mapped",
		[
			21313
		]
	],
	[
		[
			12345,
			12345
		],
		"mapped",
		[
			21316
		]
	],
	[
		[
			12346,
			12346
		],
		"mapped",
		[
			21317
		]
	],
	[
		[
			12347,
			12347
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12348,
			12348
		],
		"valid"
	],
	[
		[
			12349,
			12349
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12350,
			12350
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12351,
			12351
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12352,
			12352
		],
		"disallowed"
	],
	[
		[
			12353,
			12436
		],
		"valid"
	],
	[
		[
			12437,
			12438
		],
		"valid"
	],
	[
		[
			12439,
			12440
		],
		"disallowed"
	],
	[
		[
			12441,
			12442
		],
		"valid"
	],
	[
		[
			12443,
			12443
		],
		"disallowed_STD3_mapped",
		[
			32,
			12441
		]
	],
	[
		[
			12444,
			12444
		],
		"disallowed_STD3_mapped",
		[
			32,
			12442
		]
	],
	[
		[
			12445,
			12446
		],
		"valid"
	],
	[
		[
			12447,
			12447
		],
		"mapped",
		[
			12424,
			12426
		]
	],
	[
		[
			12448,
			12448
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12449,
			12542
		],
		"valid"
	],
	[
		[
			12543,
			12543
		],
		"mapped",
		[
			12467,
			12488
		]
	],
	[
		[
			12544,
			12548
		],
		"disallowed"
	],
	[
		[
			12549,
			12588
		],
		"valid"
	],
	[
		[
			12589,
			12589
		],
		"valid"
	],
	[
		[
			12590,
			12592
		],
		"disallowed"
	],
	[
		[
			12593,
			12593
		],
		"mapped",
		[
			4352
		]
	],
	[
		[
			12594,
			12594
		],
		"mapped",
		[
			4353
		]
	],
	[
		[
			12595,
			12595
		],
		"mapped",
		[
			4522
		]
	],
	[
		[
			12596,
			12596
		],
		"mapped",
		[
			4354
		]
	],
	[
		[
			12597,
			12597
		],
		"mapped",
		[
			4524
		]
	],
	[
		[
			12598,
			12598
		],
		"mapped",
		[
			4525
		]
	],
	[
		[
			12599,
			12599
		],
		"mapped",
		[
			4355
		]
	],
	[
		[
			12600,
			12600
		],
		"mapped",
		[
			4356
		]
	],
	[
		[
			12601,
			12601
		],
		"mapped",
		[
			4357
		]
	],
	[
		[
			12602,
			12602
		],
		"mapped",
		[
			4528
		]
	],
	[
		[
			12603,
			12603
		],
		"mapped",
		[
			4529
		]
	],
	[
		[
			12604,
			12604
		],
		"mapped",
		[
			4530
		]
	],
	[
		[
			12605,
			12605
		],
		"mapped",
		[
			4531
		]
	],
	[
		[
			12606,
			12606
		],
		"mapped",
		[
			4532
		]
	],
	[
		[
			12607,
			12607
		],
		"mapped",
		[
			4533
		]
	],
	[
		[
			12608,
			12608
		],
		"mapped",
		[
			4378
		]
	],
	[
		[
			12609,
			12609
		],
		"mapped",
		[
			4358
		]
	],
	[
		[
			12610,
			12610
		],
		"mapped",
		[
			4359
		]
	],
	[
		[
			12611,
			12611
		],
		"mapped",
		[
			4360
		]
	],
	[
		[
			12612,
			12612
		],
		"mapped",
		[
			4385
		]
	],
	[
		[
			12613,
			12613
		],
		"mapped",
		[
			4361
		]
	],
	[
		[
			12614,
			12614
		],
		"mapped",
		[
			4362
		]
	],
	[
		[
			12615,
			12615
		],
		"mapped",
		[
			4363
		]
	],
	[
		[
			12616,
			12616
		],
		"mapped",
		[
			4364
		]
	],
	[
		[
			12617,
			12617
		],
		"mapped",
		[
			4365
		]
	],
	[
		[
			12618,
			12618
		],
		"mapped",
		[
			4366
		]
	],
	[
		[
			12619,
			12619
		],
		"mapped",
		[
			4367
		]
	],
	[
		[
			12620,
			12620
		],
		"mapped",
		[
			4368
		]
	],
	[
		[
			12621,
			12621
		],
		"mapped",
		[
			4369
		]
	],
	[
		[
			12622,
			12622
		],
		"mapped",
		[
			4370
		]
	],
	[
		[
			12623,
			12623
		],
		"mapped",
		[
			4449
		]
	],
	[
		[
			12624,
			12624
		],
		"mapped",
		[
			4450
		]
	],
	[
		[
			12625,
			12625
		],
		"mapped",
		[
			4451
		]
	],
	[
		[
			12626,
			12626
		],
		"mapped",
		[
			4452
		]
	],
	[
		[
			12627,
			12627
		],
		"mapped",
		[
			4453
		]
	],
	[
		[
			12628,
			12628
		],
		"mapped",
		[
			4454
		]
	],
	[
		[
			12629,
			12629
		],
		"mapped",
		[
			4455
		]
	],
	[
		[
			12630,
			12630
		],
		"mapped",
		[
			4456
		]
	],
	[
		[
			12631,
			12631
		],
		"mapped",
		[
			4457
		]
	],
	[
		[
			12632,
			12632
		],
		"mapped",
		[
			4458
		]
	],
	[
		[
			12633,
			12633
		],
		"mapped",
		[
			4459
		]
	],
	[
		[
			12634,
			12634
		],
		"mapped",
		[
			4460
		]
	],
	[
		[
			12635,
			12635
		],
		"mapped",
		[
			4461
		]
	],
	[
		[
			12636,
			12636
		],
		"mapped",
		[
			4462
		]
	],
	[
		[
			12637,
			12637
		],
		"mapped",
		[
			4463
		]
	],
	[
		[
			12638,
			12638
		],
		"mapped",
		[
			4464
		]
	],
	[
		[
			12639,
			12639
		],
		"mapped",
		[
			4465
		]
	],
	[
		[
			12640,
			12640
		],
		"mapped",
		[
			4466
		]
	],
	[
		[
			12641,
			12641
		],
		"mapped",
		[
			4467
		]
	],
	[
		[
			12642,
			12642
		],
		"mapped",
		[
			4468
		]
	],
	[
		[
			12643,
			12643
		],
		"mapped",
		[
			4469
		]
	],
	[
		[
			12644,
			12644
		],
		"disallowed"
	],
	[
		[
			12645,
			12645
		],
		"mapped",
		[
			4372
		]
	],
	[
		[
			12646,
			12646
		],
		"mapped",
		[
			4373
		]
	],
	[
		[
			12647,
			12647
		],
		"mapped",
		[
			4551
		]
	],
	[
		[
			12648,
			12648
		],
		"mapped",
		[
			4552
		]
	],
	[
		[
			12649,
			12649
		],
		"mapped",
		[
			4556
		]
	],
	[
		[
			12650,
			12650
		],
		"mapped",
		[
			4558
		]
	],
	[
		[
			12651,
			12651
		],
		"mapped",
		[
			4563
		]
	],
	[
		[
			12652,
			12652
		],
		"mapped",
		[
			4567
		]
	],
	[
		[
			12653,
			12653
		],
		"mapped",
		[
			4569
		]
	],
	[
		[
			12654,
			12654
		],
		"mapped",
		[
			4380
		]
	],
	[
		[
			12655,
			12655
		],
		"mapped",
		[
			4573
		]
	],
	[
		[
			12656,
			12656
		],
		"mapped",
		[
			4575
		]
	],
	[
		[
			12657,
			12657
		],
		"mapped",
		[
			4381
		]
	],
	[
		[
			12658,
			12658
		],
		"mapped",
		[
			4382
		]
	],
	[
		[
			12659,
			12659
		],
		"mapped",
		[
			4384
		]
	],
	[
		[
			12660,
			12660
		],
		"mapped",
		[
			4386
		]
	],
	[
		[
			12661,
			12661
		],
		"mapped",
		[
			4387
		]
	],
	[
		[
			12662,
			12662
		],
		"mapped",
		[
			4391
		]
	],
	[
		[
			12663,
			12663
		],
		"mapped",
		[
			4393
		]
	],
	[
		[
			12664,
			12664
		],
		"mapped",
		[
			4395
		]
	],
	[
		[
			12665,
			12665
		],
		"mapped",
		[
			4396
		]
	],
	[
		[
			12666,
			12666
		],
		"mapped",
		[
			4397
		]
	],
	[
		[
			12667,
			12667
		],
		"mapped",
		[
			4398
		]
	],
	[
		[
			12668,
			12668
		],
		"mapped",
		[
			4399
		]
	],
	[
		[
			12669,
			12669
		],
		"mapped",
		[
			4402
		]
	],
	[
		[
			12670,
			12670
		],
		"mapped",
		[
			4406
		]
	],
	[
		[
			12671,
			12671
		],
		"mapped",
		[
			4416
		]
	],
	[
		[
			12672,
			12672
		],
		"mapped",
		[
			4423
		]
	],
	[
		[
			12673,
			12673
		],
		"mapped",
		[
			4428
		]
	],
	[
		[
			12674,
			12674
		],
		"mapped",
		[
			4593
		]
	],
	[
		[
			12675,
			12675
		],
		"mapped",
		[
			4594
		]
	],
	[
		[
			12676,
			12676
		],
		"mapped",
		[
			4439
		]
	],
	[
		[
			12677,
			12677
		],
		"mapped",
		[
			4440
		]
	],
	[
		[
			12678,
			12678
		],
		"mapped",
		[
			4441
		]
	],
	[
		[
			12679,
			12679
		],
		"mapped",
		[
			4484
		]
	],
	[
		[
			12680,
			12680
		],
		"mapped",
		[
			4485
		]
	],
	[
		[
			12681,
			12681
		],
		"mapped",
		[
			4488
		]
	],
	[
		[
			12682,
			12682
		],
		"mapped",
		[
			4497
		]
	],
	[
		[
			12683,
			12683
		],
		"mapped",
		[
			4498
		]
	],
	[
		[
			12684,
			12684
		],
		"mapped",
		[
			4500
		]
	],
	[
		[
			12685,
			12685
		],
		"mapped",
		[
			4510
		]
	],
	[
		[
			12686,
			12686
		],
		"mapped",
		[
			4513
		]
	],
	[
		[
			12687,
			12687
		],
		"disallowed"
	],
	[
		[
			12688,
			12689
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12690,
			12690
		],
		"mapped",
		[
			19968
		]
	],
	[
		[
			12691,
			12691
		],
		"mapped",
		[
			20108
		]
	],
	[
		[
			12692,
			12692
		],
		"mapped",
		[
			19977
		]
	],
	[
		[
			12693,
			12693
		],
		"mapped",
		[
			22235
		]
	],
	[
		[
			12694,
			12694
		],
		"mapped",
		[
			19978
		]
	],
	[
		[
			12695,
			12695
		],
		"mapped",
		[
			20013
		]
	],
	[
		[
			12696,
			12696
		],
		"mapped",
		[
			19979
		]
	],
	[
		[
			12697,
			12697
		],
		"mapped",
		[
			30002
		]
	],
	[
		[
			12698,
			12698
		],
		"mapped",
		[
			20057
		]
	],
	[
		[
			12699,
			12699
		],
		"mapped",
		[
			19993
		]
	],
	[
		[
			12700,
			12700
		],
		"mapped",
		[
			19969
		]
	],
	[
		[
			12701,
			12701
		],
		"mapped",
		[
			22825
		]
	],
	[
		[
			12702,
			12702
		],
		"mapped",
		[
			22320
		]
	],
	[
		[
			12703,
			12703
		],
		"mapped",
		[
			20154
		]
	],
	[
		[
			12704,
			12727
		],
		"valid"
	],
	[
		[
			12728,
			12730
		],
		"valid"
	],
	[
		[
			12731,
			12735
		],
		"disallowed"
	],
	[
		[
			12736,
			12751
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12752,
			12771
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12772,
			12783
		],
		"disallowed"
	],
	[
		[
			12784,
			12799
		],
		"valid"
	],
	[
		[
			12800,
			12800
		],
		"disallowed_STD3_mapped",
		[
			40,
			4352,
			41
		]
	],
	[
		[
			12801,
			12801
		],
		"disallowed_STD3_mapped",
		[
			40,
			4354,
			41
		]
	],
	[
		[
			12802,
			12802
		],
		"disallowed_STD3_mapped",
		[
			40,
			4355,
			41
		]
	],
	[
		[
			12803,
			12803
		],
		"disallowed_STD3_mapped",
		[
			40,
			4357,
			41
		]
	],
	[
		[
			12804,
			12804
		],
		"disallowed_STD3_mapped",
		[
			40,
			4358,
			41
		]
	],
	[
		[
			12805,
			12805
		],
		"disallowed_STD3_mapped",
		[
			40,
			4359,
			41
		]
	],
	[
		[
			12806,
			12806
		],
		"disallowed_STD3_mapped",
		[
			40,
			4361,
			41
		]
	],
	[
		[
			12807,
			12807
		],
		"disallowed_STD3_mapped",
		[
			40,
			4363,
			41
		]
	],
	[
		[
			12808,
			12808
		],
		"disallowed_STD3_mapped",
		[
			40,
			4364,
			41
		]
	],
	[
		[
			12809,
			12809
		],
		"disallowed_STD3_mapped",
		[
			40,
			4366,
			41
		]
	],
	[
		[
			12810,
			12810
		],
		"disallowed_STD3_mapped",
		[
			40,
			4367,
			41
		]
	],
	[
		[
			12811,
			12811
		],
		"disallowed_STD3_mapped",
		[
			40,
			4368,
			41
		]
	],
	[
		[
			12812,
			12812
		],
		"disallowed_STD3_mapped",
		[
			40,
			4369,
			41
		]
	],
	[
		[
			12813,
			12813
		],
		"disallowed_STD3_mapped",
		[
			40,
			4370,
			41
		]
	],
	[
		[
			12814,
			12814
		],
		"disallowed_STD3_mapped",
		[
			40,
			44032,
			41
		]
	],
	[
		[
			12815,
			12815
		],
		"disallowed_STD3_mapped",
		[
			40,
			45208,
			41
		]
	],
	[
		[
			12816,
			12816
		],
		"disallowed_STD3_mapped",
		[
			40,
			45796,
			41
		]
	],
	[
		[
			12817,
			12817
		],
		"disallowed_STD3_mapped",
		[
			40,
			46972,
			41
		]
	],
	[
		[
			12818,
			12818
		],
		"disallowed_STD3_mapped",
		[
			40,
			47560,
			41
		]
	],
	[
		[
			12819,
			12819
		],
		"disallowed_STD3_mapped",
		[
			40,
			48148,
			41
		]
	],
	[
		[
			12820,
			12820
		],
		"disallowed_STD3_mapped",
		[
			40,
			49324,
			41
		]
	],
	[
		[
			12821,
			12821
		],
		"disallowed_STD3_mapped",
		[
			40,
			50500,
			41
		]
	],
	[
		[
			12822,
			12822
		],
		"disallowed_STD3_mapped",
		[
			40,
			51088,
			41
		]
	],
	[
		[
			12823,
			12823
		],
		"disallowed_STD3_mapped",
		[
			40,
			52264,
			41
		]
	],
	[
		[
			12824,
			12824
		],
		"disallowed_STD3_mapped",
		[
			40,
			52852,
			41
		]
	],
	[
		[
			12825,
			12825
		],
		"disallowed_STD3_mapped",
		[
			40,
			53440,
			41
		]
	],
	[
		[
			12826,
			12826
		],
		"disallowed_STD3_mapped",
		[
			40,
			54028,
			41
		]
	],
	[
		[
			12827,
			12827
		],
		"disallowed_STD3_mapped",
		[
			40,
			54616,
			41
		]
	],
	[
		[
			12828,
			12828
		],
		"disallowed_STD3_mapped",
		[
			40,
			51452,
			41
		]
	],
	[
		[
			12829,
			12829
		],
		"disallowed_STD3_mapped",
		[
			40,
			50724,
			51204,
			41
		]
	],
	[
		[
			12830,
			12830
		],
		"disallowed_STD3_mapped",
		[
			40,
			50724,
			54980,
			41
		]
	],
	[
		[
			12831,
			12831
		],
		"disallowed"
	],
	[
		[
			12832,
			12832
		],
		"disallowed_STD3_mapped",
		[
			40,
			19968,
			41
		]
	],
	[
		[
			12833,
			12833
		],
		"disallowed_STD3_mapped",
		[
			40,
			20108,
			41
		]
	],
	[
		[
			12834,
			12834
		],
		"disallowed_STD3_mapped",
		[
			40,
			19977,
			41
		]
	],
	[
		[
			12835,
			12835
		],
		"disallowed_STD3_mapped",
		[
			40,
			22235,
			41
		]
	],
	[
		[
			12836,
			12836
		],
		"disallowed_STD3_mapped",
		[
			40,
			20116,
			41
		]
	],
	[
		[
			12837,
			12837
		],
		"disallowed_STD3_mapped",
		[
			40,
			20845,
			41
		]
	],
	[
		[
			12838,
			12838
		],
		"disallowed_STD3_mapped",
		[
			40,
			19971,
			41
		]
	],
	[
		[
			12839,
			12839
		],
		"disallowed_STD3_mapped",
		[
			40,
			20843,
			41
		]
	],
	[
		[
			12840,
			12840
		],
		"disallowed_STD3_mapped",
		[
			40,
			20061,
			41
		]
	],
	[
		[
			12841,
			12841
		],
		"disallowed_STD3_mapped",
		[
			40,
			21313,
			41
		]
	],
	[
		[
			12842,
			12842
		],
		"disallowed_STD3_mapped",
		[
			40,
			26376,
			41
		]
	],
	[
		[
			12843,
			12843
		],
		"disallowed_STD3_mapped",
		[
			40,
			28779,
			41
		]
	],
	[
		[
			12844,
			12844
		],
		"disallowed_STD3_mapped",
		[
			40,
			27700,
			41
		]
	],
	[
		[
			12845,
			12845
		],
		"disallowed_STD3_mapped",
		[
			40,
			26408,
			41
		]
	],
	[
		[
			12846,
			12846
		],
		"disallowed_STD3_mapped",
		[
			40,
			37329,
			41
		]
	],
	[
		[
			12847,
			12847
		],
		"disallowed_STD3_mapped",
		[
			40,
			22303,
			41
		]
	],
	[
		[
			12848,
			12848
		],
		"disallowed_STD3_mapped",
		[
			40,
			26085,
			41
		]
	],
	[
		[
			12849,
			12849
		],
		"disallowed_STD3_mapped",
		[
			40,
			26666,
			41
		]
	],
	[
		[
			12850,
			12850
		],
		"disallowed_STD3_mapped",
		[
			40,
			26377,
			41
		]
	],
	[
		[
			12851,
			12851
		],
		"disallowed_STD3_mapped",
		[
			40,
			31038,
			41
		]
	],
	[
		[
			12852,
			12852
		],
		"disallowed_STD3_mapped",
		[
			40,
			21517,
			41
		]
	],
	[
		[
			12853,
			12853
		],
		"disallowed_STD3_mapped",
		[
			40,
			29305,
			41
		]
	],
	[
		[
			12854,
			12854
		],
		"disallowed_STD3_mapped",
		[
			40,
			36001,
			41
		]
	],
	[
		[
			12855,
			12855
		],
		"disallowed_STD3_mapped",
		[
			40,
			31069,
			41
		]
	],
	[
		[
			12856,
			12856
		],
		"disallowed_STD3_mapped",
		[
			40,
			21172,
			41
		]
	],
	[
		[
			12857,
			12857
		],
		"disallowed_STD3_mapped",
		[
			40,
			20195,
			41
		]
	],
	[
		[
			12858,
			12858
		],
		"disallowed_STD3_mapped",
		[
			40,
			21628,
			41
		]
	],
	[
		[
			12859,
			12859
		],
		"disallowed_STD3_mapped",
		[
			40,
			23398,
			41
		]
	],
	[
		[
			12860,
			12860
		],
		"disallowed_STD3_mapped",
		[
			40,
			30435,
			41
		]
	],
	[
		[
			12861,
			12861
		],
		"disallowed_STD3_mapped",
		[
			40,
			20225,
			41
		]
	],
	[
		[
			12862,
			12862
		],
		"disallowed_STD3_mapped",
		[
			40,
			36039,
			41
		]
	],
	[
		[
			12863,
			12863
		],
		"disallowed_STD3_mapped",
		[
			40,
			21332,
			41
		]
	],
	[
		[
			12864,
			12864
		],
		"disallowed_STD3_mapped",
		[
			40,
			31085,
			41
		]
	],
	[
		[
			12865,
			12865
		],
		"disallowed_STD3_mapped",
		[
			40,
			20241,
			41
		]
	],
	[
		[
			12866,
			12866
		],
		"disallowed_STD3_mapped",
		[
			40,
			33258,
			41
		]
	],
	[
		[
			12867,
			12867
		],
		"disallowed_STD3_mapped",
		[
			40,
			33267,
			41
		]
	],
	[
		[
			12868,
			12868
		],
		"mapped",
		[
			21839
		]
	],
	[
		[
			12869,
			12869
		],
		"mapped",
		[
			24188
		]
	],
	[
		[
			12870,
			12870
		],
		"mapped",
		[
			25991
		]
	],
	[
		[
			12871,
			12871
		],
		"mapped",
		[
			31631
		]
	],
	[
		[
			12872,
			12879
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12880,
			12880
		],
		"mapped",
		[
			112,
			116,
			101
		]
	],
	[
		[
			12881,
			12881
		],
		"mapped",
		[
			50,
			49
		]
	],
	[
		[
			12882,
			12882
		],
		"mapped",
		[
			50,
			50
		]
	],
	[
		[
			12883,
			12883
		],
		"mapped",
		[
			50,
			51
		]
	],
	[
		[
			12884,
			12884
		],
		"mapped",
		[
			50,
			52
		]
	],
	[
		[
			12885,
			12885
		],
		"mapped",
		[
			50,
			53
		]
	],
	[
		[
			12886,
			12886
		],
		"mapped",
		[
			50,
			54
		]
	],
	[
		[
			12887,
			12887
		],
		"mapped",
		[
			50,
			55
		]
	],
	[
		[
			12888,
			12888
		],
		"mapped",
		[
			50,
			56
		]
	],
	[
		[
			12889,
			12889
		],
		"mapped",
		[
			50,
			57
		]
	],
	[
		[
			12890,
			12890
		],
		"mapped",
		[
			51,
			48
		]
	],
	[
		[
			12891,
			12891
		],
		"mapped",
		[
			51,
			49
		]
	],
	[
		[
			12892,
			12892
		],
		"mapped",
		[
			51,
			50
		]
	],
	[
		[
			12893,
			12893
		],
		"mapped",
		[
			51,
			51
		]
	],
	[
		[
			12894,
			12894
		],
		"mapped",
		[
			51,
			52
		]
	],
	[
		[
			12895,
			12895
		],
		"mapped",
		[
			51,
			53
		]
	],
	[
		[
			12896,
			12896
		],
		"mapped",
		[
			4352
		]
	],
	[
		[
			12897,
			12897
		],
		"mapped",
		[
			4354
		]
	],
	[
		[
			12898,
			12898
		],
		"mapped",
		[
			4355
		]
	],
	[
		[
			12899,
			12899
		],
		"mapped",
		[
			4357
		]
	],
	[
		[
			12900,
			12900
		],
		"mapped",
		[
			4358
		]
	],
	[
		[
			12901,
			12901
		],
		"mapped",
		[
			4359
		]
	],
	[
		[
			12902,
			12902
		],
		"mapped",
		[
			4361
		]
	],
	[
		[
			12903,
			12903
		],
		"mapped",
		[
			4363
		]
	],
	[
		[
			12904,
			12904
		],
		"mapped",
		[
			4364
		]
	],
	[
		[
			12905,
			12905
		],
		"mapped",
		[
			4366
		]
	],
	[
		[
			12906,
			12906
		],
		"mapped",
		[
			4367
		]
	],
	[
		[
			12907,
			12907
		],
		"mapped",
		[
			4368
		]
	],
	[
		[
			12908,
			12908
		],
		"mapped",
		[
			4369
		]
	],
	[
		[
			12909,
			12909
		],
		"mapped",
		[
			4370
		]
	],
	[
		[
			12910,
			12910
		],
		"mapped",
		[
			44032
		]
	],
	[
		[
			12911,
			12911
		],
		"mapped",
		[
			45208
		]
	],
	[
		[
			12912,
			12912
		],
		"mapped",
		[
			45796
		]
	],
	[
		[
			12913,
			12913
		],
		"mapped",
		[
			46972
		]
	],
	[
		[
			12914,
			12914
		],
		"mapped",
		[
			47560
		]
	],
	[
		[
			12915,
			12915
		],
		"mapped",
		[
			48148
		]
	],
	[
		[
			12916,
			12916
		],
		"mapped",
		[
			49324
		]
	],
	[
		[
			12917,
			12917
		],
		"mapped",
		[
			50500
		]
	],
	[
		[
			12918,
			12918
		],
		"mapped",
		[
			51088
		]
	],
	[
		[
			12919,
			12919
		],
		"mapped",
		[
			52264
		]
	],
	[
		[
			12920,
			12920
		],
		"mapped",
		[
			52852
		]
	],
	[
		[
			12921,
			12921
		],
		"mapped",
		[
			53440
		]
	],
	[
		[
			12922,
			12922
		],
		"mapped",
		[
			54028
		]
	],
	[
		[
			12923,
			12923
		],
		"mapped",
		[
			54616
		]
	],
	[
		[
			12924,
			12924
		],
		"mapped",
		[
			52280,
			44256
		]
	],
	[
		[
			12925,
			12925
		],
		"mapped",
		[
			51452,
			51032
		]
	],
	[
		[
			12926,
			12926
		],
		"mapped",
		[
			50864
		]
	],
	[
		[
			12927,
			12927
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			12928,
			12928
		],
		"mapped",
		[
			19968
		]
	],
	[
		[
			12929,
			12929
		],
		"mapped",
		[
			20108
		]
	],
	[
		[
			12930,
			12930
		],
		"mapped",
		[
			19977
		]
	],
	[
		[
			12931,
			12931
		],
		"mapped",
		[
			22235
		]
	],
	[
		[
			12932,
			12932
		],
		"mapped",
		[
			20116
		]
	],
	[
		[
			12933,
			12933
		],
		"mapped",
		[
			20845
		]
	],
	[
		[
			12934,
			12934
		],
		"mapped",
		[
			19971
		]
	],
	[
		[
			12935,
			12935
		],
		"mapped",
		[
			20843
		]
	],
	[
		[
			12936,
			12936
		],
		"mapped",
		[
			20061
		]
	],
	[
		[
			12937,
			12937
		],
		"mapped",
		[
			21313
		]
	],
	[
		[
			12938,
			12938
		],
		"mapped",
		[
			26376
		]
	],
	[
		[
			12939,
			12939
		],
		"mapped",
		[
			28779
		]
	],
	[
		[
			12940,
			12940
		],
		"mapped",
		[
			27700
		]
	],
	[
		[
			12941,
			12941
		],
		"mapped",
		[
			26408
		]
	],
	[
		[
			12942,
			12942
		],
		"mapped",
		[
			37329
		]
	],
	[
		[
			12943,
			12943
		],
		"mapped",
		[
			22303
		]
	],
	[
		[
			12944,
			12944
		],
		"mapped",
		[
			26085
		]
	],
	[
		[
			12945,
			12945
		],
		"mapped",
		[
			26666
		]
	],
	[
		[
			12946,
			12946
		],
		"mapped",
		[
			26377
		]
	],
	[
		[
			12947,
			12947
		],
		"mapped",
		[
			31038
		]
	],
	[
		[
			12948,
			12948
		],
		"mapped",
		[
			21517
		]
	],
	[
		[
			12949,
			12949
		],
		"mapped",
		[
			29305
		]
	],
	[
		[
			12950,
			12950
		],
		"mapped",
		[
			36001
		]
	],
	[
		[
			12951,
			12951
		],
		"mapped",
		[
			31069
		]
	],
	[
		[
			12952,
			12952
		],
		"mapped",
		[
			21172
		]
	],
	[
		[
			12953,
			12953
		],
		"mapped",
		[
			31192
		]
	],
	[
		[
			12954,
			12954
		],
		"mapped",
		[
			30007
		]
	],
	[
		[
			12955,
			12955
		],
		"mapped",
		[
			22899
		]
	],
	[
		[
			12956,
			12956
		],
		"mapped",
		[
			36969
		]
	],
	[
		[
			12957,
			12957
		],
		"mapped",
		[
			20778
		]
	],
	[
		[
			12958,
			12958
		],
		"mapped",
		[
			21360
		]
	],
	[
		[
			12959,
			12959
		],
		"mapped",
		[
			27880
		]
	],
	[
		[
			12960,
			12960
		],
		"mapped",
		[
			38917
		]
	],
	[
		[
			12961,
			12961
		],
		"mapped",
		[
			20241
		]
	],
	[
		[
			12962,
			12962
		],
		"mapped",
		[
			20889
		]
	],
	[
		[
			12963,
			12963
		],
		"mapped",
		[
			27491
		]
	],
	[
		[
			12964,
			12964
		],
		"mapped",
		[
			19978
		]
	],
	[
		[
			12965,
			12965
		],
		"mapped",
		[
			20013
		]
	],
	[
		[
			12966,
			12966
		],
		"mapped",
		[
			19979
		]
	],
	[
		[
			12967,
			12967
		],
		"mapped",
		[
			24038
		]
	],
	[
		[
			12968,
			12968
		],
		"mapped",
		[
			21491
		]
	],
	[
		[
			12969,
			12969
		],
		"mapped",
		[
			21307
		]
	],
	[
		[
			12970,
			12970
		],
		"mapped",
		[
			23447
		]
	],
	[
		[
			12971,
			12971
		],
		"mapped",
		[
			23398
		]
	],
	[
		[
			12972,
			12972
		],
		"mapped",
		[
			30435
		]
	],
	[
		[
			12973,
			12973
		],
		"mapped",
		[
			20225
		]
	],
	[
		[
			12974,
			12974
		],
		"mapped",
		[
			36039
		]
	],
	[
		[
			12975,
			12975
		],
		"mapped",
		[
			21332
		]
	],
	[
		[
			12976,
			12976
		],
		"mapped",
		[
			22812
		]
	],
	[
		[
			12977,
			12977
		],
		"mapped",
		[
			51,
			54
		]
	],
	[
		[
			12978,
			12978
		],
		"mapped",
		[
			51,
			55
		]
	],
	[
		[
			12979,
			12979
		],
		"mapped",
		[
			51,
			56
		]
	],
	[
		[
			12980,
			12980
		],
		"mapped",
		[
			51,
			57
		]
	],
	[
		[
			12981,
			12981
		],
		"mapped",
		[
			52,
			48
		]
	],
	[
		[
			12982,
			12982
		],
		"mapped",
		[
			52,
			49
		]
	],
	[
		[
			12983,
			12983
		],
		"mapped",
		[
			52,
			50
		]
	],
	[
		[
			12984,
			12984
		],
		"mapped",
		[
			52,
			51
		]
	],
	[
		[
			12985,
			12985
		],
		"mapped",
		[
			52,
			52
		]
	],
	[
		[
			12986,
			12986
		],
		"mapped",
		[
			52,
			53
		]
	],
	[
		[
			12987,
			12987
		],
		"mapped",
		[
			52,
			54
		]
	],
	[
		[
			12988,
			12988
		],
		"mapped",
		[
			52,
			55
		]
	],
	[
		[
			12989,
			12989
		],
		"mapped",
		[
			52,
			56
		]
	],
	[
		[
			12990,
			12990
		],
		"mapped",
		[
			52,
			57
		]
	],
	[
		[
			12991,
			12991
		],
		"mapped",
		[
			53,
			48
		]
	],
	[
		[
			12992,
			12992
		],
		"mapped",
		[
			49,
			26376
		]
	],
	[
		[
			12993,
			12993
		],
		"mapped",
		[
			50,
			26376
		]
	],
	[
		[
			12994,
			12994
		],
		"mapped",
		[
			51,
			26376
		]
	],
	[
		[
			12995,
			12995
		],
		"mapped",
		[
			52,
			26376
		]
	],
	[
		[
			12996,
			12996
		],
		"mapped",
		[
			53,
			26376
		]
	],
	[
		[
			12997,
			12997
		],
		"mapped",
		[
			54,
			26376
		]
	],
	[
		[
			12998,
			12998
		],
		"mapped",
		[
			55,
			26376
		]
	],
	[
		[
			12999,
			12999
		],
		"mapped",
		[
			56,
			26376
		]
	],
	[
		[
			13000,
			13000
		],
		"mapped",
		[
			57,
			26376
		]
	],
	[
		[
			13001,
			13001
		],
		"mapped",
		[
			49,
			48,
			26376
		]
	],
	[
		[
			13002,
			13002
		],
		"mapped",
		[
			49,
			49,
			26376
		]
	],
	[
		[
			13003,
			13003
		],
		"mapped",
		[
			49,
			50,
			26376
		]
	],
	[
		[
			13004,
			13004
		],
		"mapped",
		[
			104,
			103
		]
	],
	[
		[
			13005,
			13005
		],
		"mapped",
		[
			101,
			114,
			103
		]
	],
	[
		[
			13006,
			13006
		],
		"mapped",
		[
			101,
			118
		]
	],
	[
		[
			13007,
			13007
		],
		"mapped",
		[
			108,
			116,
			100
		]
	],
	[
		[
			13008,
			13008
		],
		"mapped",
		[
			12450
		]
	],
	[
		[
			13009,
			13009
		],
		"mapped",
		[
			12452
		]
	],
	[
		[
			13010,
			13010
		],
		"mapped",
		[
			12454
		]
	],
	[
		[
			13011,
			13011
		],
		"mapped",
		[
			12456
		]
	],
	[
		[
			13012,
			13012
		],
		"mapped",
		[
			12458
		]
	],
	[
		[
			13013,
			13013
		],
		"mapped",
		[
			12459
		]
	],
	[
		[
			13014,
			13014
		],
		"mapped",
		[
			12461
		]
	],
	[
		[
			13015,
			13015
		],
		"mapped",
		[
			12463
		]
	],
	[
		[
			13016,
			13016
		],
		"mapped",
		[
			12465
		]
	],
	[
		[
			13017,
			13017
		],
		"mapped",
		[
			12467
		]
	],
	[
		[
			13018,
			13018
		],
		"mapped",
		[
			12469
		]
	],
	[
		[
			13019,
			13019
		],
		"mapped",
		[
			12471
		]
	],
	[
		[
			13020,
			13020
		],
		"mapped",
		[
			12473
		]
	],
	[
		[
			13021,
			13021
		],
		"mapped",
		[
			12475
		]
	],
	[
		[
			13022,
			13022
		],
		"mapped",
		[
			12477
		]
	],
	[
		[
			13023,
			13023
		],
		"mapped",
		[
			12479
		]
	],
	[
		[
			13024,
			13024
		],
		"mapped",
		[
			12481
		]
	],
	[
		[
			13025,
			13025
		],
		"mapped",
		[
			12484
		]
	],
	[
		[
			13026,
			13026
		],
		"mapped",
		[
			12486
		]
	],
	[
		[
			13027,
			13027
		],
		"mapped",
		[
			12488
		]
	],
	[
		[
			13028,
			13028
		],
		"mapped",
		[
			12490
		]
	],
	[
		[
			13029,
			13029
		],
		"mapped",
		[
			12491
		]
	],
	[
		[
			13030,
			13030
		],
		"mapped",
		[
			12492
		]
	],
	[
		[
			13031,
			13031
		],
		"mapped",
		[
			12493
		]
	],
	[
		[
			13032,
			13032
		],
		"mapped",
		[
			12494
		]
	],
	[
		[
			13033,
			13033
		],
		"mapped",
		[
			12495
		]
	],
	[
		[
			13034,
			13034
		],
		"mapped",
		[
			12498
		]
	],
	[
		[
			13035,
			13035
		],
		"mapped",
		[
			12501
		]
	],
	[
		[
			13036,
			13036
		],
		"mapped",
		[
			12504
		]
	],
	[
		[
			13037,
			13037
		],
		"mapped",
		[
			12507
		]
	],
	[
		[
			13038,
			13038
		],
		"mapped",
		[
			12510
		]
	],
	[
		[
			13039,
			13039
		],
		"mapped",
		[
			12511
		]
	],
	[
		[
			13040,
			13040
		],
		"mapped",
		[
			12512
		]
	],
	[
		[
			13041,
			13041
		],
		"mapped",
		[
			12513
		]
	],
	[
		[
			13042,
			13042
		],
		"mapped",
		[
			12514
		]
	],
	[
		[
			13043,
			13043
		],
		"mapped",
		[
			12516
		]
	],
	[
		[
			13044,
			13044
		],
		"mapped",
		[
			12518
		]
	],
	[
		[
			13045,
			13045
		],
		"mapped",
		[
			12520
		]
	],
	[
		[
			13046,
			13046
		],
		"mapped",
		[
			12521
		]
	],
	[
		[
			13047,
			13047
		],
		"mapped",
		[
			12522
		]
	],
	[
		[
			13048,
			13048
		],
		"mapped",
		[
			12523
		]
	],
	[
		[
			13049,
			13049
		],
		"mapped",
		[
			12524
		]
	],
	[
		[
			13050,
			13050
		],
		"mapped",
		[
			12525
		]
	],
	[
		[
			13051,
			13051
		],
		"mapped",
		[
			12527
		]
	],
	[
		[
			13052,
			13052
		],
		"mapped",
		[
			12528
		]
	],
	[
		[
			13053,
			13053
		],
		"mapped",
		[
			12529
		]
	],
	[
		[
			13054,
			13054
		],
		"mapped",
		[
			12530
		]
	],
	[
		[
			13055,
			13055
		],
		"disallowed"
	],
	[
		[
			13056,
			13056
		],
		"mapped",
		[
			12450,
			12497,
			12540,
			12488
		]
	],
	[
		[
			13057,
			13057
		],
		"mapped",
		[
			12450,
			12523,
			12501,
			12449
		]
	],
	[
		[
			13058,
			13058
		],
		"mapped",
		[
			12450,
			12531,
			12506,
			12450
		]
	],
	[
		[
			13059,
			13059
		],
		"mapped",
		[
			12450,
			12540,
			12523
		]
	],
	[
		[
			13060,
			13060
		],
		"mapped",
		[
			12452,
			12491,
			12531,
			12464
		]
	],
	[
		[
			13061,
			13061
		],
		"mapped",
		[
			12452,
			12531,
			12481
		]
	],
	[
		[
			13062,
			13062
		],
		"mapped",
		[
			12454,
			12457,
			12531
		]
	],
	[
		[
			13063,
			13063
		],
		"mapped",
		[
			12456,
			12473,
			12463,
			12540,
			12489
		]
	],
	[
		[
			13064,
			13064
		],
		"mapped",
		[
			12456,
			12540,
			12459,
			12540
		]
	],
	[
		[
			13065,
			13065
		],
		"mapped",
		[
			12458,
			12531,
			12473
		]
	],
	[
		[
			13066,
			13066
		],
		"mapped",
		[
			12458,
			12540,
			12512
		]
	],
	[
		[
			13067,
			13067
		],
		"mapped",
		[
			12459,
			12452,
			12522
		]
	],
	[
		[
			13068,
			13068
		],
		"mapped",
		[
			12459,
			12521,
			12483,
			12488
		]
	],
	[
		[
			13069,
			13069
		],
		"mapped",
		[
			12459,
			12525,
			12522,
			12540
		]
	],
	[
		[
			13070,
			13070
		],
		"mapped",
		[
			12460,
			12525,
			12531
		]
	],
	[
		[
			13071,
			13071
		],
		"mapped",
		[
			12460,
			12531,
			12510
		]
	],
	[
		[
			13072,
			13072
		],
		"mapped",
		[
			12462,
			12460
		]
	],
	[
		[
			13073,
			13073
		],
		"mapped",
		[
			12462,
			12491,
			12540
		]
	],
	[
		[
			13074,
			13074
		],
		"mapped",
		[
			12461,
			12517,
			12522,
			12540
		]
	],
	[
		[
			13075,
			13075
		],
		"mapped",
		[
			12462,
			12523,
			12480,
			12540
		]
	],
	[
		[
			13076,
			13076
		],
		"mapped",
		[
			12461,
			12525
		]
	],
	[
		[
			13077,
			13077
		],
		"mapped",
		[
			12461,
			12525,
			12464,
			12521,
			12512
		]
	],
	[
		[
			13078,
			13078
		],
		"mapped",
		[
			12461,
			12525,
			12513,
			12540,
			12488,
			12523
		]
	],
	[
		[
			13079,
			13079
		],
		"mapped",
		[
			12461,
			12525,
			12527,
			12483,
			12488
		]
	],
	[
		[
			13080,
			13080
		],
		"mapped",
		[
			12464,
			12521,
			12512
		]
	],
	[
		[
			13081,
			13081
		],
		"mapped",
		[
			12464,
			12521,
			12512,
			12488,
			12531
		]
	],
	[
		[
			13082,
			13082
		],
		"mapped",
		[
			12463,
			12523,
			12476,
			12452,
			12525
		]
	],
	[
		[
			13083,
			13083
		],
		"mapped",
		[
			12463,
			12525,
			12540,
			12493
		]
	],
	[
		[
			13084,
			13084
		],
		"mapped",
		[
			12465,
			12540,
			12473
		]
	],
	[
		[
			13085,
			13085
		],
		"mapped",
		[
			12467,
			12523,
			12490
		]
	],
	[
		[
			13086,
			13086
		],
		"mapped",
		[
			12467,
			12540,
			12509
		]
	],
	[
		[
			13087,
			13087
		],
		"mapped",
		[
			12469,
			12452,
			12463,
			12523
		]
	],
	[
		[
			13088,
			13088
		],
		"mapped",
		[
			12469,
			12531,
			12481,
			12540,
			12512
		]
	],
	[
		[
			13089,
			13089
		],
		"mapped",
		[
			12471,
			12522,
			12531,
			12464
		]
	],
	[
		[
			13090,
			13090
		],
		"mapped",
		[
			12475,
			12531,
			12481
		]
	],
	[
		[
			13091,
			13091
		],
		"mapped",
		[
			12475,
			12531,
			12488
		]
	],
	[
		[
			13092,
			13092
		],
		"mapped",
		[
			12480,
			12540,
			12473
		]
	],
	[
		[
			13093,
			13093
		],
		"mapped",
		[
			12487,
			12471
		]
	],
	[
		[
			13094,
			13094
		],
		"mapped",
		[
			12489,
			12523
		]
	],
	[
		[
			13095,
			13095
		],
		"mapped",
		[
			12488,
			12531
		]
	],
	[
		[
			13096,
			13096
		],
		"mapped",
		[
			12490,
			12494
		]
	],
	[
		[
			13097,
			13097
		],
		"mapped",
		[
			12494,
			12483,
			12488
		]
	],
	[
		[
			13098,
			13098
		],
		"mapped",
		[
			12495,
			12452,
			12484
		]
	],
	[
		[
			13099,
			13099
		],
		"mapped",
		[
			12497,
			12540,
			12475,
			12531,
			12488
		]
	],
	[
		[
			13100,
			13100
		],
		"mapped",
		[
			12497,
			12540,
			12484
		]
	],
	[
		[
			13101,
			13101
		],
		"mapped",
		[
			12496,
			12540,
			12524,
			12523
		]
	],
	[
		[
			13102,
			13102
		],
		"mapped",
		[
			12500,
			12450,
			12473,
			12488,
			12523
		]
	],
	[
		[
			13103,
			13103
		],
		"mapped",
		[
			12500,
			12463,
			12523
		]
	],
	[
		[
			13104,
			13104
		],
		"mapped",
		[
			12500,
			12467
		]
	],
	[
		[
			13105,
			13105
		],
		"mapped",
		[
			12499,
			12523
		]
	],
	[
		[
			13106,
			13106
		],
		"mapped",
		[
			12501,
			12449,
			12521,
			12483,
			12489
		]
	],
	[
		[
			13107,
			13107
		],
		"mapped",
		[
			12501,
			12451,
			12540,
			12488
		]
	],
	[
		[
			13108,
			13108
		],
		"mapped",
		[
			12502,
			12483,
			12471,
			12455,
			12523
		]
	],
	[
		[
			13109,
			13109
		],
		"mapped",
		[
			12501,
			12521,
			12531
		]
	],
	[
		[
			13110,
			13110
		],
		"mapped",
		[
			12504,
			12463,
			12479,
			12540,
			12523
		]
	],
	[
		[
			13111,
			13111
		],
		"mapped",
		[
			12506,
			12477
		]
	],
	[
		[
			13112,
			13112
		],
		"mapped",
		[
			12506,
			12491,
			12498
		]
	],
	[
		[
			13113,
			13113
		],
		"mapped",
		[
			12504,
			12523,
			12484
		]
	],
	[
		[
			13114,
			13114
		],
		"mapped",
		[
			12506,
			12531,
			12473
		]
	],
	[
		[
			13115,
			13115
		],
		"mapped",
		[
			12506,
			12540,
			12472
		]
	],
	[
		[
			13116,
			13116
		],
		"mapped",
		[
			12505,
			12540,
			12479
		]
	],
	[
		[
			13117,
			13117
		],
		"mapped",
		[
			12509,
			12452,
			12531,
			12488
		]
	],
	[
		[
			13118,
			13118
		],
		"mapped",
		[
			12508,
			12523,
			12488
		]
	],
	[
		[
			13119,
			13119
		],
		"mapped",
		[
			12507,
			12531
		]
	],
	[
		[
			13120,
			13120
		],
		"mapped",
		[
			12509,
			12531,
			12489
		]
	],
	[
		[
			13121,
			13121
		],
		"mapped",
		[
			12507,
			12540,
			12523
		]
	],
	[
		[
			13122,
			13122
		],
		"mapped",
		[
			12507,
			12540,
			12531
		]
	],
	[
		[
			13123,
			13123
		],
		"mapped",
		[
			12510,
			12452,
			12463,
			12525
		]
	],
	[
		[
			13124,
			13124
		],
		"mapped",
		[
			12510,
			12452,
			12523
		]
	],
	[
		[
			13125,
			13125
		],
		"mapped",
		[
			12510,
			12483,
			12495
		]
	],
	[
		[
			13126,
			13126
		],
		"mapped",
		[
			12510,
			12523,
			12463
		]
	],
	[
		[
			13127,
			13127
		],
		"mapped",
		[
			12510,
			12531,
			12471,
			12519,
			12531
		]
	],
	[
		[
			13128,
			13128
		],
		"mapped",
		[
			12511,
			12463,
			12525,
			12531
		]
	],
	[
		[
			13129,
			13129
		],
		"mapped",
		[
			12511,
			12522
		]
	],
	[
		[
			13130,
			13130
		],
		"mapped",
		[
			12511,
			12522,
			12496,
			12540,
			12523
		]
	],
	[
		[
			13131,
			13131
		],
		"mapped",
		[
			12513,
			12460
		]
	],
	[
		[
			13132,
			13132
		],
		"mapped",
		[
			12513,
			12460,
			12488,
			12531
		]
	],
	[
		[
			13133,
			13133
		],
		"mapped",
		[
			12513,
			12540,
			12488,
			12523
		]
	],
	[
		[
			13134,
			13134
		],
		"mapped",
		[
			12516,
			12540,
			12489
		]
	],
	[
		[
			13135,
			13135
		],
		"mapped",
		[
			12516,
			12540,
			12523
		]
	],
	[
		[
			13136,
			13136
		],
		"mapped",
		[
			12518,
			12450,
			12531
		]
	],
	[
		[
			13137,
			13137
		],
		"mapped",
		[
			12522,
			12483,
			12488,
			12523
		]
	],
	[
		[
			13138,
			13138
		],
		"mapped",
		[
			12522,
			12521
		]
	],
	[
		[
			13139,
			13139
		],
		"mapped",
		[
			12523,
			12500,
			12540
		]
	],
	[
		[
			13140,
			13140
		],
		"mapped",
		[
			12523,
			12540,
			12502,
			12523
		]
	],
	[
		[
			13141,
			13141
		],
		"mapped",
		[
			12524,
			12512
		]
	],
	[
		[
			13142,
			13142
		],
		"mapped",
		[
			12524,
			12531,
			12488,
			12466,
			12531
		]
	],
	[
		[
			13143,
			13143
		],
		"mapped",
		[
			12527,
			12483,
			12488
		]
	],
	[
		[
			13144,
			13144
		],
		"mapped",
		[
			48,
			28857
		]
	],
	[
		[
			13145,
			13145
		],
		"mapped",
		[
			49,
			28857
		]
	],
	[
		[
			13146,
			13146
		],
		"mapped",
		[
			50,
			28857
		]
	],
	[
		[
			13147,
			13147
		],
		"mapped",
		[
			51,
			28857
		]
	],
	[
		[
			13148,
			13148
		],
		"mapped",
		[
			52,
			28857
		]
	],
	[
		[
			13149,
			13149
		],
		"mapped",
		[
			53,
			28857
		]
	],
	[
		[
			13150,
			13150
		],
		"mapped",
		[
			54,
			28857
		]
	],
	[
		[
			13151,
			13151
		],
		"mapped",
		[
			55,
			28857
		]
	],
	[
		[
			13152,
			13152
		],
		"mapped",
		[
			56,
			28857
		]
	],
	[
		[
			13153,
			13153
		],
		"mapped",
		[
			57,
			28857
		]
	],
	[
		[
			13154,
			13154
		],
		"mapped",
		[
			49,
			48,
			28857
		]
	],
	[
		[
			13155,
			13155
		],
		"mapped",
		[
			49,
			49,
			28857
		]
	],
	[
		[
			13156,
			13156
		],
		"mapped",
		[
			49,
			50,
			28857
		]
	],
	[
		[
			13157,
			13157
		],
		"mapped",
		[
			49,
			51,
			28857
		]
	],
	[
		[
			13158,
			13158
		],
		"mapped",
		[
			49,
			52,
			28857
		]
	],
	[
		[
			13159,
			13159
		],
		"mapped",
		[
			49,
			53,
			28857
		]
	],
	[
		[
			13160,
			13160
		],
		"mapped",
		[
			49,
			54,
			28857
		]
	],
	[
		[
			13161,
			13161
		],
		"mapped",
		[
			49,
			55,
			28857
		]
	],
	[
		[
			13162,
			13162
		],
		"mapped",
		[
			49,
			56,
			28857
		]
	],
	[
		[
			13163,
			13163
		],
		"mapped",
		[
			49,
			57,
			28857
		]
	],
	[
		[
			13164,
			13164
		],
		"mapped",
		[
			50,
			48,
			28857
		]
	],
	[
		[
			13165,
			13165
		],
		"mapped",
		[
			50,
			49,
			28857
		]
	],
	[
		[
			13166,
			13166
		],
		"mapped",
		[
			50,
			50,
			28857
		]
	],
	[
		[
			13167,
			13167
		],
		"mapped",
		[
			50,
			51,
			28857
		]
	],
	[
		[
			13168,
			13168
		],
		"mapped",
		[
			50,
			52,
			28857
		]
	],
	[
		[
			13169,
			13169
		],
		"mapped",
		[
			104,
			112,
			97
		]
	],
	[
		[
			13170,
			13170
		],
		"mapped",
		[
			100,
			97
		]
	],
	[
		[
			13171,
			13171
		],
		"mapped",
		[
			97,
			117
		]
	],
	[
		[
			13172,
			13172
		],
		"mapped",
		[
			98,
			97,
			114
		]
	],
	[
		[
			13173,
			13173
		],
		"mapped",
		[
			111,
			118
		]
	],
	[
		[
			13174,
			13174
		],
		"mapped",
		[
			112,
			99
		]
	],
	[
		[
			13175,
			13175
		],
		"mapped",
		[
			100,
			109
		]
	],
	[
		[
			13176,
			13176
		],
		"mapped",
		[
			100,
			109,
			50
		]
	],
	[
		[
			13177,
			13177
		],
		"mapped",
		[
			100,
			109,
			51
		]
	],
	[
		[
			13178,
			13178
		],
		"mapped",
		[
			105,
			117
		]
	],
	[
		[
			13179,
			13179
		],
		"mapped",
		[
			24179,
			25104
		]
	],
	[
		[
			13180,
			13180
		],
		"mapped",
		[
			26157,
			21644
		]
	],
	[
		[
			13181,
			13181
		],
		"mapped",
		[
			22823,
			27491
		]
	],
	[
		[
			13182,
			13182
		],
		"mapped",
		[
			26126,
			27835
		]
	],
	[
		[
			13183,
			13183
		],
		"mapped",
		[
			26666,
			24335,
			20250,
			31038
		]
	],
	[
		[
			13184,
			13184
		],
		"mapped",
		[
			112,
			97
		]
	],
	[
		[
			13185,
			13185
		],
		"mapped",
		[
			110,
			97
		]
	],
	[
		[
			13186,
			13186
		],
		"mapped",
		[
			956,
			97
		]
	],
	[
		[
			13187,
			13187
		],
		"mapped",
		[
			109,
			97
		]
	],
	[
		[
			13188,
			13188
		],
		"mapped",
		[
			107,
			97
		]
	],
	[
		[
			13189,
			13189
		],
		"mapped",
		[
			107,
			98
		]
	],
	[
		[
			13190,
			13190
		],
		"mapped",
		[
			109,
			98
		]
	],
	[
		[
			13191,
			13191
		],
		"mapped",
		[
			103,
			98
		]
	],
	[
		[
			13192,
			13192
		],
		"mapped",
		[
			99,
			97,
			108
		]
	],
	[
		[
			13193,
			13193
		],
		"mapped",
		[
			107,
			99,
			97,
			108
		]
	],
	[
		[
			13194,
			13194
		],
		"mapped",
		[
			112,
			102
		]
	],
	[
		[
			13195,
			13195
		],
		"mapped",
		[
			110,
			102
		]
	],
	[
		[
			13196,
			13196
		],
		"mapped",
		[
			956,
			102
		]
	],
	[
		[
			13197,
			13197
		],
		"mapped",
		[
			956,
			103
		]
	],
	[
		[
			13198,
			13198
		],
		"mapped",
		[
			109,
			103
		]
	],
	[
		[
			13199,
			13199
		],
		"mapped",
		[
			107,
			103
		]
	],
	[
		[
			13200,
			13200
		],
		"mapped",
		[
			104,
			122
		]
	],
	[
		[
			13201,
			13201
		],
		"mapped",
		[
			107,
			104,
			122
		]
	],
	[
		[
			13202,
			13202
		],
		"mapped",
		[
			109,
			104,
			122
		]
	],
	[
		[
			13203,
			13203
		],
		"mapped",
		[
			103,
			104,
			122
		]
	],
	[
		[
			13204,
			13204
		],
		"mapped",
		[
			116,
			104,
			122
		]
	],
	[
		[
			13205,
			13205
		],
		"mapped",
		[
			956,
			108
		]
	],
	[
		[
			13206,
			13206
		],
		"mapped",
		[
			109,
			108
		]
	],
	[
		[
			13207,
			13207
		],
		"mapped",
		[
			100,
			108
		]
	],
	[
		[
			13208,
			13208
		],
		"mapped",
		[
			107,
			108
		]
	],
	[
		[
			13209,
			13209
		],
		"mapped",
		[
			102,
			109
		]
	],
	[
		[
			13210,
			13210
		],
		"mapped",
		[
			110,
			109
		]
	],
	[
		[
			13211,
			13211
		],
		"mapped",
		[
			956,
			109
		]
	],
	[
		[
			13212,
			13212
		],
		"mapped",
		[
			109,
			109
		]
	],
	[
		[
			13213,
			13213
		],
		"mapped",
		[
			99,
			109
		]
	],
	[
		[
			13214,
			13214
		],
		"mapped",
		[
			107,
			109
		]
	],
	[
		[
			13215,
			13215
		],
		"mapped",
		[
			109,
			109,
			50
		]
	],
	[
		[
			13216,
			13216
		],
		"mapped",
		[
			99,
			109,
			50
		]
	],
	[
		[
			13217,
			13217
		],
		"mapped",
		[
			109,
			50
		]
	],
	[
		[
			13218,
			13218
		],
		"mapped",
		[
			107,
			109,
			50
		]
	],
	[
		[
			13219,
			13219
		],
		"mapped",
		[
			109,
			109,
			51
		]
	],
	[
		[
			13220,
			13220
		],
		"mapped",
		[
			99,
			109,
			51
		]
	],
	[
		[
			13221,
			13221
		],
		"mapped",
		[
			109,
			51
		]
	],
	[
		[
			13222,
			13222
		],
		"mapped",
		[
			107,
			109,
			51
		]
	],
	[
		[
			13223,
			13223
		],
		"mapped",
		[
			109,
			8725,
			115
		]
	],
	[
		[
			13224,
			13224
		],
		"mapped",
		[
			109,
			8725,
			115,
			50
		]
	],
	[
		[
			13225,
			13225
		],
		"mapped",
		[
			112,
			97
		]
	],
	[
		[
			13226,
			13226
		],
		"mapped",
		[
			107,
			112,
			97
		]
	],
	[
		[
			13227,
			13227
		],
		"mapped",
		[
			109,
			112,
			97
		]
	],
	[
		[
			13228,
			13228
		],
		"mapped",
		[
			103,
			112,
			97
		]
	],
	[
		[
			13229,
			13229
		],
		"mapped",
		[
			114,
			97,
			100
		]
	],
	[
		[
			13230,
			13230
		],
		"mapped",
		[
			114,
			97,
			100,
			8725,
			115
		]
	],
	[
		[
			13231,
			13231
		],
		"mapped",
		[
			114,
			97,
			100,
			8725,
			115,
			50
		]
	],
	[
		[
			13232,
			13232
		],
		"mapped",
		[
			112,
			115
		]
	],
	[
		[
			13233,
			13233
		],
		"mapped",
		[
			110,
			115
		]
	],
	[
		[
			13234,
			13234
		],
		"mapped",
		[
			956,
			115
		]
	],
	[
		[
			13235,
			13235
		],
		"mapped",
		[
			109,
			115
		]
	],
	[
		[
			13236,
			13236
		],
		"mapped",
		[
			112,
			118
		]
	],
	[
		[
			13237,
			13237
		],
		"mapped",
		[
			110,
			118
		]
	],
	[
		[
			13238,
			13238
		],
		"mapped",
		[
			956,
			118
		]
	],
	[
		[
			13239,
			13239
		],
		"mapped",
		[
			109,
			118
		]
	],
	[
		[
			13240,
			13240
		],
		"mapped",
		[
			107,
			118
		]
	],
	[
		[
			13241,
			13241
		],
		"mapped",
		[
			109,
			118
		]
	],
	[
		[
			13242,
			13242
		],
		"mapped",
		[
			112,
			119
		]
	],
	[
		[
			13243,
			13243
		],
		"mapped",
		[
			110,
			119
		]
	],
	[
		[
			13244,
			13244
		],
		"mapped",
		[
			956,
			119
		]
	],
	[
		[
			13245,
			13245
		],
		"mapped",
		[
			109,
			119
		]
	],
	[
		[
			13246,
			13246
		],
		"mapped",
		[
			107,
			119
		]
	],
	[
		[
			13247,
			13247
		],
		"mapped",
		[
			109,
			119
		]
	],
	[
		[
			13248,
			13248
		],
		"mapped",
		[
			107,
			969
		]
	],
	[
		[
			13249,
			13249
		],
		"mapped",
		[
			109,
			969
		]
	],
	[
		[
			13250,
			13250
		],
		"disallowed"
	],
	[
		[
			13251,
			13251
		],
		"mapped",
		[
			98,
			113
		]
	],
	[
		[
			13252,
			13252
		],
		"mapped",
		[
			99,
			99
		]
	],
	[
		[
			13253,
			13253
		],
		"mapped",
		[
			99,
			100
		]
	],
	[
		[
			13254,
			13254
		],
		"mapped",
		[
			99,
			8725,
			107,
			103
		]
	],
	[
		[
			13255,
			13255
		],
		"disallowed"
	],
	[
		[
			13256,
			13256
		],
		"mapped",
		[
			100,
			98
		]
	],
	[
		[
			13257,
			13257
		],
		"mapped",
		[
			103,
			121
		]
	],
	[
		[
			13258,
			13258
		],
		"mapped",
		[
			104,
			97
		]
	],
	[
		[
			13259,
			13259
		],
		"mapped",
		[
			104,
			112
		]
	],
	[
		[
			13260,
			13260
		],
		"mapped",
		[
			105,
			110
		]
	],
	[
		[
			13261,
			13261
		],
		"mapped",
		[
			107,
			107
		]
	],
	[
		[
			13262,
			13262
		],
		"mapped",
		[
			107,
			109
		]
	],
	[
		[
			13263,
			13263
		],
		"mapped",
		[
			107,
			116
		]
	],
	[
		[
			13264,
			13264
		],
		"mapped",
		[
			108,
			109
		]
	],
	[
		[
			13265,
			13265
		],
		"mapped",
		[
			108,
			110
		]
	],
	[
		[
			13266,
			13266
		],
		"mapped",
		[
			108,
			111,
			103
		]
	],
	[
		[
			13267,
			13267
		],
		"mapped",
		[
			108,
			120
		]
	],
	[
		[
			13268,
			13268
		],
		"mapped",
		[
			109,
			98
		]
	],
	[
		[
			13269,
			13269
		],
		"mapped",
		[
			109,
			105,
			108
		]
	],
	[
		[
			13270,
			13270
		],
		"mapped",
		[
			109,
			111,
			108
		]
	],
	[
		[
			13271,
			13271
		],
		"mapped",
		[
			112,
			104
		]
	],
	[
		[
			13272,
			13272
		],
		"disallowed"
	],
	[
		[
			13273,
			13273
		],
		"mapped",
		[
			112,
			112,
			109
		]
	],
	[
		[
			13274,
			13274
		],
		"mapped",
		[
			112,
			114
		]
	],
	[
		[
			13275,
			13275
		],
		"mapped",
		[
			115,
			114
		]
	],
	[
		[
			13276,
			13276
		],
		"mapped",
		[
			115,
			118
		]
	],
	[
		[
			13277,
			13277
		],
		"mapped",
		[
			119,
			98
		]
	],
	[
		[
			13278,
			13278
		],
		"mapped",
		[
			118,
			8725,
			109
		]
	],
	[
		[
			13279,
			13279
		],
		"mapped",
		[
			97,
			8725,
			109
		]
	],
	[
		[
			13280,
			13280
		],
		"mapped",
		[
			49,
			26085
		]
	],
	[
		[
			13281,
			13281
		],
		"mapped",
		[
			50,
			26085
		]
	],
	[
		[
			13282,
			13282
		],
		"mapped",
		[
			51,
			26085
		]
	],
	[
		[
			13283,
			13283
		],
		"mapped",
		[
			52,
			26085
		]
	],
	[
		[
			13284,
			13284
		],
		"mapped",
		[
			53,
			26085
		]
	],
	[
		[
			13285,
			13285
		],
		"mapped",
		[
			54,
			26085
		]
	],
	[
		[
			13286,
			13286
		],
		"mapped",
		[
			55,
			26085
		]
	],
	[
		[
			13287,
			13287
		],
		"mapped",
		[
			56,
			26085
		]
	],
	[
		[
			13288,
			13288
		],
		"mapped",
		[
			57,
			26085
		]
	],
	[
		[
			13289,
			13289
		],
		"mapped",
		[
			49,
			48,
			26085
		]
	],
	[
		[
			13290,
			13290
		],
		"mapped",
		[
			49,
			49,
			26085
		]
	],
	[
		[
			13291,
			13291
		],
		"mapped",
		[
			49,
			50,
			26085
		]
	],
	[
		[
			13292,
			13292
		],
		"mapped",
		[
			49,
			51,
			26085
		]
	],
	[
		[
			13293,
			13293
		],
		"mapped",
		[
			49,
			52,
			26085
		]
	],
	[
		[
			13294,
			13294
		],
		"mapped",
		[
			49,
			53,
			26085
		]
	],
	[
		[
			13295,
			13295
		],
		"mapped",
		[
			49,
			54,
			26085
		]
	],
	[
		[
			13296,
			13296
		],
		"mapped",
		[
			49,
			55,
			26085
		]
	],
	[
		[
			13297,
			13297
		],
		"mapped",
		[
			49,
			56,
			26085
		]
	],
	[
		[
			13298,
			13298
		],
		"mapped",
		[
			49,
			57,
			26085
		]
	],
	[
		[
			13299,
			13299
		],
		"mapped",
		[
			50,
			48,
			26085
		]
	],
	[
		[
			13300,
			13300
		],
		"mapped",
		[
			50,
			49,
			26085
		]
	],
	[
		[
			13301,
			13301
		],
		"mapped",
		[
			50,
			50,
			26085
		]
	],
	[
		[
			13302,
			13302
		],
		"mapped",
		[
			50,
			51,
			26085
		]
	],
	[
		[
			13303,
			13303
		],
		"mapped",
		[
			50,
			52,
			26085
		]
	],
	[
		[
			13304,
			13304
		],
		"mapped",
		[
			50,
			53,
			26085
		]
	],
	[
		[
			13305,
			13305
		],
		"mapped",
		[
			50,
			54,
			26085
		]
	],
	[
		[
			13306,
			13306
		],
		"mapped",
		[
			50,
			55,
			26085
		]
	],
	[
		[
			13307,
			13307
		],
		"mapped",
		[
			50,
			56,
			26085
		]
	],
	[
		[
			13308,
			13308
		],
		"mapped",
		[
			50,
			57,
			26085
		]
	],
	[
		[
			13309,
			13309
		],
		"mapped",
		[
			51,
			48,
			26085
		]
	],
	[
		[
			13310,
			13310
		],
		"mapped",
		[
			51,
			49,
			26085
		]
	],
	[
		[
			13311,
			13311
		],
		"mapped",
		[
			103,
			97,
			108
		]
	],
	[
		[
			13312,
			19893
		],
		"valid"
	],
	[
		[
			19894,
			19903
		],
		"disallowed"
	],
	[
		[
			19904,
			19967
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			19968,
			40869
		],
		"valid"
	],
	[
		[
			40870,
			40891
		],
		"valid"
	],
	[
		[
			40892,
			40899
		],
		"valid"
	],
	[
		[
			40900,
			40907
		],
		"valid"
	],
	[
		[
			40908,
			40908
		],
		"valid"
	],
	[
		[
			40909,
			40917
		],
		"valid"
	],
	[
		[
			40918,
			40959
		],
		"disallowed"
	],
	[
		[
			40960,
			42124
		],
		"valid"
	],
	[
		[
			42125,
			42127
		],
		"disallowed"
	],
	[
		[
			42128,
			42145
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42146,
			42147
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42148,
			42163
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42164,
			42164
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42165,
			42176
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42177,
			42177
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42178,
			42180
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42181,
			42181
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42182,
			42182
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42183,
			42191
		],
		"disallowed"
	],
	[
		[
			42192,
			42237
		],
		"valid"
	],
	[
		[
			42238,
			42239
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42240,
			42508
		],
		"valid"
	],
	[
		[
			42509,
			42511
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42512,
			42539
		],
		"valid"
	],
	[
		[
			42540,
			42559
		],
		"disallowed"
	],
	[
		[
			42560,
			42560
		],
		"mapped",
		[
			42561
		]
	],
	[
		[
			42561,
			42561
		],
		"valid"
	],
	[
		[
			42562,
			42562
		],
		"mapped",
		[
			42563
		]
	],
	[
		[
			42563,
			42563
		],
		"valid"
	],
	[
		[
			42564,
			42564
		],
		"mapped",
		[
			42565
		]
	],
	[
		[
			42565,
			42565
		],
		"valid"
	],
	[
		[
			42566,
			42566
		],
		"mapped",
		[
			42567
		]
	],
	[
		[
			42567,
			42567
		],
		"valid"
	],
	[
		[
			42568,
			42568
		],
		"mapped",
		[
			42569
		]
	],
	[
		[
			42569,
			42569
		],
		"valid"
	],
	[
		[
			42570,
			42570
		],
		"mapped",
		[
			42571
		]
	],
	[
		[
			42571,
			42571
		],
		"valid"
	],
	[
		[
			42572,
			42572
		],
		"mapped",
		[
			42573
		]
	],
	[
		[
			42573,
			42573
		],
		"valid"
	],
	[
		[
			42574,
			42574
		],
		"mapped",
		[
			42575
		]
	],
	[
		[
			42575,
			42575
		],
		"valid"
	],
	[
		[
			42576,
			42576
		],
		"mapped",
		[
			42577
		]
	],
	[
		[
			42577,
			42577
		],
		"valid"
	],
	[
		[
			42578,
			42578
		],
		"mapped",
		[
			42579
		]
	],
	[
		[
			42579,
			42579
		],
		"valid"
	],
	[
		[
			42580,
			42580
		],
		"mapped",
		[
			42581
		]
	],
	[
		[
			42581,
			42581
		],
		"valid"
	],
	[
		[
			42582,
			42582
		],
		"mapped",
		[
			42583
		]
	],
	[
		[
			42583,
			42583
		],
		"valid"
	],
	[
		[
			42584,
			42584
		],
		"mapped",
		[
			42585
		]
	],
	[
		[
			42585,
			42585
		],
		"valid"
	],
	[
		[
			42586,
			42586
		],
		"mapped",
		[
			42587
		]
	],
	[
		[
			42587,
			42587
		],
		"valid"
	],
	[
		[
			42588,
			42588
		],
		"mapped",
		[
			42589
		]
	],
	[
		[
			42589,
			42589
		],
		"valid"
	],
	[
		[
			42590,
			42590
		],
		"mapped",
		[
			42591
		]
	],
	[
		[
			42591,
			42591
		],
		"valid"
	],
	[
		[
			42592,
			42592
		],
		"mapped",
		[
			42593
		]
	],
	[
		[
			42593,
			42593
		],
		"valid"
	],
	[
		[
			42594,
			42594
		],
		"mapped",
		[
			42595
		]
	],
	[
		[
			42595,
			42595
		],
		"valid"
	],
	[
		[
			42596,
			42596
		],
		"mapped",
		[
			42597
		]
	],
	[
		[
			42597,
			42597
		],
		"valid"
	],
	[
		[
			42598,
			42598
		],
		"mapped",
		[
			42599
		]
	],
	[
		[
			42599,
			42599
		],
		"valid"
	],
	[
		[
			42600,
			42600
		],
		"mapped",
		[
			42601
		]
	],
	[
		[
			42601,
			42601
		],
		"valid"
	],
	[
		[
			42602,
			42602
		],
		"mapped",
		[
			42603
		]
	],
	[
		[
			42603,
			42603
		],
		"valid"
	],
	[
		[
			42604,
			42604
		],
		"mapped",
		[
			42605
		]
	],
	[
		[
			42605,
			42607
		],
		"valid"
	],
	[
		[
			42608,
			42611
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42612,
			42619
		],
		"valid"
	],
	[
		[
			42620,
			42621
		],
		"valid"
	],
	[
		[
			42622,
			42622
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42623,
			42623
		],
		"valid"
	],
	[
		[
			42624,
			42624
		],
		"mapped",
		[
			42625
		]
	],
	[
		[
			42625,
			42625
		],
		"valid"
	],
	[
		[
			42626,
			42626
		],
		"mapped",
		[
			42627
		]
	],
	[
		[
			42627,
			42627
		],
		"valid"
	],
	[
		[
			42628,
			42628
		],
		"mapped",
		[
			42629
		]
	],
	[
		[
			42629,
			42629
		],
		"valid"
	],
	[
		[
			42630,
			42630
		],
		"mapped",
		[
			42631
		]
	],
	[
		[
			42631,
			42631
		],
		"valid"
	],
	[
		[
			42632,
			42632
		],
		"mapped",
		[
			42633
		]
	],
	[
		[
			42633,
			42633
		],
		"valid"
	],
	[
		[
			42634,
			42634
		],
		"mapped",
		[
			42635
		]
	],
	[
		[
			42635,
			42635
		],
		"valid"
	],
	[
		[
			42636,
			42636
		],
		"mapped",
		[
			42637
		]
	],
	[
		[
			42637,
			42637
		],
		"valid"
	],
	[
		[
			42638,
			42638
		],
		"mapped",
		[
			42639
		]
	],
	[
		[
			42639,
			42639
		],
		"valid"
	],
	[
		[
			42640,
			42640
		],
		"mapped",
		[
			42641
		]
	],
	[
		[
			42641,
			42641
		],
		"valid"
	],
	[
		[
			42642,
			42642
		],
		"mapped",
		[
			42643
		]
	],
	[
		[
			42643,
			42643
		],
		"valid"
	],
	[
		[
			42644,
			42644
		],
		"mapped",
		[
			42645
		]
	],
	[
		[
			42645,
			42645
		],
		"valid"
	],
	[
		[
			42646,
			42646
		],
		"mapped",
		[
			42647
		]
	],
	[
		[
			42647,
			42647
		],
		"valid"
	],
	[
		[
			42648,
			42648
		],
		"mapped",
		[
			42649
		]
	],
	[
		[
			42649,
			42649
		],
		"valid"
	],
	[
		[
			42650,
			42650
		],
		"mapped",
		[
			42651
		]
	],
	[
		[
			42651,
			42651
		],
		"valid"
	],
	[
		[
			42652,
			42652
		],
		"mapped",
		[
			1098
		]
	],
	[
		[
			42653,
			42653
		],
		"mapped",
		[
			1100
		]
	],
	[
		[
			42654,
			42654
		],
		"valid"
	],
	[
		[
			42655,
			42655
		],
		"valid"
	],
	[
		[
			42656,
			42725
		],
		"valid"
	],
	[
		[
			42726,
			42735
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42736,
			42737
		],
		"valid"
	],
	[
		[
			42738,
			42743
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42744,
			42751
		],
		"disallowed"
	],
	[
		[
			42752,
			42774
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42775,
			42778
		],
		"valid"
	],
	[
		[
			42779,
			42783
		],
		"valid"
	],
	[
		[
			42784,
			42785
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42786,
			42786
		],
		"mapped",
		[
			42787
		]
	],
	[
		[
			42787,
			42787
		],
		"valid"
	],
	[
		[
			42788,
			42788
		],
		"mapped",
		[
			42789
		]
	],
	[
		[
			42789,
			42789
		],
		"valid"
	],
	[
		[
			42790,
			42790
		],
		"mapped",
		[
			42791
		]
	],
	[
		[
			42791,
			42791
		],
		"valid"
	],
	[
		[
			42792,
			42792
		],
		"mapped",
		[
			42793
		]
	],
	[
		[
			42793,
			42793
		],
		"valid"
	],
	[
		[
			42794,
			42794
		],
		"mapped",
		[
			42795
		]
	],
	[
		[
			42795,
			42795
		],
		"valid"
	],
	[
		[
			42796,
			42796
		],
		"mapped",
		[
			42797
		]
	],
	[
		[
			42797,
			42797
		],
		"valid"
	],
	[
		[
			42798,
			42798
		],
		"mapped",
		[
			42799
		]
	],
	[
		[
			42799,
			42801
		],
		"valid"
	],
	[
		[
			42802,
			42802
		],
		"mapped",
		[
			42803
		]
	],
	[
		[
			42803,
			42803
		],
		"valid"
	],
	[
		[
			42804,
			42804
		],
		"mapped",
		[
			42805
		]
	],
	[
		[
			42805,
			42805
		],
		"valid"
	],
	[
		[
			42806,
			42806
		],
		"mapped",
		[
			42807
		]
	],
	[
		[
			42807,
			42807
		],
		"valid"
	],
	[
		[
			42808,
			42808
		],
		"mapped",
		[
			42809
		]
	],
	[
		[
			42809,
			42809
		],
		"valid"
	],
	[
		[
			42810,
			42810
		],
		"mapped",
		[
			42811
		]
	],
	[
		[
			42811,
			42811
		],
		"valid"
	],
	[
		[
			42812,
			42812
		],
		"mapped",
		[
			42813
		]
	],
	[
		[
			42813,
			42813
		],
		"valid"
	],
	[
		[
			42814,
			42814
		],
		"mapped",
		[
			42815
		]
	],
	[
		[
			42815,
			42815
		],
		"valid"
	],
	[
		[
			42816,
			42816
		],
		"mapped",
		[
			42817
		]
	],
	[
		[
			42817,
			42817
		],
		"valid"
	],
	[
		[
			42818,
			42818
		],
		"mapped",
		[
			42819
		]
	],
	[
		[
			42819,
			42819
		],
		"valid"
	],
	[
		[
			42820,
			42820
		],
		"mapped",
		[
			42821
		]
	],
	[
		[
			42821,
			42821
		],
		"valid"
	],
	[
		[
			42822,
			42822
		],
		"mapped",
		[
			42823
		]
	],
	[
		[
			42823,
			42823
		],
		"valid"
	],
	[
		[
			42824,
			42824
		],
		"mapped",
		[
			42825
		]
	],
	[
		[
			42825,
			42825
		],
		"valid"
	],
	[
		[
			42826,
			42826
		],
		"mapped",
		[
			42827
		]
	],
	[
		[
			42827,
			42827
		],
		"valid"
	],
	[
		[
			42828,
			42828
		],
		"mapped",
		[
			42829
		]
	],
	[
		[
			42829,
			42829
		],
		"valid"
	],
	[
		[
			42830,
			42830
		],
		"mapped",
		[
			42831
		]
	],
	[
		[
			42831,
			42831
		],
		"valid"
	],
	[
		[
			42832,
			42832
		],
		"mapped",
		[
			42833
		]
	],
	[
		[
			42833,
			42833
		],
		"valid"
	],
	[
		[
			42834,
			42834
		],
		"mapped",
		[
			42835
		]
	],
	[
		[
			42835,
			42835
		],
		"valid"
	],
	[
		[
			42836,
			42836
		],
		"mapped",
		[
			42837
		]
	],
	[
		[
			42837,
			42837
		],
		"valid"
	],
	[
		[
			42838,
			42838
		],
		"mapped",
		[
			42839
		]
	],
	[
		[
			42839,
			42839
		],
		"valid"
	],
	[
		[
			42840,
			42840
		],
		"mapped",
		[
			42841
		]
	],
	[
		[
			42841,
			42841
		],
		"valid"
	],
	[
		[
			42842,
			42842
		],
		"mapped",
		[
			42843
		]
	],
	[
		[
			42843,
			42843
		],
		"valid"
	],
	[
		[
			42844,
			42844
		],
		"mapped",
		[
			42845
		]
	],
	[
		[
			42845,
			42845
		],
		"valid"
	],
	[
		[
			42846,
			42846
		],
		"mapped",
		[
			42847
		]
	],
	[
		[
			42847,
			42847
		],
		"valid"
	],
	[
		[
			42848,
			42848
		],
		"mapped",
		[
			42849
		]
	],
	[
		[
			42849,
			42849
		],
		"valid"
	],
	[
		[
			42850,
			42850
		],
		"mapped",
		[
			42851
		]
	],
	[
		[
			42851,
			42851
		],
		"valid"
	],
	[
		[
			42852,
			42852
		],
		"mapped",
		[
			42853
		]
	],
	[
		[
			42853,
			42853
		],
		"valid"
	],
	[
		[
			42854,
			42854
		],
		"mapped",
		[
			42855
		]
	],
	[
		[
			42855,
			42855
		],
		"valid"
	],
	[
		[
			42856,
			42856
		],
		"mapped",
		[
			42857
		]
	],
	[
		[
			42857,
			42857
		],
		"valid"
	],
	[
		[
			42858,
			42858
		],
		"mapped",
		[
			42859
		]
	],
	[
		[
			42859,
			42859
		],
		"valid"
	],
	[
		[
			42860,
			42860
		],
		"mapped",
		[
			42861
		]
	],
	[
		[
			42861,
			42861
		],
		"valid"
	],
	[
		[
			42862,
			42862
		],
		"mapped",
		[
			42863
		]
	],
	[
		[
			42863,
			42863
		],
		"valid"
	],
	[
		[
			42864,
			42864
		],
		"mapped",
		[
			42863
		]
	],
	[
		[
			42865,
			42872
		],
		"valid"
	],
	[
		[
			42873,
			42873
		],
		"mapped",
		[
			42874
		]
	],
	[
		[
			42874,
			42874
		],
		"valid"
	],
	[
		[
			42875,
			42875
		],
		"mapped",
		[
			42876
		]
	],
	[
		[
			42876,
			42876
		],
		"valid"
	],
	[
		[
			42877,
			42877
		],
		"mapped",
		[
			7545
		]
	],
	[
		[
			42878,
			42878
		],
		"mapped",
		[
			42879
		]
	],
	[
		[
			42879,
			42879
		],
		"valid"
	],
	[
		[
			42880,
			42880
		],
		"mapped",
		[
			42881
		]
	],
	[
		[
			42881,
			42881
		],
		"valid"
	],
	[
		[
			42882,
			42882
		],
		"mapped",
		[
			42883
		]
	],
	[
		[
			42883,
			42883
		],
		"valid"
	],
	[
		[
			42884,
			42884
		],
		"mapped",
		[
			42885
		]
	],
	[
		[
			42885,
			42885
		],
		"valid"
	],
	[
		[
			42886,
			42886
		],
		"mapped",
		[
			42887
		]
	],
	[
		[
			42887,
			42888
		],
		"valid"
	],
	[
		[
			42889,
			42890
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			42891,
			42891
		],
		"mapped",
		[
			42892
		]
	],
	[
		[
			42892,
			42892
		],
		"valid"
	],
	[
		[
			42893,
			42893
		],
		"mapped",
		[
			613
		]
	],
	[
		[
			42894,
			42894
		],
		"valid"
	],
	[
		[
			42895,
			42895
		],
		"valid"
	],
	[
		[
			42896,
			42896
		],
		"mapped",
		[
			42897
		]
	],
	[
		[
			42897,
			42897
		],
		"valid"
	],
	[
		[
			42898,
			42898
		],
		"mapped",
		[
			42899
		]
	],
	[
		[
			42899,
			42899
		],
		"valid"
	],
	[
		[
			42900,
			42901
		],
		"valid"
	],
	[
		[
			42902,
			42902
		],
		"mapped",
		[
			42903
		]
	],
	[
		[
			42903,
			42903
		],
		"valid"
	],
	[
		[
			42904,
			42904
		],
		"mapped",
		[
			42905
		]
	],
	[
		[
			42905,
			42905
		],
		"valid"
	],
	[
		[
			42906,
			42906
		],
		"mapped",
		[
			42907
		]
	],
	[
		[
			42907,
			42907
		],
		"valid"
	],
	[
		[
			42908,
			42908
		],
		"mapped",
		[
			42909
		]
	],
	[
		[
			42909,
			42909
		],
		"valid"
	],
	[
		[
			42910,
			42910
		],
		"mapped",
		[
			42911
		]
	],
	[
		[
			42911,
			42911
		],
		"valid"
	],
	[
		[
			42912,
			42912
		],
		"mapped",
		[
			42913
		]
	],
	[
		[
			42913,
			42913
		],
		"valid"
	],
	[
		[
			42914,
			42914
		],
		"mapped",
		[
			42915
		]
	],
	[
		[
			42915,
			42915
		],
		"valid"
	],
	[
		[
			42916,
			42916
		],
		"mapped",
		[
			42917
		]
	],
	[
		[
			42917,
			42917
		],
		"valid"
	],
	[
		[
			42918,
			42918
		],
		"mapped",
		[
			42919
		]
	],
	[
		[
			42919,
			42919
		],
		"valid"
	],
	[
		[
			42920,
			42920
		],
		"mapped",
		[
			42921
		]
	],
	[
		[
			42921,
			42921
		],
		"valid"
	],
	[
		[
			42922,
			42922
		],
		"mapped",
		[
			614
		]
	],
	[
		[
			42923,
			42923
		],
		"mapped",
		[
			604
		]
	],
	[
		[
			42924,
			42924
		],
		"mapped",
		[
			609
		]
	],
	[
		[
			42925,
			42925
		],
		"mapped",
		[
			620
		]
	],
	[
		[
			42926,
			42927
		],
		"disallowed"
	],
	[
		[
			42928,
			42928
		],
		"mapped",
		[
			670
		]
	],
	[
		[
			42929,
			42929
		],
		"mapped",
		[
			647
		]
	],
	[
		[
			42930,
			42930
		],
		"mapped",
		[
			669
		]
	],
	[
		[
			42931,
			42931
		],
		"mapped",
		[
			43859
		]
	],
	[
		[
			42932,
			42932
		],
		"mapped",
		[
			42933
		]
	],
	[
		[
			42933,
			42933
		],
		"valid"
	],
	[
		[
			42934,
			42934
		],
		"mapped",
		[
			42935
		]
	],
	[
		[
			42935,
			42935
		],
		"valid"
	],
	[
		[
			42936,
			42998
		],
		"disallowed"
	],
	[
		[
			42999,
			42999
		],
		"valid"
	],
	[
		[
			43000,
			43000
		],
		"mapped",
		[
			295
		]
	],
	[
		[
			43001,
			43001
		],
		"mapped",
		[
			339
		]
	],
	[
		[
			43002,
			43002
		],
		"valid"
	],
	[
		[
			43003,
			43007
		],
		"valid"
	],
	[
		[
			43008,
			43047
		],
		"valid"
	],
	[
		[
			43048,
			43051
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43052,
			43055
		],
		"disallowed"
	],
	[
		[
			43056,
			43065
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43066,
			43071
		],
		"disallowed"
	],
	[
		[
			43072,
			43123
		],
		"valid"
	],
	[
		[
			43124,
			43127
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43128,
			43135
		],
		"disallowed"
	],
	[
		[
			43136,
			43204
		],
		"valid"
	],
	[
		[
			43205,
			43213
		],
		"disallowed"
	],
	[
		[
			43214,
			43215
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43216,
			43225
		],
		"valid"
	],
	[
		[
			43226,
			43231
		],
		"disallowed"
	],
	[
		[
			43232,
			43255
		],
		"valid"
	],
	[
		[
			43256,
			43258
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43259,
			43259
		],
		"valid"
	],
	[
		[
			43260,
			43260
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43261,
			43261
		],
		"valid"
	],
	[
		[
			43262,
			43263
		],
		"disallowed"
	],
	[
		[
			43264,
			43309
		],
		"valid"
	],
	[
		[
			43310,
			43311
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43312,
			43347
		],
		"valid"
	],
	[
		[
			43348,
			43358
		],
		"disallowed"
	],
	[
		[
			43359,
			43359
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43360,
			43388
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43389,
			43391
		],
		"disallowed"
	],
	[
		[
			43392,
			43456
		],
		"valid"
	],
	[
		[
			43457,
			43469
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43470,
			43470
		],
		"disallowed"
	],
	[
		[
			43471,
			43481
		],
		"valid"
	],
	[
		[
			43482,
			43485
		],
		"disallowed"
	],
	[
		[
			43486,
			43487
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43488,
			43518
		],
		"valid"
	],
	[
		[
			43519,
			43519
		],
		"disallowed"
	],
	[
		[
			43520,
			43574
		],
		"valid"
	],
	[
		[
			43575,
			43583
		],
		"disallowed"
	],
	[
		[
			43584,
			43597
		],
		"valid"
	],
	[
		[
			43598,
			43599
		],
		"disallowed"
	],
	[
		[
			43600,
			43609
		],
		"valid"
	],
	[
		[
			43610,
			43611
		],
		"disallowed"
	],
	[
		[
			43612,
			43615
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43616,
			43638
		],
		"valid"
	],
	[
		[
			43639,
			43641
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43642,
			43643
		],
		"valid"
	],
	[
		[
			43644,
			43647
		],
		"valid"
	],
	[
		[
			43648,
			43714
		],
		"valid"
	],
	[
		[
			43715,
			43738
		],
		"disallowed"
	],
	[
		[
			43739,
			43741
		],
		"valid"
	],
	[
		[
			43742,
			43743
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43744,
			43759
		],
		"valid"
	],
	[
		[
			43760,
			43761
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43762,
			43766
		],
		"valid"
	],
	[
		[
			43767,
			43776
		],
		"disallowed"
	],
	[
		[
			43777,
			43782
		],
		"valid"
	],
	[
		[
			43783,
			43784
		],
		"disallowed"
	],
	[
		[
			43785,
			43790
		],
		"valid"
	],
	[
		[
			43791,
			43792
		],
		"disallowed"
	],
	[
		[
			43793,
			43798
		],
		"valid"
	],
	[
		[
			43799,
			43807
		],
		"disallowed"
	],
	[
		[
			43808,
			43814
		],
		"valid"
	],
	[
		[
			43815,
			43815
		],
		"disallowed"
	],
	[
		[
			43816,
			43822
		],
		"valid"
	],
	[
		[
			43823,
			43823
		],
		"disallowed"
	],
	[
		[
			43824,
			43866
		],
		"valid"
	],
	[
		[
			43867,
			43867
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			43868,
			43868
		],
		"mapped",
		[
			42791
		]
	],
	[
		[
			43869,
			43869
		],
		"mapped",
		[
			43831
		]
	],
	[
		[
			43870,
			43870
		],
		"mapped",
		[
			619
		]
	],
	[
		[
			43871,
			43871
		],
		"mapped",
		[
			43858
		]
	],
	[
		[
			43872,
			43875
		],
		"valid"
	],
	[
		[
			43876,
			43877
		],
		"valid"
	],
	[
		[
			43878,
			43887
		],
		"disallowed"
	],
	[
		[
			43888,
			43888
		],
		"mapped",
		[
			5024
		]
	],
	[
		[
			43889,
			43889
		],
		"mapped",
		[
			5025
		]
	],
	[
		[
			43890,
			43890
		],
		"mapped",
		[
			5026
		]
	],
	[
		[
			43891,
			43891
		],
		"mapped",
		[
			5027
		]
	],
	[
		[
			43892,
			43892
		],
		"mapped",
		[
			5028
		]
	],
	[
		[
			43893,
			43893
		],
		"mapped",
		[
			5029
		]
	],
	[
		[
			43894,
			43894
		],
		"mapped",
		[
			5030
		]
	],
	[
		[
			43895,
			43895
		],
		"mapped",
		[
			5031
		]
	],
	[
		[
			43896,
			43896
		],
		"mapped",
		[
			5032
		]
	],
	[
		[
			43897,
			43897
		],
		"mapped",
		[
			5033
		]
	],
	[
		[
			43898,
			43898
		],
		"mapped",
		[
			5034
		]
	],
	[
		[
			43899,
			43899
		],
		"mapped",
		[
			5035
		]
	],
	[
		[
			43900,
			43900
		],
		"mapped",
		[
			5036
		]
	],
	[
		[
			43901,
			43901
		],
		"mapped",
		[
			5037
		]
	],
	[
		[
			43902,
			43902
		],
		"mapped",
		[
			5038
		]
	],
	[
		[
			43903,
			43903
		],
		"mapped",
		[
			5039
		]
	],
	[
		[
			43904,
			43904
		],
		"mapped",
		[
			5040
		]
	],
	[
		[
			43905,
			43905
		],
		"mapped",
		[
			5041
		]
	],
	[
		[
			43906,
			43906
		],
		"mapped",
		[
			5042
		]
	],
	[
		[
			43907,
			43907
		],
		"mapped",
		[
			5043
		]
	],
	[
		[
			43908,
			43908
		],
		"mapped",
		[
			5044
		]
	],
	[
		[
			43909,
			43909
		],
		"mapped",
		[
			5045
		]
	],
	[
		[
			43910,
			43910
		],
		"mapped",
		[
			5046
		]
	],
	[
		[
			43911,
			43911
		],
		"mapped",
		[
			5047
		]
	],
	[
		[
			43912,
			43912
		],
		"mapped",
		[
			5048
		]
	],
	[
		[
			43913,
			43913
		],
		"mapped",
		[
			5049
		]
	],
	[
		[
			43914,
			43914
		],
		"mapped",
		[
			5050
		]
	],
	[
		[
			43915,
			43915
		],
		"mapped",
		[
			5051
		]
	],
	[
		[
			43916,
			43916
		],
		"mapped",
		[
			5052
		]
	],
	[
		[
			43917,
			43917
		],
		"mapped",
		[
			5053
		]
	],
	[
		[
			43918,
			43918
		],
		"mapped",
		[
			5054
		]
	],
	[
		[
			43919,
			43919
		],
		"mapped",
		[
			5055
		]
	],
	[
		[
			43920,
			43920
		],
		"mapped",
		[
			5056
		]
	],
	[
		[
			43921,
			43921
		],
		"mapped",
		[
			5057
		]
	],
	[
		[
			43922,
			43922
		],
		"mapped",
		[
			5058
		]
	],
	[
		[
			43923,
			43923
		],
		"mapped",
		[
			5059
		]
	],
	[
		[
			43924,
			43924
		],
		"mapped",
		[
			5060
		]
	],
	[
		[
			43925,
			43925
		],
		"mapped",
		[
			5061
		]
	],
	[
		[
			43926,
			43926
		],
		"mapped",
		[
			5062
		]
	],
	[
		[
			43927,
			43927
		],
		"mapped",
		[
			5063
		]
	],
	[
		[
			43928,
			43928
		],
		"mapped",
		[
			5064
		]
	],
	[
		[
			43929,
			43929
		],
		"mapped",
		[
			5065
		]
	],
	[
		[
			43930,
			43930
		],
		"mapped",
		[
			5066
		]
	],
	[
		[
			43931,
			43931
		],
		"mapped",
		[
			5067
		]
	],
	[
		[
			43932,
			43932
		],
		"mapped",
		[
			5068
		]
	],
	[
		[
			43933,
			43933
		],
		"mapped",
		[
			5069
		]
	],
	[
		[
			43934,
			43934
		],
		"mapped",
		[
			5070
		]
	],
	[
		[
			43935,
			43935
		],
		"mapped",
		[
			5071
		]
	],
	[
		[
			43936,
			43936
		],
		"mapped",
		[
			5072
		]
	],
	[
		[
			43937,
			43937
		],
		"mapped",
		[
			5073
		]
	],
	[
		[
			43938,
			43938
		],
		"mapped",
		[
			5074
		]
	],
	[
		[
			43939,
			43939
		],
		"mapped",
		[
			5075
		]
	],
	[
		[
			43940,
			43940
		],
		"mapped",
		[
			5076
		]
	],
	[
		[
			43941,
			43941
		],
		"mapped",
		[
			5077
		]
	],
	[
		[
			43942,
			43942
		],
		"mapped",
		[
			5078
		]
	],
	[
		[
			43943,
			43943
		],
		"mapped",
		[
			5079
		]
	],
	[
		[
			43944,
			43944
		],
		"mapped",
		[
			5080
		]
	],
	[
		[
			43945,
			43945
		],
		"mapped",
		[
			5081
		]
	],
	[
		[
			43946,
			43946
		],
		"mapped",
		[
			5082
		]
	],
	[
		[
			43947,
			43947
		],
		"mapped",
		[
			5083
		]
	],
	[
		[
			43948,
			43948
		],
		"mapped",
		[
			5084
		]
	],
	[
		[
			43949,
			43949
		],
		"mapped",
		[
			5085
		]
	],
	[
		[
			43950,
			43950
		],
		"mapped",
		[
			5086
		]
	],
	[
		[
			43951,
			43951
		],
		"mapped",
		[
			5087
		]
	],
	[
		[
			43952,
			43952
		],
		"mapped",
		[
			5088
		]
	],
	[
		[
			43953,
			43953
		],
		"mapped",
		[
			5089
		]
	],
	[
		[
			43954,
			43954
		],
		"mapped",
		[
			5090
		]
	],
	[
		[
			43955,
			43955
		],
		"mapped",
		[
			5091
		]
	],
	[
		[
			43956,
			43956
		],
		"mapped",
		[
			5092
		]
	],
	[
		[
			43957,
			43957
		],
		"mapped",
		[
			5093
		]
	],
	[
		[
			43958,
			43958
		],
		"mapped",
		[
			5094
		]
	],
	[
		[
			43959,
			43959
		],
		"mapped",
		[
			5095
		]
	],
	[
		[
			43960,
			43960
		],
		"mapped",
		[
			5096
		]
	],
	[
		[
			43961,
			43961
		],
		"mapped",
		[
			5097
		]
	],
	[
		[
			43962,
			43962
		],
		"mapped",
		[
			5098
		]
	],
	[
		[
			43963,
			43963
		],
		"mapped",
		[
			5099
		]
	],
	[
		[
			43964,
			43964
		],
		"mapped",
		[
			5100
		]
	],
	[
		[
			43965,
			43965
		],
		"mapped",
		[
			5101
		]
	],
	[
		[
			43966,
			43966
		],
		"mapped",
		[
			5102
		]
	],
	[
		[
			43967,
			43967
		],
		"mapped",
		[
			5103
		]
	],
	[
		[
			43968,
			44010
		],
		"valid"
	],
	[
		[
			44011,
			44011
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			44012,
			44013
		],
		"valid"
	],
	[
		[
			44014,
			44015
		],
		"disallowed"
	],
	[
		[
			44016,
			44025
		],
		"valid"
	],
	[
		[
			44026,
			44031
		],
		"disallowed"
	],
	[
		[
			44032,
			55203
		],
		"valid"
	],
	[
		[
			55204,
			55215
		],
		"disallowed"
	],
	[
		[
			55216,
			55238
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			55239,
			55242
		],
		"disallowed"
	],
	[
		[
			55243,
			55291
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			55292,
			55295
		],
		"disallowed"
	],
	[
		[
			55296,
			57343
		],
		"disallowed"
	],
	[
		[
			57344,
			63743
		],
		"disallowed"
	],
	[
		[
			63744,
			63744
		],
		"mapped",
		[
			35912
		]
	],
	[
		[
			63745,
			63745
		],
		"mapped",
		[
			26356
		]
	],
	[
		[
			63746,
			63746
		],
		"mapped",
		[
			36554
		]
	],
	[
		[
			63747,
			63747
		],
		"mapped",
		[
			36040
		]
	],
	[
		[
			63748,
			63748
		],
		"mapped",
		[
			28369
		]
	],
	[
		[
			63749,
			63749
		],
		"mapped",
		[
			20018
		]
	],
	[
		[
			63750,
			63750
		],
		"mapped",
		[
			21477
		]
	],
	[
		[
			63751,
			63752
		],
		"mapped",
		[
			40860
		]
	],
	[
		[
			63753,
			63753
		],
		"mapped",
		[
			22865
		]
	],
	[
		[
			63754,
			63754
		],
		"mapped",
		[
			37329
		]
	],
	[
		[
			63755,
			63755
		],
		"mapped",
		[
			21895
		]
	],
	[
		[
			63756,
			63756
		],
		"mapped",
		[
			22856
		]
	],
	[
		[
			63757,
			63757
		],
		"mapped",
		[
			25078
		]
	],
	[
		[
			63758,
			63758
		],
		"mapped",
		[
			30313
		]
	],
	[
		[
			63759,
			63759
		],
		"mapped",
		[
			32645
		]
	],
	[
		[
			63760,
			63760
		],
		"mapped",
		[
			34367
		]
	],
	[
		[
			63761,
			63761
		],
		"mapped",
		[
			34746
		]
	],
	[
		[
			63762,
			63762
		],
		"mapped",
		[
			35064
		]
	],
	[
		[
			63763,
			63763
		],
		"mapped",
		[
			37007
		]
	],
	[
		[
			63764,
			63764
		],
		"mapped",
		[
			27138
		]
	],
	[
		[
			63765,
			63765
		],
		"mapped",
		[
			27931
		]
	],
	[
		[
			63766,
			63766
		],
		"mapped",
		[
			28889
		]
	],
	[
		[
			63767,
			63767
		],
		"mapped",
		[
			29662
		]
	],
	[
		[
			63768,
			63768
		],
		"mapped",
		[
			33853
		]
	],
	[
		[
			63769,
			63769
		],
		"mapped",
		[
			37226
		]
	],
	[
		[
			63770,
			63770
		],
		"mapped",
		[
			39409
		]
	],
	[
		[
			63771,
			63771
		],
		"mapped",
		[
			20098
		]
	],
	[
		[
			63772,
			63772
		],
		"mapped",
		[
			21365
		]
	],
	[
		[
			63773,
			63773
		],
		"mapped",
		[
			27396
		]
	],
	[
		[
			63774,
			63774
		],
		"mapped",
		[
			29211
		]
	],
	[
		[
			63775,
			63775
		],
		"mapped",
		[
			34349
		]
	],
	[
		[
			63776,
			63776
		],
		"mapped",
		[
			40478
		]
	],
	[
		[
			63777,
			63777
		],
		"mapped",
		[
			23888
		]
	],
	[
		[
			63778,
			63778
		],
		"mapped",
		[
			28651
		]
	],
	[
		[
			63779,
			63779
		],
		"mapped",
		[
			34253
		]
	],
	[
		[
			63780,
			63780
		],
		"mapped",
		[
			35172
		]
	],
	[
		[
			63781,
			63781
		],
		"mapped",
		[
			25289
		]
	],
	[
		[
			63782,
			63782
		],
		"mapped",
		[
			33240
		]
	],
	[
		[
			63783,
			63783
		],
		"mapped",
		[
			34847
		]
	],
	[
		[
			63784,
			63784
		],
		"mapped",
		[
			24266
		]
	],
	[
		[
			63785,
			63785
		],
		"mapped",
		[
			26391
		]
	],
	[
		[
			63786,
			63786
		],
		"mapped",
		[
			28010
		]
	],
	[
		[
			63787,
			63787
		],
		"mapped",
		[
			29436
		]
	],
	[
		[
			63788,
			63788
		],
		"mapped",
		[
			37070
		]
	],
	[
		[
			63789,
			63789
		],
		"mapped",
		[
			20358
		]
	],
	[
		[
			63790,
			63790
		],
		"mapped",
		[
			20919
		]
	],
	[
		[
			63791,
			63791
		],
		"mapped",
		[
			21214
		]
	],
	[
		[
			63792,
			63792
		],
		"mapped",
		[
			25796
		]
	],
	[
		[
			63793,
			63793
		],
		"mapped",
		[
			27347
		]
	],
	[
		[
			63794,
			63794
		],
		"mapped",
		[
			29200
		]
	],
	[
		[
			63795,
			63795
		],
		"mapped",
		[
			30439
		]
	],
	[
		[
			63796,
			63796
		],
		"mapped",
		[
			32769
		]
	],
	[
		[
			63797,
			63797
		],
		"mapped",
		[
			34310
		]
	],
	[
		[
			63798,
			63798
		],
		"mapped",
		[
			34396
		]
	],
	[
		[
			63799,
			63799
		],
		"mapped",
		[
			36335
		]
	],
	[
		[
			63800,
			63800
		],
		"mapped",
		[
			38706
		]
	],
	[
		[
			63801,
			63801
		],
		"mapped",
		[
			39791
		]
	],
	[
		[
			63802,
			63802
		],
		"mapped",
		[
			40442
		]
	],
	[
		[
			63803,
			63803
		],
		"mapped",
		[
			30860
		]
	],
	[
		[
			63804,
			63804
		],
		"mapped",
		[
			31103
		]
	],
	[
		[
			63805,
			63805
		],
		"mapped",
		[
			32160
		]
	],
	[
		[
			63806,
			63806
		],
		"mapped",
		[
			33737
		]
	],
	[
		[
			63807,
			63807
		],
		"mapped",
		[
			37636
		]
	],
	[
		[
			63808,
			63808
		],
		"mapped",
		[
			40575
		]
	],
	[
		[
			63809,
			63809
		],
		"mapped",
		[
			35542
		]
	],
	[
		[
			63810,
			63810
		],
		"mapped",
		[
			22751
		]
	],
	[
		[
			63811,
			63811
		],
		"mapped",
		[
			24324
		]
	],
	[
		[
			63812,
			63812
		],
		"mapped",
		[
			31840
		]
	],
	[
		[
			63813,
			63813
		],
		"mapped",
		[
			32894
		]
	],
	[
		[
			63814,
			63814
		],
		"mapped",
		[
			29282
		]
	],
	[
		[
			63815,
			63815
		],
		"mapped",
		[
			30922
		]
	],
	[
		[
			63816,
			63816
		],
		"mapped",
		[
			36034
		]
	],
	[
		[
			63817,
			63817
		],
		"mapped",
		[
			38647
		]
	],
	[
		[
			63818,
			63818
		],
		"mapped",
		[
			22744
		]
	],
	[
		[
			63819,
			63819
		],
		"mapped",
		[
			23650
		]
	],
	[
		[
			63820,
			63820
		],
		"mapped",
		[
			27155
		]
	],
	[
		[
			63821,
			63821
		],
		"mapped",
		[
			28122
		]
	],
	[
		[
			63822,
			63822
		],
		"mapped",
		[
			28431
		]
	],
	[
		[
			63823,
			63823
		],
		"mapped",
		[
			32047
		]
	],
	[
		[
			63824,
			63824
		],
		"mapped",
		[
			32311
		]
	],
	[
		[
			63825,
			63825
		],
		"mapped",
		[
			38475
		]
	],
	[
		[
			63826,
			63826
		],
		"mapped",
		[
			21202
		]
	],
	[
		[
			63827,
			63827
		],
		"mapped",
		[
			32907
		]
	],
	[
		[
			63828,
			63828
		],
		"mapped",
		[
			20956
		]
	],
	[
		[
			63829,
			63829
		],
		"mapped",
		[
			20940
		]
	],
	[
		[
			63830,
			63830
		],
		"mapped",
		[
			31260
		]
	],
	[
		[
			63831,
			63831
		],
		"mapped",
		[
			32190
		]
	],
	[
		[
			63832,
			63832
		],
		"mapped",
		[
			33777
		]
	],
	[
		[
			63833,
			63833
		],
		"mapped",
		[
			38517
		]
	],
	[
		[
			63834,
			63834
		],
		"mapped",
		[
			35712
		]
	],
	[
		[
			63835,
			63835
		],
		"mapped",
		[
			25295
		]
	],
	[
		[
			63836,
			63836
		],
		"mapped",
		[
			27138
		]
	],
	[
		[
			63837,
			63837
		],
		"mapped",
		[
			35582
		]
	],
	[
		[
			63838,
			63838
		],
		"mapped",
		[
			20025
		]
	],
	[
		[
			63839,
			63839
		],
		"mapped",
		[
			23527
		]
	],
	[
		[
			63840,
			63840
		],
		"mapped",
		[
			24594
		]
	],
	[
		[
			63841,
			63841
		],
		"mapped",
		[
			29575
		]
	],
	[
		[
			63842,
			63842
		],
		"mapped",
		[
			30064
		]
	],
	[
		[
			63843,
			63843
		],
		"mapped",
		[
			21271
		]
	],
	[
		[
			63844,
			63844
		],
		"mapped",
		[
			30971
		]
	],
	[
		[
			63845,
			63845
		],
		"mapped",
		[
			20415
		]
	],
	[
		[
			63846,
			63846
		],
		"mapped",
		[
			24489
		]
	],
	[
		[
			63847,
			63847
		],
		"mapped",
		[
			19981
		]
	],
	[
		[
			63848,
			63848
		],
		"mapped",
		[
			27852
		]
	],
	[
		[
			63849,
			63849
		],
		"mapped",
		[
			25976
		]
	],
	[
		[
			63850,
			63850
		],
		"mapped",
		[
			32034
		]
	],
	[
		[
			63851,
			63851
		],
		"mapped",
		[
			21443
		]
	],
	[
		[
			63852,
			63852
		],
		"mapped",
		[
			22622
		]
	],
	[
		[
			63853,
			63853
		],
		"mapped",
		[
			30465
		]
	],
	[
		[
			63854,
			63854
		],
		"mapped",
		[
			33865
		]
	],
	[
		[
			63855,
			63855
		],
		"mapped",
		[
			35498
		]
	],
	[
		[
			63856,
			63856
		],
		"mapped",
		[
			27578
		]
	],
	[
		[
			63857,
			63857
		],
		"mapped",
		[
			36784
		]
	],
	[
		[
			63858,
			63858
		],
		"mapped",
		[
			27784
		]
	],
	[
		[
			63859,
			63859
		],
		"mapped",
		[
			25342
		]
	],
	[
		[
			63860,
			63860
		],
		"mapped",
		[
			33509
		]
	],
	[
		[
			63861,
			63861
		],
		"mapped",
		[
			25504
		]
	],
	[
		[
			63862,
			63862
		],
		"mapped",
		[
			30053
		]
	],
	[
		[
			63863,
			63863
		],
		"mapped",
		[
			20142
		]
	],
	[
		[
			63864,
			63864
		],
		"mapped",
		[
			20841
		]
	],
	[
		[
			63865,
			63865
		],
		"mapped",
		[
			20937
		]
	],
	[
		[
			63866,
			63866
		],
		"mapped",
		[
			26753
		]
	],
	[
		[
			63867,
			63867
		],
		"mapped",
		[
			31975
		]
	],
	[
		[
			63868,
			63868
		],
		"mapped",
		[
			33391
		]
	],
	[
		[
			63869,
			63869
		],
		"mapped",
		[
			35538
		]
	],
	[
		[
			63870,
			63870
		],
		"mapped",
		[
			37327
		]
	],
	[
		[
			63871,
			63871
		],
		"mapped",
		[
			21237
		]
	],
	[
		[
			63872,
			63872
		],
		"mapped",
		[
			21570
		]
	],
	[
		[
			63873,
			63873
		],
		"mapped",
		[
			22899
		]
	],
	[
		[
			63874,
			63874
		],
		"mapped",
		[
			24300
		]
	],
	[
		[
			63875,
			63875
		],
		"mapped",
		[
			26053
		]
	],
	[
		[
			63876,
			63876
		],
		"mapped",
		[
			28670
		]
	],
	[
		[
			63877,
			63877
		],
		"mapped",
		[
			31018
		]
	],
	[
		[
			63878,
			63878
		],
		"mapped",
		[
			38317
		]
	],
	[
		[
			63879,
			63879
		],
		"mapped",
		[
			39530
		]
	],
	[
		[
			63880,
			63880
		],
		"mapped",
		[
			40599
		]
	],
	[
		[
			63881,
			63881
		],
		"mapped",
		[
			40654
		]
	],
	[
		[
			63882,
			63882
		],
		"mapped",
		[
			21147
		]
	],
	[
		[
			63883,
			63883
		],
		"mapped",
		[
			26310
		]
	],
	[
		[
			63884,
			63884
		],
		"mapped",
		[
			27511
		]
	],
	[
		[
			63885,
			63885
		],
		"mapped",
		[
			36706
		]
	],
	[
		[
			63886,
			63886
		],
		"mapped",
		[
			24180
		]
	],
	[
		[
			63887,
			63887
		],
		"mapped",
		[
			24976
		]
	],
	[
		[
			63888,
			63888
		],
		"mapped",
		[
			25088
		]
	],
	[
		[
			63889,
			63889
		],
		"mapped",
		[
			25754
		]
	],
	[
		[
			63890,
			63890
		],
		"mapped",
		[
			28451
		]
	],
	[
		[
			63891,
			63891
		],
		"mapped",
		[
			29001
		]
	],
	[
		[
			63892,
			63892
		],
		"mapped",
		[
			29833
		]
	],
	[
		[
			63893,
			63893
		],
		"mapped",
		[
			31178
		]
	],
	[
		[
			63894,
			63894
		],
		"mapped",
		[
			32244
		]
	],
	[
		[
			63895,
			63895
		],
		"mapped",
		[
			32879
		]
	],
	[
		[
			63896,
			63896
		],
		"mapped",
		[
			36646
		]
	],
	[
		[
			63897,
			63897
		],
		"mapped",
		[
			34030
		]
	],
	[
		[
			63898,
			63898
		],
		"mapped",
		[
			36899
		]
	],
	[
		[
			63899,
			63899
		],
		"mapped",
		[
			37706
		]
	],
	[
		[
			63900,
			63900
		],
		"mapped",
		[
			21015
		]
	],
	[
		[
			63901,
			63901
		],
		"mapped",
		[
			21155
		]
	],
	[
		[
			63902,
			63902
		],
		"mapped",
		[
			21693
		]
	],
	[
		[
			63903,
			63903
		],
		"mapped",
		[
			28872
		]
	],
	[
		[
			63904,
			63904
		],
		"mapped",
		[
			35010
		]
	],
	[
		[
			63905,
			63905
		],
		"mapped",
		[
			35498
		]
	],
	[
		[
			63906,
			63906
		],
		"mapped",
		[
			24265
		]
	],
	[
		[
			63907,
			63907
		],
		"mapped",
		[
			24565
		]
	],
	[
		[
			63908,
			63908
		],
		"mapped",
		[
			25467
		]
	],
	[
		[
			63909,
			63909
		],
		"mapped",
		[
			27566
		]
	],
	[
		[
			63910,
			63910
		],
		"mapped",
		[
			31806
		]
	],
	[
		[
			63911,
			63911
		],
		"mapped",
		[
			29557
		]
	],
	[
		[
			63912,
			63912
		],
		"mapped",
		[
			20196
		]
	],
	[
		[
			63913,
			63913
		],
		"mapped",
		[
			22265
		]
	],
	[
		[
			63914,
			63914
		],
		"mapped",
		[
			23527
		]
	],
	[
		[
			63915,
			63915
		],
		"mapped",
		[
			23994
		]
	],
	[
		[
			63916,
			63916
		],
		"mapped",
		[
			24604
		]
	],
	[
		[
			63917,
			63917
		],
		"mapped",
		[
			29618
		]
	],
	[
		[
			63918,
			63918
		],
		"mapped",
		[
			29801
		]
	],
	[
		[
			63919,
			63919
		],
		"mapped",
		[
			32666
		]
	],
	[
		[
			63920,
			63920
		],
		"mapped",
		[
			32838
		]
	],
	[
		[
			63921,
			63921
		],
		"mapped",
		[
			37428
		]
	],
	[
		[
			63922,
			63922
		],
		"mapped",
		[
			38646
		]
	],
	[
		[
			63923,
			63923
		],
		"mapped",
		[
			38728
		]
	],
	[
		[
			63924,
			63924
		],
		"mapped",
		[
			38936
		]
	],
	[
		[
			63925,
			63925
		],
		"mapped",
		[
			20363
		]
	],
	[
		[
			63926,
			63926
		],
		"mapped",
		[
			31150
		]
	],
	[
		[
			63927,
			63927
		],
		"mapped",
		[
			37300
		]
	],
	[
		[
			63928,
			63928
		],
		"mapped",
		[
			38584
		]
	],
	[
		[
			63929,
			63929
		],
		"mapped",
		[
			24801
		]
	],
	[
		[
			63930,
			63930
		],
		"mapped",
		[
			20102
		]
	],
	[
		[
			63931,
			63931
		],
		"mapped",
		[
			20698
		]
	],
	[
		[
			63932,
			63932
		],
		"mapped",
		[
			23534
		]
	],
	[
		[
			63933,
			63933
		],
		"mapped",
		[
			23615
		]
	],
	[
		[
			63934,
			63934
		],
		"mapped",
		[
			26009
		]
	],
	[
		[
			63935,
			63935
		],
		"mapped",
		[
			27138
		]
	],
	[
		[
			63936,
			63936
		],
		"mapped",
		[
			29134
		]
	],
	[
		[
			63937,
			63937
		],
		"mapped",
		[
			30274
		]
	],
	[
		[
			63938,
			63938
		],
		"mapped",
		[
			34044
		]
	],
	[
		[
			63939,
			63939
		],
		"mapped",
		[
			36988
		]
	],
	[
		[
			63940,
			63940
		],
		"mapped",
		[
			40845
		]
	],
	[
		[
			63941,
			63941
		],
		"mapped",
		[
			26248
		]
	],
	[
		[
			63942,
			63942
		],
		"mapped",
		[
			38446
		]
	],
	[
		[
			63943,
			63943
		],
		"mapped",
		[
			21129
		]
	],
	[
		[
			63944,
			63944
		],
		"mapped",
		[
			26491
		]
	],
	[
		[
			63945,
			63945
		],
		"mapped",
		[
			26611
		]
	],
	[
		[
			63946,
			63946
		],
		"mapped",
		[
			27969
		]
	],
	[
		[
			63947,
			63947
		],
		"mapped",
		[
			28316
		]
	],
	[
		[
			63948,
			63948
		],
		"mapped",
		[
			29705
		]
	],
	[
		[
			63949,
			63949
		],
		"mapped",
		[
			30041
		]
	],
	[
		[
			63950,
			63950
		],
		"mapped",
		[
			30827
		]
	],
	[
		[
			63951,
			63951
		],
		"mapped",
		[
			32016
		]
	],
	[
		[
			63952,
			63952
		],
		"mapped",
		[
			39006
		]
	],
	[
		[
			63953,
			63953
		],
		"mapped",
		[
			20845
		]
	],
	[
		[
			63954,
			63954
		],
		"mapped",
		[
			25134
		]
	],
	[
		[
			63955,
			63955
		],
		"mapped",
		[
			38520
		]
	],
	[
		[
			63956,
			63956
		],
		"mapped",
		[
			20523
		]
	],
	[
		[
			63957,
			63957
		],
		"mapped",
		[
			23833
		]
	],
	[
		[
			63958,
			63958
		],
		"mapped",
		[
			28138
		]
	],
	[
		[
			63959,
			63959
		],
		"mapped",
		[
			36650
		]
	],
	[
		[
			63960,
			63960
		],
		"mapped",
		[
			24459
		]
	],
	[
		[
			63961,
			63961
		],
		"mapped",
		[
			24900
		]
	],
	[
		[
			63962,
			63962
		],
		"mapped",
		[
			26647
		]
	],
	[
		[
			63963,
			63963
		],
		"mapped",
		[
			29575
		]
	],
	[
		[
			63964,
			63964
		],
		"mapped",
		[
			38534
		]
	],
	[
		[
			63965,
			63965
		],
		"mapped",
		[
			21033
		]
	],
	[
		[
			63966,
			63966
		],
		"mapped",
		[
			21519
		]
	],
	[
		[
			63967,
			63967
		],
		"mapped",
		[
			23653
		]
	],
	[
		[
			63968,
			63968
		],
		"mapped",
		[
			26131
		]
	],
	[
		[
			63969,
			63969
		],
		"mapped",
		[
			26446
		]
	],
	[
		[
			63970,
			63970
		],
		"mapped",
		[
			26792
		]
	],
	[
		[
			63971,
			63971
		],
		"mapped",
		[
			27877
		]
	],
	[
		[
			63972,
			63972
		],
		"mapped",
		[
			29702
		]
	],
	[
		[
			63973,
			63973
		],
		"mapped",
		[
			30178
		]
	],
	[
		[
			63974,
			63974
		],
		"mapped",
		[
			32633
		]
	],
	[
		[
			63975,
			63975
		],
		"mapped",
		[
			35023
		]
	],
	[
		[
			63976,
			63976
		],
		"mapped",
		[
			35041
		]
	],
	[
		[
			63977,
			63977
		],
		"mapped",
		[
			37324
		]
	],
	[
		[
			63978,
			63978
		],
		"mapped",
		[
			38626
		]
	],
	[
		[
			63979,
			63979
		],
		"mapped",
		[
			21311
		]
	],
	[
		[
			63980,
			63980
		],
		"mapped",
		[
			28346
		]
	],
	[
		[
			63981,
			63981
		],
		"mapped",
		[
			21533
		]
	],
	[
		[
			63982,
			63982
		],
		"mapped",
		[
			29136
		]
	],
	[
		[
			63983,
			63983
		],
		"mapped",
		[
			29848
		]
	],
	[
		[
			63984,
			63984
		],
		"mapped",
		[
			34298
		]
	],
	[
		[
			63985,
			63985
		],
		"mapped",
		[
			38563
		]
	],
	[
		[
			63986,
			63986
		],
		"mapped",
		[
			40023
		]
	],
	[
		[
			63987,
			63987
		],
		"mapped",
		[
			40607
		]
	],
	[
		[
			63988,
			63988
		],
		"mapped",
		[
			26519
		]
	],
	[
		[
			63989,
			63989
		],
		"mapped",
		[
			28107
		]
	],
	[
		[
			63990,
			63990
		],
		"mapped",
		[
			33256
		]
	],
	[
		[
			63991,
			63991
		],
		"mapped",
		[
			31435
		]
	],
	[
		[
			63992,
			63992
		],
		"mapped",
		[
			31520
		]
	],
	[
		[
			63993,
			63993
		],
		"mapped",
		[
			31890
		]
	],
	[
		[
			63994,
			63994
		],
		"mapped",
		[
			29376
		]
	],
	[
		[
			63995,
			63995
		],
		"mapped",
		[
			28825
		]
	],
	[
		[
			63996,
			63996
		],
		"mapped",
		[
			35672
		]
	],
	[
		[
			63997,
			63997
		],
		"mapped",
		[
			20160
		]
	],
	[
		[
			63998,
			63998
		],
		"mapped",
		[
			33590
		]
	],
	[
		[
			63999,
			63999
		],
		"mapped",
		[
			21050
		]
	],
	[
		[
			64000,
			64000
		],
		"mapped",
		[
			20999
		]
	],
	[
		[
			64001,
			64001
		],
		"mapped",
		[
			24230
		]
	],
	[
		[
			64002,
			64002
		],
		"mapped",
		[
			25299
		]
	],
	[
		[
			64003,
			64003
		],
		"mapped",
		[
			31958
		]
	],
	[
		[
			64004,
			64004
		],
		"mapped",
		[
			23429
		]
	],
	[
		[
			64005,
			64005
		],
		"mapped",
		[
			27934
		]
	],
	[
		[
			64006,
			64006
		],
		"mapped",
		[
			26292
		]
	],
	[
		[
			64007,
			64007
		],
		"mapped",
		[
			36667
		]
	],
	[
		[
			64008,
			64008
		],
		"mapped",
		[
			34892
		]
	],
	[
		[
			64009,
			64009
		],
		"mapped",
		[
			38477
		]
	],
	[
		[
			64010,
			64010
		],
		"mapped",
		[
			35211
		]
	],
	[
		[
			64011,
			64011
		],
		"mapped",
		[
			24275
		]
	],
	[
		[
			64012,
			64012
		],
		"mapped",
		[
			20800
		]
	],
	[
		[
			64013,
			64013
		],
		"mapped",
		[
			21952
		]
	],
	[
		[
			64014,
			64015
		],
		"valid"
	],
	[
		[
			64016,
			64016
		],
		"mapped",
		[
			22618
		]
	],
	[
		[
			64017,
			64017
		],
		"valid"
	],
	[
		[
			64018,
			64018
		],
		"mapped",
		[
			26228
		]
	],
	[
		[
			64019,
			64020
		],
		"valid"
	],
	[
		[
			64021,
			64021
		],
		"mapped",
		[
			20958
		]
	],
	[
		[
			64022,
			64022
		],
		"mapped",
		[
			29482
		]
	],
	[
		[
			64023,
			64023
		],
		"mapped",
		[
			30410
		]
	],
	[
		[
			64024,
			64024
		],
		"mapped",
		[
			31036
		]
	],
	[
		[
			64025,
			64025
		],
		"mapped",
		[
			31070
		]
	],
	[
		[
			64026,
			64026
		],
		"mapped",
		[
			31077
		]
	],
	[
		[
			64027,
			64027
		],
		"mapped",
		[
			31119
		]
	],
	[
		[
			64028,
			64028
		],
		"mapped",
		[
			38742
		]
	],
	[
		[
			64029,
			64029
		],
		"mapped",
		[
			31934
		]
	],
	[
		[
			64030,
			64030
		],
		"mapped",
		[
			32701
		]
	],
	[
		[
			64031,
			64031
		],
		"valid"
	],
	[
		[
			64032,
			64032
		],
		"mapped",
		[
			34322
		]
	],
	[
		[
			64033,
			64033
		],
		"valid"
	],
	[
		[
			64034,
			64034
		],
		"mapped",
		[
			35576
		]
	],
	[
		[
			64035,
			64036
		],
		"valid"
	],
	[
		[
			64037,
			64037
		],
		"mapped",
		[
			36920
		]
	],
	[
		[
			64038,
			64038
		],
		"mapped",
		[
			37117
		]
	],
	[
		[
			64039,
			64041
		],
		"valid"
	],
	[
		[
			64042,
			64042
		],
		"mapped",
		[
			39151
		]
	],
	[
		[
			64043,
			64043
		],
		"mapped",
		[
			39164
		]
	],
	[
		[
			64044,
			64044
		],
		"mapped",
		[
			39208
		]
	],
	[
		[
			64045,
			64045
		],
		"mapped",
		[
			40372
		]
	],
	[
		[
			64046,
			64046
		],
		"mapped",
		[
			37086
		]
	],
	[
		[
			64047,
			64047
		],
		"mapped",
		[
			38583
		]
	],
	[
		[
			64048,
			64048
		],
		"mapped",
		[
			20398
		]
	],
	[
		[
			64049,
			64049
		],
		"mapped",
		[
			20711
		]
	],
	[
		[
			64050,
			64050
		],
		"mapped",
		[
			20813
		]
	],
	[
		[
			64051,
			64051
		],
		"mapped",
		[
			21193
		]
	],
	[
		[
			64052,
			64052
		],
		"mapped",
		[
			21220
		]
	],
	[
		[
			64053,
			64053
		],
		"mapped",
		[
			21329
		]
	],
	[
		[
			64054,
			64054
		],
		"mapped",
		[
			21917
		]
	],
	[
		[
			64055,
			64055
		],
		"mapped",
		[
			22022
		]
	],
	[
		[
			64056,
			64056
		],
		"mapped",
		[
			22120
		]
	],
	[
		[
			64057,
			64057
		],
		"mapped",
		[
			22592
		]
	],
	[
		[
			64058,
			64058
		],
		"mapped",
		[
			22696
		]
	],
	[
		[
			64059,
			64059
		],
		"mapped",
		[
			23652
		]
	],
	[
		[
			64060,
			64060
		],
		"mapped",
		[
			23662
		]
	],
	[
		[
			64061,
			64061
		],
		"mapped",
		[
			24724
		]
	],
	[
		[
			64062,
			64062
		],
		"mapped",
		[
			24936
		]
	],
	[
		[
			64063,
			64063
		],
		"mapped",
		[
			24974
		]
	],
	[
		[
			64064,
			64064
		],
		"mapped",
		[
			25074
		]
	],
	[
		[
			64065,
			64065
		],
		"mapped",
		[
			25935
		]
	],
	[
		[
			64066,
			64066
		],
		"mapped",
		[
			26082
		]
	],
	[
		[
			64067,
			64067
		],
		"mapped",
		[
			26257
		]
	],
	[
		[
			64068,
			64068
		],
		"mapped",
		[
			26757
		]
	],
	[
		[
			64069,
			64069
		],
		"mapped",
		[
			28023
		]
	],
	[
		[
			64070,
			64070
		],
		"mapped",
		[
			28186
		]
	],
	[
		[
			64071,
			64071
		],
		"mapped",
		[
			28450
		]
	],
	[
		[
			64072,
			64072
		],
		"mapped",
		[
			29038
		]
	],
	[
		[
			64073,
			64073
		],
		"mapped",
		[
			29227
		]
	],
	[
		[
			64074,
			64074
		],
		"mapped",
		[
			29730
		]
	],
	[
		[
			64075,
			64075
		],
		"mapped",
		[
			30865
		]
	],
	[
		[
			64076,
			64076
		],
		"mapped",
		[
			31038
		]
	],
	[
		[
			64077,
			64077
		],
		"mapped",
		[
			31049
		]
	],
	[
		[
			64078,
			64078
		],
		"mapped",
		[
			31048
		]
	],
	[
		[
			64079,
			64079
		],
		"mapped",
		[
			31056
		]
	],
	[
		[
			64080,
			64080
		],
		"mapped",
		[
			31062
		]
	],
	[
		[
			64081,
			64081
		],
		"mapped",
		[
			31069
		]
	],
	[
		[
			64082,
			64082
		],
		"mapped",
		[
			31117
		]
	],
	[
		[
			64083,
			64083
		],
		"mapped",
		[
			31118
		]
	],
	[
		[
			64084,
			64084
		],
		"mapped",
		[
			31296
		]
	],
	[
		[
			64085,
			64085
		],
		"mapped",
		[
			31361
		]
	],
	[
		[
			64086,
			64086
		],
		"mapped",
		[
			31680
		]
	],
	[
		[
			64087,
			64087
		],
		"mapped",
		[
			32244
		]
	],
	[
		[
			64088,
			64088
		],
		"mapped",
		[
			32265
		]
	],
	[
		[
			64089,
			64089
		],
		"mapped",
		[
			32321
		]
	],
	[
		[
			64090,
			64090
		],
		"mapped",
		[
			32626
		]
	],
	[
		[
			64091,
			64091
		],
		"mapped",
		[
			32773
		]
	],
	[
		[
			64092,
			64092
		],
		"mapped",
		[
			33261
		]
	],
	[
		[
			64093,
			64094
		],
		"mapped",
		[
			33401
		]
	],
	[
		[
			64095,
			64095
		],
		"mapped",
		[
			33879
		]
	],
	[
		[
			64096,
			64096
		],
		"mapped",
		[
			35088
		]
	],
	[
		[
			64097,
			64097
		],
		"mapped",
		[
			35222
		]
	],
	[
		[
			64098,
			64098
		],
		"mapped",
		[
			35585
		]
	],
	[
		[
			64099,
			64099
		],
		"mapped",
		[
			35641
		]
	],
	[
		[
			64100,
			64100
		],
		"mapped",
		[
			36051
		]
	],
	[
		[
			64101,
			64101
		],
		"mapped",
		[
			36104
		]
	],
	[
		[
			64102,
			64102
		],
		"mapped",
		[
			36790
		]
	],
	[
		[
			64103,
			64103
		],
		"mapped",
		[
			36920
		]
	],
	[
		[
			64104,
			64104
		],
		"mapped",
		[
			38627
		]
	],
	[
		[
			64105,
			64105
		],
		"mapped",
		[
			38911
		]
	],
	[
		[
			64106,
			64106
		],
		"mapped",
		[
			38971
		]
	],
	[
		[
			64107,
			64107
		],
		"mapped",
		[
			24693
		]
	],
	[
		[
			64108,
			64108
		],
		"mapped",
		[
			148206
		]
	],
	[
		[
			64109,
			64109
		],
		"mapped",
		[
			33304
		]
	],
	[
		[
			64110,
			64111
		],
		"disallowed"
	],
	[
		[
			64112,
			64112
		],
		"mapped",
		[
			20006
		]
	],
	[
		[
			64113,
			64113
		],
		"mapped",
		[
			20917
		]
	],
	[
		[
			64114,
			64114
		],
		"mapped",
		[
			20840
		]
	],
	[
		[
			64115,
			64115
		],
		"mapped",
		[
			20352
		]
	],
	[
		[
			64116,
			64116
		],
		"mapped",
		[
			20805
		]
	],
	[
		[
			64117,
			64117
		],
		"mapped",
		[
			20864
		]
	],
	[
		[
			64118,
			64118
		],
		"mapped",
		[
			21191
		]
	],
	[
		[
			64119,
			64119
		],
		"mapped",
		[
			21242
		]
	],
	[
		[
			64120,
			64120
		],
		"mapped",
		[
			21917
		]
	],
	[
		[
			64121,
			64121
		],
		"mapped",
		[
			21845
		]
	],
	[
		[
			64122,
			64122
		],
		"mapped",
		[
			21913
		]
	],
	[
		[
			64123,
			64123
		],
		"mapped",
		[
			21986
		]
	],
	[
		[
			64124,
			64124
		],
		"mapped",
		[
			22618
		]
	],
	[
		[
			64125,
			64125
		],
		"mapped",
		[
			22707
		]
	],
	[
		[
			64126,
			64126
		],
		"mapped",
		[
			22852
		]
	],
	[
		[
			64127,
			64127
		],
		"mapped",
		[
			22868
		]
	],
	[
		[
			64128,
			64128
		],
		"mapped",
		[
			23138
		]
	],
	[
		[
			64129,
			64129
		],
		"mapped",
		[
			23336
		]
	],
	[
		[
			64130,
			64130
		],
		"mapped",
		[
			24274
		]
	],
	[
		[
			64131,
			64131
		],
		"mapped",
		[
			24281
		]
	],
	[
		[
			64132,
			64132
		],
		"mapped",
		[
			24425
		]
	],
	[
		[
			64133,
			64133
		],
		"mapped",
		[
			24493
		]
	],
	[
		[
			64134,
			64134
		],
		"mapped",
		[
			24792
		]
	],
	[
		[
			64135,
			64135
		],
		"mapped",
		[
			24910
		]
	],
	[
		[
			64136,
			64136
		],
		"mapped",
		[
			24840
		]
	],
	[
		[
			64137,
			64137
		],
		"mapped",
		[
			24974
		]
	],
	[
		[
			64138,
			64138
		],
		"mapped",
		[
			24928
		]
	],
	[
		[
			64139,
			64139
		],
		"mapped",
		[
			25074
		]
	],
	[
		[
			64140,
			64140
		],
		"mapped",
		[
			25140
		]
	],
	[
		[
			64141,
			64141
		],
		"mapped",
		[
			25540
		]
	],
	[
		[
			64142,
			64142
		],
		"mapped",
		[
			25628
		]
	],
	[
		[
			64143,
			64143
		],
		"mapped",
		[
			25682
		]
	],
	[
		[
			64144,
			64144
		],
		"mapped",
		[
			25942
		]
	],
	[
		[
			64145,
			64145
		],
		"mapped",
		[
			26228
		]
	],
	[
		[
			64146,
			64146
		],
		"mapped",
		[
			26391
		]
	],
	[
		[
			64147,
			64147
		],
		"mapped",
		[
			26395
		]
	],
	[
		[
			64148,
			64148
		],
		"mapped",
		[
			26454
		]
	],
	[
		[
			64149,
			64149
		],
		"mapped",
		[
			27513
		]
	],
	[
		[
			64150,
			64150
		],
		"mapped",
		[
			27578
		]
	],
	[
		[
			64151,
			64151
		],
		"mapped",
		[
			27969
		]
	],
	[
		[
			64152,
			64152
		],
		"mapped",
		[
			28379
		]
	],
	[
		[
			64153,
			64153
		],
		"mapped",
		[
			28363
		]
	],
	[
		[
			64154,
			64154
		],
		"mapped",
		[
			28450
		]
	],
	[
		[
			64155,
			64155
		],
		"mapped",
		[
			28702
		]
	],
	[
		[
			64156,
			64156
		],
		"mapped",
		[
			29038
		]
	],
	[
		[
			64157,
			64157
		],
		"mapped",
		[
			30631
		]
	],
	[
		[
			64158,
			64158
		],
		"mapped",
		[
			29237
		]
	],
	[
		[
			64159,
			64159
		],
		"mapped",
		[
			29359
		]
	],
	[
		[
			64160,
			64160
		],
		"mapped",
		[
			29482
		]
	],
	[
		[
			64161,
			64161
		],
		"mapped",
		[
			29809
		]
	],
	[
		[
			64162,
			64162
		],
		"mapped",
		[
			29958
		]
	],
	[
		[
			64163,
			64163
		],
		"mapped",
		[
			30011
		]
	],
	[
		[
			64164,
			64164
		],
		"mapped",
		[
			30237
		]
	],
	[
		[
			64165,
			64165
		],
		"mapped",
		[
			30239
		]
	],
	[
		[
			64166,
			64166
		],
		"mapped",
		[
			30410
		]
	],
	[
		[
			64167,
			64167
		],
		"mapped",
		[
			30427
		]
	],
	[
		[
			64168,
			64168
		],
		"mapped",
		[
			30452
		]
	],
	[
		[
			64169,
			64169
		],
		"mapped",
		[
			30538
		]
	],
	[
		[
			64170,
			64170
		],
		"mapped",
		[
			30528
		]
	],
	[
		[
			64171,
			64171
		],
		"mapped",
		[
			30924
		]
	],
	[
		[
			64172,
			64172
		],
		"mapped",
		[
			31409
		]
	],
	[
		[
			64173,
			64173
		],
		"mapped",
		[
			31680
		]
	],
	[
		[
			64174,
			64174
		],
		"mapped",
		[
			31867
		]
	],
	[
		[
			64175,
			64175
		],
		"mapped",
		[
			32091
		]
	],
	[
		[
			64176,
			64176
		],
		"mapped",
		[
			32244
		]
	],
	[
		[
			64177,
			64177
		],
		"mapped",
		[
			32574
		]
	],
	[
		[
			64178,
			64178
		],
		"mapped",
		[
			32773
		]
	],
	[
		[
			64179,
			64179
		],
		"mapped",
		[
			33618
		]
	],
	[
		[
			64180,
			64180
		],
		"mapped",
		[
			33775
		]
	],
	[
		[
			64181,
			64181
		],
		"mapped",
		[
			34681
		]
	],
	[
		[
			64182,
			64182
		],
		"mapped",
		[
			35137
		]
	],
	[
		[
			64183,
			64183
		],
		"mapped",
		[
			35206
		]
	],
	[
		[
			64184,
			64184
		],
		"mapped",
		[
			35222
		]
	],
	[
		[
			64185,
			64185
		],
		"mapped",
		[
			35519
		]
	],
	[
		[
			64186,
			64186
		],
		"mapped",
		[
			35576
		]
	],
	[
		[
			64187,
			64187
		],
		"mapped",
		[
			35531
		]
	],
	[
		[
			64188,
			64188
		],
		"mapped",
		[
			35585
		]
	],
	[
		[
			64189,
			64189
		],
		"mapped",
		[
			35582
		]
	],
	[
		[
			64190,
			64190
		],
		"mapped",
		[
			35565
		]
	],
	[
		[
			64191,
			64191
		],
		"mapped",
		[
			35641
		]
	],
	[
		[
			64192,
			64192
		],
		"mapped",
		[
			35722
		]
	],
	[
		[
			64193,
			64193
		],
		"mapped",
		[
			36104
		]
	],
	[
		[
			64194,
			64194
		],
		"mapped",
		[
			36664
		]
	],
	[
		[
			64195,
			64195
		],
		"mapped",
		[
			36978
		]
	],
	[
		[
			64196,
			64196
		],
		"mapped",
		[
			37273
		]
	],
	[
		[
			64197,
			64197
		],
		"mapped",
		[
			37494
		]
	],
	[
		[
			64198,
			64198
		],
		"mapped",
		[
			38524
		]
	],
	[
		[
			64199,
			64199
		],
		"mapped",
		[
			38627
		]
	],
	[
		[
			64200,
			64200
		],
		"mapped",
		[
			38742
		]
	],
	[
		[
			64201,
			64201
		],
		"mapped",
		[
			38875
		]
	],
	[
		[
			64202,
			64202
		],
		"mapped",
		[
			38911
		]
	],
	[
		[
			64203,
			64203
		],
		"mapped",
		[
			38923
		]
	],
	[
		[
			64204,
			64204
		],
		"mapped",
		[
			38971
		]
	],
	[
		[
			64205,
			64205
		],
		"mapped",
		[
			39698
		]
	],
	[
		[
			64206,
			64206
		],
		"mapped",
		[
			40860
		]
	],
	[
		[
			64207,
			64207
		],
		"mapped",
		[
			141386
		]
	],
	[
		[
			64208,
			64208
		],
		"mapped",
		[
			141380
		]
	],
	[
		[
			64209,
			64209
		],
		"mapped",
		[
			144341
		]
	],
	[
		[
			64210,
			64210
		],
		"mapped",
		[
			15261
		]
	],
	[
		[
			64211,
			64211
		],
		"mapped",
		[
			16408
		]
	],
	[
		[
			64212,
			64212
		],
		"mapped",
		[
			16441
		]
	],
	[
		[
			64213,
			64213
		],
		"mapped",
		[
			152137
		]
	],
	[
		[
			64214,
			64214
		],
		"mapped",
		[
			154832
		]
	],
	[
		[
			64215,
			64215
		],
		"mapped",
		[
			163539
		]
	],
	[
		[
			64216,
			64216
		],
		"mapped",
		[
			40771
		]
	],
	[
		[
			64217,
			64217
		],
		"mapped",
		[
			40846
		]
	],
	[
		[
			64218,
			64255
		],
		"disallowed"
	],
	[
		[
			64256,
			64256
		],
		"mapped",
		[
			102,
			102
		]
	],
	[
		[
			64257,
			64257
		],
		"mapped",
		[
			102,
			105
		]
	],
	[
		[
			64258,
			64258
		],
		"mapped",
		[
			102,
			108
		]
	],
	[
		[
			64259,
			64259
		],
		"mapped",
		[
			102,
			102,
			105
		]
	],
	[
		[
			64260,
			64260
		],
		"mapped",
		[
			102,
			102,
			108
		]
	],
	[
		[
			64261,
			64262
		],
		"mapped",
		[
			115,
			116
		]
	],
	[
		[
			64263,
			64274
		],
		"disallowed"
	],
	[
		[
			64275,
			64275
		],
		"mapped",
		[
			1396,
			1398
		]
	],
	[
		[
			64276,
			64276
		],
		"mapped",
		[
			1396,
			1381
		]
	],
	[
		[
			64277,
			64277
		],
		"mapped",
		[
			1396,
			1387
		]
	],
	[
		[
			64278,
			64278
		],
		"mapped",
		[
			1406,
			1398
		]
	],
	[
		[
			64279,
			64279
		],
		"mapped",
		[
			1396,
			1389
		]
	],
	[
		[
			64280,
			64284
		],
		"disallowed"
	],
	[
		[
			64285,
			64285
		],
		"mapped",
		[
			1497,
			1460
		]
	],
	[
		[
			64286,
			64286
		],
		"valid"
	],
	[
		[
			64287,
			64287
		],
		"mapped",
		[
			1522,
			1463
		]
	],
	[
		[
			64288,
			64288
		],
		"mapped",
		[
			1506
		]
	],
	[
		[
			64289,
			64289
		],
		"mapped",
		[
			1488
		]
	],
	[
		[
			64290,
			64290
		],
		"mapped",
		[
			1491
		]
	],
	[
		[
			64291,
			64291
		],
		"mapped",
		[
			1492
		]
	],
	[
		[
			64292,
			64292
		],
		"mapped",
		[
			1499
		]
	],
	[
		[
			64293,
			64293
		],
		"mapped",
		[
			1500
		]
	],
	[
		[
			64294,
			64294
		],
		"mapped",
		[
			1501
		]
	],
	[
		[
			64295,
			64295
		],
		"mapped",
		[
			1512
		]
	],
	[
		[
			64296,
			64296
		],
		"mapped",
		[
			1514
		]
	],
	[
		[
			64297,
			64297
		],
		"disallowed_STD3_mapped",
		[
			43
		]
	],
	[
		[
			64298,
			64298
		],
		"mapped",
		[
			1513,
			1473
		]
	],
	[
		[
			64299,
			64299
		],
		"mapped",
		[
			1513,
			1474
		]
	],
	[
		[
			64300,
			64300
		],
		"mapped",
		[
			1513,
			1468,
			1473
		]
	],
	[
		[
			64301,
			64301
		],
		"mapped",
		[
			1513,
			1468,
			1474
		]
	],
	[
		[
			64302,
			64302
		],
		"mapped",
		[
			1488,
			1463
		]
	],
	[
		[
			64303,
			64303
		],
		"mapped",
		[
			1488,
			1464
		]
	],
	[
		[
			64304,
			64304
		],
		"mapped",
		[
			1488,
			1468
		]
	],
	[
		[
			64305,
			64305
		],
		"mapped",
		[
			1489,
			1468
		]
	],
	[
		[
			64306,
			64306
		],
		"mapped",
		[
			1490,
			1468
		]
	],
	[
		[
			64307,
			64307
		],
		"mapped",
		[
			1491,
			1468
		]
	],
	[
		[
			64308,
			64308
		],
		"mapped",
		[
			1492,
			1468
		]
	],
	[
		[
			64309,
			64309
		],
		"mapped",
		[
			1493,
			1468
		]
	],
	[
		[
			64310,
			64310
		],
		"mapped",
		[
			1494,
			1468
		]
	],
	[
		[
			64311,
			64311
		],
		"disallowed"
	],
	[
		[
			64312,
			64312
		],
		"mapped",
		[
			1496,
			1468
		]
	],
	[
		[
			64313,
			64313
		],
		"mapped",
		[
			1497,
			1468
		]
	],
	[
		[
			64314,
			64314
		],
		"mapped",
		[
			1498,
			1468
		]
	],
	[
		[
			64315,
			64315
		],
		"mapped",
		[
			1499,
			1468
		]
	],
	[
		[
			64316,
			64316
		],
		"mapped",
		[
			1500,
			1468
		]
	],
	[
		[
			64317,
			64317
		],
		"disallowed"
	],
	[
		[
			64318,
			64318
		],
		"mapped",
		[
			1502,
			1468
		]
	],
	[
		[
			64319,
			64319
		],
		"disallowed"
	],
	[
		[
			64320,
			64320
		],
		"mapped",
		[
			1504,
			1468
		]
	],
	[
		[
			64321,
			64321
		],
		"mapped",
		[
			1505,
			1468
		]
	],
	[
		[
			64322,
			64322
		],
		"disallowed"
	],
	[
		[
			64323,
			64323
		],
		"mapped",
		[
			1507,
			1468
		]
	],
	[
		[
			64324,
			64324
		],
		"mapped",
		[
			1508,
			1468
		]
	],
	[
		[
			64325,
			64325
		],
		"disallowed"
	],
	[
		[
			64326,
			64326
		],
		"mapped",
		[
			1510,
			1468
		]
	],
	[
		[
			64327,
			64327
		],
		"mapped",
		[
			1511,
			1468
		]
	],
	[
		[
			64328,
			64328
		],
		"mapped",
		[
			1512,
			1468
		]
	],
	[
		[
			64329,
			64329
		],
		"mapped",
		[
			1513,
			1468
		]
	],
	[
		[
			64330,
			64330
		],
		"mapped",
		[
			1514,
			1468
		]
	],
	[
		[
			64331,
			64331
		],
		"mapped",
		[
			1493,
			1465
		]
	],
	[
		[
			64332,
			64332
		],
		"mapped",
		[
			1489,
			1471
		]
	],
	[
		[
			64333,
			64333
		],
		"mapped",
		[
			1499,
			1471
		]
	],
	[
		[
			64334,
			64334
		],
		"mapped",
		[
			1508,
			1471
		]
	],
	[
		[
			64335,
			64335
		],
		"mapped",
		[
			1488,
			1500
		]
	],
	[
		[
			64336,
			64337
		],
		"mapped",
		[
			1649
		]
	],
	[
		[
			64338,
			64341
		],
		"mapped",
		[
			1659
		]
	],
	[
		[
			64342,
			64345
		],
		"mapped",
		[
			1662
		]
	],
	[
		[
			64346,
			64349
		],
		"mapped",
		[
			1664
		]
	],
	[
		[
			64350,
			64353
		],
		"mapped",
		[
			1658
		]
	],
	[
		[
			64354,
			64357
		],
		"mapped",
		[
			1663
		]
	],
	[
		[
			64358,
			64361
		],
		"mapped",
		[
			1657
		]
	],
	[
		[
			64362,
			64365
		],
		"mapped",
		[
			1700
		]
	],
	[
		[
			64366,
			64369
		],
		"mapped",
		[
			1702
		]
	],
	[
		[
			64370,
			64373
		],
		"mapped",
		[
			1668
		]
	],
	[
		[
			64374,
			64377
		],
		"mapped",
		[
			1667
		]
	],
	[
		[
			64378,
			64381
		],
		"mapped",
		[
			1670
		]
	],
	[
		[
			64382,
			64385
		],
		"mapped",
		[
			1671
		]
	],
	[
		[
			64386,
			64387
		],
		"mapped",
		[
			1677
		]
	],
	[
		[
			64388,
			64389
		],
		"mapped",
		[
			1676
		]
	],
	[
		[
			64390,
			64391
		],
		"mapped",
		[
			1678
		]
	],
	[
		[
			64392,
			64393
		],
		"mapped",
		[
			1672
		]
	],
	[
		[
			64394,
			64395
		],
		"mapped",
		[
			1688
		]
	],
	[
		[
			64396,
			64397
		],
		"mapped",
		[
			1681
		]
	],
	[
		[
			64398,
			64401
		],
		"mapped",
		[
			1705
		]
	],
	[
		[
			64402,
			64405
		],
		"mapped",
		[
			1711
		]
	],
	[
		[
			64406,
			64409
		],
		"mapped",
		[
			1715
		]
	],
	[
		[
			64410,
			64413
		],
		"mapped",
		[
			1713
		]
	],
	[
		[
			64414,
			64415
		],
		"mapped",
		[
			1722
		]
	],
	[
		[
			64416,
			64419
		],
		"mapped",
		[
			1723
		]
	],
	[
		[
			64420,
			64421
		],
		"mapped",
		[
			1728
		]
	],
	[
		[
			64422,
			64425
		],
		"mapped",
		[
			1729
		]
	],
	[
		[
			64426,
			64429
		],
		"mapped",
		[
			1726
		]
	],
	[
		[
			64430,
			64431
		],
		"mapped",
		[
			1746
		]
	],
	[
		[
			64432,
			64433
		],
		"mapped",
		[
			1747
		]
	],
	[
		[
			64434,
			64449
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			64450,
			64466
		],
		"disallowed"
	],
	[
		[
			64467,
			64470
		],
		"mapped",
		[
			1709
		]
	],
	[
		[
			64471,
			64472
		],
		"mapped",
		[
			1735
		]
	],
	[
		[
			64473,
			64474
		],
		"mapped",
		[
			1734
		]
	],
	[
		[
			64475,
			64476
		],
		"mapped",
		[
			1736
		]
	],
	[
		[
			64477,
			64477
		],
		"mapped",
		[
			1735,
			1652
		]
	],
	[
		[
			64478,
			64479
		],
		"mapped",
		[
			1739
		]
	],
	[
		[
			64480,
			64481
		],
		"mapped",
		[
			1733
		]
	],
	[
		[
			64482,
			64483
		],
		"mapped",
		[
			1737
		]
	],
	[
		[
			64484,
			64487
		],
		"mapped",
		[
			1744
		]
	],
	[
		[
			64488,
			64489
		],
		"mapped",
		[
			1609
		]
	],
	[
		[
			64490,
			64491
		],
		"mapped",
		[
			1574,
			1575
		]
	],
	[
		[
			64492,
			64493
		],
		"mapped",
		[
			1574,
			1749
		]
	],
	[
		[
			64494,
			64495
		],
		"mapped",
		[
			1574,
			1608
		]
	],
	[
		[
			64496,
			64497
		],
		"mapped",
		[
			1574,
			1735
		]
	],
	[
		[
			64498,
			64499
		],
		"mapped",
		[
			1574,
			1734
		]
	],
	[
		[
			64500,
			64501
		],
		"mapped",
		[
			1574,
			1736
		]
	],
	[
		[
			64502,
			64504
		],
		"mapped",
		[
			1574,
			1744
		]
	],
	[
		[
			64505,
			64507
		],
		"mapped",
		[
			1574,
			1609
		]
	],
	[
		[
			64508,
			64511
		],
		"mapped",
		[
			1740
		]
	],
	[
		[
			64512,
			64512
		],
		"mapped",
		[
			1574,
			1580
		]
	],
	[
		[
			64513,
			64513
		],
		"mapped",
		[
			1574,
			1581
		]
	],
	[
		[
			64514,
			64514
		],
		"mapped",
		[
			1574,
			1605
		]
	],
	[
		[
			64515,
			64515
		],
		"mapped",
		[
			1574,
			1609
		]
	],
	[
		[
			64516,
			64516
		],
		"mapped",
		[
			1574,
			1610
		]
	],
	[
		[
			64517,
			64517
		],
		"mapped",
		[
			1576,
			1580
		]
	],
	[
		[
			64518,
			64518
		],
		"mapped",
		[
			1576,
			1581
		]
	],
	[
		[
			64519,
			64519
		],
		"mapped",
		[
			1576,
			1582
		]
	],
	[
		[
			64520,
			64520
		],
		"mapped",
		[
			1576,
			1605
		]
	],
	[
		[
			64521,
			64521
		],
		"mapped",
		[
			1576,
			1609
		]
	],
	[
		[
			64522,
			64522
		],
		"mapped",
		[
			1576,
			1610
		]
	],
	[
		[
			64523,
			64523
		],
		"mapped",
		[
			1578,
			1580
		]
	],
	[
		[
			64524,
			64524
		],
		"mapped",
		[
			1578,
			1581
		]
	],
	[
		[
			64525,
			64525
		],
		"mapped",
		[
			1578,
			1582
		]
	],
	[
		[
			64526,
			64526
		],
		"mapped",
		[
			1578,
			1605
		]
	],
	[
		[
			64527,
			64527
		],
		"mapped",
		[
			1578,
			1609
		]
	],
	[
		[
			64528,
			64528
		],
		"mapped",
		[
			1578,
			1610
		]
	],
	[
		[
			64529,
			64529
		],
		"mapped",
		[
			1579,
			1580
		]
	],
	[
		[
			64530,
			64530
		],
		"mapped",
		[
			1579,
			1605
		]
	],
	[
		[
			64531,
			64531
		],
		"mapped",
		[
			1579,
			1609
		]
	],
	[
		[
			64532,
			64532
		],
		"mapped",
		[
			1579,
			1610
		]
	],
	[
		[
			64533,
			64533
		],
		"mapped",
		[
			1580,
			1581
		]
	],
	[
		[
			64534,
			64534
		],
		"mapped",
		[
			1580,
			1605
		]
	],
	[
		[
			64535,
			64535
		],
		"mapped",
		[
			1581,
			1580
		]
	],
	[
		[
			64536,
			64536
		],
		"mapped",
		[
			1581,
			1605
		]
	],
	[
		[
			64537,
			64537
		],
		"mapped",
		[
			1582,
			1580
		]
	],
	[
		[
			64538,
			64538
		],
		"mapped",
		[
			1582,
			1581
		]
	],
	[
		[
			64539,
			64539
		],
		"mapped",
		[
			1582,
			1605
		]
	],
	[
		[
			64540,
			64540
		],
		"mapped",
		[
			1587,
			1580
		]
	],
	[
		[
			64541,
			64541
		],
		"mapped",
		[
			1587,
			1581
		]
	],
	[
		[
			64542,
			64542
		],
		"mapped",
		[
			1587,
			1582
		]
	],
	[
		[
			64543,
			64543
		],
		"mapped",
		[
			1587,
			1605
		]
	],
	[
		[
			64544,
			64544
		],
		"mapped",
		[
			1589,
			1581
		]
	],
	[
		[
			64545,
			64545
		],
		"mapped",
		[
			1589,
			1605
		]
	],
	[
		[
			64546,
			64546
		],
		"mapped",
		[
			1590,
			1580
		]
	],
	[
		[
			64547,
			64547
		],
		"mapped",
		[
			1590,
			1581
		]
	],
	[
		[
			64548,
			64548
		],
		"mapped",
		[
			1590,
			1582
		]
	],
	[
		[
			64549,
			64549
		],
		"mapped",
		[
			1590,
			1605
		]
	],
	[
		[
			64550,
			64550
		],
		"mapped",
		[
			1591,
			1581
		]
	],
	[
		[
			64551,
			64551
		],
		"mapped",
		[
			1591,
			1605
		]
	],
	[
		[
			64552,
			64552
		],
		"mapped",
		[
			1592,
			1605
		]
	],
	[
		[
			64553,
			64553
		],
		"mapped",
		[
			1593,
			1580
		]
	],
	[
		[
			64554,
			64554
		],
		"mapped",
		[
			1593,
			1605
		]
	],
	[
		[
			64555,
			64555
		],
		"mapped",
		[
			1594,
			1580
		]
	],
	[
		[
			64556,
			64556
		],
		"mapped",
		[
			1594,
			1605
		]
	],
	[
		[
			64557,
			64557
		],
		"mapped",
		[
			1601,
			1580
		]
	],
	[
		[
			64558,
			64558
		],
		"mapped",
		[
			1601,
			1581
		]
	],
	[
		[
			64559,
			64559
		],
		"mapped",
		[
			1601,
			1582
		]
	],
	[
		[
			64560,
			64560
		],
		"mapped",
		[
			1601,
			1605
		]
	],
	[
		[
			64561,
			64561
		],
		"mapped",
		[
			1601,
			1609
		]
	],
	[
		[
			64562,
			64562
		],
		"mapped",
		[
			1601,
			1610
		]
	],
	[
		[
			64563,
			64563
		],
		"mapped",
		[
			1602,
			1581
		]
	],
	[
		[
			64564,
			64564
		],
		"mapped",
		[
			1602,
			1605
		]
	],
	[
		[
			64565,
			64565
		],
		"mapped",
		[
			1602,
			1609
		]
	],
	[
		[
			64566,
			64566
		],
		"mapped",
		[
			1602,
			1610
		]
	],
	[
		[
			64567,
			64567
		],
		"mapped",
		[
			1603,
			1575
		]
	],
	[
		[
			64568,
			64568
		],
		"mapped",
		[
			1603,
			1580
		]
	],
	[
		[
			64569,
			64569
		],
		"mapped",
		[
			1603,
			1581
		]
	],
	[
		[
			64570,
			64570
		],
		"mapped",
		[
			1603,
			1582
		]
	],
	[
		[
			64571,
			64571
		],
		"mapped",
		[
			1603,
			1604
		]
	],
	[
		[
			64572,
			64572
		],
		"mapped",
		[
			1603,
			1605
		]
	],
	[
		[
			64573,
			64573
		],
		"mapped",
		[
			1603,
			1609
		]
	],
	[
		[
			64574,
			64574
		],
		"mapped",
		[
			1603,
			1610
		]
	],
	[
		[
			64575,
			64575
		],
		"mapped",
		[
			1604,
			1580
		]
	],
	[
		[
			64576,
			64576
		],
		"mapped",
		[
			1604,
			1581
		]
	],
	[
		[
			64577,
			64577
		],
		"mapped",
		[
			1604,
			1582
		]
	],
	[
		[
			64578,
			64578
		],
		"mapped",
		[
			1604,
			1605
		]
	],
	[
		[
			64579,
			64579
		],
		"mapped",
		[
			1604,
			1609
		]
	],
	[
		[
			64580,
			64580
		],
		"mapped",
		[
			1604,
			1610
		]
	],
	[
		[
			64581,
			64581
		],
		"mapped",
		[
			1605,
			1580
		]
	],
	[
		[
			64582,
			64582
		],
		"mapped",
		[
			1605,
			1581
		]
	],
	[
		[
			64583,
			64583
		],
		"mapped",
		[
			1605,
			1582
		]
	],
	[
		[
			64584,
			64584
		],
		"mapped",
		[
			1605,
			1605
		]
	],
	[
		[
			64585,
			64585
		],
		"mapped",
		[
			1605,
			1609
		]
	],
	[
		[
			64586,
			64586
		],
		"mapped",
		[
			1605,
			1610
		]
	],
	[
		[
			64587,
			64587
		],
		"mapped",
		[
			1606,
			1580
		]
	],
	[
		[
			64588,
			64588
		],
		"mapped",
		[
			1606,
			1581
		]
	],
	[
		[
			64589,
			64589
		],
		"mapped",
		[
			1606,
			1582
		]
	],
	[
		[
			64590,
			64590
		],
		"mapped",
		[
			1606,
			1605
		]
	],
	[
		[
			64591,
			64591
		],
		"mapped",
		[
			1606,
			1609
		]
	],
	[
		[
			64592,
			64592
		],
		"mapped",
		[
			1606,
			1610
		]
	],
	[
		[
			64593,
			64593
		],
		"mapped",
		[
			1607,
			1580
		]
	],
	[
		[
			64594,
			64594
		],
		"mapped",
		[
			1607,
			1605
		]
	],
	[
		[
			64595,
			64595
		],
		"mapped",
		[
			1607,
			1609
		]
	],
	[
		[
			64596,
			64596
		],
		"mapped",
		[
			1607,
			1610
		]
	],
	[
		[
			64597,
			64597
		],
		"mapped",
		[
			1610,
			1580
		]
	],
	[
		[
			64598,
			64598
		],
		"mapped",
		[
			1610,
			1581
		]
	],
	[
		[
			64599,
			64599
		],
		"mapped",
		[
			1610,
			1582
		]
	],
	[
		[
			64600,
			64600
		],
		"mapped",
		[
			1610,
			1605
		]
	],
	[
		[
			64601,
			64601
		],
		"mapped",
		[
			1610,
			1609
		]
	],
	[
		[
			64602,
			64602
		],
		"mapped",
		[
			1610,
			1610
		]
	],
	[
		[
			64603,
			64603
		],
		"mapped",
		[
			1584,
			1648
		]
	],
	[
		[
			64604,
			64604
		],
		"mapped",
		[
			1585,
			1648
		]
	],
	[
		[
			64605,
			64605
		],
		"mapped",
		[
			1609,
			1648
		]
	],
	[
		[
			64606,
			64606
		],
		"disallowed_STD3_mapped",
		[
			32,
			1612,
			1617
		]
	],
	[
		[
			64607,
			64607
		],
		"disallowed_STD3_mapped",
		[
			32,
			1613,
			1617
		]
	],
	[
		[
			64608,
			64608
		],
		"disallowed_STD3_mapped",
		[
			32,
			1614,
			1617
		]
	],
	[
		[
			64609,
			64609
		],
		"disallowed_STD3_mapped",
		[
			32,
			1615,
			1617
		]
	],
	[
		[
			64610,
			64610
		],
		"disallowed_STD3_mapped",
		[
			32,
			1616,
			1617
		]
	],
	[
		[
			64611,
			64611
		],
		"disallowed_STD3_mapped",
		[
			32,
			1617,
			1648
		]
	],
	[
		[
			64612,
			64612
		],
		"mapped",
		[
			1574,
			1585
		]
	],
	[
		[
			64613,
			64613
		],
		"mapped",
		[
			1574,
			1586
		]
	],
	[
		[
			64614,
			64614
		],
		"mapped",
		[
			1574,
			1605
		]
	],
	[
		[
			64615,
			64615
		],
		"mapped",
		[
			1574,
			1606
		]
	],
	[
		[
			64616,
			64616
		],
		"mapped",
		[
			1574,
			1609
		]
	],
	[
		[
			64617,
			64617
		],
		"mapped",
		[
			1574,
			1610
		]
	],
	[
		[
			64618,
			64618
		],
		"mapped",
		[
			1576,
			1585
		]
	],
	[
		[
			64619,
			64619
		],
		"mapped",
		[
			1576,
			1586
		]
	],
	[
		[
			64620,
			64620
		],
		"mapped",
		[
			1576,
			1605
		]
	],
	[
		[
			64621,
			64621
		],
		"mapped",
		[
			1576,
			1606
		]
	],
	[
		[
			64622,
			64622
		],
		"mapped",
		[
			1576,
			1609
		]
	],
	[
		[
			64623,
			64623
		],
		"mapped",
		[
			1576,
			1610
		]
	],
	[
		[
			64624,
			64624
		],
		"mapped",
		[
			1578,
			1585
		]
	],
	[
		[
			64625,
			64625
		],
		"mapped",
		[
			1578,
			1586
		]
	],
	[
		[
			64626,
			64626
		],
		"mapped",
		[
			1578,
			1605
		]
	],
	[
		[
			64627,
			64627
		],
		"mapped",
		[
			1578,
			1606
		]
	],
	[
		[
			64628,
			64628
		],
		"mapped",
		[
			1578,
			1609
		]
	],
	[
		[
			64629,
			64629
		],
		"mapped",
		[
			1578,
			1610
		]
	],
	[
		[
			64630,
			64630
		],
		"mapped",
		[
			1579,
			1585
		]
	],
	[
		[
			64631,
			64631
		],
		"mapped",
		[
			1579,
			1586
		]
	],
	[
		[
			64632,
			64632
		],
		"mapped",
		[
			1579,
			1605
		]
	],
	[
		[
			64633,
			64633
		],
		"mapped",
		[
			1579,
			1606
		]
	],
	[
		[
			64634,
			64634
		],
		"mapped",
		[
			1579,
			1609
		]
	],
	[
		[
			64635,
			64635
		],
		"mapped",
		[
			1579,
			1610
		]
	],
	[
		[
			64636,
			64636
		],
		"mapped",
		[
			1601,
			1609
		]
	],
	[
		[
			64637,
			64637
		],
		"mapped",
		[
			1601,
			1610
		]
	],
	[
		[
			64638,
			64638
		],
		"mapped",
		[
			1602,
			1609
		]
	],
	[
		[
			64639,
			64639
		],
		"mapped",
		[
			1602,
			1610
		]
	],
	[
		[
			64640,
			64640
		],
		"mapped",
		[
			1603,
			1575
		]
	],
	[
		[
			64641,
			64641
		],
		"mapped",
		[
			1603,
			1604
		]
	],
	[
		[
			64642,
			64642
		],
		"mapped",
		[
			1603,
			1605
		]
	],
	[
		[
			64643,
			64643
		],
		"mapped",
		[
			1603,
			1609
		]
	],
	[
		[
			64644,
			64644
		],
		"mapped",
		[
			1603,
			1610
		]
	],
	[
		[
			64645,
			64645
		],
		"mapped",
		[
			1604,
			1605
		]
	],
	[
		[
			64646,
			64646
		],
		"mapped",
		[
			1604,
			1609
		]
	],
	[
		[
			64647,
			64647
		],
		"mapped",
		[
			1604,
			1610
		]
	],
	[
		[
			64648,
			64648
		],
		"mapped",
		[
			1605,
			1575
		]
	],
	[
		[
			64649,
			64649
		],
		"mapped",
		[
			1605,
			1605
		]
	],
	[
		[
			64650,
			64650
		],
		"mapped",
		[
			1606,
			1585
		]
	],
	[
		[
			64651,
			64651
		],
		"mapped",
		[
			1606,
			1586
		]
	],
	[
		[
			64652,
			64652
		],
		"mapped",
		[
			1606,
			1605
		]
	],
	[
		[
			64653,
			64653
		],
		"mapped",
		[
			1606,
			1606
		]
	],
	[
		[
			64654,
			64654
		],
		"mapped",
		[
			1606,
			1609
		]
	],
	[
		[
			64655,
			64655
		],
		"mapped",
		[
			1606,
			1610
		]
	],
	[
		[
			64656,
			64656
		],
		"mapped",
		[
			1609,
			1648
		]
	],
	[
		[
			64657,
			64657
		],
		"mapped",
		[
			1610,
			1585
		]
	],
	[
		[
			64658,
			64658
		],
		"mapped",
		[
			1610,
			1586
		]
	],
	[
		[
			64659,
			64659
		],
		"mapped",
		[
			1610,
			1605
		]
	],
	[
		[
			64660,
			64660
		],
		"mapped",
		[
			1610,
			1606
		]
	],
	[
		[
			64661,
			64661
		],
		"mapped",
		[
			1610,
			1609
		]
	],
	[
		[
			64662,
			64662
		],
		"mapped",
		[
			1610,
			1610
		]
	],
	[
		[
			64663,
			64663
		],
		"mapped",
		[
			1574,
			1580
		]
	],
	[
		[
			64664,
			64664
		],
		"mapped",
		[
			1574,
			1581
		]
	],
	[
		[
			64665,
			64665
		],
		"mapped",
		[
			1574,
			1582
		]
	],
	[
		[
			64666,
			64666
		],
		"mapped",
		[
			1574,
			1605
		]
	],
	[
		[
			64667,
			64667
		],
		"mapped",
		[
			1574,
			1607
		]
	],
	[
		[
			64668,
			64668
		],
		"mapped",
		[
			1576,
			1580
		]
	],
	[
		[
			64669,
			64669
		],
		"mapped",
		[
			1576,
			1581
		]
	],
	[
		[
			64670,
			64670
		],
		"mapped",
		[
			1576,
			1582
		]
	],
	[
		[
			64671,
			64671
		],
		"mapped",
		[
			1576,
			1605
		]
	],
	[
		[
			64672,
			64672
		],
		"mapped",
		[
			1576,
			1607
		]
	],
	[
		[
			64673,
			64673
		],
		"mapped",
		[
			1578,
			1580
		]
	],
	[
		[
			64674,
			64674
		],
		"mapped",
		[
			1578,
			1581
		]
	],
	[
		[
			64675,
			64675
		],
		"mapped",
		[
			1578,
			1582
		]
	],
	[
		[
			64676,
			64676
		],
		"mapped",
		[
			1578,
			1605
		]
	],
	[
		[
			64677,
			64677
		],
		"mapped",
		[
			1578,
			1607
		]
	],
	[
		[
			64678,
			64678
		],
		"mapped",
		[
			1579,
			1605
		]
	],
	[
		[
			64679,
			64679
		],
		"mapped",
		[
			1580,
			1581
		]
	],
	[
		[
			64680,
			64680
		],
		"mapped",
		[
			1580,
			1605
		]
	],
	[
		[
			64681,
			64681
		],
		"mapped",
		[
			1581,
			1580
		]
	],
	[
		[
			64682,
			64682
		],
		"mapped",
		[
			1581,
			1605
		]
	],
	[
		[
			64683,
			64683
		],
		"mapped",
		[
			1582,
			1580
		]
	],
	[
		[
			64684,
			64684
		],
		"mapped",
		[
			1582,
			1605
		]
	],
	[
		[
			64685,
			64685
		],
		"mapped",
		[
			1587,
			1580
		]
	],
	[
		[
			64686,
			64686
		],
		"mapped",
		[
			1587,
			1581
		]
	],
	[
		[
			64687,
			64687
		],
		"mapped",
		[
			1587,
			1582
		]
	],
	[
		[
			64688,
			64688
		],
		"mapped",
		[
			1587,
			1605
		]
	],
	[
		[
			64689,
			64689
		],
		"mapped",
		[
			1589,
			1581
		]
	],
	[
		[
			64690,
			64690
		],
		"mapped",
		[
			1589,
			1582
		]
	],
	[
		[
			64691,
			64691
		],
		"mapped",
		[
			1589,
			1605
		]
	],
	[
		[
			64692,
			64692
		],
		"mapped",
		[
			1590,
			1580
		]
	],
	[
		[
			64693,
			64693
		],
		"mapped",
		[
			1590,
			1581
		]
	],
	[
		[
			64694,
			64694
		],
		"mapped",
		[
			1590,
			1582
		]
	],
	[
		[
			64695,
			64695
		],
		"mapped",
		[
			1590,
			1605
		]
	],
	[
		[
			64696,
			64696
		],
		"mapped",
		[
			1591,
			1581
		]
	],
	[
		[
			64697,
			64697
		],
		"mapped",
		[
			1592,
			1605
		]
	],
	[
		[
			64698,
			64698
		],
		"mapped",
		[
			1593,
			1580
		]
	],
	[
		[
			64699,
			64699
		],
		"mapped",
		[
			1593,
			1605
		]
	],
	[
		[
			64700,
			64700
		],
		"mapped",
		[
			1594,
			1580
		]
	],
	[
		[
			64701,
			64701
		],
		"mapped",
		[
			1594,
			1605
		]
	],
	[
		[
			64702,
			64702
		],
		"mapped",
		[
			1601,
			1580
		]
	],
	[
		[
			64703,
			64703
		],
		"mapped",
		[
			1601,
			1581
		]
	],
	[
		[
			64704,
			64704
		],
		"mapped",
		[
			1601,
			1582
		]
	],
	[
		[
			64705,
			64705
		],
		"mapped",
		[
			1601,
			1605
		]
	],
	[
		[
			64706,
			64706
		],
		"mapped",
		[
			1602,
			1581
		]
	],
	[
		[
			64707,
			64707
		],
		"mapped",
		[
			1602,
			1605
		]
	],
	[
		[
			64708,
			64708
		],
		"mapped",
		[
			1603,
			1580
		]
	],
	[
		[
			64709,
			64709
		],
		"mapped",
		[
			1603,
			1581
		]
	],
	[
		[
			64710,
			64710
		],
		"mapped",
		[
			1603,
			1582
		]
	],
	[
		[
			64711,
			64711
		],
		"mapped",
		[
			1603,
			1604
		]
	],
	[
		[
			64712,
			64712
		],
		"mapped",
		[
			1603,
			1605
		]
	],
	[
		[
			64713,
			64713
		],
		"mapped",
		[
			1604,
			1580
		]
	],
	[
		[
			64714,
			64714
		],
		"mapped",
		[
			1604,
			1581
		]
	],
	[
		[
			64715,
			64715
		],
		"mapped",
		[
			1604,
			1582
		]
	],
	[
		[
			64716,
			64716
		],
		"mapped",
		[
			1604,
			1605
		]
	],
	[
		[
			64717,
			64717
		],
		"mapped",
		[
			1604,
			1607
		]
	],
	[
		[
			64718,
			64718
		],
		"mapped",
		[
			1605,
			1580
		]
	],
	[
		[
			64719,
			64719
		],
		"mapped",
		[
			1605,
			1581
		]
	],
	[
		[
			64720,
			64720
		],
		"mapped",
		[
			1605,
			1582
		]
	],
	[
		[
			64721,
			64721
		],
		"mapped",
		[
			1605,
			1605
		]
	],
	[
		[
			64722,
			64722
		],
		"mapped",
		[
			1606,
			1580
		]
	],
	[
		[
			64723,
			64723
		],
		"mapped",
		[
			1606,
			1581
		]
	],
	[
		[
			64724,
			64724
		],
		"mapped",
		[
			1606,
			1582
		]
	],
	[
		[
			64725,
			64725
		],
		"mapped",
		[
			1606,
			1605
		]
	],
	[
		[
			64726,
			64726
		],
		"mapped",
		[
			1606,
			1607
		]
	],
	[
		[
			64727,
			64727
		],
		"mapped",
		[
			1607,
			1580
		]
	],
	[
		[
			64728,
			64728
		],
		"mapped",
		[
			1607,
			1605
		]
	],
	[
		[
			64729,
			64729
		],
		"mapped",
		[
			1607,
			1648
		]
	],
	[
		[
			64730,
			64730
		],
		"mapped",
		[
			1610,
			1580
		]
	],
	[
		[
			64731,
			64731
		],
		"mapped",
		[
			1610,
			1581
		]
	],
	[
		[
			64732,
			64732
		],
		"mapped",
		[
			1610,
			1582
		]
	],
	[
		[
			64733,
			64733
		],
		"mapped",
		[
			1610,
			1605
		]
	],
	[
		[
			64734,
			64734
		],
		"mapped",
		[
			1610,
			1607
		]
	],
	[
		[
			64735,
			64735
		],
		"mapped",
		[
			1574,
			1605
		]
	],
	[
		[
			64736,
			64736
		],
		"mapped",
		[
			1574,
			1607
		]
	],
	[
		[
			64737,
			64737
		],
		"mapped",
		[
			1576,
			1605
		]
	],
	[
		[
			64738,
			64738
		],
		"mapped",
		[
			1576,
			1607
		]
	],
	[
		[
			64739,
			64739
		],
		"mapped",
		[
			1578,
			1605
		]
	],
	[
		[
			64740,
			64740
		],
		"mapped",
		[
			1578,
			1607
		]
	],
	[
		[
			64741,
			64741
		],
		"mapped",
		[
			1579,
			1605
		]
	],
	[
		[
			64742,
			64742
		],
		"mapped",
		[
			1579,
			1607
		]
	],
	[
		[
			64743,
			64743
		],
		"mapped",
		[
			1587,
			1605
		]
	],
	[
		[
			64744,
			64744
		],
		"mapped",
		[
			1587,
			1607
		]
	],
	[
		[
			64745,
			64745
		],
		"mapped",
		[
			1588,
			1605
		]
	],
	[
		[
			64746,
			64746
		],
		"mapped",
		[
			1588,
			1607
		]
	],
	[
		[
			64747,
			64747
		],
		"mapped",
		[
			1603,
			1604
		]
	],
	[
		[
			64748,
			64748
		],
		"mapped",
		[
			1603,
			1605
		]
	],
	[
		[
			64749,
			64749
		],
		"mapped",
		[
			1604,
			1605
		]
	],
	[
		[
			64750,
			64750
		],
		"mapped",
		[
			1606,
			1605
		]
	],
	[
		[
			64751,
			64751
		],
		"mapped",
		[
			1606,
			1607
		]
	],
	[
		[
			64752,
			64752
		],
		"mapped",
		[
			1610,
			1605
		]
	],
	[
		[
			64753,
			64753
		],
		"mapped",
		[
			1610,
			1607
		]
	],
	[
		[
			64754,
			64754
		],
		"mapped",
		[
			1600,
			1614,
			1617
		]
	],
	[
		[
			64755,
			64755
		],
		"mapped",
		[
			1600,
			1615,
			1617
		]
	],
	[
		[
			64756,
			64756
		],
		"mapped",
		[
			1600,
			1616,
			1617
		]
	],
	[
		[
			64757,
			64757
		],
		"mapped",
		[
			1591,
			1609
		]
	],
	[
		[
			64758,
			64758
		],
		"mapped",
		[
			1591,
			1610
		]
	],
	[
		[
			64759,
			64759
		],
		"mapped",
		[
			1593,
			1609
		]
	],
	[
		[
			64760,
			64760
		],
		"mapped",
		[
			1593,
			1610
		]
	],
	[
		[
			64761,
			64761
		],
		"mapped",
		[
			1594,
			1609
		]
	],
	[
		[
			64762,
			64762
		],
		"mapped",
		[
			1594,
			1610
		]
	],
	[
		[
			64763,
			64763
		],
		"mapped",
		[
			1587,
			1609
		]
	],
	[
		[
			64764,
			64764
		],
		"mapped",
		[
			1587,
			1610
		]
	],
	[
		[
			64765,
			64765
		],
		"mapped",
		[
			1588,
			1609
		]
	],
	[
		[
			64766,
			64766
		],
		"mapped",
		[
			1588,
			1610
		]
	],
	[
		[
			64767,
			64767
		],
		"mapped",
		[
			1581,
			1609
		]
	],
	[
		[
			64768,
			64768
		],
		"mapped",
		[
			1581,
			1610
		]
	],
	[
		[
			64769,
			64769
		],
		"mapped",
		[
			1580,
			1609
		]
	],
	[
		[
			64770,
			64770
		],
		"mapped",
		[
			1580,
			1610
		]
	],
	[
		[
			64771,
			64771
		],
		"mapped",
		[
			1582,
			1609
		]
	],
	[
		[
			64772,
			64772
		],
		"mapped",
		[
			1582,
			1610
		]
	],
	[
		[
			64773,
			64773
		],
		"mapped",
		[
			1589,
			1609
		]
	],
	[
		[
			64774,
			64774
		],
		"mapped",
		[
			1589,
			1610
		]
	],
	[
		[
			64775,
			64775
		],
		"mapped",
		[
			1590,
			1609
		]
	],
	[
		[
			64776,
			64776
		],
		"mapped",
		[
			1590,
			1610
		]
	],
	[
		[
			64777,
			64777
		],
		"mapped",
		[
			1588,
			1580
		]
	],
	[
		[
			64778,
			64778
		],
		"mapped",
		[
			1588,
			1581
		]
	],
	[
		[
			64779,
			64779
		],
		"mapped",
		[
			1588,
			1582
		]
	],
	[
		[
			64780,
			64780
		],
		"mapped",
		[
			1588,
			1605
		]
	],
	[
		[
			64781,
			64781
		],
		"mapped",
		[
			1588,
			1585
		]
	],
	[
		[
			64782,
			64782
		],
		"mapped",
		[
			1587,
			1585
		]
	],
	[
		[
			64783,
			64783
		],
		"mapped",
		[
			1589,
			1585
		]
	],
	[
		[
			64784,
			64784
		],
		"mapped",
		[
			1590,
			1585
		]
	],
	[
		[
			64785,
			64785
		],
		"mapped",
		[
			1591,
			1609
		]
	],
	[
		[
			64786,
			64786
		],
		"mapped",
		[
			1591,
			1610
		]
	],
	[
		[
			64787,
			64787
		],
		"mapped",
		[
			1593,
			1609
		]
	],
	[
		[
			64788,
			64788
		],
		"mapped",
		[
			1593,
			1610
		]
	],
	[
		[
			64789,
			64789
		],
		"mapped",
		[
			1594,
			1609
		]
	],
	[
		[
			64790,
			64790
		],
		"mapped",
		[
			1594,
			1610
		]
	],
	[
		[
			64791,
			64791
		],
		"mapped",
		[
			1587,
			1609
		]
	],
	[
		[
			64792,
			64792
		],
		"mapped",
		[
			1587,
			1610
		]
	],
	[
		[
			64793,
			64793
		],
		"mapped",
		[
			1588,
			1609
		]
	],
	[
		[
			64794,
			64794
		],
		"mapped",
		[
			1588,
			1610
		]
	],
	[
		[
			64795,
			64795
		],
		"mapped",
		[
			1581,
			1609
		]
	],
	[
		[
			64796,
			64796
		],
		"mapped",
		[
			1581,
			1610
		]
	],
	[
		[
			64797,
			64797
		],
		"mapped",
		[
			1580,
			1609
		]
	],
	[
		[
			64798,
			64798
		],
		"mapped",
		[
			1580,
			1610
		]
	],
	[
		[
			64799,
			64799
		],
		"mapped",
		[
			1582,
			1609
		]
	],
	[
		[
			64800,
			64800
		],
		"mapped",
		[
			1582,
			1610
		]
	],
	[
		[
			64801,
			64801
		],
		"mapped",
		[
			1589,
			1609
		]
	],
	[
		[
			64802,
			64802
		],
		"mapped",
		[
			1589,
			1610
		]
	],
	[
		[
			64803,
			64803
		],
		"mapped",
		[
			1590,
			1609
		]
	],
	[
		[
			64804,
			64804
		],
		"mapped",
		[
			1590,
			1610
		]
	],
	[
		[
			64805,
			64805
		],
		"mapped",
		[
			1588,
			1580
		]
	],
	[
		[
			64806,
			64806
		],
		"mapped",
		[
			1588,
			1581
		]
	],
	[
		[
			64807,
			64807
		],
		"mapped",
		[
			1588,
			1582
		]
	],
	[
		[
			64808,
			64808
		],
		"mapped",
		[
			1588,
			1605
		]
	],
	[
		[
			64809,
			64809
		],
		"mapped",
		[
			1588,
			1585
		]
	],
	[
		[
			64810,
			64810
		],
		"mapped",
		[
			1587,
			1585
		]
	],
	[
		[
			64811,
			64811
		],
		"mapped",
		[
			1589,
			1585
		]
	],
	[
		[
			64812,
			64812
		],
		"mapped",
		[
			1590,
			1585
		]
	],
	[
		[
			64813,
			64813
		],
		"mapped",
		[
			1588,
			1580
		]
	],
	[
		[
			64814,
			64814
		],
		"mapped",
		[
			1588,
			1581
		]
	],
	[
		[
			64815,
			64815
		],
		"mapped",
		[
			1588,
			1582
		]
	],
	[
		[
			64816,
			64816
		],
		"mapped",
		[
			1588,
			1605
		]
	],
	[
		[
			64817,
			64817
		],
		"mapped",
		[
			1587,
			1607
		]
	],
	[
		[
			64818,
			64818
		],
		"mapped",
		[
			1588,
			1607
		]
	],
	[
		[
			64819,
			64819
		],
		"mapped",
		[
			1591,
			1605
		]
	],
	[
		[
			64820,
			64820
		],
		"mapped",
		[
			1587,
			1580
		]
	],
	[
		[
			64821,
			64821
		],
		"mapped",
		[
			1587,
			1581
		]
	],
	[
		[
			64822,
			64822
		],
		"mapped",
		[
			1587,
			1582
		]
	],
	[
		[
			64823,
			64823
		],
		"mapped",
		[
			1588,
			1580
		]
	],
	[
		[
			64824,
			64824
		],
		"mapped",
		[
			1588,
			1581
		]
	],
	[
		[
			64825,
			64825
		],
		"mapped",
		[
			1588,
			1582
		]
	],
	[
		[
			64826,
			64826
		],
		"mapped",
		[
			1591,
			1605
		]
	],
	[
		[
			64827,
			64827
		],
		"mapped",
		[
			1592,
			1605
		]
	],
	[
		[
			64828,
			64829
		],
		"mapped",
		[
			1575,
			1611
		]
	],
	[
		[
			64830,
			64831
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			64832,
			64847
		],
		"disallowed"
	],
	[
		[
			64848,
			64848
		],
		"mapped",
		[
			1578,
			1580,
			1605
		]
	],
	[
		[
			64849,
			64850
		],
		"mapped",
		[
			1578,
			1581,
			1580
		]
	],
	[
		[
			64851,
			64851
		],
		"mapped",
		[
			1578,
			1581,
			1605
		]
	],
	[
		[
			64852,
			64852
		],
		"mapped",
		[
			1578,
			1582,
			1605
		]
	],
	[
		[
			64853,
			64853
		],
		"mapped",
		[
			1578,
			1605,
			1580
		]
	],
	[
		[
			64854,
			64854
		],
		"mapped",
		[
			1578,
			1605,
			1581
		]
	],
	[
		[
			64855,
			64855
		],
		"mapped",
		[
			1578,
			1605,
			1582
		]
	],
	[
		[
			64856,
			64857
		],
		"mapped",
		[
			1580,
			1605,
			1581
		]
	],
	[
		[
			64858,
			64858
		],
		"mapped",
		[
			1581,
			1605,
			1610
		]
	],
	[
		[
			64859,
			64859
		],
		"mapped",
		[
			1581,
			1605,
			1609
		]
	],
	[
		[
			64860,
			64860
		],
		"mapped",
		[
			1587,
			1581,
			1580
		]
	],
	[
		[
			64861,
			64861
		],
		"mapped",
		[
			1587,
			1580,
			1581
		]
	],
	[
		[
			64862,
			64862
		],
		"mapped",
		[
			1587,
			1580,
			1609
		]
	],
	[
		[
			64863,
			64864
		],
		"mapped",
		[
			1587,
			1605,
			1581
		]
	],
	[
		[
			64865,
			64865
		],
		"mapped",
		[
			1587,
			1605,
			1580
		]
	],
	[
		[
			64866,
			64867
		],
		"mapped",
		[
			1587,
			1605,
			1605
		]
	],
	[
		[
			64868,
			64869
		],
		"mapped",
		[
			1589,
			1581,
			1581
		]
	],
	[
		[
			64870,
			64870
		],
		"mapped",
		[
			1589,
			1605,
			1605
		]
	],
	[
		[
			64871,
			64872
		],
		"mapped",
		[
			1588,
			1581,
			1605
		]
	],
	[
		[
			64873,
			64873
		],
		"mapped",
		[
			1588,
			1580,
			1610
		]
	],
	[
		[
			64874,
			64875
		],
		"mapped",
		[
			1588,
			1605,
			1582
		]
	],
	[
		[
			64876,
			64877
		],
		"mapped",
		[
			1588,
			1605,
			1605
		]
	],
	[
		[
			64878,
			64878
		],
		"mapped",
		[
			1590,
			1581,
			1609
		]
	],
	[
		[
			64879,
			64880
		],
		"mapped",
		[
			1590,
			1582,
			1605
		]
	],
	[
		[
			64881,
			64882
		],
		"mapped",
		[
			1591,
			1605,
			1581
		]
	],
	[
		[
			64883,
			64883
		],
		"mapped",
		[
			1591,
			1605,
			1605
		]
	],
	[
		[
			64884,
			64884
		],
		"mapped",
		[
			1591,
			1605,
			1610
		]
	],
	[
		[
			64885,
			64885
		],
		"mapped",
		[
			1593,
			1580,
			1605
		]
	],
	[
		[
			64886,
			64887
		],
		"mapped",
		[
			1593,
			1605,
			1605
		]
	],
	[
		[
			64888,
			64888
		],
		"mapped",
		[
			1593,
			1605,
			1609
		]
	],
	[
		[
			64889,
			64889
		],
		"mapped",
		[
			1594,
			1605,
			1605
		]
	],
	[
		[
			64890,
			64890
		],
		"mapped",
		[
			1594,
			1605,
			1610
		]
	],
	[
		[
			64891,
			64891
		],
		"mapped",
		[
			1594,
			1605,
			1609
		]
	],
	[
		[
			64892,
			64893
		],
		"mapped",
		[
			1601,
			1582,
			1605
		]
	],
	[
		[
			64894,
			64894
		],
		"mapped",
		[
			1602,
			1605,
			1581
		]
	],
	[
		[
			64895,
			64895
		],
		"mapped",
		[
			1602,
			1605,
			1605
		]
	],
	[
		[
			64896,
			64896
		],
		"mapped",
		[
			1604,
			1581,
			1605
		]
	],
	[
		[
			64897,
			64897
		],
		"mapped",
		[
			1604,
			1581,
			1610
		]
	],
	[
		[
			64898,
			64898
		],
		"mapped",
		[
			1604,
			1581,
			1609
		]
	],
	[
		[
			64899,
			64900
		],
		"mapped",
		[
			1604,
			1580,
			1580
		]
	],
	[
		[
			64901,
			64902
		],
		"mapped",
		[
			1604,
			1582,
			1605
		]
	],
	[
		[
			64903,
			64904
		],
		"mapped",
		[
			1604,
			1605,
			1581
		]
	],
	[
		[
			64905,
			64905
		],
		"mapped",
		[
			1605,
			1581,
			1580
		]
	],
	[
		[
			64906,
			64906
		],
		"mapped",
		[
			1605,
			1581,
			1605
		]
	],
	[
		[
			64907,
			64907
		],
		"mapped",
		[
			1605,
			1581,
			1610
		]
	],
	[
		[
			64908,
			64908
		],
		"mapped",
		[
			1605,
			1580,
			1581
		]
	],
	[
		[
			64909,
			64909
		],
		"mapped",
		[
			1605,
			1580,
			1605
		]
	],
	[
		[
			64910,
			64910
		],
		"mapped",
		[
			1605,
			1582,
			1580
		]
	],
	[
		[
			64911,
			64911
		],
		"mapped",
		[
			1605,
			1582,
			1605
		]
	],
	[
		[
			64912,
			64913
		],
		"disallowed"
	],
	[
		[
			64914,
			64914
		],
		"mapped",
		[
			1605,
			1580,
			1582
		]
	],
	[
		[
			64915,
			64915
		],
		"mapped",
		[
			1607,
			1605,
			1580
		]
	],
	[
		[
			64916,
			64916
		],
		"mapped",
		[
			1607,
			1605,
			1605
		]
	],
	[
		[
			64917,
			64917
		],
		"mapped",
		[
			1606,
			1581,
			1605
		]
	],
	[
		[
			64918,
			64918
		],
		"mapped",
		[
			1606,
			1581,
			1609
		]
	],
	[
		[
			64919,
			64920
		],
		"mapped",
		[
			1606,
			1580,
			1605
		]
	],
	[
		[
			64921,
			64921
		],
		"mapped",
		[
			1606,
			1580,
			1609
		]
	],
	[
		[
			64922,
			64922
		],
		"mapped",
		[
			1606,
			1605,
			1610
		]
	],
	[
		[
			64923,
			64923
		],
		"mapped",
		[
			1606,
			1605,
			1609
		]
	],
	[
		[
			64924,
			64925
		],
		"mapped",
		[
			1610,
			1605,
			1605
		]
	],
	[
		[
			64926,
			64926
		],
		"mapped",
		[
			1576,
			1582,
			1610
		]
	],
	[
		[
			64927,
			64927
		],
		"mapped",
		[
			1578,
			1580,
			1610
		]
	],
	[
		[
			64928,
			64928
		],
		"mapped",
		[
			1578,
			1580,
			1609
		]
	],
	[
		[
			64929,
			64929
		],
		"mapped",
		[
			1578,
			1582,
			1610
		]
	],
	[
		[
			64930,
			64930
		],
		"mapped",
		[
			1578,
			1582,
			1609
		]
	],
	[
		[
			64931,
			64931
		],
		"mapped",
		[
			1578,
			1605,
			1610
		]
	],
	[
		[
			64932,
			64932
		],
		"mapped",
		[
			1578,
			1605,
			1609
		]
	],
	[
		[
			64933,
			64933
		],
		"mapped",
		[
			1580,
			1605,
			1610
		]
	],
	[
		[
			64934,
			64934
		],
		"mapped",
		[
			1580,
			1581,
			1609
		]
	],
	[
		[
			64935,
			64935
		],
		"mapped",
		[
			1580,
			1605,
			1609
		]
	],
	[
		[
			64936,
			64936
		],
		"mapped",
		[
			1587,
			1582,
			1609
		]
	],
	[
		[
			64937,
			64937
		],
		"mapped",
		[
			1589,
			1581,
			1610
		]
	],
	[
		[
			64938,
			64938
		],
		"mapped",
		[
			1588,
			1581,
			1610
		]
	],
	[
		[
			64939,
			64939
		],
		"mapped",
		[
			1590,
			1581,
			1610
		]
	],
	[
		[
			64940,
			64940
		],
		"mapped",
		[
			1604,
			1580,
			1610
		]
	],
	[
		[
			64941,
			64941
		],
		"mapped",
		[
			1604,
			1605,
			1610
		]
	],
	[
		[
			64942,
			64942
		],
		"mapped",
		[
			1610,
			1581,
			1610
		]
	],
	[
		[
			64943,
			64943
		],
		"mapped",
		[
			1610,
			1580,
			1610
		]
	],
	[
		[
			64944,
			64944
		],
		"mapped",
		[
			1610,
			1605,
			1610
		]
	],
	[
		[
			64945,
			64945
		],
		"mapped",
		[
			1605,
			1605,
			1610
		]
	],
	[
		[
			64946,
			64946
		],
		"mapped",
		[
			1602,
			1605,
			1610
		]
	],
	[
		[
			64947,
			64947
		],
		"mapped",
		[
			1606,
			1581,
			1610
		]
	],
	[
		[
			64948,
			64948
		],
		"mapped",
		[
			1602,
			1605,
			1581
		]
	],
	[
		[
			64949,
			64949
		],
		"mapped",
		[
			1604,
			1581,
			1605
		]
	],
	[
		[
			64950,
			64950
		],
		"mapped",
		[
			1593,
			1605,
			1610
		]
	],
	[
		[
			64951,
			64951
		],
		"mapped",
		[
			1603,
			1605,
			1610
		]
	],
	[
		[
			64952,
			64952
		],
		"mapped",
		[
			1606,
			1580,
			1581
		]
	],
	[
		[
			64953,
			64953
		],
		"mapped",
		[
			1605,
			1582,
			1610
		]
	],
	[
		[
			64954,
			64954
		],
		"mapped",
		[
			1604,
			1580,
			1605
		]
	],
	[
		[
			64955,
			64955
		],
		"mapped",
		[
			1603,
			1605,
			1605
		]
	],
	[
		[
			64956,
			64956
		],
		"mapped",
		[
			1604,
			1580,
			1605
		]
	],
	[
		[
			64957,
			64957
		],
		"mapped",
		[
			1606,
			1580,
			1581
		]
	],
	[
		[
			64958,
			64958
		],
		"mapped",
		[
			1580,
			1581,
			1610
		]
	],
	[
		[
			64959,
			64959
		],
		"mapped",
		[
			1581,
			1580,
			1610
		]
	],
	[
		[
			64960,
			64960
		],
		"mapped",
		[
			1605,
			1580,
			1610
		]
	],
	[
		[
			64961,
			64961
		],
		"mapped",
		[
			1601,
			1605,
			1610
		]
	],
	[
		[
			64962,
			64962
		],
		"mapped",
		[
			1576,
			1581,
			1610
		]
	],
	[
		[
			64963,
			64963
		],
		"mapped",
		[
			1603,
			1605,
			1605
		]
	],
	[
		[
			64964,
			64964
		],
		"mapped",
		[
			1593,
			1580,
			1605
		]
	],
	[
		[
			64965,
			64965
		],
		"mapped",
		[
			1589,
			1605,
			1605
		]
	],
	[
		[
			64966,
			64966
		],
		"mapped",
		[
			1587,
			1582,
			1610
		]
	],
	[
		[
			64967,
			64967
		],
		"mapped",
		[
			1606,
			1580,
			1610
		]
	],
	[
		[
			64968,
			64975
		],
		"disallowed"
	],
	[
		[
			64976,
			65007
		],
		"disallowed"
	],
	[
		[
			65008,
			65008
		],
		"mapped",
		[
			1589,
			1604,
			1746
		]
	],
	[
		[
			65009,
			65009
		],
		"mapped",
		[
			1602,
			1604,
			1746
		]
	],
	[
		[
			65010,
			65010
		],
		"mapped",
		[
			1575,
			1604,
			1604,
			1607
		]
	],
	[
		[
			65011,
			65011
		],
		"mapped",
		[
			1575,
			1603,
			1576,
			1585
		]
	],
	[
		[
			65012,
			65012
		],
		"mapped",
		[
			1605,
			1581,
			1605,
			1583
		]
	],
	[
		[
			65013,
			65013
		],
		"mapped",
		[
			1589,
			1604,
			1593,
			1605
		]
	],
	[
		[
			65014,
			65014
		],
		"mapped",
		[
			1585,
			1587,
			1608,
			1604
		]
	],
	[
		[
			65015,
			65015
		],
		"mapped",
		[
			1593,
			1604,
			1610,
			1607
		]
	],
	[
		[
			65016,
			65016
		],
		"mapped",
		[
			1608,
			1587,
			1604,
			1605
		]
	],
	[
		[
			65017,
			65017
		],
		"mapped",
		[
			1589,
			1604,
			1609
		]
	],
	[
		[
			65018,
			65018
		],
		"disallowed_STD3_mapped",
		[
			1589,
			1604,
			1609,
			32,
			1575,
			1604,
			1604,
			1607,
			32,
			1593,
			1604,
			1610,
			1607,
			32,
			1608,
			1587,
			1604,
			1605
		]
	],
	[
		[
			65019,
			65019
		],
		"disallowed_STD3_mapped",
		[
			1580,
			1604,
			32,
			1580,
			1604,
			1575,
			1604,
			1607
		]
	],
	[
		[
			65020,
			65020
		],
		"mapped",
		[
			1585,
			1740,
			1575,
			1604
		]
	],
	[
		[
			65021,
			65021
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			65022,
			65023
		],
		"disallowed"
	],
	[
		[
			65024,
			65039
		],
		"ignored"
	],
	[
		[
			65040,
			65040
		],
		"disallowed_STD3_mapped",
		[
			44
		]
	],
	[
		[
			65041,
			65041
		],
		"mapped",
		[
			12289
		]
	],
	[
		[
			65042,
			65042
		],
		"disallowed"
	],
	[
		[
			65043,
			65043
		],
		"disallowed_STD3_mapped",
		[
			58
		]
	],
	[
		[
			65044,
			65044
		],
		"disallowed_STD3_mapped",
		[
			59
		]
	],
	[
		[
			65045,
			65045
		],
		"disallowed_STD3_mapped",
		[
			33
		]
	],
	[
		[
			65046,
			65046
		],
		"disallowed_STD3_mapped",
		[
			63
		]
	],
	[
		[
			65047,
			65047
		],
		"mapped",
		[
			12310
		]
	],
	[
		[
			65048,
			65048
		],
		"mapped",
		[
			12311
		]
	],
	[
		[
			65049,
			65049
		],
		"disallowed"
	],
	[
		[
			65050,
			65055
		],
		"disallowed"
	],
	[
		[
			65056,
			65059
		],
		"valid"
	],
	[
		[
			65060,
			65062
		],
		"valid"
	],
	[
		[
			65063,
			65069
		],
		"valid"
	],
	[
		[
			65070,
			65071
		],
		"valid"
	],
	[
		[
			65072,
			65072
		],
		"disallowed"
	],
	[
		[
			65073,
			65073
		],
		"mapped",
		[
			8212
		]
	],
	[
		[
			65074,
			65074
		],
		"mapped",
		[
			8211
		]
	],
	[
		[
			65075,
			65076
		],
		"disallowed_STD3_mapped",
		[
			95
		]
	],
	[
		[
			65077,
			65077
		],
		"disallowed_STD3_mapped",
		[
			40
		]
	],
	[
		[
			65078,
			65078
		],
		"disallowed_STD3_mapped",
		[
			41
		]
	],
	[
		[
			65079,
			65079
		],
		"disallowed_STD3_mapped",
		[
			123
		]
	],
	[
		[
			65080,
			65080
		],
		"disallowed_STD3_mapped",
		[
			125
		]
	],
	[
		[
			65081,
			65081
		],
		"mapped",
		[
			12308
		]
	],
	[
		[
			65082,
			65082
		],
		"mapped",
		[
			12309
		]
	],
	[
		[
			65083,
			65083
		],
		"mapped",
		[
			12304
		]
	],
	[
		[
			65084,
			65084
		],
		"mapped",
		[
			12305
		]
	],
	[
		[
			65085,
			65085
		],
		"mapped",
		[
			12298
		]
	],
	[
		[
			65086,
			65086
		],
		"mapped",
		[
			12299
		]
	],
	[
		[
			65087,
			65087
		],
		"mapped",
		[
			12296
		]
	],
	[
		[
			65088,
			65088
		],
		"mapped",
		[
			12297
		]
	],
	[
		[
			65089,
			65089
		],
		"mapped",
		[
			12300
		]
	],
	[
		[
			65090,
			65090
		],
		"mapped",
		[
			12301
		]
	],
	[
		[
			65091,
			65091
		],
		"mapped",
		[
			12302
		]
	],
	[
		[
			65092,
			65092
		],
		"mapped",
		[
			12303
		]
	],
	[
		[
			65093,
			65094
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			65095,
			65095
		],
		"disallowed_STD3_mapped",
		[
			91
		]
	],
	[
		[
			65096,
			65096
		],
		"disallowed_STD3_mapped",
		[
			93
		]
	],
	[
		[
			65097,
			65100
		],
		"disallowed_STD3_mapped",
		[
			32,
			773
		]
	],
	[
		[
			65101,
			65103
		],
		"disallowed_STD3_mapped",
		[
			95
		]
	],
	[
		[
			65104,
			65104
		],
		"disallowed_STD3_mapped",
		[
			44
		]
	],
	[
		[
			65105,
			65105
		],
		"mapped",
		[
			12289
		]
	],
	[
		[
			65106,
			65106
		],
		"disallowed"
	],
	[
		[
			65107,
			65107
		],
		"disallowed"
	],
	[
		[
			65108,
			65108
		],
		"disallowed_STD3_mapped",
		[
			59
		]
	],
	[
		[
			65109,
			65109
		],
		"disallowed_STD3_mapped",
		[
			58
		]
	],
	[
		[
			65110,
			65110
		],
		"disallowed_STD3_mapped",
		[
			63
		]
	],
	[
		[
			65111,
			65111
		],
		"disallowed_STD3_mapped",
		[
			33
		]
	],
	[
		[
			65112,
			65112
		],
		"mapped",
		[
			8212
		]
	],
	[
		[
			65113,
			65113
		],
		"disallowed_STD3_mapped",
		[
			40
		]
	],
	[
		[
			65114,
			65114
		],
		"disallowed_STD3_mapped",
		[
			41
		]
	],
	[
		[
			65115,
			65115
		],
		"disallowed_STD3_mapped",
		[
			123
		]
	],
	[
		[
			65116,
			65116
		],
		"disallowed_STD3_mapped",
		[
			125
		]
	],
	[
		[
			65117,
			65117
		],
		"mapped",
		[
			12308
		]
	],
	[
		[
			65118,
			65118
		],
		"mapped",
		[
			12309
		]
	],
	[
		[
			65119,
			65119
		],
		"disallowed_STD3_mapped",
		[
			35
		]
	],
	[
		[
			65120,
			65120
		],
		"disallowed_STD3_mapped",
		[
			38
		]
	],
	[
		[
			65121,
			65121
		],
		"disallowed_STD3_mapped",
		[
			42
		]
	],
	[
		[
			65122,
			65122
		],
		"disallowed_STD3_mapped",
		[
			43
		]
	],
	[
		[
			65123,
			65123
		],
		"mapped",
		[
			45
		]
	],
	[
		[
			65124,
			65124
		],
		"disallowed_STD3_mapped",
		[
			60
		]
	],
	[
		[
			65125,
			65125
		],
		"disallowed_STD3_mapped",
		[
			62
		]
	],
	[
		[
			65126,
			65126
		],
		"disallowed_STD3_mapped",
		[
			61
		]
	],
	[
		[
			65127,
			65127
		],
		"disallowed"
	],
	[
		[
			65128,
			65128
		],
		"disallowed_STD3_mapped",
		[
			92
		]
	],
	[
		[
			65129,
			65129
		],
		"disallowed_STD3_mapped",
		[
			36
		]
	],
	[
		[
			65130,
			65130
		],
		"disallowed_STD3_mapped",
		[
			37
		]
	],
	[
		[
			65131,
			65131
		],
		"disallowed_STD3_mapped",
		[
			64
		]
	],
	[
		[
			65132,
			65135
		],
		"disallowed"
	],
	[
		[
			65136,
			65136
		],
		"disallowed_STD3_mapped",
		[
			32,
			1611
		]
	],
	[
		[
			65137,
			65137
		],
		"mapped",
		[
			1600,
			1611
		]
	],
	[
		[
			65138,
			65138
		],
		"disallowed_STD3_mapped",
		[
			32,
			1612
		]
	],
	[
		[
			65139,
			65139
		],
		"valid"
	],
	[
		[
			65140,
			65140
		],
		"disallowed_STD3_mapped",
		[
			32,
			1613
		]
	],
	[
		[
			65141,
			65141
		],
		"disallowed"
	],
	[
		[
			65142,
			65142
		],
		"disallowed_STD3_mapped",
		[
			32,
			1614
		]
	],
	[
		[
			65143,
			65143
		],
		"mapped",
		[
			1600,
			1614
		]
	],
	[
		[
			65144,
			65144
		],
		"disallowed_STD3_mapped",
		[
			32,
			1615
		]
	],
	[
		[
			65145,
			65145
		],
		"mapped",
		[
			1600,
			1615
		]
	],
	[
		[
			65146,
			65146
		],
		"disallowed_STD3_mapped",
		[
			32,
			1616
		]
	],
	[
		[
			65147,
			65147
		],
		"mapped",
		[
			1600,
			1616
		]
	],
	[
		[
			65148,
			65148
		],
		"disallowed_STD3_mapped",
		[
			32,
			1617
		]
	],
	[
		[
			65149,
			65149
		],
		"mapped",
		[
			1600,
			1617
		]
	],
	[
		[
			65150,
			65150
		],
		"disallowed_STD3_mapped",
		[
			32,
			1618
		]
	],
	[
		[
			65151,
			65151
		],
		"mapped",
		[
			1600,
			1618
		]
	],
	[
		[
			65152,
			65152
		],
		"mapped",
		[
			1569
		]
	],
	[
		[
			65153,
			65154
		],
		"mapped",
		[
			1570
		]
	],
	[
		[
			65155,
			65156
		],
		"mapped",
		[
			1571
		]
	],
	[
		[
			65157,
			65158
		],
		"mapped",
		[
			1572
		]
	],
	[
		[
			65159,
			65160
		],
		"mapped",
		[
			1573
		]
	],
	[
		[
			65161,
			65164
		],
		"mapped",
		[
			1574
		]
	],
	[
		[
			65165,
			65166
		],
		"mapped",
		[
			1575
		]
	],
	[
		[
			65167,
			65170
		],
		"mapped",
		[
			1576
		]
	],
	[
		[
			65171,
			65172
		],
		"mapped",
		[
			1577
		]
	],
	[
		[
			65173,
			65176
		],
		"mapped",
		[
			1578
		]
	],
	[
		[
			65177,
			65180
		],
		"mapped",
		[
			1579
		]
	],
	[
		[
			65181,
			65184
		],
		"mapped",
		[
			1580
		]
	],
	[
		[
			65185,
			65188
		],
		"mapped",
		[
			1581
		]
	],
	[
		[
			65189,
			65192
		],
		"mapped",
		[
			1582
		]
	],
	[
		[
			65193,
			65194
		],
		"mapped",
		[
			1583
		]
	],
	[
		[
			65195,
			65196
		],
		"mapped",
		[
			1584
		]
	],
	[
		[
			65197,
			65198
		],
		"mapped",
		[
			1585
		]
	],
	[
		[
			65199,
			65200
		],
		"mapped",
		[
			1586
		]
	],
	[
		[
			65201,
			65204
		],
		"mapped",
		[
			1587
		]
	],
	[
		[
			65205,
			65208
		],
		"mapped",
		[
			1588
		]
	],
	[
		[
			65209,
			65212
		],
		"mapped",
		[
			1589
		]
	],
	[
		[
			65213,
			65216
		],
		"mapped",
		[
			1590
		]
	],
	[
		[
			65217,
			65220
		],
		"mapped",
		[
			1591
		]
	],
	[
		[
			65221,
			65224
		],
		"mapped",
		[
			1592
		]
	],
	[
		[
			65225,
			65228
		],
		"mapped",
		[
			1593
		]
	],
	[
		[
			65229,
			65232
		],
		"mapped",
		[
			1594
		]
	],
	[
		[
			65233,
			65236
		],
		"mapped",
		[
			1601
		]
	],
	[
		[
			65237,
			65240
		],
		"mapped",
		[
			1602
		]
	],
	[
		[
			65241,
			65244
		],
		"mapped",
		[
			1603
		]
	],
	[
		[
			65245,
			65248
		],
		"mapped",
		[
			1604
		]
	],
	[
		[
			65249,
			65252
		],
		"mapped",
		[
			1605
		]
	],
	[
		[
			65253,
			65256
		],
		"mapped",
		[
			1606
		]
	],
	[
		[
			65257,
			65260
		],
		"mapped",
		[
			1607
		]
	],
	[
		[
			65261,
			65262
		],
		"mapped",
		[
			1608
		]
	],
	[
		[
			65263,
			65264
		],
		"mapped",
		[
			1609
		]
	],
	[
		[
			65265,
			65268
		],
		"mapped",
		[
			1610
		]
	],
	[
		[
			65269,
			65270
		],
		"mapped",
		[
			1604,
			1570
		]
	],
	[
		[
			65271,
			65272
		],
		"mapped",
		[
			1604,
			1571
		]
	],
	[
		[
			65273,
			65274
		],
		"mapped",
		[
			1604,
			1573
		]
	],
	[
		[
			65275,
			65276
		],
		"mapped",
		[
			1604,
			1575
		]
	],
	[
		[
			65277,
			65278
		],
		"disallowed"
	],
	[
		[
			65279,
			65279
		],
		"ignored"
	],
	[
		[
			65280,
			65280
		],
		"disallowed"
	],
	[
		[
			65281,
			65281
		],
		"disallowed_STD3_mapped",
		[
			33
		]
	],
	[
		[
			65282,
			65282
		],
		"disallowed_STD3_mapped",
		[
			34
		]
	],
	[
		[
			65283,
			65283
		],
		"disallowed_STD3_mapped",
		[
			35
		]
	],
	[
		[
			65284,
			65284
		],
		"disallowed_STD3_mapped",
		[
			36
		]
	],
	[
		[
			65285,
			65285
		],
		"disallowed_STD3_mapped",
		[
			37
		]
	],
	[
		[
			65286,
			65286
		],
		"disallowed_STD3_mapped",
		[
			38
		]
	],
	[
		[
			65287,
			65287
		],
		"disallowed_STD3_mapped",
		[
			39
		]
	],
	[
		[
			65288,
			65288
		],
		"disallowed_STD3_mapped",
		[
			40
		]
	],
	[
		[
			65289,
			65289
		],
		"disallowed_STD3_mapped",
		[
			41
		]
	],
	[
		[
			65290,
			65290
		],
		"disallowed_STD3_mapped",
		[
			42
		]
	],
	[
		[
			65291,
			65291
		],
		"disallowed_STD3_mapped",
		[
			43
		]
	],
	[
		[
			65292,
			65292
		],
		"disallowed_STD3_mapped",
		[
			44
		]
	],
	[
		[
			65293,
			65293
		],
		"mapped",
		[
			45
		]
	],
	[
		[
			65294,
			65294
		],
		"mapped",
		[
			46
		]
	],
	[
		[
			65295,
			65295
		],
		"disallowed_STD3_mapped",
		[
			47
		]
	],
	[
		[
			65296,
			65296
		],
		"mapped",
		[
			48
		]
	],
	[
		[
			65297,
			65297
		],
		"mapped",
		[
			49
		]
	],
	[
		[
			65298,
			65298
		],
		"mapped",
		[
			50
		]
	],
	[
		[
			65299,
			65299
		],
		"mapped",
		[
			51
		]
	],
	[
		[
			65300,
			65300
		],
		"mapped",
		[
			52
		]
	],
	[
		[
			65301,
			65301
		],
		"mapped",
		[
			53
		]
	],
	[
		[
			65302,
			65302
		],
		"mapped",
		[
			54
		]
	],
	[
		[
			65303,
			65303
		],
		"mapped",
		[
			55
		]
	],
	[
		[
			65304,
			65304
		],
		"mapped",
		[
			56
		]
	],
	[
		[
			65305,
			65305
		],
		"mapped",
		[
			57
		]
	],
	[
		[
			65306,
			65306
		],
		"disallowed_STD3_mapped",
		[
			58
		]
	],
	[
		[
			65307,
			65307
		],
		"disallowed_STD3_mapped",
		[
			59
		]
	],
	[
		[
			65308,
			65308
		],
		"disallowed_STD3_mapped",
		[
			60
		]
	],
	[
		[
			65309,
			65309
		],
		"disallowed_STD3_mapped",
		[
			61
		]
	],
	[
		[
			65310,
			65310
		],
		"disallowed_STD3_mapped",
		[
			62
		]
	],
	[
		[
			65311,
			65311
		],
		"disallowed_STD3_mapped",
		[
			63
		]
	],
	[
		[
			65312,
			65312
		],
		"disallowed_STD3_mapped",
		[
			64
		]
	],
	[
		[
			65313,
			65313
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			65314,
			65314
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			65315,
			65315
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			65316,
			65316
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			65317,
			65317
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			65318,
			65318
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			65319,
			65319
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			65320,
			65320
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			65321,
			65321
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			65322,
			65322
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			65323,
			65323
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			65324,
			65324
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			65325,
			65325
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			65326,
			65326
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			65327,
			65327
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			65328,
			65328
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			65329,
			65329
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			65330,
			65330
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			65331,
			65331
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			65332,
			65332
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			65333,
			65333
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			65334,
			65334
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			65335,
			65335
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			65336,
			65336
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			65337,
			65337
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			65338,
			65338
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			65339,
			65339
		],
		"disallowed_STD3_mapped",
		[
			91
		]
	],
	[
		[
			65340,
			65340
		],
		"disallowed_STD3_mapped",
		[
			92
		]
	],
	[
		[
			65341,
			65341
		],
		"disallowed_STD3_mapped",
		[
			93
		]
	],
	[
		[
			65342,
			65342
		],
		"disallowed_STD3_mapped",
		[
			94
		]
	],
	[
		[
			65343,
			65343
		],
		"disallowed_STD3_mapped",
		[
			95
		]
	],
	[
		[
			65344,
			65344
		],
		"disallowed_STD3_mapped",
		[
			96
		]
	],
	[
		[
			65345,
			65345
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			65346,
			65346
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			65347,
			65347
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			65348,
			65348
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			65349,
			65349
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			65350,
			65350
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			65351,
			65351
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			65352,
			65352
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			65353,
			65353
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			65354,
			65354
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			65355,
			65355
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			65356,
			65356
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			65357,
			65357
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			65358,
			65358
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			65359,
			65359
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			65360,
			65360
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			65361,
			65361
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			65362,
			65362
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			65363,
			65363
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			65364,
			65364
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			65365,
			65365
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			65366,
			65366
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			65367,
			65367
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			65368,
			65368
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			65369,
			65369
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			65370,
			65370
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			65371,
			65371
		],
		"disallowed_STD3_mapped",
		[
			123
		]
	],
	[
		[
			65372,
			65372
		],
		"disallowed_STD3_mapped",
		[
			124
		]
	],
	[
		[
			65373,
			65373
		],
		"disallowed_STD3_mapped",
		[
			125
		]
	],
	[
		[
			65374,
			65374
		],
		"disallowed_STD3_mapped",
		[
			126
		]
	],
	[
		[
			65375,
			65375
		],
		"mapped",
		[
			10629
		]
	],
	[
		[
			65376,
			65376
		],
		"mapped",
		[
			10630
		]
	],
	[
		[
			65377,
			65377
		],
		"mapped",
		[
			46
		]
	],
	[
		[
			65378,
			65378
		],
		"mapped",
		[
			12300
		]
	],
	[
		[
			65379,
			65379
		],
		"mapped",
		[
			12301
		]
	],
	[
		[
			65380,
			65380
		],
		"mapped",
		[
			12289
		]
	],
	[
		[
			65381,
			65381
		],
		"mapped",
		[
			12539
		]
	],
	[
		[
			65382,
			65382
		],
		"mapped",
		[
			12530
		]
	],
	[
		[
			65383,
			65383
		],
		"mapped",
		[
			12449
		]
	],
	[
		[
			65384,
			65384
		],
		"mapped",
		[
			12451
		]
	],
	[
		[
			65385,
			65385
		],
		"mapped",
		[
			12453
		]
	],
	[
		[
			65386,
			65386
		],
		"mapped",
		[
			12455
		]
	],
	[
		[
			65387,
			65387
		],
		"mapped",
		[
			12457
		]
	],
	[
		[
			65388,
			65388
		],
		"mapped",
		[
			12515
		]
	],
	[
		[
			65389,
			65389
		],
		"mapped",
		[
			12517
		]
	],
	[
		[
			65390,
			65390
		],
		"mapped",
		[
			12519
		]
	],
	[
		[
			65391,
			65391
		],
		"mapped",
		[
			12483
		]
	],
	[
		[
			65392,
			65392
		],
		"mapped",
		[
			12540
		]
	],
	[
		[
			65393,
			65393
		],
		"mapped",
		[
			12450
		]
	],
	[
		[
			65394,
			65394
		],
		"mapped",
		[
			12452
		]
	],
	[
		[
			65395,
			65395
		],
		"mapped",
		[
			12454
		]
	],
	[
		[
			65396,
			65396
		],
		"mapped",
		[
			12456
		]
	],
	[
		[
			65397,
			65397
		],
		"mapped",
		[
			12458
		]
	],
	[
		[
			65398,
			65398
		],
		"mapped",
		[
			12459
		]
	],
	[
		[
			65399,
			65399
		],
		"mapped",
		[
			12461
		]
	],
	[
		[
			65400,
			65400
		],
		"mapped",
		[
			12463
		]
	],
	[
		[
			65401,
			65401
		],
		"mapped",
		[
			12465
		]
	],
	[
		[
			65402,
			65402
		],
		"mapped",
		[
			12467
		]
	],
	[
		[
			65403,
			65403
		],
		"mapped",
		[
			12469
		]
	],
	[
		[
			65404,
			65404
		],
		"mapped",
		[
			12471
		]
	],
	[
		[
			65405,
			65405
		],
		"mapped",
		[
			12473
		]
	],
	[
		[
			65406,
			65406
		],
		"mapped",
		[
			12475
		]
	],
	[
		[
			65407,
			65407
		],
		"mapped",
		[
			12477
		]
	],
	[
		[
			65408,
			65408
		],
		"mapped",
		[
			12479
		]
	],
	[
		[
			65409,
			65409
		],
		"mapped",
		[
			12481
		]
	],
	[
		[
			65410,
			65410
		],
		"mapped",
		[
			12484
		]
	],
	[
		[
			65411,
			65411
		],
		"mapped",
		[
			12486
		]
	],
	[
		[
			65412,
			65412
		],
		"mapped",
		[
			12488
		]
	],
	[
		[
			65413,
			65413
		],
		"mapped",
		[
			12490
		]
	],
	[
		[
			65414,
			65414
		],
		"mapped",
		[
			12491
		]
	],
	[
		[
			65415,
			65415
		],
		"mapped",
		[
			12492
		]
	],
	[
		[
			65416,
			65416
		],
		"mapped",
		[
			12493
		]
	],
	[
		[
			65417,
			65417
		],
		"mapped",
		[
			12494
		]
	],
	[
		[
			65418,
			65418
		],
		"mapped",
		[
			12495
		]
	],
	[
		[
			65419,
			65419
		],
		"mapped",
		[
			12498
		]
	],
	[
		[
			65420,
			65420
		],
		"mapped",
		[
			12501
		]
	],
	[
		[
			65421,
			65421
		],
		"mapped",
		[
			12504
		]
	],
	[
		[
			65422,
			65422
		],
		"mapped",
		[
			12507
		]
	],
	[
		[
			65423,
			65423
		],
		"mapped",
		[
			12510
		]
	],
	[
		[
			65424,
			65424
		],
		"mapped",
		[
			12511
		]
	],
	[
		[
			65425,
			65425
		],
		"mapped",
		[
			12512
		]
	],
	[
		[
			65426,
			65426
		],
		"mapped",
		[
			12513
		]
	],
	[
		[
			65427,
			65427
		],
		"mapped",
		[
			12514
		]
	],
	[
		[
			65428,
			65428
		],
		"mapped",
		[
			12516
		]
	],
	[
		[
			65429,
			65429
		],
		"mapped",
		[
			12518
		]
	],
	[
		[
			65430,
			65430
		],
		"mapped",
		[
			12520
		]
	],
	[
		[
			65431,
			65431
		],
		"mapped",
		[
			12521
		]
	],
	[
		[
			65432,
			65432
		],
		"mapped",
		[
			12522
		]
	],
	[
		[
			65433,
			65433
		],
		"mapped",
		[
			12523
		]
	],
	[
		[
			65434,
			65434
		],
		"mapped",
		[
			12524
		]
	],
	[
		[
			65435,
			65435
		],
		"mapped",
		[
			12525
		]
	],
	[
		[
			65436,
			65436
		],
		"mapped",
		[
			12527
		]
	],
	[
		[
			65437,
			65437
		],
		"mapped",
		[
			12531
		]
	],
	[
		[
			65438,
			65438
		],
		"mapped",
		[
			12441
		]
	],
	[
		[
			65439,
			65439
		],
		"mapped",
		[
			12442
		]
	],
	[
		[
			65440,
			65440
		],
		"disallowed"
	],
	[
		[
			65441,
			65441
		],
		"mapped",
		[
			4352
		]
	],
	[
		[
			65442,
			65442
		],
		"mapped",
		[
			4353
		]
	],
	[
		[
			65443,
			65443
		],
		"mapped",
		[
			4522
		]
	],
	[
		[
			65444,
			65444
		],
		"mapped",
		[
			4354
		]
	],
	[
		[
			65445,
			65445
		],
		"mapped",
		[
			4524
		]
	],
	[
		[
			65446,
			65446
		],
		"mapped",
		[
			4525
		]
	],
	[
		[
			65447,
			65447
		],
		"mapped",
		[
			4355
		]
	],
	[
		[
			65448,
			65448
		],
		"mapped",
		[
			4356
		]
	],
	[
		[
			65449,
			65449
		],
		"mapped",
		[
			4357
		]
	],
	[
		[
			65450,
			65450
		],
		"mapped",
		[
			4528
		]
	],
	[
		[
			65451,
			65451
		],
		"mapped",
		[
			4529
		]
	],
	[
		[
			65452,
			65452
		],
		"mapped",
		[
			4530
		]
	],
	[
		[
			65453,
			65453
		],
		"mapped",
		[
			4531
		]
	],
	[
		[
			65454,
			65454
		],
		"mapped",
		[
			4532
		]
	],
	[
		[
			65455,
			65455
		],
		"mapped",
		[
			4533
		]
	],
	[
		[
			65456,
			65456
		],
		"mapped",
		[
			4378
		]
	],
	[
		[
			65457,
			65457
		],
		"mapped",
		[
			4358
		]
	],
	[
		[
			65458,
			65458
		],
		"mapped",
		[
			4359
		]
	],
	[
		[
			65459,
			65459
		],
		"mapped",
		[
			4360
		]
	],
	[
		[
			65460,
			65460
		],
		"mapped",
		[
			4385
		]
	],
	[
		[
			65461,
			65461
		],
		"mapped",
		[
			4361
		]
	],
	[
		[
			65462,
			65462
		],
		"mapped",
		[
			4362
		]
	],
	[
		[
			65463,
			65463
		],
		"mapped",
		[
			4363
		]
	],
	[
		[
			65464,
			65464
		],
		"mapped",
		[
			4364
		]
	],
	[
		[
			65465,
			65465
		],
		"mapped",
		[
			4365
		]
	],
	[
		[
			65466,
			65466
		],
		"mapped",
		[
			4366
		]
	],
	[
		[
			65467,
			65467
		],
		"mapped",
		[
			4367
		]
	],
	[
		[
			65468,
			65468
		],
		"mapped",
		[
			4368
		]
	],
	[
		[
			65469,
			65469
		],
		"mapped",
		[
			4369
		]
	],
	[
		[
			65470,
			65470
		],
		"mapped",
		[
			4370
		]
	],
	[
		[
			65471,
			65473
		],
		"disallowed"
	],
	[
		[
			65474,
			65474
		],
		"mapped",
		[
			4449
		]
	],
	[
		[
			65475,
			65475
		],
		"mapped",
		[
			4450
		]
	],
	[
		[
			65476,
			65476
		],
		"mapped",
		[
			4451
		]
	],
	[
		[
			65477,
			65477
		],
		"mapped",
		[
			4452
		]
	],
	[
		[
			65478,
			65478
		],
		"mapped",
		[
			4453
		]
	],
	[
		[
			65479,
			65479
		],
		"mapped",
		[
			4454
		]
	],
	[
		[
			65480,
			65481
		],
		"disallowed"
	],
	[
		[
			65482,
			65482
		],
		"mapped",
		[
			4455
		]
	],
	[
		[
			65483,
			65483
		],
		"mapped",
		[
			4456
		]
	],
	[
		[
			65484,
			65484
		],
		"mapped",
		[
			4457
		]
	],
	[
		[
			65485,
			65485
		],
		"mapped",
		[
			4458
		]
	],
	[
		[
			65486,
			65486
		],
		"mapped",
		[
			4459
		]
	],
	[
		[
			65487,
			65487
		],
		"mapped",
		[
			4460
		]
	],
	[
		[
			65488,
			65489
		],
		"disallowed"
	],
	[
		[
			65490,
			65490
		],
		"mapped",
		[
			4461
		]
	],
	[
		[
			65491,
			65491
		],
		"mapped",
		[
			4462
		]
	],
	[
		[
			65492,
			65492
		],
		"mapped",
		[
			4463
		]
	],
	[
		[
			65493,
			65493
		],
		"mapped",
		[
			4464
		]
	],
	[
		[
			65494,
			65494
		],
		"mapped",
		[
			4465
		]
	],
	[
		[
			65495,
			65495
		],
		"mapped",
		[
			4466
		]
	],
	[
		[
			65496,
			65497
		],
		"disallowed"
	],
	[
		[
			65498,
			65498
		],
		"mapped",
		[
			4467
		]
	],
	[
		[
			65499,
			65499
		],
		"mapped",
		[
			4468
		]
	],
	[
		[
			65500,
			65500
		],
		"mapped",
		[
			4469
		]
	],
	[
		[
			65501,
			65503
		],
		"disallowed"
	],
	[
		[
			65504,
			65504
		],
		"mapped",
		[
			162
		]
	],
	[
		[
			65505,
			65505
		],
		"mapped",
		[
			163
		]
	],
	[
		[
			65506,
			65506
		],
		"mapped",
		[
			172
		]
	],
	[
		[
			65507,
			65507
		],
		"disallowed_STD3_mapped",
		[
			32,
			772
		]
	],
	[
		[
			65508,
			65508
		],
		"mapped",
		[
			166
		]
	],
	[
		[
			65509,
			65509
		],
		"mapped",
		[
			165
		]
	],
	[
		[
			65510,
			65510
		],
		"mapped",
		[
			8361
		]
	],
	[
		[
			65511,
			65511
		],
		"disallowed"
	],
	[
		[
			65512,
			65512
		],
		"mapped",
		[
			9474
		]
	],
	[
		[
			65513,
			65513
		],
		"mapped",
		[
			8592
		]
	],
	[
		[
			65514,
			65514
		],
		"mapped",
		[
			8593
		]
	],
	[
		[
			65515,
			65515
		],
		"mapped",
		[
			8594
		]
	],
	[
		[
			65516,
			65516
		],
		"mapped",
		[
			8595
		]
	],
	[
		[
			65517,
			65517
		],
		"mapped",
		[
			9632
		]
	],
	[
		[
			65518,
			65518
		],
		"mapped",
		[
			9675
		]
	],
	[
		[
			65519,
			65528
		],
		"disallowed"
	],
	[
		[
			65529,
			65531
		],
		"disallowed"
	],
	[
		[
			65532,
			65532
		],
		"disallowed"
	],
	[
		[
			65533,
			65533
		],
		"disallowed"
	],
	[
		[
			65534,
			65535
		],
		"disallowed"
	],
	[
		[
			65536,
			65547
		],
		"valid"
	],
	[
		[
			65548,
			65548
		],
		"disallowed"
	],
	[
		[
			65549,
			65574
		],
		"valid"
	],
	[
		[
			65575,
			65575
		],
		"disallowed"
	],
	[
		[
			65576,
			65594
		],
		"valid"
	],
	[
		[
			65595,
			65595
		],
		"disallowed"
	],
	[
		[
			65596,
			65597
		],
		"valid"
	],
	[
		[
			65598,
			65598
		],
		"disallowed"
	],
	[
		[
			65599,
			65613
		],
		"valid"
	],
	[
		[
			65614,
			65615
		],
		"disallowed"
	],
	[
		[
			65616,
			65629
		],
		"valid"
	],
	[
		[
			65630,
			65663
		],
		"disallowed"
	],
	[
		[
			65664,
			65786
		],
		"valid"
	],
	[
		[
			65787,
			65791
		],
		"disallowed"
	],
	[
		[
			65792,
			65794
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			65795,
			65798
		],
		"disallowed"
	],
	[
		[
			65799,
			65843
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			65844,
			65846
		],
		"disallowed"
	],
	[
		[
			65847,
			65855
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			65856,
			65930
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			65931,
			65932
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			65933,
			65935
		],
		"disallowed"
	],
	[
		[
			65936,
			65947
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			65948,
			65951
		],
		"disallowed"
	],
	[
		[
			65952,
			65952
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			65953,
			65999
		],
		"disallowed"
	],
	[
		[
			66000,
			66044
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			66045,
			66045
		],
		"valid"
	],
	[
		[
			66046,
			66175
		],
		"disallowed"
	],
	[
		[
			66176,
			66204
		],
		"valid"
	],
	[
		[
			66205,
			66207
		],
		"disallowed"
	],
	[
		[
			66208,
			66256
		],
		"valid"
	],
	[
		[
			66257,
			66271
		],
		"disallowed"
	],
	[
		[
			66272,
			66272
		],
		"valid"
	],
	[
		[
			66273,
			66299
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			66300,
			66303
		],
		"disallowed"
	],
	[
		[
			66304,
			66334
		],
		"valid"
	],
	[
		[
			66335,
			66335
		],
		"valid"
	],
	[
		[
			66336,
			66339
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			66340,
			66351
		],
		"disallowed"
	],
	[
		[
			66352,
			66368
		],
		"valid"
	],
	[
		[
			66369,
			66369
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			66370,
			66377
		],
		"valid"
	],
	[
		[
			66378,
			66378
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			66379,
			66383
		],
		"disallowed"
	],
	[
		[
			66384,
			66426
		],
		"valid"
	],
	[
		[
			66427,
			66431
		],
		"disallowed"
	],
	[
		[
			66432,
			66461
		],
		"valid"
	],
	[
		[
			66462,
			66462
		],
		"disallowed"
	],
	[
		[
			66463,
			66463
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			66464,
			66499
		],
		"valid"
	],
	[
		[
			66500,
			66503
		],
		"disallowed"
	],
	[
		[
			66504,
			66511
		],
		"valid"
	],
	[
		[
			66512,
			66517
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			66518,
			66559
		],
		"disallowed"
	],
	[
		[
			66560,
			66560
		],
		"mapped",
		[
			66600
		]
	],
	[
		[
			66561,
			66561
		],
		"mapped",
		[
			66601
		]
	],
	[
		[
			66562,
			66562
		],
		"mapped",
		[
			66602
		]
	],
	[
		[
			66563,
			66563
		],
		"mapped",
		[
			66603
		]
	],
	[
		[
			66564,
			66564
		],
		"mapped",
		[
			66604
		]
	],
	[
		[
			66565,
			66565
		],
		"mapped",
		[
			66605
		]
	],
	[
		[
			66566,
			66566
		],
		"mapped",
		[
			66606
		]
	],
	[
		[
			66567,
			66567
		],
		"mapped",
		[
			66607
		]
	],
	[
		[
			66568,
			66568
		],
		"mapped",
		[
			66608
		]
	],
	[
		[
			66569,
			66569
		],
		"mapped",
		[
			66609
		]
	],
	[
		[
			66570,
			66570
		],
		"mapped",
		[
			66610
		]
	],
	[
		[
			66571,
			66571
		],
		"mapped",
		[
			66611
		]
	],
	[
		[
			66572,
			66572
		],
		"mapped",
		[
			66612
		]
	],
	[
		[
			66573,
			66573
		],
		"mapped",
		[
			66613
		]
	],
	[
		[
			66574,
			66574
		],
		"mapped",
		[
			66614
		]
	],
	[
		[
			66575,
			66575
		],
		"mapped",
		[
			66615
		]
	],
	[
		[
			66576,
			66576
		],
		"mapped",
		[
			66616
		]
	],
	[
		[
			66577,
			66577
		],
		"mapped",
		[
			66617
		]
	],
	[
		[
			66578,
			66578
		],
		"mapped",
		[
			66618
		]
	],
	[
		[
			66579,
			66579
		],
		"mapped",
		[
			66619
		]
	],
	[
		[
			66580,
			66580
		],
		"mapped",
		[
			66620
		]
	],
	[
		[
			66581,
			66581
		],
		"mapped",
		[
			66621
		]
	],
	[
		[
			66582,
			66582
		],
		"mapped",
		[
			66622
		]
	],
	[
		[
			66583,
			66583
		],
		"mapped",
		[
			66623
		]
	],
	[
		[
			66584,
			66584
		],
		"mapped",
		[
			66624
		]
	],
	[
		[
			66585,
			66585
		],
		"mapped",
		[
			66625
		]
	],
	[
		[
			66586,
			66586
		],
		"mapped",
		[
			66626
		]
	],
	[
		[
			66587,
			66587
		],
		"mapped",
		[
			66627
		]
	],
	[
		[
			66588,
			66588
		],
		"mapped",
		[
			66628
		]
	],
	[
		[
			66589,
			66589
		],
		"mapped",
		[
			66629
		]
	],
	[
		[
			66590,
			66590
		],
		"mapped",
		[
			66630
		]
	],
	[
		[
			66591,
			66591
		],
		"mapped",
		[
			66631
		]
	],
	[
		[
			66592,
			66592
		],
		"mapped",
		[
			66632
		]
	],
	[
		[
			66593,
			66593
		],
		"mapped",
		[
			66633
		]
	],
	[
		[
			66594,
			66594
		],
		"mapped",
		[
			66634
		]
	],
	[
		[
			66595,
			66595
		],
		"mapped",
		[
			66635
		]
	],
	[
		[
			66596,
			66596
		],
		"mapped",
		[
			66636
		]
	],
	[
		[
			66597,
			66597
		],
		"mapped",
		[
			66637
		]
	],
	[
		[
			66598,
			66598
		],
		"mapped",
		[
			66638
		]
	],
	[
		[
			66599,
			66599
		],
		"mapped",
		[
			66639
		]
	],
	[
		[
			66600,
			66637
		],
		"valid"
	],
	[
		[
			66638,
			66717
		],
		"valid"
	],
	[
		[
			66718,
			66719
		],
		"disallowed"
	],
	[
		[
			66720,
			66729
		],
		"valid"
	],
	[
		[
			66730,
			66815
		],
		"disallowed"
	],
	[
		[
			66816,
			66855
		],
		"valid"
	],
	[
		[
			66856,
			66863
		],
		"disallowed"
	],
	[
		[
			66864,
			66915
		],
		"valid"
	],
	[
		[
			66916,
			66926
		],
		"disallowed"
	],
	[
		[
			66927,
			66927
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			66928,
			67071
		],
		"disallowed"
	],
	[
		[
			67072,
			67382
		],
		"valid"
	],
	[
		[
			67383,
			67391
		],
		"disallowed"
	],
	[
		[
			67392,
			67413
		],
		"valid"
	],
	[
		[
			67414,
			67423
		],
		"disallowed"
	],
	[
		[
			67424,
			67431
		],
		"valid"
	],
	[
		[
			67432,
			67583
		],
		"disallowed"
	],
	[
		[
			67584,
			67589
		],
		"valid"
	],
	[
		[
			67590,
			67591
		],
		"disallowed"
	],
	[
		[
			67592,
			67592
		],
		"valid"
	],
	[
		[
			67593,
			67593
		],
		"disallowed"
	],
	[
		[
			67594,
			67637
		],
		"valid"
	],
	[
		[
			67638,
			67638
		],
		"disallowed"
	],
	[
		[
			67639,
			67640
		],
		"valid"
	],
	[
		[
			67641,
			67643
		],
		"disallowed"
	],
	[
		[
			67644,
			67644
		],
		"valid"
	],
	[
		[
			67645,
			67646
		],
		"disallowed"
	],
	[
		[
			67647,
			67647
		],
		"valid"
	],
	[
		[
			67648,
			67669
		],
		"valid"
	],
	[
		[
			67670,
			67670
		],
		"disallowed"
	],
	[
		[
			67671,
			67679
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			67680,
			67702
		],
		"valid"
	],
	[
		[
			67703,
			67711
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			67712,
			67742
		],
		"valid"
	],
	[
		[
			67743,
			67750
		],
		"disallowed"
	],
	[
		[
			67751,
			67759
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			67760,
			67807
		],
		"disallowed"
	],
	[
		[
			67808,
			67826
		],
		"valid"
	],
	[
		[
			67827,
			67827
		],
		"disallowed"
	],
	[
		[
			67828,
			67829
		],
		"valid"
	],
	[
		[
			67830,
			67834
		],
		"disallowed"
	],
	[
		[
			67835,
			67839
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			67840,
			67861
		],
		"valid"
	],
	[
		[
			67862,
			67865
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			67866,
			67867
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			67868,
			67870
		],
		"disallowed"
	],
	[
		[
			67871,
			67871
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			67872,
			67897
		],
		"valid"
	],
	[
		[
			67898,
			67902
		],
		"disallowed"
	],
	[
		[
			67903,
			67903
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			67904,
			67967
		],
		"disallowed"
	],
	[
		[
			67968,
			68023
		],
		"valid"
	],
	[
		[
			68024,
			68027
		],
		"disallowed"
	],
	[
		[
			68028,
			68029
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68030,
			68031
		],
		"valid"
	],
	[
		[
			68032,
			68047
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68048,
			68049
		],
		"disallowed"
	],
	[
		[
			68050,
			68095
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68096,
			68099
		],
		"valid"
	],
	[
		[
			68100,
			68100
		],
		"disallowed"
	],
	[
		[
			68101,
			68102
		],
		"valid"
	],
	[
		[
			68103,
			68107
		],
		"disallowed"
	],
	[
		[
			68108,
			68115
		],
		"valid"
	],
	[
		[
			68116,
			68116
		],
		"disallowed"
	],
	[
		[
			68117,
			68119
		],
		"valid"
	],
	[
		[
			68120,
			68120
		],
		"disallowed"
	],
	[
		[
			68121,
			68147
		],
		"valid"
	],
	[
		[
			68148,
			68151
		],
		"disallowed"
	],
	[
		[
			68152,
			68154
		],
		"valid"
	],
	[
		[
			68155,
			68158
		],
		"disallowed"
	],
	[
		[
			68159,
			68159
		],
		"valid"
	],
	[
		[
			68160,
			68167
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68168,
			68175
		],
		"disallowed"
	],
	[
		[
			68176,
			68184
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68185,
			68191
		],
		"disallowed"
	],
	[
		[
			68192,
			68220
		],
		"valid"
	],
	[
		[
			68221,
			68223
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68224,
			68252
		],
		"valid"
	],
	[
		[
			68253,
			68255
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68256,
			68287
		],
		"disallowed"
	],
	[
		[
			68288,
			68295
		],
		"valid"
	],
	[
		[
			68296,
			68296
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68297,
			68326
		],
		"valid"
	],
	[
		[
			68327,
			68330
		],
		"disallowed"
	],
	[
		[
			68331,
			68342
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68343,
			68351
		],
		"disallowed"
	],
	[
		[
			68352,
			68405
		],
		"valid"
	],
	[
		[
			68406,
			68408
		],
		"disallowed"
	],
	[
		[
			68409,
			68415
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68416,
			68437
		],
		"valid"
	],
	[
		[
			68438,
			68439
		],
		"disallowed"
	],
	[
		[
			68440,
			68447
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68448,
			68466
		],
		"valid"
	],
	[
		[
			68467,
			68471
		],
		"disallowed"
	],
	[
		[
			68472,
			68479
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68480,
			68497
		],
		"valid"
	],
	[
		[
			68498,
			68504
		],
		"disallowed"
	],
	[
		[
			68505,
			68508
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68509,
			68520
		],
		"disallowed"
	],
	[
		[
			68521,
			68527
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68528,
			68607
		],
		"disallowed"
	],
	[
		[
			68608,
			68680
		],
		"valid"
	],
	[
		[
			68681,
			68735
		],
		"disallowed"
	],
	[
		[
			68736,
			68736
		],
		"mapped",
		[
			68800
		]
	],
	[
		[
			68737,
			68737
		],
		"mapped",
		[
			68801
		]
	],
	[
		[
			68738,
			68738
		],
		"mapped",
		[
			68802
		]
	],
	[
		[
			68739,
			68739
		],
		"mapped",
		[
			68803
		]
	],
	[
		[
			68740,
			68740
		],
		"mapped",
		[
			68804
		]
	],
	[
		[
			68741,
			68741
		],
		"mapped",
		[
			68805
		]
	],
	[
		[
			68742,
			68742
		],
		"mapped",
		[
			68806
		]
	],
	[
		[
			68743,
			68743
		],
		"mapped",
		[
			68807
		]
	],
	[
		[
			68744,
			68744
		],
		"mapped",
		[
			68808
		]
	],
	[
		[
			68745,
			68745
		],
		"mapped",
		[
			68809
		]
	],
	[
		[
			68746,
			68746
		],
		"mapped",
		[
			68810
		]
	],
	[
		[
			68747,
			68747
		],
		"mapped",
		[
			68811
		]
	],
	[
		[
			68748,
			68748
		],
		"mapped",
		[
			68812
		]
	],
	[
		[
			68749,
			68749
		],
		"mapped",
		[
			68813
		]
	],
	[
		[
			68750,
			68750
		],
		"mapped",
		[
			68814
		]
	],
	[
		[
			68751,
			68751
		],
		"mapped",
		[
			68815
		]
	],
	[
		[
			68752,
			68752
		],
		"mapped",
		[
			68816
		]
	],
	[
		[
			68753,
			68753
		],
		"mapped",
		[
			68817
		]
	],
	[
		[
			68754,
			68754
		],
		"mapped",
		[
			68818
		]
	],
	[
		[
			68755,
			68755
		],
		"mapped",
		[
			68819
		]
	],
	[
		[
			68756,
			68756
		],
		"mapped",
		[
			68820
		]
	],
	[
		[
			68757,
			68757
		],
		"mapped",
		[
			68821
		]
	],
	[
		[
			68758,
			68758
		],
		"mapped",
		[
			68822
		]
	],
	[
		[
			68759,
			68759
		],
		"mapped",
		[
			68823
		]
	],
	[
		[
			68760,
			68760
		],
		"mapped",
		[
			68824
		]
	],
	[
		[
			68761,
			68761
		],
		"mapped",
		[
			68825
		]
	],
	[
		[
			68762,
			68762
		],
		"mapped",
		[
			68826
		]
	],
	[
		[
			68763,
			68763
		],
		"mapped",
		[
			68827
		]
	],
	[
		[
			68764,
			68764
		],
		"mapped",
		[
			68828
		]
	],
	[
		[
			68765,
			68765
		],
		"mapped",
		[
			68829
		]
	],
	[
		[
			68766,
			68766
		],
		"mapped",
		[
			68830
		]
	],
	[
		[
			68767,
			68767
		],
		"mapped",
		[
			68831
		]
	],
	[
		[
			68768,
			68768
		],
		"mapped",
		[
			68832
		]
	],
	[
		[
			68769,
			68769
		],
		"mapped",
		[
			68833
		]
	],
	[
		[
			68770,
			68770
		],
		"mapped",
		[
			68834
		]
	],
	[
		[
			68771,
			68771
		],
		"mapped",
		[
			68835
		]
	],
	[
		[
			68772,
			68772
		],
		"mapped",
		[
			68836
		]
	],
	[
		[
			68773,
			68773
		],
		"mapped",
		[
			68837
		]
	],
	[
		[
			68774,
			68774
		],
		"mapped",
		[
			68838
		]
	],
	[
		[
			68775,
			68775
		],
		"mapped",
		[
			68839
		]
	],
	[
		[
			68776,
			68776
		],
		"mapped",
		[
			68840
		]
	],
	[
		[
			68777,
			68777
		],
		"mapped",
		[
			68841
		]
	],
	[
		[
			68778,
			68778
		],
		"mapped",
		[
			68842
		]
	],
	[
		[
			68779,
			68779
		],
		"mapped",
		[
			68843
		]
	],
	[
		[
			68780,
			68780
		],
		"mapped",
		[
			68844
		]
	],
	[
		[
			68781,
			68781
		],
		"mapped",
		[
			68845
		]
	],
	[
		[
			68782,
			68782
		],
		"mapped",
		[
			68846
		]
	],
	[
		[
			68783,
			68783
		],
		"mapped",
		[
			68847
		]
	],
	[
		[
			68784,
			68784
		],
		"mapped",
		[
			68848
		]
	],
	[
		[
			68785,
			68785
		],
		"mapped",
		[
			68849
		]
	],
	[
		[
			68786,
			68786
		],
		"mapped",
		[
			68850
		]
	],
	[
		[
			68787,
			68799
		],
		"disallowed"
	],
	[
		[
			68800,
			68850
		],
		"valid"
	],
	[
		[
			68851,
			68857
		],
		"disallowed"
	],
	[
		[
			68858,
			68863
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			68864,
			69215
		],
		"disallowed"
	],
	[
		[
			69216,
			69246
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			69247,
			69631
		],
		"disallowed"
	],
	[
		[
			69632,
			69702
		],
		"valid"
	],
	[
		[
			69703,
			69709
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			69710,
			69713
		],
		"disallowed"
	],
	[
		[
			69714,
			69733
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			69734,
			69743
		],
		"valid"
	],
	[
		[
			69744,
			69758
		],
		"disallowed"
	],
	[
		[
			69759,
			69759
		],
		"valid"
	],
	[
		[
			69760,
			69818
		],
		"valid"
	],
	[
		[
			69819,
			69820
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			69821,
			69821
		],
		"disallowed"
	],
	[
		[
			69822,
			69825
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			69826,
			69839
		],
		"disallowed"
	],
	[
		[
			69840,
			69864
		],
		"valid"
	],
	[
		[
			69865,
			69871
		],
		"disallowed"
	],
	[
		[
			69872,
			69881
		],
		"valid"
	],
	[
		[
			69882,
			69887
		],
		"disallowed"
	],
	[
		[
			69888,
			69940
		],
		"valid"
	],
	[
		[
			69941,
			69941
		],
		"disallowed"
	],
	[
		[
			69942,
			69951
		],
		"valid"
	],
	[
		[
			69952,
			69955
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			69956,
			69967
		],
		"disallowed"
	],
	[
		[
			69968,
			70003
		],
		"valid"
	],
	[
		[
			70004,
			70005
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70006,
			70006
		],
		"valid"
	],
	[
		[
			70007,
			70015
		],
		"disallowed"
	],
	[
		[
			70016,
			70084
		],
		"valid"
	],
	[
		[
			70085,
			70088
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70089,
			70089
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70090,
			70092
		],
		"valid"
	],
	[
		[
			70093,
			70093
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70094,
			70095
		],
		"disallowed"
	],
	[
		[
			70096,
			70105
		],
		"valid"
	],
	[
		[
			70106,
			70106
		],
		"valid"
	],
	[
		[
			70107,
			70107
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70108,
			70108
		],
		"valid"
	],
	[
		[
			70109,
			70111
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70112,
			70112
		],
		"disallowed"
	],
	[
		[
			70113,
			70132
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70133,
			70143
		],
		"disallowed"
	],
	[
		[
			70144,
			70161
		],
		"valid"
	],
	[
		[
			70162,
			70162
		],
		"disallowed"
	],
	[
		[
			70163,
			70199
		],
		"valid"
	],
	[
		[
			70200,
			70205
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70206,
			70271
		],
		"disallowed"
	],
	[
		[
			70272,
			70278
		],
		"valid"
	],
	[
		[
			70279,
			70279
		],
		"disallowed"
	],
	[
		[
			70280,
			70280
		],
		"valid"
	],
	[
		[
			70281,
			70281
		],
		"disallowed"
	],
	[
		[
			70282,
			70285
		],
		"valid"
	],
	[
		[
			70286,
			70286
		],
		"disallowed"
	],
	[
		[
			70287,
			70301
		],
		"valid"
	],
	[
		[
			70302,
			70302
		],
		"disallowed"
	],
	[
		[
			70303,
			70312
		],
		"valid"
	],
	[
		[
			70313,
			70313
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70314,
			70319
		],
		"disallowed"
	],
	[
		[
			70320,
			70378
		],
		"valid"
	],
	[
		[
			70379,
			70383
		],
		"disallowed"
	],
	[
		[
			70384,
			70393
		],
		"valid"
	],
	[
		[
			70394,
			70399
		],
		"disallowed"
	],
	[
		[
			70400,
			70400
		],
		"valid"
	],
	[
		[
			70401,
			70403
		],
		"valid"
	],
	[
		[
			70404,
			70404
		],
		"disallowed"
	],
	[
		[
			70405,
			70412
		],
		"valid"
	],
	[
		[
			70413,
			70414
		],
		"disallowed"
	],
	[
		[
			70415,
			70416
		],
		"valid"
	],
	[
		[
			70417,
			70418
		],
		"disallowed"
	],
	[
		[
			70419,
			70440
		],
		"valid"
	],
	[
		[
			70441,
			70441
		],
		"disallowed"
	],
	[
		[
			70442,
			70448
		],
		"valid"
	],
	[
		[
			70449,
			70449
		],
		"disallowed"
	],
	[
		[
			70450,
			70451
		],
		"valid"
	],
	[
		[
			70452,
			70452
		],
		"disallowed"
	],
	[
		[
			70453,
			70457
		],
		"valid"
	],
	[
		[
			70458,
			70459
		],
		"disallowed"
	],
	[
		[
			70460,
			70468
		],
		"valid"
	],
	[
		[
			70469,
			70470
		],
		"disallowed"
	],
	[
		[
			70471,
			70472
		],
		"valid"
	],
	[
		[
			70473,
			70474
		],
		"disallowed"
	],
	[
		[
			70475,
			70477
		],
		"valid"
	],
	[
		[
			70478,
			70479
		],
		"disallowed"
	],
	[
		[
			70480,
			70480
		],
		"valid"
	],
	[
		[
			70481,
			70486
		],
		"disallowed"
	],
	[
		[
			70487,
			70487
		],
		"valid"
	],
	[
		[
			70488,
			70492
		],
		"disallowed"
	],
	[
		[
			70493,
			70499
		],
		"valid"
	],
	[
		[
			70500,
			70501
		],
		"disallowed"
	],
	[
		[
			70502,
			70508
		],
		"valid"
	],
	[
		[
			70509,
			70511
		],
		"disallowed"
	],
	[
		[
			70512,
			70516
		],
		"valid"
	],
	[
		[
			70517,
			70783
		],
		"disallowed"
	],
	[
		[
			70784,
			70853
		],
		"valid"
	],
	[
		[
			70854,
			70854
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			70855,
			70855
		],
		"valid"
	],
	[
		[
			70856,
			70863
		],
		"disallowed"
	],
	[
		[
			70864,
			70873
		],
		"valid"
	],
	[
		[
			70874,
			71039
		],
		"disallowed"
	],
	[
		[
			71040,
			71093
		],
		"valid"
	],
	[
		[
			71094,
			71095
		],
		"disallowed"
	],
	[
		[
			71096,
			71104
		],
		"valid"
	],
	[
		[
			71105,
			71113
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			71114,
			71127
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			71128,
			71133
		],
		"valid"
	],
	[
		[
			71134,
			71167
		],
		"disallowed"
	],
	[
		[
			71168,
			71232
		],
		"valid"
	],
	[
		[
			71233,
			71235
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			71236,
			71236
		],
		"valid"
	],
	[
		[
			71237,
			71247
		],
		"disallowed"
	],
	[
		[
			71248,
			71257
		],
		"valid"
	],
	[
		[
			71258,
			71295
		],
		"disallowed"
	],
	[
		[
			71296,
			71351
		],
		"valid"
	],
	[
		[
			71352,
			71359
		],
		"disallowed"
	],
	[
		[
			71360,
			71369
		],
		"valid"
	],
	[
		[
			71370,
			71423
		],
		"disallowed"
	],
	[
		[
			71424,
			71449
		],
		"valid"
	],
	[
		[
			71450,
			71452
		],
		"disallowed"
	],
	[
		[
			71453,
			71467
		],
		"valid"
	],
	[
		[
			71468,
			71471
		],
		"disallowed"
	],
	[
		[
			71472,
			71481
		],
		"valid"
	],
	[
		[
			71482,
			71487
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			71488,
			71839
		],
		"disallowed"
	],
	[
		[
			71840,
			71840
		],
		"mapped",
		[
			71872
		]
	],
	[
		[
			71841,
			71841
		],
		"mapped",
		[
			71873
		]
	],
	[
		[
			71842,
			71842
		],
		"mapped",
		[
			71874
		]
	],
	[
		[
			71843,
			71843
		],
		"mapped",
		[
			71875
		]
	],
	[
		[
			71844,
			71844
		],
		"mapped",
		[
			71876
		]
	],
	[
		[
			71845,
			71845
		],
		"mapped",
		[
			71877
		]
	],
	[
		[
			71846,
			71846
		],
		"mapped",
		[
			71878
		]
	],
	[
		[
			71847,
			71847
		],
		"mapped",
		[
			71879
		]
	],
	[
		[
			71848,
			71848
		],
		"mapped",
		[
			71880
		]
	],
	[
		[
			71849,
			71849
		],
		"mapped",
		[
			71881
		]
	],
	[
		[
			71850,
			71850
		],
		"mapped",
		[
			71882
		]
	],
	[
		[
			71851,
			71851
		],
		"mapped",
		[
			71883
		]
	],
	[
		[
			71852,
			71852
		],
		"mapped",
		[
			71884
		]
	],
	[
		[
			71853,
			71853
		],
		"mapped",
		[
			71885
		]
	],
	[
		[
			71854,
			71854
		],
		"mapped",
		[
			71886
		]
	],
	[
		[
			71855,
			71855
		],
		"mapped",
		[
			71887
		]
	],
	[
		[
			71856,
			71856
		],
		"mapped",
		[
			71888
		]
	],
	[
		[
			71857,
			71857
		],
		"mapped",
		[
			71889
		]
	],
	[
		[
			71858,
			71858
		],
		"mapped",
		[
			71890
		]
	],
	[
		[
			71859,
			71859
		],
		"mapped",
		[
			71891
		]
	],
	[
		[
			71860,
			71860
		],
		"mapped",
		[
			71892
		]
	],
	[
		[
			71861,
			71861
		],
		"mapped",
		[
			71893
		]
	],
	[
		[
			71862,
			71862
		],
		"mapped",
		[
			71894
		]
	],
	[
		[
			71863,
			71863
		],
		"mapped",
		[
			71895
		]
	],
	[
		[
			71864,
			71864
		],
		"mapped",
		[
			71896
		]
	],
	[
		[
			71865,
			71865
		],
		"mapped",
		[
			71897
		]
	],
	[
		[
			71866,
			71866
		],
		"mapped",
		[
			71898
		]
	],
	[
		[
			71867,
			71867
		],
		"mapped",
		[
			71899
		]
	],
	[
		[
			71868,
			71868
		],
		"mapped",
		[
			71900
		]
	],
	[
		[
			71869,
			71869
		],
		"mapped",
		[
			71901
		]
	],
	[
		[
			71870,
			71870
		],
		"mapped",
		[
			71902
		]
	],
	[
		[
			71871,
			71871
		],
		"mapped",
		[
			71903
		]
	],
	[
		[
			71872,
			71913
		],
		"valid"
	],
	[
		[
			71914,
			71922
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			71923,
			71934
		],
		"disallowed"
	],
	[
		[
			71935,
			71935
		],
		"valid"
	],
	[
		[
			71936,
			72383
		],
		"disallowed"
	],
	[
		[
			72384,
			72440
		],
		"valid"
	],
	[
		[
			72441,
			73727
		],
		"disallowed"
	],
	[
		[
			73728,
			74606
		],
		"valid"
	],
	[
		[
			74607,
			74648
		],
		"valid"
	],
	[
		[
			74649,
			74649
		],
		"valid"
	],
	[
		[
			74650,
			74751
		],
		"disallowed"
	],
	[
		[
			74752,
			74850
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			74851,
			74862
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			74863,
			74863
		],
		"disallowed"
	],
	[
		[
			74864,
			74867
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			74868,
			74868
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			74869,
			74879
		],
		"disallowed"
	],
	[
		[
			74880,
			75075
		],
		"valid"
	],
	[
		[
			75076,
			77823
		],
		"disallowed"
	],
	[
		[
			77824,
			78894
		],
		"valid"
	],
	[
		[
			78895,
			82943
		],
		"disallowed"
	],
	[
		[
			82944,
			83526
		],
		"valid"
	],
	[
		[
			83527,
			92159
		],
		"disallowed"
	],
	[
		[
			92160,
			92728
		],
		"valid"
	],
	[
		[
			92729,
			92735
		],
		"disallowed"
	],
	[
		[
			92736,
			92766
		],
		"valid"
	],
	[
		[
			92767,
			92767
		],
		"disallowed"
	],
	[
		[
			92768,
			92777
		],
		"valid"
	],
	[
		[
			92778,
			92781
		],
		"disallowed"
	],
	[
		[
			92782,
			92783
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			92784,
			92879
		],
		"disallowed"
	],
	[
		[
			92880,
			92909
		],
		"valid"
	],
	[
		[
			92910,
			92911
		],
		"disallowed"
	],
	[
		[
			92912,
			92916
		],
		"valid"
	],
	[
		[
			92917,
			92917
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			92918,
			92927
		],
		"disallowed"
	],
	[
		[
			92928,
			92982
		],
		"valid"
	],
	[
		[
			92983,
			92991
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			92992,
			92995
		],
		"valid"
	],
	[
		[
			92996,
			92997
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			92998,
			93007
		],
		"disallowed"
	],
	[
		[
			93008,
			93017
		],
		"valid"
	],
	[
		[
			93018,
			93018
		],
		"disallowed"
	],
	[
		[
			93019,
			93025
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			93026,
			93026
		],
		"disallowed"
	],
	[
		[
			93027,
			93047
		],
		"valid"
	],
	[
		[
			93048,
			93052
		],
		"disallowed"
	],
	[
		[
			93053,
			93071
		],
		"valid"
	],
	[
		[
			93072,
			93951
		],
		"disallowed"
	],
	[
		[
			93952,
			94020
		],
		"valid"
	],
	[
		[
			94021,
			94031
		],
		"disallowed"
	],
	[
		[
			94032,
			94078
		],
		"valid"
	],
	[
		[
			94079,
			94094
		],
		"disallowed"
	],
	[
		[
			94095,
			94111
		],
		"valid"
	],
	[
		[
			94112,
			110591
		],
		"disallowed"
	],
	[
		[
			110592,
			110593
		],
		"valid"
	],
	[
		[
			110594,
			113663
		],
		"disallowed"
	],
	[
		[
			113664,
			113770
		],
		"valid"
	],
	[
		[
			113771,
			113775
		],
		"disallowed"
	],
	[
		[
			113776,
			113788
		],
		"valid"
	],
	[
		[
			113789,
			113791
		],
		"disallowed"
	],
	[
		[
			113792,
			113800
		],
		"valid"
	],
	[
		[
			113801,
			113807
		],
		"disallowed"
	],
	[
		[
			113808,
			113817
		],
		"valid"
	],
	[
		[
			113818,
			113819
		],
		"disallowed"
	],
	[
		[
			113820,
			113820
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			113821,
			113822
		],
		"valid"
	],
	[
		[
			113823,
			113823
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			113824,
			113827
		],
		"ignored"
	],
	[
		[
			113828,
			118783
		],
		"disallowed"
	],
	[
		[
			118784,
			119029
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119030,
			119039
		],
		"disallowed"
	],
	[
		[
			119040,
			119078
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119079,
			119080
		],
		"disallowed"
	],
	[
		[
			119081,
			119081
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119082,
			119133
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119134,
			119134
		],
		"mapped",
		[
			119127,
			119141
		]
	],
	[
		[
			119135,
			119135
		],
		"mapped",
		[
			119128,
			119141
		]
	],
	[
		[
			119136,
			119136
		],
		"mapped",
		[
			119128,
			119141,
			119150
		]
	],
	[
		[
			119137,
			119137
		],
		"mapped",
		[
			119128,
			119141,
			119151
		]
	],
	[
		[
			119138,
			119138
		],
		"mapped",
		[
			119128,
			119141,
			119152
		]
	],
	[
		[
			119139,
			119139
		],
		"mapped",
		[
			119128,
			119141,
			119153
		]
	],
	[
		[
			119140,
			119140
		],
		"mapped",
		[
			119128,
			119141,
			119154
		]
	],
	[
		[
			119141,
			119154
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119155,
			119162
		],
		"disallowed"
	],
	[
		[
			119163,
			119226
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119227,
			119227
		],
		"mapped",
		[
			119225,
			119141
		]
	],
	[
		[
			119228,
			119228
		],
		"mapped",
		[
			119226,
			119141
		]
	],
	[
		[
			119229,
			119229
		],
		"mapped",
		[
			119225,
			119141,
			119150
		]
	],
	[
		[
			119230,
			119230
		],
		"mapped",
		[
			119226,
			119141,
			119150
		]
	],
	[
		[
			119231,
			119231
		],
		"mapped",
		[
			119225,
			119141,
			119151
		]
	],
	[
		[
			119232,
			119232
		],
		"mapped",
		[
			119226,
			119141,
			119151
		]
	],
	[
		[
			119233,
			119261
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119262,
			119272
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119273,
			119295
		],
		"disallowed"
	],
	[
		[
			119296,
			119365
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119366,
			119551
		],
		"disallowed"
	],
	[
		[
			119552,
			119638
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119639,
			119647
		],
		"disallowed"
	],
	[
		[
			119648,
			119665
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			119666,
			119807
		],
		"disallowed"
	],
	[
		[
			119808,
			119808
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			119809,
			119809
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			119810,
			119810
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			119811,
			119811
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			119812,
			119812
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			119813,
			119813
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			119814,
			119814
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			119815,
			119815
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			119816,
			119816
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			119817,
			119817
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			119818,
			119818
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			119819,
			119819
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			119820,
			119820
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			119821,
			119821
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			119822,
			119822
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			119823,
			119823
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			119824,
			119824
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			119825,
			119825
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			119826,
			119826
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			119827,
			119827
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			119828,
			119828
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			119829,
			119829
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			119830,
			119830
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			119831,
			119831
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			119832,
			119832
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			119833,
			119833
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			119834,
			119834
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			119835,
			119835
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			119836,
			119836
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			119837,
			119837
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			119838,
			119838
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			119839,
			119839
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			119840,
			119840
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			119841,
			119841
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			119842,
			119842
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			119843,
			119843
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			119844,
			119844
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			119845,
			119845
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			119846,
			119846
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			119847,
			119847
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			119848,
			119848
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			119849,
			119849
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			119850,
			119850
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			119851,
			119851
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			119852,
			119852
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			119853,
			119853
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			119854,
			119854
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			119855,
			119855
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			119856,
			119856
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			119857,
			119857
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			119858,
			119858
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			119859,
			119859
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			119860,
			119860
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			119861,
			119861
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			119862,
			119862
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			119863,
			119863
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			119864,
			119864
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			119865,
			119865
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			119866,
			119866
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			119867,
			119867
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			119868,
			119868
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			119869,
			119869
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			119870,
			119870
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			119871,
			119871
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			119872,
			119872
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			119873,
			119873
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			119874,
			119874
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			119875,
			119875
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			119876,
			119876
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			119877,
			119877
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			119878,
			119878
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			119879,
			119879
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			119880,
			119880
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			119881,
			119881
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			119882,
			119882
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			119883,
			119883
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			119884,
			119884
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			119885,
			119885
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			119886,
			119886
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			119887,
			119887
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			119888,
			119888
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			119889,
			119889
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			119890,
			119890
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			119891,
			119891
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			119892,
			119892
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			119893,
			119893
		],
		"disallowed"
	],
	[
		[
			119894,
			119894
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			119895,
			119895
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			119896,
			119896
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			119897,
			119897
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			119898,
			119898
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			119899,
			119899
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			119900,
			119900
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			119901,
			119901
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			119902,
			119902
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			119903,
			119903
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			119904,
			119904
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			119905,
			119905
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			119906,
			119906
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			119907,
			119907
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			119908,
			119908
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			119909,
			119909
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			119910,
			119910
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			119911,
			119911
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			119912,
			119912
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			119913,
			119913
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			119914,
			119914
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			119915,
			119915
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			119916,
			119916
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			119917,
			119917
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			119918,
			119918
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			119919,
			119919
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			119920,
			119920
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			119921,
			119921
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			119922,
			119922
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			119923,
			119923
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			119924,
			119924
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			119925,
			119925
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			119926,
			119926
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			119927,
			119927
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			119928,
			119928
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			119929,
			119929
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			119930,
			119930
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			119931,
			119931
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			119932,
			119932
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			119933,
			119933
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			119934,
			119934
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			119935,
			119935
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			119936,
			119936
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			119937,
			119937
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			119938,
			119938
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			119939,
			119939
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			119940,
			119940
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			119941,
			119941
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			119942,
			119942
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			119943,
			119943
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			119944,
			119944
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			119945,
			119945
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			119946,
			119946
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			119947,
			119947
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			119948,
			119948
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			119949,
			119949
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			119950,
			119950
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			119951,
			119951
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			119952,
			119952
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			119953,
			119953
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			119954,
			119954
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			119955,
			119955
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			119956,
			119956
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			119957,
			119957
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			119958,
			119958
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			119959,
			119959
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			119960,
			119960
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			119961,
			119961
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			119962,
			119962
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			119963,
			119963
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			119964,
			119964
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			119965,
			119965
		],
		"disallowed"
	],
	[
		[
			119966,
			119966
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			119967,
			119967
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			119968,
			119969
		],
		"disallowed"
	],
	[
		[
			119970,
			119970
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			119971,
			119972
		],
		"disallowed"
	],
	[
		[
			119973,
			119973
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			119974,
			119974
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			119975,
			119976
		],
		"disallowed"
	],
	[
		[
			119977,
			119977
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			119978,
			119978
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			119979,
			119979
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			119980,
			119980
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			119981,
			119981
		],
		"disallowed"
	],
	[
		[
			119982,
			119982
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			119983,
			119983
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			119984,
			119984
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			119985,
			119985
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			119986,
			119986
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			119987,
			119987
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			119988,
			119988
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			119989,
			119989
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			119990,
			119990
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			119991,
			119991
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			119992,
			119992
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			119993,
			119993
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			119994,
			119994
		],
		"disallowed"
	],
	[
		[
			119995,
			119995
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			119996,
			119996
		],
		"disallowed"
	],
	[
		[
			119997,
			119997
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			119998,
			119998
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			119999,
			119999
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120000,
			120000
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120001,
			120001
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120002,
			120002
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120003,
			120003
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120004,
			120004
		],
		"disallowed"
	],
	[
		[
			120005,
			120005
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120006,
			120006
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120007,
			120007
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120008,
			120008
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120009,
			120009
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120010,
			120010
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120011,
			120011
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120012,
			120012
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120013,
			120013
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120014,
			120014
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120015,
			120015
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120016,
			120016
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120017,
			120017
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120018,
			120018
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120019,
			120019
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120020,
			120020
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120021,
			120021
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120022,
			120022
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120023,
			120023
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120024,
			120024
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120025,
			120025
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120026,
			120026
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120027,
			120027
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120028,
			120028
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120029,
			120029
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120030,
			120030
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120031,
			120031
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120032,
			120032
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120033,
			120033
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120034,
			120034
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120035,
			120035
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120036,
			120036
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120037,
			120037
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120038,
			120038
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120039,
			120039
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120040,
			120040
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120041,
			120041
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120042,
			120042
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120043,
			120043
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120044,
			120044
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120045,
			120045
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120046,
			120046
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120047,
			120047
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120048,
			120048
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120049,
			120049
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120050,
			120050
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120051,
			120051
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120052,
			120052
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120053,
			120053
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120054,
			120054
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120055,
			120055
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120056,
			120056
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120057,
			120057
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120058,
			120058
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120059,
			120059
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120060,
			120060
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120061,
			120061
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120062,
			120062
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120063,
			120063
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120064,
			120064
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120065,
			120065
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120066,
			120066
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120067,
			120067
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120068,
			120068
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120069,
			120069
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120070,
			120070
		],
		"disallowed"
	],
	[
		[
			120071,
			120071
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120072,
			120072
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120073,
			120073
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120074,
			120074
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120075,
			120076
		],
		"disallowed"
	],
	[
		[
			120077,
			120077
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120078,
			120078
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120079,
			120079
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120080,
			120080
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120081,
			120081
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120082,
			120082
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120083,
			120083
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120084,
			120084
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120085,
			120085
		],
		"disallowed"
	],
	[
		[
			120086,
			120086
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120087,
			120087
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120088,
			120088
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120089,
			120089
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120090,
			120090
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120091,
			120091
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120092,
			120092
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120093,
			120093
		],
		"disallowed"
	],
	[
		[
			120094,
			120094
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120095,
			120095
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120096,
			120096
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120097,
			120097
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120098,
			120098
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120099,
			120099
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120100,
			120100
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120101,
			120101
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120102,
			120102
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120103,
			120103
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120104,
			120104
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120105,
			120105
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120106,
			120106
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120107,
			120107
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120108,
			120108
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120109,
			120109
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120110,
			120110
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120111,
			120111
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120112,
			120112
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120113,
			120113
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120114,
			120114
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120115,
			120115
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120116,
			120116
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120117,
			120117
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120118,
			120118
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120119,
			120119
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120120,
			120120
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120121,
			120121
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120122,
			120122
		],
		"disallowed"
	],
	[
		[
			120123,
			120123
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120124,
			120124
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120125,
			120125
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120126,
			120126
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120127,
			120127
		],
		"disallowed"
	],
	[
		[
			120128,
			120128
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120129,
			120129
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120130,
			120130
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120131,
			120131
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120132,
			120132
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120133,
			120133
		],
		"disallowed"
	],
	[
		[
			120134,
			120134
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120135,
			120137
		],
		"disallowed"
	],
	[
		[
			120138,
			120138
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120139,
			120139
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120140,
			120140
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120141,
			120141
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120142,
			120142
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120143,
			120143
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120144,
			120144
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120145,
			120145
		],
		"disallowed"
	],
	[
		[
			120146,
			120146
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120147,
			120147
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120148,
			120148
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120149,
			120149
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120150,
			120150
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120151,
			120151
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120152,
			120152
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120153,
			120153
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120154,
			120154
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120155,
			120155
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120156,
			120156
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120157,
			120157
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120158,
			120158
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120159,
			120159
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120160,
			120160
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120161,
			120161
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120162,
			120162
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120163,
			120163
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120164,
			120164
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120165,
			120165
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120166,
			120166
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120167,
			120167
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120168,
			120168
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120169,
			120169
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120170,
			120170
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120171,
			120171
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120172,
			120172
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120173,
			120173
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120174,
			120174
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120175,
			120175
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120176,
			120176
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120177,
			120177
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120178,
			120178
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120179,
			120179
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120180,
			120180
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120181,
			120181
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120182,
			120182
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120183,
			120183
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120184,
			120184
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120185,
			120185
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120186,
			120186
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120187,
			120187
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120188,
			120188
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120189,
			120189
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120190,
			120190
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120191,
			120191
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120192,
			120192
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120193,
			120193
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120194,
			120194
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120195,
			120195
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120196,
			120196
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120197,
			120197
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120198,
			120198
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120199,
			120199
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120200,
			120200
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120201,
			120201
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120202,
			120202
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120203,
			120203
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120204,
			120204
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120205,
			120205
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120206,
			120206
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120207,
			120207
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120208,
			120208
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120209,
			120209
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120210,
			120210
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120211,
			120211
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120212,
			120212
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120213,
			120213
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120214,
			120214
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120215,
			120215
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120216,
			120216
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120217,
			120217
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120218,
			120218
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120219,
			120219
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120220,
			120220
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120221,
			120221
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120222,
			120222
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120223,
			120223
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120224,
			120224
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120225,
			120225
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120226,
			120226
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120227,
			120227
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120228,
			120228
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120229,
			120229
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120230,
			120230
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120231,
			120231
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120232,
			120232
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120233,
			120233
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120234,
			120234
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120235,
			120235
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120236,
			120236
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120237,
			120237
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120238,
			120238
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120239,
			120239
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120240,
			120240
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120241,
			120241
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120242,
			120242
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120243,
			120243
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120244,
			120244
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120245,
			120245
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120246,
			120246
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120247,
			120247
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120248,
			120248
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120249,
			120249
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120250,
			120250
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120251,
			120251
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120252,
			120252
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120253,
			120253
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120254,
			120254
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120255,
			120255
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120256,
			120256
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120257,
			120257
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120258,
			120258
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120259,
			120259
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120260,
			120260
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120261,
			120261
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120262,
			120262
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120263,
			120263
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120264,
			120264
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120265,
			120265
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120266,
			120266
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120267,
			120267
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120268,
			120268
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120269,
			120269
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120270,
			120270
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120271,
			120271
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120272,
			120272
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120273,
			120273
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120274,
			120274
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120275,
			120275
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120276,
			120276
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120277,
			120277
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120278,
			120278
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120279,
			120279
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120280,
			120280
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120281,
			120281
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120282,
			120282
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120283,
			120283
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120284,
			120284
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120285,
			120285
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120286,
			120286
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120287,
			120287
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120288,
			120288
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120289,
			120289
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120290,
			120290
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120291,
			120291
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120292,
			120292
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120293,
			120293
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120294,
			120294
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120295,
			120295
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120296,
			120296
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120297,
			120297
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120298,
			120298
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120299,
			120299
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120300,
			120300
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120301,
			120301
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120302,
			120302
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120303,
			120303
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120304,
			120304
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120305,
			120305
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120306,
			120306
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120307,
			120307
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120308,
			120308
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120309,
			120309
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120310,
			120310
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120311,
			120311
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120312,
			120312
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120313,
			120313
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120314,
			120314
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120315,
			120315
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120316,
			120316
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120317,
			120317
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120318,
			120318
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120319,
			120319
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120320,
			120320
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120321,
			120321
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120322,
			120322
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120323,
			120323
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120324,
			120324
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120325,
			120325
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120326,
			120326
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120327,
			120327
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120328,
			120328
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120329,
			120329
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120330,
			120330
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120331,
			120331
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120332,
			120332
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120333,
			120333
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120334,
			120334
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120335,
			120335
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120336,
			120336
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120337,
			120337
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120338,
			120338
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120339,
			120339
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120340,
			120340
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120341,
			120341
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120342,
			120342
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120343,
			120343
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120344,
			120344
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120345,
			120345
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120346,
			120346
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120347,
			120347
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120348,
			120348
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120349,
			120349
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120350,
			120350
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120351,
			120351
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120352,
			120352
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120353,
			120353
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120354,
			120354
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120355,
			120355
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120356,
			120356
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120357,
			120357
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120358,
			120358
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120359,
			120359
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120360,
			120360
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120361,
			120361
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120362,
			120362
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120363,
			120363
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120364,
			120364
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120365,
			120365
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120366,
			120366
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120367,
			120367
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120368,
			120368
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120369,
			120369
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120370,
			120370
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120371,
			120371
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120372,
			120372
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120373,
			120373
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120374,
			120374
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120375,
			120375
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120376,
			120376
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120377,
			120377
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120378,
			120378
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120379,
			120379
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120380,
			120380
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120381,
			120381
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120382,
			120382
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120383,
			120383
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120384,
			120384
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120385,
			120385
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120386,
			120386
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120387,
			120387
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120388,
			120388
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120389,
			120389
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120390,
			120390
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120391,
			120391
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120392,
			120392
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120393,
			120393
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120394,
			120394
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120395,
			120395
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120396,
			120396
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120397,
			120397
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120398,
			120398
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120399,
			120399
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120400,
			120400
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120401,
			120401
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120402,
			120402
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120403,
			120403
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120404,
			120404
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120405,
			120405
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120406,
			120406
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120407,
			120407
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120408,
			120408
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120409,
			120409
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120410,
			120410
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120411,
			120411
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120412,
			120412
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120413,
			120413
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120414,
			120414
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120415,
			120415
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120416,
			120416
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120417,
			120417
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120418,
			120418
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120419,
			120419
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120420,
			120420
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120421,
			120421
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120422,
			120422
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120423,
			120423
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120424,
			120424
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120425,
			120425
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120426,
			120426
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120427,
			120427
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120428,
			120428
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120429,
			120429
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120430,
			120430
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120431,
			120431
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120432,
			120432
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120433,
			120433
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120434,
			120434
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120435,
			120435
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120436,
			120436
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120437,
			120437
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120438,
			120438
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120439,
			120439
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120440,
			120440
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120441,
			120441
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120442,
			120442
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120443,
			120443
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120444,
			120444
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120445,
			120445
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120446,
			120446
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120447,
			120447
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120448,
			120448
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120449,
			120449
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120450,
			120450
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120451,
			120451
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120452,
			120452
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120453,
			120453
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120454,
			120454
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120455,
			120455
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120456,
			120456
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120457,
			120457
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120458,
			120458
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			120459,
			120459
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			120460,
			120460
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			120461,
			120461
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			120462,
			120462
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			120463,
			120463
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			120464,
			120464
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			120465,
			120465
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			120466,
			120466
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			120467,
			120467
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			120468,
			120468
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			120469,
			120469
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			120470,
			120470
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			120471,
			120471
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			120472,
			120472
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			120473,
			120473
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			120474,
			120474
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			120475,
			120475
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			120476,
			120476
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			120477,
			120477
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			120478,
			120478
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			120479,
			120479
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			120480,
			120480
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			120481,
			120481
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			120482,
			120482
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			120483,
			120483
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			120484,
			120484
		],
		"mapped",
		[
			305
		]
	],
	[
		[
			120485,
			120485
		],
		"mapped",
		[
			567
		]
	],
	[
		[
			120486,
			120487
		],
		"disallowed"
	],
	[
		[
			120488,
			120488
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120489,
			120489
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120490,
			120490
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120491,
			120491
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120492,
			120492
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120493,
			120493
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120494,
			120494
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120495,
			120495
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120496,
			120496
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120497,
			120497
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120498,
			120498
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120499,
			120499
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120500,
			120500
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120501,
			120501
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120502,
			120502
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120503,
			120503
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120504,
			120504
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120505,
			120505
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120506,
			120506
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120507,
			120507
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120508,
			120508
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120509,
			120509
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120510,
			120510
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120511,
			120511
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120512,
			120512
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120513,
			120513
		],
		"mapped",
		[
			8711
		]
	],
	[
		[
			120514,
			120514
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120515,
			120515
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120516,
			120516
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120517,
			120517
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120518,
			120518
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120519,
			120519
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120520,
			120520
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120521,
			120521
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120522,
			120522
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120523,
			120523
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120524,
			120524
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120525,
			120525
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120526,
			120526
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120527,
			120527
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120528,
			120528
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120529,
			120529
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120530,
			120530
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120531,
			120532
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120533,
			120533
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120534,
			120534
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120535,
			120535
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120536,
			120536
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120537,
			120537
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120538,
			120538
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120539,
			120539
		],
		"mapped",
		[
			8706
		]
	],
	[
		[
			120540,
			120540
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120541,
			120541
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120542,
			120542
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120543,
			120543
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120544,
			120544
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120545,
			120545
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120546,
			120546
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120547,
			120547
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120548,
			120548
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120549,
			120549
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120550,
			120550
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120551,
			120551
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120552,
			120552
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120553,
			120553
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120554,
			120554
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120555,
			120555
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120556,
			120556
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120557,
			120557
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120558,
			120558
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120559,
			120559
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120560,
			120560
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120561,
			120561
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120562,
			120562
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120563,
			120563
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120564,
			120564
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120565,
			120565
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120566,
			120566
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120567,
			120567
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120568,
			120568
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120569,
			120569
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120570,
			120570
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120571,
			120571
		],
		"mapped",
		[
			8711
		]
	],
	[
		[
			120572,
			120572
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120573,
			120573
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120574,
			120574
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120575,
			120575
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120576,
			120576
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120577,
			120577
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120578,
			120578
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120579,
			120579
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120580,
			120580
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120581,
			120581
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120582,
			120582
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120583,
			120583
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120584,
			120584
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120585,
			120585
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120586,
			120586
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120587,
			120587
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120588,
			120588
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120589,
			120590
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120591,
			120591
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120592,
			120592
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120593,
			120593
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120594,
			120594
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120595,
			120595
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120596,
			120596
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120597,
			120597
		],
		"mapped",
		[
			8706
		]
	],
	[
		[
			120598,
			120598
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120599,
			120599
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120600,
			120600
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120601,
			120601
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120602,
			120602
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120603,
			120603
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120604,
			120604
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120605,
			120605
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120606,
			120606
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120607,
			120607
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120608,
			120608
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120609,
			120609
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120610,
			120610
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120611,
			120611
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120612,
			120612
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120613,
			120613
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120614,
			120614
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120615,
			120615
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120616,
			120616
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120617,
			120617
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120618,
			120618
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120619,
			120619
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120620,
			120620
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120621,
			120621
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120622,
			120622
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120623,
			120623
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120624,
			120624
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120625,
			120625
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120626,
			120626
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120627,
			120627
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120628,
			120628
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120629,
			120629
		],
		"mapped",
		[
			8711
		]
	],
	[
		[
			120630,
			120630
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120631,
			120631
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120632,
			120632
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120633,
			120633
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120634,
			120634
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120635,
			120635
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120636,
			120636
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120637,
			120637
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120638,
			120638
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120639,
			120639
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120640,
			120640
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120641,
			120641
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120642,
			120642
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120643,
			120643
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120644,
			120644
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120645,
			120645
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120646,
			120646
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120647,
			120648
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120649,
			120649
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120650,
			120650
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120651,
			120651
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120652,
			120652
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120653,
			120653
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120654,
			120654
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120655,
			120655
		],
		"mapped",
		[
			8706
		]
	],
	[
		[
			120656,
			120656
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120657,
			120657
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120658,
			120658
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120659,
			120659
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120660,
			120660
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120661,
			120661
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120662,
			120662
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120663,
			120663
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120664,
			120664
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120665,
			120665
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120666,
			120666
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120667,
			120667
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120668,
			120668
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120669,
			120669
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120670,
			120670
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120671,
			120671
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120672,
			120672
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120673,
			120673
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120674,
			120674
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120675,
			120675
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120676,
			120676
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120677,
			120677
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120678,
			120678
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120679,
			120679
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120680,
			120680
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120681,
			120681
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120682,
			120682
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120683,
			120683
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120684,
			120684
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120685,
			120685
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120686,
			120686
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120687,
			120687
		],
		"mapped",
		[
			8711
		]
	],
	[
		[
			120688,
			120688
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120689,
			120689
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120690,
			120690
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120691,
			120691
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120692,
			120692
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120693,
			120693
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120694,
			120694
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120695,
			120695
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120696,
			120696
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120697,
			120697
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120698,
			120698
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120699,
			120699
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120700,
			120700
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120701,
			120701
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120702,
			120702
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120703,
			120703
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120704,
			120704
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120705,
			120706
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120707,
			120707
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120708,
			120708
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120709,
			120709
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120710,
			120710
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120711,
			120711
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120712,
			120712
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120713,
			120713
		],
		"mapped",
		[
			8706
		]
	],
	[
		[
			120714,
			120714
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120715,
			120715
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120716,
			120716
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120717,
			120717
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120718,
			120718
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120719,
			120719
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120720,
			120720
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120721,
			120721
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120722,
			120722
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120723,
			120723
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120724,
			120724
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120725,
			120725
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120726,
			120726
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120727,
			120727
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120728,
			120728
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120729,
			120729
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120730,
			120730
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120731,
			120731
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120732,
			120732
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120733,
			120733
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120734,
			120734
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120735,
			120735
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120736,
			120736
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120737,
			120737
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120738,
			120738
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120739,
			120739
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120740,
			120740
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120741,
			120741
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120742,
			120742
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120743,
			120743
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120744,
			120744
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120745,
			120745
		],
		"mapped",
		[
			8711
		]
	],
	[
		[
			120746,
			120746
		],
		"mapped",
		[
			945
		]
	],
	[
		[
			120747,
			120747
		],
		"mapped",
		[
			946
		]
	],
	[
		[
			120748,
			120748
		],
		"mapped",
		[
			947
		]
	],
	[
		[
			120749,
			120749
		],
		"mapped",
		[
			948
		]
	],
	[
		[
			120750,
			120750
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120751,
			120751
		],
		"mapped",
		[
			950
		]
	],
	[
		[
			120752,
			120752
		],
		"mapped",
		[
			951
		]
	],
	[
		[
			120753,
			120753
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120754,
			120754
		],
		"mapped",
		[
			953
		]
	],
	[
		[
			120755,
			120755
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120756,
			120756
		],
		"mapped",
		[
			955
		]
	],
	[
		[
			120757,
			120757
		],
		"mapped",
		[
			956
		]
	],
	[
		[
			120758,
			120758
		],
		"mapped",
		[
			957
		]
	],
	[
		[
			120759,
			120759
		],
		"mapped",
		[
			958
		]
	],
	[
		[
			120760,
			120760
		],
		"mapped",
		[
			959
		]
	],
	[
		[
			120761,
			120761
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120762,
			120762
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120763,
			120764
		],
		"mapped",
		[
			963
		]
	],
	[
		[
			120765,
			120765
		],
		"mapped",
		[
			964
		]
	],
	[
		[
			120766,
			120766
		],
		"mapped",
		[
			965
		]
	],
	[
		[
			120767,
			120767
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120768,
			120768
		],
		"mapped",
		[
			967
		]
	],
	[
		[
			120769,
			120769
		],
		"mapped",
		[
			968
		]
	],
	[
		[
			120770,
			120770
		],
		"mapped",
		[
			969
		]
	],
	[
		[
			120771,
			120771
		],
		"mapped",
		[
			8706
		]
	],
	[
		[
			120772,
			120772
		],
		"mapped",
		[
			949
		]
	],
	[
		[
			120773,
			120773
		],
		"mapped",
		[
			952
		]
	],
	[
		[
			120774,
			120774
		],
		"mapped",
		[
			954
		]
	],
	[
		[
			120775,
			120775
		],
		"mapped",
		[
			966
		]
	],
	[
		[
			120776,
			120776
		],
		"mapped",
		[
			961
		]
	],
	[
		[
			120777,
			120777
		],
		"mapped",
		[
			960
		]
	],
	[
		[
			120778,
			120779
		],
		"mapped",
		[
			989
		]
	],
	[
		[
			120780,
			120781
		],
		"disallowed"
	],
	[
		[
			120782,
			120782
		],
		"mapped",
		[
			48
		]
	],
	[
		[
			120783,
			120783
		],
		"mapped",
		[
			49
		]
	],
	[
		[
			120784,
			120784
		],
		"mapped",
		[
			50
		]
	],
	[
		[
			120785,
			120785
		],
		"mapped",
		[
			51
		]
	],
	[
		[
			120786,
			120786
		],
		"mapped",
		[
			52
		]
	],
	[
		[
			120787,
			120787
		],
		"mapped",
		[
			53
		]
	],
	[
		[
			120788,
			120788
		],
		"mapped",
		[
			54
		]
	],
	[
		[
			120789,
			120789
		],
		"mapped",
		[
			55
		]
	],
	[
		[
			120790,
			120790
		],
		"mapped",
		[
			56
		]
	],
	[
		[
			120791,
			120791
		],
		"mapped",
		[
			57
		]
	],
	[
		[
			120792,
			120792
		],
		"mapped",
		[
			48
		]
	],
	[
		[
			120793,
			120793
		],
		"mapped",
		[
			49
		]
	],
	[
		[
			120794,
			120794
		],
		"mapped",
		[
			50
		]
	],
	[
		[
			120795,
			120795
		],
		"mapped",
		[
			51
		]
	],
	[
		[
			120796,
			120796
		],
		"mapped",
		[
			52
		]
	],
	[
		[
			120797,
			120797
		],
		"mapped",
		[
			53
		]
	],
	[
		[
			120798,
			120798
		],
		"mapped",
		[
			54
		]
	],
	[
		[
			120799,
			120799
		],
		"mapped",
		[
			55
		]
	],
	[
		[
			120800,
			120800
		],
		"mapped",
		[
			56
		]
	],
	[
		[
			120801,
			120801
		],
		"mapped",
		[
			57
		]
	],
	[
		[
			120802,
			120802
		],
		"mapped",
		[
			48
		]
	],
	[
		[
			120803,
			120803
		],
		"mapped",
		[
			49
		]
	],
	[
		[
			120804,
			120804
		],
		"mapped",
		[
			50
		]
	],
	[
		[
			120805,
			120805
		],
		"mapped",
		[
			51
		]
	],
	[
		[
			120806,
			120806
		],
		"mapped",
		[
			52
		]
	],
	[
		[
			120807,
			120807
		],
		"mapped",
		[
			53
		]
	],
	[
		[
			120808,
			120808
		],
		"mapped",
		[
			54
		]
	],
	[
		[
			120809,
			120809
		],
		"mapped",
		[
			55
		]
	],
	[
		[
			120810,
			120810
		],
		"mapped",
		[
			56
		]
	],
	[
		[
			120811,
			120811
		],
		"mapped",
		[
			57
		]
	],
	[
		[
			120812,
			120812
		],
		"mapped",
		[
			48
		]
	],
	[
		[
			120813,
			120813
		],
		"mapped",
		[
			49
		]
	],
	[
		[
			120814,
			120814
		],
		"mapped",
		[
			50
		]
	],
	[
		[
			120815,
			120815
		],
		"mapped",
		[
			51
		]
	],
	[
		[
			120816,
			120816
		],
		"mapped",
		[
			52
		]
	],
	[
		[
			120817,
			120817
		],
		"mapped",
		[
			53
		]
	],
	[
		[
			120818,
			120818
		],
		"mapped",
		[
			54
		]
	],
	[
		[
			120819,
			120819
		],
		"mapped",
		[
			55
		]
	],
	[
		[
			120820,
			120820
		],
		"mapped",
		[
			56
		]
	],
	[
		[
			120821,
			120821
		],
		"mapped",
		[
			57
		]
	],
	[
		[
			120822,
			120822
		],
		"mapped",
		[
			48
		]
	],
	[
		[
			120823,
			120823
		],
		"mapped",
		[
			49
		]
	],
	[
		[
			120824,
			120824
		],
		"mapped",
		[
			50
		]
	],
	[
		[
			120825,
			120825
		],
		"mapped",
		[
			51
		]
	],
	[
		[
			120826,
			120826
		],
		"mapped",
		[
			52
		]
	],
	[
		[
			120827,
			120827
		],
		"mapped",
		[
			53
		]
	],
	[
		[
			120828,
			120828
		],
		"mapped",
		[
			54
		]
	],
	[
		[
			120829,
			120829
		],
		"mapped",
		[
			55
		]
	],
	[
		[
			120830,
			120830
		],
		"mapped",
		[
			56
		]
	],
	[
		[
			120831,
			120831
		],
		"mapped",
		[
			57
		]
	],
	[
		[
			120832,
			121343
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			121344,
			121398
		],
		"valid"
	],
	[
		[
			121399,
			121402
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			121403,
			121452
		],
		"valid"
	],
	[
		[
			121453,
			121460
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			121461,
			121461
		],
		"valid"
	],
	[
		[
			121462,
			121475
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			121476,
			121476
		],
		"valid"
	],
	[
		[
			121477,
			121483
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			121484,
			121498
		],
		"disallowed"
	],
	[
		[
			121499,
			121503
		],
		"valid"
	],
	[
		[
			121504,
			121504
		],
		"disallowed"
	],
	[
		[
			121505,
			121519
		],
		"valid"
	],
	[
		[
			121520,
			124927
		],
		"disallowed"
	],
	[
		[
			124928,
			125124
		],
		"valid"
	],
	[
		[
			125125,
			125126
		],
		"disallowed"
	],
	[
		[
			125127,
			125135
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			125136,
			125142
		],
		"valid"
	],
	[
		[
			125143,
			126463
		],
		"disallowed"
	],
	[
		[
			126464,
			126464
		],
		"mapped",
		[
			1575
		]
	],
	[
		[
			126465,
			126465
		],
		"mapped",
		[
			1576
		]
	],
	[
		[
			126466,
			126466
		],
		"mapped",
		[
			1580
		]
	],
	[
		[
			126467,
			126467
		],
		"mapped",
		[
			1583
		]
	],
	[
		[
			126468,
			126468
		],
		"disallowed"
	],
	[
		[
			126469,
			126469
		],
		"mapped",
		[
			1608
		]
	],
	[
		[
			126470,
			126470
		],
		"mapped",
		[
			1586
		]
	],
	[
		[
			126471,
			126471
		],
		"mapped",
		[
			1581
		]
	],
	[
		[
			126472,
			126472
		],
		"mapped",
		[
			1591
		]
	],
	[
		[
			126473,
			126473
		],
		"mapped",
		[
			1610
		]
	],
	[
		[
			126474,
			126474
		],
		"mapped",
		[
			1603
		]
	],
	[
		[
			126475,
			126475
		],
		"mapped",
		[
			1604
		]
	],
	[
		[
			126476,
			126476
		],
		"mapped",
		[
			1605
		]
	],
	[
		[
			126477,
			126477
		],
		"mapped",
		[
			1606
		]
	],
	[
		[
			126478,
			126478
		],
		"mapped",
		[
			1587
		]
	],
	[
		[
			126479,
			126479
		],
		"mapped",
		[
			1593
		]
	],
	[
		[
			126480,
			126480
		],
		"mapped",
		[
			1601
		]
	],
	[
		[
			126481,
			126481
		],
		"mapped",
		[
			1589
		]
	],
	[
		[
			126482,
			126482
		],
		"mapped",
		[
			1602
		]
	],
	[
		[
			126483,
			126483
		],
		"mapped",
		[
			1585
		]
	],
	[
		[
			126484,
			126484
		],
		"mapped",
		[
			1588
		]
	],
	[
		[
			126485,
			126485
		],
		"mapped",
		[
			1578
		]
	],
	[
		[
			126486,
			126486
		],
		"mapped",
		[
			1579
		]
	],
	[
		[
			126487,
			126487
		],
		"mapped",
		[
			1582
		]
	],
	[
		[
			126488,
			126488
		],
		"mapped",
		[
			1584
		]
	],
	[
		[
			126489,
			126489
		],
		"mapped",
		[
			1590
		]
	],
	[
		[
			126490,
			126490
		],
		"mapped",
		[
			1592
		]
	],
	[
		[
			126491,
			126491
		],
		"mapped",
		[
			1594
		]
	],
	[
		[
			126492,
			126492
		],
		"mapped",
		[
			1646
		]
	],
	[
		[
			126493,
			126493
		],
		"mapped",
		[
			1722
		]
	],
	[
		[
			126494,
			126494
		],
		"mapped",
		[
			1697
		]
	],
	[
		[
			126495,
			126495
		],
		"mapped",
		[
			1647
		]
	],
	[
		[
			126496,
			126496
		],
		"disallowed"
	],
	[
		[
			126497,
			126497
		],
		"mapped",
		[
			1576
		]
	],
	[
		[
			126498,
			126498
		],
		"mapped",
		[
			1580
		]
	],
	[
		[
			126499,
			126499
		],
		"disallowed"
	],
	[
		[
			126500,
			126500
		],
		"mapped",
		[
			1607
		]
	],
	[
		[
			126501,
			126502
		],
		"disallowed"
	],
	[
		[
			126503,
			126503
		],
		"mapped",
		[
			1581
		]
	],
	[
		[
			126504,
			126504
		],
		"disallowed"
	],
	[
		[
			126505,
			126505
		],
		"mapped",
		[
			1610
		]
	],
	[
		[
			126506,
			126506
		],
		"mapped",
		[
			1603
		]
	],
	[
		[
			126507,
			126507
		],
		"mapped",
		[
			1604
		]
	],
	[
		[
			126508,
			126508
		],
		"mapped",
		[
			1605
		]
	],
	[
		[
			126509,
			126509
		],
		"mapped",
		[
			1606
		]
	],
	[
		[
			126510,
			126510
		],
		"mapped",
		[
			1587
		]
	],
	[
		[
			126511,
			126511
		],
		"mapped",
		[
			1593
		]
	],
	[
		[
			126512,
			126512
		],
		"mapped",
		[
			1601
		]
	],
	[
		[
			126513,
			126513
		],
		"mapped",
		[
			1589
		]
	],
	[
		[
			126514,
			126514
		],
		"mapped",
		[
			1602
		]
	],
	[
		[
			126515,
			126515
		],
		"disallowed"
	],
	[
		[
			126516,
			126516
		],
		"mapped",
		[
			1588
		]
	],
	[
		[
			126517,
			126517
		],
		"mapped",
		[
			1578
		]
	],
	[
		[
			126518,
			126518
		],
		"mapped",
		[
			1579
		]
	],
	[
		[
			126519,
			126519
		],
		"mapped",
		[
			1582
		]
	],
	[
		[
			126520,
			126520
		],
		"disallowed"
	],
	[
		[
			126521,
			126521
		],
		"mapped",
		[
			1590
		]
	],
	[
		[
			126522,
			126522
		],
		"disallowed"
	],
	[
		[
			126523,
			126523
		],
		"mapped",
		[
			1594
		]
	],
	[
		[
			126524,
			126529
		],
		"disallowed"
	],
	[
		[
			126530,
			126530
		],
		"mapped",
		[
			1580
		]
	],
	[
		[
			126531,
			126534
		],
		"disallowed"
	],
	[
		[
			126535,
			126535
		],
		"mapped",
		[
			1581
		]
	],
	[
		[
			126536,
			126536
		],
		"disallowed"
	],
	[
		[
			126537,
			126537
		],
		"mapped",
		[
			1610
		]
	],
	[
		[
			126538,
			126538
		],
		"disallowed"
	],
	[
		[
			126539,
			126539
		],
		"mapped",
		[
			1604
		]
	],
	[
		[
			126540,
			126540
		],
		"disallowed"
	],
	[
		[
			126541,
			126541
		],
		"mapped",
		[
			1606
		]
	],
	[
		[
			126542,
			126542
		],
		"mapped",
		[
			1587
		]
	],
	[
		[
			126543,
			126543
		],
		"mapped",
		[
			1593
		]
	],
	[
		[
			126544,
			126544
		],
		"disallowed"
	],
	[
		[
			126545,
			126545
		],
		"mapped",
		[
			1589
		]
	],
	[
		[
			126546,
			126546
		],
		"mapped",
		[
			1602
		]
	],
	[
		[
			126547,
			126547
		],
		"disallowed"
	],
	[
		[
			126548,
			126548
		],
		"mapped",
		[
			1588
		]
	],
	[
		[
			126549,
			126550
		],
		"disallowed"
	],
	[
		[
			126551,
			126551
		],
		"mapped",
		[
			1582
		]
	],
	[
		[
			126552,
			126552
		],
		"disallowed"
	],
	[
		[
			126553,
			126553
		],
		"mapped",
		[
			1590
		]
	],
	[
		[
			126554,
			126554
		],
		"disallowed"
	],
	[
		[
			126555,
			126555
		],
		"mapped",
		[
			1594
		]
	],
	[
		[
			126556,
			126556
		],
		"disallowed"
	],
	[
		[
			126557,
			126557
		],
		"mapped",
		[
			1722
		]
	],
	[
		[
			126558,
			126558
		],
		"disallowed"
	],
	[
		[
			126559,
			126559
		],
		"mapped",
		[
			1647
		]
	],
	[
		[
			126560,
			126560
		],
		"disallowed"
	],
	[
		[
			126561,
			126561
		],
		"mapped",
		[
			1576
		]
	],
	[
		[
			126562,
			126562
		],
		"mapped",
		[
			1580
		]
	],
	[
		[
			126563,
			126563
		],
		"disallowed"
	],
	[
		[
			126564,
			126564
		],
		"mapped",
		[
			1607
		]
	],
	[
		[
			126565,
			126566
		],
		"disallowed"
	],
	[
		[
			126567,
			126567
		],
		"mapped",
		[
			1581
		]
	],
	[
		[
			126568,
			126568
		],
		"mapped",
		[
			1591
		]
	],
	[
		[
			126569,
			126569
		],
		"mapped",
		[
			1610
		]
	],
	[
		[
			126570,
			126570
		],
		"mapped",
		[
			1603
		]
	],
	[
		[
			126571,
			126571
		],
		"disallowed"
	],
	[
		[
			126572,
			126572
		],
		"mapped",
		[
			1605
		]
	],
	[
		[
			126573,
			126573
		],
		"mapped",
		[
			1606
		]
	],
	[
		[
			126574,
			126574
		],
		"mapped",
		[
			1587
		]
	],
	[
		[
			126575,
			126575
		],
		"mapped",
		[
			1593
		]
	],
	[
		[
			126576,
			126576
		],
		"mapped",
		[
			1601
		]
	],
	[
		[
			126577,
			126577
		],
		"mapped",
		[
			1589
		]
	],
	[
		[
			126578,
			126578
		],
		"mapped",
		[
			1602
		]
	],
	[
		[
			126579,
			126579
		],
		"disallowed"
	],
	[
		[
			126580,
			126580
		],
		"mapped",
		[
			1588
		]
	],
	[
		[
			126581,
			126581
		],
		"mapped",
		[
			1578
		]
	],
	[
		[
			126582,
			126582
		],
		"mapped",
		[
			1579
		]
	],
	[
		[
			126583,
			126583
		],
		"mapped",
		[
			1582
		]
	],
	[
		[
			126584,
			126584
		],
		"disallowed"
	],
	[
		[
			126585,
			126585
		],
		"mapped",
		[
			1590
		]
	],
	[
		[
			126586,
			126586
		],
		"mapped",
		[
			1592
		]
	],
	[
		[
			126587,
			126587
		],
		"mapped",
		[
			1594
		]
	],
	[
		[
			126588,
			126588
		],
		"mapped",
		[
			1646
		]
	],
	[
		[
			126589,
			126589
		],
		"disallowed"
	],
	[
		[
			126590,
			126590
		],
		"mapped",
		[
			1697
		]
	],
	[
		[
			126591,
			126591
		],
		"disallowed"
	],
	[
		[
			126592,
			126592
		],
		"mapped",
		[
			1575
		]
	],
	[
		[
			126593,
			126593
		],
		"mapped",
		[
			1576
		]
	],
	[
		[
			126594,
			126594
		],
		"mapped",
		[
			1580
		]
	],
	[
		[
			126595,
			126595
		],
		"mapped",
		[
			1583
		]
	],
	[
		[
			126596,
			126596
		],
		"mapped",
		[
			1607
		]
	],
	[
		[
			126597,
			126597
		],
		"mapped",
		[
			1608
		]
	],
	[
		[
			126598,
			126598
		],
		"mapped",
		[
			1586
		]
	],
	[
		[
			126599,
			126599
		],
		"mapped",
		[
			1581
		]
	],
	[
		[
			126600,
			126600
		],
		"mapped",
		[
			1591
		]
	],
	[
		[
			126601,
			126601
		],
		"mapped",
		[
			1610
		]
	],
	[
		[
			126602,
			126602
		],
		"disallowed"
	],
	[
		[
			126603,
			126603
		],
		"mapped",
		[
			1604
		]
	],
	[
		[
			126604,
			126604
		],
		"mapped",
		[
			1605
		]
	],
	[
		[
			126605,
			126605
		],
		"mapped",
		[
			1606
		]
	],
	[
		[
			126606,
			126606
		],
		"mapped",
		[
			1587
		]
	],
	[
		[
			126607,
			126607
		],
		"mapped",
		[
			1593
		]
	],
	[
		[
			126608,
			126608
		],
		"mapped",
		[
			1601
		]
	],
	[
		[
			126609,
			126609
		],
		"mapped",
		[
			1589
		]
	],
	[
		[
			126610,
			126610
		],
		"mapped",
		[
			1602
		]
	],
	[
		[
			126611,
			126611
		],
		"mapped",
		[
			1585
		]
	],
	[
		[
			126612,
			126612
		],
		"mapped",
		[
			1588
		]
	],
	[
		[
			126613,
			126613
		],
		"mapped",
		[
			1578
		]
	],
	[
		[
			126614,
			126614
		],
		"mapped",
		[
			1579
		]
	],
	[
		[
			126615,
			126615
		],
		"mapped",
		[
			1582
		]
	],
	[
		[
			126616,
			126616
		],
		"mapped",
		[
			1584
		]
	],
	[
		[
			126617,
			126617
		],
		"mapped",
		[
			1590
		]
	],
	[
		[
			126618,
			126618
		],
		"mapped",
		[
			1592
		]
	],
	[
		[
			126619,
			126619
		],
		"mapped",
		[
			1594
		]
	],
	[
		[
			126620,
			126624
		],
		"disallowed"
	],
	[
		[
			126625,
			126625
		],
		"mapped",
		[
			1576
		]
	],
	[
		[
			126626,
			126626
		],
		"mapped",
		[
			1580
		]
	],
	[
		[
			126627,
			126627
		],
		"mapped",
		[
			1583
		]
	],
	[
		[
			126628,
			126628
		],
		"disallowed"
	],
	[
		[
			126629,
			126629
		],
		"mapped",
		[
			1608
		]
	],
	[
		[
			126630,
			126630
		],
		"mapped",
		[
			1586
		]
	],
	[
		[
			126631,
			126631
		],
		"mapped",
		[
			1581
		]
	],
	[
		[
			126632,
			126632
		],
		"mapped",
		[
			1591
		]
	],
	[
		[
			126633,
			126633
		],
		"mapped",
		[
			1610
		]
	],
	[
		[
			126634,
			126634
		],
		"disallowed"
	],
	[
		[
			126635,
			126635
		],
		"mapped",
		[
			1604
		]
	],
	[
		[
			126636,
			126636
		],
		"mapped",
		[
			1605
		]
	],
	[
		[
			126637,
			126637
		],
		"mapped",
		[
			1606
		]
	],
	[
		[
			126638,
			126638
		],
		"mapped",
		[
			1587
		]
	],
	[
		[
			126639,
			126639
		],
		"mapped",
		[
			1593
		]
	],
	[
		[
			126640,
			126640
		],
		"mapped",
		[
			1601
		]
	],
	[
		[
			126641,
			126641
		],
		"mapped",
		[
			1589
		]
	],
	[
		[
			126642,
			126642
		],
		"mapped",
		[
			1602
		]
	],
	[
		[
			126643,
			126643
		],
		"mapped",
		[
			1585
		]
	],
	[
		[
			126644,
			126644
		],
		"mapped",
		[
			1588
		]
	],
	[
		[
			126645,
			126645
		],
		"mapped",
		[
			1578
		]
	],
	[
		[
			126646,
			126646
		],
		"mapped",
		[
			1579
		]
	],
	[
		[
			126647,
			126647
		],
		"mapped",
		[
			1582
		]
	],
	[
		[
			126648,
			126648
		],
		"mapped",
		[
			1584
		]
	],
	[
		[
			126649,
			126649
		],
		"mapped",
		[
			1590
		]
	],
	[
		[
			126650,
			126650
		],
		"mapped",
		[
			1592
		]
	],
	[
		[
			126651,
			126651
		],
		"mapped",
		[
			1594
		]
	],
	[
		[
			126652,
			126703
		],
		"disallowed"
	],
	[
		[
			126704,
			126705
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			126706,
			126975
		],
		"disallowed"
	],
	[
		[
			126976,
			127019
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127020,
			127023
		],
		"disallowed"
	],
	[
		[
			127024,
			127123
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127124,
			127135
		],
		"disallowed"
	],
	[
		[
			127136,
			127150
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127151,
			127152
		],
		"disallowed"
	],
	[
		[
			127153,
			127166
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127167,
			127167
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127168,
			127168
		],
		"disallowed"
	],
	[
		[
			127169,
			127183
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127184,
			127184
		],
		"disallowed"
	],
	[
		[
			127185,
			127199
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127200,
			127221
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127222,
			127231
		],
		"disallowed"
	],
	[
		[
			127232,
			127232
		],
		"disallowed"
	],
	[
		[
			127233,
			127233
		],
		"disallowed_STD3_mapped",
		[
			48,
			44
		]
	],
	[
		[
			127234,
			127234
		],
		"disallowed_STD3_mapped",
		[
			49,
			44
		]
	],
	[
		[
			127235,
			127235
		],
		"disallowed_STD3_mapped",
		[
			50,
			44
		]
	],
	[
		[
			127236,
			127236
		],
		"disallowed_STD3_mapped",
		[
			51,
			44
		]
	],
	[
		[
			127237,
			127237
		],
		"disallowed_STD3_mapped",
		[
			52,
			44
		]
	],
	[
		[
			127238,
			127238
		],
		"disallowed_STD3_mapped",
		[
			53,
			44
		]
	],
	[
		[
			127239,
			127239
		],
		"disallowed_STD3_mapped",
		[
			54,
			44
		]
	],
	[
		[
			127240,
			127240
		],
		"disallowed_STD3_mapped",
		[
			55,
			44
		]
	],
	[
		[
			127241,
			127241
		],
		"disallowed_STD3_mapped",
		[
			56,
			44
		]
	],
	[
		[
			127242,
			127242
		],
		"disallowed_STD3_mapped",
		[
			57,
			44
		]
	],
	[
		[
			127243,
			127244
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127245,
			127247
		],
		"disallowed"
	],
	[
		[
			127248,
			127248
		],
		"disallowed_STD3_mapped",
		[
			40,
			97,
			41
		]
	],
	[
		[
			127249,
			127249
		],
		"disallowed_STD3_mapped",
		[
			40,
			98,
			41
		]
	],
	[
		[
			127250,
			127250
		],
		"disallowed_STD3_mapped",
		[
			40,
			99,
			41
		]
	],
	[
		[
			127251,
			127251
		],
		"disallowed_STD3_mapped",
		[
			40,
			100,
			41
		]
	],
	[
		[
			127252,
			127252
		],
		"disallowed_STD3_mapped",
		[
			40,
			101,
			41
		]
	],
	[
		[
			127253,
			127253
		],
		"disallowed_STD3_mapped",
		[
			40,
			102,
			41
		]
	],
	[
		[
			127254,
			127254
		],
		"disallowed_STD3_mapped",
		[
			40,
			103,
			41
		]
	],
	[
		[
			127255,
			127255
		],
		"disallowed_STD3_mapped",
		[
			40,
			104,
			41
		]
	],
	[
		[
			127256,
			127256
		],
		"disallowed_STD3_mapped",
		[
			40,
			105,
			41
		]
	],
	[
		[
			127257,
			127257
		],
		"disallowed_STD3_mapped",
		[
			40,
			106,
			41
		]
	],
	[
		[
			127258,
			127258
		],
		"disallowed_STD3_mapped",
		[
			40,
			107,
			41
		]
	],
	[
		[
			127259,
			127259
		],
		"disallowed_STD3_mapped",
		[
			40,
			108,
			41
		]
	],
	[
		[
			127260,
			127260
		],
		"disallowed_STD3_mapped",
		[
			40,
			109,
			41
		]
	],
	[
		[
			127261,
			127261
		],
		"disallowed_STD3_mapped",
		[
			40,
			110,
			41
		]
	],
	[
		[
			127262,
			127262
		],
		"disallowed_STD3_mapped",
		[
			40,
			111,
			41
		]
	],
	[
		[
			127263,
			127263
		],
		"disallowed_STD3_mapped",
		[
			40,
			112,
			41
		]
	],
	[
		[
			127264,
			127264
		],
		"disallowed_STD3_mapped",
		[
			40,
			113,
			41
		]
	],
	[
		[
			127265,
			127265
		],
		"disallowed_STD3_mapped",
		[
			40,
			114,
			41
		]
	],
	[
		[
			127266,
			127266
		],
		"disallowed_STD3_mapped",
		[
			40,
			115,
			41
		]
	],
	[
		[
			127267,
			127267
		],
		"disallowed_STD3_mapped",
		[
			40,
			116,
			41
		]
	],
	[
		[
			127268,
			127268
		],
		"disallowed_STD3_mapped",
		[
			40,
			117,
			41
		]
	],
	[
		[
			127269,
			127269
		],
		"disallowed_STD3_mapped",
		[
			40,
			118,
			41
		]
	],
	[
		[
			127270,
			127270
		],
		"disallowed_STD3_mapped",
		[
			40,
			119,
			41
		]
	],
	[
		[
			127271,
			127271
		],
		"disallowed_STD3_mapped",
		[
			40,
			120,
			41
		]
	],
	[
		[
			127272,
			127272
		],
		"disallowed_STD3_mapped",
		[
			40,
			121,
			41
		]
	],
	[
		[
			127273,
			127273
		],
		"disallowed_STD3_mapped",
		[
			40,
			122,
			41
		]
	],
	[
		[
			127274,
			127274
		],
		"mapped",
		[
			12308,
			115,
			12309
		]
	],
	[
		[
			127275,
			127275
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			127276,
			127276
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			127277,
			127277
		],
		"mapped",
		[
			99,
			100
		]
	],
	[
		[
			127278,
			127278
		],
		"mapped",
		[
			119,
			122
		]
	],
	[
		[
			127279,
			127279
		],
		"disallowed"
	],
	[
		[
			127280,
			127280
		],
		"mapped",
		[
			97
		]
	],
	[
		[
			127281,
			127281
		],
		"mapped",
		[
			98
		]
	],
	[
		[
			127282,
			127282
		],
		"mapped",
		[
			99
		]
	],
	[
		[
			127283,
			127283
		],
		"mapped",
		[
			100
		]
	],
	[
		[
			127284,
			127284
		],
		"mapped",
		[
			101
		]
	],
	[
		[
			127285,
			127285
		],
		"mapped",
		[
			102
		]
	],
	[
		[
			127286,
			127286
		],
		"mapped",
		[
			103
		]
	],
	[
		[
			127287,
			127287
		],
		"mapped",
		[
			104
		]
	],
	[
		[
			127288,
			127288
		],
		"mapped",
		[
			105
		]
	],
	[
		[
			127289,
			127289
		],
		"mapped",
		[
			106
		]
	],
	[
		[
			127290,
			127290
		],
		"mapped",
		[
			107
		]
	],
	[
		[
			127291,
			127291
		],
		"mapped",
		[
			108
		]
	],
	[
		[
			127292,
			127292
		],
		"mapped",
		[
			109
		]
	],
	[
		[
			127293,
			127293
		],
		"mapped",
		[
			110
		]
	],
	[
		[
			127294,
			127294
		],
		"mapped",
		[
			111
		]
	],
	[
		[
			127295,
			127295
		],
		"mapped",
		[
			112
		]
	],
	[
		[
			127296,
			127296
		],
		"mapped",
		[
			113
		]
	],
	[
		[
			127297,
			127297
		],
		"mapped",
		[
			114
		]
	],
	[
		[
			127298,
			127298
		],
		"mapped",
		[
			115
		]
	],
	[
		[
			127299,
			127299
		],
		"mapped",
		[
			116
		]
	],
	[
		[
			127300,
			127300
		],
		"mapped",
		[
			117
		]
	],
	[
		[
			127301,
			127301
		],
		"mapped",
		[
			118
		]
	],
	[
		[
			127302,
			127302
		],
		"mapped",
		[
			119
		]
	],
	[
		[
			127303,
			127303
		],
		"mapped",
		[
			120
		]
	],
	[
		[
			127304,
			127304
		],
		"mapped",
		[
			121
		]
	],
	[
		[
			127305,
			127305
		],
		"mapped",
		[
			122
		]
	],
	[
		[
			127306,
			127306
		],
		"mapped",
		[
			104,
			118
		]
	],
	[
		[
			127307,
			127307
		],
		"mapped",
		[
			109,
			118
		]
	],
	[
		[
			127308,
			127308
		],
		"mapped",
		[
			115,
			100
		]
	],
	[
		[
			127309,
			127309
		],
		"mapped",
		[
			115,
			115
		]
	],
	[
		[
			127310,
			127310
		],
		"mapped",
		[
			112,
			112,
			118
		]
	],
	[
		[
			127311,
			127311
		],
		"mapped",
		[
			119,
			99
		]
	],
	[
		[
			127312,
			127318
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127319,
			127319
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127320,
			127326
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127327,
			127327
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127328,
			127337
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127338,
			127338
		],
		"mapped",
		[
			109,
			99
		]
	],
	[
		[
			127339,
			127339
		],
		"mapped",
		[
			109,
			100
		]
	],
	[
		[
			127340,
			127343
		],
		"disallowed"
	],
	[
		[
			127344,
			127352
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127353,
			127353
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127354,
			127354
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127355,
			127356
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127357,
			127358
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127359,
			127359
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127360,
			127369
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127370,
			127373
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127374,
			127375
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127376,
			127376
		],
		"mapped",
		[
			100,
			106
		]
	],
	[
		[
			127377,
			127386
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127387,
			127461
		],
		"disallowed"
	],
	[
		[
			127462,
			127487
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127488,
			127488
		],
		"mapped",
		[
			12411,
			12363
		]
	],
	[
		[
			127489,
			127489
		],
		"mapped",
		[
			12467,
			12467
		]
	],
	[
		[
			127490,
			127490
		],
		"mapped",
		[
			12469
		]
	],
	[
		[
			127491,
			127503
		],
		"disallowed"
	],
	[
		[
			127504,
			127504
		],
		"mapped",
		[
			25163
		]
	],
	[
		[
			127505,
			127505
		],
		"mapped",
		[
			23383
		]
	],
	[
		[
			127506,
			127506
		],
		"mapped",
		[
			21452
		]
	],
	[
		[
			127507,
			127507
		],
		"mapped",
		[
			12487
		]
	],
	[
		[
			127508,
			127508
		],
		"mapped",
		[
			20108
		]
	],
	[
		[
			127509,
			127509
		],
		"mapped",
		[
			22810
		]
	],
	[
		[
			127510,
			127510
		],
		"mapped",
		[
			35299
		]
	],
	[
		[
			127511,
			127511
		],
		"mapped",
		[
			22825
		]
	],
	[
		[
			127512,
			127512
		],
		"mapped",
		[
			20132
		]
	],
	[
		[
			127513,
			127513
		],
		"mapped",
		[
			26144
		]
	],
	[
		[
			127514,
			127514
		],
		"mapped",
		[
			28961
		]
	],
	[
		[
			127515,
			127515
		],
		"mapped",
		[
			26009
		]
	],
	[
		[
			127516,
			127516
		],
		"mapped",
		[
			21069
		]
	],
	[
		[
			127517,
			127517
		],
		"mapped",
		[
			24460
		]
	],
	[
		[
			127518,
			127518
		],
		"mapped",
		[
			20877
		]
	],
	[
		[
			127519,
			127519
		],
		"mapped",
		[
			26032
		]
	],
	[
		[
			127520,
			127520
		],
		"mapped",
		[
			21021
		]
	],
	[
		[
			127521,
			127521
		],
		"mapped",
		[
			32066
		]
	],
	[
		[
			127522,
			127522
		],
		"mapped",
		[
			29983
		]
	],
	[
		[
			127523,
			127523
		],
		"mapped",
		[
			36009
		]
	],
	[
		[
			127524,
			127524
		],
		"mapped",
		[
			22768
		]
	],
	[
		[
			127525,
			127525
		],
		"mapped",
		[
			21561
		]
	],
	[
		[
			127526,
			127526
		],
		"mapped",
		[
			28436
		]
	],
	[
		[
			127527,
			127527
		],
		"mapped",
		[
			25237
		]
	],
	[
		[
			127528,
			127528
		],
		"mapped",
		[
			25429
		]
	],
	[
		[
			127529,
			127529
		],
		"mapped",
		[
			19968
		]
	],
	[
		[
			127530,
			127530
		],
		"mapped",
		[
			19977
		]
	],
	[
		[
			127531,
			127531
		],
		"mapped",
		[
			36938
		]
	],
	[
		[
			127532,
			127532
		],
		"mapped",
		[
			24038
		]
	],
	[
		[
			127533,
			127533
		],
		"mapped",
		[
			20013
		]
	],
	[
		[
			127534,
			127534
		],
		"mapped",
		[
			21491
		]
	],
	[
		[
			127535,
			127535
		],
		"mapped",
		[
			25351
		]
	],
	[
		[
			127536,
			127536
		],
		"mapped",
		[
			36208
		]
	],
	[
		[
			127537,
			127537
		],
		"mapped",
		[
			25171
		]
	],
	[
		[
			127538,
			127538
		],
		"mapped",
		[
			31105
		]
	],
	[
		[
			127539,
			127539
		],
		"mapped",
		[
			31354
		]
	],
	[
		[
			127540,
			127540
		],
		"mapped",
		[
			21512
		]
	],
	[
		[
			127541,
			127541
		],
		"mapped",
		[
			28288
		]
	],
	[
		[
			127542,
			127542
		],
		"mapped",
		[
			26377
		]
	],
	[
		[
			127543,
			127543
		],
		"mapped",
		[
			26376
		]
	],
	[
		[
			127544,
			127544
		],
		"mapped",
		[
			30003
		]
	],
	[
		[
			127545,
			127545
		],
		"mapped",
		[
			21106
		]
	],
	[
		[
			127546,
			127546
		],
		"mapped",
		[
			21942
		]
	],
	[
		[
			127547,
			127551
		],
		"disallowed"
	],
	[
		[
			127552,
			127552
		],
		"mapped",
		[
			12308,
			26412,
			12309
		]
	],
	[
		[
			127553,
			127553
		],
		"mapped",
		[
			12308,
			19977,
			12309
		]
	],
	[
		[
			127554,
			127554
		],
		"mapped",
		[
			12308,
			20108,
			12309
		]
	],
	[
		[
			127555,
			127555
		],
		"mapped",
		[
			12308,
			23433,
			12309
		]
	],
	[
		[
			127556,
			127556
		],
		"mapped",
		[
			12308,
			28857,
			12309
		]
	],
	[
		[
			127557,
			127557
		],
		"mapped",
		[
			12308,
			25171,
			12309
		]
	],
	[
		[
			127558,
			127558
		],
		"mapped",
		[
			12308,
			30423,
			12309
		]
	],
	[
		[
			127559,
			127559
		],
		"mapped",
		[
			12308,
			21213,
			12309
		]
	],
	[
		[
			127560,
			127560
		],
		"mapped",
		[
			12308,
			25943,
			12309
		]
	],
	[
		[
			127561,
			127567
		],
		"disallowed"
	],
	[
		[
			127568,
			127568
		],
		"mapped",
		[
			24471
		]
	],
	[
		[
			127569,
			127569
		],
		"mapped",
		[
			21487
		]
	],
	[
		[
			127570,
			127743
		],
		"disallowed"
	],
	[
		[
			127744,
			127776
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127777,
			127788
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127789,
			127791
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127792,
			127797
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127798,
			127798
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127799,
			127868
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127869,
			127869
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127870,
			127871
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127872,
			127891
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127892,
			127903
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127904,
			127940
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127941,
			127941
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127942,
			127946
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127947,
			127950
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127951,
			127955
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127956,
			127967
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127968,
			127984
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127985,
			127991
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			127992,
			127999
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128000,
			128062
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128063,
			128063
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128064,
			128064
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128065,
			128065
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128066,
			128247
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128248,
			128248
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128249,
			128252
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128253,
			128254
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128255,
			128255
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128256,
			128317
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128318,
			128319
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128320,
			128323
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128324,
			128330
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128331,
			128335
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128336,
			128359
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128360,
			128377
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128378,
			128378
		],
		"disallowed"
	],
	[
		[
			128379,
			128419
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128420,
			128420
		],
		"disallowed"
	],
	[
		[
			128421,
			128506
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128507,
			128511
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128512,
			128512
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128513,
			128528
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128529,
			128529
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128530,
			128532
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128533,
			128533
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128534,
			128534
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128535,
			128535
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128536,
			128536
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128537,
			128537
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128538,
			128538
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128539,
			128539
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128540,
			128542
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128543,
			128543
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128544,
			128549
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128550,
			128551
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128552,
			128555
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128556,
			128556
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128557,
			128557
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128558,
			128559
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128560,
			128563
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128564,
			128564
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128565,
			128576
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128577,
			128578
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128579,
			128580
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128581,
			128591
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128592,
			128639
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128640,
			128709
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128710,
			128719
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128720,
			128720
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128721,
			128735
		],
		"disallowed"
	],
	[
		[
			128736,
			128748
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128749,
			128751
		],
		"disallowed"
	],
	[
		[
			128752,
			128755
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128756,
			128767
		],
		"disallowed"
	],
	[
		[
			128768,
			128883
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128884,
			128895
		],
		"disallowed"
	],
	[
		[
			128896,
			128980
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			128981,
			129023
		],
		"disallowed"
	],
	[
		[
			129024,
			129035
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			129036,
			129039
		],
		"disallowed"
	],
	[
		[
			129040,
			129095
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			129096,
			129103
		],
		"disallowed"
	],
	[
		[
			129104,
			129113
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			129114,
			129119
		],
		"disallowed"
	],
	[
		[
			129120,
			129159
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			129160,
			129167
		],
		"disallowed"
	],
	[
		[
			129168,
			129197
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			129198,
			129295
		],
		"disallowed"
	],
	[
		[
			129296,
			129304
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			129305,
			129407
		],
		"disallowed"
	],
	[
		[
			129408,
			129412
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			129413,
			129471
		],
		"disallowed"
	],
	[
		[
			129472,
			129472
		],
		"valid",
		[
		],
		"NV8"
	],
	[
		[
			129473,
			131069
		],
		"disallowed"
	],
	[
		[
			131070,
			131071
		],
		"disallowed"
	],
	[
		[
			131072,
			173782
		],
		"valid"
	],
	[
		[
			173783,
			173823
		],
		"disallowed"
	],
	[
		[
			173824,
			177972
		],
		"valid"
	],
	[
		[
			177973,
			177983
		],
		"disallowed"
	],
	[
		[
			177984,
			178205
		],
		"valid"
	],
	[
		[
			178206,
			178207
		],
		"disallowed"
	],
	[
		[
			178208,
			183969
		],
		"valid"
	],
	[
		[
			183970,
			194559
		],
		"disallowed"
	],
	[
		[
			194560,
			194560
		],
		"mapped",
		[
			20029
		]
	],
	[
		[
			194561,
			194561
		],
		"mapped",
		[
			20024
		]
	],
	[
		[
			194562,
			194562
		],
		"mapped",
		[
			20033
		]
	],
	[
		[
			194563,
			194563
		],
		"mapped",
		[
			131362
		]
	],
	[
		[
			194564,
			194564
		],
		"mapped",
		[
			20320
		]
	],
	[
		[
			194565,
			194565
		],
		"mapped",
		[
			20398
		]
	],
	[
		[
			194566,
			194566
		],
		"mapped",
		[
			20411
		]
	],
	[
		[
			194567,
			194567
		],
		"mapped",
		[
			20482
		]
	],
	[
		[
			194568,
			194568
		],
		"mapped",
		[
			20602
		]
	],
	[
		[
			194569,
			194569
		],
		"mapped",
		[
			20633
		]
	],
	[
		[
			194570,
			194570
		],
		"mapped",
		[
			20711
		]
	],
	[
		[
			194571,
			194571
		],
		"mapped",
		[
			20687
		]
	],
	[
		[
			194572,
			194572
		],
		"mapped",
		[
			13470
		]
	],
	[
		[
			194573,
			194573
		],
		"mapped",
		[
			132666
		]
	],
	[
		[
			194574,
			194574
		],
		"mapped",
		[
			20813
		]
	],
	[
		[
			194575,
			194575
		],
		"mapped",
		[
			20820
		]
	],
	[
		[
			194576,
			194576
		],
		"mapped",
		[
			20836
		]
	],
	[
		[
			194577,
			194577
		],
		"mapped",
		[
			20855
		]
	],
	[
		[
			194578,
			194578
		],
		"mapped",
		[
			132380
		]
	],
	[
		[
			194579,
			194579
		],
		"mapped",
		[
			13497
		]
	],
	[
		[
			194580,
			194580
		],
		"mapped",
		[
			20839
		]
	],
	[
		[
			194581,
			194581
		],
		"mapped",
		[
			20877
		]
	],
	[
		[
			194582,
			194582
		],
		"mapped",
		[
			132427
		]
	],
	[
		[
			194583,
			194583
		],
		"mapped",
		[
			20887
		]
	],
	[
		[
			194584,
			194584
		],
		"mapped",
		[
			20900
		]
	],
	[
		[
			194585,
			194585
		],
		"mapped",
		[
			20172
		]
	],
	[
		[
			194586,
			194586
		],
		"mapped",
		[
			20908
		]
	],
	[
		[
			194587,
			194587
		],
		"mapped",
		[
			20917
		]
	],
	[
		[
			194588,
			194588
		],
		"mapped",
		[
			168415
		]
	],
	[
		[
			194589,
			194589
		],
		"mapped",
		[
			20981
		]
	],
	[
		[
			194590,
			194590
		],
		"mapped",
		[
			20995
		]
	],
	[
		[
			194591,
			194591
		],
		"mapped",
		[
			13535
		]
	],
	[
		[
			194592,
			194592
		],
		"mapped",
		[
			21051
		]
	],
	[
		[
			194593,
			194593
		],
		"mapped",
		[
			21062
		]
	],
	[
		[
			194594,
			194594
		],
		"mapped",
		[
			21106
		]
	],
	[
		[
			194595,
			194595
		],
		"mapped",
		[
			21111
		]
	],
	[
		[
			194596,
			194596
		],
		"mapped",
		[
			13589
		]
	],
	[
		[
			194597,
			194597
		],
		"mapped",
		[
			21191
		]
	],
	[
		[
			194598,
			194598
		],
		"mapped",
		[
			21193
		]
	],
	[
		[
			194599,
			194599
		],
		"mapped",
		[
			21220
		]
	],
	[
		[
			194600,
			194600
		],
		"mapped",
		[
			21242
		]
	],
	[
		[
			194601,
			194601
		],
		"mapped",
		[
			21253
		]
	],
	[
		[
			194602,
			194602
		],
		"mapped",
		[
			21254
		]
	],
	[
		[
			194603,
			194603
		],
		"mapped",
		[
			21271
		]
	],
	[
		[
			194604,
			194604
		],
		"mapped",
		[
			21321
		]
	],
	[
		[
			194605,
			194605
		],
		"mapped",
		[
			21329
		]
	],
	[
		[
			194606,
			194606
		],
		"mapped",
		[
			21338
		]
	],
	[
		[
			194607,
			194607
		],
		"mapped",
		[
			21363
		]
	],
	[
		[
			194608,
			194608
		],
		"mapped",
		[
			21373
		]
	],
	[
		[
			194609,
			194611
		],
		"mapped",
		[
			21375
		]
	],
	[
		[
			194612,
			194612
		],
		"mapped",
		[
			133676
		]
	],
	[
		[
			194613,
			194613
		],
		"mapped",
		[
			28784
		]
	],
	[
		[
			194614,
			194614
		],
		"mapped",
		[
			21450
		]
	],
	[
		[
			194615,
			194615
		],
		"mapped",
		[
			21471
		]
	],
	[
		[
			194616,
			194616
		],
		"mapped",
		[
			133987
		]
	],
	[
		[
			194617,
			194617
		],
		"mapped",
		[
			21483
		]
	],
	[
		[
			194618,
			194618
		],
		"mapped",
		[
			21489
		]
	],
	[
		[
			194619,
			194619
		],
		"mapped",
		[
			21510
		]
	],
	[
		[
			194620,
			194620
		],
		"mapped",
		[
			21662
		]
	],
	[
		[
			194621,
			194621
		],
		"mapped",
		[
			21560
		]
	],
	[
		[
			194622,
			194622
		],
		"mapped",
		[
			21576
		]
	],
	[
		[
			194623,
			194623
		],
		"mapped",
		[
			21608
		]
	],
	[
		[
			194624,
			194624
		],
		"mapped",
		[
			21666
		]
	],
	[
		[
			194625,
			194625
		],
		"mapped",
		[
			21750
		]
	],
	[
		[
			194626,
			194626
		],
		"mapped",
		[
			21776
		]
	],
	[
		[
			194627,
			194627
		],
		"mapped",
		[
			21843
		]
	],
	[
		[
			194628,
			194628
		],
		"mapped",
		[
			21859
		]
	],
	[
		[
			194629,
			194630
		],
		"mapped",
		[
			21892
		]
	],
	[
		[
			194631,
			194631
		],
		"mapped",
		[
			21913
		]
	],
	[
		[
			194632,
			194632
		],
		"mapped",
		[
			21931
		]
	],
	[
		[
			194633,
			194633
		],
		"mapped",
		[
			21939
		]
	],
	[
		[
			194634,
			194634
		],
		"mapped",
		[
			21954
		]
	],
	[
		[
			194635,
			194635
		],
		"mapped",
		[
			22294
		]
	],
	[
		[
			194636,
			194636
		],
		"mapped",
		[
			22022
		]
	],
	[
		[
			194637,
			194637
		],
		"mapped",
		[
			22295
		]
	],
	[
		[
			194638,
			194638
		],
		"mapped",
		[
			22097
		]
	],
	[
		[
			194639,
			194639
		],
		"mapped",
		[
			22132
		]
	],
	[
		[
			194640,
			194640
		],
		"mapped",
		[
			20999
		]
	],
	[
		[
			194641,
			194641
		],
		"mapped",
		[
			22766
		]
	],
	[
		[
			194642,
			194642
		],
		"mapped",
		[
			22478
		]
	],
	[
		[
			194643,
			194643
		],
		"mapped",
		[
			22516
		]
	],
	[
		[
			194644,
			194644
		],
		"mapped",
		[
			22541
		]
	],
	[
		[
			194645,
			194645
		],
		"mapped",
		[
			22411
		]
	],
	[
		[
			194646,
			194646
		],
		"mapped",
		[
			22578
		]
	],
	[
		[
			194647,
			194647
		],
		"mapped",
		[
			22577
		]
	],
	[
		[
			194648,
			194648
		],
		"mapped",
		[
			22700
		]
	],
	[
		[
			194649,
			194649
		],
		"mapped",
		[
			136420
		]
	],
	[
		[
			194650,
			194650
		],
		"mapped",
		[
			22770
		]
	],
	[
		[
			194651,
			194651
		],
		"mapped",
		[
			22775
		]
	],
	[
		[
			194652,
			194652
		],
		"mapped",
		[
			22790
		]
	],
	[
		[
			194653,
			194653
		],
		"mapped",
		[
			22810
		]
	],
	[
		[
			194654,
			194654
		],
		"mapped",
		[
			22818
		]
	],
	[
		[
			194655,
			194655
		],
		"mapped",
		[
			22882
		]
	],
	[
		[
			194656,
			194656
		],
		"mapped",
		[
			136872
		]
	],
	[
		[
			194657,
			194657
		],
		"mapped",
		[
			136938
		]
	],
	[
		[
			194658,
			194658
		],
		"mapped",
		[
			23020
		]
	],
	[
		[
			194659,
			194659
		],
		"mapped",
		[
			23067
		]
	],
	[
		[
			194660,
			194660
		],
		"mapped",
		[
			23079
		]
	],
	[
		[
			194661,
			194661
		],
		"mapped",
		[
			23000
		]
	],
	[
		[
			194662,
			194662
		],
		"mapped",
		[
			23142
		]
	],
	[
		[
			194663,
			194663
		],
		"mapped",
		[
			14062
		]
	],
	[
		[
			194664,
			194664
		],
		"disallowed"
	],
	[
		[
			194665,
			194665
		],
		"mapped",
		[
			23304
		]
	],
	[
		[
			194666,
			194667
		],
		"mapped",
		[
			23358
		]
	],
	[
		[
			194668,
			194668
		],
		"mapped",
		[
			137672
		]
	],
	[
		[
			194669,
			194669
		],
		"mapped",
		[
			23491
		]
	],
	[
		[
			194670,
			194670
		],
		"mapped",
		[
			23512
		]
	],
	[
		[
			194671,
			194671
		],
		"mapped",
		[
			23527
		]
	],
	[
		[
			194672,
			194672
		],
		"mapped",
		[
			23539
		]
	],
	[
		[
			194673,
			194673
		],
		"mapped",
		[
			138008
		]
	],
	[
		[
			194674,
			194674
		],
		"mapped",
		[
			23551
		]
	],
	[
		[
			194675,
			194675
		],
		"mapped",
		[
			23558
		]
	],
	[
		[
			194676,
			194676
		],
		"disallowed"
	],
	[
		[
			194677,
			194677
		],
		"mapped",
		[
			23586
		]
	],
	[
		[
			194678,
			194678
		],
		"mapped",
		[
			14209
		]
	],
	[
		[
			194679,
			194679
		],
		"mapped",
		[
			23648
		]
	],
	[
		[
			194680,
			194680
		],
		"mapped",
		[
			23662
		]
	],
	[
		[
			194681,
			194681
		],
		"mapped",
		[
			23744
		]
	],
	[
		[
			194682,
			194682
		],
		"mapped",
		[
			23693
		]
	],
	[
		[
			194683,
			194683
		],
		"mapped",
		[
			138724
		]
	],
	[
		[
			194684,
			194684
		],
		"mapped",
		[
			23875
		]
	],
	[
		[
			194685,
			194685
		],
		"mapped",
		[
			138726
		]
	],
	[
		[
			194686,
			194686
		],
		"mapped",
		[
			23918
		]
	],
	[
		[
			194687,
			194687
		],
		"mapped",
		[
			23915
		]
	],
	[
		[
			194688,
			194688
		],
		"mapped",
		[
			23932
		]
	],
	[
		[
			194689,
			194689
		],
		"mapped",
		[
			24033
		]
	],
	[
		[
			194690,
			194690
		],
		"mapped",
		[
			24034
		]
	],
	[
		[
			194691,
			194691
		],
		"mapped",
		[
			14383
		]
	],
	[
		[
			194692,
			194692
		],
		"mapped",
		[
			24061
		]
	],
	[
		[
			194693,
			194693
		],
		"mapped",
		[
			24104
		]
	],
	[
		[
			194694,
			194694
		],
		"mapped",
		[
			24125
		]
	],
	[
		[
			194695,
			194695
		],
		"mapped",
		[
			24169
		]
	],
	[
		[
			194696,
			194696
		],
		"mapped",
		[
			14434
		]
	],
	[
		[
			194697,
			194697
		],
		"mapped",
		[
			139651
		]
	],
	[
		[
			194698,
			194698
		],
		"mapped",
		[
			14460
		]
	],
	[
		[
			194699,
			194699
		],
		"mapped",
		[
			24240
		]
	],
	[
		[
			194700,
			194700
		],
		"mapped",
		[
			24243
		]
	],
	[
		[
			194701,
			194701
		],
		"mapped",
		[
			24246
		]
	],
	[
		[
			194702,
			194702
		],
		"mapped",
		[
			24266
		]
	],
	[
		[
			194703,
			194703
		],
		"mapped",
		[
			172946
		]
	],
	[
		[
			194704,
			194704
		],
		"mapped",
		[
			24318
		]
	],
	[
		[
			194705,
			194706
		],
		"mapped",
		[
			140081
		]
	],
	[
		[
			194707,
			194707
		],
		"mapped",
		[
			33281
		]
	],
	[
		[
			194708,
			194709
		],
		"mapped",
		[
			24354
		]
	],
	[
		[
			194710,
			194710
		],
		"mapped",
		[
			14535
		]
	],
	[
		[
			194711,
			194711
		],
		"mapped",
		[
			144056
		]
	],
	[
		[
			194712,
			194712
		],
		"mapped",
		[
			156122
		]
	],
	[
		[
			194713,
			194713
		],
		"mapped",
		[
			24418
		]
	],
	[
		[
			194714,
			194714
		],
		"mapped",
		[
			24427
		]
	],
	[
		[
			194715,
			194715
		],
		"mapped",
		[
			14563
		]
	],
	[
		[
			194716,
			194716
		],
		"mapped",
		[
			24474
		]
	],
	[
		[
			194717,
			194717
		],
		"mapped",
		[
			24525
		]
	],
	[
		[
			194718,
			194718
		],
		"mapped",
		[
			24535
		]
	],
	[
		[
			194719,
			194719
		],
		"mapped",
		[
			24569
		]
	],
	[
		[
			194720,
			194720
		],
		"mapped",
		[
			24705
		]
	],
	[
		[
			194721,
			194721
		],
		"mapped",
		[
			14650
		]
	],
	[
		[
			194722,
			194722
		],
		"mapped",
		[
			14620
		]
	],
	[
		[
			194723,
			194723
		],
		"mapped",
		[
			24724
		]
	],
	[
		[
			194724,
			194724
		],
		"mapped",
		[
			141012
		]
	],
	[
		[
			194725,
			194725
		],
		"mapped",
		[
			24775
		]
	],
	[
		[
			194726,
			194726
		],
		"mapped",
		[
			24904
		]
	],
	[
		[
			194727,
			194727
		],
		"mapped",
		[
			24908
		]
	],
	[
		[
			194728,
			194728
		],
		"mapped",
		[
			24910
		]
	],
	[
		[
			194729,
			194729
		],
		"mapped",
		[
			24908
		]
	],
	[
		[
			194730,
			194730
		],
		"mapped",
		[
			24954
		]
	],
	[
		[
			194731,
			194731
		],
		"mapped",
		[
			24974
		]
	],
	[
		[
			194732,
			194732
		],
		"mapped",
		[
			25010
		]
	],
	[
		[
			194733,
			194733
		],
		"mapped",
		[
			24996
		]
	],
	[
		[
			194734,
			194734
		],
		"mapped",
		[
			25007
		]
	],
	[
		[
			194735,
			194735
		],
		"mapped",
		[
			25054
		]
	],
	[
		[
			194736,
			194736
		],
		"mapped",
		[
			25074
		]
	],
	[
		[
			194737,
			194737
		],
		"mapped",
		[
			25078
		]
	],
	[
		[
			194738,
			194738
		],
		"mapped",
		[
			25104
		]
	],
	[
		[
			194739,
			194739
		],
		"mapped",
		[
			25115
		]
	],
	[
		[
			194740,
			194740
		],
		"mapped",
		[
			25181
		]
	],
	[
		[
			194741,
			194741
		],
		"mapped",
		[
			25265
		]
	],
	[
		[
			194742,
			194742
		],
		"mapped",
		[
			25300
		]
	],
	[
		[
			194743,
			194743
		],
		"mapped",
		[
			25424
		]
	],
	[
		[
			194744,
			194744
		],
		"mapped",
		[
			142092
		]
	],
	[
		[
			194745,
			194745
		],
		"mapped",
		[
			25405
		]
	],
	[
		[
			194746,
			194746
		],
		"mapped",
		[
			25340
		]
	],
	[
		[
			194747,
			194747
		],
		"mapped",
		[
			25448
		]
	],
	[
		[
			194748,
			194748
		],
		"mapped",
		[
			25475
		]
	],
	[
		[
			194749,
			194749
		],
		"mapped",
		[
			25572
		]
	],
	[
		[
			194750,
			194750
		],
		"mapped",
		[
			142321
		]
	],
	[
		[
			194751,
			194751
		],
		"mapped",
		[
			25634
		]
	],
	[
		[
			194752,
			194752
		],
		"mapped",
		[
			25541
		]
	],
	[
		[
			194753,
			194753
		],
		"mapped",
		[
			25513
		]
	],
	[
		[
			194754,
			194754
		],
		"mapped",
		[
			14894
		]
	],
	[
		[
			194755,
			194755
		],
		"mapped",
		[
			25705
		]
	],
	[
		[
			194756,
			194756
		],
		"mapped",
		[
			25726
		]
	],
	[
		[
			194757,
			194757
		],
		"mapped",
		[
			25757
		]
	],
	[
		[
			194758,
			194758
		],
		"mapped",
		[
			25719
		]
	],
	[
		[
			194759,
			194759
		],
		"mapped",
		[
			14956
		]
	],
	[
		[
			194760,
			194760
		],
		"mapped",
		[
			25935
		]
	],
	[
		[
			194761,
			194761
		],
		"mapped",
		[
			25964
		]
	],
	[
		[
			194762,
			194762
		],
		"mapped",
		[
			143370
		]
	],
	[
		[
			194763,
			194763
		],
		"mapped",
		[
			26083
		]
	],
	[
		[
			194764,
			194764
		],
		"mapped",
		[
			26360
		]
	],
	[
		[
			194765,
			194765
		],
		"mapped",
		[
			26185
		]
	],
	[
		[
			194766,
			194766
		],
		"mapped",
		[
			15129
		]
	],
	[
		[
			194767,
			194767
		],
		"mapped",
		[
			26257
		]
	],
	[
		[
			194768,
			194768
		],
		"mapped",
		[
			15112
		]
	],
	[
		[
			194769,
			194769
		],
		"mapped",
		[
			15076
		]
	],
	[
		[
			194770,
			194770
		],
		"mapped",
		[
			20882
		]
	],
	[
		[
			194771,
			194771
		],
		"mapped",
		[
			20885
		]
	],
	[
		[
			194772,
			194772
		],
		"mapped",
		[
			26368
		]
	],
	[
		[
			194773,
			194773
		],
		"mapped",
		[
			26268
		]
	],
	[
		[
			194774,
			194774
		],
		"mapped",
		[
			32941
		]
	],
	[
		[
			194775,
			194775
		],
		"mapped",
		[
			17369
		]
	],
	[
		[
			194776,
			194776
		],
		"mapped",
		[
			26391
		]
	],
	[
		[
			194777,
			194777
		],
		"mapped",
		[
			26395
		]
	],
	[
		[
			194778,
			194778
		],
		"mapped",
		[
			26401
		]
	],
	[
		[
			194779,
			194779
		],
		"mapped",
		[
			26462
		]
	],
	[
		[
			194780,
			194780
		],
		"mapped",
		[
			26451
		]
	],
	[
		[
			194781,
			194781
		],
		"mapped",
		[
			144323
		]
	],
	[
		[
			194782,
			194782
		],
		"mapped",
		[
			15177
		]
	],
	[
		[
			194783,
			194783
		],
		"mapped",
		[
			26618
		]
	],
	[
		[
			194784,
			194784
		],
		"mapped",
		[
			26501
		]
	],
	[
		[
			194785,
			194785
		],
		"mapped",
		[
			26706
		]
	],
	[
		[
			194786,
			194786
		],
		"mapped",
		[
			26757
		]
	],
	[
		[
			194787,
			194787
		],
		"mapped",
		[
			144493
		]
	],
	[
		[
			194788,
			194788
		],
		"mapped",
		[
			26766
		]
	],
	[
		[
			194789,
			194789
		],
		"mapped",
		[
			26655
		]
	],
	[
		[
			194790,
			194790
		],
		"mapped",
		[
			26900
		]
	],
	[
		[
			194791,
			194791
		],
		"mapped",
		[
			15261
		]
	],
	[
		[
			194792,
			194792
		],
		"mapped",
		[
			26946
		]
	],
	[
		[
			194793,
			194793
		],
		"mapped",
		[
			27043
		]
	],
	[
		[
			194794,
			194794
		],
		"mapped",
		[
			27114
		]
	],
	[
		[
			194795,
			194795
		],
		"mapped",
		[
			27304
		]
	],
	[
		[
			194796,
			194796
		],
		"mapped",
		[
			145059
		]
	],
	[
		[
			194797,
			194797
		],
		"mapped",
		[
			27355
		]
	],
	[
		[
			194798,
			194798
		],
		"mapped",
		[
			15384
		]
	],
	[
		[
			194799,
			194799
		],
		"mapped",
		[
			27425
		]
	],
	[
		[
			194800,
			194800
		],
		"mapped",
		[
			145575
		]
	],
	[
		[
			194801,
			194801
		],
		"mapped",
		[
			27476
		]
	],
	[
		[
			194802,
			194802
		],
		"mapped",
		[
			15438
		]
	],
	[
		[
			194803,
			194803
		],
		"mapped",
		[
			27506
		]
	],
	[
		[
			194804,
			194804
		],
		"mapped",
		[
			27551
		]
	],
	[
		[
			194805,
			194805
		],
		"mapped",
		[
			27578
		]
	],
	[
		[
			194806,
			194806
		],
		"mapped",
		[
			27579
		]
	],
	[
		[
			194807,
			194807
		],
		"mapped",
		[
			146061
		]
	],
	[
		[
			194808,
			194808
		],
		"mapped",
		[
			138507
		]
	],
	[
		[
			194809,
			194809
		],
		"mapped",
		[
			146170
		]
	],
	[
		[
			194810,
			194810
		],
		"mapped",
		[
			27726
		]
	],
	[
		[
			194811,
			194811
		],
		"mapped",
		[
			146620
		]
	],
	[
		[
			194812,
			194812
		],
		"mapped",
		[
			27839
		]
	],
	[
		[
			194813,
			194813
		],
		"mapped",
		[
			27853
		]
	],
	[
		[
			194814,
			194814
		],
		"mapped",
		[
			27751
		]
	],
	[
		[
			194815,
			194815
		],
		"mapped",
		[
			27926
		]
	],
	[
		[
			194816,
			194816
		],
		"mapped",
		[
			27966
		]
	],
	[
		[
			194817,
			194817
		],
		"mapped",
		[
			28023
		]
	],
	[
		[
			194818,
			194818
		],
		"mapped",
		[
			27969
		]
	],
	[
		[
			194819,
			194819
		],
		"mapped",
		[
			28009
		]
	],
	[
		[
			194820,
			194820
		],
		"mapped",
		[
			28024
		]
	],
	[
		[
			194821,
			194821
		],
		"mapped",
		[
			28037
		]
	],
	[
		[
			194822,
			194822
		],
		"mapped",
		[
			146718
		]
	],
	[
		[
			194823,
			194823
		],
		"mapped",
		[
			27956
		]
	],
	[
		[
			194824,
			194824
		],
		"mapped",
		[
			28207
		]
	],
	[
		[
			194825,
			194825
		],
		"mapped",
		[
			28270
		]
	],
	[
		[
			194826,
			194826
		],
		"mapped",
		[
			15667
		]
	],
	[
		[
			194827,
			194827
		],
		"mapped",
		[
			28363
		]
	],
	[
		[
			194828,
			194828
		],
		"mapped",
		[
			28359
		]
	],
	[
		[
			194829,
			194829
		],
		"mapped",
		[
			147153
		]
	],
	[
		[
			194830,
			194830
		],
		"mapped",
		[
			28153
		]
	],
	[
		[
			194831,
			194831
		],
		"mapped",
		[
			28526
		]
	],
	[
		[
			194832,
			194832
		],
		"mapped",
		[
			147294
		]
	],
	[
		[
			194833,
			194833
		],
		"mapped",
		[
			147342
		]
	],
	[
		[
			194834,
			194834
		],
		"mapped",
		[
			28614
		]
	],
	[
		[
			194835,
			194835
		],
		"mapped",
		[
			28729
		]
	],
	[
		[
			194836,
			194836
		],
		"mapped",
		[
			28702
		]
	],
	[
		[
			194837,
			194837
		],
		"mapped",
		[
			28699
		]
	],
	[
		[
			194838,
			194838
		],
		"mapped",
		[
			15766
		]
	],
	[
		[
			194839,
			194839
		],
		"mapped",
		[
			28746
		]
	],
	[
		[
			194840,
			194840
		],
		"mapped",
		[
			28797
		]
	],
	[
		[
			194841,
			194841
		],
		"mapped",
		[
			28791
		]
	],
	[
		[
			194842,
			194842
		],
		"mapped",
		[
			28845
		]
	],
	[
		[
			194843,
			194843
		],
		"mapped",
		[
			132389
		]
	],
	[
		[
			194844,
			194844
		],
		"mapped",
		[
			28997
		]
	],
	[
		[
			194845,
			194845
		],
		"mapped",
		[
			148067
		]
	],
	[
		[
			194846,
			194846
		],
		"mapped",
		[
			29084
		]
	],
	[
		[
			194847,
			194847
		],
		"disallowed"
	],
	[
		[
			194848,
			194848
		],
		"mapped",
		[
			29224
		]
	],
	[
		[
			194849,
			194849
		],
		"mapped",
		[
			29237
		]
	],
	[
		[
			194850,
			194850
		],
		"mapped",
		[
			29264
		]
	],
	[
		[
			194851,
			194851
		],
		"mapped",
		[
			149000
		]
	],
	[
		[
			194852,
			194852
		],
		"mapped",
		[
			29312
		]
	],
	[
		[
			194853,
			194853
		],
		"mapped",
		[
			29333
		]
	],
	[
		[
			194854,
			194854
		],
		"mapped",
		[
			149301
		]
	],
	[
		[
			194855,
			194855
		],
		"mapped",
		[
			149524
		]
	],
	[
		[
			194856,
			194856
		],
		"mapped",
		[
			29562
		]
	],
	[
		[
			194857,
			194857
		],
		"mapped",
		[
			29579
		]
	],
	[
		[
			194858,
			194858
		],
		"mapped",
		[
			16044
		]
	],
	[
		[
			194859,
			194859
		],
		"mapped",
		[
			29605
		]
	],
	[
		[
			194860,
			194861
		],
		"mapped",
		[
			16056
		]
	],
	[
		[
			194862,
			194862
		],
		"mapped",
		[
			29767
		]
	],
	[
		[
			194863,
			194863
		],
		"mapped",
		[
			29788
		]
	],
	[
		[
			194864,
			194864
		],
		"mapped",
		[
			29809
		]
	],
	[
		[
			194865,
			194865
		],
		"mapped",
		[
			29829
		]
	],
	[
		[
			194866,
			194866
		],
		"mapped",
		[
			29898
		]
	],
	[
		[
			194867,
			194867
		],
		"mapped",
		[
			16155
		]
	],
	[
		[
			194868,
			194868
		],
		"mapped",
		[
			29988
		]
	],
	[
		[
			194869,
			194869
		],
		"mapped",
		[
			150582
		]
	],
	[
		[
			194870,
			194870
		],
		"mapped",
		[
			30014
		]
	],
	[
		[
			194871,
			194871
		],
		"mapped",
		[
			150674
		]
	],
	[
		[
			194872,
			194872
		],
		"mapped",
		[
			30064
		]
	],
	[
		[
			194873,
			194873
		],
		"mapped",
		[
			139679
		]
	],
	[
		[
			194874,
			194874
		],
		"mapped",
		[
			30224
		]
	],
	[
		[
			194875,
			194875
		],
		"mapped",
		[
			151457
		]
	],
	[
		[
			194876,
			194876
		],
		"mapped",
		[
			151480
		]
	],
	[
		[
			194877,
			194877
		],
		"mapped",
		[
			151620
		]
	],
	[
		[
			194878,
			194878
		],
		"mapped",
		[
			16380
		]
	],
	[
		[
			194879,
			194879
		],
		"mapped",
		[
			16392
		]
	],
	[
		[
			194880,
			194880
		],
		"mapped",
		[
			30452
		]
	],
	[
		[
			194881,
			194881
		],
		"mapped",
		[
			151795
		]
	],
	[
		[
			194882,
			194882
		],
		"mapped",
		[
			151794
		]
	],
	[
		[
			194883,
			194883
		],
		"mapped",
		[
			151833
		]
	],
	[
		[
			194884,
			194884
		],
		"mapped",
		[
			151859
		]
	],
	[
		[
			194885,
			194885
		],
		"mapped",
		[
			30494
		]
	],
	[
		[
			194886,
			194887
		],
		"mapped",
		[
			30495
		]
	],
	[
		[
			194888,
			194888
		],
		"mapped",
		[
			30538
		]
	],
	[
		[
			194889,
			194889
		],
		"mapped",
		[
			16441
		]
	],
	[
		[
			194890,
			194890
		],
		"mapped",
		[
			30603
		]
	],
	[
		[
			194891,
			194891
		],
		"mapped",
		[
			16454
		]
	],
	[
		[
			194892,
			194892
		],
		"mapped",
		[
			16534
		]
	],
	[
		[
			194893,
			194893
		],
		"mapped",
		[
			152605
		]
	],
	[
		[
			194894,
			194894
		],
		"mapped",
		[
			30798
		]
	],
	[
		[
			194895,
			194895
		],
		"mapped",
		[
			30860
		]
	],
	[
		[
			194896,
			194896
		],
		"mapped",
		[
			30924
		]
	],
	[
		[
			194897,
			194897
		],
		"mapped",
		[
			16611
		]
	],
	[
		[
			194898,
			194898
		],
		"mapped",
		[
			153126
		]
	],
	[
		[
			194899,
			194899
		],
		"mapped",
		[
			31062
		]
	],
	[
		[
			194900,
			194900
		],
		"mapped",
		[
			153242
		]
	],
	[
		[
			194901,
			194901
		],
		"mapped",
		[
			153285
		]
	],
	[
		[
			194902,
			194902
		],
		"mapped",
		[
			31119
		]
	],
	[
		[
			194903,
			194903
		],
		"mapped",
		[
			31211
		]
	],
	[
		[
			194904,
			194904
		],
		"mapped",
		[
			16687
		]
	],
	[
		[
			194905,
			194905
		],
		"mapped",
		[
			31296
		]
	],
	[
		[
			194906,
			194906
		],
		"mapped",
		[
			31306
		]
	],
	[
		[
			194907,
			194907
		],
		"mapped",
		[
			31311
		]
	],
	[
		[
			194908,
			194908
		],
		"mapped",
		[
			153980
		]
	],
	[
		[
			194909,
			194910
		],
		"mapped",
		[
			154279
		]
	],
	[
		[
			194911,
			194911
		],
		"disallowed"
	],
	[
		[
			194912,
			194912
		],
		"mapped",
		[
			16898
		]
	],
	[
		[
			194913,
			194913
		],
		"mapped",
		[
			154539
		]
	],
	[
		[
			194914,
			194914
		],
		"mapped",
		[
			31686
		]
	],
	[
		[
			194915,
			194915
		],
		"mapped",
		[
			31689
		]
	],
	[
		[
			194916,
			194916
		],
		"mapped",
		[
			16935
		]
	],
	[
		[
			194917,
			194917
		],
		"mapped",
		[
			154752
		]
	],
	[
		[
			194918,
			194918
		],
		"mapped",
		[
			31954
		]
	],
	[
		[
			194919,
			194919
		],
		"mapped",
		[
			17056
		]
	],
	[
		[
			194920,
			194920
		],
		"mapped",
		[
			31976
		]
	],
	[
		[
			194921,
			194921
		],
		"mapped",
		[
			31971
		]
	],
	[
		[
			194922,
			194922
		],
		"mapped",
		[
			32000
		]
	],
	[
		[
			194923,
			194923
		],
		"mapped",
		[
			155526
		]
	],
	[
		[
			194924,
			194924
		],
		"mapped",
		[
			32099
		]
	],
	[
		[
			194925,
			194925
		],
		"mapped",
		[
			17153
		]
	],
	[
		[
			194926,
			194926
		],
		"mapped",
		[
			32199
		]
	],
	[
		[
			194927,
			194927
		],
		"mapped",
		[
			32258
		]
	],
	[
		[
			194928,
			194928
		],
		"mapped",
		[
			32325
		]
	],
	[
		[
			194929,
			194929
		],
		"mapped",
		[
			17204
		]
	],
	[
		[
			194930,
			194930
		],
		"mapped",
		[
			156200
		]
	],
	[
		[
			194931,
			194931
		],
		"mapped",
		[
			156231
		]
	],
	[
		[
			194932,
			194932
		],
		"mapped",
		[
			17241
		]
	],
	[
		[
			194933,
			194933
		],
		"mapped",
		[
			156377
		]
	],
	[
		[
			194934,
			194934
		],
		"mapped",
		[
			32634
		]
	],
	[
		[
			194935,
			194935
		],
		"mapped",
		[
			156478
		]
	],
	[
		[
			194936,
			194936
		],
		"mapped",
		[
			32661
		]
	],
	[
		[
			194937,
			194937
		],
		"mapped",
		[
			32762
		]
	],
	[
		[
			194938,
			194938
		],
		"mapped",
		[
			32773
		]
	],
	[
		[
			194939,
			194939
		],
		"mapped",
		[
			156890
		]
	],
	[
		[
			194940,
			194940
		],
		"mapped",
		[
			156963
		]
	],
	[
		[
			194941,
			194941
		],
		"mapped",
		[
			32864
		]
	],
	[
		[
			194942,
			194942
		],
		"mapped",
		[
			157096
		]
	],
	[
		[
			194943,
			194943
		],
		"mapped",
		[
			32880
		]
	],
	[
		[
			194944,
			194944
		],
		"mapped",
		[
			144223
		]
	],
	[
		[
			194945,
			194945
		],
		"mapped",
		[
			17365
		]
	],
	[
		[
			194946,
			194946
		],
		"mapped",
		[
			32946
		]
	],
	[
		[
			194947,
			194947
		],
		"mapped",
		[
			33027
		]
	],
	[
		[
			194948,
			194948
		],
		"mapped",
		[
			17419
		]
	],
	[
		[
			194949,
			194949
		],
		"mapped",
		[
			33086
		]
	],
	[
		[
			194950,
			194950
		],
		"mapped",
		[
			23221
		]
	],
	[
		[
			194951,
			194951
		],
		"mapped",
		[
			157607
		]
	],
	[
		[
			194952,
			194952
		],
		"mapped",
		[
			157621
		]
	],
	[
		[
			194953,
			194953
		],
		"mapped",
		[
			144275
		]
	],
	[
		[
			194954,
			194954
		],
		"mapped",
		[
			144284
		]
	],
	[
		[
			194955,
			194955
		],
		"mapped",
		[
			33281
		]
	],
	[
		[
			194956,
			194956
		],
		"mapped",
		[
			33284
		]
	],
	[
		[
			194957,
			194957
		],
		"mapped",
		[
			36766
		]
	],
	[
		[
			194958,
			194958
		],
		"mapped",
		[
			17515
		]
	],
	[
		[
			194959,
			194959
		],
		"mapped",
		[
			33425
		]
	],
	[
		[
			194960,
			194960
		],
		"mapped",
		[
			33419
		]
	],
	[
		[
			194961,
			194961
		],
		"mapped",
		[
			33437
		]
	],
	[
		[
			194962,
			194962
		],
		"mapped",
		[
			21171
		]
	],
	[
		[
			194963,
			194963
		],
		"mapped",
		[
			33457
		]
	],
	[
		[
			194964,
			194964
		],
		"mapped",
		[
			33459
		]
	],
	[
		[
			194965,
			194965
		],
		"mapped",
		[
			33469
		]
	],
	[
		[
			194966,
			194966
		],
		"mapped",
		[
			33510
		]
	],
	[
		[
			194967,
			194967
		],
		"mapped",
		[
			158524
		]
	],
	[
		[
			194968,
			194968
		],
		"mapped",
		[
			33509
		]
	],
	[
		[
			194969,
			194969
		],
		"mapped",
		[
			33565
		]
	],
	[
		[
			194970,
			194970
		],
		"mapped",
		[
			33635
		]
	],
	[
		[
			194971,
			194971
		],
		"mapped",
		[
			33709
		]
	],
	[
		[
			194972,
			194972
		],
		"mapped",
		[
			33571
		]
	],
	[
		[
			194973,
			194973
		],
		"mapped",
		[
			33725
		]
	],
	[
		[
			194974,
			194974
		],
		"mapped",
		[
			33767
		]
	],
	[
		[
			194975,
			194975
		],
		"mapped",
		[
			33879
		]
	],
	[
		[
			194976,
			194976
		],
		"mapped",
		[
			33619
		]
	],
	[
		[
			194977,
			194977
		],
		"mapped",
		[
			33738
		]
	],
	[
		[
			194978,
			194978
		],
		"mapped",
		[
			33740
		]
	],
	[
		[
			194979,
			194979
		],
		"mapped",
		[
			33756
		]
	],
	[
		[
			194980,
			194980
		],
		"mapped",
		[
			158774
		]
	],
	[
		[
			194981,
			194981
		],
		"mapped",
		[
			159083
		]
	],
	[
		[
			194982,
			194982
		],
		"mapped",
		[
			158933
		]
	],
	[
		[
			194983,
			194983
		],
		"mapped",
		[
			17707
		]
	],
	[
		[
			194984,
			194984
		],
		"mapped",
		[
			34033
		]
	],
	[
		[
			194985,
			194985
		],
		"mapped",
		[
			34035
		]
	],
	[
		[
			194986,
			194986
		],
		"mapped",
		[
			34070
		]
	],
	[
		[
			194987,
			194987
		],
		"mapped",
		[
			160714
		]
	],
	[
		[
			194988,
			194988
		],
		"mapped",
		[
			34148
		]
	],
	[
		[
			194989,
			194989
		],
		"mapped",
		[
			159532
		]
	],
	[
		[
			194990,
			194990
		],
		"mapped",
		[
			17757
		]
	],
	[
		[
			194991,
			194991
		],
		"mapped",
		[
			17761
		]
	],
	[
		[
			194992,
			194992
		],
		"mapped",
		[
			159665
		]
	],
	[
		[
			194993,
			194993
		],
		"mapped",
		[
			159954
		]
	],
	[
		[
			194994,
			194994
		],
		"mapped",
		[
			17771
		]
	],
	[
		[
			194995,
			194995
		],
		"mapped",
		[
			34384
		]
	],
	[
		[
			194996,
			194996
		],
		"mapped",
		[
			34396
		]
	],
	[
		[
			194997,
			194997
		],
		"mapped",
		[
			34407
		]
	],
	[
		[
			194998,
			194998
		],
		"mapped",
		[
			34409
		]
	],
	[
		[
			194999,
			194999
		],
		"mapped",
		[
			34473
		]
	],
	[
		[
			195000,
			195000
		],
		"mapped",
		[
			34440
		]
	],
	[
		[
			195001,
			195001
		],
		"mapped",
		[
			34574
		]
	],
	[
		[
			195002,
			195002
		],
		"mapped",
		[
			34530
		]
	],
	[
		[
			195003,
			195003
		],
		"mapped",
		[
			34681
		]
	],
	[
		[
			195004,
			195004
		],
		"mapped",
		[
			34600
		]
	],
	[
		[
			195005,
			195005
		],
		"mapped",
		[
			34667
		]
	],
	[
		[
			195006,
			195006
		],
		"mapped",
		[
			34694
		]
	],
	[
		[
			195007,
			195007
		],
		"disallowed"
	],
	[
		[
			195008,
			195008
		],
		"mapped",
		[
			34785
		]
	],
	[
		[
			195009,
			195009
		],
		"mapped",
		[
			34817
		]
	],
	[
		[
			195010,
			195010
		],
		"mapped",
		[
			17913
		]
	],
	[
		[
			195011,
			195011
		],
		"mapped",
		[
			34912
		]
	],
	[
		[
			195012,
			195012
		],
		"mapped",
		[
			34915
		]
	],
	[
		[
			195013,
			195013
		],
		"mapped",
		[
			161383
		]
	],
	[
		[
			195014,
			195014
		],
		"mapped",
		[
			35031
		]
	],
	[
		[
			195015,
			195015
		],
		"mapped",
		[
			35038
		]
	],
	[
		[
			195016,
			195016
		],
		"mapped",
		[
			17973
		]
	],
	[
		[
			195017,
			195017
		],
		"mapped",
		[
			35066
		]
	],
	[
		[
			195018,
			195018
		],
		"mapped",
		[
			13499
		]
	],
	[
		[
			195019,
			195019
		],
		"mapped",
		[
			161966
		]
	],
	[
		[
			195020,
			195020
		],
		"mapped",
		[
			162150
		]
	],
	[
		[
			195021,
			195021
		],
		"mapped",
		[
			18110
		]
	],
	[
		[
			195022,
			195022
		],
		"mapped",
		[
			18119
		]
	],
	[
		[
			195023,
			195023
		],
		"mapped",
		[
			35488
		]
	],
	[
		[
			195024,
			195024
		],
		"mapped",
		[
			35565
		]
	],
	[
		[
			195025,
			195025
		],
		"mapped",
		[
			35722
		]
	],
	[
		[
			195026,
			195026
		],
		"mapped",
		[
			35925
		]
	],
	[
		[
			195027,
			195027
		],
		"mapped",
		[
			162984
		]
	],
	[
		[
			195028,
			195028
		],
		"mapped",
		[
			36011
		]
	],
	[
		[
			195029,
			195029
		],
		"mapped",
		[
			36033
		]
	],
	[
		[
			195030,
			195030
		],
		"mapped",
		[
			36123
		]
	],
	[
		[
			195031,
			195031
		],
		"mapped",
		[
			36215
		]
	],
	[
		[
			195032,
			195032
		],
		"mapped",
		[
			163631
		]
	],
	[
		[
			195033,
			195033
		],
		"mapped",
		[
			133124
		]
	],
	[
		[
			195034,
			195034
		],
		"mapped",
		[
			36299
		]
	],
	[
		[
			195035,
			195035
		],
		"mapped",
		[
			36284
		]
	],
	[
		[
			195036,
			195036
		],
		"mapped",
		[
			36336
		]
	],
	[
		[
			195037,
			195037
		],
		"mapped",
		[
			133342
		]
	],
	[
		[
			195038,
			195038
		],
		"mapped",
		[
			36564
		]
	],
	[
		[
			195039,
			195039
		],
		"mapped",
		[
			36664
		]
	],
	[
		[
			195040,
			195040
		],
		"mapped",
		[
			165330
		]
	],
	[
		[
			195041,
			195041
		],
		"mapped",
		[
			165357
		]
	],
	[
		[
			195042,
			195042
		],
		"mapped",
		[
			37012
		]
	],
	[
		[
			195043,
			195043
		],
		"mapped",
		[
			37105
		]
	],
	[
		[
			195044,
			195044
		],
		"mapped",
		[
			37137
		]
	],
	[
		[
			195045,
			195045
		],
		"mapped",
		[
			165678
		]
	],
	[
		[
			195046,
			195046
		],
		"mapped",
		[
			37147
		]
	],
	[
		[
			195047,
			195047
		],
		"mapped",
		[
			37432
		]
	],
	[
		[
			195048,
			195048
		],
		"mapped",
		[
			37591
		]
	],
	[
		[
			195049,
			195049
		],
		"mapped",
		[
			37592
		]
	],
	[
		[
			195050,
			195050
		],
		"mapped",
		[
			37500
		]
	],
	[
		[
			195051,
			195051
		],
		"mapped",
		[
			37881
		]
	],
	[
		[
			195052,
			195052
		],
		"mapped",
		[
			37909
		]
	],
	[
		[
			195053,
			195053
		],
		"mapped",
		[
			166906
		]
	],
	[
		[
			195054,
			195054
		],
		"mapped",
		[
			38283
		]
	],
	[
		[
			195055,
			195055
		],
		"mapped",
		[
			18837
		]
	],
	[
		[
			195056,
			195056
		],
		"mapped",
		[
			38327
		]
	],
	[
		[
			195057,
			195057
		],
		"mapped",
		[
			167287
		]
	],
	[
		[
			195058,
			195058
		],
		"mapped",
		[
			18918
		]
	],
	[
		[
			195059,
			195059
		],
		"mapped",
		[
			38595
		]
	],
	[
		[
			195060,
			195060
		],
		"mapped",
		[
			23986
		]
	],
	[
		[
			195061,
			195061
		],
		"mapped",
		[
			38691
		]
	],
	[
		[
			195062,
			195062
		],
		"mapped",
		[
			168261
		]
	],
	[
		[
			195063,
			195063
		],
		"mapped",
		[
			168474
		]
	],
	[
		[
			195064,
			195064
		],
		"mapped",
		[
			19054
		]
	],
	[
		[
			195065,
			195065
		],
		"mapped",
		[
			19062
		]
	],
	[
		[
			195066,
			195066
		],
		"mapped",
		[
			38880
		]
	],
	[
		[
			195067,
			195067
		],
		"mapped",
		[
			168970
		]
	],
	[
		[
			195068,
			195068
		],
		"mapped",
		[
			19122
		]
	],
	[
		[
			195069,
			195069
		],
		"mapped",
		[
			169110
		]
	],
	[
		[
			195070,
			195071
		],
		"mapped",
		[
			38923
		]
	],
	[
		[
			195072,
			195072
		],
		"mapped",
		[
			38953
		]
	],
	[
		[
			195073,
			195073
		],
		"mapped",
		[
			169398
		]
	],
	[
		[
			195074,
			195074
		],
		"mapped",
		[
			39138
		]
	],
	[
		[
			195075,
			195075
		],
		"mapped",
		[
			19251
		]
	],
	[
		[
			195076,
			195076
		],
		"mapped",
		[
			39209
		]
	],
	[
		[
			195077,
			195077
		],
		"mapped",
		[
			39335
		]
	],
	[
		[
			195078,
			195078
		],
		"mapped",
		[
			39362
		]
	],
	[
		[
			195079,
			195079
		],
		"mapped",
		[
			39422
		]
	],
	[
		[
			195080,
			195080
		],
		"mapped",
		[
			19406
		]
	],
	[
		[
			195081,
			195081
		],
		"mapped",
		[
			170800
		]
	],
	[
		[
			195082,
			195082
		],
		"mapped",
		[
			39698
		]
	],
	[
		[
			195083,
			195083
		],
		"mapped",
		[
			40000
		]
	],
	[
		[
			195084,
			195084
		],
		"mapped",
		[
			40189
		]
	],
	[
		[
			195085,
			195085
		],
		"mapped",
		[
			19662
		]
	],
	[
		[
			195086,
			195086
		],
		"mapped",
		[
			19693
		]
	],
	[
		[
			195087,
			195087
		],
		"mapped",
		[
			40295
		]
	],
	[
		[
			195088,
			195088
		],
		"mapped",
		[
			172238
		]
	],
	[
		[
			195089,
			195089
		],
		"mapped",
		[
			19704
		]
	],
	[
		[
			195090,
			195090
		],
		"mapped",
		[
			172293
		]
	],
	[
		[
			195091,
			195091
		],
		"mapped",
		[
			172558
		]
	],
	[
		[
			195092,
			195092
		],
		"mapped",
		[
			172689
		]
	],
	[
		[
			195093,
			195093
		],
		"mapped",
		[
			40635
		]
	],
	[
		[
			195094,
			195094
		],
		"mapped",
		[
			19798
		]
	],
	[
		[
			195095,
			195095
		],
		"mapped",
		[
			40697
		]
	],
	[
		[
			195096,
			195096
		],
		"mapped",
		[
			40702
		]
	],
	[
		[
			195097,
			195097
		],
		"mapped",
		[
			40709
		]
	],
	[
		[
			195098,
			195098
		],
		"mapped",
		[
			40719
		]
	],
	[
		[
			195099,
			195099
		],
		"mapped",
		[
			40726
		]
	],
	[
		[
			195100,
			195100
		],
		"mapped",
		[
			40763
		]
	],
	[
		[
			195101,
			195101
		],
		"mapped",
		[
			173568
		]
	],
	[
		[
			195102,
			196605
		],
		"disallowed"
	],
	[
		[
			196606,
			196607
		],
		"disallowed"
	],
	[
		[
			196608,
			262141
		],
		"disallowed"
	],
	[
		[
			262142,
			262143
		],
		"disallowed"
	],
	[
		[
			262144,
			327677
		],
		"disallowed"
	],
	[
		[
			327678,
			327679
		],
		"disallowed"
	],
	[
		[
			327680,
			393213
		],
		"disallowed"
	],
	[
		[
			393214,
			393215
		],
		"disallowed"
	],
	[
		[
			393216,
			458749
		],
		"disallowed"
	],
	[
		[
			458750,
			458751
		],
		"disallowed"
	],
	[
		[
			458752,
			524285
		],
		"disallowed"
	],
	[
		[
			524286,
			524287
		],
		"disallowed"
	],
	[
		[
			524288,
			589821
		],
		"disallowed"
	],
	[
		[
			589822,
			589823
		],
		"disallowed"
	],
	[
		[
			589824,
			655357
		],
		"disallowed"
	],
	[
		[
			655358,
			655359
		],
		"disallowed"
	],
	[
		[
			655360,
			720893
		],
		"disallowed"
	],
	[
		[
			720894,
			720895
		],
		"disallowed"
	],
	[
		[
			720896,
			786429
		],
		"disallowed"
	],
	[
		[
			786430,
			786431
		],
		"disallowed"
	],
	[
		[
			786432,
			851965
		],
		"disallowed"
	],
	[
		[
			851966,
			851967
		],
		"disallowed"
	],
	[
		[
			851968,
			917501
		],
		"disallowed"
	],
	[
		[
			917502,
			917503
		],
		"disallowed"
	],
	[
		[
			917504,
			917504
		],
		"disallowed"
	],
	[
		[
			917505,
			917505
		],
		"disallowed"
	],
	[
		[
			917506,
			917535
		],
		"disallowed"
	],
	[
		[
			917536,
			917631
		],
		"disallowed"
	],
	[
		[
			917632,
			917759
		],
		"disallowed"
	],
	[
		[
			917760,
			917999
		],
		"ignored"
	],
	[
		[
			918000,
			983037
		],
		"disallowed"
	],
	[
		[
			983038,
			983039
		],
		"disallowed"
	],
	[
		[
			983040,
			1048573
		],
		"disallowed"
	],
	[
		[
			1048574,
			1048575
		],
		"disallowed"
	],
	[
		[
			1048576,
			1114109
		],
		"disallowed"
	],
	[
		[
			1114110,
			1114111
		],
		"disallowed"
	]
];

var PROCESSING_OPTIONS = {
  TRANSITIONAL: 0,
  NONTRANSITIONAL: 1
};

function normalize$1(str) { // fix bug in v8
  return str.split('\u0000').map(function (s) { return s.normalize('NFC'); }).join('\u0000');
}

function findStatus(val) {
  var start = 0;
  var end = mappingTable.length - 1;

  while (start <= end) {
    var mid = Math.floor((start + end) / 2);

    var target = mappingTable[mid];
    if (target[0][0] <= val && target[0][1] >= val) {
      return target;
    } else if (target[0][0] > val) {
      end = mid - 1;
    } else {
      start = mid + 1;
    }
  }

  return null;
}

var regexAstralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

function countSymbols(string) {
  return string
    // replace every surrogate pair with a BMP symbol
    .replace(regexAstralSymbols, '_')
    // then get the length
    .length;
}

function mapChars(domain_name, useSTD3, processing_option) {
  var hasError = false;
  var processed = "";

  var len = countSymbols(domain_name);
  for (var i = 0; i < len; ++i) {
    var codePoint = domain_name.codePointAt(i);
    var status = findStatus(codePoint);

    switch (status[1]) {
      case "disallowed":
        hasError = true;
        processed += String.fromCodePoint(codePoint);
        break;
      case "ignored":
        break;
      case "mapped":
        processed += String.fromCodePoint.apply(String, status[2]);
        break;
      case "deviation":
        if (processing_option === PROCESSING_OPTIONS.TRANSITIONAL) {
          processed += String.fromCodePoint.apply(String, status[2]);
        } else {
          processed += String.fromCodePoint(codePoint);
        }
        break;
      case "valid":
        processed += String.fromCodePoint(codePoint);
        break;
      case "disallowed_STD3_mapped":
        if (useSTD3) {
          hasError = true;
          processed += String.fromCodePoint(codePoint);
        } else {
          processed += String.fromCodePoint.apply(String, status[2]);
        }
        break;
      case "disallowed_STD3_valid":
        if (useSTD3) {
          hasError = true;
        }

        processed += String.fromCodePoint(codePoint);
        break;
    }
  }

  return {
    string: processed,
    error: hasError
  };
}

var combiningMarksRegex = /[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08E4-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C03\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D01-\u0D03\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u18A9\u1920-\u192B\u1930-\u193B\u19B0-\u19C0\u19C8\u19C9\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF8\u1CF9\u1DC0-\u1DF5\u1DFC-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C4\uA8E0-\uA8F1\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2D]|\uD800[\uDDFD\uDEE0\uDF76-\uDF7A]|\uD802[\uDE01-\uDE03\uDE05\uDE06\uDE0C-\uDE0F\uDE38-\uDE3A\uDE3F\uDEE5\uDEE6]|\uD804[\uDC00-\uDC02\uDC38-\uDC46\uDC7F-\uDC82\uDCB0-\uDCBA\uDD00-\uDD02\uDD27-\uDD34\uDD73\uDD80-\uDD82\uDDB3-\uDDC0\uDE2C-\uDE37\uDEDF-\uDEEA\uDF01-\uDF03\uDF3C\uDF3E-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF57\uDF62\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDCB0-\uDCC3\uDDAF-\uDDB5\uDDB8-\uDDC0\uDE30-\uDE40\uDEAB-\uDEB7]|\uD81A[\uDEF0-\uDEF4\uDF30-\uDF36]|\uD81B[\uDF51-\uDF7E\uDF8F-\uDF92]|\uD82F[\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD83A[\uDCD0-\uDCD6]|\uDB40[\uDD00-\uDDEF]/;

function validateLabel(label, processing_option) {
  if (label.substr(0, 4) === "xn--") {
    label = punycode__default["default"].toUnicode(label);
  }

  var error = false;

  if (normalize$1(label) !== label ||
      (label[3] === "-" && label[4] === "-") ||
      label[0] === "-" || label[label.length - 1] === "-" ||
      label.indexOf(".") !== -1 ||
      label.search(combiningMarksRegex) === 0) {
    error = true;
  }

  var len = countSymbols(label);
  for (var i = 0; i < len; ++i) {
    var status = findStatus(label.codePointAt(i));
    if ((processing === PROCESSING_OPTIONS.TRANSITIONAL && status[1] !== "valid") ||
        (processing === PROCESSING_OPTIONS.NONTRANSITIONAL &&
         status[1] !== "valid" && status[1] !== "deviation")) {
      error = true;
      break;
    }
  }

  return {
    label: label,
    error: error
  };
}

function processing(domain_name, useSTD3, processing_option) {
  var result = mapChars(domain_name, useSTD3, processing_option);
  result.string = normalize$1(result.string);

  var labels = result.string.split(".");
  for (var i = 0; i < labels.length; ++i) {
    try {
      var validation = validateLabel(labels[i]);
      labels[i] = validation.label;
      result.error = result.error || validation.error;
    } catch(e) {
      result.error = true;
    }
  }

  return {
    string: labels.join("."),
    error: result.error
  };
}

var toASCII = function(domain_name, useSTD3, processing_option, verifyDnsLength) {
  var result = processing(domain_name, useSTD3, processing_option);
  var labels = result.string.split(".");
  labels = labels.map(function(l) {
    try {
      return punycode__default["default"].toASCII(l);
    } catch(e) {
      result.error = true;
      return l;
    }
  });

  if (verifyDnsLength) {
    var total = labels.slice(0, labels.length - 1).join(".").length;
    if (total.length > 253 || total.length === 0) {
      result.error = true;
    }

    for (var i=0; i < labels.length; ++i) {
      if (labels.length > 63 || labels.length === 0) {
        result.error = true;
        break;
      }
    }
  }

  if (result.error) return null;
  return labels.join(".");
};

var toUnicode = function(domain_name, useSTD3) {
  var result = processing(domain_name, useSTD3, PROCESSING_OPTIONS.NONTRANSITIONAL);

  return {
    domain: result.string,
    error: result.error
  };
};

var PROCESSING_OPTIONS_1 = PROCESSING_OPTIONS;

var tr46 = {
	toASCII: toASCII,
	toUnicode: toUnicode,
	PROCESSING_OPTIONS: PROCESSING_OPTIONS_1
};

var urlStateMachine = createCommonjsModule(function (module) {



const specialSchemes = {
  ftp: 21,
  file: null,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
};

const failure = Symbol("failure");

function countSymbols(str) {
  return punycode__default["default"].ucs2.decode(str).length;
}

function at(input, idx) {
  const c = input[idx];
  return isNaN(c) ? undefined : String.fromCodePoint(c);
}

function isASCIIDigit(c) {
  return c >= 0x30 && c <= 0x39;
}

function isASCIIAlpha(c) {
  return (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A);
}

function isASCIIAlphanumeric(c) {
  return isASCIIAlpha(c) || isASCIIDigit(c);
}

function isASCIIHex(c) {
  return isASCIIDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);
}

function isSingleDot(buffer) {
  return buffer === "." || buffer.toLowerCase() === "%2e";
}

function isDoubleDot(buffer) {
  buffer = buffer.toLowerCase();
  return buffer === ".." || buffer === "%2e." || buffer === ".%2e" || buffer === "%2e%2e";
}

function isWindowsDriveLetterCodePoints(cp1, cp2) {
  return isASCIIAlpha(cp1) && (cp2 === 58 || cp2 === 124);
}

function isWindowsDriveLetterString(string) {
  return string.length === 2 && isASCIIAlpha(string.codePointAt(0)) && (string[1] === ":" || string[1] === "|");
}

function isNormalizedWindowsDriveLetterString(string) {
  return string.length === 2 && isASCIIAlpha(string.codePointAt(0)) && string[1] === ":";
}

function containsForbiddenHostCodePoint(string) {
  return string.search(/\u0000|\u0009|\u000A|\u000D|\u0020|#|%|\/|:|\?|@|\[|\\|\]/) !== -1;
}

function containsForbiddenHostCodePointExcludingPercent(string) {
  return string.search(/\u0000|\u0009|\u000A|\u000D|\u0020|#|\/|:|\?|@|\[|\\|\]/) !== -1;
}

function isSpecialScheme(scheme) {
  return specialSchemes[scheme] !== undefined;
}

function isSpecial(url) {
  return isSpecialScheme(url.scheme);
}

function defaultPort(scheme) {
  return specialSchemes[scheme];
}

function percentEncode(c) {
  let hex = c.toString(16).toUpperCase();
  if (hex.length === 1) {
    hex = "0" + hex;
  }

  return "%" + hex;
}

function utf8PercentEncode(c) {
  const buf = new Buffer(c);

  let str = "";

  for (let i = 0; i < buf.length; ++i) {
    str += percentEncode(buf[i]);
  }

  return str;
}

function utf8PercentDecode(str) {
  const input = new Buffer(str);
  const output = [];
  for (let i = 0; i < input.length; ++i) {
    if (input[i] !== 37) {
      output.push(input[i]);
    } else if (input[i] === 37 && isASCIIHex(input[i + 1]) && isASCIIHex(input[i + 2])) {
      output.push(parseInt(input.slice(i + 1, i + 3).toString(), 16));
      i += 2;
    } else {
      output.push(input[i]);
    }
  }
  return new Buffer(output).toString();
}

function isC0ControlPercentEncode(c) {
  return c <= 0x1F || c > 0x7E;
}

const extraPathPercentEncodeSet = new Set([32, 34, 35, 60, 62, 63, 96, 123, 125]);
function isPathPercentEncode(c) {
  return isC0ControlPercentEncode(c) || extraPathPercentEncodeSet.has(c);
}

const extraUserinfoPercentEncodeSet =
  new Set([47, 58, 59, 61, 64, 91, 92, 93, 94, 124]);
function isUserinfoPercentEncode(c) {
  return isPathPercentEncode(c) || extraUserinfoPercentEncodeSet.has(c);
}

function percentEncodeChar(c, encodeSetPredicate) {
  const cStr = String.fromCodePoint(c);

  if (encodeSetPredicate(c)) {
    return utf8PercentEncode(cStr);
  }

  return cStr;
}

function parseIPv4Number(input) {
  let R = 10;

  if (input.length >= 2 && input.charAt(0) === "0" && input.charAt(1).toLowerCase() === "x") {
    input = input.substring(2);
    R = 16;
  } else if (input.length >= 2 && input.charAt(0) === "0") {
    input = input.substring(1);
    R = 8;
  }

  if (input === "") {
    return 0;
  }

  const regex = R === 10 ? /[^0-9]/ : (R === 16 ? /[^0-9A-Fa-f]/ : /[^0-7]/);
  if (regex.test(input)) {
    return failure;
  }

  return parseInt(input, R);
}

function parseIPv4(input) {
  const parts = input.split(".");
  if (parts[parts.length - 1] === "") {
    if (parts.length > 1) {
      parts.pop();
    }
  }

  if (parts.length > 4) {
    return input;
  }

  const numbers = [];
  for (const part of parts) {
    if (part === "") {
      return input;
    }
    const n = parseIPv4Number(part);
    if (n === failure) {
      return input;
    }

    numbers.push(n);
  }

  for (let i = 0; i < numbers.length - 1; ++i) {
    if (numbers[i] > 255) {
      return failure;
    }
  }
  if (numbers[numbers.length - 1] >= Math.pow(256, 5 - numbers.length)) {
    return failure;
  }

  let ipv4 = numbers.pop();
  let counter = 0;

  for (const n of numbers) {
    ipv4 += n * Math.pow(256, 3 - counter);
    ++counter;
  }

  return ipv4;
}

function serializeIPv4(address) {
  let output = "";
  let n = address;

  for (let i = 1; i <= 4; ++i) {
    output = String(n % 256) + output;
    if (i !== 4) {
      output = "." + output;
    }
    n = Math.floor(n / 256);
  }

  return output;
}

function parseIPv6(input) {
  const address = [0, 0, 0, 0, 0, 0, 0, 0];
  let pieceIndex = 0;
  let compress = null;
  let pointer = 0;

  input = punycode__default["default"].ucs2.decode(input);

  if (input[pointer] === 58) {
    if (input[pointer + 1] !== 58) {
      return failure;
    }

    pointer += 2;
    ++pieceIndex;
    compress = pieceIndex;
  }

  while (pointer < input.length) {
    if (pieceIndex === 8) {
      return failure;
    }

    if (input[pointer] === 58) {
      if (compress !== null) {
        return failure;
      }
      ++pointer;
      ++pieceIndex;
      compress = pieceIndex;
      continue;
    }

    let value = 0;
    let length = 0;

    while (length < 4 && isASCIIHex(input[pointer])) {
      value = value * 0x10 + parseInt(at(input, pointer), 16);
      ++pointer;
      ++length;
    }

    if (input[pointer] === 46) {
      if (length === 0) {
        return failure;
      }

      pointer -= length;

      if (pieceIndex > 6) {
        return failure;
      }

      let numbersSeen = 0;

      while (input[pointer] !== undefined) {
        let ipv4Piece = null;

        if (numbersSeen > 0) {
          if (input[pointer] === 46 && numbersSeen < 4) {
            ++pointer;
          } else {
            return failure;
          }
        }

        if (!isASCIIDigit(input[pointer])) {
          return failure;
        }

        while (isASCIIDigit(input[pointer])) {
          const number = parseInt(at(input, pointer));
          if (ipv4Piece === null) {
            ipv4Piece = number;
          } else if (ipv4Piece === 0) {
            return failure;
          } else {
            ipv4Piece = ipv4Piece * 10 + number;
          }
          if (ipv4Piece > 255) {
            return failure;
          }
          ++pointer;
        }

        address[pieceIndex] = address[pieceIndex] * 0x100 + ipv4Piece;

        ++numbersSeen;

        if (numbersSeen === 2 || numbersSeen === 4) {
          ++pieceIndex;
        }
      }

      if (numbersSeen !== 4) {
        return failure;
      }

      break;
    } else if (input[pointer] === 58) {
      ++pointer;
      if (input[pointer] === undefined) {
        return failure;
      }
    } else if (input[pointer] !== undefined) {
      return failure;
    }

    address[pieceIndex] = value;
    ++pieceIndex;
  }

  if (compress !== null) {
    let swaps = pieceIndex - compress;
    pieceIndex = 7;
    while (pieceIndex !== 0 && swaps > 0) {
      const temp = address[compress + swaps - 1];
      address[compress + swaps - 1] = address[pieceIndex];
      address[pieceIndex] = temp;
      --pieceIndex;
      --swaps;
    }
  } else if (compress === null && pieceIndex !== 8) {
    return failure;
  }

  return address;
}

function serializeIPv6(address) {
  let output = "";
  const seqResult = findLongestZeroSequence(address);
  const compress = seqResult.idx;
  let ignore0 = false;

  for (let pieceIndex = 0; pieceIndex <= 7; ++pieceIndex) {
    if (ignore0 && address[pieceIndex] === 0) {
      continue;
    } else if (ignore0) {
      ignore0 = false;
    }

    if (compress === pieceIndex) {
      const separator = pieceIndex === 0 ? "::" : ":";
      output += separator;
      ignore0 = true;
      continue;
    }

    output += address[pieceIndex].toString(16);

    if (pieceIndex !== 7) {
      output += ":";
    }
  }

  return output;
}

function parseHost(input, isSpecialArg) {
  if (input[0] === "[") {
    if (input[input.length - 1] !== "]") {
      return failure;
    }

    return parseIPv6(input.substring(1, input.length - 1));
  }

  if (!isSpecialArg) {
    return parseOpaqueHost(input);
  }

  const domain = utf8PercentDecode(input);
  const asciiDomain = tr46.toASCII(domain, false, tr46.PROCESSING_OPTIONS.NONTRANSITIONAL, false);
  if (asciiDomain === null) {
    return failure;
  }

  if (containsForbiddenHostCodePoint(asciiDomain)) {
    return failure;
  }

  const ipv4Host = parseIPv4(asciiDomain);
  if (typeof ipv4Host === "number" || ipv4Host === failure) {
    return ipv4Host;
  }

  return asciiDomain;
}

function parseOpaqueHost(input) {
  if (containsForbiddenHostCodePointExcludingPercent(input)) {
    return failure;
  }

  let output = "";
  const decoded = punycode__default["default"].ucs2.decode(input);
  for (let i = 0; i < decoded.length; ++i) {
    output += percentEncodeChar(decoded[i], isC0ControlPercentEncode);
  }
  return output;
}

function findLongestZeroSequence(arr) {
  let maxIdx = null;
  let maxLen = 1; // only find elements > 1
  let currStart = null;
  let currLen = 0;

  for (let i = 0; i < arr.length; ++i) {
    if (arr[i] !== 0) {
      if (currLen > maxLen) {
        maxIdx = currStart;
        maxLen = currLen;
      }

      currStart = null;
      currLen = 0;
    } else {
      if (currStart === null) {
        currStart = i;
      }
      ++currLen;
    }
  }

  // if trailing zeros
  if (currLen > maxLen) {
    maxIdx = currStart;
    maxLen = currLen;
  }

  return {
    idx: maxIdx,
    len: maxLen
  };
}

function serializeHost(host) {
  if (typeof host === "number") {
    return serializeIPv4(host);
  }

  // IPv6 serializer
  if (host instanceof Array) {
    return "[" + serializeIPv6(host) + "]";
  }

  return host;
}

function trimControlChars(url) {
  return url.replace(/^[\u0000-\u001F\u0020]+|[\u0000-\u001F\u0020]+$/g, "");
}

function trimTabAndNewline(url) {
  return url.replace(/\u0009|\u000A|\u000D/g, "");
}

function shortenPath(url) {
  const path = url.path;
  if (path.length === 0) {
    return;
  }
  if (url.scheme === "file" && path.length === 1 && isNormalizedWindowsDriveLetter(path[0])) {
    return;
  }

  path.pop();
}

function includesCredentials(url) {
  return url.username !== "" || url.password !== "";
}

function cannotHaveAUsernamePasswordPort(url) {
  return url.host === null || url.host === "" || url.cannotBeABaseURL || url.scheme === "file";
}

function isNormalizedWindowsDriveLetter(string) {
  return /^[A-Za-z]:$/.test(string);
}

function URLStateMachine(input, base, encodingOverride, url, stateOverride) {
  this.pointer = 0;
  this.input = input;
  this.base = base || null;
  this.encodingOverride = encodingOverride || "utf-8";
  this.stateOverride = stateOverride;
  this.url = url;
  this.failure = false;
  this.parseError = false;

  if (!this.url) {
    this.url = {
      scheme: "",
      username: "",
      password: "",
      host: null,
      port: null,
      path: [],
      query: null,
      fragment: null,

      cannotBeABaseURL: false
    };

    const res = trimControlChars(this.input);
    if (res !== this.input) {
      this.parseError = true;
    }
    this.input = res;
  }

  const res = trimTabAndNewline(this.input);
  if (res !== this.input) {
    this.parseError = true;
  }
  this.input = res;

  this.state = stateOverride || "scheme start";

  this.buffer = "";
  this.atFlag = false;
  this.arrFlag = false;
  this.passwordTokenSeenFlag = false;

  this.input = punycode__default["default"].ucs2.decode(this.input);

  for (; this.pointer <= this.input.length; ++this.pointer) {
    const c = this.input[this.pointer];
    const cStr = isNaN(c) ? undefined : String.fromCodePoint(c);

    // exec state machine
    const ret = this["parse " + this.state](c, cStr);
    if (!ret) {
      break; // terminate algorithm
    } else if (ret === failure) {
      this.failure = true;
      break;
    }
  }
}

URLStateMachine.prototype["parse scheme start"] = function parseSchemeStart(c, cStr) {
  if (isASCIIAlpha(c)) {
    this.buffer += cStr.toLowerCase();
    this.state = "scheme";
  } else if (!this.stateOverride) {
    this.state = "no scheme";
    --this.pointer;
  } else {
    this.parseError = true;
    return failure;
  }

  return true;
};

URLStateMachine.prototype["parse scheme"] = function parseScheme(c, cStr) {
  if (isASCIIAlphanumeric(c) || c === 43 || c === 45 || c === 46) {
    this.buffer += cStr.toLowerCase();
  } else if (c === 58) {
    if (this.stateOverride) {
      if (isSpecial(this.url) && !isSpecialScheme(this.buffer)) {
        return false;
      }

      if (!isSpecial(this.url) && isSpecialScheme(this.buffer)) {
        return false;
      }

      if ((includesCredentials(this.url) || this.url.port !== null) && this.buffer === "file") {
        return false;
      }

      if (this.url.scheme === "file" && (this.url.host === "" || this.url.host === null)) {
        return false;
      }
    }
    this.url.scheme = this.buffer;
    this.buffer = "";
    if (this.stateOverride) {
      return false;
    }
    if (this.url.scheme === "file") {
      if (this.input[this.pointer + 1] !== 47 || this.input[this.pointer + 2] !== 47) {
        this.parseError = true;
      }
      this.state = "file";
    } else if (isSpecial(this.url) && this.base !== null && this.base.scheme === this.url.scheme) {
      this.state = "special relative or authority";
    } else if (isSpecial(this.url)) {
      this.state = "special authority slashes";
    } else if (this.input[this.pointer + 1] === 47) {
      this.state = "path or authority";
      ++this.pointer;
    } else {
      this.url.cannotBeABaseURL = true;
      this.url.path.push("");
      this.state = "cannot-be-a-base-URL path";
    }
  } else if (!this.stateOverride) {
    this.buffer = "";
    this.state = "no scheme";
    this.pointer = -1;
  } else {
    this.parseError = true;
    return failure;
  }

  return true;
};

URLStateMachine.prototype["parse no scheme"] = function parseNoScheme(c) {
  if (this.base === null || (this.base.cannotBeABaseURL && c !== 35)) {
    return failure;
  } else if (this.base.cannotBeABaseURL && c === 35) {
    this.url.scheme = this.base.scheme;
    this.url.path = this.base.path.slice();
    this.url.query = this.base.query;
    this.url.fragment = "";
    this.url.cannotBeABaseURL = true;
    this.state = "fragment";
  } else if (this.base.scheme === "file") {
    this.state = "file";
    --this.pointer;
  } else {
    this.state = "relative";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse special relative or authority"] = function parseSpecialRelativeOrAuthority(c) {
  if (c === 47 && this.input[this.pointer + 1] === 47) {
    this.state = "special authority ignore slashes";
    ++this.pointer;
  } else {
    this.parseError = true;
    this.state = "relative";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse path or authority"] = function parsePathOrAuthority(c) {
  if (c === 47) {
    this.state = "authority";
  } else {
    this.state = "path";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse relative"] = function parseRelative(c) {
  this.url.scheme = this.base.scheme;
  if (isNaN(c)) {
    this.url.username = this.base.username;
    this.url.password = this.base.password;
    this.url.host = this.base.host;
    this.url.port = this.base.port;
    this.url.path = this.base.path.slice();
    this.url.query = this.base.query;
  } else if (c === 47) {
    this.state = "relative slash";
  } else if (c === 63) {
    this.url.username = this.base.username;
    this.url.password = this.base.password;
    this.url.host = this.base.host;
    this.url.port = this.base.port;
    this.url.path = this.base.path.slice();
    this.url.query = "";
    this.state = "query";
  } else if (c === 35) {
    this.url.username = this.base.username;
    this.url.password = this.base.password;
    this.url.host = this.base.host;
    this.url.port = this.base.port;
    this.url.path = this.base.path.slice();
    this.url.query = this.base.query;
    this.url.fragment = "";
    this.state = "fragment";
  } else if (isSpecial(this.url) && c === 92) {
    this.parseError = true;
    this.state = "relative slash";
  } else {
    this.url.username = this.base.username;
    this.url.password = this.base.password;
    this.url.host = this.base.host;
    this.url.port = this.base.port;
    this.url.path = this.base.path.slice(0, this.base.path.length - 1);

    this.state = "path";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse relative slash"] = function parseRelativeSlash(c) {
  if (isSpecial(this.url) && (c === 47 || c === 92)) {
    if (c === 92) {
      this.parseError = true;
    }
    this.state = "special authority ignore slashes";
  } else if (c === 47) {
    this.state = "authority";
  } else {
    this.url.username = this.base.username;
    this.url.password = this.base.password;
    this.url.host = this.base.host;
    this.url.port = this.base.port;
    this.state = "path";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse special authority slashes"] = function parseSpecialAuthoritySlashes(c) {
  if (c === 47 && this.input[this.pointer + 1] === 47) {
    this.state = "special authority ignore slashes";
    ++this.pointer;
  } else {
    this.parseError = true;
    this.state = "special authority ignore slashes";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse special authority ignore slashes"] = function parseSpecialAuthorityIgnoreSlashes(c) {
  if (c !== 47 && c !== 92) {
    this.state = "authority";
    --this.pointer;
  } else {
    this.parseError = true;
  }

  return true;
};

URLStateMachine.prototype["parse authority"] = function parseAuthority(c, cStr) {
  if (c === 64) {
    this.parseError = true;
    if (this.atFlag) {
      this.buffer = "%40" + this.buffer;
    }
    this.atFlag = true;

    // careful, this is based on buffer and has its own pointer (this.pointer != pointer) and inner chars
    const len = countSymbols(this.buffer);
    for (let pointer = 0; pointer < len; ++pointer) {
      const codePoint = this.buffer.codePointAt(pointer);

      if (codePoint === 58 && !this.passwordTokenSeenFlag) {
        this.passwordTokenSeenFlag = true;
        continue;
      }
      const encodedCodePoints = percentEncodeChar(codePoint, isUserinfoPercentEncode);
      if (this.passwordTokenSeenFlag) {
        this.url.password += encodedCodePoints;
      } else {
        this.url.username += encodedCodePoints;
      }
    }
    this.buffer = "";
  } else if (isNaN(c) || c === 47 || c === 63 || c === 35 ||
             (isSpecial(this.url) && c === 92)) {
    if (this.atFlag && this.buffer === "") {
      this.parseError = true;
      return failure;
    }
    this.pointer -= countSymbols(this.buffer) + 1;
    this.buffer = "";
    this.state = "host";
  } else {
    this.buffer += cStr;
  }

  return true;
};

URLStateMachine.prototype["parse hostname"] =
URLStateMachine.prototype["parse host"] = function parseHostName(c, cStr) {
  if (this.stateOverride && this.url.scheme === "file") {
    --this.pointer;
    this.state = "file host";
  } else if (c === 58 && !this.arrFlag) {
    if (this.buffer === "") {
      this.parseError = true;
      return failure;
    }

    const host = parseHost(this.buffer, isSpecial(this.url));
    if (host === failure) {
      return failure;
    }

    this.url.host = host;
    this.buffer = "";
    this.state = "port";
    if (this.stateOverride === "hostname") {
      return false;
    }
  } else if (isNaN(c) || c === 47 || c === 63 || c === 35 ||
             (isSpecial(this.url) && c === 92)) {
    --this.pointer;
    if (isSpecial(this.url) && this.buffer === "") {
      this.parseError = true;
      return failure;
    } else if (this.stateOverride && this.buffer === "" &&
               (includesCredentials(this.url) || this.url.port !== null)) {
      this.parseError = true;
      return false;
    }

    const host = parseHost(this.buffer, isSpecial(this.url));
    if (host === failure) {
      return failure;
    }

    this.url.host = host;
    this.buffer = "";
    this.state = "path start";
    if (this.stateOverride) {
      return false;
    }
  } else {
    if (c === 91) {
      this.arrFlag = true;
    } else if (c === 93) {
      this.arrFlag = false;
    }
    this.buffer += cStr;
  }

  return true;
};

URLStateMachine.prototype["parse port"] = function parsePort(c, cStr) {
  if (isASCIIDigit(c)) {
    this.buffer += cStr;
  } else if (isNaN(c) || c === 47 || c === 63 || c === 35 ||
             (isSpecial(this.url) && c === 92) ||
             this.stateOverride) {
    if (this.buffer !== "") {
      const port = parseInt(this.buffer);
      if (port > Math.pow(2, 16) - 1) {
        this.parseError = true;
        return failure;
      }
      this.url.port = port === defaultPort(this.url.scheme) ? null : port;
      this.buffer = "";
    }
    if (this.stateOverride) {
      return false;
    }
    this.state = "path start";
    --this.pointer;
  } else {
    this.parseError = true;
    return failure;
  }

  return true;
};

const fileOtherwiseCodePoints = new Set([47, 92, 63, 35]);

URLStateMachine.prototype["parse file"] = function parseFile(c) {
  this.url.scheme = "file";

  if (c === 47 || c === 92) {
    if (c === 92) {
      this.parseError = true;
    }
    this.state = "file slash";
  } else if (this.base !== null && this.base.scheme === "file") {
    if (isNaN(c)) {
      this.url.host = this.base.host;
      this.url.path = this.base.path.slice();
      this.url.query = this.base.query;
    } else if (c === 63) {
      this.url.host = this.base.host;
      this.url.path = this.base.path.slice();
      this.url.query = "";
      this.state = "query";
    } else if (c === 35) {
      this.url.host = this.base.host;
      this.url.path = this.base.path.slice();
      this.url.query = this.base.query;
      this.url.fragment = "";
      this.state = "fragment";
    } else {
      if (this.input.length - this.pointer - 1 === 0 || // remaining consists of 0 code points
          !isWindowsDriveLetterCodePoints(c, this.input[this.pointer + 1]) ||
          (this.input.length - this.pointer - 1 >= 2 && // remaining has at least 2 code points
           !fileOtherwiseCodePoints.has(this.input[this.pointer + 2]))) {
        this.url.host = this.base.host;
        this.url.path = this.base.path.slice();
        shortenPath(this.url);
      } else {
        this.parseError = true;
      }

      this.state = "path";
      --this.pointer;
    }
  } else {
    this.state = "path";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse file slash"] = function parseFileSlash(c) {
  if (c === 47 || c === 92) {
    if (c === 92) {
      this.parseError = true;
    }
    this.state = "file host";
  } else {
    if (this.base !== null && this.base.scheme === "file") {
      if (isNormalizedWindowsDriveLetterString(this.base.path[0])) {
        this.url.path.push(this.base.path[0]);
      } else {
        this.url.host = this.base.host;
      }
    }
    this.state = "path";
    --this.pointer;
  }

  return true;
};

URLStateMachine.prototype["parse file host"] = function parseFileHost(c, cStr) {
  if (isNaN(c) || c === 47 || c === 92 || c === 63 || c === 35) {
    --this.pointer;
    if (!this.stateOverride && isWindowsDriveLetterString(this.buffer)) {
      this.parseError = true;
      this.state = "path";
    } else if (this.buffer === "") {
      this.url.host = "";
      if (this.stateOverride) {
        return false;
      }
      this.state = "path start";
    } else {
      let host = parseHost(this.buffer, isSpecial(this.url));
      if (host === failure) {
        return failure;
      }
      if (host === "localhost") {
        host = "";
      }
      this.url.host = host;

      if (this.stateOverride) {
        return false;
      }

      this.buffer = "";
      this.state = "path start";
    }
  } else {
    this.buffer += cStr;
  }

  return true;
};

URLStateMachine.prototype["parse path start"] = function parsePathStart(c) {
  if (isSpecial(this.url)) {
    if (c === 92) {
      this.parseError = true;
    }
    this.state = "path";

    if (c !== 47 && c !== 92) {
      --this.pointer;
    }
  } else if (!this.stateOverride && c === 63) {
    this.url.query = "";
    this.state = "query";
  } else if (!this.stateOverride && c === 35) {
    this.url.fragment = "";
    this.state = "fragment";
  } else if (c !== undefined) {
    this.state = "path";
    if (c !== 47) {
      --this.pointer;
    }
  }

  return true;
};

URLStateMachine.prototype["parse path"] = function parsePath(c) {
  if (isNaN(c) || c === 47 || (isSpecial(this.url) && c === 92) ||
      (!this.stateOverride && (c === 63 || c === 35))) {
    if (isSpecial(this.url) && c === 92) {
      this.parseError = true;
    }

    if (isDoubleDot(this.buffer)) {
      shortenPath(this.url);
      if (c !== 47 && !(isSpecial(this.url) && c === 92)) {
        this.url.path.push("");
      }
    } else if (isSingleDot(this.buffer) && c !== 47 &&
               !(isSpecial(this.url) && c === 92)) {
      this.url.path.push("");
    } else if (!isSingleDot(this.buffer)) {
      if (this.url.scheme === "file" && this.url.path.length === 0 && isWindowsDriveLetterString(this.buffer)) {
        if (this.url.host !== "" && this.url.host !== null) {
          this.parseError = true;
          this.url.host = "";
        }
        this.buffer = this.buffer[0] + ":";
      }
      this.url.path.push(this.buffer);
    }
    this.buffer = "";
    if (this.url.scheme === "file" && (c === undefined || c === 63 || c === 35)) {
      while (this.url.path.length > 1 && this.url.path[0] === "") {
        this.parseError = true;
        this.url.path.shift();
      }
    }
    if (c === 63) {
      this.url.query = "";
      this.state = "query";
    }
    if (c === 35) {
      this.url.fragment = "";
      this.state = "fragment";
    }
  } else {
    // TODO: If c is not a URL code point and not "%", parse error.

    if (c === 37 &&
      (!isASCIIHex(this.input[this.pointer + 1]) ||
        !isASCIIHex(this.input[this.pointer + 2]))) {
      this.parseError = true;
    }

    this.buffer += percentEncodeChar(c, isPathPercentEncode);
  }

  return true;
};

URLStateMachine.prototype["parse cannot-be-a-base-URL path"] = function parseCannotBeABaseURLPath(c) {
  if (c === 63) {
    this.url.query = "";
    this.state = "query";
  } else if (c === 35) {
    this.url.fragment = "";
    this.state = "fragment";
  } else {
    // TODO: Add: not a URL code point
    if (!isNaN(c) && c !== 37) {
      this.parseError = true;
    }

    if (c === 37 &&
        (!isASCIIHex(this.input[this.pointer + 1]) ||
         !isASCIIHex(this.input[this.pointer + 2]))) {
      this.parseError = true;
    }

    if (!isNaN(c)) {
      this.url.path[0] = this.url.path[0] + percentEncodeChar(c, isC0ControlPercentEncode);
    }
  }

  return true;
};

URLStateMachine.prototype["parse query"] = function parseQuery(c, cStr) {
  if (isNaN(c) || (!this.stateOverride && c === 35)) {
    if (!isSpecial(this.url) || this.url.scheme === "ws" || this.url.scheme === "wss") {
      this.encodingOverride = "utf-8";
    }

    const buffer = new Buffer(this.buffer); // TODO: Use encoding override instead
    for (let i = 0; i < buffer.length; ++i) {
      if (buffer[i] < 0x21 || buffer[i] > 0x7E || buffer[i] === 0x22 || buffer[i] === 0x23 ||
          buffer[i] === 0x3C || buffer[i] === 0x3E) {
        this.url.query += percentEncode(buffer[i]);
      } else {
        this.url.query += String.fromCodePoint(buffer[i]);
      }
    }

    this.buffer = "";
    if (c === 35) {
      this.url.fragment = "";
      this.state = "fragment";
    }
  } else {
    // TODO: If c is not a URL code point and not "%", parse error.
    if (c === 37 &&
      (!isASCIIHex(this.input[this.pointer + 1]) ||
        !isASCIIHex(this.input[this.pointer + 2]))) {
      this.parseError = true;
    }

    this.buffer += cStr;
  }

  return true;
};

URLStateMachine.prototype["parse fragment"] = function parseFragment(c) {
  if (isNaN(c)) ; else if (c === 0x0) {
    this.parseError = true;
  } else {
    // TODO: If c is not a URL code point and not "%", parse error.
    if (c === 37 &&
      (!isASCIIHex(this.input[this.pointer + 1]) ||
        !isASCIIHex(this.input[this.pointer + 2]))) {
      this.parseError = true;
    }

    this.url.fragment += percentEncodeChar(c, isC0ControlPercentEncode);
  }

  return true;
};

function serializeURL(url, excludeFragment) {
  let output = url.scheme + ":";
  if (url.host !== null) {
    output += "//";

    if (url.username !== "" || url.password !== "") {
      output += url.username;
      if (url.password !== "") {
        output += ":" + url.password;
      }
      output += "@";
    }

    output += serializeHost(url.host);

    if (url.port !== null) {
      output += ":" + url.port;
    }
  } else if (url.host === null && url.scheme === "file") {
    output += "//";
  }

  if (url.cannotBeABaseURL) {
    output += url.path[0];
  } else {
    for (const string of url.path) {
      output += "/" + string;
    }
  }

  if (url.query !== null) {
    output += "?" + url.query;
  }

  if (!excludeFragment && url.fragment !== null) {
    output += "#" + url.fragment;
  }

  return output;
}

function serializeOrigin(tuple) {
  let result = tuple.scheme + "://";
  result += serializeHost(tuple.host);

  if (tuple.port !== null) {
    result += ":" + tuple.port;
  }

  return result;
}

module.exports.serializeURL = serializeURL;

module.exports.serializeURLOrigin = function (url) {
  // https://url.spec.whatwg.org/#concept-url-origin
  switch (url.scheme) {
    case "blob":
      try {
        return module.exports.serializeURLOrigin(module.exports.parseURL(url.path[0]));
      } catch (e) {
        // serializing an opaque origin returns "null"
        return "null";
      }
    case "ftp":
    case "gopher":
    case "http":
    case "https":
    case "ws":
    case "wss":
      return serializeOrigin({
        scheme: url.scheme,
        host: url.host,
        port: url.port
      });
    case "file":
      // spec says "exercise to the reader", chrome says "file://"
      return "file://";
    default:
      // serializing an opaque origin returns "null"
      return "null";
  }
};

module.exports.basicURLParse = function (input, options) {
  if (options === undefined) {
    options = {};
  }

  const usm = new URLStateMachine(input, options.baseURL, options.encodingOverride, options.url, options.stateOverride);
  if (usm.failure) {
    return "failure";
  }

  return usm.url;
};

module.exports.setTheUsername = function (url, username) {
  url.username = "";
  const decoded = punycode__default["default"].ucs2.decode(username);
  for (let i = 0; i < decoded.length; ++i) {
    url.username += percentEncodeChar(decoded[i], isUserinfoPercentEncode);
  }
};

module.exports.setThePassword = function (url, password) {
  url.password = "";
  const decoded = punycode__default["default"].ucs2.decode(password);
  for (let i = 0; i < decoded.length; ++i) {
    url.password += percentEncodeChar(decoded[i], isUserinfoPercentEncode);
  }
};

module.exports.serializeHost = serializeHost;

module.exports.cannotHaveAUsernamePasswordPort = cannotHaveAUsernamePasswordPort;

module.exports.serializeInteger = function (integer) {
  return String(integer);
};

module.exports.parseURL = function (input, options) {
  if (options === undefined) {
    options = {};
  }

  // We don't handle blobs, so this just delegates:
  return module.exports.basicURLParse(input, { baseURL: options.baseURL, encodingOverride: options.encodingOverride });
};
});

var implementation = class URLImpl {
  constructor(constructorArgs) {
    const url = constructorArgs[0];
    const base = constructorArgs[1];

    let parsedBase = null;
    if (base !== undefined) {
      parsedBase = urlStateMachine.basicURLParse(base);
      if (parsedBase === "failure") {
        throw new TypeError("Invalid base URL");
      }
    }

    const parsedURL = urlStateMachine.basicURLParse(url, { baseURL: parsedBase });
    if (parsedURL === "failure") {
      throw new TypeError("Invalid URL");
    }

    this._url = parsedURL;

    // TODO: query stuff
  }

  get href() {
    return urlStateMachine.serializeURL(this._url);
  }

  set href(v) {
    const parsedURL = urlStateMachine.basicURLParse(v);
    if (parsedURL === "failure") {
      throw new TypeError("Invalid URL");
    }

    this._url = parsedURL;
  }

  get origin() {
    return urlStateMachine.serializeURLOrigin(this._url);
  }

  get protocol() {
    return this._url.scheme + ":";
  }

  set protocol(v) {
    urlStateMachine.basicURLParse(v + ":", { url: this._url, stateOverride: "scheme start" });
  }

  get username() {
    return this._url.username;
  }

  set username(v) {
    if (urlStateMachine.cannotHaveAUsernamePasswordPort(this._url)) {
      return;
    }

    urlStateMachine.setTheUsername(this._url, v);
  }

  get password() {
    return this._url.password;
  }

  set password(v) {
    if (urlStateMachine.cannotHaveAUsernamePasswordPort(this._url)) {
      return;
    }

    urlStateMachine.setThePassword(this._url, v);
  }

  get host() {
    const url = this._url;

    if (url.host === null) {
      return "";
    }

    if (url.port === null) {
      return urlStateMachine.serializeHost(url.host);
    }

    return urlStateMachine.serializeHost(url.host) + ":" + urlStateMachine.serializeInteger(url.port);
  }

  set host(v) {
    if (this._url.cannotBeABaseURL) {
      return;
    }

    urlStateMachine.basicURLParse(v, { url: this._url, stateOverride: "host" });
  }

  get hostname() {
    if (this._url.host === null) {
      return "";
    }

    return urlStateMachine.serializeHost(this._url.host);
  }

  set hostname(v) {
    if (this._url.cannotBeABaseURL) {
      return;
    }

    urlStateMachine.basicURLParse(v, { url: this._url, stateOverride: "hostname" });
  }

  get port() {
    if (this._url.port === null) {
      return "";
    }

    return urlStateMachine.serializeInteger(this._url.port);
  }

  set port(v) {
    if (urlStateMachine.cannotHaveAUsernamePasswordPort(this._url)) {
      return;
    }

    if (v === "") {
      this._url.port = null;
    } else {
      urlStateMachine.basicURLParse(v, { url: this._url, stateOverride: "port" });
    }
  }

  get pathname() {
    if (this._url.cannotBeABaseURL) {
      return this._url.path[0];
    }

    if (this._url.path.length === 0) {
      return "";
    }

    return "/" + this._url.path.join("/");
  }

  set pathname(v) {
    if (this._url.cannotBeABaseURL) {
      return;
    }

    this._url.path = [];
    urlStateMachine.basicURLParse(v, { url: this._url, stateOverride: "path start" });
  }

  get search() {
    if (this._url.query === null || this._url.query === "") {
      return "";
    }

    return "?" + this._url.query;
  }

  set search(v) {
    // TODO: query stuff

    const url = this._url;

    if (v === "") {
      url.query = null;
      return;
    }

    const input = v[0] === "?" ? v.substring(1) : v;
    url.query = "";
    urlStateMachine.basicURLParse(input, { url, stateOverride: "query" });
  }

  get hash() {
    if (this._url.fragment === null || this._url.fragment === "") {
      return "";
    }

    return "#" + this._url.fragment;
  }

  set hash(v) {
    if (v === "") {
      this._url.fragment = null;
      return;
    }

    const input = v[0] === "#" ? v.substring(1) : v;
    this._url.fragment = "";
    urlStateMachine.basicURLParse(input, { url: this._url, stateOverride: "fragment" });
  }

  toJSON() {
    return this.href;
  }
};

var URLImpl_1 = {
	implementation: implementation
};

var URL_1 = createCommonjsModule(function (module) {





const impl = utils$1.implSymbol;

function URL(url) {
  if (!this || this[impl] || !(this instanceof URL)) {
    throw new TypeError("Failed to construct 'URL': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to construct 'URL': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = arguments[i];
  }
  args[0] = lib$5["USVString"](args[0]);
  if (args[1] !== undefined) {
  args[1] = lib$5["USVString"](args[1]);
  }

  module.exports.setup(this, args);
}

URL.prototype.toJSON = function toJSON() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = arguments[i];
  }
  return this[impl].toJSON.apply(this[impl], args);
};
Object.defineProperty(URL.prototype, "href", {
  get() {
    return this[impl].href;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].href = V;
  },
  enumerable: true,
  configurable: true
});

URL.prototype.toString = function () {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  return this.href;
};

Object.defineProperty(URL.prototype, "origin", {
  get() {
    return this[impl].origin;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(URL.prototype, "protocol", {
  get() {
    return this[impl].protocol;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].protocol = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(URL.prototype, "username", {
  get() {
    return this[impl].username;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].username = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(URL.prototype, "password", {
  get() {
    return this[impl].password;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].password = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(URL.prototype, "host", {
  get() {
    return this[impl].host;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].host = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(URL.prototype, "hostname", {
  get() {
    return this[impl].hostname;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].hostname = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(URL.prototype, "port", {
  get() {
    return this[impl].port;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].port = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(URL.prototype, "pathname", {
  get() {
    return this[impl].pathname;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].pathname = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(URL.prototype, "search", {
  get() {
    return this[impl].search;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].search = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(URL.prototype, "hash", {
  get() {
    return this[impl].hash;
  },
  set(V) {
    V = lib$5["USVString"](V);
    this[impl].hash = V;
  },
  enumerable: true,
  configurable: true
});


module.exports = {
  is(obj) {
    return !!obj && obj[impl] instanceof URLImpl_1.implementation;
  },
  create(constructorArgs, privateData) {
    let obj = Object.create(URL.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    obj[impl] = new URLImpl_1.implementation(constructorArgs, privateData);
    obj[impl][utils$1.wrapperSymbol] = obj;
  },
  interface: URL,
  expose: {
    Window: { URL: URL },
    Worker: { URL: URL }
  }
};
});

var URL$2 = URL_1.interface;
var serializeURL = urlStateMachine.serializeURL;
var serializeURLOrigin = urlStateMachine.serializeURLOrigin;
var basicURLParse = urlStateMachine.basicURLParse;
var setTheUsername = urlStateMachine.setTheUsername;
var setThePassword = urlStateMachine.setThePassword;
var serializeHost = urlStateMachine.serializeHost;
var serializeInteger = urlStateMachine.serializeInteger;
var parseURL$1 = urlStateMachine.parseURL;

var publicApi = {
	URL: URL$2,
	serializeURL: serializeURL,
	serializeURLOrigin: serializeURLOrigin,
	basicURLParse: basicURLParse,
	setTheUsername: setTheUsername,
	setThePassword: setThePassword,
	serializeHost: serializeHost,
	serializeInteger: serializeInteger,
	parseURL: parseURL$1
};

// Based on https://github.com/tmpvar/jsdom/blob/aa85b2abf07766ff7bf5c1f6daafb3726f2f2db5/lib/jsdom/living/blob.js

// fix for "Readable" isn't a named export issue
const Readable = Stream__default["default"].Readable;

const BUFFER = Symbol('buffer');
const TYPE = Symbol('type');

class Blob {
	constructor() {
		this[TYPE] = '';

		const blobParts = arguments[0];
		const options = arguments[1];

		const buffers = [];
		let size = 0;

		if (blobParts) {
			const a = blobParts;
			const length = Number(a.length);
			for (let i = 0; i < length; i++) {
				const element = a[i];
				let buffer;
				if (element instanceof Buffer) {
					buffer = element;
				} else if (ArrayBuffer.isView(element)) {
					buffer = Buffer.from(element.buffer, element.byteOffset, element.byteLength);
				} else if (element instanceof ArrayBuffer) {
					buffer = Buffer.from(element);
				} else if (element instanceof Blob) {
					buffer = element[BUFFER];
				} else {
					buffer = Buffer.from(typeof element === 'string' ? element : String(element));
				}
				size += buffer.length;
				buffers.push(buffer);
			}
		}

		this[BUFFER] = Buffer.concat(buffers);

		let type = options && options.type !== undefined && String(options.type).toLowerCase();
		if (type && !/[^\u0020-\u007E]/.test(type)) {
			this[TYPE] = type;
		}
	}
	get size() {
		return this[BUFFER].length;
	}
	get type() {
		return this[TYPE];
	}
	text() {
		return Promise.resolve(this[BUFFER].toString());
	}
	arrayBuffer() {
		const buf = this[BUFFER];
		const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		return Promise.resolve(ab);
	}
	stream() {
		const readable = new Readable();
		readable._read = function () {};
		readable.push(this[BUFFER]);
		readable.push(null);
		return readable;
	}
	toString() {
		return '[object Blob]';
	}
	slice() {
		const size = this.size;

		const start = arguments[0];
		const end = arguments[1];
		let relativeStart, relativeEnd;
		if (start === undefined) {
			relativeStart = 0;
		} else if (start < 0) {
			relativeStart = Math.max(size + start, 0);
		} else {
			relativeStart = Math.min(start, size);
		}
		if (end === undefined) {
			relativeEnd = size;
		} else if (end < 0) {
			relativeEnd = Math.max(size + end, 0);
		} else {
			relativeEnd = Math.min(end, size);
		}
		const span = Math.max(relativeEnd - relativeStart, 0);

		const buffer = this[BUFFER];
		const slicedBuffer = buffer.slice(relativeStart, relativeStart + span);
		const blob = new Blob([], { type: arguments[2] });
		blob[BUFFER] = slicedBuffer;
		return blob;
	}
}

Object.defineProperties(Blob.prototype, {
	size: { enumerable: true },
	type: { enumerable: true },
	slice: { enumerable: true }
});

Object.defineProperty(Blob.prototype, Symbol.toStringTag, {
	value: 'Blob',
	writable: false,
	enumerable: false,
	configurable: true
});

/**
 * fetch-error.js
 *
 * FetchError interface for operational errors
 */

/**
 * Create FetchError instance
 *
 * @param   String      message      Error message for human
 * @param   String      type         Error type for machine
 * @param   String      systemError  For Node.js system error
 * @return  FetchError
 */
function FetchError(message, type, systemError) {
  Error.call(this, message);

  this.message = message;
  this.type = type;

  // when err.type is `system`, err.code contains system error code
  if (systemError) {
    this.code = this.errno = systemError.code;
  }

  // hide custom error implementation details from end-users
  Error.captureStackTrace(this, this.constructor);
}

FetchError.prototype = Object.create(Error.prototype);
FetchError.prototype.constructor = FetchError;
FetchError.prototype.name = 'FetchError';

let convert;
try {
	convert = require('encoding').convert;
} catch (e) {}

const INTERNALS = Symbol('Body internals');

// fix an issue where "PassThrough" isn't a named export for node <10
const PassThrough = Stream__default["default"].PassThrough;

/**
 * Body mixin
 *
 * Ref: https://fetch.spec.whatwg.org/#body
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
function Body(body) {
	var _this = this;

	var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
	    _ref$size = _ref.size;

	let size = _ref$size === undefined ? 0 : _ref$size;
	var _ref$timeout = _ref.timeout;
	let timeout = _ref$timeout === undefined ? 0 : _ref$timeout;

	if (body == null) {
		// body is undefined or null
		body = null;
	} else if (isURLSearchParams(body)) {
		// body is a URLSearchParams
		body = Buffer.from(body.toString());
	} else if (isBlob(body)) ; else if (Buffer.isBuffer(body)) ; else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
		// body is ArrayBuffer
		body = Buffer.from(body);
	} else if (ArrayBuffer.isView(body)) {
		// body is ArrayBufferView
		body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	} else if (body instanceof Stream__default["default"]) ; else {
		// none of the above
		// coerce to string then buffer
		body = Buffer.from(String(body));
	}
	this[INTERNALS] = {
		body,
		disturbed: false,
		error: null
	};
	this.size = size;
	this.timeout = timeout;

	if (body instanceof Stream__default["default"]) {
		body.on('error', function (err) {
			const error = err.name === 'AbortError' ? err : new FetchError(`Invalid response body while trying to fetch ${_this.url}: ${err.message}`, 'system', err);
			_this[INTERNALS].error = error;
		});
	}
}

Body.prototype = {
	get body() {
		return this[INTERNALS].body;
	},

	get bodyUsed() {
		return this[INTERNALS].disturbed;
	},

	/**
  * Decode response as ArrayBuffer
  *
  * @return  Promise
  */
	arrayBuffer() {
		return consumeBody.call(this).then(function (buf) {
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		});
	},

	/**
  * Return raw response as Blob
  *
  * @return Promise
  */
	blob() {
		let ct = this.headers && this.headers.get('content-type') || '';
		return consumeBody.call(this).then(function (buf) {
			return Object.assign(
			// Prevent copying
			new Blob([], {
				type: ct.toLowerCase()
			}), {
				[BUFFER]: buf
			});
		});
	},

	/**
  * Decode response as json
  *
  * @return  Promise
  */
	json() {
		var _this2 = this;

		return consumeBody.call(this).then(function (buffer) {
			try {
				return JSON.parse(buffer.toString());
			} catch (err) {
				return Body.Promise.reject(new FetchError(`invalid json response body at ${_this2.url} reason: ${err.message}`, 'invalid-json'));
			}
		});
	},

	/**
  * Decode response as text
  *
  * @return  Promise
  */
	text() {
		return consumeBody.call(this).then(function (buffer) {
			return buffer.toString();
		});
	},

	/**
  * Decode response as buffer (non-spec api)
  *
  * @return  Promise
  */
	buffer() {
		return consumeBody.call(this);
	},

	/**
  * Decode response as text, while automatically detecting the encoding and
  * trying to decode to UTF-8 (non-spec api)
  *
  * @return  Promise
  */
	textConverted() {
		var _this3 = this;

		return consumeBody.call(this).then(function (buffer) {
			return convertBody(buffer, _this3.headers);
		});
	}
};

// In browsers, all properties are enumerable.
Object.defineProperties(Body.prototype, {
	body: { enumerable: true },
	bodyUsed: { enumerable: true },
	arrayBuffer: { enumerable: true },
	blob: { enumerable: true },
	json: { enumerable: true },
	text: { enumerable: true }
});

Body.mixIn = function (proto) {
	for (const name of Object.getOwnPropertyNames(Body.prototype)) {
		// istanbul ignore else: future proof
		if (!(name in proto)) {
			const desc = Object.getOwnPropertyDescriptor(Body.prototype, name);
			Object.defineProperty(proto, name, desc);
		}
	}
};

/**
 * Consume and convert an entire Body to a Buffer.
 *
 * Ref: https://fetch.spec.whatwg.org/#concept-body-consume-body
 *
 * @return  Promise
 */
function consumeBody() {
	var _this4 = this;

	if (this[INTERNALS].disturbed) {
		return Body.Promise.reject(new TypeError(`body used already for: ${this.url}`));
	}

	this[INTERNALS].disturbed = true;

	if (this[INTERNALS].error) {
		return Body.Promise.reject(this[INTERNALS].error);
	}

	let body = this.body;

	// body is null
	if (body === null) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// body is blob
	if (isBlob(body)) {
		body = body.stream();
	}

	// body is buffer
	if (Buffer.isBuffer(body)) {
		return Body.Promise.resolve(body);
	}

	// istanbul ignore if: should never happen
	if (!(body instanceof Stream__default["default"])) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// body is stream
	// get ready to actually consume the body
	let accum = [];
	let accumBytes = 0;
	let abort = false;

	return new Body.Promise(function (resolve, reject) {
		let resTimeout;

		// allow timeout on slow response body
		if (_this4.timeout) {
			resTimeout = setTimeout(function () {
				abort = true;
				reject(new FetchError(`Response timeout while trying to fetch ${_this4.url} (over ${_this4.timeout}ms)`, 'body-timeout'));
			}, _this4.timeout);
		}

		// handle stream errors
		body.on('error', function (err) {
			if (err.name === 'AbortError') {
				// if the request was aborted, reject with this Error
				abort = true;
				reject(err);
			} else {
				// other errors, such as incorrect content-encoding
				reject(new FetchError(`Invalid response body while trying to fetch ${_this4.url}: ${err.message}`, 'system', err));
			}
		});

		body.on('data', function (chunk) {
			if (abort || chunk === null) {
				return;
			}

			if (_this4.size && accumBytes + chunk.length > _this4.size) {
				abort = true;
				reject(new FetchError(`content size at ${_this4.url} over limit: ${_this4.size}`, 'max-size'));
				return;
			}

			accumBytes += chunk.length;
			accum.push(chunk);
		});

		body.on('end', function () {
			if (abort) {
				return;
			}

			clearTimeout(resTimeout);

			try {
				resolve(Buffer.concat(accum, accumBytes));
			} catch (err) {
				// handle streams that have accumulated too much data (issue #414)
				reject(new FetchError(`Could not create Buffer from response body for ${_this4.url}: ${err.message}`, 'system', err));
			}
		});
	});
}

/**
 * Detect buffer encoding and convert to target encoding
 * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
 *
 * @param   Buffer  buffer    Incoming buffer
 * @param   String  encoding  Target encoding
 * @return  String
 */
function convertBody(buffer, headers) {
	if (typeof convert !== 'function') {
		throw new Error('The package `encoding` must be installed to use the textConverted() function');
	}

	const ct = headers.get('content-type');
	let charset = 'utf-8';
	let res, str;

	// header
	if (ct) {
		res = /charset=([^;]*)/i.exec(ct);
	}

	// no charset in content type, peek at response body for at most 1024 bytes
	str = buffer.slice(0, 1024).toString();

	// html5
	if (!res && str) {
		res = /<meta.+?charset=(['"])(.+?)\1/i.exec(str);
	}

	// html4
	if (!res && str) {
		res = /<meta[\s]+?http-equiv=(['"])content-type\1[\s]+?content=(['"])(.+?)\2/i.exec(str);
		if (!res) {
			res = /<meta[\s]+?content=(['"])(.+?)\1[\s]+?http-equiv=(['"])content-type\3/i.exec(str);
			if (res) {
				res.pop(); // drop last quote
			}
		}

		if (res) {
			res = /charset=(.*)/i.exec(res.pop());
		}
	}

	// xml
	if (!res && str) {
		res = /<\?xml.+?encoding=(['"])(.+?)\1/i.exec(str);
	}

	// found charset
	if (res) {
		charset = res.pop();

		// prevent decode issues when sites use incorrect encoding
		// ref: https://hsivonen.fi/encoding-menu/
		if (charset === 'gb2312' || charset === 'gbk') {
			charset = 'gb18030';
		}
	}

	// turn raw buffers into a single utf-8 buffer
	return convert(buffer, 'UTF-8', charset).toString();
}

/**
 * Detect a URLSearchParams object
 * ref: https://github.com/bitinn/node-fetch/issues/296#issuecomment-307598143
 *
 * @param   Object  obj     Object to detect by type or brand
 * @return  String
 */
function isURLSearchParams(obj) {
	// Duck-typing as a necessary condition.
	if (typeof obj !== 'object' || typeof obj.append !== 'function' || typeof obj.delete !== 'function' || typeof obj.get !== 'function' || typeof obj.getAll !== 'function' || typeof obj.has !== 'function' || typeof obj.set !== 'function') {
		return false;
	}

	// Brand-checking and more duck-typing as optional condition.
	return obj.constructor.name === 'URLSearchParams' || Object.prototype.toString.call(obj) === '[object URLSearchParams]' || typeof obj.sort === 'function';
}

/**
 * Check if `obj` is a W3C `Blob` object (which `File` inherits from)
 * @param  {*} obj
 * @return {boolean}
 */
function isBlob(obj) {
	return typeof obj === 'object' && typeof obj.arrayBuffer === 'function' && typeof obj.type === 'string' && typeof obj.stream === 'function' && typeof obj.constructor === 'function' && typeof obj.constructor.name === 'string' && /^(Blob|File)$/.test(obj.constructor.name) && /^(Blob|File)$/.test(obj[Symbol.toStringTag]);
}

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed  instance  Response or Request instance
 * @return  Mixed
 */
function clone$2(instance) {
	let p1, p2;
	let body = instance.body;

	// don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if (body instanceof Stream__default["default"] && typeof body.getBoundary !== 'function') {
		// tee instance body
		p1 = new PassThrough();
		p2 = new PassThrough();
		body.pipe(p1);
		body.pipe(p2);
		// set instance body to teed body and return the other teed body
		instance[INTERNALS].body = p1;
		body = p2;
	}

	return body;
}

/**
 * Performs the operation "extract a `Content-Type` value from |object|" as
 * specified in the specification:
 * https://fetch.spec.whatwg.org/#concept-bodyinit-extract
 *
 * This function assumes that instance.body is present.
 *
 * @param   Mixed  instance  Any options.body input
 */
function extractContentType(body) {
	if (body === null) {
		// body is null
		return null;
	} else if (typeof body === 'string') {
		// body is string
		return 'text/plain;charset=UTF-8';
	} else if (isURLSearchParams(body)) {
		// body is a URLSearchParams
		return 'application/x-www-form-urlencoded;charset=UTF-8';
	} else if (isBlob(body)) {
		// body is blob
		return body.type || null;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return null;
	} else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
		// body is ArrayBuffer
		return null;
	} else if (ArrayBuffer.isView(body)) {
		// body is ArrayBufferView
		return null;
	} else if (typeof body.getBoundary === 'function') {
		// detect form data input from form-data module
		return `multipart/form-data;boundary=${body.getBoundary()}`;
	} else if (body instanceof Stream__default["default"]) {
		// body is stream
		// can't really do much about this
		return null;
	} else {
		// Body constructor defaults other things to string
		return 'text/plain;charset=UTF-8';
	}
}

/**
 * The Fetch Standard treats this as if "total bytes" is a property on the body.
 * For us, we have to explicitly get it with a function.
 *
 * ref: https://fetch.spec.whatwg.org/#concept-body-total-bytes
 *
 * @param   Body    instance   Instance of Body
 * @return  Number?            Number of bytes, or null if not possible
 */
function getTotalBytes(instance) {
	const body = instance.body;


	if (body === null) {
		// body is null
		return 0;
	} else if (isBlob(body)) {
		return body.size;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return body.length;
	} else if (body && typeof body.getLengthSync === 'function') {
		// detect form data input from form-data module
		if (body._lengthRetrievers && body._lengthRetrievers.length == 0 || // 1.x
		body.hasKnownLength && body.hasKnownLength()) {
			// 2.x
			return body.getLengthSync();
		}
		return null;
	} else {
		// body is stream
		return null;
	}
}

/**
 * Write a Body to a Node.js WritableStream (e.g. http.Request) object.
 *
 * @param   Body    instance   Instance of Body
 * @return  Void
 */
function writeToStream(dest, instance) {
	const body = instance.body;


	if (body === null) {
		// body is null
		dest.end();
	} else if (isBlob(body)) {
		body.stream().pipe(dest);
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		dest.write(body);
		dest.end();
	} else {
		// body is stream
		body.pipe(dest);
	}
}

// expose Promise
Body.Promise = global.Promise;

/**
 * headers.js
 *
 * Headers class offers convenient helpers
 */

const invalidTokenRegex = /[^\^_`a-zA-Z\-0-9!#$%&'*+.|~]/;
const invalidHeaderCharRegex = /[^\t\x20-\x7e\x80-\xff]/;

function validateName(name) {
	name = `${name}`;
	if (invalidTokenRegex.test(name) || name === '') {
		throw new TypeError(`${name} is not a legal HTTP header name`);
	}
}

function validateValue(value) {
	value = `${value}`;
	if (invalidHeaderCharRegex.test(value)) {
		throw new TypeError(`${value} is not a legal HTTP header value`);
	}
}

/**
 * Find the key in the map object given a header name.
 *
 * Returns undefined if not found.
 *
 * @param   String  name  Header name
 * @return  String|Undefined
 */
function find(map, name) {
	name = name.toLowerCase();
	for (const key in map) {
		if (key.toLowerCase() === name) {
			return key;
		}
	}
	return undefined;
}

const MAP = Symbol('map');
class Headers {
	/**
  * Headers class
  *
  * @param   Object  headers  Response headers
  * @return  Void
  */
	constructor() {
		let init = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;

		this[MAP] = Object.create(null);

		if (init instanceof Headers) {
			const rawHeaders = init.raw();
			const headerNames = Object.keys(rawHeaders);

			for (const headerName of headerNames) {
				for (const value of rawHeaders[headerName]) {
					this.append(headerName, value);
				}
			}

			return;
		}

		// We don't worry about converting prop to ByteString here as append()
		// will handle it.
		if (init == null) ; else if (typeof init === 'object') {
			const method = init[Symbol.iterator];
			if (method != null) {
				if (typeof method !== 'function') {
					throw new TypeError('Header pairs must be iterable');
				}

				// sequence<sequence<ByteString>>
				// Note: per spec we have to first exhaust the lists then process them
				const pairs = [];
				for (const pair of init) {
					if (typeof pair !== 'object' || typeof pair[Symbol.iterator] !== 'function') {
						throw new TypeError('Each header pair must be iterable');
					}
					pairs.push(Array.from(pair));
				}

				for (const pair of pairs) {
					if (pair.length !== 2) {
						throw new TypeError('Each header pair must be a name/value tuple');
					}
					this.append(pair[0], pair[1]);
				}
			} else {
				// record<ByteString, ByteString>
				for (const key of Object.keys(init)) {
					const value = init[key];
					this.append(key, value);
				}
			}
		} else {
			throw new TypeError('Provided initializer must be an object');
		}
	}

	/**
  * Return combined header value given name
  *
  * @param   String  name  Header name
  * @return  Mixed
  */
	get(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key === undefined) {
			return null;
		}

		return this[MAP][key].join(', ');
	}

	/**
  * Iterate over all headers
  *
  * @param   Function  callback  Executed for each item with parameters (value, name, thisArg)
  * @param   Boolean   thisArg   `this` context for callback function
  * @return  Void
  */
	forEach(callback) {
		let thisArg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

		let pairs = getHeaders(this);
		let i = 0;
		while (i < pairs.length) {
			var _pairs$i = pairs[i];
			const name = _pairs$i[0],
			      value = _pairs$i[1];

			callback.call(thisArg, value, name, this);
			pairs = getHeaders(this);
			i++;
		}
	}

	/**
  * Overwrite header values given name
  *
  * @param   String  name   Header name
  * @param   String  value  Header value
  * @return  Void
  */
	set(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		this[MAP][key !== undefined ? key : name] = [value];
	}

	/**
  * Append a value onto existing header
  *
  * @param   String  name   Header name
  * @param   String  value  Header value
  * @return  Void
  */
	append(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			this[MAP][key].push(value);
		} else {
			this[MAP][name] = [value];
		}
	}

	/**
  * Check for header name existence
  *
  * @param   String   name  Header name
  * @return  Boolean
  */
	has(name) {
		name = `${name}`;
		validateName(name);
		return find(this[MAP], name) !== undefined;
	}

	/**
  * Delete all header values given name
  *
  * @param   String  name  Header name
  * @return  Void
  */
	delete(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			delete this[MAP][key];
		}
	}

	/**
  * Return raw headers (non-spec api)
  *
  * @return  Object
  */
	raw() {
		return this[MAP];
	}

	/**
  * Get an iterator on keys.
  *
  * @return  Iterator
  */
	keys() {
		return createHeadersIterator(this, 'key');
	}

	/**
  * Get an iterator on values.
  *
  * @return  Iterator
  */
	values() {
		return createHeadersIterator(this, 'value');
	}

	/**
  * Get an iterator on entries.
  *
  * This is the default iterator of the Headers object.
  *
  * @return  Iterator
  */
	[Symbol.iterator]() {
		return createHeadersIterator(this, 'key+value');
	}
}
Headers.prototype.entries = Headers.prototype[Symbol.iterator];

Object.defineProperty(Headers.prototype, Symbol.toStringTag, {
	value: 'Headers',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Headers.prototype, {
	get: { enumerable: true },
	forEach: { enumerable: true },
	set: { enumerable: true },
	append: { enumerable: true },
	has: { enumerable: true },
	delete: { enumerable: true },
	keys: { enumerable: true },
	values: { enumerable: true },
	entries: { enumerable: true }
});

function getHeaders(headers) {
	let kind = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'key+value';

	const keys = Object.keys(headers[MAP]).sort();
	return keys.map(kind === 'key' ? function (k) {
		return k.toLowerCase();
	} : kind === 'value' ? function (k) {
		return headers[MAP][k].join(', ');
	} : function (k) {
		return [k.toLowerCase(), headers[MAP][k].join(', ')];
	});
}

const INTERNAL = Symbol('internal');

function createHeadersIterator(target, kind) {
	const iterator = Object.create(HeadersIteratorPrototype);
	iterator[INTERNAL] = {
		target,
		kind,
		index: 0
	};
	return iterator;
}

const HeadersIteratorPrototype = Object.setPrototypeOf({
	next() {
		// istanbul ignore if
		if (!this || Object.getPrototypeOf(this) !== HeadersIteratorPrototype) {
			throw new TypeError('Value of `this` is not a HeadersIterator');
		}

		var _INTERNAL = this[INTERNAL];
		const target = _INTERNAL.target,
		      kind = _INTERNAL.kind,
		      index = _INTERNAL.index;

		const values = getHeaders(target, kind);
		const len = values.length;
		if (index >= len) {
			return {
				value: undefined,
				done: true
			};
		}

		this[INTERNAL].index = index + 1;

		return {
			value: values[index],
			done: false
		};
	}
}, Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())));

Object.defineProperty(HeadersIteratorPrototype, Symbol.toStringTag, {
	value: 'HeadersIterator',
	writable: false,
	enumerable: false,
	configurable: true
});

/**
 * Export the Headers object in a form that Node.js can consume.
 *
 * @param   Headers  headers
 * @return  Object
 */
function exportNodeCompatibleHeaders(headers) {
	const obj = Object.assign({ __proto__: null }, headers[MAP]);

	// http.request() only supports string as Host header. This hack makes
	// specifying custom Host header possible.
	const hostHeaderKey = find(headers[MAP], 'Host');
	if (hostHeaderKey !== undefined) {
		obj[hostHeaderKey] = obj[hostHeaderKey][0];
	}

	return obj;
}

/**
 * Create a Headers object from an object of headers, ignoring those that do
 * not conform to HTTP grammar productions.
 *
 * @param   Object  obj  Object of headers
 * @return  Headers
 */
function createHeadersLenient(obj) {
	const headers = new Headers();
	for (const name of Object.keys(obj)) {
		if (invalidTokenRegex.test(name)) {
			continue;
		}
		if (Array.isArray(obj[name])) {
			for (const val of obj[name]) {
				if (invalidHeaderCharRegex.test(val)) {
					continue;
				}
				if (headers[MAP][name] === undefined) {
					headers[MAP][name] = [val];
				} else {
					headers[MAP][name].push(val);
				}
			}
		} else if (!invalidHeaderCharRegex.test(obj[name])) {
			headers[MAP][name] = [obj[name]];
		}
	}
	return headers;
}

const INTERNALS$1 = Symbol('Response internals');

// fix an issue where "STATUS_CODES" aren't a named export for node <10
const STATUS_CODES = http__default["default"].STATUS_CODES;

/**
 * Response class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Response {
	constructor() {
		let body = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
		let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		Body.call(this, body, opts);

		const status = opts.status || 200;
		const headers = new Headers(opts.headers);

		if (body != null && !headers.has('Content-Type')) {
			const contentType = extractContentType(body);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		this[INTERNALS$1] = {
			url: opts.url,
			status,
			statusText: opts.statusText || STATUS_CODES[status],
			headers,
			counter: opts.counter
		};
	}

	get url() {
		return this[INTERNALS$1].url || '';
	}

	get status() {
		return this[INTERNALS$1].status;
	}

	/**
  * Convenience property representing if the request ended normally
  */
	get ok() {
		return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
	}

	get redirected() {
		return this[INTERNALS$1].counter > 0;
	}

	get statusText() {
		return this[INTERNALS$1].statusText;
	}

	get headers() {
		return this[INTERNALS$1].headers;
	}

	/**
  * Clone this response
  *
  * @return  Response
  */
	clone() {
		return new Response(clone$2(this), {
			url: this.url,
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
			ok: this.ok,
			redirected: this.redirected
		});
	}
}

Body.mixIn(Response.prototype);

Object.defineProperties(Response.prototype, {
	url: { enumerable: true },
	status: { enumerable: true },
	ok: { enumerable: true },
	redirected: { enumerable: true },
	statusText: { enumerable: true },
	headers: { enumerable: true },
	clone: { enumerable: true }
});

Object.defineProperty(Response.prototype, Symbol.toStringTag, {
	value: 'Response',
	writable: false,
	enumerable: false,
	configurable: true
});

const INTERNALS$2 = Symbol('Request internals');
const URL$1 = publicApi.URL;

// fix an issue where "format", "parse" aren't a named export for node <10
const parse_url = Url__default["default"].parse;
const format_url = Url__default["default"].format;

/**
 * Wrapper around `new URL` to handle arbitrary URLs
 *
 * @param  {string} urlStr
 * @return {void}
 */
function parseURL(urlStr) {
	/*
 	Check whether the URL is absolute or not
 		Scheme: https://tools.ietf.org/html/rfc3986#section-3.1
 	Absolute URL: https://tools.ietf.org/html/rfc3986#section-4.3
 */
	if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.exec(urlStr)) {
		urlStr = new URL$1(urlStr).toString();
	}

	// Fallback to old implementation for arbitrary URLs
	return parse_url(urlStr);
}

const streamDestructionSupported = 'destroy' in Stream__default["default"].Readable.prototype;

/**
 * Check if a value is an instance of Request.
 *
 * @param   Mixed   input
 * @return  Boolean
 */
function isRequest(input) {
	return typeof input === 'object' && typeof input[INTERNALS$2] === 'object';
}

function isAbortSignal(signal) {
	const proto = signal && typeof signal === 'object' && Object.getPrototypeOf(signal);
	return !!(proto && proto.constructor.name === 'AbortSignal');
}

/**
 * Request class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
class Request {
	constructor(input) {
		let init = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		let parsedURL;

		// normalize input
		if (!isRequest(input)) {
			if (input && input.href) {
				// in order to support Node.js' Url objects; though WHATWG's URL objects
				// will fall into this branch also (since their `toString()` will return
				// `href` property anyway)
				parsedURL = parseURL(input.href);
			} else {
				// coerce input to a string before attempting to parse
				parsedURL = parseURL(`${input}`);
			}
			input = {};
		} else {
			parsedURL = parseURL(input.url);
		}

		let method = init.method || input.method || 'GET';
		method = method.toUpperCase();

		if ((init.body != null || isRequest(input) && input.body !== null) && (method === 'GET' || method === 'HEAD')) {
			throw new TypeError('Request with GET/HEAD method cannot have body');
		}

		let inputBody = init.body != null ? init.body : isRequest(input) && input.body !== null ? clone$2(input) : null;

		Body.call(this, inputBody, {
			timeout: init.timeout || input.timeout || 0,
			size: init.size || input.size || 0
		});

		const headers = new Headers(init.headers || input.headers || {});

		if (inputBody != null && !headers.has('Content-Type')) {
			const contentType = extractContentType(inputBody);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		let signal = isRequest(input) ? input.signal : null;
		if ('signal' in init) signal = init.signal;

		if (signal != null && !isAbortSignal(signal)) {
			throw new TypeError('Expected signal to be an instanceof AbortSignal');
		}

		this[INTERNALS$2] = {
			method,
			redirect: init.redirect || input.redirect || 'follow',
			headers,
			parsedURL,
			signal
		};

		// node-fetch-only options
		this.follow = init.follow !== undefined ? init.follow : input.follow !== undefined ? input.follow : 20;
		this.compress = init.compress !== undefined ? init.compress : input.compress !== undefined ? input.compress : true;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;
	}

	get method() {
		return this[INTERNALS$2].method;
	}

	get url() {
		return format_url(this[INTERNALS$2].parsedURL);
	}

	get headers() {
		return this[INTERNALS$2].headers;
	}

	get redirect() {
		return this[INTERNALS$2].redirect;
	}

	get signal() {
		return this[INTERNALS$2].signal;
	}

	/**
  * Clone this request
  *
  * @return  Request
  */
	clone() {
		return new Request(this);
	}
}

Body.mixIn(Request.prototype);

Object.defineProperty(Request.prototype, Symbol.toStringTag, {
	value: 'Request',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Request.prototype, {
	method: { enumerable: true },
	url: { enumerable: true },
	headers: { enumerable: true },
	redirect: { enumerable: true },
	clone: { enumerable: true },
	signal: { enumerable: true }
});

/**
 * Convert a Request to Node.js http request options.
 *
 * @param   Request  A Request instance
 * @return  Object   The options object to be passed to http.request
 */
function getNodeRequestOptions(request) {
	const parsedURL = request[INTERNALS$2].parsedURL;
	const headers = new Headers(request[INTERNALS$2].headers);

	// fetch step 1.3
	if (!headers.has('Accept')) {
		headers.set('Accept', '*/*');
	}

	// Basic fetch
	if (!parsedURL.protocol || !parsedURL.hostname) {
		throw new TypeError('Only absolute URLs are supported');
	}

	if (!/^https?:$/.test(parsedURL.protocol)) {
		throw new TypeError('Only HTTP(S) protocols are supported');
	}

	if (request.signal && request.body instanceof Stream__default["default"].Readable && !streamDestructionSupported) {
		throw new Error('Cancellation of streamed requests with AbortSignal is not supported in node < 8');
	}

	// HTTP-network-or-cache fetch steps 2.4-2.7
	let contentLengthValue = null;
	if (request.body == null && /^(POST|PUT)$/i.test(request.method)) {
		contentLengthValue = '0';
	}
	if (request.body != null) {
		const totalBytes = getTotalBytes(request);
		if (typeof totalBytes === 'number') {
			contentLengthValue = String(totalBytes);
		}
	}
	if (contentLengthValue) {
		headers.set('Content-Length', contentLengthValue);
	}

	// HTTP-network-or-cache fetch step 2.11
	if (!headers.has('User-Agent')) {
		headers.set('User-Agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
	}

	// HTTP-network-or-cache fetch step 2.15
	if (request.compress && !headers.has('Accept-Encoding')) {
		headers.set('Accept-Encoding', 'gzip,deflate');
	}

	let agent = request.agent;
	if (typeof agent === 'function') {
		agent = agent(parsedURL);
	}

	if (!headers.has('Connection') && !agent) {
		headers.set('Connection', 'close');
	}

	// HTTP-network fetch step 4.2
	// chunked encoding is handled by Node.js

	return Object.assign({}, parsedURL, {
		method: request.method,
		headers: exportNodeCompatibleHeaders(headers),
		agent
	});
}

/**
 * abort-error.js
 *
 * AbortError interface for cancelled requests
 */

/**
 * Create AbortError instance
 *
 * @param   String      message      Error message for human
 * @return  AbortError
 */
function AbortError(message) {
  Error.call(this, message);

  this.type = 'aborted';
  this.message = message;

  // hide custom error implementation details from end-users
  Error.captureStackTrace(this, this.constructor);
}

AbortError.prototype = Object.create(Error.prototype);
AbortError.prototype.constructor = AbortError;
AbortError.prototype.name = 'AbortError';

// fix an issue where "PassThrough", "resolve" aren't a named export for node <10
const PassThrough$1 = Stream__default["default"].PassThrough;
const resolve_url = Url__default["default"].resolve;

/**
 * Fetch function
 *
 * @param   Mixed    url   Absolute url or Request instance
 * @param   Object   opts  Fetch options
 * @return  Promise
 */
function fetch(url, opts) {

	// allow custom promise
	if (!fetch.Promise) {
		throw new Error('native promise missing, set fetch.Promise to your favorite alternative');
	}

	Body.Promise = fetch.Promise;

	// wrap http.request into fetch
	return new fetch.Promise(function (resolve, reject) {
		// build request object
		const request = new Request(url, opts);
		const options = getNodeRequestOptions(request);

		const send = (options.protocol === 'https:' ? https__default["default"] : http__default["default"]).request;
		const signal = request.signal;

		let response = null;

		const abort = function abort() {
			let error = new AbortError('The user aborted a request.');
			reject(error);
			if (request.body && request.body instanceof Stream__default["default"].Readable) {
				request.body.destroy(error);
			}
			if (!response || !response.body) return;
			response.body.emit('error', error);
		};

		if (signal && signal.aborted) {
			abort();
			return;
		}

		const abortAndFinalize = function abortAndFinalize() {
			abort();
			finalize();
		};

		// send request
		const req = send(options);
		let reqTimeout;

		if (signal) {
			signal.addEventListener('abort', abortAndFinalize);
		}

		function finalize() {
			req.abort();
			if (signal) signal.removeEventListener('abort', abortAndFinalize);
			clearTimeout(reqTimeout);
		}

		if (request.timeout) {
			req.once('socket', function (socket) {
				reqTimeout = setTimeout(function () {
					reject(new FetchError(`network timeout at: ${request.url}`, 'request-timeout'));
					finalize();
				}, request.timeout);
			});
		}

		req.on('error', function (err) {
			reject(new FetchError(`request to ${request.url} failed, reason: ${err.message}`, 'system', err));
			finalize();
		});

		req.on('response', function (res) {
			clearTimeout(reqTimeout);

			const headers = createHeadersLenient(res.headers);

			// HTTP fetch step 5
			if (fetch.isRedirect(res.statusCode)) {
				// HTTP fetch step 5.2
				const location = headers.get('Location');

				// HTTP fetch step 5.3
				const locationURL = location === null ? null : resolve_url(request.url, location);

				// HTTP fetch step 5.5
				switch (request.redirect) {
					case 'error':
						reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, 'no-redirect'));
						finalize();
						return;
					case 'manual':
						// node-fetch-specific step: make manual redirect a bit easier to use by setting the Location header value to the resolved URL.
						if (locationURL !== null) {
							// handle corrupted header
							try {
								headers.set('Location', locationURL);
							} catch (err) {
								// istanbul ignore next: nodejs server prevent invalid response headers, we can't test this through normal request
								reject(err);
							}
						}
						break;
					case 'follow':
						// HTTP-redirect fetch step 2
						if (locationURL === null) {
							break;
						}

						// HTTP-redirect fetch step 5
						if (request.counter >= request.follow) {
							reject(new FetchError(`maximum redirect reached at: ${request.url}`, 'max-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 6 (counter increment)
						// Create a new Request object.
						const requestOpts = {
							headers: new Headers(request.headers),
							follow: request.follow,
							counter: request.counter + 1,
							agent: request.agent,
							compress: request.compress,
							method: request.method,
							body: request.body,
							signal: request.signal,
							timeout: request.timeout,
							size: request.size
						};

						// HTTP-redirect fetch step 9
						if (res.statusCode !== 303 && request.body && getTotalBytes(request) === null) {
							reject(new FetchError('Cannot follow redirect with body being a readable stream', 'unsupported-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 11
						if (res.statusCode === 303 || (res.statusCode === 301 || res.statusCode === 302) && request.method === 'POST') {
							requestOpts.method = 'GET';
							requestOpts.body = undefined;
							requestOpts.headers.delete('content-length');
						}

						// HTTP-redirect fetch step 15
						resolve(fetch(new Request(locationURL, requestOpts)));
						finalize();
						return;
				}
			}

			// prepare response
			res.once('end', function () {
				if (signal) signal.removeEventListener('abort', abortAndFinalize);
			});
			let body = res.pipe(new PassThrough$1());

			const response_options = {
				url: request.url,
				status: res.statusCode,
				statusText: res.statusMessage,
				headers: headers,
				size: request.size,
				timeout: request.timeout,
				counter: request.counter
			};

			// HTTP-network fetch step 12.1.1.3
			const codings = headers.get('Content-Encoding');

			// HTTP-network fetch step 12.1.1.4: handle content codings

			// in following scenarios we ignore compression support
			// 1. compression support is disabled
			// 2. HEAD request
			// 3. no Content-Encoding header
			// 4. no content response (204)
			// 5. content not modified response (304)
			if (!request.compress || request.method === 'HEAD' || codings === null || res.statusCode === 204 || res.statusCode === 304) {
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// For Node v6+
			// Be less strict when decoding compressed responses, since sometimes
			// servers send slightly invalid responses that are still accepted
			// by common browsers.
			// Always using Z_SYNC_FLUSH is what cURL does.
			const zlibOptions = {
				flush: zlib__default["default"].Z_SYNC_FLUSH,
				finishFlush: zlib__default["default"].Z_SYNC_FLUSH
			};

			// for gzip
			if (codings == 'gzip' || codings == 'x-gzip') {
				body = body.pipe(zlib__default["default"].createGunzip(zlibOptions));
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// for deflate
			if (codings == 'deflate' || codings == 'x-deflate') {
				// handle the infamous raw deflate response from old servers
				// a hack for old IIS and Apache servers
				const raw = res.pipe(new PassThrough$1());
				raw.once('data', function (chunk) {
					// see http://stackoverflow.com/questions/37519828
					if ((chunk[0] & 0x0F) === 0x08) {
						body = body.pipe(zlib__default["default"].createInflate());
					} else {
						body = body.pipe(zlib__default["default"].createInflateRaw());
					}
					response = new Response(body, response_options);
					resolve(response);
				});
				return;
			}

			// for br
			if (codings == 'br' && typeof zlib__default["default"].createBrotliDecompress === 'function') {
				body = body.pipe(zlib__default["default"].createBrotliDecompress());
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// otherwise, use response as-is
			response = new Response(body, response_options);
			resolve(response);
		});

		writeToStream(req, request);
	});
}
/**
 * Redirect code matching
 *
 * @param   Number   code  Status code
 * @return  Boolean
 */
fetch.isRedirect = function (code) {
	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
};

// expose Promise
fetch.Promise = global.Promise;

var stringify$2 = function (...args) {

    try {
        return JSON.stringify.apply(null, args);
    }
    catch (err) {
        return '[Cannot display object: ' + err.message + ']';
    }
};

var error = createCommonjsModule(function (module, exports) {


module.exports = class extends Error {

    constructor(args) {

        const msgs = args
            .filter((arg) => arg !== '')
            .map((arg) => {

                return typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : stringify$2(arg);
            });

        super(msgs.join(' ') || 'Unknown error');

        if (typeof Error.captureStackTrace === 'function') {            // $lab:coverage:ignore$
            Error.captureStackTrace(this, exports.assert);
        }
    }
};
});

var assert$1 = function (condition, ...args) {

    if (condition) {
        return;
    }

    if (args.length === 1 &&
        args[0] instanceof Error) {

        throw args[0];
    }

    throw new error(args);
};

const internals$9 = {};


var reach$1 = function (obj, chain, options) {

    if (chain === false ||
        chain === null ||
        chain === undefined) {

        return obj;
    }

    options = options || {};
    if (typeof options === 'string') {
        options = { separator: options };
    }

    const isChainArray = Array.isArray(chain);

    assert$1(!isChainArray || !options.separator, 'Separator option no valid for array-based chain');

    const path = isChainArray ? chain : chain.split(options.separator || '.');
    let ref = obj;
    for (let i = 0; i < path.length; ++i) {
        let key = path[i];
        const type = options.iterables && internals$9.iterables(ref);

        if (Array.isArray(ref) ||
            type === 'set') {

            const number = Number(key);
            if (Number.isInteger(number)) {
                key = number < 0 ? ref.length + number : number;
            }
        }

        if (!ref ||
            typeof ref === 'function' && options.functions === false ||         // Defaults to true
            !type && ref[key] === undefined) {

            assert$1(!options.strict || i + 1 === path.length, 'Missing segment', key, 'in reach path ', chain);
            assert$1(typeof ref === 'object' || options.functions === true || typeof ref !== 'function', 'Invalid segment', key, 'in reach path ', chain);
            ref = options.default;
            break;
        }

        if (!type) {
            ref = ref[key];
        }
        else if (type === 'set') {
            ref = [...ref][key];
        }
        else {  // type === 'map'
            ref = ref.get(key);
        }
    }

    return ref;
};


internals$9.iterables = function (ref) {

    if (ref instanceof Set) {
        return 'set';
    }

    if (ref instanceof Map) {
        return 'map';
    }
};

var types$4 = createCommonjsModule(function (module, exports) {

const internals = {};


exports = module.exports = {
    array: Array.prototype,
    buffer: Buffer && Buffer.prototype,             // $lab:coverage:ignore$
    date: Date.prototype,
    error: Error.prototype,
    generic: Object.prototype,
    map: Map.prototype,
    promise: Promise.prototype,
    regex: RegExp.prototype,
    set: Set.prototype,
    weakMap: WeakMap.prototype,
    weakSet: WeakSet.prototype
};


internals.typeMap = new Map([
    ['[object Error]', exports.error],
    ['[object Map]', exports.map],
    ['[object Promise]', exports.promise],
    ['[object Set]', exports.set],
    ['[object WeakMap]', exports.weakMap],
    ['[object WeakSet]', exports.weakSet]
]);


exports.getInternalProto = function (obj) {

    if (Array.isArray(obj)) {
        return exports.array;
    }

    if (Buffer && obj instanceof Buffer) {          // $lab:coverage:ignore$
        return exports.buffer;
    }

    if (obj instanceof Date) {
        return exports.date;
    }

    if (obj instanceof RegExp) {
        return exports.regex;
    }

    if (obj instanceof Error) {
        return exports.error;
    }

    const objName = Object.prototype.toString.call(obj);
    return internals.typeMap.get(objName) || exports.generic;
};
});

var keys = function (obj, options = {}) {

    return options.symbols !== false ? Reflect.ownKeys(obj) : Object.getOwnPropertyNames(obj);  // Defaults to true
};

var utils = {
	keys: keys
};

const internals$8 = {
    needsProtoHack: new Set([types$4.set, types$4.map, types$4.weakSet, types$4.weakMap])
};


var clone$1 = internals$8.clone = function (obj, options = {}, _seen = null) {

    if (typeof obj !== 'object' ||
        obj === null) {

        return obj;
    }

    let clone = internals$8.clone;
    let seen = _seen;

    if (options.shallow) {
        if (options.shallow !== true) {
            return internals$8.cloneWithShallow(obj, options);
        }

        clone = (value) => value;
    }
    else if (seen) {
        const lookup = seen.get(obj);
        if (lookup) {
            return lookup;
        }
    }
    else {
        seen = new Map();
    }

    // Built-in object types

    const baseProto = types$4.getInternalProto(obj);
    if (baseProto === types$4.buffer) {
        return Buffer && Buffer.from(obj);              // $lab:coverage:ignore$
    }

    if (baseProto === types$4.date) {
        return new Date(obj.getTime());
    }

    if (baseProto === types$4.regex) {
        return new RegExp(obj);
    }

    // Generic objects

    const newObj = internals$8.base(obj, baseProto, options);
    if (newObj === obj) {
        return obj;
    }

    if (seen) {
        seen.set(obj, newObj);                              // Set seen, since obj could recurse
    }

    if (baseProto === types$4.set) {
        for (const value of obj) {
            newObj.add(clone(value, options, seen));
        }
    }
    else if (baseProto === types$4.map) {
        for (const [key, value] of obj) {
            newObj.set(key, clone(value, options, seen));
        }
    }

    const keys = utils.keys(obj, options);
    for (const key of keys) {
        if (key === '__proto__') {
            continue;
        }

        if (baseProto === types$4.array &&
            key === 'length') {

            newObj.length = obj.length;
            continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        if (descriptor) {
            if (descriptor.get ||
                descriptor.set) {

                Object.defineProperty(newObj, key, descriptor);
            }
            else if (descriptor.enumerable) {
                newObj[key] = clone(obj[key], options, seen);
            }
            else {
                Object.defineProperty(newObj, key, { enumerable: false, writable: true, configurable: true, value: clone(obj[key], options, seen) });
            }
        }
        else {
            Object.defineProperty(newObj, key, {
                enumerable: true,
                writable: true,
                configurable: true,
                value: clone(obj[key], options, seen)
            });
        }
    }

    return newObj;
};


internals$8.cloneWithShallow = function (source, options) {

    const keys = options.shallow;
    options = Object.assign({}, options);
    options.shallow = false;

    const seen = new Map();

    for (const key of keys) {
        const ref = reach$1(source, key);
        if (typeof ref === 'object' ||
            typeof ref === 'function') {

            seen.set(ref, ref);
        }
    }

    return internals$8.clone(source, options, seen);
};


internals$8.base = function (obj, baseProto, options) {

    if (options.prototype === false) {                  // Defaults to true
        if (internals$8.needsProtoHack.has(baseProto)) {
            return new baseProto.constructor();
        }

        return baseProto === types$4.array ? [] : {};
    }

    const proto = Object.getPrototypeOf(obj);
    if (proto &&
        proto.isImmutable) {

        return obj;
    }

    if (baseProto === types$4.array) {
        const newObj = [];
        if (proto !== baseProto) {
            Object.setPrototypeOf(newObj, proto);
        }

        return newObj;
    }

    if (internals$8.needsProtoHack.has(baseProto)) {
        const newObj = new proto.constructor();
        if (proto !== baseProto) {
            Object.setPrototypeOf(newObj, proto);
        }

        return newObj;
    }

    return Object.create(proto);
};

const internals$7 = {};


var merge$1 = internals$7.merge = function (target, source, options) {

    assert$1(target && typeof target === 'object', 'Invalid target value: must be an object');
    assert$1(source === null || source === undefined || typeof source === 'object', 'Invalid source value: must be null, undefined, or an object');

    if (!source) {
        return target;
    }

    options = Object.assign({ nullOverride: true, mergeArrays: true }, options);

    if (Array.isArray(source)) {
        assert$1(Array.isArray(target), 'Cannot merge array onto an object');
        if (!options.mergeArrays) {
            target.length = 0;                                                          // Must not change target assignment
        }

        for (let i = 0; i < source.length; ++i) {
            target.push(clone$1(source[i], { symbols: options.symbols }));
        }

        return target;
    }

    const keys = utils.keys(source, options);
    for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        if (key === '__proto__' ||
            !Object.prototype.propertyIsEnumerable.call(source, key)) {

            continue;
        }

        const value = source[key];
        if (value &&
            typeof value === 'object') {

            if (target[key] === value) {
                continue;                                           // Can occur for shallow merges
            }

            if (!target[key] ||
                typeof target[key] !== 'object' ||
                (Array.isArray(target[key]) !== Array.isArray(value)) ||
                value instanceof Date ||
                (Buffer && Buffer.isBuffer(value)) ||               // $lab:coverage:ignore$
                value instanceof RegExp) {

                target[key] = clone$1(value, { symbols: options.symbols });
            }
            else {
                internals$7.merge(target[key], value, options);
            }
        }
        else {
            if (value !== null &&
                value !== undefined) {                              // Explicit to preserve empty strings

                target[key] = value;
            }
            else if (options.nullOverride) {
                target[key] = value;
            }
        }
    }

    return target;
};

const internals$6 = {};


var applyToDefaults$1 = function (defaults, source, options = {}) {

    assert$1(defaults && typeof defaults === 'object', 'Invalid defaults value: must be an object');
    assert$1(!source || source === true || typeof source === 'object', 'Invalid source value: must be true, falsy or an object');
    assert$1(typeof options === 'object', 'Invalid options: must be an object');

    if (!source) {                                                  // If no source, return null
        return null;
    }

    if (options.shallow) {
        return internals$6.applyToDefaultsWithShallow(defaults, source, options);
    }

    const copy = clone$1(defaults);

    if (source === true) {                                          // If source is set to true, use defaults
        return copy;
    }

    const nullOverride = options.nullOverride !== undefined ? options.nullOverride : false;
    return merge$1(copy, source, { nullOverride, mergeArrays: false });
};


internals$6.applyToDefaultsWithShallow = function (defaults, source, options) {

    const keys = options.shallow;
    assert$1(Array.isArray(keys), 'Invalid keys');

    const seen = new Map();
    const merge = source === true ? null : new Set();

    for (let key of keys) {
        key = Array.isArray(key) ? key : key.split('.');            // Pre-split optimization

        const ref = reach$1(defaults, key);
        if (ref &&
            typeof ref === 'object') {

            seen.set(ref, merge && reach$1(source, key) || ref);
        }
        else if (merge) {
            merge.add(key);
        }
    }

    const copy = clone$1(defaults, {}, seen);

    if (!merge) {
        return copy;
    }

    for (const key of merge) {
        internals$6.reachCopy(copy, source, key);
    }

    const nullOverride = options.nullOverride !== undefined ? options.nullOverride : false;
    return merge$1(copy, source, { nullOverride, mergeArrays: false });
};


internals$6.reachCopy = function (dst, src, path) {

    for (const segment of path) {
        if (!(segment in src)) {
            return;
        }

        const val = src[segment];

        if (typeof val !== 'object' || val === null) {
            return;
        }

        src = val;
    }

    const value = src;
    let ref = dst;
    for (let i = 0; i < path.length - 1; ++i) {
        const segment = path[i];
        if (typeof ref[segment] !== 'object') {
            ref[segment] = {};
        }

        ref = ref[segment];
    }

    ref[path[path.length - 1]] = value;
};

const internals$5 = {};


var bench = internals$5.Bench = class {

    constructor() {

        this.ts = 0;
        this.reset();
    }

    reset() {

        this.ts = internals$5.Bench.now();
    }

    elapsed() {

        return internals$5.Bench.now() - this.ts;
    }

    static now() {

        const ts = process.hrtime();
        return (ts[0] * 1e3) + (ts[1] / 1e6);
    }
};

var ignore$1 = function () { };

var block$2 = function () {

    return new Promise(ignore$1);
};

const internals$4 = {
    mismatched: null
};


var deepEqual$1 = function (obj, ref, options) {

    options = Object.assign({ prototype: true }, options);

    return !!internals$4.isDeepEqual(obj, ref, options, []);
};


internals$4.isDeepEqual = function (obj, ref, options, seen) {

    if (obj === ref) {                                                      // Copied from Deep-eql, copyright(c) 2013 Jake Luer, jake@alogicalparadox.com, MIT Licensed, https://github.com/chaijs/deep-eql
        return obj !== 0 || 1 / obj === 1 / ref;
    }

    const type = typeof obj;

    if (type !== typeof ref) {
        return false;
    }

    if (obj === null ||
        ref === null) {

        return false;
    }

    if (type === 'function') {
        if (!options.deepFunction ||
            obj.toString() !== ref.toString()) {

            return false;
        }

        // Continue as object
    }
    else if (type !== 'object') {
        return obj !== obj && ref !== ref;                                  // NaN
    }

    const instanceType = internals$4.getSharedType(obj, ref, !!options.prototype);
    switch (instanceType) {
        case types$4.buffer:
            return Buffer && Buffer.prototype.equals.call(obj, ref);        // $lab:coverage:ignore$
        case types$4.promise:
            return obj === ref;
        case types$4.regex:
            return obj.toString() === ref.toString();
        case internals$4.mismatched:
            return false;
    }

    for (let i = seen.length - 1; i >= 0; --i) {
        if (seen[i].isSame(obj, ref)) {
            return true;                                                    // If previous comparison failed, it would have stopped execution
        }
    }

    seen.push(new internals$4.SeenEntry(obj, ref));

    try {
        return !!internals$4.isDeepEqualObj(instanceType, obj, ref, options, seen);
    }
    finally {
        seen.pop();
    }
};


internals$4.getSharedType = function (obj, ref, checkPrototype) {

    if (checkPrototype) {
        if (Object.getPrototypeOf(obj) !== Object.getPrototypeOf(ref)) {
            return internals$4.mismatched;
        }

        return types$4.getInternalProto(obj);
    }

    const type = types$4.getInternalProto(obj);
    if (type !== types$4.getInternalProto(ref)) {
        return internals$4.mismatched;
    }

    return type;
};


internals$4.valueOf = function (obj) {

    const objValueOf = obj.valueOf;
    if (objValueOf === undefined) {
        return obj;
    }

    try {
        return objValueOf.call(obj);
    }
    catch (err) {
        return err;
    }
};


internals$4.hasOwnEnumerableProperty = function (obj, key) {

    return Object.prototype.propertyIsEnumerable.call(obj, key);
};


internals$4.isSetSimpleEqual = function (obj, ref) {

    for (const entry of Set.prototype.values.call(obj)) {
        if (!Set.prototype.has.call(ref, entry)) {
            return false;
        }
    }

    return true;
};


internals$4.isDeepEqualObj = function (instanceType, obj, ref, options, seen) {

    const { isDeepEqual, valueOf, hasOwnEnumerableProperty } = internals$4;
    const { keys, getOwnPropertySymbols } = Object;

    if (instanceType === types$4.array) {
        if (options.part) {

            // Check if any index match any other index

            for (const objValue of obj) {
                for (const refValue of ref) {
                    if (isDeepEqual(objValue, refValue, options, seen)) {
                        return true;
                    }
                }
            }
        }
        else {
            if (obj.length !== ref.length) {
                return false;
            }

            for (let i = 0; i < obj.length; ++i) {
                if (!isDeepEqual(obj[i], ref[i], options, seen)) {
                    return false;
                }
            }

            return true;
        }
    }
    else if (instanceType === types$4.set) {
        if (obj.size !== ref.size) {
            return false;
        }

        if (!internals$4.isSetSimpleEqual(obj, ref)) {

            // Check for deep equality

            const ref2 = new Set(Set.prototype.values.call(ref));
            for (const objEntry of Set.prototype.values.call(obj)) {
                if (ref2.delete(objEntry)) {
                    continue;
                }

                let found = false;
                for (const refEntry of ref2) {
                    if (isDeepEqual(objEntry, refEntry, options, seen)) {
                        ref2.delete(refEntry);
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    return false;
                }
            }
        }
    }
    else if (instanceType === types$4.map) {
        if (obj.size !== ref.size) {
            return false;
        }

        for (const [key, value] of Map.prototype.entries.call(obj)) {
            if (value === undefined && !Map.prototype.has.call(ref, key)) {
                return false;
            }

            if (!isDeepEqual(value, Map.prototype.get.call(ref, key), options, seen)) {
                return false;
            }
        }
    }
    else if (instanceType === types$4.error) {

        // Always check name and message

        if (obj.name !== ref.name ||
            obj.message !== ref.message) {

            return false;
        }
    }

    // Check .valueOf()

    const valueOfObj = valueOf(obj);
    const valueOfRef = valueOf(ref);
    if ((obj !== valueOfObj || ref !== valueOfRef) &&
        !isDeepEqual(valueOfObj, valueOfRef, options, seen)) {

        return false;
    }

    // Check properties

    const objKeys = keys(obj);
    if (!options.part &&
        objKeys.length !== keys(ref).length &&
        !options.skip) {

        return false;
    }

    let skipped = 0;
    for (const key of objKeys) {
        if (options.skip &&
            options.skip.includes(key)) {

            if (ref[key] === undefined) {
                ++skipped;
            }

            continue;
        }

        if (!hasOwnEnumerableProperty(ref, key)) {
            return false;
        }

        if (!isDeepEqual(obj[key], ref[key], options, seen)) {
            return false;
        }
    }

    if (!options.part &&
        objKeys.length - skipped !== keys(ref).length) {

        return false;
    }

    // Check symbols

    if (options.symbols !== false) {                                // Defaults to true
        const objSymbols = getOwnPropertySymbols(obj);
        const refSymbols = new Set(getOwnPropertySymbols(ref));

        for (const key of objSymbols) {
            if (!options.skip ||
                !options.skip.includes(key)) {

                if (hasOwnEnumerableProperty(obj, key)) {
                    if (!hasOwnEnumerableProperty(ref, key)) {
                        return false;
                    }

                    if (!isDeepEqual(obj[key], ref[key], options, seen)) {
                        return false;
                    }
                }
                else if (hasOwnEnumerableProperty(ref, key)) {
                    return false;
                }
            }

            refSymbols.delete(key);
        }

        for (const key of refSymbols) {
            if (hasOwnEnumerableProperty(ref, key)) {
                return false;
            }
        }
    }

    return true;
};


internals$4.SeenEntry = class {

    constructor(obj, ref) {

        this.obj = obj;
        this.ref = ref;
    }

    isSame(obj, ref) {

        return this.obj === obj && this.ref === ref;
    }
};

var escapeRegex$1 = function (string) {

    // Escape ^$.*+-?=!:|\/()[]{},

    return string.replace(/[\^\$\.\*\+\-\?\=\!\:\|\\\/\(\)\[\]\{\}\,]/g, '\\$&');
};

const internals$3 = {};


var contain$1 = function (ref, values, options = {}) {        // options: { deep, once, only, part, symbols }

    /*
        string -> string(s)
        array -> item(s)
        object -> key(s)
        object -> object (key:value)
    */

    if (typeof values !== 'object') {
        values = [values];
    }

    assert$1(!Array.isArray(values) || values.length, 'Values array cannot be empty');

    // String

    if (typeof ref === 'string') {
        return internals$3.string(ref, values, options);
    }

    // Array

    if (Array.isArray(ref)) {
        return internals$3.array(ref, values, options);
    }

    // Object

    assert$1(typeof ref === 'object', 'Reference must be string or an object');
    return internals$3.object(ref, values, options);
};


internals$3.array = function (ref, values, options) {

    if (!Array.isArray(values)) {
        values = [values];
    }

    if (!ref.length) {
        return false;
    }

    if (options.only &&
        options.once &&
        ref.length !== values.length) {

        return false;
    }

    let compare;

    // Map values

    const map = new Map();
    for (const value of values) {
        if (!options.deep ||
            !value ||
            typeof value !== 'object') {

            const existing = map.get(value);
            if (existing) {
                ++existing.allowed;
            }
            else {
                map.set(value, { allowed: 1, hits: 0 });
            }
        }
        else {
            compare = compare || internals$3.compare(options);

            let found = false;
            for (const [key, existing] of map.entries()) {
                if (compare(key, value)) {
                    ++existing.allowed;
                    found = true;
                    break;
                }
            }

            if (!found) {
                map.set(value, { allowed: 1, hits: 0 });
            }
        }
    }

    // Lookup values

    let hits = 0;
    for (const item of ref) {
        let match;
        if (!options.deep ||
            !item ||
            typeof item !== 'object') {

            match = map.get(item);
        }
        else {
            compare = compare || internals$3.compare(options);

            for (const [key, existing] of map.entries()) {
                if (compare(key, item)) {
                    match = existing;
                    break;
                }
            }
        }

        if (match) {
            ++match.hits;
            ++hits;

            if (options.once &&
                match.hits > match.allowed) {

                return false;
            }
        }
    }

    // Validate results

    if (options.only &&
        hits !== ref.length) {

        return false;
    }

    for (const match of map.values()) {
        if (match.hits === match.allowed) {
            continue;
        }

        if (match.hits < match.allowed &&
            !options.part) {

            return false;
        }
    }

    return !!hits;
};


internals$3.object = function (ref, values, options) {

    assert$1(options.once === undefined, 'Cannot use option once with object');

    const keys = utils.keys(ref, options);
    if (!keys.length) {
        return false;
    }

    // Keys list

    if (Array.isArray(values)) {
        return internals$3.array(keys, values, options);
    }

    // Key value pairs

    const symbols = Object.getOwnPropertySymbols(values).filter((sym) => values.propertyIsEnumerable(sym));
    const targets = [...Object.keys(values), ...symbols];

    const compare = internals$3.compare(options);
    const set = new Set(targets);

    for (const key of keys) {
        if (!set.has(key)) {
            if (options.only) {
                return false;
            }

            continue;
        }

        if (!compare(values[key], ref[key])) {
            return false;
        }

        set.delete(key);
    }

    if (set.size) {
        return options.part ? set.size < targets.length : false;
    }

    return true;
};


internals$3.string = function (ref, values, options) {

    // Empty string

    if (ref === '') {
        return values.length === 1 && values[0] === '' ||               // '' contains ''
            !options.once && !values.some((v) => v !== '');             // '' contains multiple '' if !once
    }

    // Map values

    const map = new Map();
    const patterns = [];

    for (const value of values) {
        assert$1(typeof value === 'string', 'Cannot compare string reference to non-string value');

        if (value) {
            const existing = map.get(value);
            if (existing) {
                ++existing.allowed;
            }
            else {
                map.set(value, { allowed: 1, hits: 0 });
                patterns.push(escapeRegex$1(value));
            }
        }
        else if (options.once ||
            options.only) {

            return false;
        }
    }

    if (!patterns.length) {                     // Non-empty string contains unlimited empty string
        return true;
    }

    // Match patterns

    const regex = new RegExp(`(${patterns.join('|')})`, 'g');
    const leftovers = ref.replace(regex, ($0, $1) => {

        ++map.get($1).hits;
        return '';                              // Remove from string
    });

    // Validate results

    if (options.only &&
        leftovers) {

        return false;
    }

    let any = false;
    for (const match of map.values()) {
        if (match.hits) {
            any = true;
        }

        if (match.hits === match.allowed) {
            continue;
        }

        if (match.hits < match.allowed &&
            !options.part) {

            return false;
        }

        // match.hits > match.allowed

        if (options.once) {
            return false;
        }
    }

    return !!any;
};


internals$3.compare = function (options) {

    if (!options.deep) {
        return internals$3.shallow;
    }

    const hasOnly = options.only !== undefined;
    const hasPart = options.part !== undefined;

    const flags = {
        prototype: hasOnly ? options.only : hasPart ? !options.part : false,
        part: hasOnly ? !options.only : hasPart ? options.part : false
    };

    return (a, b) => deepEqual$1(a, b, flags);
};


internals$3.shallow = function (a, b) {

    return a === b;
};

var escapeHeaderAttribute$1 = function (attribute) {

    // Allowed value characters: !#$%&'()*+,-./:;<=>?@[]^_`{|}~ and space, a-z, A-Z, 0-9, \, "

    assert$1(/^[ \w\!#\$%&'\(\)\*\+,\-\.\/\:;<\=>\?@\[\]\^`\{\|\}~\"\\]*$/.test(attribute), 'Bad attribute value (' + attribute + ')');

    return attribute.replace(/\\/g, '\\\\').replace(/\"/g, '\\"');                             // Escape quotes and slash
};

const internals$2 = {};


var escapeHtml$2 = function (input) {

    if (!input) {
        return '';
    }

    let escaped = '';

    for (let i = 0; i < input.length; ++i) {

        const charCode = input.charCodeAt(i);

        if (internals$2.isSafe(charCode)) {
            escaped += input[i];
        }
        else {
            escaped += internals$2.escapeHtmlChar(charCode);
        }
    }

    return escaped;
};


internals$2.escapeHtmlChar = function (charCode) {

    const namedEscape = internals$2.namedHtml[charCode];
    if (typeof namedEscape !== 'undefined') {
        return namedEscape;
    }

    if (charCode >= 256) {
        return '&#' + charCode + ';';
    }

    const hexValue = charCode.toString(16).padStart(2, '0');
    return `&#x${hexValue};`;
};


internals$2.isSafe = function (charCode) {

    return (typeof internals$2.safeCharCodes[charCode] !== 'undefined');
};


internals$2.namedHtml = {
    '38': '&amp;',
    '60': '&lt;',
    '62': '&gt;',
    '34': '&quot;',
    '160': '&nbsp;',
    '162': '&cent;',
    '163': '&pound;',
    '164': '&curren;',
    '169': '&copy;',
    '174': '&reg;'
};


internals$2.safeCharCodes = (function () {

    const safe = {};

    for (let i = 32; i < 123; ++i) {

        if ((i >= 97) ||                    // a-z
            (i >= 65 && i <= 90) ||         // A-Z
            (i >= 48 && i <= 57) ||         // 0-9
            i === 32 ||                     // space
            i === 46 ||                     // .
            i === 44 ||                     // ,
            i === 45 ||                     // -
            i === 58 ||                     // :
            i === 95) {                     // _

            safe[i] = null;
        }
    }

    return safe;
}());

var escapeJson$1 = function (input) {

    if (!input) {
        return '';
    }

    const lessThan = 0x3C;
    const greaterThan = 0x3E;
    const andSymbol = 0x26;
    const lineSeperator = 0x2028;

    // replace method
    let charCode;
    return input.replace(/[<>&\u2028\u2029]/g, (match) => {

        charCode = match.charCodeAt(0);

        if (charCode === lessThan) {
            return '\\u003c';
        }

        if (charCode === greaterThan) {
            return '\\u003e';
        }

        if (charCode === andSymbol) {
            return '\\u0026';
        }

        if (charCode === lineSeperator) {
            return '\\u2028';
        }

        return '\\u2029';
    });
};

const internals$1 = {};


var flatten$1 = internals$1.flatten = function (array, target) {

    const result = target || [];

    for (let i = 0; i < array.length; ++i) {
        if (Array.isArray(array[i])) {
            internals$1.flatten(array[i], result);
        }
        else {
            result.push(array[i]);
        }
    }

    return result;
};

const internals = {};


var intersect$1 = function (array1, array2, options = {}) {

    if (!array1 ||
        !array2) {

        return (options.first ? null : []);
    }

    const common = [];
    const hash = (Array.isArray(array1) ? new Set(array1) : array1);
    const found = new Set();
    for (const value of array2) {
        if (internals.has(hash, value) &&
            !found.has(value)) {

            if (options.first) {
                return value;
            }

            common.push(value);
            found.add(value);
        }
    }

    return (options.first ? null : common);
};


internals.has = function (ref, key) {

    if (typeof ref.has === 'function') {
        return ref.has(key);
    }

    return ref[key] !== undefined;
};

var isPromise$1 = function (promise) {

    return !!promise && typeof promise.then === 'function';
};

var once$1 = function (method) {

    if (method._hoekOnce) {
        return method;
    }

    let once = false;
    const wrapped = function (...args) {

        if (!once) {
            once = true;
            method(...args);
        }
    };

    wrapped._hoekOnce = true;
    return wrapped;
};

var reachTemplate$1 = function (obj, template, options) {

    return template.replace(/{([^{}]+)}/g, ($0, chain) => {

        const value = reach$1(obj, chain, options);
        return (value === undefined || value === null ? '' : value);
    });
};

var wait$1 = function (timeout, returnValue) {

    if (typeof timeout !== 'number' && timeout !== undefined) {
        throw new TypeError('Timeout must be a number');
    }

    return new Promise((resolve) => setTimeout(resolve, timeout, returnValue));
};

var applyToDefaults = applyToDefaults$1;

var assert = assert$1;

var Bench = bench;

var block$1 = block$2;

var clone = clone$1;

var contain = contain$1;

var deepEqual = deepEqual$1;

var _Error$1 = error;

var escapeHeaderAttribute = escapeHeaderAttribute$1;

var escapeHtml$1 = escapeHtml$2;

var escapeJson = escapeJson$1;

var escapeRegex = escapeRegex$1;

var flatten = flatten$1;

var ignore = ignore$1;

var intersect = intersect$1;

var isPromise = isPromise$1;

var merge = merge$1;

var once = once$1;

var reach = reach$1;

var reachTemplate = reachTemplate$1;

var stringify$1 = stringify$2;

var wait = wait$1;

var lib$4 = {
	applyToDefaults: applyToDefaults,
	assert: assert,
	Bench: Bench,
	block: block$1,
	clone: clone,
	contain: contain,
	deepEqual: deepEqual,
	Error: _Error$1,
	escapeHeaderAttribute: escapeHeaderAttribute,
	escapeHtml: escapeHtml$1,
	escapeJson: escapeJson,
	escapeRegex: escapeRegex,
	flatten: flatten,
	ignore: ignore,
	intersect: intersect,
	isPromise: isPromise,
	merge: merge,
	once: once,
	reach: reach,
	reachTemplate: reachTemplate,
	stringify: stringify$1,
	wait: wait
};

var lib$3 = createCommonjsModule(function (module, exports) {




const internals = {
    codes: new Map([
        [100, 'Continue'],
        [101, 'Switching Protocols'],
        [102, 'Processing'],
        [200, 'OK'],
        [201, 'Created'],
        [202, 'Accepted'],
        [203, 'Non-Authoritative Information'],
        [204, 'No Content'],
        [205, 'Reset Content'],
        [206, 'Partial Content'],
        [207, 'Multi-Status'],
        [300, 'Multiple Choices'],
        [301, 'Moved Permanently'],
        [302, 'Moved Temporarily'],
        [303, 'See Other'],
        [304, 'Not Modified'],
        [305, 'Use Proxy'],
        [307, 'Temporary Redirect'],
        [400, 'Bad Request'],
        [401, 'Unauthorized'],
        [402, 'Payment Required'],
        [403, 'Forbidden'],
        [404, 'Not Found'],
        [405, 'Method Not Allowed'],
        [406, 'Not Acceptable'],
        [407, 'Proxy Authentication Required'],
        [408, 'Request Time-out'],
        [409, 'Conflict'],
        [410, 'Gone'],
        [411, 'Length Required'],
        [412, 'Precondition Failed'],
        [413, 'Request Entity Too Large'],
        [414, 'Request-URI Too Large'],
        [415, 'Unsupported Media Type'],
        [416, 'Requested Range Not Satisfiable'],
        [417, 'Expectation Failed'],
        [418, 'I\'m a teapot'],
        [422, 'Unprocessable Entity'],
        [423, 'Locked'],
        [424, 'Failed Dependency'],
        [425, 'Too Early'],
        [426, 'Upgrade Required'],
        [428, 'Precondition Required'],
        [429, 'Too Many Requests'],
        [431, 'Request Header Fields Too Large'],
        [451, 'Unavailable For Legal Reasons'],
        [500, 'Internal Server Error'],
        [501, 'Not Implemented'],
        [502, 'Bad Gateway'],
        [503, 'Service Unavailable'],
        [504, 'Gateway Time-out'],
        [505, 'HTTP Version Not Supported'],
        [506, 'Variant Also Negotiates'],
        [507, 'Insufficient Storage'],
        [509, 'Bandwidth Limit Exceeded'],
        [510, 'Not Extended'],
        [511, 'Network Authentication Required']
    ])
};


exports.Boom = class extends Error {

    constructor(message, options = {}) {

        if (message instanceof Error) {
            return exports.boomify(lib$4.clone(message), options);
        }

        const { statusCode = 500, data = null, ctor = exports.Boom } = options;
        const error = new Error(message ? message : undefined);         // Avoids settings null message
        Error.captureStackTrace(error, ctor);                           // Filter the stack to our external API
        error.data = data;
        const boom = internals.initialize(error, statusCode);

        Object.defineProperty(boom, 'typeof', { value: ctor });

        if (options.decorate) {
            Object.assign(boom, options.decorate);
        }

        return boom;
    }

    static [Symbol.hasInstance](instance) {

        if (this === exports.Boom) {
            return exports.isBoom(instance);
        }

        // Cannot use 'instanceof' as it creates infinite recursion

        return this.prototype.isPrototypeOf(instance);
    }
};


exports.isBoom = function (err, statusCode) {

    return err instanceof Error && !!err.isBoom && (!statusCode || err.output.statusCode === statusCode);
};


exports.boomify = function (err, options) {

    lib$4.assert(err instanceof Error, 'Cannot wrap non-Error object');

    options = options || {};

    if (options.data !== undefined) {
        err.data = options.data;
    }

    if (options.decorate) {
        Object.assign(err, options.decorate);
    }

    if (!err.isBoom) {
        return internals.initialize(err, options.statusCode || 500, options.message);
    }

    if (options.override === false ||                           // Defaults to true
        !options.statusCode && !options.message) {

        return err;
    }

    return internals.initialize(err, options.statusCode || err.output.statusCode, options.message);
};


// 4xx Client Errors

exports.badRequest = function (message, data) {

    return new exports.Boom(message, { statusCode: 400, data, ctor: exports.badRequest });
};


exports.unauthorized = function (message, scheme, attributes) {          // Or (message, wwwAuthenticate[])

    const err = new exports.Boom(message, { statusCode: 401, ctor: exports.unauthorized });

    // function (message)

    if (!scheme) {
        return err;
    }

    // function (message, wwwAuthenticate[])

    if (typeof scheme !== 'string') {
        err.output.headers['WWW-Authenticate'] = scheme.join(', ');
        return err;
    }

    // function (message, scheme, attributes)

    let wwwAuthenticate = `${scheme}`;

    if (attributes ||
        message) {

        err.output.payload.attributes = {};
    }

    if (attributes) {
        if (typeof attributes === 'string') {
            wwwAuthenticate += ' ' + lib$4.escapeHeaderAttribute(attributes);
            err.output.payload.attributes = attributes;
        }
        else {
            wwwAuthenticate += ' ' + Object.keys(attributes).map((name) => {

                let value = attributes[name];
                if (value === null ||
                    value === undefined) {

                    value = '';
                }

                err.output.payload.attributes[name] = value;
                return `${name}="${lib$4.escapeHeaderAttribute(value.toString())}"`;
            })
                .join(', ');
        }
    }

    if (message) {
        if (attributes) {
            wwwAuthenticate += ',';
        }

        wwwAuthenticate += ` error="${lib$4.escapeHeaderAttribute(message)}"`;
        err.output.payload.attributes.error = message;
    }
    else {
        err.isMissing = true;
    }

    err.output.headers['WWW-Authenticate'] = wwwAuthenticate;
    return err;
};


exports.paymentRequired = function (message, data) {

    return new exports.Boom(message, { statusCode: 402, data, ctor: exports.paymentRequired });
};


exports.forbidden = function (message, data) {

    return new exports.Boom(message, { statusCode: 403, data, ctor: exports.forbidden });
};


exports.notFound = function (message, data) {

    return new exports.Boom(message, { statusCode: 404, data, ctor: exports.notFound });
};


exports.methodNotAllowed = function (message, data, allow) {

    const err = new exports.Boom(message, { statusCode: 405, data, ctor: exports.methodNotAllowed });

    if (typeof allow === 'string') {
        allow = [allow];
    }

    if (Array.isArray(allow)) {
        err.output.headers.Allow = allow.join(', ');
    }

    return err;
};


exports.notAcceptable = function (message, data) {

    return new exports.Boom(message, { statusCode: 406, data, ctor: exports.notAcceptable });
};


exports.proxyAuthRequired = function (message, data) {

    return new exports.Boom(message, { statusCode: 407, data, ctor: exports.proxyAuthRequired });
};


exports.clientTimeout = function (message, data) {

    return new exports.Boom(message, { statusCode: 408, data, ctor: exports.clientTimeout });
};


exports.conflict = function (message, data) {

    return new exports.Boom(message, { statusCode: 409, data, ctor: exports.conflict });
};


exports.resourceGone = function (message, data) {

    return new exports.Boom(message, { statusCode: 410, data, ctor: exports.resourceGone });
};


exports.lengthRequired = function (message, data) {

    return new exports.Boom(message, { statusCode: 411, data, ctor: exports.lengthRequired });
};


exports.preconditionFailed = function (message, data) {

    return new exports.Boom(message, { statusCode: 412, data, ctor: exports.preconditionFailed });
};


exports.entityTooLarge = function (message, data) {

    return new exports.Boom(message, { statusCode: 413, data, ctor: exports.entityTooLarge });
};


exports.uriTooLong = function (message, data) {

    return new exports.Boom(message, { statusCode: 414, data, ctor: exports.uriTooLong });
};


exports.unsupportedMediaType = function (message, data) {

    return new exports.Boom(message, { statusCode: 415, data, ctor: exports.unsupportedMediaType });
};


exports.rangeNotSatisfiable = function (message, data) {

    return new exports.Boom(message, { statusCode: 416, data, ctor: exports.rangeNotSatisfiable });
};


exports.expectationFailed = function (message, data) {

    return new exports.Boom(message, { statusCode: 417, data, ctor: exports.expectationFailed });
};


exports.teapot = function (message, data) {

    return new exports.Boom(message, { statusCode: 418, data, ctor: exports.teapot });
};


exports.badData = function (message, data) {

    return new exports.Boom(message, { statusCode: 422, data, ctor: exports.badData });
};


exports.locked = function (message, data) {

    return new exports.Boom(message, { statusCode: 423, data, ctor: exports.locked });
};


exports.failedDependency = function (message, data) {

    return new exports.Boom(message, { statusCode: 424, data, ctor: exports.failedDependency });
};

exports.tooEarly = function (message, data) {

    return new exports.Boom(message, { statusCode: 425, data, ctor: exports.tooEarly });
};


exports.preconditionRequired = function (message, data) {

    return new exports.Boom(message, { statusCode: 428, data, ctor: exports.preconditionRequired });
};


exports.tooManyRequests = function (message, data) {

    return new exports.Boom(message, { statusCode: 429, data, ctor: exports.tooManyRequests });
};


exports.illegal = function (message, data) {

    return new exports.Boom(message, { statusCode: 451, data, ctor: exports.illegal });
};


// 5xx Server Errors

exports.internal = function (message, data, statusCode = 500) {

    return internals.serverError(message, data, statusCode, exports.internal);
};


exports.notImplemented = function (message, data) {

    return internals.serverError(message, data, 501, exports.notImplemented);
};


exports.badGateway = function (message, data) {

    return internals.serverError(message, data, 502, exports.badGateway);
};


exports.serverUnavailable = function (message, data) {

    return internals.serverError(message, data, 503, exports.serverUnavailable);
};


exports.gatewayTimeout = function (message, data) {

    return internals.serverError(message, data, 504, exports.gatewayTimeout);
};


exports.badImplementation = function (message, data) {

    const err = internals.serverError(message, data, 500, exports.badImplementation);
    err.isDeveloperError = true;
    return err;
};


internals.initialize = function (err, statusCode, message) {

    const numberCode = parseInt(statusCode, 10);
    lib$4.assert(!isNaN(numberCode) && numberCode >= 400, 'First argument must be a number (400+):', statusCode);

    err.isBoom = true;
    err.isServer = numberCode >= 500;

    if (!err.hasOwnProperty('data')) {
        err.data = null;
    }

    err.output = {
        statusCode: numberCode,
        payload: {},
        headers: {}
    };

    Object.defineProperty(err, 'reformat', { value: internals.reformat, configurable: true });

    if (!message &&
        !err.message) {

        err.reformat();
        message = err.output.payload.error;
    }

    if (message) {
        const props = Object.getOwnPropertyDescriptor(err, 'message') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(err), 'message');
        lib$4.assert(!props || props.configurable && !props.get, 'The error is not compatible with boom');

        err.message = message + (err.message ? ': ' + err.message : '');
        err.output.payload.message = err.message;
    }

    err.reformat();
    return err;
};


internals.reformat = function (debug = false) {

    this.output.payload.statusCode = this.output.statusCode;
    this.output.payload.error = internals.codes.get(this.output.statusCode) || 'Unknown';

    if (this.output.statusCode === 500 && debug !== true) {
        this.output.payload.message = 'An internal server error occurred';              // Hide actual error from user
    }
    else if (this.message) {
        this.output.payload.message = this.message;
    }
};


internals.serverError = function (message, data, statusCode, ctor) {

    if (data instanceof Error &&
        !data.isBoom) {

        return exports.boomify(data, { statusCode, message });
    }

    return new exports.Boom(message, { statusCode, data, ctor });
};
});

var header = createCommonjsModule(function (module, exports) {





const internals = {};


exports.selection = function (header, preferences, options) {

    const selections = exports.selections(header, preferences, options);
    return selections.length ? selections[0] : '';
};


exports.selections = function (header, preferences, options) {

    lib$4.assert(!preferences || Array.isArray(preferences), 'Preferences must be an array');

    return internals.parse(header || '', preferences, options);
};


//      RFC 7231 Section 5.3.3 (https://tools.ietf.org/html/rfc7231#section-5.3.3)
//
//      Accept-Charset  = *( "," OWS ) ( ( charset / "*" ) [ weight ] ) *( OWS "," [ OWS ( ( charset / "*" ) [ weight ] ) ] )
//      charset         = token
//
//      Accept-Charset: iso-8859-5, unicode-1-1;q=0.8


//      RFC 7231 Section 5.3.4 (https://tools.ietf.org/html/rfc7231#section-5.3.4)
//
//      Accept-Encoding = [ ( "," / ( codings [ weight ] ) ) *( OWS "," [ OWS ( codings [ weight ] ) ] ) ]
//      codings         = content-coding / "identity" / "*"
//      content-coding  = token
//
//      Accept-Encoding: compress, gzip
//      Accept-Encoding:
//      Accept-Encoding: *
//      Accept-Encoding: compress;q=0.5, gzip;q=1.0
//      Accept-Encoding: gzip;q=1.0, identity; q=0.5, *;q=0


//      RFC 7231 Section 5.3.5 (https://tools.ietf.org/html/rfc7231#section-5.3.5)
//
//      Accept-Language = *( "," OWS ) ( language-range [ weight ] ) *( OWS "," [ OWS ( language-range [ weight ] ) ] )
//      language-range  = ( 1*8ALPHA *( "-" 1*8alphanum ) ) / "*"   ; [RFC4647], Section 2.1
//      alphanum        = ALPHA / DIGIT
//
//       Accept-Language: da, en-gb;q=0.8, en;q=0.7


//      token           = 1*tchar
//      tchar           = "!" / "#" / "$" / "%" / "&" / "'" / "*"
//                        / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~"
//                        / DIGIT / ALPHA
//                        ; any VCHAR, except delimiters
//      OWS             = *( SP / HTAB )


//      RFC 7231 Section 5.3.1 (https://tools.ietf.org/html/rfc7231#section-5.3.1)
//
//      The weight is normalized to a real number in the range 0 through 1,
//      where 0.001 is the least preferred and 1 is the most preferred; a
//      value of 0 means "not acceptable".  If no "q" parameter is present,
//      the default weight is 1.
//
//       weight = OWS ";" OWS "q=" qvalue
//       qvalue = ( "0" [ "." 0*3DIGIT ] ) / ( "1" [ "." 0*3("0") ] )


internals.parse = function (raw, preferences, options) {

    // Normalize header (remove spaces and tabs)

    const header = raw.replace(/[ \t]/g, '');

    // Normalize preferences

    const lowers = new Map();
    if (preferences) {
        let pos = 0;
        for (const preference of preferences) {
            const lower = preference.toLowerCase();
            lowers.set(lower, { orig: preference, pos: pos++ });

            if (options.prefixMatch) {
                const parts = lower.split('-');
                while (parts.pop(), parts.length > 0) {
                    const joined = parts.join('-');
                    if (!lowers.has(joined)) {
                        lowers.set(joined, { orig: preference, pos: pos++ });
                    }
                }
            }
        }
    }

    // Parse selections

    const parts = header.split(',');
    const selections = [];
    const map = new Set();

    for (let i = 0; i < parts.length; ++i) {
        const part = parts[i];
        if (!part) {                            // Ignore empty parts or leading commas
            continue;
        }

        // Parse parameters

        const params = part.split(';');
        if (params.length > 2) {
            throw lib$3.badRequest(`Invalid ${options.type} header`);
        }

        let token = params[0].toLowerCase();
        if (!token) {
            throw lib$3.badRequest(`Invalid ${options.type} header`);
        }

        if (options.equivalents &&
            options.equivalents.has(token)) {

            token = options.equivalents.get(token);
        }

        const selection = {
            token,
            pos: i,
            q: 1
        };

        if (preferences &&
            lowers.has(token)) {

            selection.pref = lowers.get(token).pos;
        }

        map.add(selection.token);

        // Parse q=value

        if (params.length === 2) {
            const q = params[1];
            const [key, value] = q.split('=');

            if (!value ||
                key !== 'q' && key !== 'Q') {

                throw lib$3.badRequest(`Invalid ${options.type} header`);
            }

            const score = parseFloat(value);
            if (score === 0) {
                continue;
            }

            if (Number.isFinite(score) &&
                score <= 1 &&
                score >= 0.001) {

                selection.q = score;
            }
        }

        selections.push(selection);             // Only add allowed selections (q !== 0)
    }

    // Sort selection based on q and then position in header

    selections.sort(internals.sort);

    // Extract tokens

    const values = selections.map((selection) => selection.token);

    if (options.default &&
        !map.has(options.default)) {

        values.push(options.default);
    }

    if (!preferences ||
        !preferences.length) {

        return values;
    }

    const preferred = [];
    for (const selection of values) {
        if (selection === '*') {
            for (const [preference, value] of lowers) {
                if (!map.has(preference)) {
                    preferred.push(value.orig);
                }
            }
        }
        else {
            const lower = selection.toLowerCase();
            if (lowers.has(lower)) {
                preferred.push(lowers.get(lower).orig);
            }
        }
    }

    return preferred;
};


internals.sort = function (a, b) {

    const aFirst = -1;
    const bFirst = 1;

    if (b.q !== a.q) {
        return b.q - a.q;
    }

    if (b.pref !== a.pref) {
        if (a.pref === undefined) {
            return bFirst;
        }

        if (b.pref === undefined) {
            return aFirst;
        }

        return a.pref - b.pref;
    }

    return a.pos - b.pos;
};
});

var media = createCommonjsModule(function (module, exports) {





const internals = {};


exports.selection = function (header, preferences) {

    const selections = exports.selections(header, preferences);
    return selections.length ? selections[0] : '';
};


exports.selections = function (header, preferences) {

    lib$4.assert(!preferences || Array.isArray(preferences), 'Preferences must be an array');

    return internals.parse(header, preferences);
};


//      RFC 7231 Section 5.3.2 (https://tools.ietf.org/html/rfc7231#section-5.3.2)
//
//      Accept          = [ ( "," / ( media-range [ accept-params ] ) ) *( OWS "," [ OWS ( media-range [ accept-params ] ) ] ) ]
//      media-range     = ( "*/*" / ( type "/*" ) / ( type "/" subtype ) ) *( OWS ";" OWS parameter )
//      accept-params   = weight *accept-ext
//      accept-ext      = OWS ";" OWS token [ "=" ( token / quoted-string ) ]
//      type            = token
//      subtype         = token
//      parameter       = token "=" ( token / quoted-string )
//
//      quoted-string   = DQUOTE *( qdtext / quoted-pair ) DQUOTE
//      qdtext          = HTAB / SP /%x21 / %x23-5B / %x5D-7E / obs-text
//      obs-text        = %x80-FF
//      quoted-pair     = "\" ( HTAB / SP / VCHAR / obs-text )
//      VCHAR           = %x21-7E                                ; visible (printing) characters
//      token           = 1*tchar
//      tchar           = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
//      OWS             = *( SP / HTAB )
//
//      Accept: audio/*; q=0.2, audio/basic
//      Accept: text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c
//      Accept: text/plain, application/json;q=0.5, text/html, */*; q = 0.1
//      Accept: text/plain, application/json;q=0.5, text/html, text/drop;q=0
//      Accept: text/*, text/plain, text/plain;format=flowed, */*
//      Accept: text/*;q=0.3, text/html;q=0.7, text/html;level=1, text/html;level=2;q=0.4, */*;q=0.5


//      RFC 7231 Section 5.3.1 (https://tools.ietf.org/html/rfc7231#section-5.3.1)
//
//      The weight is normalized to a real number in the range 0 through 1,
//      where 0.001 is the least preferred and 1 is the most preferred; a
//      value of 0 means "not acceptable".  If no "q" parameter is present,
//      the default weight is 1.
//
//       weight = OWS ";" OWS "q=" qvalue
//       qvalue = ( "0" [ "." 0*3DIGIT ] ) / ( "1" [ "." 0*3("0") ] )


//                         */*        type/*                              type/subtype
internals.validMediaRx = /^(?:\*\/\*)|(?:[\w\!#\$%&'\*\+\-\.\^`\|~]+\/\*)|(?:[\w\!#\$%&'\*\+\-\.\^`\|~]+\/[\w\!#\$%&'\*\+\-\.\^`\|~]+)$/;


internals.parse = function (raw, preferences) {

    // Normalize header (remove spaces and temporary remove quoted strings)

    const { header, quoted } = internals.normalize(raw);

    // Parse selections

    const parts = header.split(',');
    const selections = [];
    const map = {};

    for (let i = 0; i < parts.length; ++i) {
        const part = parts[i];
        if (!part) {                                    // Ignore empty parts or leading commas
            continue;
        }

        // Parse parameters

        const pairs = part.split(';');
        const token = pairs.shift().toLowerCase();

        if (!internals.validMediaRx.test(token)) {       // Ignore invalid types
            continue;
        }

        const selection = {
            token,
            params: {},
            exts: {},
            pos: i
        };

        // Parse key=value

        let target = 'params';
        for (const pair of pairs) {
            const kv = pair.split('=');
            if (kv.length !== 2 ||
                !kv[1]) {

                throw lib$3.badRequest(`Invalid accept header`);
            }

            const key = kv[0];
            let value = kv[1];

            if (key === 'q' ||
                key === 'Q') {

                target = 'exts';

                value = parseFloat(value);
                if (!Number.isFinite(value) ||
                    value > 1 ||
                    (value < 0.001 && value !== 0)) {

                    value = 1;
                }

                selection.q = value;
            }
            else {
                if (value[0] === '"') {
                    value = `"${quoted[value]}"`;
                }

                selection[target][kv[0]] = value;
            }
        }

        const params = Object.keys(selection.params);
        selection.original = [''].concat(params.map((key) => `${key}=${selection.params[key]}`)).join(';');
        selection.specificity = params.length;

        if (selection.q === undefined) {     // Default no preference to q=1 (top preference)
            selection.q = 1;
        }

        const tparts = selection.token.split('/');
        selection.type = tparts[0];
        selection.subtype = tparts[1];

        map[selection.token] = selection;

        if (selection.q) {                   // Skip denied selections (q=0)
            selections.push(selection);
        }
    }

    // Sort selection based on q and then position in header

    selections.sort(internals.sort);

    return internals.preferences(map, selections, preferences);
};


internals.normalize = function (raw) {

    raw = raw || '*/*';

    const normalized = {
        header: raw,
        quoted: {}
    };

    if (raw.includes('"')) {
        let i = 0;
        normalized.header = raw.replace(/="([^"]*)"/g, ($0, $1) => {

            const key = '"' + ++i;
            normalized.quoted[key] = $1;
            return '=' + key;
        });
    }

    normalized.header = normalized.header.replace(/[ \t]/g, '');
    return normalized;
};


internals.sort = function (a, b) {

    // Sort by quality score

    if (b.q !== a.q) {
        return b.q - a.q;
    }

    // Sort by type

    if (a.type !== b.type) {
        return internals.innerSort(a, b, 'type');
    }

    // Sort by subtype

    if (a.subtype !== b.subtype) {
        return internals.innerSort(a, b, 'subtype');
    }

    // Sort by specificity

    if (a.specificity !== b.specificity) {
        return b.specificity - a.specificity;
    }

    return a.pos - b.pos;
};


internals.innerSort = function (a, b, key) {

    const aFirst = -1;
    const bFirst = 1;

    if (a[key] === '*') {
        return bFirst;
    }

    if (b[key] === '*') {
        return aFirst;
    }

    return a[key] < b[key] ? aFirst : bFirst;       // Group alphabetically
};


internals.preferences = function (map, selections, preferences) {

    // Return selections if no preferences

    if (!preferences ||
        !preferences.length) {

        return selections.map((selection) => selection.token + selection.original);
    }

    // Map wildcards and filter selections to preferences

    const lowers = Object.create(null);
    const flat = Object.create(null);
    let any = false;

    for (const preference of preferences) {
        const lower = preference.toLowerCase();
        flat[lower] = preference;
        const parts = lower.split('/');
        const type = parts[0];
        const subtype = parts[1];

        if (type === '*') {
            lib$4.assert(subtype === '*', 'Invalid media type preference contains wildcard type with a subtype');
            any = true;
            continue;
        }

        lowers[type] = lowers[type] || Object.create(null);
        lowers[type][subtype] = preference;
    }

    const preferred = [];
    for (const selection of selections) {
        const token = selection.token;
        const { type, subtype } = map[token];
        const subtypes = lowers[type];

        // */*

        if (type === '*') {
            for (const preference of Object.keys(flat)) {
                if (!map[preference]) {
                    preferred.push(flat[preference]);
                }
            }

            if (any) {
                preferred.push('*/*');
            }

            continue;
        }

        // any

        if (any) {
            preferred.push((flat[token] || token) + selection.original);
            continue;
        }

        // type/subtype

        if (subtype !== '*') {
            const pref = flat[token];
            if (pref ||
                (subtypes && subtypes['*'])) {

                preferred.push((pref || token) + selection.original);
            }

            continue;
        }

        // type/*

        if (subtypes) {
            for (const psub of Object.keys(subtypes)) {
                if (!map[`${type}/${psub}`]) {
                    preferred.push(subtypes[psub]);
                }
            }
        }
    }

    return preferred;
};
});

var lib$2 = createCommonjsModule(function (module, exports) {





const internals = {
    options: {
        charset: {
            type: 'accept-charset'
        },
        encoding: {
            type: 'accept-encoding',
            default: 'identity',
            equivalents: new Map([
                ['x-compress', 'compress'],
                ['x-gzip', 'gzip']
            ])
        },
        language: {
            type: 'accept-language',
            prefixMatch: true
        }
    }
};


for (const type in internals.options) {
    exports[type] = (header$1, preferences) => header.selection(header$1, preferences, internals.options[type]);

    exports[`${type}s`] = (header$1, preferences) => header.selections(header$1, preferences, internals.options[type]);
}


exports.mediaType = (header, preferences) => media.selection(header, preferences);

exports.mediaTypes = (header, preferences) => media.selections(header, preferences);


exports.parseAll = function (requestHeaders) {

    return {
        charsets: exports.charsets(requestHeaders['accept-charset']),
        encodings: exports.encodings(requestHeaders['accept-encoding']),
        languages: exports.languages(requestHeaders['accept-language']),
        mediaTypes: exports.mediaTypes(requestHeaders.accept)
    };
};
});

/**
 * Returns total length of data blocks sequence
 *
 * @param {Buffer} buffer
 * @param {number} offset
 * @returns {number}
 */
function getDataBlocksLength (buffer, offset) {
  var length = 0;

  while (buffer[offset + length]) {
    length += buffer[offset + length] + 1;
  }

  return length + 1
}

/**
 * Checks if buffer contains GIF image
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
var isGIF = function (buffer) {
  var header = buffer.slice(0, 3).toString('ascii');
  return (header === 'GIF')
};

/**
 * Checks if buffer contains animated GIF image
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
var isAnimated$3 = function (buffer) {
  var hasColorTable, colorTableSize, header;
  var offset = 0;
  var imagesCount = 0;

  // Check if this is this image has valid GIF header.
  // If not return false. Chrome, FF and IE doesn't handle GIFs with invalid version.
  header = buffer.slice(0, 3).toString('ascii');

  if (header !== 'GIF') {
    return false
  }

  // Skip header, logical screen descriptor and global color table

  hasColorTable = buffer[10] & 0x80; // 0b10000000
  colorTableSize = buffer[10] & 0x07; // 0b00000111

  offset += 6; // skip header
  offset += 7; // skip logical screen descriptor
  offset += hasColorTable ? 3 * Math.pow(2, colorTableSize + 1) : 0; // skip global color table

  // Find if there is more than one image descriptor

  while (imagesCount < 2 && offset < buffer.length) {
    switch (buffer[offset]) {
      // Image descriptor block. According to specification there could be any
      // number of these blocks (even zero). When there is more than one image
      // descriptor browsers will display animation (they shouldn't when there
      // is no delays defined, but they do it anyway).
      case 0x2C:
        imagesCount += 1;

        hasColorTable = buffer[offset + 9] & 0x80; // 0b10000000
        colorTableSize = buffer[offset + 9] & 0x07; // 0b00000111

        offset += 10; // skip image descriptor
        offset += hasColorTable ? 3 * Math.pow(2, colorTableSize + 1) : 0; // skip local color table
        offset += getDataBlocksLength(buffer, offset + 1) + 1; // skip image data

        break

      // Skip all extension blocks. In theory this "plain text extension" blocks
      // could be frames of animation, but no browser renders them.
      case 0x21:
        offset += 2; // skip introducer and label
        offset += getDataBlocksLength(buffer, offset); // skip this block and following data blocks

        break

      // Stop processing on trailer block,
      // all data after this point will is ignored by decoders
      case 0x3B:
        offset = buffer.length; // fast forward to end of buffer
        break

      // Oops! This GIF seems to be invalid
      default:
        offset = buffer.length; // fast forward to end of buffer
        break
    }
  }

  return (imagesCount > 1)
};

var gif = {
	isGIF: isGIF,
	isAnimated: isAnimated$3
};

var isPNG = function (buffer) {
  var header = buffer.slice(0, 8).toString('hex');
  return (header === '89504e470d0a1a0a') // \211 P N G \r \n \032 'n
};

var isAnimated$2 = function (buffer) {
  var hasACTL = false;
  var hasIDAT = false;
  var hasFDAT = false;

  var previousChunkType = null;

  var offset = 8;

  while (offset < buffer.length) {
    var chunkLength = buffer.readUInt32BE(offset);
    var chunkType = buffer.slice(offset + 4, offset + 8).toString('ascii');

    switch (chunkType) {
      case 'acTL':
        hasACTL = true;
        break
      case 'IDAT':
        if (!hasACTL) {
          return false
        }

        if (previousChunkType !== 'fcTL' && previousChunkType !== 'IDAT') {
          return false
        }

        hasIDAT = true;
        break
      case 'fdAT':
        if (!hasIDAT) {
          return false
        }

        if (previousChunkType !== 'fcTL' && previousChunkType !== 'fdAT') {
          return false
        }

        hasFDAT = true;
        break
    }

    previousChunkType = chunkType;
    offset += 4 + 4 + chunkLength + 4;
  }

  return (hasACTL && hasIDAT && hasFDAT)
};

var png = {
	isPNG: isPNG,
	isAnimated: isAnimated$2
};

/**
 * @since 2019-02-27 10:20
 * @author vivaxy
 */
var isWebp = function (buffer) {
  var WEBP = [0x57, 0x45, 0x42, 0x50];
  for (var i = 0; i < WEBP.length; i++) {
    if (buffer[i + 8] !== WEBP[i]) {
      return false
    }
  }
  return true
};

var isAnimated$1 = function (buffer) {
  var ANIM = [0x41, 0x4E, 0x49, 0x4D];
  for (var i = 0; i < buffer.length; i++) {
    for (var j = 0; j < ANIM.length; j++) {
      if (buffer[i + j] !== ANIM[j]) {
        break
      }
    }
    if (j === ANIM.length) {
      return true
    }
  }
  return false
};

var webp = {
	isWebp: isWebp,
	isAnimated: isAnimated$1
};

/**
 * Checks if buffer contains animated image
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isAnimated (buffer) {
  if (gif.isGIF(buffer)) {
    return gif.isAnimated(buffer)
  }

  if (png.isPNG(buffer)) {
    return png.isAnimated(buffer)
  }

  if (webp.isWebp(buffer)) {
    return webp.isAnimated(buffer)
  }

  return false
}

var lib$1 = isAnimated;

const imageConfigDefault = {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    path: "/_next/image",
    loader: "default",
    domains: [],
    formats: ["image/webp"]
};

/*!
 * fresh
 * Copyright(c) 2012 TJ Holowaychuk
 * Copyright(c) 2016-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * RegExp to check for no-cache token in Cache-Control.
 * @private
 */

var CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

/**
 * Module exports.
 * @public
 */

var fresh_1 = fresh;

/**
 * Check freshness of the response using request and response headers.
 *
 * @param {Object} reqHeaders
 * @param {Object} resHeaders
 * @return {Boolean}
 * @public
 */

function fresh (reqHeaders, resHeaders) {
  // fields
  var modifiedSince = reqHeaders['if-modified-since'];
  var noneMatch = reqHeaders['if-none-match'];

  // unconditional request
  if (!modifiedSince && !noneMatch) {
    return false
  }

  // Always return stale when Cache-Control: no-cache
  // to support end-to-end reload requests
  // https://tools.ietf.org/html/rfc2616#section-14.9.4
  var cacheControl = reqHeaders['cache-control'];
  if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl)) {
    return false
  }

  // if-none-match
  if (noneMatch && noneMatch !== '*') {
    var etag = resHeaders['etag'];

    if (!etag) {
      return false
    }

    var etagStale = true;
    var matches = parseTokenList$1(noneMatch);
    for (var i = 0; i < matches.length; i++) {
      var match = matches[i];
      if (match === etag || match === 'W/' + etag || 'W/' + match === etag) {
        etagStale = false;
        break
      }
    }

    if (etagStale) {
      return false
    }
  }

  // if-modified-since
  if (modifiedSince) {
    var lastModified = resHeaders['last-modified'];
    var modifiedStale = !lastModified || !(parseHttpDate$1(lastModified) <= parseHttpDate$1(modifiedSince));

    if (modifiedStale) {
      return false
    }
  }

  return true
}

/**
 * Parse an HTTP Date into a number.
 *
 * @param {string} date
 * @private
 */

function parseHttpDate$1 (date) {
  var timestamp = date && Date.parse(date);

  // istanbul ignore next: guard against date.js Date.parse patching
  return typeof timestamp === 'number'
    ? timestamp
    : NaN
}

/**
 * Parse a HTTP token list.
 *
 * @param {string} str
 * @private
 */

function parseTokenList$1 (str) {
  var end = 0;
  var list = [];
  var start = 0;

  // gather tokens
  for (var i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20: /*   */
        if (start === end) {
          start = end = i + 1;
        }
        break
      case 0x2c: /* , */
        list.push(str.substring(start, end));
        start = end = i + 1;
        break
      default:
        end = i + 1;
        break
    }
  }

  // final token
  list.push(str.substring(start, end));

  return list
}

function sendEtagResponse(req, res, etag) {
    if (etag) {
        /**
         * The server generating a 304 response MUST generate any of the
         * following header fields that would have been sent in a 200 (OK)
         * response to the same request: Cache-Control, Content-Location, Date,
         * ETag, Expires, and Vary. https://tools.ietf.org/html/rfc7232#section-4.1
         */
        res.setHeader("ETag", `"${etag}"`);
    }
    if (fresh_1(req.headers, { etag: `"${etag}"` })) {
        res.statusCode = 304;
        res.end();
        return true;
    }
    return false;
}

/*!
 * depd
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 */

var callsiteTostring = callSiteToString$1;

/**
 * Format a CallSite file location to a string.
 */

function callSiteFileLocation (callSite) {
  var fileName;
  var fileLocation = '';

  if (callSite.isNative()) {
    fileLocation = 'native';
  } else if (callSite.isEval()) {
    fileName = callSite.getScriptNameOrSourceURL();
    if (!fileName) {
      fileLocation = callSite.getEvalOrigin();
    }
  } else {
    fileName = callSite.getFileName();
  }

  if (fileName) {
    fileLocation += fileName;

    var lineNumber = callSite.getLineNumber();
    if (lineNumber != null) {
      fileLocation += ':' + lineNumber;

      var columnNumber = callSite.getColumnNumber();
      if (columnNumber) {
        fileLocation += ':' + columnNumber;
      }
    }
  }

  return fileLocation || 'unknown source'
}

/**
 * Format a CallSite to a string.
 */

function callSiteToString$1 (callSite) {
  var addSuffix = true;
  var fileLocation = callSiteFileLocation(callSite);
  var functionName = callSite.getFunctionName();
  var isConstructor = callSite.isConstructor();
  var isMethodCall = !(callSite.isToplevel() || isConstructor);
  var line = '';

  if (isMethodCall) {
    var methodName = callSite.getMethodName();
    var typeName = getConstructorName(callSite);

    if (functionName) {
      if (typeName && functionName.indexOf(typeName) !== 0) {
        line += typeName + '.';
      }

      line += functionName;

      if (methodName && functionName.lastIndexOf('.' + methodName) !== functionName.length - methodName.length - 1) {
        line += ' [as ' + methodName + ']';
      }
    } else {
      line += typeName + '.' + (methodName || '<anonymous>');
    }
  } else if (isConstructor) {
    line += 'new ' + (functionName || '<anonymous>');
  } else if (functionName) {
    line += functionName;
  } else {
    addSuffix = false;
    line += fileLocation;
  }

  if (addSuffix) {
    line += ' (' + fileLocation + ')';
  }

  return line
}

/**
 * Get constructor name of reviver.
 */

function getConstructorName (obj) {
  var receiver = obj.receiver;
  return (receiver.constructor && receiver.constructor.name) || null
}

/*!
 * depd
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var eventListenerCount_1 = eventListenerCount$1;

/**
 * Get the count of listeners on an event emitter of a specific type.
 */

function eventListenerCount$1 (emitter, type) {
  return emitter.listeners(type).length
}

/*!
 * depd
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

var compat = createCommonjsModule(function (module) {

/**
 * Module dependencies.
 * @private
 */

var EventEmitter = require$$0__default["default"].EventEmitter;

/**
 * Module exports.
 * @public
 */

lazyProperty(module.exports, 'callSiteToString', function callSiteToString () {
  var limit = Error.stackTraceLimit;
  var obj = {};
  var prep = Error.prepareStackTrace;

  function prepareObjectStackTrace (obj, stack) {
    return stack
  }

  Error.prepareStackTrace = prepareObjectStackTrace;
  Error.stackTraceLimit = 2;

  // capture the stack
  Error.captureStackTrace(obj);

  // slice the stack
  var stack = obj.stack.slice();

  Error.prepareStackTrace = prep;
  Error.stackTraceLimit = limit;

  return stack[0].toString ? toString : callsiteTostring
});

lazyProperty(module.exports, 'eventListenerCount', function eventListenerCount () {
  return EventEmitter.listenerCount || eventListenerCount_1
});

/**
 * Define a lazy property.
 */

function lazyProperty (obj, prop, getter) {
  function get () {
    var val = getter();

    Object.defineProperty(obj, prop, {
      configurable: true,
      enumerable: true,
      value: val
    });

    return val
  }

  Object.defineProperty(obj, prop, {
    configurable: true,
    enumerable: true,
    get: get
  });
}

/**
 * Call toString() on the obj
 */

function toString (obj) {
  return obj.toString()
}
});

/*!
 * depd
 * Copyright(c) 2014-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var callSiteToString = compat.callSiteToString;
var eventListenerCount = compat.eventListenerCount;
var relative = require$$1__default["default"].relative;

/**
 * Module exports.
 */

var depd_1 = depd;

/**
 * Get the path to base files on.
 */

var basePath$1 = process.cwd();

/**
 * Determine if namespace is contained in the string.
 */

function containsNamespace (str, namespace) {
  var vals = str.split(/[ ,]+/);
  var ns = String(namespace).toLowerCase();

  for (var i = 0; i < vals.length; i++) {
    var val = vals[i];

    // namespace contained
    if (val && (val === '*' || val.toLowerCase() === ns)) {
      return true
    }
  }

  return false
}

/**
 * Convert a data descriptor to accessor descriptor.
 */

function convertDataDescriptorToAccessor (obj, prop, message) {
  var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
  var value = descriptor.value;

  descriptor.get = function getter () { return value };

  if (descriptor.writable) {
    descriptor.set = function setter (val) { return (value = val) };
  }

  delete descriptor.value;
  delete descriptor.writable;

  Object.defineProperty(obj, prop, descriptor);

  return descriptor
}

/**
 * Create arguments string to keep arity.
 */

function createArgumentsString (arity) {
  var str = '';

  for (var i = 0; i < arity; i++) {
    str += ', arg' + i;
  }

  return str.substr(2)
}

/**
 * Create stack string from stack.
 */

function createStackString (stack) {
  var str = this.name + ': ' + this.namespace;

  if (this.message) {
    str += ' deprecated ' + this.message;
  }

  for (var i = 0; i < stack.length; i++) {
    str += '\n    at ' + callSiteToString(stack[i]);
  }

  return str
}

/**
 * Create deprecate for namespace in caller.
 */

function depd (namespace) {
  if (!namespace) {
    throw new TypeError('argument namespace is required')
  }

  var stack = getStack();
  var site = callSiteLocation(stack[1]);
  var file = site[0];

  function deprecate (message) {
    // call to self as log
    log.call(deprecate, message);
  }

  deprecate._file = file;
  deprecate._ignored = isignored(namespace);
  deprecate._namespace = namespace;
  deprecate._traced = istraced(namespace);
  deprecate._warned = Object.create(null);

  deprecate.function = wrapfunction;
  deprecate.property = wrapproperty;

  return deprecate
}

/**
 * Determine if namespace is ignored.
 */

function isignored (namespace) {
  /* istanbul ignore next: tested in a child processs */
  if (process.noDeprecation) {
    // --no-deprecation support
    return true
  }

  var str = process.env.NO_DEPRECATION || '';

  // namespace ignored
  return containsNamespace(str, namespace)
}

/**
 * Determine if namespace is traced.
 */

function istraced (namespace) {
  /* istanbul ignore next: tested in a child processs */
  if (process.traceDeprecation) {
    // --trace-deprecation support
    return true
  }

  var str = process.env.TRACE_DEPRECATION || '';

  // namespace traced
  return containsNamespace(str, namespace)
}

/**
 * Display deprecation message.
 */

function log (message, site) {
  var haslisteners = eventListenerCount(process, 'deprecation') !== 0;

  // abort early if no destination
  if (!haslisteners && this._ignored) {
    return
  }

  var caller;
  var callFile;
  var callSite;
  var depSite;
  var i = 0;
  var seen = false;
  var stack = getStack();
  var file = this._file;

  if (site) {
    // provided site
    depSite = site;
    callSite = callSiteLocation(stack[1]);
    callSite.name = depSite.name;
    file = callSite[0];
  } else {
    // get call site
    i = 2;
    depSite = callSiteLocation(stack[i]);
    callSite = depSite;
  }

  // get caller of deprecated thing in relation to file
  for (; i < stack.length; i++) {
    caller = callSiteLocation(stack[i]);
    callFile = caller[0];

    if (callFile === file) {
      seen = true;
    } else if (callFile === this._file) {
      file = this._file;
    } else if (seen) {
      break
    }
  }

  var key = caller
    ? depSite.join(':') + '__' + caller.join(':')
    : undefined;

  if (key !== undefined && key in this._warned) {
    // already warned
    return
  }

  this._warned[key] = true;

  // generate automatic message from call site
  var msg = message;
  if (!msg) {
    msg = callSite === depSite || !callSite.name
      ? defaultMessage(depSite)
      : defaultMessage(callSite);
  }

  // emit deprecation if listeners exist
  if (haslisteners) {
    var err = DeprecationError(this._namespace, msg, stack.slice(i));
    process.emit('deprecation', err);
    return
  }

  // format and write message
  var format = process.stderr.isTTY
    ? formatColor
    : formatPlain;
  var output = format.call(this, msg, caller, stack.slice(i));
  process.stderr.write(output + '\n', 'utf8');
}

/**
 * Get call site location as array.
 */

function callSiteLocation (callSite) {
  var file = callSite.getFileName() || '<anonymous>';
  var line = callSite.getLineNumber();
  var colm = callSite.getColumnNumber();

  if (callSite.isEval()) {
    file = callSite.getEvalOrigin() + ', ' + file;
  }

  var site = [file, line, colm];

  site.callSite = callSite;
  site.name = callSite.getFunctionName();

  return site
}

/**
 * Generate a default message from the site.
 */

function defaultMessage (site) {
  var callSite = site.callSite;
  var funcName = site.name;

  // make useful anonymous name
  if (!funcName) {
    funcName = '<anonymous@' + formatLocation(site) + '>';
  }

  var context = callSite.getThis();
  var typeName = context && callSite.getTypeName();

  // ignore useless type name
  if (typeName === 'Object') {
    typeName = undefined;
  }

  // make useful type name
  if (typeName === 'Function') {
    typeName = context.name || typeName;
  }

  return typeName && callSite.getMethodName()
    ? typeName + '.' + funcName
    : funcName
}

/**
 * Format deprecation message without color.
 */

function formatPlain (msg, caller, stack) {
  var timestamp = new Date().toUTCString();

  var formatted = timestamp +
    ' ' + this._namespace +
    ' deprecated ' + msg;

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    at ' + callSiteToString(stack[i]);
    }

    return formatted
  }

  if (caller) {
    formatted += ' at ' + formatLocation(caller);
  }

  return formatted
}

/**
 * Format deprecation message with color.
 */

function formatColor (msg, caller, stack) {
  var formatted = '\x1b[36;1m' + this._namespace + '\x1b[22;39m' + // bold cyan
    ' \x1b[33;1mdeprecated\x1b[22;39m' + // bold yellow
    ' \x1b[0m' + msg + '\x1b[39m'; // reset

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    \x1b[36mat ' + callSiteToString(stack[i]) + '\x1b[39m'; // cyan
    }

    return formatted
  }

  if (caller) {
    formatted += ' \x1b[36m' + formatLocation(caller) + '\x1b[39m'; // cyan
  }

  return formatted
}

/**
 * Format call site location.
 */

function formatLocation (callSite) {
  return relative(basePath$1, callSite[0]) +
    ':' + callSite[1] +
    ':' + callSite[2]
}

/**
 * Get the stack as array of call sites.
 */

function getStack () {
  var limit = Error.stackTraceLimit;
  var obj = {};
  var prep = Error.prepareStackTrace;

  Error.prepareStackTrace = prepareObjectStackTrace;
  Error.stackTraceLimit = Math.max(10, limit);

  // capture the stack
  Error.captureStackTrace(obj);

  // slice this function off the top
  var stack = obj.stack.slice(1);

  Error.prepareStackTrace = prep;
  Error.stackTraceLimit = limit;

  return stack
}

/**
 * Capture call site stack from v8.
 */

function prepareObjectStackTrace (obj, stack) {
  return stack
}

/**
 * Return a wrapped function in a deprecation message.
 */

function wrapfunction (fn, message) {
  if (typeof fn !== 'function') {
    throw new TypeError('argument fn must be a function')
  }

  var args = createArgumentsString(fn.length);
  var stack = getStack();
  var site = callSiteLocation(stack[1]);

  site.name = fn.name;

   // eslint-disable-next-line no-eval
  var deprecatedfn = eval('(function (' + args + ') {\n' +
    '"use strict"\n' +
    'log.call(deprecate, message, site)\n' +
    'return fn.apply(this, arguments)\n' +
    '})');

  return deprecatedfn
}

/**
 * Wrap property in a deprecation message.
 */

function wrapproperty (obj, prop, message) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('argument obj must be object')
  }

  var descriptor = Object.getOwnPropertyDescriptor(obj, prop);

  if (!descriptor) {
    throw new TypeError('must call property on owner object')
  }

  if (!descriptor.configurable) {
    throw new TypeError('property must be configurable')
  }

  var deprecate = this;
  var stack = getStack();
  var site = callSiteLocation(stack[1]);

  // set site name
  site.name = prop;

  // convert data descriptor
  if ('value' in descriptor) {
    descriptor = convertDataDescriptorToAccessor(obj, prop);
  }

  var get = descriptor.get;
  var set = descriptor.set;

  // wrap getter
  if (typeof get === 'function') {
    descriptor.get = function getter () {
      log.call(deprecate, message, site);
      return get.apply(this, arguments)
    };
  }

  // wrap setter
  if (typeof set === 'function') {
    descriptor.set = function setter () {
      log.call(deprecate, message, site);
      return set.apply(this, arguments)
    };
  }

  Object.defineProperty(obj, prop, descriptor);
}

/**
 * Create DeprecationError for deprecation
 */

function DeprecationError (namespace, message, stack) {
  var error = new Error();
  var stackString;

  Object.defineProperty(error, 'constructor', {
    value: DeprecationError
  });

  Object.defineProperty(error, 'message', {
    configurable: true,
    enumerable: false,
    value: message,
    writable: true
  });

  Object.defineProperty(error, 'name', {
    enumerable: false,
    configurable: true,
    value: 'DeprecationError',
    writable: true
  });

  Object.defineProperty(error, 'namespace', {
    configurable: true,
    enumerable: false,
    value: namespace,
    writable: true
  });

  Object.defineProperty(error, 'stack', {
    configurable: true,
    enumerable: false,
    get: function () {
      if (stackString !== undefined) {
        return stackString
      }

      // prepare stack trace
      return (stackString = createStackString.call(this, stack))
    },
    set: function setter (val) {
      stackString = val;
    }
  });

  return error
}

/* eslint no-proto: 0 */
var setprototypeof = Object.setPrototypeOf || ({ __proto__: [] } instanceof Array ? setProtoOf : mixinProperties);

function setProtoOf (obj, proto) {
  obj.__proto__ = proto;
  return obj
}

function mixinProperties (obj, proto) {
  for (var prop in proto) {
    if (!Object.prototype.hasOwnProperty.call(obj, prop)) {
      obj[prop] = proto[prop];
    }
  }
  return obj
}

var codes = {
	"100": "Continue",
	"101": "Switching Protocols",
	"102": "Processing",
	"103": "Early Hints",
	"200": "OK",
	"201": "Created",
	"202": "Accepted",
	"203": "Non-Authoritative Information",
	"204": "No Content",
	"205": "Reset Content",
	"206": "Partial Content",
	"207": "Multi-Status",
	"208": "Already Reported",
	"226": "IM Used",
	"300": "Multiple Choices",
	"301": "Moved Permanently",
	"302": "Found",
	"303": "See Other",
	"304": "Not Modified",
	"305": "Use Proxy",
	"306": "(Unused)",
	"307": "Temporary Redirect",
	"308": "Permanent Redirect",
	"400": "Bad Request",
	"401": "Unauthorized",
	"402": "Payment Required",
	"403": "Forbidden",
	"404": "Not Found",
	"405": "Method Not Allowed",
	"406": "Not Acceptable",
	"407": "Proxy Authentication Required",
	"408": "Request Timeout",
	"409": "Conflict",
	"410": "Gone",
	"411": "Length Required",
	"412": "Precondition Failed",
	"413": "Payload Too Large",
	"414": "URI Too Long",
	"415": "Unsupported Media Type",
	"416": "Range Not Satisfiable",
	"417": "Expectation Failed",
	"418": "I'm a teapot",
	"421": "Misdirected Request",
	"422": "Unprocessable Entity",
	"423": "Locked",
	"424": "Failed Dependency",
	"425": "Unordered Collection",
	"426": "Upgrade Required",
	"428": "Precondition Required",
	"429": "Too Many Requests",
	"431": "Request Header Fields Too Large",
	"451": "Unavailable For Legal Reasons",
	"500": "Internal Server Error",
	"501": "Not Implemented",
	"502": "Bad Gateway",
	"503": "Service Unavailable",
	"504": "Gateway Timeout",
	"505": "HTTP Version Not Supported",
	"506": "Variant Also Negotiates",
	"507": "Insufficient Storage",
	"508": "Loop Detected",
	"509": "Bandwidth Limit Exceeded",
	"510": "Not Extended",
	"511": "Network Authentication Required"
};

/*!
 * statuses
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */



/**
 * Module exports.
 * @public
 */

var statuses = status;

// status code to message map
status.STATUS_CODES = codes;

// array of status codes
status.codes = populateStatusesMap(status, codes);

// status codes for redirects
status.redirect = {
  300: true,
  301: true,
  302: true,
  303: true,
  305: true,
  307: true,
  308: true
};

// status codes for empty bodies
status.empty = {
  204: true,
  205: true,
  304: true
};

// status codes for when you should retry the request
status.retry = {
  502: true,
  503: true,
  504: true
};

/**
 * Populate the statuses map for given codes.
 * @private
 */

function populateStatusesMap (statuses, codes) {
  var arr = [];

  Object.keys(codes).forEach(function forEachCode (code) {
    var message = codes[code];
    var status = Number(code);

    // Populate properties
    statuses[status] = message;
    statuses[message] = status;
    statuses[message.toLowerCase()] = status;

    // Add to array
    arr.push(status);
  });

  return arr
}

/**
 * Get the status code.
 *
 * Given a number, this will throw if it is not a known status
 * code, otherwise the code will be returned. Given a string,
 * the string will be parsed for a number and return the code
 * if valid, otherwise will lookup the code assuming this is
 * the status message.
 *
 * @param {string|number} code
 * @returns {number}
 * @public
 */

function status (code) {
  if (typeof code === 'number') {
    if (!status[code]) throw new Error('invalid status code: ' + code)
    return code
  }

  if (typeof code !== 'string') {
    throw new TypeError('code must be a number or string')
  }

  // '403'
  var n = parseInt(code, 10);
  if (!isNaN(n)) {
    if (!status[n]) throw new Error('invalid status code: ' + n)
    return n
  }

  n = status[code.toLowerCase()];
  if (!n) throw new Error('invalid status message: "' + code + '"')
  return n
}

var inherits_browser = createCommonjsModule(function (module) {
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }
  };
}
});

var inherits = createCommonjsModule(function (module) {
try {
  var util = util__default["default"];
  /* istanbul ignore next */
  if (typeof util.inherits !== 'function') throw '';
  module.exports = util.inherits;
} catch (e) {
  /* istanbul ignore next */
  module.exports = inherits_browser;
}
});

/*!
 * toidentifier
 * Copyright(c) 2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var toidentifier = toIdentifier;

/**
 * Trasform the given string into a JavaScript identifier
 *
 * @param {string} str
 * @returns {string}
 * @public
 */

function toIdentifier (str) {
  return str
    .split(' ')
    .map(function (token) {
      return token.slice(0, 1).toUpperCase() + token.slice(1)
    })
    .join('')
    .replace(/[^ _0-9a-z]/gi, '')
}

/*!
 * http-errors
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2016 Douglas Christopher Wilson
 * MIT Licensed
 */

var httpErrors = createCommonjsModule(function (module) {

/**
 * Module dependencies.
 * @private
 */

var deprecate = depd_1('http-errors');





/**
 * Module exports.
 * @public
 */

module.exports = createError;
module.exports.HttpError = createHttpErrorConstructor();
module.exports.isHttpError = createIsHttpErrorFunction(module.exports.HttpError);

// Populate exports for all constructors
populateConstructorExports(module.exports, statuses.codes, module.exports.HttpError);

/**
 * Get the code class of a status code.
 * @private
 */

function codeClass (status) {
  return Number(String(status).charAt(0) + '00')
}

/**
 * Create a new HTTP Error.
 *
 * @returns {Error}
 * @public
 */

function createError () {
  // so much arity going on ~_~
  var err;
  var msg;
  var status = 500;
  var props = {};
  for (var i = 0; i < arguments.length; i++) {
    var arg = arguments[i];
    if (arg instanceof Error) {
      err = arg;
      status = err.status || err.statusCode || status;
      continue
    }
    switch (typeof arg) {
      case 'string':
        msg = arg;
        break
      case 'number':
        status = arg;
        if (i !== 0) {
          deprecate('non-first-argument status code; replace with createError(' + arg + ', ...)');
        }
        break
      case 'object':
        props = arg;
        break
    }
  }

  if (typeof status === 'number' && (status < 400 || status >= 600)) {
    deprecate('non-error status code; use only 4xx or 5xx status codes');
  }

  if (typeof status !== 'number' ||
    (!statuses[status] && (status < 400 || status >= 600))) {
    status = 500;
  }

  // constructor
  var HttpError = createError[status] || createError[codeClass(status)];

  if (!err) {
    // create error
    err = HttpError
      ? new HttpError(msg)
      : new Error(msg || statuses[status]);
    Error.captureStackTrace(err, createError);
  }

  if (!HttpError || !(err instanceof HttpError) || err.status !== status) {
    // add properties to generic error
    err.expose = status < 500;
    err.status = err.statusCode = status;
  }

  for (var key in props) {
    if (key !== 'status' && key !== 'statusCode') {
      err[key] = props[key];
    }
  }

  return err
}

/**
 * Create HTTP error abstract base class.
 * @private
 */

function createHttpErrorConstructor () {
  function HttpError () {
    throw new TypeError('cannot construct abstract class')
  }

  inherits(HttpError, Error);

  return HttpError
}

/**
 * Create a constructor for a client error.
 * @private
 */

function createClientErrorConstructor (HttpError, name, code) {
  var className = toClassName(name);

  function ClientError (message) {
    // create the error object
    var msg = message != null ? message : statuses[code];
    var err = new Error(msg);

    // capture a stack trace to the construction point
    Error.captureStackTrace(err, ClientError);

    // adjust the [[Prototype]]
    setprototypeof(err, ClientError.prototype);

    // redefine the error message
    Object.defineProperty(err, 'message', {
      enumerable: true,
      configurable: true,
      value: msg,
      writable: true
    });

    // redefine the error name
    Object.defineProperty(err, 'name', {
      enumerable: false,
      configurable: true,
      value: className,
      writable: true
    });

    return err
  }

  inherits(ClientError, HttpError);
  nameFunc(ClientError, className);

  ClientError.prototype.status = code;
  ClientError.prototype.statusCode = code;
  ClientError.prototype.expose = true;

  return ClientError
}

/**
 * Create function to test is a value is a HttpError.
 * @private
 */

function createIsHttpErrorFunction (HttpError) {
  return function isHttpError (val) {
    if (!val || typeof val !== 'object') {
      return false
    }

    if (val instanceof HttpError) {
      return true
    }

    return val instanceof Error &&
      typeof val.expose === 'boolean' &&
      typeof val.statusCode === 'number' && val.status === val.statusCode
  }
}

/**
 * Create a constructor for a server error.
 * @private
 */

function createServerErrorConstructor (HttpError, name, code) {
  var className = toClassName(name);

  function ServerError (message) {
    // create the error object
    var msg = message != null ? message : statuses[code];
    var err = new Error(msg);

    // capture a stack trace to the construction point
    Error.captureStackTrace(err, ServerError);

    // adjust the [[Prototype]]
    setprototypeof(err, ServerError.prototype);

    // redefine the error message
    Object.defineProperty(err, 'message', {
      enumerable: true,
      configurable: true,
      value: msg,
      writable: true
    });

    // redefine the error name
    Object.defineProperty(err, 'name', {
      enumerable: false,
      configurable: true,
      value: className,
      writable: true
    });

    return err
  }

  inherits(ServerError, HttpError);
  nameFunc(ServerError, className);

  ServerError.prototype.status = code;
  ServerError.prototype.statusCode = code;
  ServerError.prototype.expose = false;

  return ServerError
}

/**
 * Set the name of a function, if possible.
 * @private
 */

function nameFunc (func, name) {
  var desc = Object.getOwnPropertyDescriptor(func, 'name');

  if (desc && desc.configurable) {
    desc.value = name;
    Object.defineProperty(func, 'name', desc);
  }
}

/**
 * Populate the exports object with constructors for every error class.
 * @private
 */

function populateConstructorExports (exports, codes, HttpError) {
  codes.forEach(function forEachCode (code) {
    var CodeError;
    var name = toidentifier(statuses[code]);

    switch (codeClass(code)) {
      case 400:
        CodeError = createClientErrorConstructor(HttpError, name, code);
        break
      case 500:
        CodeError = createServerErrorConstructor(HttpError, name, code);
        break
    }

    if (CodeError) {
      // export the constructor
      exports[code] = CodeError;
      exports[name] = CodeError;
    }
  });

  // backwards-compatibility
  exports["I'mateapot"] = deprecate.function(exports.ImATeapot,
    '"I\'mateapot"; use "ImATeapot" instead');
}

/**
 * Get a class name from a name identifier.
 * @private
 */

function toClassName (name) {
  return name.substr(-5) !== 'Error'
    ? name + 'Error'
    : name
}
});

/**
 * Helpers.
 */
var s$1 = 1000;
var m$1 = s$1 * 60;
var h$1 = m$1 * 60;
var d$1 = h$1 * 24;
var y$1 = d$1 * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

var ms$1 = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse$2(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong$1(val) : fmtShort$1(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse$2(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y$1;
    case 'days':
    case 'day':
    case 'd':
      return n * d$1;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h$1;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m$1;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s$1;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort$1(ms) {
  if (ms >= d$1) {
    return Math.round(ms / d$1) + 'd';
  }
  if (ms >= h$1) {
    return Math.round(ms / h$1) + 'h';
  }
  if (ms >= m$1) {
    return Math.round(ms / m$1) + 'm';
  }
  if (ms >= s$1) {
    return Math.round(ms / s$1) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong$1(ms) {
  return plural$1(ms, d$1, 'day') ||
    plural$1(ms, h$1, 'hour') ||
    plural$1(ms, m$1, 'minute') ||
    plural$1(ms, s$1, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural$1(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

var debug$1 = createCommonjsModule(function (module, exports) {
/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = ms$1;

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}
});

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

var browser$4 = createCommonjsModule(function (module, exports) {
exports = module.exports = debug$1;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit');

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}
});

/**
 * Module dependencies.
 */

var node = createCommonjsModule(function (module, exports) {
/**
 * This is the Node.js implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug$1;
exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Colors.
 */

exports.colors = [6, 2, 3, 4, 5, 1];

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

exports.inspectOpts = Object.keys(process.env).filter(function (key) {
  return /^debug_/i.test(key);
}).reduce(function (obj, key) {
  // camel-case
  var prop = key
    .substring(6)
    .toLowerCase()
    .replace(/_([a-z])/g, function (_, k) { return k.toUpperCase() });

  // coerce string value into JS value
  var val = process.env[key];
  if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
  else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
  else if (val === 'null') val = null;
  else val = Number(val);

  obj[prop] = val;
  return obj;
}, {});

/**
 * The file descriptor to write the `debug()` calls to.
 * Set the `DEBUG_FD` env variable to override with another value. i.e.:
 *
 *   $ DEBUG_FD=3 node script.js 3>debug.log
 */

var fd = parseInt(process.env.DEBUG_FD, 10) || 2;

if (1 !== fd && 2 !== fd) {
  util__default["default"].deprecate(function(){}, 'except for stderr(2) and stdout(1), any other usage of DEBUG_FD is deprecated. Override debug.log if you want to use a different log function (https://git.io/debug_fd)')();
}

var stream = 1 === fd ? process.stdout :
             2 === fd ? process.stderr :
             createWritableStdioStream(fd);

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
  return 'colors' in exports.inspectOpts
    ? Boolean(exports.inspectOpts.colors)
    : tty__default["default"].isatty(fd);
}

/**
 * Map %o to `util.inspect()`, all on a single line.
 */

exports.formatters.o = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util__default["default"].inspect(v, this.inspectOpts)
    .split('\n').map(function(str) {
      return str.trim()
    }).join(' ');
};

/**
 * Map %o to `util.inspect()`, allowing multiple lines if needed.
 */

exports.formatters.O = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util__default["default"].inspect(v, this.inspectOpts);
};

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var name = this.namespace;
  var useColors = this.useColors;

  if (useColors) {
    var c = this.color;
    var prefix = '  \u001b[3' + c + ';1m' + name + ' ' + '\u001b[0m';

    args[0] = prefix + args[0].split('\n').join('\n' + prefix);
    args.push('\u001b[3' + c + 'm+' + exports.humanize(this.diff) + '\u001b[0m');
  } else {
    args[0] = new Date().toUTCString()
      + ' ' + name + ' ' + args[0];
  }
}

/**
 * Invokes `util.format()` with the specified arguments and writes to `stream`.
 */

function log() {
  return stream.write(util__default["default"].format.apply(util__default["default"], arguments) + '\n');
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  if (null == namespaces) {
    // If you set a process.env field to null or undefined, it gets cast to the
    // string 'null' or 'undefined'. Just delete instead.
    delete process.env.DEBUG;
  } else {
    process.env.DEBUG = namespaces;
  }
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  return process.env.DEBUG;
}

/**
 * Copied from `node/src/node.js`.
 *
 * XXX: It's lame that node doesn't expose this API out-of-the-box. It also
 * relies on the undocumented `tty_wrap.guessHandleType()` which is also lame.
 */

function createWritableStdioStream (fd) {
  var stream;
  var tty_wrap = process.binding('tty_wrap');

  // Note stream._type is used for test-module-load-list.js

  switch (tty_wrap.guessHandleType(fd)) {
    case 'TTY':
      stream = new tty__default["default"].WriteStream(fd);
      stream._type = 'tty';

      // Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    case 'FILE':
      var fs = fs__default["default"];
      stream = new fs.SyncWriteStream(fd, { autoClose: false });
      stream._type = 'fs';
      break;

    case 'PIPE':
    case 'TCP':
      var net = require$$2__default["default"];
      stream = new net.Socket({
        fd: fd,
        readable: false,
        writable: true
      });

      // FIXME Should probably have an option in net.Socket to create a
      // stream from an existing fd which is writable only. But for now
      // we'll just add this hack and set the `readable` member to false.
      // Test: ./node test/fixtures/echo.js < /etc/passwd
      stream.readable = false;
      stream.read = null;
      stream._type = 'pipe';

      // FIXME Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    default:
      // Probably an error on in uv_guess_handle()
      throw new Error('Implement me. Unknown stream file type!');
  }

  // For supporting legacy API we put the FD here.
  stream.fd = fd;

  stream._isStdio = true;

  return stream;
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init (debug) {
  debug.inspectOpts = {};

  var keys = Object.keys(exports.inspectOpts);
  for (var i = 0; i < keys.length; i++) {
    debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
  }
}

/**
 * Enable namespaces listed in `process.env.DEBUG` initially.
 */

exports.enable(load());
});

/**
 * Detect Electron renderer process, which is node, but we should
 * treat as a browser.
 */

var src = createCommonjsModule(function (module) {
if (typeof process !== 'undefined' && process.type === 'renderer') {
  module.exports = browser$4;
} else {
  module.exports = node;
}
});

/*!
 * destroy
 * Copyright(c) 2014 Jonathan Ong
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

var ReadStream = fs__default["default"].ReadStream;


/**
 * Module exports.
 * @public
 */

var destroy_1 = destroy;

/**
 * Destroy a stream.
 *
 * @param {object} stream
 * @public
 */

function destroy(stream) {
  if (stream instanceof ReadStream) {
    return destroyReadStream(stream)
  }

  if (!(stream instanceof Stream__default["default"])) {
    return stream
  }

  if (typeof stream.destroy === 'function') {
    stream.destroy();
  }

  return stream
}

/**
 * Destroy a ReadStream.
 *
 * @param {object} stream
 * @private
 */

function destroyReadStream(stream) {
  stream.destroy();

  if (typeof stream.close === 'function') {
    // node.js core bug work-around
    stream.on('open', onOpenClose);
  }

  return stream
}

/**
 * On open handler to close stream.
 * @private
 */

function onOpenClose() {
  if (typeof this.fd === 'number') {
    // actually close down the fd
    this.close();
  }
}

/*!
 * encodeurl
 * Copyright(c) 2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var encodeurl = encodeUrl;

/**
 * RegExp to match non-URL code points, *after* encoding (i.e. not including "%")
 * and including invalid escape sequences.
 * @private
 */

var ENCODE_CHARS_REGEXP = /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g;

/**
 * RegExp to match unmatched surrogate pair.
 * @private
 */

var UNMATCHED_SURROGATE_PAIR_REGEXP = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;

/**
 * String to replace unmatched surrogate pair with.
 * @private
 */

var UNMATCHED_SURROGATE_PAIR_REPLACE = '$1\uFFFD$2';

/**
 * Encode a URL to a percent-encoded form, excluding already-encoded sequences.
 *
 * This function will take an already-encoded URL and encode all the non-URL
 * code points. This function will not encode the "%" character unless it is
 * not part of a valid sequence (`%20` will be left as-is, but `%foo` will
 * be encoded as `%25foo`).
 *
 * This encode is meant to be "safe" and does not throw errors. It will try as
 * hard as it can to properly encode the given URL, including replacing any raw,
 * unpaired surrogate pairs with the Unicode replacement character prior to
 * encoding.
 *
 * @param {string} url
 * @return {string}
 * @public
 */

function encodeUrl (url) {
  return String(url)
    .replace(UNMATCHED_SURROGATE_PAIR_REGEXP, UNMATCHED_SURROGATE_PAIR_REPLACE)
    .replace(ENCODE_CHARS_REGEXP, encodeURI)
}

/*!
 * escape-html
 * Copyright(c) 2012-2013 TJ Holowaychuk
 * Copyright(c) 2015 Andreas Lubbe
 * Copyright(c) 2015 Tiancheng "Timothy" Gu
 * MIT Licensed
 */

/**
 * Module variables.
 * @private
 */

var matchHtmlRegExp = /["'&<>]/;

/**
 * Module exports.
 * @public
 */

var escapeHtml_1 = escapeHtml;

/**
 * Escape special characters in the given string of html.
 *
 * @param  {string} string The string to escape for inserting into HTML
 * @return {string}
 * @public
 */

function escapeHtml(string) {
  var str = '' + string;
  var match = matchHtmlRegExp.exec(str);

  if (!match) {
    return str;
  }

  var escape;
  var html = '';
  var index = 0;
  var lastIndex = 0;

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;';
        break;
      case 38: // &
        escape = '&amp;';
        break;
      case 39: // '
        escape = '&#39;';
        break;
      case 60: // <
        escape = '&lt;';
        break;
      case 62: // >
        escape = '&gt;';
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index
    ? html + str.substring(lastIndex, index)
    : html;
}

/*!
 * etag
 * Copyright(c) 2014-2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var etag_1 = etag;

/**
 * Module dependencies.
 * @private
 */


var Stats = fs__default["default"].Stats;

/**
 * Module variables.
 * @private
 */

var toString = Object.prototype.toString;

/**
 * Generate an entity tag.
 *
 * @param {Buffer|string} entity
 * @return {string}
 * @private
 */

function entitytag (entity) {
  if (entity.length === 0) {
    // fast-path empty
    return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"'
  }

  // compute hash of entity
  var hash = crypto__default["default"]
    .createHash('sha1')
    .update(entity, 'utf8')
    .digest('base64')
    .substring(0, 27);

  // compute length of entity
  var len = typeof entity === 'string'
    ? Buffer.byteLength(entity, 'utf8')
    : entity.length;

  return '"' + len.toString(16) + '-' + hash + '"'
}

/**
 * Create a simple ETag.
 *
 * @param {string|Buffer|Stats} entity
 * @param {object} [options]
 * @param {boolean} [options.weak]
 * @return {String}
 * @public
 */

function etag (entity, options) {
  if (entity == null) {
    throw new TypeError('argument entity is required')
  }

  // support fs.Stats object
  var isStats = isstats(entity);
  var weak = options && typeof options.weak === 'boolean'
    ? options.weak
    : isStats;

  // validate argument
  if (!isStats && typeof entity !== 'string' && !Buffer.isBuffer(entity)) {
    throw new TypeError('argument entity must be string, Buffer, or fs.Stats')
  }

  // generate entity tag
  var tag = isStats
    ? stattag(entity)
    : entitytag(entity);

  return weak
    ? 'W/' + tag
    : tag
}

/**
 * Determine if object is a Stats object.
 *
 * @param {object} obj
 * @return {boolean}
 * @api private
 */

function isstats (obj) {
  // genuine fs.Stats
  if (typeof Stats === 'function' && obj instanceof Stats) {
    return true
  }

  // quack quack
  return obj && typeof obj === 'object' &&
    'ctime' in obj && toString.call(obj.ctime) === '[object Date]' &&
    'mtime' in obj && toString.call(obj.mtime) === '[object Date]' &&
    'ino' in obj && typeof obj.ino === 'number' &&
    'size' in obj && typeof obj.size === 'number'
}

/**
 * Generate a tag for a stat.
 *
 * @param {object} stat
 * @return {string}
 * @private
 */

function stattag (stat) {
  var mtime = stat.mtime.getTime().toString(16);
  var size = stat.size.toString(16);

  return '"' + size + '-' + mtime + '"'
}

var require$$0$2 = {
	"application/andrew-inset": [
	"ez"
],
	"application/applixware": [
	"aw"
],
	"application/atom+xml": [
	"atom"
],
	"application/atomcat+xml": [
	"atomcat"
],
	"application/atomsvc+xml": [
	"atomsvc"
],
	"application/bdoc": [
	"bdoc"
],
	"application/ccxml+xml": [
	"ccxml"
],
	"application/cdmi-capability": [
	"cdmia"
],
	"application/cdmi-container": [
	"cdmic"
],
	"application/cdmi-domain": [
	"cdmid"
],
	"application/cdmi-object": [
	"cdmio"
],
	"application/cdmi-queue": [
	"cdmiq"
],
	"application/cu-seeme": [
	"cu"
],
	"application/dash+xml": [
	"mpd"
],
	"application/davmount+xml": [
	"davmount"
],
	"application/docbook+xml": [
	"dbk"
],
	"application/dssc+der": [
	"dssc"
],
	"application/dssc+xml": [
	"xdssc"
],
	"application/ecmascript": [
	"ecma"
],
	"application/emma+xml": [
	"emma"
],
	"application/epub+zip": [
	"epub"
],
	"application/exi": [
	"exi"
],
	"application/font-tdpfr": [
	"pfr"
],
	"application/font-woff": [
],
	"application/font-woff2": [
],
	"application/geo+json": [
	"geojson"
],
	"application/gml+xml": [
	"gml"
],
	"application/gpx+xml": [
	"gpx"
],
	"application/gxf": [
	"gxf"
],
	"application/gzip": [
	"gz"
],
	"application/hyperstudio": [
	"stk"
],
	"application/inkml+xml": [
	"ink",
	"inkml"
],
	"application/ipfix": [
	"ipfix"
],
	"application/java-archive": [
	"jar",
	"war",
	"ear"
],
	"application/java-serialized-object": [
	"ser"
],
	"application/java-vm": [
	"class"
],
	"application/javascript": [
	"js",
	"mjs"
],
	"application/json": [
	"json",
	"map"
],
	"application/json5": [
	"json5"
],
	"application/jsonml+json": [
	"jsonml"
],
	"application/ld+json": [
	"jsonld"
],
	"application/lost+xml": [
	"lostxml"
],
	"application/mac-binhex40": [
	"hqx"
],
	"application/mac-compactpro": [
	"cpt"
],
	"application/mads+xml": [
	"mads"
],
	"application/manifest+json": [
	"webmanifest"
],
	"application/marc": [
	"mrc"
],
	"application/marcxml+xml": [
	"mrcx"
],
	"application/mathematica": [
	"ma",
	"nb",
	"mb"
],
	"application/mathml+xml": [
	"mathml"
],
	"application/mbox": [
	"mbox"
],
	"application/mediaservercontrol+xml": [
	"mscml"
],
	"application/metalink+xml": [
	"metalink"
],
	"application/metalink4+xml": [
	"meta4"
],
	"application/mets+xml": [
	"mets"
],
	"application/mods+xml": [
	"mods"
],
	"application/mp21": [
	"m21",
	"mp21"
],
	"application/mp4": [
	"mp4s",
	"m4p"
],
	"application/msword": [
	"doc",
	"dot"
],
	"application/mxf": [
	"mxf"
],
	"application/octet-stream": [
	"bin",
	"dms",
	"lrf",
	"mar",
	"so",
	"dist",
	"distz",
	"pkg",
	"bpk",
	"dump",
	"elc",
	"deploy",
	"exe",
	"dll",
	"deb",
	"dmg",
	"iso",
	"img",
	"msi",
	"msp",
	"msm",
	"buffer"
],
	"application/oda": [
	"oda"
],
	"application/oebps-package+xml": [
	"opf"
],
	"application/ogg": [
	"ogx"
],
	"application/omdoc+xml": [
	"omdoc"
],
	"application/onenote": [
	"onetoc",
	"onetoc2",
	"onetmp",
	"onepkg"
],
	"application/oxps": [
	"oxps"
],
	"application/patch-ops-error+xml": [
	"xer"
],
	"application/pdf": [
	"pdf"
],
	"application/pgp-encrypted": [
	"pgp"
],
	"application/pgp-signature": [
	"asc",
	"sig"
],
	"application/pics-rules": [
	"prf"
],
	"application/pkcs10": [
	"p10"
],
	"application/pkcs7-mime": [
	"p7m",
	"p7c"
],
	"application/pkcs7-signature": [
	"p7s"
],
	"application/pkcs8": [
	"p8"
],
	"application/pkix-attr-cert": [
	"ac"
],
	"application/pkix-cert": [
	"cer"
],
	"application/pkix-crl": [
	"crl"
],
	"application/pkix-pkipath": [
	"pkipath"
],
	"application/pkixcmp": [
	"pki"
],
	"application/pls+xml": [
	"pls"
],
	"application/postscript": [
	"ai",
	"eps",
	"ps"
],
	"application/prs.cww": [
	"cww"
],
	"application/pskc+xml": [
	"pskcxml"
],
	"application/raml+yaml": [
	"raml"
],
	"application/rdf+xml": [
	"rdf"
],
	"application/reginfo+xml": [
	"rif"
],
	"application/relax-ng-compact-syntax": [
	"rnc"
],
	"application/resource-lists+xml": [
	"rl"
],
	"application/resource-lists-diff+xml": [
	"rld"
],
	"application/rls-services+xml": [
	"rs"
],
	"application/rpki-ghostbusters": [
	"gbr"
],
	"application/rpki-manifest": [
	"mft"
],
	"application/rpki-roa": [
	"roa"
],
	"application/rsd+xml": [
	"rsd"
],
	"application/rss+xml": [
	"rss"
],
	"application/rtf": [
	"rtf"
],
	"application/sbml+xml": [
	"sbml"
],
	"application/scvp-cv-request": [
	"scq"
],
	"application/scvp-cv-response": [
	"scs"
],
	"application/scvp-vp-request": [
	"spq"
],
	"application/scvp-vp-response": [
	"spp"
],
	"application/sdp": [
	"sdp"
],
	"application/set-payment-initiation": [
	"setpay"
],
	"application/set-registration-initiation": [
	"setreg"
],
	"application/shf+xml": [
	"shf"
],
	"application/smil+xml": [
	"smi",
	"smil"
],
	"application/sparql-query": [
	"rq"
],
	"application/sparql-results+xml": [
	"srx"
],
	"application/srgs": [
	"gram"
],
	"application/srgs+xml": [
	"grxml"
],
	"application/sru+xml": [
	"sru"
],
	"application/ssdl+xml": [
	"ssdl"
],
	"application/ssml+xml": [
	"ssml"
],
	"application/tei+xml": [
	"tei",
	"teicorpus"
],
	"application/thraud+xml": [
	"tfi"
],
	"application/timestamped-data": [
	"tsd"
],
	"application/vnd.3gpp.pic-bw-large": [
	"plb"
],
	"application/vnd.3gpp.pic-bw-small": [
	"psb"
],
	"application/vnd.3gpp.pic-bw-var": [
	"pvb"
],
	"application/vnd.3gpp2.tcap": [
	"tcap"
],
	"application/vnd.3m.post-it-notes": [
	"pwn"
],
	"application/vnd.accpac.simply.aso": [
	"aso"
],
	"application/vnd.accpac.simply.imp": [
	"imp"
],
	"application/vnd.acucobol": [
	"acu"
],
	"application/vnd.acucorp": [
	"atc",
	"acutc"
],
	"application/vnd.adobe.air-application-installer-package+zip": [
	"air"
],
	"application/vnd.adobe.formscentral.fcdt": [
	"fcdt"
],
	"application/vnd.adobe.fxp": [
	"fxp",
	"fxpl"
],
	"application/vnd.adobe.xdp+xml": [
	"xdp"
],
	"application/vnd.adobe.xfdf": [
	"xfdf"
],
	"application/vnd.ahead.space": [
	"ahead"
],
	"application/vnd.airzip.filesecure.azf": [
	"azf"
],
	"application/vnd.airzip.filesecure.azs": [
	"azs"
],
	"application/vnd.amazon.ebook": [
	"azw"
],
	"application/vnd.americandynamics.acc": [
	"acc"
],
	"application/vnd.amiga.ami": [
	"ami"
],
	"application/vnd.android.package-archive": [
	"apk"
],
	"application/vnd.anser-web-certificate-issue-initiation": [
	"cii"
],
	"application/vnd.anser-web-funds-transfer-initiation": [
	"fti"
],
	"application/vnd.antix.game-component": [
	"atx"
],
	"application/vnd.apple.installer+xml": [
	"mpkg"
],
	"application/vnd.apple.mpegurl": [
	"m3u8"
],
	"application/vnd.apple.pkpass": [
	"pkpass"
],
	"application/vnd.aristanetworks.swi": [
	"swi"
],
	"application/vnd.astraea-software.iota": [
	"iota"
],
	"application/vnd.audiograph": [
	"aep"
],
	"application/vnd.blueice.multipass": [
	"mpm"
],
	"application/vnd.bmi": [
	"bmi"
],
	"application/vnd.businessobjects": [
	"rep"
],
	"application/vnd.chemdraw+xml": [
	"cdxml"
],
	"application/vnd.chipnuts.karaoke-mmd": [
	"mmd"
],
	"application/vnd.cinderella": [
	"cdy"
],
	"application/vnd.claymore": [
	"cla"
],
	"application/vnd.cloanto.rp9": [
	"rp9"
],
	"application/vnd.clonk.c4group": [
	"c4g",
	"c4d",
	"c4f",
	"c4p",
	"c4u"
],
	"application/vnd.cluetrust.cartomobile-config": [
	"c11amc"
],
	"application/vnd.cluetrust.cartomobile-config-pkg": [
	"c11amz"
],
	"application/vnd.commonspace": [
	"csp"
],
	"application/vnd.contact.cmsg": [
	"cdbcmsg"
],
	"application/vnd.cosmocaller": [
	"cmc"
],
	"application/vnd.crick.clicker": [
	"clkx"
],
	"application/vnd.crick.clicker.keyboard": [
	"clkk"
],
	"application/vnd.crick.clicker.palette": [
	"clkp"
],
	"application/vnd.crick.clicker.template": [
	"clkt"
],
	"application/vnd.crick.clicker.wordbank": [
	"clkw"
],
	"application/vnd.criticaltools.wbs+xml": [
	"wbs"
],
	"application/vnd.ctc-posml": [
	"pml"
],
	"application/vnd.cups-ppd": [
	"ppd"
],
	"application/vnd.curl.car": [
	"car"
],
	"application/vnd.curl.pcurl": [
	"pcurl"
],
	"application/vnd.dart": [
	"dart"
],
	"application/vnd.data-vision.rdz": [
	"rdz"
],
	"application/vnd.dece.data": [
	"uvf",
	"uvvf",
	"uvd",
	"uvvd"
],
	"application/vnd.dece.ttml+xml": [
	"uvt",
	"uvvt"
],
	"application/vnd.dece.unspecified": [
	"uvx",
	"uvvx"
],
	"application/vnd.dece.zip": [
	"uvz",
	"uvvz"
],
	"application/vnd.denovo.fcselayout-link": [
	"fe_launch"
],
	"application/vnd.dna": [
	"dna"
],
	"application/vnd.dolby.mlp": [
	"mlp"
],
	"application/vnd.dpgraph": [
	"dpg"
],
	"application/vnd.dreamfactory": [
	"dfac"
],
	"application/vnd.ds-keypoint": [
	"kpxx"
],
	"application/vnd.dvb.ait": [
	"ait"
],
	"application/vnd.dvb.service": [
	"svc"
],
	"application/vnd.dynageo": [
	"geo"
],
	"application/vnd.ecowin.chart": [
	"mag"
],
	"application/vnd.enliven": [
	"nml"
],
	"application/vnd.epson.esf": [
	"esf"
],
	"application/vnd.epson.msf": [
	"msf"
],
	"application/vnd.epson.quickanime": [
	"qam"
],
	"application/vnd.epson.salt": [
	"slt"
],
	"application/vnd.epson.ssf": [
	"ssf"
],
	"application/vnd.eszigno3+xml": [
	"es3",
	"et3"
],
	"application/vnd.ezpix-album": [
	"ez2"
],
	"application/vnd.ezpix-package": [
	"ez3"
],
	"application/vnd.fdf": [
	"fdf"
],
	"application/vnd.fdsn.mseed": [
	"mseed"
],
	"application/vnd.fdsn.seed": [
	"seed",
	"dataless"
],
	"application/vnd.flographit": [
	"gph"
],
	"application/vnd.fluxtime.clip": [
	"ftc"
],
	"application/vnd.framemaker": [
	"fm",
	"frame",
	"maker",
	"book"
],
	"application/vnd.frogans.fnc": [
	"fnc"
],
	"application/vnd.frogans.ltf": [
	"ltf"
],
	"application/vnd.fsc.weblaunch": [
	"fsc"
],
	"application/vnd.fujitsu.oasys": [
	"oas"
],
	"application/vnd.fujitsu.oasys2": [
	"oa2"
],
	"application/vnd.fujitsu.oasys3": [
	"oa3"
],
	"application/vnd.fujitsu.oasysgp": [
	"fg5"
],
	"application/vnd.fujitsu.oasysprs": [
	"bh2"
],
	"application/vnd.fujixerox.ddd": [
	"ddd"
],
	"application/vnd.fujixerox.docuworks": [
	"xdw"
],
	"application/vnd.fujixerox.docuworks.binder": [
	"xbd"
],
	"application/vnd.fuzzysheet": [
	"fzs"
],
	"application/vnd.genomatix.tuxedo": [
	"txd"
],
	"application/vnd.geogebra.file": [
	"ggb"
],
	"application/vnd.geogebra.tool": [
	"ggt"
],
	"application/vnd.geometry-explorer": [
	"gex",
	"gre"
],
	"application/vnd.geonext": [
	"gxt"
],
	"application/vnd.geoplan": [
	"g2w"
],
	"application/vnd.geospace": [
	"g3w"
],
	"application/vnd.gmx": [
	"gmx"
],
	"application/vnd.google-apps.document": [
	"gdoc"
],
	"application/vnd.google-apps.presentation": [
	"gslides"
],
	"application/vnd.google-apps.spreadsheet": [
	"gsheet"
],
	"application/vnd.google-earth.kml+xml": [
	"kml"
],
	"application/vnd.google-earth.kmz": [
	"kmz"
],
	"application/vnd.grafeq": [
	"gqf",
	"gqs"
],
	"application/vnd.groove-account": [
	"gac"
],
	"application/vnd.groove-help": [
	"ghf"
],
	"application/vnd.groove-identity-message": [
	"gim"
],
	"application/vnd.groove-injector": [
	"grv"
],
	"application/vnd.groove-tool-message": [
	"gtm"
],
	"application/vnd.groove-tool-template": [
	"tpl"
],
	"application/vnd.groove-vcard": [
	"vcg"
],
	"application/vnd.hal+xml": [
	"hal"
],
	"application/vnd.handheld-entertainment+xml": [
	"zmm"
],
	"application/vnd.hbci": [
	"hbci"
],
	"application/vnd.hhe.lesson-player": [
	"les"
],
	"application/vnd.hp-hpgl": [
	"hpgl"
],
	"application/vnd.hp-hpid": [
	"hpid"
],
	"application/vnd.hp-hps": [
	"hps"
],
	"application/vnd.hp-jlyt": [
	"jlt"
],
	"application/vnd.hp-pcl": [
	"pcl"
],
	"application/vnd.hp-pclxl": [
	"pclxl"
],
	"application/vnd.hydrostatix.sof-data": [
	"sfd-hdstx"
],
	"application/vnd.ibm.minipay": [
	"mpy"
],
	"application/vnd.ibm.modcap": [
	"afp",
	"listafp",
	"list3820"
],
	"application/vnd.ibm.rights-management": [
	"irm"
],
	"application/vnd.ibm.secure-container": [
	"sc"
],
	"application/vnd.iccprofile": [
	"icc",
	"icm"
],
	"application/vnd.igloader": [
	"igl"
],
	"application/vnd.immervision-ivp": [
	"ivp"
],
	"application/vnd.immervision-ivu": [
	"ivu"
],
	"application/vnd.insors.igm": [
	"igm"
],
	"application/vnd.intercon.formnet": [
	"xpw",
	"xpx"
],
	"application/vnd.intergeo": [
	"i2g"
],
	"application/vnd.intu.qbo": [
	"qbo"
],
	"application/vnd.intu.qfx": [
	"qfx"
],
	"application/vnd.ipunplugged.rcprofile": [
	"rcprofile"
],
	"application/vnd.irepository.package+xml": [
	"irp"
],
	"application/vnd.is-xpr": [
	"xpr"
],
	"application/vnd.isac.fcs": [
	"fcs"
],
	"application/vnd.jam": [
	"jam"
],
	"application/vnd.jcp.javame.midlet-rms": [
	"rms"
],
	"application/vnd.jisp": [
	"jisp"
],
	"application/vnd.joost.joda-archive": [
	"joda"
],
	"application/vnd.kahootz": [
	"ktz",
	"ktr"
],
	"application/vnd.kde.karbon": [
	"karbon"
],
	"application/vnd.kde.kchart": [
	"chrt"
],
	"application/vnd.kde.kformula": [
	"kfo"
],
	"application/vnd.kde.kivio": [
	"flw"
],
	"application/vnd.kde.kontour": [
	"kon"
],
	"application/vnd.kde.kpresenter": [
	"kpr",
	"kpt"
],
	"application/vnd.kde.kspread": [
	"ksp"
],
	"application/vnd.kde.kword": [
	"kwd",
	"kwt"
],
	"application/vnd.kenameaapp": [
	"htke"
],
	"application/vnd.kidspiration": [
	"kia"
],
	"application/vnd.kinar": [
	"kne",
	"knp"
],
	"application/vnd.koan": [
	"skp",
	"skd",
	"skt",
	"skm"
],
	"application/vnd.kodak-descriptor": [
	"sse"
],
	"application/vnd.las.las+xml": [
	"lasxml"
],
	"application/vnd.llamagraphics.life-balance.desktop": [
	"lbd"
],
	"application/vnd.llamagraphics.life-balance.exchange+xml": [
	"lbe"
],
	"application/vnd.lotus-1-2-3": [
	"123"
],
	"application/vnd.lotus-approach": [
	"apr"
],
	"application/vnd.lotus-freelance": [
	"pre"
],
	"application/vnd.lotus-notes": [
	"nsf"
],
	"application/vnd.lotus-organizer": [
	"org"
],
	"application/vnd.lotus-screencam": [
	"scm"
],
	"application/vnd.lotus-wordpro": [
	"lwp"
],
	"application/vnd.macports.portpkg": [
	"portpkg"
],
	"application/vnd.mcd": [
	"mcd"
],
	"application/vnd.medcalcdata": [
	"mc1"
],
	"application/vnd.mediastation.cdkey": [
	"cdkey"
],
	"application/vnd.mfer": [
	"mwf"
],
	"application/vnd.mfmp": [
	"mfm"
],
	"application/vnd.micrografx.flo": [
	"flo"
],
	"application/vnd.micrografx.igx": [
	"igx"
],
	"application/vnd.mif": [
	"mif"
],
	"application/vnd.mobius.daf": [
	"daf"
],
	"application/vnd.mobius.dis": [
	"dis"
],
	"application/vnd.mobius.mbk": [
	"mbk"
],
	"application/vnd.mobius.mqy": [
	"mqy"
],
	"application/vnd.mobius.msl": [
	"msl"
],
	"application/vnd.mobius.plc": [
	"plc"
],
	"application/vnd.mobius.txf": [
	"txf"
],
	"application/vnd.mophun.application": [
	"mpn"
],
	"application/vnd.mophun.certificate": [
	"mpc"
],
	"application/vnd.mozilla.xul+xml": [
	"xul"
],
	"application/vnd.ms-artgalry": [
	"cil"
],
	"application/vnd.ms-cab-compressed": [
	"cab"
],
	"application/vnd.ms-excel": [
	"xls",
	"xlm",
	"xla",
	"xlc",
	"xlt",
	"xlw"
],
	"application/vnd.ms-excel.addin.macroenabled.12": [
	"xlam"
],
	"application/vnd.ms-excel.sheet.binary.macroenabled.12": [
	"xlsb"
],
	"application/vnd.ms-excel.sheet.macroenabled.12": [
	"xlsm"
],
	"application/vnd.ms-excel.template.macroenabled.12": [
	"xltm"
],
	"application/vnd.ms-fontobject": [
	"eot"
],
	"application/vnd.ms-htmlhelp": [
	"chm"
],
	"application/vnd.ms-ims": [
	"ims"
],
	"application/vnd.ms-lrm": [
	"lrm"
],
	"application/vnd.ms-officetheme": [
	"thmx"
],
	"application/vnd.ms-outlook": [
	"msg"
],
	"application/vnd.ms-pki.seccat": [
	"cat"
],
	"application/vnd.ms-pki.stl": [
	"stl"
],
	"application/vnd.ms-powerpoint": [
	"ppt",
	"pps",
	"pot"
],
	"application/vnd.ms-powerpoint.addin.macroenabled.12": [
	"ppam"
],
	"application/vnd.ms-powerpoint.presentation.macroenabled.12": [
	"pptm"
],
	"application/vnd.ms-powerpoint.slide.macroenabled.12": [
	"sldm"
],
	"application/vnd.ms-powerpoint.slideshow.macroenabled.12": [
	"ppsm"
],
	"application/vnd.ms-powerpoint.template.macroenabled.12": [
	"potm"
],
	"application/vnd.ms-project": [
	"mpp",
	"mpt"
],
	"application/vnd.ms-word.document.macroenabled.12": [
	"docm"
],
	"application/vnd.ms-word.template.macroenabled.12": [
	"dotm"
],
	"application/vnd.ms-works": [
	"wps",
	"wks",
	"wcm",
	"wdb"
],
	"application/vnd.ms-wpl": [
	"wpl"
],
	"application/vnd.ms-xpsdocument": [
	"xps"
],
	"application/vnd.mseq": [
	"mseq"
],
	"application/vnd.musician": [
	"mus"
],
	"application/vnd.muvee.style": [
	"msty"
],
	"application/vnd.mynfc": [
	"taglet"
],
	"application/vnd.neurolanguage.nlu": [
	"nlu"
],
	"application/vnd.nitf": [
	"ntf",
	"nitf"
],
	"application/vnd.noblenet-directory": [
	"nnd"
],
	"application/vnd.noblenet-sealer": [
	"nns"
],
	"application/vnd.noblenet-web": [
	"nnw"
],
	"application/vnd.nokia.n-gage.data": [
	"ngdat"
],
	"application/vnd.nokia.n-gage.symbian.install": [
	"n-gage"
],
	"application/vnd.nokia.radio-preset": [
	"rpst"
],
	"application/vnd.nokia.radio-presets": [
	"rpss"
],
	"application/vnd.novadigm.edm": [
	"edm"
],
	"application/vnd.novadigm.edx": [
	"edx"
],
	"application/vnd.novadigm.ext": [
	"ext"
],
	"application/vnd.oasis.opendocument.chart": [
	"odc"
],
	"application/vnd.oasis.opendocument.chart-template": [
	"otc"
],
	"application/vnd.oasis.opendocument.database": [
	"odb"
],
	"application/vnd.oasis.opendocument.formula": [
	"odf"
],
	"application/vnd.oasis.opendocument.formula-template": [
	"odft"
],
	"application/vnd.oasis.opendocument.graphics": [
	"odg"
],
	"application/vnd.oasis.opendocument.graphics-template": [
	"otg"
],
	"application/vnd.oasis.opendocument.image": [
	"odi"
],
	"application/vnd.oasis.opendocument.image-template": [
	"oti"
],
	"application/vnd.oasis.opendocument.presentation": [
	"odp"
],
	"application/vnd.oasis.opendocument.presentation-template": [
	"otp"
],
	"application/vnd.oasis.opendocument.spreadsheet": [
	"ods"
],
	"application/vnd.oasis.opendocument.spreadsheet-template": [
	"ots"
],
	"application/vnd.oasis.opendocument.text": [
	"odt"
],
	"application/vnd.oasis.opendocument.text-master": [
	"odm"
],
	"application/vnd.oasis.opendocument.text-template": [
	"ott"
],
	"application/vnd.oasis.opendocument.text-web": [
	"oth"
],
	"application/vnd.olpc-sugar": [
	"xo"
],
	"application/vnd.oma.dd2+xml": [
	"dd2"
],
	"application/vnd.openofficeorg.extension": [
	"oxt"
],
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": [
	"pptx"
],
	"application/vnd.openxmlformats-officedocument.presentationml.slide": [
	"sldx"
],
	"application/vnd.openxmlformats-officedocument.presentationml.slideshow": [
	"ppsx"
],
	"application/vnd.openxmlformats-officedocument.presentationml.template": [
	"potx"
],
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
	"xlsx"
],
	"application/vnd.openxmlformats-officedocument.spreadsheetml.template": [
	"xltx"
],
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
	"docx"
],
	"application/vnd.openxmlformats-officedocument.wordprocessingml.template": [
	"dotx"
],
	"application/vnd.osgeo.mapguide.package": [
	"mgp"
],
	"application/vnd.osgi.dp": [
	"dp"
],
	"application/vnd.osgi.subsystem": [
	"esa"
],
	"application/vnd.palm": [
	"pdb",
	"pqa",
	"oprc"
],
	"application/vnd.pawaafile": [
	"paw"
],
	"application/vnd.pg.format": [
	"str"
],
	"application/vnd.pg.osasli": [
	"ei6"
],
	"application/vnd.picsel": [
	"efif"
],
	"application/vnd.pmi.widget": [
	"wg"
],
	"application/vnd.pocketlearn": [
	"plf"
],
	"application/vnd.powerbuilder6": [
	"pbd"
],
	"application/vnd.previewsystems.box": [
	"box"
],
	"application/vnd.proteus.magazine": [
	"mgz"
],
	"application/vnd.publishare-delta-tree": [
	"qps"
],
	"application/vnd.pvi.ptid1": [
	"ptid"
],
	"application/vnd.quark.quarkxpress": [
	"qxd",
	"qxt",
	"qwd",
	"qwt",
	"qxl",
	"qxb"
],
	"application/vnd.realvnc.bed": [
	"bed"
],
	"application/vnd.recordare.musicxml": [
	"mxl"
],
	"application/vnd.recordare.musicxml+xml": [
	"musicxml"
],
	"application/vnd.rig.cryptonote": [
	"cryptonote"
],
	"application/vnd.rim.cod": [
	"cod"
],
	"application/vnd.rn-realmedia": [
	"rm"
],
	"application/vnd.rn-realmedia-vbr": [
	"rmvb"
],
	"application/vnd.route66.link66+xml": [
	"link66"
],
	"application/vnd.sailingtracker.track": [
	"st"
],
	"application/vnd.seemail": [
	"see"
],
	"application/vnd.sema": [
	"sema"
],
	"application/vnd.semd": [
	"semd"
],
	"application/vnd.semf": [
	"semf"
],
	"application/vnd.shana.informed.formdata": [
	"ifm"
],
	"application/vnd.shana.informed.formtemplate": [
	"itp"
],
	"application/vnd.shana.informed.interchange": [
	"iif"
],
	"application/vnd.shana.informed.package": [
	"ipk"
],
	"application/vnd.simtech-mindmapper": [
	"twd",
	"twds"
],
	"application/vnd.smaf": [
	"mmf"
],
	"application/vnd.smart.teacher": [
	"teacher"
],
	"application/vnd.solent.sdkm+xml": [
	"sdkm",
	"sdkd"
],
	"application/vnd.spotfire.dxp": [
	"dxp"
],
	"application/vnd.spotfire.sfs": [
	"sfs"
],
	"application/vnd.stardivision.calc": [
	"sdc"
],
	"application/vnd.stardivision.draw": [
	"sda"
],
	"application/vnd.stardivision.impress": [
	"sdd"
],
	"application/vnd.stardivision.math": [
	"smf"
],
	"application/vnd.stardivision.writer": [
	"sdw",
	"vor"
],
	"application/vnd.stardivision.writer-global": [
	"sgl"
],
	"application/vnd.stepmania.package": [
	"smzip"
],
	"application/vnd.stepmania.stepchart": [
	"sm"
],
	"application/vnd.sun.wadl+xml": [
	"wadl"
],
	"application/vnd.sun.xml.calc": [
	"sxc"
],
	"application/vnd.sun.xml.calc.template": [
	"stc"
],
	"application/vnd.sun.xml.draw": [
	"sxd"
],
	"application/vnd.sun.xml.draw.template": [
	"std"
],
	"application/vnd.sun.xml.impress": [
	"sxi"
],
	"application/vnd.sun.xml.impress.template": [
	"sti"
],
	"application/vnd.sun.xml.math": [
	"sxm"
],
	"application/vnd.sun.xml.writer": [
	"sxw"
],
	"application/vnd.sun.xml.writer.global": [
	"sxg"
],
	"application/vnd.sun.xml.writer.template": [
	"stw"
],
	"application/vnd.sus-calendar": [
	"sus",
	"susp"
],
	"application/vnd.svd": [
	"svd"
],
	"application/vnd.symbian.install": [
	"sis",
	"sisx"
],
	"application/vnd.syncml+xml": [
	"xsm"
],
	"application/vnd.syncml.dm+wbxml": [
	"bdm"
],
	"application/vnd.syncml.dm+xml": [
	"xdm"
],
	"application/vnd.tao.intent-module-archive": [
	"tao"
],
	"application/vnd.tcpdump.pcap": [
	"pcap",
	"cap",
	"dmp"
],
	"application/vnd.tmobile-livetv": [
	"tmo"
],
	"application/vnd.trid.tpt": [
	"tpt"
],
	"application/vnd.triscape.mxs": [
	"mxs"
],
	"application/vnd.trueapp": [
	"tra"
],
	"application/vnd.ufdl": [
	"ufd",
	"ufdl"
],
	"application/vnd.uiq.theme": [
	"utz"
],
	"application/vnd.umajin": [
	"umj"
],
	"application/vnd.unity": [
	"unityweb"
],
	"application/vnd.uoml+xml": [
	"uoml"
],
	"application/vnd.vcx": [
	"vcx"
],
	"application/vnd.visio": [
	"vsd",
	"vst",
	"vss",
	"vsw"
],
	"application/vnd.visionary": [
	"vis"
],
	"application/vnd.vsf": [
	"vsf"
],
	"application/vnd.wap.wbxml": [
	"wbxml"
],
	"application/vnd.wap.wmlc": [
	"wmlc"
],
	"application/vnd.wap.wmlscriptc": [
	"wmlsc"
],
	"application/vnd.webturbo": [
	"wtb"
],
	"application/vnd.wolfram.player": [
	"nbp"
],
	"application/vnd.wordperfect": [
	"wpd"
],
	"application/vnd.wqd": [
	"wqd"
],
	"application/vnd.wt.stf": [
	"stf"
],
	"application/vnd.xara": [
	"xar"
],
	"application/vnd.xfdl": [
	"xfdl"
],
	"application/vnd.yamaha.hv-dic": [
	"hvd"
],
	"application/vnd.yamaha.hv-script": [
	"hvs"
],
	"application/vnd.yamaha.hv-voice": [
	"hvp"
],
	"application/vnd.yamaha.openscoreformat": [
	"osf"
],
	"application/vnd.yamaha.openscoreformat.osfpvg+xml": [
	"osfpvg"
],
	"application/vnd.yamaha.smaf-audio": [
	"saf"
],
	"application/vnd.yamaha.smaf-phrase": [
	"spf"
],
	"application/vnd.yellowriver-custom-menu": [
	"cmp"
],
	"application/vnd.zul": [
	"zir",
	"zirz"
],
	"application/vnd.zzazz.deck+xml": [
	"zaz"
],
	"application/voicexml+xml": [
	"vxml"
],
	"application/wasm": [
	"wasm"
],
	"application/widget": [
	"wgt"
],
	"application/winhlp": [
	"hlp"
],
	"application/wsdl+xml": [
	"wsdl"
],
	"application/wspolicy+xml": [
	"wspolicy"
],
	"application/x-7z-compressed": [
	"7z"
],
	"application/x-abiword": [
	"abw"
],
	"application/x-ace-compressed": [
	"ace"
],
	"application/x-apple-diskimage": [
],
	"application/x-arj": [
	"arj"
],
	"application/x-authorware-bin": [
	"aab",
	"x32",
	"u32",
	"vox"
],
	"application/x-authorware-map": [
	"aam"
],
	"application/x-authorware-seg": [
	"aas"
],
	"application/x-bcpio": [
	"bcpio"
],
	"application/x-bdoc": [
],
	"application/x-bittorrent": [
	"torrent"
],
	"application/x-blorb": [
	"blb",
	"blorb"
],
	"application/x-bzip": [
	"bz"
],
	"application/x-bzip2": [
	"bz2",
	"boz"
],
	"application/x-cbr": [
	"cbr",
	"cba",
	"cbt",
	"cbz",
	"cb7"
],
	"application/x-cdlink": [
	"vcd"
],
	"application/x-cfs-compressed": [
	"cfs"
],
	"application/x-chat": [
	"chat"
],
	"application/x-chess-pgn": [
	"pgn"
],
	"application/x-chrome-extension": [
	"crx"
],
	"application/x-cocoa": [
	"cco"
],
	"application/x-conference": [
	"nsc"
],
	"application/x-cpio": [
	"cpio"
],
	"application/x-csh": [
	"csh"
],
	"application/x-debian-package": [
	"udeb"
],
	"application/x-dgc-compressed": [
	"dgc"
],
	"application/x-director": [
	"dir",
	"dcr",
	"dxr",
	"cst",
	"cct",
	"cxt",
	"w3d",
	"fgd",
	"swa"
],
	"application/x-doom": [
	"wad"
],
	"application/x-dtbncx+xml": [
	"ncx"
],
	"application/x-dtbook+xml": [
	"dtb"
],
	"application/x-dtbresource+xml": [
	"res"
],
	"application/x-dvi": [
	"dvi"
],
	"application/x-envoy": [
	"evy"
],
	"application/x-eva": [
	"eva"
],
	"application/x-font-bdf": [
	"bdf"
],
	"application/x-font-ghostscript": [
	"gsf"
],
	"application/x-font-linux-psf": [
	"psf"
],
	"application/x-font-pcf": [
	"pcf"
],
	"application/x-font-snf": [
	"snf"
],
	"application/x-font-type1": [
	"pfa",
	"pfb",
	"pfm",
	"afm"
],
	"application/x-freearc": [
	"arc"
],
	"application/x-futuresplash": [
	"spl"
],
	"application/x-gca-compressed": [
	"gca"
],
	"application/x-glulx": [
	"ulx"
],
	"application/x-gnumeric": [
	"gnumeric"
],
	"application/x-gramps-xml": [
	"gramps"
],
	"application/x-gtar": [
	"gtar"
],
	"application/x-hdf": [
	"hdf"
],
	"application/x-httpd-php": [
	"php"
],
	"application/x-install-instructions": [
	"install"
],
	"application/x-iso9660-image": [
],
	"application/x-java-archive-diff": [
	"jardiff"
],
	"application/x-java-jnlp-file": [
	"jnlp"
],
	"application/x-latex": [
	"latex"
],
	"application/x-lua-bytecode": [
	"luac"
],
	"application/x-lzh-compressed": [
	"lzh",
	"lha"
],
	"application/x-makeself": [
	"run"
],
	"application/x-mie": [
	"mie"
],
	"application/x-mobipocket-ebook": [
	"prc",
	"mobi"
],
	"application/x-ms-application": [
	"application"
],
	"application/x-ms-shortcut": [
	"lnk"
],
	"application/x-ms-wmd": [
	"wmd"
],
	"application/x-ms-wmz": [
	"wmz"
],
	"application/x-ms-xbap": [
	"xbap"
],
	"application/x-msaccess": [
	"mdb"
],
	"application/x-msbinder": [
	"obd"
],
	"application/x-mscardfile": [
	"crd"
],
	"application/x-msclip": [
	"clp"
],
	"application/x-msdos-program": [
],
	"application/x-msdownload": [
	"com",
	"bat"
],
	"application/x-msmediaview": [
	"mvb",
	"m13",
	"m14"
],
	"application/x-msmetafile": [
	"wmf",
	"emf",
	"emz"
],
	"application/x-msmoney": [
	"mny"
],
	"application/x-mspublisher": [
	"pub"
],
	"application/x-msschedule": [
	"scd"
],
	"application/x-msterminal": [
	"trm"
],
	"application/x-mswrite": [
	"wri"
],
	"application/x-netcdf": [
	"nc",
	"cdf"
],
	"application/x-ns-proxy-autoconfig": [
	"pac"
],
	"application/x-nzb": [
	"nzb"
],
	"application/x-perl": [
	"pl",
	"pm"
],
	"application/x-pilot": [
],
	"application/x-pkcs12": [
	"p12",
	"pfx"
],
	"application/x-pkcs7-certificates": [
	"p7b",
	"spc"
],
	"application/x-pkcs7-certreqresp": [
	"p7r"
],
	"application/x-rar-compressed": [
	"rar"
],
	"application/x-redhat-package-manager": [
	"rpm"
],
	"application/x-research-info-systems": [
	"ris"
],
	"application/x-sea": [
	"sea"
],
	"application/x-sh": [
	"sh"
],
	"application/x-shar": [
	"shar"
],
	"application/x-shockwave-flash": [
	"swf"
],
	"application/x-silverlight-app": [
	"xap"
],
	"application/x-sql": [
	"sql"
],
	"application/x-stuffit": [
	"sit"
],
	"application/x-stuffitx": [
	"sitx"
],
	"application/x-subrip": [
	"srt"
],
	"application/x-sv4cpio": [
	"sv4cpio"
],
	"application/x-sv4crc": [
	"sv4crc"
],
	"application/x-t3vm-image": [
	"t3"
],
	"application/x-tads": [
	"gam"
],
	"application/x-tar": [
	"tar"
],
	"application/x-tcl": [
	"tcl",
	"tk"
],
	"application/x-tex": [
	"tex"
],
	"application/x-tex-tfm": [
	"tfm"
],
	"application/x-texinfo": [
	"texinfo",
	"texi"
],
	"application/x-tgif": [
	"obj"
],
	"application/x-ustar": [
	"ustar"
],
	"application/x-virtualbox-hdd": [
	"hdd"
],
	"application/x-virtualbox-ova": [
	"ova"
],
	"application/x-virtualbox-ovf": [
	"ovf"
],
	"application/x-virtualbox-vbox": [
	"vbox"
],
	"application/x-virtualbox-vbox-extpack": [
	"vbox-extpack"
],
	"application/x-virtualbox-vdi": [
	"vdi"
],
	"application/x-virtualbox-vhd": [
	"vhd"
],
	"application/x-virtualbox-vmdk": [
	"vmdk"
],
	"application/x-wais-source": [
	"src"
],
	"application/x-web-app-manifest+json": [
	"webapp"
],
	"application/x-x509-ca-cert": [
	"der",
	"crt",
	"pem"
],
	"application/x-xfig": [
	"fig"
],
	"application/x-xliff+xml": [
	"xlf"
],
	"application/x-xpinstall": [
	"xpi"
],
	"application/x-xz": [
	"xz"
],
	"application/x-zmachine": [
	"z1",
	"z2",
	"z3",
	"z4",
	"z5",
	"z6",
	"z7",
	"z8"
],
	"application/xaml+xml": [
	"xaml"
],
	"application/xcap-diff+xml": [
	"xdf"
],
	"application/xenc+xml": [
	"xenc"
],
	"application/xhtml+xml": [
	"xhtml",
	"xht"
],
	"application/xml": [
	"xml",
	"xsl",
	"xsd",
	"rng"
],
	"application/xml-dtd": [
	"dtd"
],
	"application/xop+xml": [
	"xop"
],
	"application/xproc+xml": [
	"xpl"
],
	"application/xslt+xml": [
	"xslt"
],
	"application/xspf+xml": [
	"xspf"
],
	"application/xv+xml": [
	"mxml",
	"xhvml",
	"xvml",
	"xvm"
],
	"application/yang": [
	"yang"
],
	"application/yin+xml": [
	"yin"
],
	"application/zip": [
	"zip"
],
	"audio/3gpp": [
],
	"audio/adpcm": [
	"adp"
],
	"audio/basic": [
	"au",
	"snd"
],
	"audio/midi": [
	"mid",
	"midi",
	"kar",
	"rmi"
],
	"audio/mp3": [
],
	"audio/mp4": [
	"m4a",
	"mp4a"
],
	"audio/mpeg": [
	"mpga",
	"mp2",
	"mp2a",
	"mp3",
	"m2a",
	"m3a"
],
	"audio/ogg": [
	"oga",
	"ogg",
	"spx"
],
	"audio/s3m": [
	"s3m"
],
	"audio/silk": [
	"sil"
],
	"audio/vnd.dece.audio": [
	"uva",
	"uvva"
],
	"audio/vnd.digital-winds": [
	"eol"
],
	"audio/vnd.dra": [
	"dra"
],
	"audio/vnd.dts": [
	"dts"
],
	"audio/vnd.dts.hd": [
	"dtshd"
],
	"audio/vnd.lucent.voice": [
	"lvp"
],
	"audio/vnd.ms-playready.media.pya": [
	"pya"
],
	"audio/vnd.nuera.ecelp4800": [
	"ecelp4800"
],
	"audio/vnd.nuera.ecelp7470": [
	"ecelp7470"
],
	"audio/vnd.nuera.ecelp9600": [
	"ecelp9600"
],
	"audio/vnd.rip": [
	"rip"
],
	"audio/wav": [
	"wav"
],
	"audio/wave": [
],
	"audio/webm": [
	"weba"
],
	"audio/x-aac": [
	"aac"
],
	"audio/x-aiff": [
	"aif",
	"aiff",
	"aifc"
],
	"audio/x-caf": [
	"caf"
],
	"audio/x-flac": [
	"flac"
],
	"audio/x-m4a": [
],
	"audio/x-matroska": [
	"mka"
],
	"audio/x-mpegurl": [
	"m3u"
],
	"audio/x-ms-wax": [
	"wax"
],
	"audio/x-ms-wma": [
	"wma"
],
	"audio/x-pn-realaudio": [
	"ram",
	"ra"
],
	"audio/x-pn-realaudio-plugin": [
	"rmp"
],
	"audio/x-realaudio": [
],
	"audio/x-wav": [
],
	"audio/xm": [
	"xm"
],
	"chemical/x-cdx": [
	"cdx"
],
	"chemical/x-cif": [
	"cif"
],
	"chemical/x-cmdf": [
	"cmdf"
],
	"chemical/x-cml": [
	"cml"
],
	"chemical/x-csml": [
	"csml"
],
	"chemical/x-xyz": [
	"xyz"
],
	"font/collection": [
	"ttc"
],
	"font/otf": [
	"otf"
],
	"font/ttf": [
	"ttf"
],
	"font/woff": [
	"woff"
],
	"font/woff2": [
	"woff2"
],
	"image/apng": [
	"apng"
],
	"image/bmp": [
	"bmp"
],
	"image/cgm": [
	"cgm"
],
	"image/g3fax": [
	"g3"
],
	"image/gif": [
	"gif"
],
	"image/ief": [
	"ief"
],
	"image/jp2": [
	"jp2",
	"jpg2"
],
	"image/jpeg": [
	"jpeg",
	"jpg",
	"jpe"
],
	"image/jpm": [
	"jpm"
],
	"image/jpx": [
	"jpx",
	"jpf"
],
	"image/ktx": [
	"ktx"
],
	"image/png": [
	"png"
],
	"image/prs.btif": [
	"btif"
],
	"image/sgi": [
	"sgi"
],
	"image/svg+xml": [
	"svg",
	"svgz"
],
	"image/tiff": [
	"tiff",
	"tif"
],
	"image/vnd.adobe.photoshop": [
	"psd"
],
	"image/vnd.dece.graphic": [
	"uvi",
	"uvvi",
	"uvg",
	"uvvg"
],
	"image/vnd.djvu": [
	"djvu",
	"djv"
],
	"image/vnd.dvb.subtitle": [
],
	"image/vnd.dwg": [
	"dwg"
],
	"image/vnd.dxf": [
	"dxf"
],
	"image/vnd.fastbidsheet": [
	"fbs"
],
	"image/vnd.fpx": [
	"fpx"
],
	"image/vnd.fst": [
	"fst"
],
	"image/vnd.fujixerox.edmics-mmr": [
	"mmr"
],
	"image/vnd.fujixerox.edmics-rlc": [
	"rlc"
],
	"image/vnd.ms-modi": [
	"mdi"
],
	"image/vnd.ms-photo": [
	"wdp"
],
	"image/vnd.net-fpx": [
	"npx"
],
	"image/vnd.wap.wbmp": [
	"wbmp"
],
	"image/vnd.xiff": [
	"xif"
],
	"image/webp": [
	"webp"
],
	"image/x-3ds": [
	"3ds"
],
	"image/x-cmu-raster": [
	"ras"
],
	"image/x-cmx": [
	"cmx"
],
	"image/x-freehand": [
	"fh",
	"fhc",
	"fh4",
	"fh5",
	"fh7"
],
	"image/x-icon": [
	"ico"
],
	"image/x-jng": [
	"jng"
],
	"image/x-mrsid-image": [
	"sid"
],
	"image/x-ms-bmp": [
],
	"image/x-pcx": [
	"pcx"
],
	"image/x-pict": [
	"pic",
	"pct"
],
	"image/x-portable-anymap": [
	"pnm"
],
	"image/x-portable-bitmap": [
	"pbm"
],
	"image/x-portable-graymap": [
	"pgm"
],
	"image/x-portable-pixmap": [
	"ppm"
],
	"image/x-rgb": [
	"rgb"
],
	"image/x-tga": [
	"tga"
],
	"image/x-xbitmap": [
	"xbm"
],
	"image/x-xpixmap": [
	"xpm"
],
	"image/x-xwindowdump": [
	"xwd"
],
	"message/rfc822": [
	"eml",
	"mime"
],
	"model/gltf+json": [
	"gltf"
],
	"model/gltf-binary": [
	"glb"
],
	"model/iges": [
	"igs",
	"iges"
],
	"model/mesh": [
	"msh",
	"mesh",
	"silo"
],
	"model/vnd.collada+xml": [
	"dae"
],
	"model/vnd.dwf": [
	"dwf"
],
	"model/vnd.gdl": [
	"gdl"
],
	"model/vnd.gtw": [
	"gtw"
],
	"model/vnd.mts": [
	"mts"
],
	"model/vnd.vtu": [
	"vtu"
],
	"model/vrml": [
	"wrl",
	"vrml"
],
	"model/x3d+binary": [
	"x3db",
	"x3dbz"
],
	"model/x3d+vrml": [
	"x3dv",
	"x3dvz"
],
	"model/x3d+xml": [
	"x3d",
	"x3dz"
],
	"text/cache-manifest": [
	"appcache",
	"manifest"
],
	"text/calendar": [
	"ics",
	"ifb"
],
	"text/coffeescript": [
	"coffee",
	"litcoffee"
],
	"text/css": [
	"css"
],
	"text/csv": [
	"csv"
],
	"text/hjson": [
	"hjson"
],
	"text/html": [
	"html",
	"htm",
	"shtml"
],
	"text/jade": [
	"jade"
],
	"text/jsx": [
	"jsx"
],
	"text/less": [
	"less"
],
	"text/markdown": [
	"markdown",
	"md"
],
	"text/mathml": [
	"mml"
],
	"text/n3": [
	"n3"
],
	"text/plain": [
	"txt",
	"text",
	"conf",
	"def",
	"list",
	"log",
	"in",
	"ini"
],
	"text/prs.lines.tag": [
	"dsc"
],
	"text/richtext": [
	"rtx"
],
	"text/rtf": [
],
	"text/sgml": [
	"sgml",
	"sgm"
],
	"text/slim": [
	"slim",
	"slm"
],
	"text/stylus": [
	"stylus",
	"styl"
],
	"text/tab-separated-values": [
	"tsv"
],
	"text/troff": [
	"t",
	"tr",
	"roff",
	"man",
	"me",
	"ms"
],
	"text/turtle": [
	"ttl"
],
	"text/uri-list": [
	"uri",
	"uris",
	"urls"
],
	"text/vcard": [
	"vcard"
],
	"text/vnd.curl": [
	"curl"
],
	"text/vnd.curl.dcurl": [
	"dcurl"
],
	"text/vnd.curl.mcurl": [
	"mcurl"
],
	"text/vnd.curl.scurl": [
	"scurl"
],
	"text/vnd.dvb.subtitle": [
	"sub"
],
	"text/vnd.fly": [
	"fly"
],
	"text/vnd.fmi.flexstor": [
	"flx"
],
	"text/vnd.graphviz": [
	"gv"
],
	"text/vnd.in3d.3dml": [
	"3dml"
],
	"text/vnd.in3d.spot": [
	"spot"
],
	"text/vnd.sun.j2me.app-descriptor": [
	"jad"
],
	"text/vnd.wap.wml": [
	"wml"
],
	"text/vnd.wap.wmlscript": [
	"wmls"
],
	"text/vtt": [
	"vtt"
],
	"text/x-asm": [
	"s",
	"asm"
],
	"text/x-c": [
	"c",
	"cc",
	"cxx",
	"cpp",
	"h",
	"hh",
	"dic"
],
	"text/x-component": [
	"htc"
],
	"text/x-fortran": [
	"f",
	"for",
	"f77",
	"f90"
],
	"text/x-handlebars-template": [
	"hbs"
],
	"text/x-java-source": [
	"java"
],
	"text/x-lua": [
	"lua"
],
	"text/x-markdown": [
	"mkd"
],
	"text/x-nfo": [
	"nfo"
],
	"text/x-opml": [
	"opml"
],
	"text/x-org": [
],
	"text/x-pascal": [
	"p",
	"pas"
],
	"text/x-processing": [
	"pde"
],
	"text/x-sass": [
	"sass"
],
	"text/x-scss": [
	"scss"
],
	"text/x-setext": [
	"etx"
],
	"text/x-sfv": [
	"sfv"
],
	"text/x-suse-ymp": [
	"ymp"
],
	"text/x-uuencode": [
	"uu"
],
	"text/x-vcalendar": [
	"vcs"
],
	"text/x-vcard": [
	"vcf"
],
	"text/xml": [
],
	"text/yaml": [
	"yaml",
	"yml"
],
	"video/3gpp": [
	"3gp",
	"3gpp"
],
	"video/3gpp2": [
	"3g2"
],
	"video/h261": [
	"h261"
],
	"video/h263": [
	"h263"
],
	"video/h264": [
	"h264"
],
	"video/jpeg": [
	"jpgv"
],
	"video/jpm": [
	"jpgm"
],
	"video/mj2": [
	"mj2",
	"mjp2"
],
	"video/mp2t": [
	"ts"
],
	"video/mp4": [
	"mp4",
	"mp4v",
	"mpg4"
],
	"video/mpeg": [
	"mpeg",
	"mpg",
	"mpe",
	"m1v",
	"m2v"
],
	"video/ogg": [
	"ogv"
],
	"video/quicktime": [
	"qt",
	"mov"
],
	"video/vnd.dece.hd": [
	"uvh",
	"uvvh"
],
	"video/vnd.dece.mobile": [
	"uvm",
	"uvvm"
],
	"video/vnd.dece.pd": [
	"uvp",
	"uvvp"
],
	"video/vnd.dece.sd": [
	"uvs",
	"uvvs"
],
	"video/vnd.dece.video": [
	"uvv",
	"uvvv"
],
	"video/vnd.dvb.file": [
	"dvb"
],
	"video/vnd.fvt": [
	"fvt"
],
	"video/vnd.mpegurl": [
	"mxu",
	"m4u"
],
	"video/vnd.ms-playready.media.pyv": [
	"pyv"
],
	"video/vnd.uvvu.mp4": [
	"uvu",
	"uvvu"
],
	"video/vnd.vivo": [
	"viv"
],
	"video/webm": [
	"webm"
],
	"video/x-f4v": [
	"f4v"
],
	"video/x-fli": [
	"fli"
],
	"video/x-flv": [
	"flv"
],
	"video/x-m4v": [
	"m4v"
],
	"video/x-matroska": [
	"mkv",
	"mk3d",
	"mks"
],
	"video/x-mng": [
	"mng"
],
	"video/x-ms-asf": [
	"asf",
	"asx"
],
	"video/x-ms-vob": [
	"vob"
],
	"video/x-ms-wm": [
	"wm"
],
	"video/x-ms-wmv": [
	"wmv"
],
	"video/x-ms-wmx": [
	"wmx"
],
	"video/x-ms-wvx": [
	"wvx"
],
	"video/x-msvideo": [
	"avi"
],
	"video/x-sgi-movie": [
	"movie"
],
	"video/x-smv": [
	"smv"
],
	"x-conference/x-cooltalk": [
	"ice"
]
};

function Mime() {
  // Map of extension -> mime type
  this.types = Object.create(null);

  // Map of mime type -> extension
  this.extensions = Object.create(null);
}

/**
 * Define mimetype -> extension mappings.  Each key is a mime-type that maps
 * to an array of extensions associated with the type.  The first extension is
 * used as the default extension for the type.
 *
 * e.g. mime.define({'audio/ogg', ['oga', 'ogg', 'spx']});
 *
 * @param map (Object) type definitions
 */
Mime.prototype.define = function (map) {
  for (var type in map) {
    var exts = map[type];
    for (var i = 0; i < exts.length; i++) {
      if (process.env.DEBUG_MIME && this.types[exts[i]]) {
        console.warn((this._loading || "define()").replace(/.*\//, ''), 'changes "' + exts[i] + '" extension type from ' +
          this.types[exts[i]] + ' to ' + type);
      }

      this.types[exts[i]] = type;
    }

    // Default extension is the first one we encounter
    if (!this.extensions[type]) {
      this.extensions[type] = exts[0];
    }
  }
};

/**
 * Load an Apache2-style ".types" file
 *
 * This may be called multiple times (it's expected).  Where files declare
 * overlapping types/extensions, the last file wins.
 *
 * @param file (String) path of file to load.
 */
Mime.prototype.load = function(file) {
  this._loading = file;
  // Read file and split into lines
  var map = {},
      content = fs__default["default"].readFileSync(file, 'ascii'),
      lines = content.split(/[\r\n]+/);

  lines.forEach(function(line) {
    // Clean up whitespace/comments, and split into fields
    var fields = line.replace(/\s*#.*|^\s*|\s*$/g, '').split(/\s+/);
    map[fields.shift()] = fields;
  });

  this.define(map);

  this._loading = null;
};

/**
 * Lookup a mime type based on extension
 */
Mime.prototype.lookup = function(path, fallback) {
  var ext = path.replace(/^.*[\.\/\\]/, '').toLowerCase();

  return this.types[ext] || fallback || this.default_type;
};

/**
 * Return file extension associated with a mime type
 */
Mime.prototype.extension = function(mimeType) {
  var type = mimeType.match(/^\s*([^;\s]*)(?:;|\s|$)/)[1].toLowerCase();
  return this.extensions[type];
};

// Default instance
var mime = new Mime();

// Define built-in types
mime.define(require$$0$2);

// Default type
mime.default_type = mime.lookup('bin');

//
// Additional API specific to the default instance
//

mime.Mime = Mime;

/**
 * Lookup a charset based on mime type.
 */
mime.charsets = {
  lookup: function(mimeType, fallback) {
    // Assume text types are utf8
    return (/^text\/|^application\/(javascript|json)/).test(mimeType) ? 'UTF-8' : fallback;
  }
};

var mime_1$1 = mime;

/**
 * Helpers.
 */
var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

var ms = function (val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse$1(val);
  } else if (type === 'number' && isFinite(val)) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse$1(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'weeks':
    case 'week':
    case 'w':
      return n * w;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (msAbs >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (msAbs >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (msAbs >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  var msAbs = Math.abs(ms);
  if (msAbs >= d) {
    return plural(ms, msAbs, d, 'day');
  }
  if (msAbs >= h) {
    return plural(ms, msAbs, h, 'hour');
  }
  if (msAbs >= m) {
    return plural(ms, msAbs, m, 'minute');
  }
  if (msAbs >= s) {
    return plural(ms, msAbs, s, 'second');
  }
  return ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}

/*!
 * ee-first
 * Copyright(c) 2014 Jonathan Ong
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var eeFirst = first;

/**
 * Get the first event in a set of event emitters and event pairs.
 *
 * @param {array} stuff
 * @param {function} done
 * @public
 */

function first(stuff, done) {
  if (!Array.isArray(stuff))
    throw new TypeError('arg must be an array of [ee, events...] arrays')

  var cleanups = [];

  for (var i = 0; i < stuff.length; i++) {
    var arr = stuff[i];

    if (!Array.isArray(arr) || arr.length < 2)
      throw new TypeError('each array member must be [ee, events...]')

    var ee = arr[0];

    for (var j = 1; j < arr.length; j++) {
      var event = arr[j];
      var fn = listener(event, callback);

      // listen to the event
      ee.on(event, fn);
      // push this listener to the list of cleanups
      cleanups.push({
        ee: ee,
        event: event,
        fn: fn,
      });
    }
  }

  function callback() {
    cleanup();
    done.apply(null, arguments);
  }

  function cleanup() {
    var x;
    for (var i = 0; i < cleanups.length; i++) {
      x = cleanups[i];
      x.ee.removeListener(x.event, x.fn);
    }
  }

  function thunk(fn) {
    done = fn;
  }

  thunk.cancel = cleanup;

  return thunk
}

/**
 * Create the event listener.
 * @private
 */

function listener(event, done) {
  return function onevent(arg1) {
    var args = new Array(arguments.length);
    var ee = this;
    var err = event === 'error'
      ? arg1
      : null;

    // copy args to prevent arguments escaping scope
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    done(err, ee, event, args);
  }
}

/*!
 * on-finished
 * Copyright(c) 2013 Jonathan Ong
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var onFinished_1 = onFinished;
var isFinished_1 = isFinished;

/**
 * Module dependencies.
 * @private
 */



/**
 * Variables.
 * @private
 */

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)); };

/**
 * Invoke callback when the response has finished, useful for
 * cleaning up resources afterwards.
 *
 * @param {object} msg
 * @param {function} listener
 * @return {object}
 * @public
 */

function onFinished(msg, listener) {
  if (isFinished(msg) !== false) {
    defer(listener, null, msg);
    return msg
  }

  // attach the listener to the message
  attachListener(msg, listener);

  return msg
}

/**
 * Determine if message is already finished.
 *
 * @param {object} msg
 * @return {boolean}
 * @public
 */

function isFinished(msg) {
  var socket = msg.socket;

  if (typeof msg.finished === 'boolean') {
    // OutgoingMessage
    return Boolean(msg.finished || (socket && !socket.writable))
  }

  if (typeof msg.complete === 'boolean') {
    // IncomingMessage
    return Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable))
  }

  // don't know
  return undefined
}

/**
 * Attach a finished listener to the message.
 *
 * @param {object} msg
 * @param {function} callback
 * @private
 */

function attachFinishedListener(msg, callback) {
  var eeMsg;
  var eeSocket;
  var finished = false;

  function onFinish(error) {
    eeMsg.cancel();
    eeSocket.cancel();

    finished = true;
    callback(error);
  }

  // finished on first message event
  eeMsg = eeSocket = eeFirst([[msg, 'end', 'finish']], onFinish);

  function onSocket(socket) {
    // remove listener
    msg.removeListener('socket', onSocket);

    if (finished) return
    if (eeMsg !== eeSocket) return

    // finished on first socket event
    eeSocket = eeFirst([[socket, 'error', 'close']], onFinish);
  }

  if (msg.socket) {
    // socket already assigned
    onSocket(msg.socket);
    return
  }

  // wait for socket to be assigned
  msg.on('socket', onSocket);

  if (msg.socket === undefined) {
    // node.js 0.8 patch
    patchAssignSocket(msg, onSocket);
  }
}

/**
 * Attach the listener to the message.
 *
 * @param {object} msg
 * @return {function}
 * @private
 */

function attachListener(msg, listener) {
  var attached = msg.__onFinished;

  // create a private single listener with queue
  if (!attached || !attached.queue) {
    attached = msg.__onFinished = createListener(msg);
    attachFinishedListener(msg, attached);
  }

  attached.queue.push(listener);
}

/**
 * Create listener on message.
 *
 * @param {object} msg
 * @return {function}
 * @private
 */

function createListener(msg) {
  function listener(err) {
    if (msg.__onFinished === listener) msg.__onFinished = null;
    if (!listener.queue) return

    var queue = listener.queue;
    listener.queue = null;

    for (var i = 0; i < queue.length; i++) {
      queue[i](err, msg);
    }
  }

  listener.queue = [];

  return listener
}

/**
 * Patch ServerResponse.prototype.assignSocket for node.js 0.8.
 *
 * @param {ServerResponse} res
 * @param {function} callback
 * @private
 */

function patchAssignSocket(res, callback) {
  var assignSocket = res.assignSocket;

  if (typeof assignSocket !== 'function') return

  // res.on('socket', callback) is broken in 0.8
  res.assignSocket = function _assignSocket(socket) {
    assignSocket.call(this, socket);
    callback(socket);
  };
}
onFinished_1.isFinished = isFinished_1;

/*!
 * range-parser
 * Copyright(c) 2012-2014 TJ Holowaychuk
 * Copyright(c) 2015-2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var rangeParser_1 = rangeParser;

/**
 * Parse "Range" header `str` relative to the given file `size`.
 *
 * @param {Number} size
 * @param {String} str
 * @param {Object} [options]
 * @return {Array}
 * @public
 */

function rangeParser (size, str, options) {
  if (typeof str !== 'string') {
    throw new TypeError('argument str must be a string')
  }

  var index = str.indexOf('=');

  if (index === -1) {
    return -2
  }

  // split the range string
  var arr = str.slice(index + 1).split(',');
  var ranges = [];

  // add ranges type
  ranges.type = str.slice(0, index);

  // parse all ranges
  for (var i = 0; i < arr.length; i++) {
    var range = arr[i].split('-');
    var start = parseInt(range[0], 10);
    var end = parseInt(range[1], 10);

    // -nnn
    if (isNaN(start)) {
      start = size - end;
      end = size - 1;
    // nnn-
    } else if (isNaN(end)) {
      end = size - 1;
    }

    // limit last-byte-pos to current length
    if (end > size - 1) {
      end = size - 1;
    }

    // invalid or unsatisifiable
    if (isNaN(start) || isNaN(end) || start > end || start < 0) {
      continue
    }

    // add range
    ranges.push({
      start: start,
      end: end
    });
  }

  if (ranges.length < 1) {
    // unsatisifiable
    return -1
  }

  return options && options.combine
    ? combineRanges(ranges)
    : ranges
}

/**
 * Combine overlapping & adjacent ranges.
 * @private
 */

function combineRanges (ranges) {
  var ordered = ranges.map(mapWithIndex).sort(sortByRangeStart);

  for (var j = 0, i = 1; i < ordered.length; i++) {
    var range = ordered[i];
    var current = ordered[j];

    if (range.start > current.end + 1) {
      // next range
      ordered[++j] = range;
    } else if (range.end > current.end) {
      // extend range
      current.end = range.end;
      current.index = Math.min(current.index, range.index);
    }
  }

  // trim ordered array
  ordered.length = j + 1;

  // generate combined range
  var combined = ordered.sort(sortByRangeIndex).map(mapWithoutIndex);

  // copy ranges type
  combined.type = ranges.type;

  return combined
}

/**
 * Map function to add index value to ranges.
 * @private
 */

function mapWithIndex (range, index) {
  return {
    start: range.start,
    end: range.end,
    index: index
  }
}

/**
 * Map function to remove index value from ranges.
 * @private
 */

function mapWithoutIndex (range) {
  return {
    start: range.start,
    end: range.end
  }
}

/**
 * Sort function to sort ranges by index.
 * @private
 */

function sortByRangeIndex (a, b) {
  return a.index - b.index
}

/**
 * Sort function to sort ranges by start position.
 * @private
 */

function sortByRangeStart (a, b) {
  return a.start - b.start
}

/*!
 * send
 * Copyright(c) 2012 TJ Holowaychuk
 * Copyright(c) 2014-2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */


var debug = src('send');
var deprecate = depd_1('send');










var path = require$$1__default["default"];




/**
 * Path function references.
 * @private
 */

var extname = path.extname;
var join = path.join;
var normalize = path.normalize;
var resolve = path.resolve;
var sep = path.sep;

/**
 * Regular expression for identifying a bytes Range header.
 * @private
 */

var BYTES_RANGE_REGEXP = /^ *bytes=/;

/**
 * Maximum value allowed for the max age.
 * @private
 */

var MAX_MAXAGE = 60 * 60 * 24 * 365 * 1000; // 1 year

/**
 * Regular expression to match a path with a directory up component.
 * @private
 */

var UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * Module exports.
 * @public
 */

var send_1 = send;
var mime_1 = mime_1$1;

/**
 * Return a `SendStream` for `req` and `path`.
 *
 * @param {object} req
 * @param {string} path
 * @param {object} [options]
 * @return {SendStream}
 * @public
 */

function send (req, path, options) {
  return new SendStream(req, path, options)
}

/**
 * Initialize a `SendStream` with the given `path`.
 *
 * @param {Request} req
 * @param {String} path
 * @param {object} [options]
 * @private
 */

function SendStream (req, path, options) {
  Stream__default["default"].call(this);

  var opts = options || {};

  this.options = opts;
  this.path = path;
  this.req = req;

  this._acceptRanges = opts.acceptRanges !== undefined
    ? Boolean(opts.acceptRanges)
    : true;

  this._cacheControl = opts.cacheControl !== undefined
    ? Boolean(opts.cacheControl)
    : true;

  this._etag = opts.etag !== undefined
    ? Boolean(opts.etag)
    : true;

  this._dotfiles = opts.dotfiles !== undefined
    ? opts.dotfiles
    : 'ignore';

  if (this._dotfiles !== 'ignore' && this._dotfiles !== 'allow' && this._dotfiles !== 'deny') {
    throw new TypeError('dotfiles option must be "allow", "deny", or "ignore"')
  }

  this._hidden = Boolean(opts.hidden);

  if (opts.hidden !== undefined) {
    deprecate('hidden: use dotfiles: \'' + (this._hidden ? 'allow' : 'ignore') + '\' instead');
  }

  // legacy support
  if (opts.dotfiles === undefined) {
    this._dotfiles = undefined;
  }

  this._extensions = opts.extensions !== undefined
    ? normalizeList(opts.extensions, 'extensions option')
    : [];

  this._immutable = opts.immutable !== undefined
    ? Boolean(opts.immutable)
    : false;

  this._index = opts.index !== undefined
    ? normalizeList(opts.index, 'index option')
    : ['index.html'];

  this._lastModified = opts.lastModified !== undefined
    ? Boolean(opts.lastModified)
    : true;

  this._maxage = opts.maxAge || opts.maxage;
  this._maxage = typeof this._maxage === 'string'
    ? ms(this._maxage)
    : Number(this._maxage);
  this._maxage = !isNaN(this._maxage)
    ? Math.min(Math.max(0, this._maxage), MAX_MAXAGE)
    : 0;

  this._root = opts.root
    ? resolve(opts.root)
    : null;

  if (!this._root && opts.from) {
    this.from(opts.from);
  }
}

/**
 * Inherits from `Stream`.
 */

util__default["default"].inherits(SendStream, Stream__default["default"]);

/**
 * Enable or disable etag generation.
 *
 * @param {Boolean} val
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.etag = deprecate.function(function etag (val) {
  this._etag = Boolean(val);
  debug('etag %s', this._etag);
  return this
}, 'send.etag: pass etag as option');

/**
 * Enable or disable "hidden" (dot) files.
 *
 * @param {Boolean} path
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.hidden = deprecate.function(function hidden (val) {
  this._hidden = Boolean(val);
  this._dotfiles = undefined;
  debug('hidden %s', this._hidden);
  return this
}, 'send.hidden: use dotfiles option');

/**
 * Set index `paths`, set to a falsy
 * value to disable index support.
 *
 * @param {String|Boolean|Array} paths
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.index = deprecate.function(function index (paths) {
  var index = !paths ? [] : normalizeList(paths, 'paths argument');
  debug('index %o', paths);
  this._index = index;
  return this
}, 'send.index: pass index as option');

/**
 * Set root `path`.
 *
 * @param {String} path
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.root = function root (path) {
  this._root = resolve(String(path));
  debug('root %s', this._root);
  return this
};

SendStream.prototype.from = deprecate.function(SendStream.prototype.root,
  'send.from: pass root as option');

SendStream.prototype.root = deprecate.function(SendStream.prototype.root,
  'send.root: pass root as option');

/**
 * Set max-age to `maxAge`.
 *
 * @param {Number} maxAge
 * @return {SendStream}
 * @api public
 */

SendStream.prototype.maxage = deprecate.function(function maxage (maxAge) {
  this._maxage = typeof maxAge === 'string'
    ? ms(maxAge)
    : Number(maxAge);
  this._maxage = !isNaN(this._maxage)
    ? Math.min(Math.max(0, this._maxage), MAX_MAXAGE)
    : 0;
  debug('max-age %d', this._maxage);
  return this
}, 'send.maxage: pass maxAge as option');

/**
 * Emit error with `status`.
 *
 * @param {number} status
 * @param {Error} [err]
 * @private
 */

SendStream.prototype.error = function error (status, err) {
  // emit if listeners instead of responding
  if (hasListeners(this, 'error')) {
    return this.emit('error', httpErrors(status, err, {
      expose: false
    }))
  }

  var res = this.res;
  var msg = statuses[status] || String(status);
  var doc = createHtmlDocument('Error', escapeHtml_1(msg));

  // clear existing headers
  clearHeaders(res);

  // add error headers
  if (err && err.headers) {
    setHeaders(res, err.headers);
  }

  // send basic response
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.setHeader('Content-Length', Buffer.byteLength(doc));
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(doc);
};

/**
 * Check if the pathname ends with "/".
 *
 * @return {boolean}
 * @private
 */

SendStream.prototype.hasTrailingSlash = function hasTrailingSlash () {
  return this.path[this.path.length - 1] === '/'
};

/**
 * Check if this is a conditional GET request.
 *
 * @return {Boolean}
 * @api private
 */

SendStream.prototype.isConditionalGET = function isConditionalGET () {
  return this.req.headers['if-match'] ||
    this.req.headers['if-unmodified-since'] ||
    this.req.headers['if-none-match'] ||
    this.req.headers['if-modified-since']
};

/**
 * Check if the request preconditions failed.
 *
 * @return {boolean}
 * @private
 */

SendStream.prototype.isPreconditionFailure = function isPreconditionFailure () {
  var req = this.req;
  var res = this.res;

  // if-match
  var match = req.headers['if-match'];
  if (match) {
    var etag = res.getHeader('ETag');
    return !etag || (match !== '*' && parseTokenList(match).every(function (match) {
      return match !== etag && match !== 'W/' + etag && 'W/' + match !== etag
    }))
  }

  // if-unmodified-since
  var unmodifiedSince = parseHttpDate(req.headers['if-unmodified-since']);
  if (!isNaN(unmodifiedSince)) {
    var lastModified = parseHttpDate(res.getHeader('Last-Modified'));
    return isNaN(lastModified) || lastModified > unmodifiedSince
  }

  return false
};

/**
 * Strip content-* header fields.
 *
 * @private
 */

SendStream.prototype.removeContentHeaderFields = function removeContentHeaderFields () {
  var res = this.res;
  var headers = getHeaderNames(res);

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    if (header.substr(0, 8) === 'content-' && header !== 'content-location') {
      res.removeHeader(header);
    }
  }
};

/**
 * Respond with 304 not modified.
 *
 * @api private
 */

SendStream.prototype.notModified = function notModified () {
  var res = this.res;
  debug('not modified');
  this.removeContentHeaderFields();
  res.statusCode = 304;
  res.end();
};

/**
 * Raise error that headers already sent.
 *
 * @api private
 */

SendStream.prototype.headersAlreadySent = function headersAlreadySent () {
  var err = new Error('Can\'t set headers after they are sent.');
  debug('headers already sent');
  this.error(500, err);
};

/**
 * Check if the request is cacheable, aka
 * responded with 2xx or 304 (see RFC 2616 section 14.2{5,6}).
 *
 * @return {Boolean}
 * @api private
 */

SendStream.prototype.isCachable = function isCachable () {
  var statusCode = this.res.statusCode;
  return (statusCode >= 200 && statusCode < 300) ||
    statusCode === 304
};

/**
 * Handle stat() error.
 *
 * @param {Error} error
 * @private
 */

SendStream.prototype.onStatError = function onStatError (error) {
  switch (error.code) {
    case 'ENAMETOOLONG':
    case 'ENOENT':
    case 'ENOTDIR':
      this.error(404, error);
      break
    default:
      this.error(500, error);
      break
  }
};

/**
 * Check if the cache is fresh.
 *
 * @return {Boolean}
 * @api private
 */

SendStream.prototype.isFresh = function isFresh () {
  return fresh_1(this.req.headers, {
    etag: this.res.getHeader('ETag'),
    'last-modified': this.res.getHeader('Last-Modified')
  })
};

/**
 * Check if the range is fresh.
 *
 * @return {Boolean}
 * @api private
 */

SendStream.prototype.isRangeFresh = function isRangeFresh () {
  var ifRange = this.req.headers['if-range'];

  if (!ifRange) {
    return true
  }

  // if-range as etag
  if (ifRange.indexOf('"') !== -1) {
    var etag = this.res.getHeader('ETag');
    return Boolean(etag && ifRange.indexOf(etag) !== -1)
  }

  // if-range as modified date
  var lastModified = this.res.getHeader('Last-Modified');
  return parseHttpDate(lastModified) <= parseHttpDate(ifRange)
};

/**
 * Redirect to path.
 *
 * @param {string} path
 * @private
 */

SendStream.prototype.redirect = function redirect (path) {
  var res = this.res;

  if (hasListeners(this, 'directory')) {
    this.emit('directory', res, path);
    return
  }

  if (this.hasTrailingSlash()) {
    this.error(403);
    return
  }

  var loc = encodeurl(collapseLeadingSlashes(this.path + '/'));
  var doc = createHtmlDocument('Redirecting', 'Redirecting to <a href="' + escapeHtml_1(loc) + '">' +
    escapeHtml_1(loc) + '</a>');

  // redirect
  res.statusCode = 301;
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.setHeader('Content-Length', Buffer.byteLength(doc));
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Location', loc);
  res.end(doc);
};

/**
 * Pipe to `res.
 *
 * @param {Stream} res
 * @return {Stream} res
 * @api public
 */

SendStream.prototype.pipe = function pipe (res) {
  // root path
  var root = this._root;

  // references
  this.res = res;

  // decode the path
  var path = decode$1(this.path);
  if (path === -1) {
    this.error(400);
    return res
  }

  // null byte(s)
  if (~path.indexOf('\0')) {
    this.error(400);
    return res
  }

  var parts;
  if (root !== null) {
    // normalize
    if (path) {
      path = normalize('.' + sep + path);
    }

    // malicious path
    if (UP_PATH_REGEXP.test(path)) {
      debug('malicious path "%s"', path);
      this.error(403);
      return res
    }

    // explode path parts
    parts = path.split(sep);

    // join / normalize from optional root dir
    path = normalize(join(root, path));
  } else {
    // ".." is malicious without "root"
    if (UP_PATH_REGEXP.test(path)) {
      debug('malicious path "%s"', path);
      this.error(403);
      return res
    }

    // explode path parts
    parts = normalize(path).split(sep);

    // resolve the path
    path = resolve(path);
  }

  // dotfile handling
  if (containsDotFile(parts)) {
    var access = this._dotfiles;

    // legacy support
    if (access === undefined) {
      access = parts[parts.length - 1][0] === '.'
        ? (this._hidden ? 'allow' : 'ignore')
        : 'allow';
    }

    debug('%s dotfile "%s"', access, path);
    switch (access) {
      case 'allow':
        break
      case 'deny':
        this.error(403);
        return res
      case 'ignore':
      default:
        this.error(404);
        return res
    }
  }

  // index file support
  if (this._index.length && this.hasTrailingSlash()) {
    this.sendIndex(path);
    return res
  }

  this.sendFile(path);
  return res
};

/**
 * Transfer `path`.
 *
 * @param {String} path
 * @api public
 */

SendStream.prototype.send = function send (path, stat) {
  var len = stat.size;
  var options = this.options;
  var opts = {};
  var res = this.res;
  var req = this.req;
  var ranges = req.headers.range;
  var offset = options.start || 0;

  if (headersSent(res)) {
    // impossible to send now
    this.headersAlreadySent();
    return
  }

  debug('pipe "%s"', path);

  // set header fields
  this.setHeader(path, stat);

  // set content-type
  this.type(path);

  // conditional GET support
  if (this.isConditionalGET()) {
    if (this.isPreconditionFailure()) {
      this.error(412);
      return
    }

    if (this.isCachable() && this.isFresh()) {
      this.notModified();
      return
    }
  }

  // adjust len to start/end options
  len = Math.max(0, len - offset);
  if (options.end !== undefined) {
    var bytes = options.end - offset + 1;
    if (len > bytes) len = bytes;
  }

  // Range support
  if (this._acceptRanges && BYTES_RANGE_REGEXP.test(ranges)) {
    // parse
    ranges = rangeParser_1(len, ranges, {
      combine: true
    });

    // If-Range support
    if (!this.isRangeFresh()) {
      debug('range stale');
      ranges = -2;
    }

    // unsatisfiable
    if (ranges === -1) {
      debug('range unsatisfiable');

      // Content-Range
      res.setHeader('Content-Range', contentRange('bytes', len));

      // 416 Requested Range Not Satisfiable
      return this.error(416, {
        headers: { 'Content-Range': res.getHeader('Content-Range') }
      })
    }

    // valid (syntactically invalid/multiple ranges are treated as a regular response)
    if (ranges !== -2 && ranges.length === 1) {
      debug('range %j', ranges);

      // Content-Range
      res.statusCode = 206;
      res.setHeader('Content-Range', contentRange('bytes', len, ranges[0]));

      // adjust for requested range
      offset += ranges[0].start;
      len = ranges[0].end - ranges[0].start + 1;
    }
  }

  // clone options
  for (var prop in options) {
    opts[prop] = options[prop];
  }

  // set read options
  opts.start = offset;
  opts.end = Math.max(offset, offset + len - 1);

  // content-length
  res.setHeader('Content-Length', len);

  // HEAD support
  if (req.method === 'HEAD') {
    res.end();
    return
  }

  this.stream(path, opts);
};

/**
 * Transfer file for `path`.
 *
 * @param {String} path
 * @api private
 */
SendStream.prototype.sendFile = function sendFile (path) {
  var i = 0;
  var self = this;

  debug('stat "%s"', path);
  fs__default["default"].stat(path, function onstat (err, stat) {
    if (err && err.code === 'ENOENT' && !extname(path) && path[path.length - 1] !== sep) {
      // not found, check extensions
      return next(err)
    }
    if (err) return self.onStatError(err)
    if (stat.isDirectory()) return self.redirect(path)
    self.emit('file', path, stat);
    self.send(path, stat);
  });

  function next (err) {
    if (self._extensions.length <= i) {
      return err
        ? self.onStatError(err)
        : self.error(404)
    }

    var p = path + '.' + self._extensions[i++];

    debug('stat "%s"', p);
    fs__default["default"].stat(p, function (err, stat) {
      if (err) return next(err)
      if (stat.isDirectory()) return next()
      self.emit('file', p, stat);
      self.send(p, stat);
    });
  }
};

/**
 * Transfer index for `path`.
 *
 * @param {String} path
 * @api private
 */
SendStream.prototype.sendIndex = function sendIndex (path) {
  var i = -1;
  var self = this;

  function next (err) {
    if (++i >= self._index.length) {
      if (err) return self.onStatError(err)
      return self.error(404)
    }

    var p = join(path, self._index[i]);

    debug('stat "%s"', p);
    fs__default["default"].stat(p, function (err, stat) {
      if (err) return next(err)
      if (stat.isDirectory()) return next()
      self.emit('file', p, stat);
      self.send(p, stat);
    });
  }

  next();
};

/**
 * Stream `path` to the response.
 *
 * @param {String} path
 * @param {Object} options
 * @api private
 */

SendStream.prototype.stream = function stream (path, options) {
  // TODO: this is all lame, refactor meeee
  var finished = false;
  var self = this;
  var res = this.res;

  // pipe
  var stream = fs__default["default"].createReadStream(path, options);
  this.emit('stream', stream);
  stream.pipe(res);

  // response finished, done with the fd
  onFinished_1(res, function onfinished () {
    finished = true;
    destroy_1(stream);
  });

  // error handling code-smell
  stream.on('error', function onerror (err) {
    // request already finished
    if (finished) return

    // clean up stream
    finished = true;
    destroy_1(stream);

    // error
    self.onStatError(err);
  });

  // end
  stream.on('end', function onend () {
    self.emit('end');
  });
};

/**
 * Set content-type based on `path`
 * if it hasn't been explicitly set.
 *
 * @param {String} path
 * @api private
 */

SendStream.prototype.type = function type (path) {
  var res = this.res;

  if (res.getHeader('Content-Type')) return

  var type = mime_1$1.lookup(path);

  if (!type) {
    debug('no content-type');
    return
  }

  var charset = mime_1$1.charsets.lookup(type);

  debug('content-type %s', type);
  res.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));
};

/**
 * Set response header fields, most
 * fields may be pre-defined.
 *
 * @param {String} path
 * @param {Object} stat
 * @api private
 */

SendStream.prototype.setHeader = function setHeader (path, stat) {
  var res = this.res;

  this.emit('headers', res, path, stat);

  if (this._acceptRanges && !res.getHeader('Accept-Ranges')) {
    debug('accept ranges');
    res.setHeader('Accept-Ranges', 'bytes');
  }

  if (this._cacheControl && !res.getHeader('Cache-Control')) {
    var cacheControl = 'public, max-age=' + Math.floor(this._maxage / 1000);

    if (this._immutable) {
      cacheControl += ', immutable';
    }

    debug('cache-control %s', cacheControl);
    res.setHeader('Cache-Control', cacheControl);
  }

  if (this._lastModified && !res.getHeader('Last-Modified')) {
    var modified = stat.mtime.toUTCString();
    debug('modified %s', modified);
    res.setHeader('Last-Modified', modified);
  }

  if (this._etag && !res.getHeader('ETag')) {
    var val = etag_1(stat);
    debug('etag %s', val);
    res.setHeader('ETag', val);
  }
};

/**
 * Clear all headers from a response.
 *
 * @param {object} res
 * @private
 */

function clearHeaders (res) {
  var headers = getHeaderNames(res);

  for (var i = 0; i < headers.length; i++) {
    res.removeHeader(headers[i]);
  }
}

/**
 * Collapse all leading slashes into a single slash
 *
 * @param {string} str
 * @private
 */
function collapseLeadingSlashes (str) {
  for (var i = 0; i < str.length; i++) {
    if (str[i] !== '/') {
      break
    }
  }

  return i > 1
    ? '/' + str.substr(i)
    : str
}

/**
 * Determine if path parts contain a dotfile.
 *
 * @api private
 */

function containsDotFile (parts) {
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.length > 1 && part[0] === '.') {
      return true
    }
  }

  return false
}

/**
 * Create a Content-Range header.
 *
 * @param {string} type
 * @param {number} size
 * @param {array} [range]
 */

function contentRange (type, size, range) {
  return type + ' ' + (range ? range.start + '-' + range.end : '*') + '/' + size
}

/**
 * Create a minimal HTML document.
 *
 * @param {string} title
 * @param {string} body
 * @private
 */

function createHtmlDocument (title, body) {
  return '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<title>' + title + '</title>\n' +
    '</head>\n' +
    '<body>\n' +
    '<pre>' + body + '</pre>\n' +
    '</body>\n' +
    '</html>\n'
}

/**
 * decodeURIComponent.
 *
 * Allows V8 to only deoptimize this fn instead of all
 * of send().
 *
 * @param {String} path
 * @api private
 */

function decode$1 (path) {
  try {
    return decodeURIComponent(path)
  } catch (err) {
    return -1
  }
}

/**
 * Get the header names on a respnse.
 *
 * @param {object} res
 * @returns {array[string]}
 * @private
 */

function getHeaderNames (res) {
  return typeof res.getHeaderNames !== 'function'
    ? Object.keys(res._headers || {})
    : res.getHeaderNames()
}

/**
 * Determine if emitter has listeners of a given type.
 *
 * The way to do this check is done three different ways in Node.js >= 0.8
 * so this consolidates them into a minimal set using instance methods.
 *
 * @param {EventEmitter} emitter
 * @param {string} type
 * @returns {boolean}
 * @private
 */

function hasListeners (emitter, type) {
  var count = typeof emitter.listenerCount !== 'function'
    ? emitter.listeners(type).length
    : emitter.listenerCount(type);

  return count > 0
}

/**
 * Determine if the response headers have been sent.
 *
 * @param {object} res
 * @returns {boolean}
 * @private
 */

function headersSent (res) {
  return typeof res.headersSent !== 'boolean'
    ? Boolean(res._header)
    : res.headersSent
}

/**
 * Normalize the index option into an array.
 *
 * @param {boolean|string|array} val
 * @param {string} name
 * @private
 */

function normalizeList (val, name) {
  var list = [].concat(val || []);

  for (var i = 0; i < list.length; i++) {
    if (typeof list[i] !== 'string') {
      throw new TypeError(name + ' must be array of strings or false')
    }
  }

  return list
}

/**
 * Parse an HTTP Date into a number.
 *
 * @param {string} date
 * @private
 */

function parseHttpDate (date) {
  var timestamp = date && Date.parse(date);

  return typeof timestamp === 'number'
    ? timestamp
    : NaN
}

/**
 * Parse a HTTP token list.
 *
 * @param {string} str
 * @private
 */

function parseTokenList (str) {
  var end = 0;
  var list = [];
  var start = 0;

  // gather tokens
  for (var i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20: /*   */
        if (start === end) {
          start = end = i + 1;
        }
        break
      case 0x2c: /* , */
        if (start !== end) {
          list.push(str.substring(start, end));
        }
        start = end = i + 1;
        break
      default:
        end = i + 1;
        break
    }
  }

  // final token
  if (start !== end) {
    list.push(str.substring(start, end));
  }

  return list
}

/**
 * Set an object of headers on a response.
 *
 * @param {object} res
 * @param {object} headers
 * @private
 */

function setHeaders (res, headers) {
  var keys = Object.keys(headers);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    res.setHeader(key, headers[key]);
  }
}
send_1.mime = mime_1;

function getContentType(extWithoutDot) {
    const { mime } = send_1;
    if ("getType" in mime) {
        // 2.0
        // @ts-ignore
        return mime.getType(extWithoutDot);
    }
    // 1.0
    return mime.lookup(extWithoutDot);
}
function getExtension(contentType) {
    const { mime } = send_1;
    if ("getExtension" in mime) {
        // 2.0
        // @ts-ignore
        return mime.getExtension(contentType);
    }
    // 1.0
    return mime.extension(contentType);
}

/**
 * This and related code are adapted from https://github.com/vercel/next.js/blob/48acc479f3befb70de800392315831ed7defa4d8/packages/next/next-server/server/image-optimizer.ts
 * The MIT License (MIT)

 Copyright (c) 2020 Vercel, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
let sharp$1;
const AVIF = "image/avif";
const WEBP = "image/webp";
const PNG = "image/png";
const JPEG = "image/jpeg";
const GIF = "image/gif";
const SVG = "image/svg+xml";
const CACHE_VERSION = 2;
const ANIMATABLE_TYPES = [WEBP, PNG, GIF];
const VECTOR_TYPES = [SVG];
function parseCacheControl(str) {
    const map = new Map();
    if (!str) {
        return map;
    }
    for (const directive of str.split(",")) {
        let [key, value] = directive.trim().split("=");
        key = key.toLowerCase();
        if (value) {
            value = value.toLowerCase();
        }
        map.set(key, value);
    }
    return map;
}
function getMaxAge(str) {
    const minimum = 60;
    const map = parseCacheControl(str);
    if (map) {
        let age = map.get("s-maxage") || map.get("max-age") || "";
        if (age.startsWith('"') && age.endsWith('"')) {
            age = age.slice(1, -1);
        }
        const n = parseInt(age, 10);
        if (!isNaN(n)) {
            return Math.max(n, minimum);
        }
    }
    return minimum;
}
/**
 * If Basepath set, it needs to be removed from URL
 *
 * Not normalised -> error 403
 * url: '<base-path>/assets/images/logo.svg',
 *
 * Normalised -> 200
 * url: '/assets/images/logo.svg',
 */
function normaliseUri(uri, basePath) {
    if (uri.startsWith(basePath)) {
        uri = uri.slice(basePath.length);
    }
    return uri;
}
async function imageOptimizer(basePath, imagesManifest, req, res, parsedUrl, platformClient) {
    var _a, _b, _c, _d, _e;
    const imageConfig = (_a = imagesManifest === null || imagesManifest === void 0 ? void 0 : imagesManifest.images) !== null && _a !== void 0 ? _a : imageConfigDefault;
    const { deviceSizes = [], imageSizes = [], domains = [], formats = ["image/webp"], loader } = imageConfig;
    const sizes = [...deviceSizes, ...imageSizes];
    if (loader !== "default") {
        res.statusCode = 404;
        res.end("default loader not found");
        return { finished: true };
    }
    const { headers } = req;
    const { url, w, q } = parsedUrl.query;
    const mimeType = getSupportedMimeType(formats, headers.accept);
    let href;
    if (!url) {
        res.statusCode = 400;
        res.end('"url" parameter is required');
        return { finished: true };
    }
    else if (Array.isArray(url)) {
        res.statusCode = 400;
        res.end('"url" parameter cannot be an array');
        return { finished: true };
    }
    let isAbsolute;
    if (url.startsWith("/")) {
        // Ensure that Basepath is in the URL, otherwise, a 400 is triggered (same behaviour as Nextjs)
        if (basePath !== "/" && !url.startsWith(basePath)) {
            res.statusCode = 400;
            res.end('"Basepath" set but not added to the URL');
            return { finished: true };
        }
        href = normaliseUri(url, basePath);
        isAbsolute = false;
    }
    else {
        let hrefParsed;
        try {
            hrefParsed = new URL(url);
            href = hrefParsed.toString();
            isAbsolute = true;
        }
        catch (_error) {
            res.statusCode = 400;
            res.end('"url" parameter is invalid');
            return { finished: true };
        }
        if (!["http:", "https:"].includes(hrefParsed.protocol)) {
            res.statusCode = 400;
            res.end('"url" parameter is invalid');
            return { finished: true };
        }
        if (!domains.includes(hrefParsed.hostname)) {
            res.statusCode = 400;
            res.end('"url" parameter is not allowed');
            return { finished: true };
        }
    }
    if (!w) {
        res.statusCode = 400;
        res.end('"w" parameter (width) is required');
        return { finished: true };
    }
    else if (Array.isArray(w)) {
        res.statusCode = 400;
        res.end('"w" parameter (width) cannot be an array');
        return { finished: true };
    }
    if (!q) {
        res.statusCode = 400;
        res.end('"q" parameter (quality) is required');
        return { finished: true };
    }
    else if (Array.isArray(q)) {
        res.statusCode = 400;
        res.end('"q" parameter (quality) cannot be an array');
        return { finished: true };
    }
    const width = parseInt(w, 10);
    if (!width || isNaN(width)) {
        res.statusCode = 400;
        res.end('"w" parameter (width) must be a number greater than 0');
        return { finished: true };
    }
    if (!sizes.includes(width)) {
        res.statusCode = 400;
        res.end(`"w" parameter (width) of ${width} is not allowed`);
        return { finished: true };
    }
    const quality = parseInt(q);
    if (isNaN(quality) || quality < 1 || quality > 100) {
        res.statusCode = 400;
        res.end('"q" parameter (quality) must be a number between 1 and 100');
        return { finished: true };
    }
    const hash = getHash([CACHE_VERSION, href, width, quality, mimeType]);
    const imagesDir = require$$1$2.join("/tmp", "cache", "images"); // Use Lambda tmp directory
    const hashDir = require$$1$2.join(imagesDir, hash);
    const now = Date.now();
    if (fs__namespace.existsSync(hashDir)) {
        const files = await fs.promises.readdir(hashDir);
        for (const file of files) {
            const [prefix, etag, extension] = file.split(".");
            const expireAt = Number(prefix);
            const contentType = getContentType(extension);
            const fsPath = require$$1$2.join(hashDir, file);
            if (now < expireAt) {
                if (!res.getHeader("Cache-Control")) {
                    res.setHeader("Cache-Control", "public, max-age=60");
                }
                if (sendEtagResponse(req, res, etag)) {
                    return { finished: true };
                }
                if (contentType) {
                    res.setHeader("Content-Type", contentType);
                }
                fs.createReadStream(fsPath).pipe(res);
                return { finished: true };
            }
            else {
                await fs.promises.unlink(fsPath);
            }
        }
    }
    let upstreamBuffer;
    let upstreamType;
    let maxAge;
    if (isAbsolute) {
        const upstreamRes = await fetch(href);
        if (!upstreamRes.ok) {
            res.statusCode = upstreamRes.status;
            res.end('"url" parameter is valid but upstream response is invalid');
            return { finished: true };
        }
        res.statusCode = upstreamRes.status;
        upstreamBuffer = Buffer.from(await upstreamRes.arrayBuffer());
        upstreamType = (_b = upstreamRes.headers.get("Content-Type")) !== null && _b !== void 0 ? _b : undefined;
        maxAge = getMaxAge((_c = upstreamRes.headers.get("Cache-Control")) !== null && _c !== void 0 ? _c : undefined);
        if (upstreamRes.headers.get("Cache-Control")) {
            res.setHeader("Cache-Control", upstreamRes.headers.get("Cache-Control"));
        }
    }
    else {
        let objectKey;
        try {
            // note: basepath is already removed by URI normalization above
            if (href.startsWith(`/static`) || href.startsWith(`/_next/static`)) {
                objectKey = `${basePath}${href}`; // static files' URL map to the key prefixed with basepath e.g /static/ -> static
            }
            else {
                objectKey = `${basePath}/public` + href; // public file URLs map from /public.png -> public/public.png
            }
            // Remove leading slash from object key
            if (objectKey.startsWith("/")) {
                objectKey = objectKey.slice(1);
            }
            const response = await platformClient.getObject(objectKey);
            res.statusCode = response.statusCode;
            upstreamBuffer = (_d = response.body) !== null && _d !== void 0 ? _d : Buffer.of();
            upstreamType = (_e = response.contentType) !== null && _e !== void 0 ? _e : undefined;
            maxAge = getMaxAge(response.cacheControl);
            // If object response provides cache control header, use that
            if (response.cacheControl) {
                res.setHeader("Cache-Control", response.cacheControl);
            }
        }
        catch (err) {
            res.statusCode = 500;
            res.end('"url" parameter is valid but upstream response is invalid');
            console.error(`Error processing upstream response due to error for key: ${objectKey}. Stack trace: ` +
                err.stack);
            return { finished: true };
        }
    }
    if (upstreamType) {
        const vector = VECTOR_TYPES.includes(upstreamType);
        const animate = ANIMATABLE_TYPES.includes(upstreamType) && lib$1(upstreamBuffer);
        if (vector || animate) {
            sendResponse(req, res, upstreamType, upstreamBuffer);
            return { finished: true };
        }
    }
    const expireAt = maxAge * 1000 + now;
    let contentType;
    if (mimeType) {
        contentType = mimeType;
    }
    else if ((upstreamType === null || upstreamType === void 0 ? void 0 : upstreamType.startsWith("image/")) && getExtension(upstreamType)) {
        contentType = upstreamType;
    }
    else {
        contentType = JPEG;
    }
    if (!sharp$1) {
        try {
            sharp$1 = require("sharp");
        }
        catch (error) {
            if (error.code === "MODULE_NOT_FOUND") {
                error.message += "\n\nLearn more: https://err.sh/next.js/install-sharp";
                console.error(error.stack);
                sendResponse(req, res, upstreamType, upstreamBuffer);
                return { finished: true };
            }
            throw error;
        }
    }
    try {
        const transformer = sharp$1(upstreamBuffer);
        transformer.rotate(); // auto rotate based on EXIF data
        const { width: metaWidth } = await transformer.metadata();
        if (metaWidth && metaWidth > width) {
            transformer.resize(width);
        }
        if (contentType === AVIF) {
            transformer.avif({ quality });
        }
        else if (contentType === WEBP) {
            transformer.webp({ quality });
        }
        else if (contentType === PNG) {
            transformer.png({ quality });
        }
        else if (contentType === JPEG) {
            transformer.jpeg({ quality });
        }
        const optimizedBuffer = await transformer.toBuffer();
        await fs.promises.mkdir(hashDir, { recursive: true });
        const extension = getExtension(contentType);
        const etag = getHash([optimizedBuffer]);
        const filename = require$$1$2.join(hashDir, `${expireAt}.${etag}.${extension}`);
        await fs.promises.writeFile(filename, optimizedBuffer);
        sendResponse(req, res, contentType, optimizedBuffer);
    }
    catch (error) {
        console.error("Error processing image with sharp, returning upstream image as fallback instead: " +
            error.stack);
        sendResponse(req, res, upstreamType, upstreamBuffer);
    }
    return { finished: true };
}
function sendResponse(req, res, contentType, buffer) {
    const etag = getHash([buffer]);
    if (!res.getHeader("Cache-Control")) {
        res.setHeader("Cache-Control", "public, max-age=60");
    }
    if (sendEtagResponse(req, res, etag)) {
        return;
    }
    if (contentType) {
        res.setHeader("Content-Type", contentType);
    }
    res.end(buffer);
}
function getSupportedMimeType(options, accept = "") {
    const mimeType = lib$2.mediaType(accept, options);
    return accept.includes(mimeType) ? mimeType : "";
}
function getHash(items) {
    const hash = crypto.createHash("sha256");
    for (const item of items) {
        if (typeof item === "number")
            hash.update(String(item));
        else {
            hash.update(item);
        }
    }
    // See https://en.wikipedia.org/wiki/Base64#Filenames
    return hash.digest("base64").replace(/\//g, "-");
}

const blacklistedHeaders = [
    "connection",
    "expect",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "proxy-connection",
    "trailer",
    "upgrade",
    "x-accel-buffering",
    "x-accel-charset",
    "x-accel-limit-rate",
    "x-accel-redirect",
    "x-cache",
    "x-forwarded-proto",
    "x-real-ip"
];
const blacklistedHeaderPrefixes = ["x-amz-cf-", "x-amzn-", "x-edge-"];
function isBlacklistedHeader(name) {
    const lowerCaseName = name.toLowerCase();
    for (const prefix of blacklistedHeaderPrefixes) {
        if (lowerCaseName.startsWith(prefix)) {
            return true;
        }
    }
    return blacklistedHeaders.includes(lowerCaseName);
}
function removeBlacklistedHeaders(headers) {
    for (const header in headers) {
        if (isBlacklistedHeader(header)) {
            delete headers[header];
        }
    }
}

const s3BucketNameFromEventRequest = (request) => {
    var _a;
    const { region, domainName } = ((_a = request.origin) === null || _a === void 0 ? void 0 : _a.s3) || {};
    return !!region && (domainName === null || domainName === void 0 ? void 0 : domainName.includes(region))
        ? domainName === null || domainName === void 0 ? void 0 : domainName.replace(`.s3.${region}.amazonaws.com`, "")
        : domainName === null || domainName === void 0 ? void 0 : domainName.replace(`.s3.amazonaws.com`, "");
};

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics$2 = function(d, b) {
    extendStatics$2 = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
    return extendStatics$2(d, b);
};

function __extends$2(d, b) {
    if (typeof b !== "function" && b !== null)
        throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics$2(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var __assign$2 = function() {
    __assign$2 = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign$2.apply(this, arguments);
};

function __rest$2(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __awaiter$2(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator$2(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

function __values$2(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}

function __read$2(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
}

function __await$2(v) {
    return this instanceof __await$2 ? (this.v = v, this) : new __await$2(v);
}

function __asyncGenerator$2(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await$2 ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

function __asyncValues$2(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values$2 === "function" ? __values$2(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
}

var SelectorType;
(function (SelectorType) {
    SelectorType["ENV"] = "env";
    SelectorType["CONFIG"] = "shared config entry";
})(SelectorType || (SelectorType = {}));
var booleanSelector = function (obj, key, type) {
    if (!(key in obj))
        return undefined;
    if (obj[key] === "true")
        return true;
    if (obj[key] === "false")
        return false;
    throw new Error("Cannot load " + type + " \"" + key + "\". Expected \"true\" or \"false\", got " + obj[key] + ".");
};

var NODE_USE_ARN_REGION_ENV_NAME = "AWS_S3_USE_ARN_REGION";
var NODE_USE_ARN_REGION_INI_NAME = "s3_use_arn_region";
var NODE_USE_ARN_REGION_CONFIG_OPTIONS = {
    environmentVariableSelector: function (env) {
        return booleanSelector(env, NODE_USE_ARN_REGION_ENV_NAME, SelectorType.ENV);
    },
    configFileSelector: function (profile) { return booleanSelector(profile, NODE_USE_ARN_REGION_INI_NAME, SelectorType.CONFIG); },
    default: false,
};

var HttpRequest = (function () {
    function HttpRequest(options) {
        this.method = options.method || "GET";
        this.hostname = options.hostname || "localhost";
        this.port = options.port;
        this.query = options.query || {};
        this.headers = options.headers || {};
        this.body = options.body;
        this.protocol = options.protocol
            ? options.protocol.substr(-1) !== ":"
                ? options.protocol + ":"
                : options.protocol
            : "https:";
        this.path = options.path ? (options.path.charAt(0) !== "/" ? "/" + options.path : options.path) : "/";
    }
    HttpRequest.isInstance = function (request) {
        if (!request)
            return false;
        var req = request;
        return ("method" in req &&
            "protocol" in req &&
            "hostname" in req &&
            "path" in req &&
            typeof req["query"] === "object" &&
            typeof req["headers"] === "object");
    };
    HttpRequest.prototype.clone = function () {
        var cloned = new HttpRequest(__assign$2(__assign$2({}, this), { headers: __assign$2({}, this.headers) }));
        if (cloned.query)
            cloned.query = cloneQuery$1(cloned.query);
        return cloned;
    };
    return HttpRequest;
}());
function cloneQuery$1(query) {
    return Object.keys(query).reduce(function (carry, paramName) {
        var _a;
        var param = query[paramName];
        return __assign$2(__assign$2({}, carry), (_a = {}, _a[paramName] = Array.isArray(param) ? __spreadArray([], __read$2(param)) : param, _a));
    }, {});
}

var HttpResponse = (function () {
    function HttpResponse(options) {
        this.statusCode = options.statusCode;
        this.headers = options.headers || {};
        this.body = options.body;
    }
    HttpResponse.isInstance = function (response) {
        if (!response)
            return false;
        var resp = response;
        return typeof resp.statusCode === "number" && typeof resp.headers === "object";
    };
    return HttpResponse;
}());

var validate$2 = function (str) {
    return typeof str === "string" && str.indexOf("arn:") === 0 && str.split(":").length >= 6;
};
var parse = function (arn) {
    var segments = arn.split(":");
    if (segments.length < 6 || segments[0] !== "arn")
        throw new Error("Malformed ARN");
    var _a = __read$2(segments), partition = _a[1], service = _a[2], region = _a[3], accountId = _a[4], resource = _a.slice(5);
    return {
        partition: partition,
        service: service,
        region: region,
        accountId: accountId,
        resource: resource.join(":"),
    };
};

var DOMAIN_PATTERN = /^[a-z0-9][a-z0-9\.\-]{1,61}[a-z0-9]$/;
var IP_ADDRESS_PATTERN = /(\d+\.){3}\d+/;
var DOTS_PATTERN = /\.\./;
var DOT_PATTERN = /\./;
var S3_HOSTNAME_PATTERN = /^(.+\.)?s3(-fips)?(\.dualstack)?[.-]([a-z0-9-]+)\./;
var S3_US_EAST_1_ALTNAME_PATTERN = /^s3(-external-1)?\.amazonaws\.com$/;
var AWS_PARTITION_SUFFIX = "amazonaws.com";
var isBucketNameOptions = function (options) { return typeof options.bucketName === "string"; };
var isDnsCompatibleBucketName = function (bucketName) {
    return DOMAIN_PATTERN.test(bucketName) && !IP_ADDRESS_PATTERN.test(bucketName) && !DOTS_PATTERN.test(bucketName);
};
var getRegionalSuffix = function (hostname) {
    var parts = hostname.match(S3_HOSTNAME_PATTERN);
    return [parts[4], hostname.replace(new RegExp("^" + parts[0]), "")];
};
var getSuffix = function (hostname) {
    return S3_US_EAST_1_ALTNAME_PATTERN.test(hostname) ? ["us-east-1", AWS_PARTITION_SUFFIX] : getRegionalSuffix(hostname);
};
var getSuffixForArnEndpoint = function (hostname) {
    return S3_US_EAST_1_ALTNAME_PATTERN.test(hostname)
        ? [hostname.replace("." + AWS_PARTITION_SUFFIX, ""), AWS_PARTITION_SUFFIX]
        : getRegionalSuffix(hostname);
};
var validateArnEndpointOptions = function (options) {
    if (options.pathStyleEndpoint) {
        throw new Error("Path-style S3 endpoint is not supported when bucket is an ARN");
    }
    if (options.accelerateEndpoint) {
        throw new Error("Accelerate endpoint is not supported when bucket is an ARN");
    }
    if (!options.tlsCompatible) {
        throw new Error("HTTPS is required when bucket is an ARN");
    }
};
var validateService = function (service) {
    if (service !== "s3" && service !== "s3-outposts" && service !== "s3-object-lambda") {
        throw new Error("Expect 's3' or 's3-outposts' or 's3-object-lambda' in ARN service component");
    }
};
var validateS3Service = function (service) {
    if (service !== "s3") {
        throw new Error("Expect 's3' in Accesspoint ARN service component");
    }
};
var validateOutpostService = function (service) {
    if (service !== "s3-outposts") {
        throw new Error("Expect 's3-posts' in Outpost ARN service component");
    }
};
var validatePartition = function (partition, options) {
    if (partition !== options.clientPartition) {
        throw new Error("Partition in ARN is incompatible, got \"" + partition + "\" but expected \"" + options.clientPartition + "\"");
    }
};
var validateRegion = function (region, options) {
    if (region === "") {
        throw new Error("ARN region is empty");
    }
    if (options.useFipsEndpoint) {
        if (!options.allowFipsRegion) {
            throw new Error("FIPS region is not supported");
        }
        else if (!isEqualRegions(region, options.clientRegion)) {
            throw new Error("Client FIPS region " + options.clientRegion + " doesn't match region " + region + " in ARN");
        }
    }
    if (!options.useArnRegion &&
        !isEqualRegions(region, options.clientRegion || "") &&
        !isEqualRegions(region, options.clientSigningRegion || "")) {
        throw new Error("Region in ARN is incompatible, got " + region + " but expected " + options.clientRegion);
    }
};
var validateRegionalClient = function (region) {
    if (["s3-external-1", "aws-global"].includes(region)) {
        throw new Error("Client region " + region + " is not regional");
    }
};
var isEqualRegions = function (regionA, regionB) { return regionA === regionB; };
var validateAccountId = function (accountId) {
    if (!/[0-9]{12}/.exec(accountId)) {
        throw new Error("Access point ARN accountID does not match regex '[0-9]{12}'");
    }
};
var validateDNSHostLabel = function (label, options) {
    if (options === void 0) { options = { tlsCompatible: true }; }
    if (label.length >= 64 ||
        !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(label) ||
        /(\d+\.){3}\d+/.test(label) ||
        /[.-]{2}/.test(label) ||
        ((options === null || options === void 0 ? void 0 : options.tlsCompatible) && DOT_PATTERN.test(label))) {
        throw new Error("Invalid DNS label " + label);
    }
};
var validateCustomEndpoint = function (options) {
    if (options.isCustomEndpoint) {
        if (options.dualstackEndpoint)
            throw new Error("Dualstack endpoint is not supported with custom endpoint");
        if (options.accelerateEndpoint)
            throw new Error("Accelerate endpoint is not supported with custom endpoint");
    }
};
var getArnResources = function (resource) {
    var delimiter = resource.includes(":") ? ":" : "/";
    var _a = __read$2(resource.split(delimiter)), resourceType = _a[0], rest = _a.slice(1);
    if (resourceType === "accesspoint") {
        if (rest.length !== 1 || rest[0] === "") {
            throw new Error("Access Point ARN should have one resource accesspoint" + delimiter + "{accesspointname}");
        }
        return { accesspointName: rest[0] };
    }
    else if (resourceType === "outpost") {
        if (!rest[0] || rest[1] !== "accesspoint" || !rest[2] || rest.length !== 3) {
            throw new Error("Outpost ARN should have resource outpost" + delimiter + "{outpostId}" + delimiter + "accesspoint" + delimiter + "{accesspointName}");
        }
        var _b = __read$2(rest, 3), outpostId = _b[0]; _b[1]; var accesspointName = _b[2];
        return { outpostId: outpostId, accesspointName: accesspointName };
    }
    else {
        throw new Error("ARN resource should begin with 'accesspoint" + delimiter + "' or 'outpost" + delimiter + "'");
    }
};
var validateNoDualstack = function (dualstackEndpoint) {
    if (dualstackEndpoint)
        throw new Error("Dualstack endpoint is not supported with Outpost or Multi-region Access Point ARN.");
};
var validateNoFIPS = function (useFipsEndpoint) {
    if (useFipsEndpoint)
        throw new Error("FIPS region is not supported with Outpost.");
};
var validateMrapAlias = function (name) {
    try {
        name.split(".").forEach(function (label) {
            validateDNSHostLabel(label);
        });
    }
    catch (e) {
        throw new Error("\"" + name + "\" is not a DNS compatible name.");
    }
};

var bucketHostname = function (options) {
    validateCustomEndpoint(options);
    return isBucketNameOptions(options)
        ?
            getEndpointFromBucketName(options)
        :
            getEndpointFromArn(options);
};
var getEndpointFromBucketName = function (_a) {
    var _b = _a.accelerateEndpoint, accelerateEndpoint = _b === void 0 ? false : _b, region = _a.clientRegion, baseHostname = _a.baseHostname, bucketName = _a.bucketName, _c = _a.dualstackEndpoint, dualstackEndpoint = _c === void 0 ? false : _c; _a.fipsEndpoint; var _e = _a.pathStyleEndpoint, pathStyleEndpoint = _e === void 0 ? false : _e, _f = _a.tlsCompatible, tlsCompatible = _f === void 0 ? true : _f, _g = _a.isCustomEndpoint, isCustomEndpoint = _g === void 0 ? false : _g;
    var _h = __read$2(isCustomEndpoint ? [region, baseHostname] : getSuffix(baseHostname), 2), clientRegion = _h[0], hostnameSuffix = _h[1];
    if (pathStyleEndpoint || !isDnsCompatibleBucketName(bucketName) || (tlsCompatible && DOT_PATTERN.test(bucketName))) {
        return {
            bucketEndpoint: false,
            hostname: dualstackEndpoint ? "s3.dualstack." + clientRegion + "." + hostnameSuffix : baseHostname,
        };
    }
    if (accelerateEndpoint) {
        baseHostname = "s3-accelerate" + (dualstackEndpoint ? ".dualstack" : "") + "." + hostnameSuffix;
    }
    else if (dualstackEndpoint) {
        baseHostname = "s3.dualstack." + clientRegion + "." + hostnameSuffix;
    }
    return {
        bucketEndpoint: true,
        hostname: bucketName + "." + baseHostname,
    };
};
var getEndpointFromArn = function (options) {
    var isCustomEndpoint = options.isCustomEndpoint, baseHostname = options.baseHostname, clientRegion = options.clientRegion;
    var hostnameSuffix = isCustomEndpoint ? baseHostname : getSuffixForArnEndpoint(baseHostname)[1];
    var pathStyleEndpoint = options.pathStyleEndpoint, _a = options.accelerateEndpoint, accelerateEndpoint = _a === void 0 ? false : _a; options.fipsEndpoint; var _c = options.tlsCompatible, tlsCompatible = _c === void 0 ? true : _c, bucketName = options.bucketName, _d = options.clientPartition, clientPartition = _d === void 0 ? "aws" : _d;
    validateArnEndpointOptions({ pathStyleEndpoint: pathStyleEndpoint, accelerateEndpoint: accelerateEndpoint, tlsCompatible: tlsCompatible });
    var service = bucketName.service, partition = bucketName.partition, accountId = bucketName.accountId, region = bucketName.region, resource = bucketName.resource;
    validateService(service);
    validatePartition(partition, { clientPartition: clientPartition });
    validateAccountId(accountId);
    var _e = getArnResources(resource), accesspointName = _e.accesspointName, outpostId = _e.outpostId;
    if (service === "s3-object-lambda") {
        return getEndpointFromObjectLambdaArn(__assign$2(__assign$2({}, options), { tlsCompatible: tlsCompatible, bucketName: bucketName, accesspointName: accesspointName, hostnameSuffix: hostnameSuffix }));
    }
    if (region === "") {
        return getEndpointFromMRAPArn(__assign$2(__assign$2({}, options), { clientRegion: clientRegion, mrapAlias: accesspointName, hostnameSuffix: hostnameSuffix }));
    }
    if (outpostId) {
        return getEndpointFromOutpostArn(__assign$2(__assign$2({}, options), { clientRegion: clientRegion, outpostId: outpostId, accesspointName: accesspointName, hostnameSuffix: hostnameSuffix }));
    }
    return getEndpointFromAccessPointArn(__assign$2(__assign$2({}, options), { clientRegion: clientRegion, accesspointName: accesspointName, hostnameSuffix: hostnameSuffix }));
};
var getEndpointFromObjectLambdaArn = function (_a) {
    var _b = _a.dualstackEndpoint, dualstackEndpoint = _b === void 0 ? false : _b, _c = _a.fipsEndpoint, fipsEndpoint = _c === void 0 ? false : _c, _d = _a.tlsCompatible, tlsCompatible = _d === void 0 ? true : _d, useArnRegion = _a.useArnRegion, clientRegion = _a.clientRegion, _e = _a.clientSigningRegion, clientSigningRegion = _e === void 0 ? clientRegion : _e, accesspointName = _a.accesspointName, bucketName = _a.bucketName, hostnameSuffix = _a.hostnameSuffix;
    var accountId = bucketName.accountId, region = bucketName.region, service = bucketName.service;
    validateRegionalClient(clientRegion);
    validateRegion(region, {
        useArnRegion: useArnRegion,
        clientRegion: clientRegion,
        clientSigningRegion: clientSigningRegion,
        allowFipsRegion: true,
        useFipsEndpoint: fipsEndpoint,
    });
    validateNoDualstack(dualstackEndpoint);
    var DNSHostLabel = accesspointName + "-" + accountId;
    validateDNSHostLabel(DNSHostLabel, { tlsCompatible: tlsCompatible });
    var endpointRegion = useArnRegion ? region : clientRegion;
    var signingRegion = useArnRegion ? region : clientSigningRegion;
    return {
        bucketEndpoint: true,
        hostname: DNSHostLabel + "." + service + (fipsEndpoint ? "-fips" : "") + "." + endpointRegion + "." + hostnameSuffix,
        signingRegion: signingRegion,
        signingService: service,
    };
};
var getEndpointFromMRAPArn = function (_a) {
    var disableMultiregionAccessPoints = _a.disableMultiregionAccessPoints, _b = _a.dualstackEndpoint, dualstackEndpoint = _b === void 0 ? false : _b, isCustomEndpoint = _a.isCustomEndpoint, mrapAlias = _a.mrapAlias, hostnameSuffix = _a.hostnameSuffix;
    if (disableMultiregionAccessPoints === true) {
        throw new Error("SDK is attempting to use a MRAP ARN. Please enable to feature.");
    }
    validateMrapAlias(mrapAlias);
    validateNoDualstack(dualstackEndpoint);
    return {
        bucketEndpoint: true,
        hostname: "" + mrapAlias + (isCustomEndpoint ? "" : ".accesspoint.s3-global") + "." + hostnameSuffix,
        signingRegion: "*",
    };
};
var getEndpointFromOutpostArn = function (_a) {
    var useArnRegion = _a.useArnRegion, clientRegion = _a.clientRegion, _b = _a.clientSigningRegion, clientSigningRegion = _b === void 0 ? clientRegion : _b, bucketName = _a.bucketName, outpostId = _a.outpostId, _c = _a.dualstackEndpoint, dualstackEndpoint = _c === void 0 ? false : _c, _d = _a.fipsEndpoint, fipsEndpoint = _d === void 0 ? false : _d, _e = _a.tlsCompatible, tlsCompatible = _e === void 0 ? true : _e, accesspointName = _a.accesspointName, isCustomEndpoint = _a.isCustomEndpoint, hostnameSuffix = _a.hostnameSuffix;
    validateRegionalClient(clientRegion);
    validateRegion(bucketName.region, { useArnRegion: useArnRegion, clientRegion: clientRegion, clientSigningRegion: clientSigningRegion, useFipsEndpoint: fipsEndpoint });
    var DNSHostLabel = accesspointName + "-" + bucketName.accountId;
    validateDNSHostLabel(DNSHostLabel, { tlsCompatible: tlsCompatible });
    var endpointRegion = useArnRegion ? bucketName.region : clientRegion;
    var signingRegion = useArnRegion ? bucketName.region : clientSigningRegion;
    validateOutpostService(bucketName.service);
    validateDNSHostLabel(outpostId, { tlsCompatible: tlsCompatible });
    validateNoDualstack(dualstackEndpoint);
    validateNoFIPS(fipsEndpoint);
    var hostnamePrefix = DNSHostLabel + "." + outpostId;
    return {
        bucketEndpoint: true,
        hostname: "" + hostnamePrefix + (isCustomEndpoint ? "" : ".s3-outposts." + endpointRegion) + "." + hostnameSuffix,
        signingRegion: signingRegion,
        signingService: "s3-outposts",
    };
};
var getEndpointFromAccessPointArn = function (_a) {
    var useArnRegion = _a.useArnRegion, clientRegion = _a.clientRegion, _b = _a.clientSigningRegion, clientSigningRegion = _b === void 0 ? clientRegion : _b, bucketName = _a.bucketName, _c = _a.dualstackEndpoint, dualstackEndpoint = _c === void 0 ? false : _c, _d = _a.fipsEndpoint, fipsEndpoint = _d === void 0 ? false : _d, _e = _a.tlsCompatible, tlsCompatible = _e === void 0 ? true : _e, accesspointName = _a.accesspointName, isCustomEndpoint = _a.isCustomEndpoint, hostnameSuffix = _a.hostnameSuffix;
    validateRegionalClient(clientRegion);
    validateRegion(bucketName.region, {
        useArnRegion: useArnRegion,
        clientRegion: clientRegion,
        clientSigningRegion: clientSigningRegion,
        allowFipsRegion: true,
        useFipsEndpoint: fipsEndpoint,
    });
    var hostnamePrefix = accesspointName + "-" + bucketName.accountId;
    validateDNSHostLabel(hostnamePrefix, { tlsCompatible: tlsCompatible });
    var endpointRegion = useArnRegion ? bucketName.region : clientRegion;
    var signingRegion = useArnRegion ? bucketName.region : clientSigningRegion;
    validateS3Service(bucketName.service);
    return {
        bucketEndpoint: true,
        hostname: "" + hostnamePrefix + (isCustomEndpoint
            ? ""
            : ".s3-accesspoint" + (fipsEndpoint ? "-fips" : "") + (dualstackEndpoint ? ".dualstack" : "") + "." + endpointRegion) + "." + hostnameSuffix,
        signingRegion: signingRegion,
    };
};

var bucketEndpointMiddleware = function (options) {
    return function (next, context) {
        return function (args) { return __awaiter$2(void 0, void 0, void 0, function () {
            var bucketName, replaceBucketInPath, request, bucketArn, clientRegion, useDualstackEndpoint, useFipsEndpoint, _a, partition, _b, signingRegion, useArnRegion, _c, hostname, bucketEndpoint, modifiedSigningRegion, signingService, _d, clientRegion, dualstackEndpoint, fipsEndpoint, _e, hostname, bucketEndpoint;
            var _f;
            return __generator$2(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        bucketName = args.input.Bucket;
                        replaceBucketInPath = options.bucketEndpoint;
                        request = args.request;
                        if (!HttpRequest.isInstance(request)) return [3, 13];
                        if (!options.bucketEndpoint) return [3, 1];
                        request.hostname = bucketName;
                        return [3, 12];
                    case 1:
                        if (!validate$2(bucketName)) return [3, 8];
                        bucketArn = parse(bucketName);
                        return [4, options.region()];
                    case 2:
                        clientRegion = _g.sent();
                        return [4, options.useDualstackEndpoint()];
                    case 3:
                        useDualstackEndpoint = _g.sent();
                        return [4, options.useFipsEndpoint()];
                    case 4:
                        useFipsEndpoint = _g.sent();
                        return [4, options.regionInfoProvider(clientRegion, { useDualstackEndpoint: useDualstackEndpoint, useFipsEndpoint: useFipsEndpoint })];
                    case 5:
                        _a = (_g.sent()) || {}, partition = _a.partition, _b = _a.signingRegion, signingRegion = _b === void 0 ? clientRegion : _b;
                        return [4, options.useArnRegion()];
                    case 6:
                        useArnRegion = _g.sent();
                        _d = bucketHostname;
                        _f = {
                            bucketName: bucketArn,
                            baseHostname: request.hostname,
                            accelerateEndpoint: options.useAccelerateEndpoint,
                            dualstackEndpoint: useDualstackEndpoint,
                            fipsEndpoint: useFipsEndpoint,
                            pathStyleEndpoint: options.forcePathStyle,
                            tlsCompatible: request.protocol === "https:",
                            useArnRegion: useArnRegion,
                            clientPartition: partition,
                            clientSigningRegion: signingRegion,
                            clientRegion: clientRegion,
                            isCustomEndpoint: options.isCustomEndpoint
                        };
                        return [4, options.disableMultiregionAccessPoints()];
                    case 7:
                        _c = _d.apply(void 0, [(_f.disableMultiregionAccessPoints = _g.sent(),
                                _f)]), hostname = _c.hostname, bucketEndpoint = _c.bucketEndpoint, modifiedSigningRegion = _c.signingRegion, signingService = _c.signingService;
                        if (modifiedSigningRegion && modifiedSigningRegion !== signingRegion) {
                            context["signing_region"] = modifiedSigningRegion;
                        }
                        if (signingService && signingService !== "s3") {
                            context["signing_service"] = signingService;
                        }
                        request.hostname = hostname;
                        replaceBucketInPath = bucketEndpoint;
                        return [3, 12];
                    case 8: return [4, options.region()];
                    case 9:
                        clientRegion = _g.sent();
                        return [4, options.useDualstackEndpoint()];
                    case 10:
                        dualstackEndpoint = _g.sent();
                        return [4, options.useFipsEndpoint()];
                    case 11:
                        fipsEndpoint = _g.sent();
                        _e = bucketHostname({
                            bucketName: bucketName,
                            clientRegion: clientRegion,
                            baseHostname: request.hostname,
                            accelerateEndpoint: options.useAccelerateEndpoint,
                            dualstackEndpoint: dualstackEndpoint,
                            fipsEndpoint: fipsEndpoint,
                            pathStyleEndpoint: options.forcePathStyle,
                            tlsCompatible: request.protocol === "https:",
                            isCustomEndpoint: options.isCustomEndpoint,
                        }), hostname = _e.hostname, bucketEndpoint = _e.bucketEndpoint;
                        request.hostname = hostname;
                        replaceBucketInPath = bucketEndpoint;
                        _g.label = 12;
                    case 12:
                        if (replaceBucketInPath) {
                            request.path = request.path.replace(/^(\/)?[^\/]+/, "");
                            if (request.path === "") {
                                request.path = "/";
                            }
                        }
                        _g.label = 13;
                    case 13: return [2, next(__assign$2(__assign$2({}, args), { request: request }))];
                }
            });
        }); };
    };
};
var bucketEndpointMiddlewareOptions = {
    tags: ["BUCKET_ENDPOINT"],
    name: "bucketEndpointMiddleware",
    relation: "before",
    toMiddleware: "hostHeaderMiddleware",
    override: true,
};
var getBucketEndpointPlugin = function (options) { return ({
    applyToStack: function (clientStack) {
        clientStack.addRelativeTo(bucketEndpointMiddleware(options), bucketEndpointMiddlewareOptions);
    },
}); };

function resolveBucketEndpointConfig(input) {
    var _a = input.bucketEndpoint, bucketEndpoint = _a === void 0 ? false : _a, _b = input.forcePathStyle, forcePathStyle = _b === void 0 ? false : _b, _c = input.useAccelerateEndpoint, useAccelerateEndpoint = _c === void 0 ? false : _c, _d = input.useArnRegion, useArnRegion = _d === void 0 ? false : _d, _e = input.disableMultiregionAccessPoints, disableMultiregionAccessPoints = _e === void 0 ? false : _e;
    return __assign$2(__assign$2({}, input), { bucketEndpoint: bucketEndpoint, forcePathStyle: forcePathStyle, useAccelerateEndpoint: useAccelerateEndpoint, useArnRegion: typeof useArnRegion === "function" ? useArnRegion : function () { return Promise.resolve(useArnRegion); }, disableMultiregionAccessPoints: typeof disableMultiregionAccessPoints === "function"
            ? disableMultiregionAccessPoints
            : function () { return Promise.resolve(disableMultiregionAccessPoints); } });
}

var deserializerMiddleware = function (options, deserializer) {
    return function (next, context) {
        return function (args) { return __awaiter$2(void 0, void 0, void 0, function () {
            var response, parsed, error_1;
            return __generator$2(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, next(args)];
                    case 1:
                        response = (_a.sent()).response;
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4, deserializer(response, options)];
                    case 3:
                        parsed = _a.sent();
                        return [2, {
                                response: response,
                                output: parsed,
                            }];
                    case 4:
                        error_1 = _a.sent();
                        throw Object.assign(error_1, { $response: response });
                    case 5: return [2];
                }
            });
        }); };
    };
};

var serializerMiddleware = function (options, serializer) {
    return function (next, context) {
        return function (args) { return __awaiter$2(void 0, void 0, void 0, function () {
            var request;
            return __generator$2(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, serializer(args.input, options)];
                    case 1:
                        request = _a.sent();
                        return [2, next(__assign$2(__assign$2({}, args), { request: request }))];
                }
            });
        }); };
    };
};

var deserializerMiddlewareOption = {
    name: "deserializerMiddleware",
    step: "deserialize",
    tags: ["DESERIALIZER"],
    override: true,
};
var serializerMiddlewareOption = {
    name: "serializerMiddleware",
    step: "serialize",
    tags: ["SERIALIZER"],
    override: true,
};
function getSerdePlugin(config, serializer, deserializer) {
    return {
        applyToStack: function (commandStack) {
            commandStack.add(deserializerMiddleware(config, deserializer), deserializerMiddlewareOption);
            commandStack.add(serializerMiddleware(config, serializer), serializerMiddlewareOption);
        },
    };
}

var constructStack = function () {
    var absoluteEntries = [];
    var relativeEntries = [];
    var entriesNameSet = new Set();
    var sort = function (entries) {
        return entries.sort(function (a, b) {
            return stepWeights[b.step] - stepWeights[a.step] ||
                priorityWeights[b.priority || "normal"] - priorityWeights[a.priority || "normal"];
        });
    };
    var removeByName = function (toRemove) {
        var isRemoved = false;
        var filterCb = function (entry) {
            if (entry.name && entry.name === toRemove) {
                isRemoved = true;
                entriesNameSet.delete(toRemove);
                return false;
            }
            return true;
        };
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
    };
    var removeByReference = function (toRemove) {
        var isRemoved = false;
        var filterCb = function (entry) {
            if (entry.middleware === toRemove) {
                isRemoved = true;
                if (entry.name)
                    entriesNameSet.delete(entry.name);
                return false;
            }
            return true;
        };
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
    };
    var cloneTo = function (toStack) {
        absoluteEntries.forEach(function (entry) {
            toStack.add(entry.middleware, __assign$2({}, entry));
        });
        relativeEntries.forEach(function (entry) {
            toStack.addRelativeTo(entry.middleware, __assign$2({}, entry));
        });
        return toStack;
    };
    var expandRelativeMiddlewareList = function (from) {
        var expandedMiddlewareList = [];
        from.before.forEach(function (entry) {
            if (entry.before.length === 0 && entry.after.length === 0) {
                expandedMiddlewareList.push(entry);
            }
            else {
                expandedMiddlewareList.push.apply(expandedMiddlewareList, __spreadArray([], __read$2(expandRelativeMiddlewareList(entry))));
            }
        });
        expandedMiddlewareList.push(from);
        from.after.reverse().forEach(function (entry) {
            if (entry.before.length === 0 && entry.after.length === 0) {
                expandedMiddlewareList.push(entry);
            }
            else {
                expandedMiddlewareList.push.apply(expandedMiddlewareList, __spreadArray([], __read$2(expandRelativeMiddlewareList(entry))));
            }
        });
        return expandedMiddlewareList;
    };
    var getMiddlewareList = function () {
        var normalizedAbsoluteEntries = [];
        var normalizedRelativeEntries = [];
        var normalizedEntriesNameMap = {};
        absoluteEntries.forEach(function (entry) {
            var normalizedEntry = __assign$2(__assign$2({}, entry), { before: [], after: [] });
            if (normalizedEntry.name)
                normalizedEntriesNameMap[normalizedEntry.name] = normalizedEntry;
            normalizedAbsoluteEntries.push(normalizedEntry);
        });
        relativeEntries.forEach(function (entry) {
            var normalizedEntry = __assign$2(__assign$2({}, entry), { before: [], after: [] });
            if (normalizedEntry.name)
                normalizedEntriesNameMap[normalizedEntry.name] = normalizedEntry;
            normalizedRelativeEntries.push(normalizedEntry);
        });
        normalizedRelativeEntries.forEach(function (entry) {
            if (entry.toMiddleware) {
                var toMiddleware = normalizedEntriesNameMap[entry.toMiddleware];
                if (toMiddleware === undefined) {
                    throw new Error(entry.toMiddleware + " is not found when adding " + (entry.name || "anonymous") + " middleware " + entry.relation + " " + entry.toMiddleware);
                }
                if (entry.relation === "after") {
                    toMiddleware.after.push(entry);
                }
                if (entry.relation === "before") {
                    toMiddleware.before.push(entry);
                }
            }
        });
        var mainChain = sort(normalizedAbsoluteEntries)
            .map(expandRelativeMiddlewareList)
            .reduce(function (wholeList, expendedMiddlewareList) {
            wholeList.push.apply(wholeList, __spreadArray([], __read$2(expendedMiddlewareList)));
            return wholeList;
        }, []);
        return mainChain.map(function (entry) { return entry.middleware; });
    };
    var stack = {
        add: function (middleware, options) {
            if (options === void 0) { options = {}; }
            var name = options.name, override = options.override;
            var entry = __assign$2({ step: "initialize", priority: "normal", middleware: middleware }, options);
            if (name) {
                if (entriesNameSet.has(name)) {
                    if (!override)
                        throw new Error("Duplicate middleware name '" + name + "'");
                    var toOverrideIndex = absoluteEntries.findIndex(function (entry) { return entry.name === name; });
                    var toOverride = absoluteEntries[toOverrideIndex];
                    if (toOverride.step !== entry.step || toOverride.priority !== entry.priority) {
                        throw new Error("\"" + name + "\" middleware with " + toOverride.priority + " priority in " + toOverride.step + " step cannot be " +
                            ("overridden by same-name middleware with " + entry.priority + " priority in " + entry.step + " step."));
                    }
                    absoluteEntries.splice(toOverrideIndex, 1);
                }
                entriesNameSet.add(name);
            }
            absoluteEntries.push(entry);
        },
        addRelativeTo: function (middleware, options) {
            var name = options.name, override = options.override;
            var entry = __assign$2({ middleware: middleware }, options);
            if (name) {
                if (entriesNameSet.has(name)) {
                    if (!override)
                        throw new Error("Duplicate middleware name '" + name + "'");
                    var toOverrideIndex = relativeEntries.findIndex(function (entry) { return entry.name === name; });
                    var toOverride = relativeEntries[toOverrideIndex];
                    if (toOverride.toMiddleware !== entry.toMiddleware || toOverride.relation !== entry.relation) {
                        throw new Error("\"" + name + "\" middleware " + toOverride.relation + " \"" + toOverride.toMiddleware + "\" middleware cannot be overridden " +
                            ("by same-name middleware " + entry.relation + " \"" + entry.toMiddleware + "\" middleware."));
                    }
                    relativeEntries.splice(toOverrideIndex, 1);
                }
                entriesNameSet.add(name);
            }
            relativeEntries.push(entry);
        },
        clone: function () { return cloneTo(constructStack()); },
        use: function (plugin) {
            plugin.applyToStack(stack);
        },
        remove: function (toRemove) {
            if (typeof toRemove === "string")
                return removeByName(toRemove);
            else
                return removeByReference(toRemove);
        },
        removeByTag: function (toRemove) {
            var isRemoved = false;
            var filterCb = function (entry) {
                var tags = entry.tags, name = entry.name;
                if (tags && tags.includes(toRemove)) {
                    if (name)
                        entriesNameSet.delete(name);
                    isRemoved = true;
                    return false;
                }
                return true;
            };
            absoluteEntries = absoluteEntries.filter(filterCb);
            relativeEntries = relativeEntries.filter(filterCb);
            return isRemoved;
        },
        concat: function (from) {
            var cloned = cloneTo(constructStack());
            cloned.use(from);
            return cloned;
        },
        applyToStack: cloneTo,
        resolve: function (handler, context) {
            var e_1, _a;
            try {
                for (var _b = __values$2(getMiddlewareList().reverse()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var middleware = _c.value;
                    handler = middleware(handler, context);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return handler;
        },
    };
    return stack;
};
var stepWeights = {
    initialize: 5,
    serialize: 4,
    build: 3,
    finalizeRequest: 2,
    deserialize: 1,
};
var priorityWeights = {
    high: 3,
    normal: 2,
    low: 1,
};

var Client = (function () {
    function Client(config) {
        this.middlewareStack = constructStack();
        this.config = config;
    }
    Client.prototype.send = function (command, optionsOrCb, cb) {
        var options = typeof optionsOrCb !== "function" ? optionsOrCb : undefined;
        var callback = typeof optionsOrCb === "function" ? optionsOrCb : cb;
        var handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
        if (callback) {
            handler(command)
                .then(function (result) { return callback(null, result.output); }, function (err) { return callback(err); })
                .catch(function () { });
        }
        else {
            return handler(command).then(function (result) { return result.output; });
        }
    };
    Client.prototype.destroy = function () {
        if (this.config.requestHandler.destroy)
            this.config.requestHandler.destroy();
    };
    return Client;
}());

var Command = (function () {
    function Command() {
        this.middlewareStack = constructStack();
    }
    return Command;
}());

var SENSITIVE_STRING = "***SensitiveInformation***";

var parseBoolean = function (value) {
    switch (value) {
        case "true":
            return true;
        case "false":
            return false;
        default:
            throw new Error("Unable to parse boolean value \"" + value + "\"");
    }
};
var expectNumber = function (value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value === "number") {
        return value;
    }
    throw new TypeError("Expected number, got " + typeof value);
};
var MAX_FLOAT = Math.ceil(Math.pow(2, 127) * (2 - Math.pow(2, -23)));
var expectFloat32 = function (value) {
    var expected = expectNumber(value);
    if (expected !== undefined && !Number.isNaN(expected) && expected !== Infinity && expected !== -Infinity) {
        if (Math.abs(expected) > MAX_FLOAT) {
            throw new TypeError("Expected 32-bit float, got " + value);
        }
    }
    return expected;
};
var expectLong = function (value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (Number.isInteger(value) && !Number.isNaN(value)) {
        return value;
    }
    throw new TypeError("Expected integer, got " + typeof value);
};
var expectInt32 = function (value) { return expectSizedInt(value, 32); };
var expectShort = function (value) { return expectSizedInt(value, 16); };
var expectByte = function (value) { return expectSizedInt(value, 8); };
var expectSizedInt = function (value, size) {
    var expected = expectLong(value);
    if (expected !== undefined && castInt(expected, size) !== expected) {
        throw new TypeError("Expected " + size + "-bit integer, got " + value);
    }
    return expected;
};
var castInt = function (value, size) {
    switch (size) {
        case 32:
            return Int32Array.of(value)[0];
        case 16:
            return Int16Array.of(value)[0];
        case 8:
            return Int8Array.of(value)[0];
    }
};
var expectNonNull = function (value, location) {
    if (value === null || value === undefined) {
        if (location) {
            throw new TypeError("Expected a non-null value for " + location);
        }
        throw new TypeError("Expected a non-null value");
    }
    return value;
};
var expectObject = function (value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    throw new TypeError("Expected object, got " + typeof value);
};
var expectString = function (value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value === "string") {
        return value;
    }
    throw new TypeError("Expected string, got " + typeof value);
};
var strictParseFloat32 = function (value) {
    if (typeof value == "string") {
        return expectFloat32(parseNumber(value));
    }
    return expectFloat32(value);
};
var NUMBER_REGEX = /(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|(-?Infinity)|(NaN)/g;
var parseNumber = function (value) {
    var matches = value.match(NUMBER_REGEX);
    if (matches === null || matches[0].length !== value.length) {
        throw new TypeError("Expected real number, got implicit NaN");
    }
    return parseFloat(value);
};
var strictParseLong = function (value) {
    if (typeof value === "string") {
        return expectLong(parseNumber(value));
    }
    return expectLong(value);
};
var strictParseInt32 = function (value) {
    if (typeof value === "string") {
        return expectInt32(parseNumber(value));
    }
    return expectInt32(value);
};
var strictParseShort = function (value) {
    if (typeof value === "string") {
        return expectShort(parseNumber(value));
    }
    return expectShort(value);
};
var strictParseByte = function (value) {
    if (typeof value === "string") {
        return expectByte(parseNumber(value));
    }
    return expectByte(value);
};

var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateToUtcString(date) {
    var year = date.getUTCFullYear();
    var month = date.getUTCMonth();
    var dayOfWeek = date.getUTCDay();
    var dayOfMonthInt = date.getUTCDate();
    var hoursInt = date.getUTCHours();
    var minutesInt = date.getUTCMinutes();
    var secondsInt = date.getUTCSeconds();
    var dayOfMonthString = dayOfMonthInt < 10 ? "0" + dayOfMonthInt : "" + dayOfMonthInt;
    var hoursString = hoursInt < 10 ? "0" + hoursInt : "" + hoursInt;
    var minutesString = minutesInt < 10 ? "0" + minutesInt : "" + minutesInt;
    var secondsString = secondsInt < 10 ? "0" + secondsInt : "" + secondsInt;
    return DAYS[dayOfWeek] + ", " + dayOfMonthString + " " + MONTHS[month] + " " + year + " " + hoursString + ":" + minutesString + ":" + secondsString + " GMT";
}
var RFC3339 = new RegExp(/^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?[zZ]$/);
var parseRfc3339DateTime = function (value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new TypeError("RFC-3339 date-times must be expressed as strings");
    }
    var match = RFC3339.exec(value);
    if (!match) {
        throw new TypeError("Invalid RFC-3339 date-time value");
    }
    var _a = __read$2(match, 8); _a[0]; var yearStr = _a[1], monthStr = _a[2], dayStr = _a[3], hours = _a[4], minutes = _a[5], seconds = _a[6], fractionalMilliseconds = _a[7];
    var year = strictParseShort(stripLeadingZeroes(yearStr));
    var month = parseDateValue(monthStr, "month", 1, 12);
    var day = parseDateValue(dayStr, "day", 1, 31);
    return buildDate(year, month, day, { hours: hours, minutes: minutes, seconds: seconds, fractionalMilliseconds: fractionalMilliseconds });
};
var IMF_FIXDATE = new RegExp(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/);
var RFC_850_DATE = new RegExp(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/);
var ASC_TIME = new RegExp(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( [1-9]|\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))? (\d{4})$/);
var parseRfc7231DateTime = function (value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new TypeError("RFC-7231 date-times must be expressed as strings");
    }
    var match = IMF_FIXDATE.exec(value);
    if (match) {
        var _a = __read$2(match, 8); _a[0]; var dayStr = _a[1], monthStr = _a[2], yearStr = _a[3], hours = _a[4], minutes = _a[5], seconds = _a[6], fractionalMilliseconds = _a[7];
        return buildDate(strictParseShort(stripLeadingZeroes(yearStr)), parseMonthByShortName(monthStr), parseDateValue(dayStr, "day", 1, 31), { hours: hours, minutes: minutes, seconds: seconds, fractionalMilliseconds: fractionalMilliseconds });
    }
    match = RFC_850_DATE.exec(value);
    if (match) {
        var _b = __read$2(match, 8); _b[0]; var dayStr = _b[1], monthStr = _b[2], yearStr = _b[3], hours = _b[4], minutes = _b[5], seconds = _b[6], fractionalMilliseconds = _b[7];
        return adjustRfc850Year(buildDate(parseTwoDigitYear(yearStr), parseMonthByShortName(monthStr), parseDateValue(dayStr, "day", 1, 31), {
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            fractionalMilliseconds: fractionalMilliseconds,
        }));
    }
    match = ASC_TIME.exec(value);
    if (match) {
        var _c = __read$2(match, 8); _c[0]; var monthStr = _c[1], dayStr = _c[2], hours = _c[3], minutes = _c[4], seconds = _c[5], fractionalMilliseconds = _c[6], yearStr = _c[7];
        return buildDate(strictParseShort(stripLeadingZeroes(yearStr)), parseMonthByShortName(monthStr), parseDateValue(dayStr.trimLeft(), "day", 1, 31), { hours: hours, minutes: minutes, seconds: seconds, fractionalMilliseconds: fractionalMilliseconds });
    }
    throw new TypeError("Invalid RFC-7231 date-time value");
};
var buildDate = function (year, month, day, time) {
    var adjustedMonth = month - 1;
    validateDayOfMonth(year, adjustedMonth, day);
    return new Date(Date.UTC(year, adjustedMonth, day, parseDateValue(time.hours, "hour", 0, 23), parseDateValue(time.minutes, "minute", 0, 59), parseDateValue(time.seconds, "seconds", 0, 60), parseMilliseconds(time.fractionalMilliseconds)));
};
var parseTwoDigitYear = function (value) {
    var thisYear = new Date().getUTCFullYear();
    var valueInThisCentury = Math.floor(thisYear / 100) * 100 + strictParseShort(stripLeadingZeroes(value));
    if (valueInThisCentury < thisYear) {
        return valueInThisCentury + 100;
    }
    return valueInThisCentury;
};
var FIFTY_YEARS_IN_MILLIS = 50 * 365 * 24 * 60 * 60 * 1000;
var adjustRfc850Year = function (input) {
    if (input.getTime() - new Date().getTime() > FIFTY_YEARS_IN_MILLIS) {
        return new Date(Date.UTC(input.getUTCFullYear() - 100, input.getUTCMonth(), input.getUTCDate(), input.getUTCHours(), input.getUTCMinutes(), input.getUTCSeconds(), input.getUTCMilliseconds()));
    }
    return input;
};
var parseMonthByShortName = function (value) {
    var monthIdx = MONTHS.indexOf(value);
    if (monthIdx < 0) {
        throw new TypeError("Invalid month: " + value);
    }
    return monthIdx + 1;
};
var DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var validateDayOfMonth = function (year, month, day) {
    var maxDays = DAYS_IN_MONTH[month];
    if (month === 1 && isLeapYear(year)) {
        maxDays = 29;
    }
    if (day > maxDays) {
        throw new TypeError("Invalid day for " + MONTHS[month] + " in " + year + ": " + day);
    }
};
var isLeapYear = function (year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
};
var parseDateValue = function (value, type, lower, upper) {
    var dateVal = strictParseByte(stripLeadingZeroes(value));
    if (dateVal < lower || dateVal > upper) {
        throw new TypeError(type + " must be between " + lower + " and " + upper + ", inclusive");
    }
    return dateVal;
};
var parseMilliseconds = function (value) {
    if (value === null || value === undefined) {
        return 0;
    }
    return strictParseFloat32("0." + value) * 1000;
};
var stripLeadingZeroes = function (value) {
    var idx = 0;
    while (idx < value.length - 1 && value.charAt(idx) === "0") {
        idx++;
    }
    if (idx === 0) {
        return value;
    }
    return value.slice(idx);
};

var loadConfigsForDefaultMode = function (mode) {
    switch (mode) {
        case "standard":
            return {
                retryMode: "standard",
                connectionTimeout: 3100,
            };
        case "in-region":
            return {
                retryMode: "standard",
                connectionTimeout: 1100,
            };
        case "cross-region":
            return {
                retryMode: "standard",
                connectionTimeout: 3100,
            };
        case "mobile":
            return {
                retryMode: "standard",
                connectionTimeout: 30000,
            };
        default:
            return {};
    }
};

var ServiceException = (function (_super) {
    __extends$2(ServiceException, _super);
    function ServiceException(options) {
        var _this = _super.call(this, options.message) || this;
        Object.setPrototypeOf(_this, ServiceException.prototype);
        _this.name = options.name;
        _this.$fault = options.$fault;
        _this.$metadata = options.$metadata;
        return _this;
    }
    return ServiceException;
}(Error));
var decorateServiceException = function (exception, additions) {
    if (additions === void 0) { additions = {}; }
    Object.entries(additions)
        .filter(function (_a) {
        var _b = __read$2(_a, 2), v = _b[1];
        return v !== undefined;
    })
        .forEach(function (_a) {
        var _b = __read$2(_a, 2), k = _b[0], v = _b[1];
        if (exception[k] == undefined || exception[k] === "") {
            exception[k] = v;
        }
    });
    var message = exception.message || exception.Message || "UnknownError";
    exception.message = message;
    delete exception.Message;
    return exception;
};

function extendedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
        return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

var getValueFromTextNode = function (obj) {
    var textNodeName = "#text";
    for (var key in obj) {
        if (obj.hasOwnProperty(key) && obj[key][textNodeName] !== undefined) {
            obj[key] = obj[key][textNodeName];
        }
        else if (typeof obj[key] === "object" && obj[key] !== null) {
            obj[key] = getValueFromTextNode(obj[key]);
        }
    }
    return obj;
};

var StringWrapper = function () {
    var Class = Object.getPrototypeOf(this).constructor;
    var Constructor = Function.bind.apply(String, __spreadArray([null], __read$2(arguments)));
    var instance = new Constructor();
    Object.setPrototypeOf(instance, Class.prototype);
    return instance;
};
StringWrapper.prototype = Object.create(String.prototype, {
    constructor: {
        value: StringWrapper,
        enumerable: false,
        writable: true,
        configurable: true,
    },
});
Object.setPrototypeOf(StringWrapper, String);
((function (_super) {
    __extends$2(LazyJsonString, _super);
    function LazyJsonString() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LazyJsonString.prototype.deserializeJSON = function () {
        return JSON.parse(_super.prototype.toString.call(this));
    };
    LazyJsonString.prototype.toJSON = function () {
        return _super.prototype.toString.call(this);
    };
    LazyJsonString.fromObject = function (object) {
        if (object instanceof LazyJsonString) {
            return object;
        }
        else if (object instanceof String || typeof object === "string") {
            return new LazyJsonString(object);
        }
        return new LazyJsonString(JSON.stringify(object));
    };
    return LazyJsonString;
})(StringWrapper));

var S3ServiceException = (function (_super) {
    __extends$2(S3ServiceException, _super);
    function S3ServiceException(options) {
        var _this = _super.call(this, options) || this;
        Object.setPrototypeOf(_this, S3ServiceException.prototype);
        return _this;
    }
    return S3ServiceException;
}(ServiceException));

var AbortIncompleteMultipartUpload;
(function (AbortIncompleteMultipartUpload) {
    AbortIncompleteMultipartUpload.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(AbortIncompleteMultipartUpload || (AbortIncompleteMultipartUpload = {}));
var AbortMultipartUploadOutput;
(function (AbortMultipartUploadOutput) {
    AbortMultipartUploadOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(AbortMultipartUploadOutput || (AbortMultipartUploadOutput = {}));
var AbortMultipartUploadRequest;
(function (AbortMultipartUploadRequest) {
    AbortMultipartUploadRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(AbortMultipartUploadRequest || (AbortMultipartUploadRequest = {}));
((function (_super) {
    __extends$2(NoSuchUpload, _super);
    function NoSuchUpload(opts) {
        var _this = _super.call(this, __assign$2({ name: "NoSuchUpload", $fault: "client" }, opts)) || this;
        _this.name = "NoSuchUpload";
        _this.$fault = "client";
        Object.setPrototypeOf(_this, NoSuchUpload.prototype);
        return _this;
    }
    return NoSuchUpload;
})(S3ServiceException));
var AccelerateConfiguration;
(function (AccelerateConfiguration) {
    AccelerateConfiguration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(AccelerateConfiguration || (AccelerateConfiguration = {}));
var Grantee;
(function (Grantee) {
    Grantee.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(Grantee || (Grantee = {}));
var Grant;
(function (Grant) {
    Grant.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(Grant || (Grant = {}));
var Owner;
(function (Owner) {
    Owner.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(Owner || (Owner = {}));
var AccessControlPolicy;
(function (AccessControlPolicy) {
    AccessControlPolicy.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(AccessControlPolicy || (AccessControlPolicy = {}));
var AccessControlTranslation;
(function (AccessControlTranslation) {
    AccessControlTranslation.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(AccessControlTranslation || (AccessControlTranslation = {}));
var CompleteMultipartUploadOutput;
(function (CompleteMultipartUploadOutput) {
    CompleteMultipartUploadOutput.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING }))); };
})(CompleteMultipartUploadOutput || (CompleteMultipartUploadOutput = {}));
var CompletedPart;
(function (CompletedPart) {
    CompletedPart.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(CompletedPart || (CompletedPart = {}));
var CompletedMultipartUpload;
(function (CompletedMultipartUpload) {
    CompletedMultipartUpload.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(CompletedMultipartUpload || (CompletedMultipartUpload = {}));
var CompleteMultipartUploadRequest;
(function (CompleteMultipartUploadRequest) {
    CompleteMultipartUploadRequest.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.SSECustomerKey && { SSECustomerKey: SENSITIVE_STRING }))); };
})(CompleteMultipartUploadRequest || (CompleteMultipartUploadRequest = {}));
var CopyObjectResult;
(function (CopyObjectResult) {
    CopyObjectResult.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(CopyObjectResult || (CopyObjectResult = {}));
var CopyObjectOutput;
(function (CopyObjectOutput) {
    CopyObjectOutput.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2(__assign$2({}, obj), (obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING })), (obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING }))); };
})(CopyObjectOutput || (CopyObjectOutput = {}));
var ChecksumAlgorithm$1;
(function (ChecksumAlgorithm) {
    ChecksumAlgorithm["CRC32"] = "CRC32";
    ChecksumAlgorithm["CRC32C"] = "CRC32C";
    ChecksumAlgorithm["SHA1"] = "SHA1";
    ChecksumAlgorithm["SHA256"] = "SHA256";
})(ChecksumAlgorithm$1 || (ChecksumAlgorithm$1 = {}));
var CopyObjectRequest;
(function (CopyObjectRequest) {
    CopyObjectRequest.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2(__assign$2(__assign$2(__assign$2({}, obj), (obj.SSECustomerKey && { SSECustomerKey: SENSITIVE_STRING })), (obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING })), (obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING })), (obj.CopySourceSSECustomerKey && { CopySourceSSECustomerKey: SENSITIVE_STRING }))); };
})(CopyObjectRequest || (CopyObjectRequest = {}));
((function (_super) {
    __extends$2(ObjectNotInActiveTierError, _super);
    function ObjectNotInActiveTierError(opts) {
        var _this = _super.call(this, __assign$2({ name: "ObjectNotInActiveTierError", $fault: "client" }, opts)) || this;
        _this.name = "ObjectNotInActiveTierError";
        _this.$fault = "client";
        Object.setPrototypeOf(_this, ObjectNotInActiveTierError.prototype);
        return _this;
    }
    return ObjectNotInActiveTierError;
})(S3ServiceException));
((function (_super) {
    __extends$2(BucketAlreadyExists, _super);
    function BucketAlreadyExists(opts) {
        var _this = _super.call(this, __assign$2({ name: "BucketAlreadyExists", $fault: "client" }, opts)) || this;
        _this.name = "BucketAlreadyExists";
        _this.$fault = "client";
        Object.setPrototypeOf(_this, BucketAlreadyExists.prototype);
        return _this;
    }
    return BucketAlreadyExists;
})(S3ServiceException));
((function (_super) {
    __extends$2(BucketAlreadyOwnedByYou, _super);
    function BucketAlreadyOwnedByYou(opts) {
        var _this = _super.call(this, __assign$2({ name: "BucketAlreadyOwnedByYou", $fault: "client" }, opts)) || this;
        _this.name = "BucketAlreadyOwnedByYou";
        _this.$fault = "client";
        Object.setPrototypeOf(_this, BucketAlreadyOwnedByYou.prototype);
        return _this;
    }
    return BucketAlreadyOwnedByYou;
})(S3ServiceException));
var CreateBucketOutput;
(function (CreateBucketOutput) {
    CreateBucketOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(CreateBucketOutput || (CreateBucketOutput = {}));
var CreateBucketConfiguration;
(function (CreateBucketConfiguration) {
    CreateBucketConfiguration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(CreateBucketConfiguration || (CreateBucketConfiguration = {}));
var CreateBucketRequest;
(function (CreateBucketRequest) {
    CreateBucketRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(CreateBucketRequest || (CreateBucketRequest = {}));
var CreateMultipartUploadOutput;
(function (CreateMultipartUploadOutput) {
    CreateMultipartUploadOutput.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2(__assign$2({}, obj), (obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING })), (obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING }))); };
})(CreateMultipartUploadOutput || (CreateMultipartUploadOutput = {}));
var CreateMultipartUploadRequest;
(function (CreateMultipartUploadRequest) {
    CreateMultipartUploadRequest.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2(__assign$2(__assign$2({}, obj), (obj.SSECustomerKey && { SSECustomerKey: SENSITIVE_STRING })), (obj.SSEKMSKeyId && { SSEKMSKeyId: SENSITIVE_STRING })), (obj.SSEKMSEncryptionContext && { SSEKMSEncryptionContext: SENSITIVE_STRING }))); };
})(CreateMultipartUploadRequest || (CreateMultipartUploadRequest = {}));
var DeleteBucketRequest;
(function (DeleteBucketRequest) {
    DeleteBucketRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketRequest || (DeleteBucketRequest = {}));
var DeleteBucketAnalyticsConfigurationRequest;
(function (DeleteBucketAnalyticsConfigurationRequest) {
    DeleteBucketAnalyticsConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketAnalyticsConfigurationRequest || (DeleteBucketAnalyticsConfigurationRequest = {}));
var DeleteBucketCorsRequest;
(function (DeleteBucketCorsRequest) {
    DeleteBucketCorsRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketCorsRequest || (DeleteBucketCorsRequest = {}));
var DeleteBucketEncryptionRequest;
(function (DeleteBucketEncryptionRequest) {
    DeleteBucketEncryptionRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketEncryptionRequest || (DeleteBucketEncryptionRequest = {}));
var DeleteBucketIntelligentTieringConfigurationRequest;
(function (DeleteBucketIntelligentTieringConfigurationRequest) {
    DeleteBucketIntelligentTieringConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketIntelligentTieringConfigurationRequest || (DeleteBucketIntelligentTieringConfigurationRequest = {}));
var DeleteBucketInventoryConfigurationRequest;
(function (DeleteBucketInventoryConfigurationRequest) {
    DeleteBucketInventoryConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketInventoryConfigurationRequest || (DeleteBucketInventoryConfigurationRequest = {}));
var DeleteBucketLifecycleRequest;
(function (DeleteBucketLifecycleRequest) {
    DeleteBucketLifecycleRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketLifecycleRequest || (DeleteBucketLifecycleRequest = {}));
var DeleteBucketMetricsConfigurationRequest;
(function (DeleteBucketMetricsConfigurationRequest) {
    DeleteBucketMetricsConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketMetricsConfigurationRequest || (DeleteBucketMetricsConfigurationRequest = {}));
var DeleteBucketOwnershipControlsRequest;
(function (DeleteBucketOwnershipControlsRequest) {
    DeleteBucketOwnershipControlsRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketOwnershipControlsRequest || (DeleteBucketOwnershipControlsRequest = {}));
var DeleteBucketPolicyRequest;
(function (DeleteBucketPolicyRequest) {
    DeleteBucketPolicyRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketPolicyRequest || (DeleteBucketPolicyRequest = {}));
var DeleteBucketReplicationRequest;
(function (DeleteBucketReplicationRequest) {
    DeleteBucketReplicationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketReplicationRequest || (DeleteBucketReplicationRequest = {}));
var DeleteBucketTaggingRequest;
(function (DeleteBucketTaggingRequest) {
    DeleteBucketTaggingRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketTaggingRequest || (DeleteBucketTaggingRequest = {}));
var DeleteBucketWebsiteRequest;
(function (DeleteBucketWebsiteRequest) {
    DeleteBucketWebsiteRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteBucketWebsiteRequest || (DeleteBucketWebsiteRequest = {}));
var DeleteObjectOutput;
(function (DeleteObjectOutput) {
    DeleteObjectOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteObjectOutput || (DeleteObjectOutput = {}));
var DeleteObjectRequest;
(function (DeleteObjectRequest) {
    DeleteObjectRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteObjectRequest || (DeleteObjectRequest = {}));
var DeletedObject;
(function (DeletedObject) {
    DeletedObject.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeletedObject || (DeletedObject = {}));
var _Error;
(function (_Error) {
    _Error.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(_Error || (_Error = {}));
var DeleteObjectsOutput;
(function (DeleteObjectsOutput) {
    DeleteObjectsOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteObjectsOutput || (DeleteObjectsOutput = {}));
var ObjectIdentifier;
(function (ObjectIdentifier) {
    ObjectIdentifier.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(ObjectIdentifier || (ObjectIdentifier = {}));
var Delete;
(function (Delete) {
    Delete.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(Delete || (Delete = {}));
var DeleteObjectsRequest;
(function (DeleteObjectsRequest) {
    DeleteObjectsRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteObjectsRequest || (DeleteObjectsRequest = {}));
var DeleteObjectTaggingOutput;
(function (DeleteObjectTaggingOutput) {
    DeleteObjectTaggingOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteObjectTaggingOutput || (DeleteObjectTaggingOutput = {}));
var DeleteObjectTaggingRequest;
(function (DeleteObjectTaggingRequest) {
    DeleteObjectTaggingRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteObjectTaggingRequest || (DeleteObjectTaggingRequest = {}));
var DeletePublicAccessBlockRequest;
(function (DeletePublicAccessBlockRequest) {
    DeletePublicAccessBlockRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeletePublicAccessBlockRequest || (DeletePublicAccessBlockRequest = {}));
var GetBucketAccelerateConfigurationOutput;
(function (GetBucketAccelerateConfigurationOutput) {
    GetBucketAccelerateConfigurationOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketAccelerateConfigurationOutput || (GetBucketAccelerateConfigurationOutput = {}));
var GetBucketAccelerateConfigurationRequest;
(function (GetBucketAccelerateConfigurationRequest) {
    GetBucketAccelerateConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketAccelerateConfigurationRequest || (GetBucketAccelerateConfigurationRequest = {}));
var GetBucketAclOutput;
(function (GetBucketAclOutput) {
    GetBucketAclOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketAclOutput || (GetBucketAclOutput = {}));
var GetBucketAclRequest;
(function (GetBucketAclRequest) {
    GetBucketAclRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketAclRequest || (GetBucketAclRequest = {}));
var Tag$1;
(function (Tag) {
    Tag.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(Tag$1 || (Tag$1 = {}));
var AnalyticsAndOperator;
(function (AnalyticsAndOperator) {
    AnalyticsAndOperator.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(AnalyticsAndOperator || (AnalyticsAndOperator = {}));
var AnalyticsFilter;
(function (AnalyticsFilter) {
    AnalyticsFilter.visit = function (value, visitor) {
        if (value.Prefix !== undefined)
            return visitor.Prefix(value.Prefix);
        if (value.Tag !== undefined)
            return visitor.Tag(value.Tag);
        if (value.And !== undefined)
            return visitor.And(value.And);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
    AnalyticsFilter.filterSensitiveLog = function (obj) {
        var _a;
        if (obj.Prefix !== undefined)
            return { Prefix: obj.Prefix };
        if (obj.Tag !== undefined)
            return { Tag: Tag$1.filterSensitiveLog(obj.Tag) };
        if (obj.And !== undefined)
            return { And: AnalyticsAndOperator.filterSensitiveLog(obj.And) };
        if (obj.$unknown !== undefined)
            return _a = {}, _a[obj.$unknown[0]] = "UNKNOWN", _a;
    };
})(AnalyticsFilter || (AnalyticsFilter = {}));
var AnalyticsS3BucketDestination;
(function (AnalyticsS3BucketDestination) {
    AnalyticsS3BucketDestination.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(AnalyticsS3BucketDestination || (AnalyticsS3BucketDestination = {}));
var AnalyticsExportDestination;
(function (AnalyticsExportDestination) {
    AnalyticsExportDestination.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(AnalyticsExportDestination || (AnalyticsExportDestination = {}));
var StorageClassAnalysisDataExport;
(function (StorageClassAnalysisDataExport) {
    StorageClassAnalysisDataExport.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(StorageClassAnalysisDataExport || (StorageClassAnalysisDataExport = {}));
var StorageClassAnalysis;
(function (StorageClassAnalysis) {
    StorageClassAnalysis.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(StorageClassAnalysis || (StorageClassAnalysis = {}));
var AnalyticsConfiguration;
(function (AnalyticsConfiguration) {
    AnalyticsConfiguration.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.Filter && { Filter: AnalyticsFilter.filterSensitiveLog(obj.Filter) }))); };
})(AnalyticsConfiguration || (AnalyticsConfiguration = {}));
var GetBucketAnalyticsConfigurationOutput;
(function (GetBucketAnalyticsConfigurationOutput) {
    GetBucketAnalyticsConfigurationOutput.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.AnalyticsConfiguration && {
        AnalyticsConfiguration: AnalyticsConfiguration.filterSensitiveLog(obj.AnalyticsConfiguration),
    }))); };
})(GetBucketAnalyticsConfigurationOutput || (GetBucketAnalyticsConfigurationOutput = {}));
var GetBucketAnalyticsConfigurationRequest;
(function (GetBucketAnalyticsConfigurationRequest) {
    GetBucketAnalyticsConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketAnalyticsConfigurationRequest || (GetBucketAnalyticsConfigurationRequest = {}));
var CORSRule;
(function (CORSRule) {
    CORSRule.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(CORSRule || (CORSRule = {}));
var GetBucketCorsOutput;
(function (GetBucketCorsOutput) {
    GetBucketCorsOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketCorsOutput || (GetBucketCorsOutput = {}));
var GetBucketCorsRequest;
(function (GetBucketCorsRequest) {
    GetBucketCorsRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketCorsRequest || (GetBucketCorsRequest = {}));
var ServerSideEncryptionByDefault;
(function (ServerSideEncryptionByDefault) {
    ServerSideEncryptionByDefault.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.KMSMasterKeyID && { KMSMasterKeyID: SENSITIVE_STRING }))); };
})(ServerSideEncryptionByDefault || (ServerSideEncryptionByDefault = {}));
var ServerSideEncryptionRule;
(function (ServerSideEncryptionRule) {
    ServerSideEncryptionRule.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.ApplyServerSideEncryptionByDefault && {
        ApplyServerSideEncryptionByDefault: ServerSideEncryptionByDefault.filterSensitiveLog(obj.ApplyServerSideEncryptionByDefault),
    }))); };
})(ServerSideEncryptionRule || (ServerSideEncryptionRule = {}));
var ServerSideEncryptionConfiguration;
(function (ServerSideEncryptionConfiguration) {
    ServerSideEncryptionConfiguration.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.Rules && { Rules: obj.Rules.map(function (item) { return ServerSideEncryptionRule.filterSensitiveLog(item); }) }))); };
})(ServerSideEncryptionConfiguration || (ServerSideEncryptionConfiguration = {}));
var GetBucketEncryptionOutput;
(function (GetBucketEncryptionOutput) {
    GetBucketEncryptionOutput.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.ServerSideEncryptionConfiguration && {
        ServerSideEncryptionConfiguration: ServerSideEncryptionConfiguration.filterSensitiveLog(obj.ServerSideEncryptionConfiguration),
    }))); };
})(GetBucketEncryptionOutput || (GetBucketEncryptionOutput = {}));
var GetBucketEncryptionRequest;
(function (GetBucketEncryptionRequest) {
    GetBucketEncryptionRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketEncryptionRequest || (GetBucketEncryptionRequest = {}));
var IntelligentTieringAndOperator;
(function (IntelligentTieringAndOperator) {
    IntelligentTieringAndOperator.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(IntelligentTieringAndOperator || (IntelligentTieringAndOperator = {}));
var IntelligentTieringFilter;
(function (IntelligentTieringFilter) {
    IntelligentTieringFilter.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(IntelligentTieringFilter || (IntelligentTieringFilter = {}));
var Tiering;
(function (Tiering) {
    Tiering.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(Tiering || (Tiering = {}));
var IntelligentTieringConfiguration;
(function (IntelligentTieringConfiguration) {
    IntelligentTieringConfiguration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(IntelligentTieringConfiguration || (IntelligentTieringConfiguration = {}));
var GetBucketIntelligentTieringConfigurationOutput;
(function (GetBucketIntelligentTieringConfigurationOutput) {
    GetBucketIntelligentTieringConfigurationOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketIntelligentTieringConfigurationOutput || (GetBucketIntelligentTieringConfigurationOutput = {}));
var GetBucketIntelligentTieringConfigurationRequest;
(function (GetBucketIntelligentTieringConfigurationRequest) {
    GetBucketIntelligentTieringConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketIntelligentTieringConfigurationRequest || (GetBucketIntelligentTieringConfigurationRequest = {}));
var SSEKMS;
(function (SSEKMS) {
    SSEKMS.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.KeyId && { KeyId: SENSITIVE_STRING }))); };
})(SSEKMS || (SSEKMS = {}));
var SSES3;
(function (SSES3) {
    SSES3.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(SSES3 || (SSES3 = {}));
var InventoryEncryption;
(function (InventoryEncryption) {
    InventoryEncryption.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.SSEKMS && { SSEKMS: SSEKMS.filterSensitiveLog(obj.SSEKMS) }))); };
})(InventoryEncryption || (InventoryEncryption = {}));
var InventoryS3BucketDestination;
(function (InventoryS3BucketDestination) {
    InventoryS3BucketDestination.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.Encryption && { Encryption: InventoryEncryption.filterSensitiveLog(obj.Encryption) }))); };
})(InventoryS3BucketDestination || (InventoryS3BucketDestination = {}));
var InventoryDestination;
(function (InventoryDestination) {
    InventoryDestination.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.S3BucketDestination && {
        S3BucketDestination: InventoryS3BucketDestination.filterSensitiveLog(obj.S3BucketDestination),
    }))); };
})(InventoryDestination || (InventoryDestination = {}));
var InventoryFilter;
(function (InventoryFilter) {
    InventoryFilter.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(InventoryFilter || (InventoryFilter = {}));
var InventorySchedule;
(function (InventorySchedule) {
    InventorySchedule.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(InventorySchedule || (InventorySchedule = {}));
var InventoryConfiguration;
(function (InventoryConfiguration) {
    InventoryConfiguration.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.Destination && { Destination: InventoryDestination.filterSensitiveLog(obj.Destination) }))); };
})(InventoryConfiguration || (InventoryConfiguration = {}));
var GetBucketInventoryConfigurationOutput;
(function (GetBucketInventoryConfigurationOutput) {
    GetBucketInventoryConfigurationOutput.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.InventoryConfiguration && {
        InventoryConfiguration: InventoryConfiguration.filterSensitiveLog(obj.InventoryConfiguration),
    }))); };
})(GetBucketInventoryConfigurationOutput || (GetBucketInventoryConfigurationOutput = {}));
var GetBucketInventoryConfigurationRequest;
(function (GetBucketInventoryConfigurationRequest) {
    GetBucketInventoryConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketInventoryConfigurationRequest || (GetBucketInventoryConfigurationRequest = {}));
var LifecycleExpiration;
(function (LifecycleExpiration) {
    LifecycleExpiration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(LifecycleExpiration || (LifecycleExpiration = {}));
var LifecycleRuleAndOperator;
(function (LifecycleRuleAndOperator) {
    LifecycleRuleAndOperator.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(LifecycleRuleAndOperator || (LifecycleRuleAndOperator = {}));
var LifecycleRuleFilter;
(function (LifecycleRuleFilter) {
    LifecycleRuleFilter.visit = function (value, visitor) {
        if (value.Prefix !== undefined)
            return visitor.Prefix(value.Prefix);
        if (value.Tag !== undefined)
            return visitor.Tag(value.Tag);
        if (value.ObjectSizeGreaterThan !== undefined)
            return visitor.ObjectSizeGreaterThan(value.ObjectSizeGreaterThan);
        if (value.ObjectSizeLessThan !== undefined)
            return visitor.ObjectSizeLessThan(value.ObjectSizeLessThan);
        if (value.And !== undefined)
            return visitor.And(value.And);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
    LifecycleRuleFilter.filterSensitiveLog = function (obj) {
        var _a;
        if (obj.Prefix !== undefined)
            return { Prefix: obj.Prefix };
        if (obj.Tag !== undefined)
            return { Tag: Tag$1.filterSensitiveLog(obj.Tag) };
        if (obj.ObjectSizeGreaterThan !== undefined)
            return { ObjectSizeGreaterThan: obj.ObjectSizeGreaterThan };
        if (obj.ObjectSizeLessThan !== undefined)
            return { ObjectSizeLessThan: obj.ObjectSizeLessThan };
        if (obj.And !== undefined)
            return { And: LifecycleRuleAndOperator.filterSensitiveLog(obj.And) };
        if (obj.$unknown !== undefined)
            return _a = {}, _a[obj.$unknown[0]] = "UNKNOWN", _a;
    };
})(LifecycleRuleFilter || (LifecycleRuleFilter = {}));
var NoncurrentVersionExpiration;
(function (NoncurrentVersionExpiration) {
    NoncurrentVersionExpiration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(NoncurrentVersionExpiration || (NoncurrentVersionExpiration = {}));
var NoncurrentVersionTransition;
(function (NoncurrentVersionTransition) {
    NoncurrentVersionTransition.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(NoncurrentVersionTransition || (NoncurrentVersionTransition = {}));
var Transition;
(function (Transition) {
    Transition.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(Transition || (Transition = {}));
var LifecycleRule;
(function (LifecycleRule) {
    LifecycleRule.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.Filter && { Filter: LifecycleRuleFilter.filterSensitiveLog(obj.Filter) }))); };
})(LifecycleRule || (LifecycleRule = {}));
var GetBucketLifecycleConfigurationOutput;
(function (GetBucketLifecycleConfigurationOutput) {
    GetBucketLifecycleConfigurationOutput.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.Rules && { Rules: obj.Rules.map(function (item) { return LifecycleRule.filterSensitiveLog(item); }) }))); };
})(GetBucketLifecycleConfigurationOutput || (GetBucketLifecycleConfigurationOutput = {}));
var GetBucketLifecycleConfigurationRequest;
(function (GetBucketLifecycleConfigurationRequest) {
    GetBucketLifecycleConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketLifecycleConfigurationRequest || (GetBucketLifecycleConfigurationRequest = {}));
var GetBucketLocationOutput;
(function (GetBucketLocationOutput) {
    GetBucketLocationOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketLocationOutput || (GetBucketLocationOutput = {}));
var GetBucketLocationRequest;
(function (GetBucketLocationRequest) {
    GetBucketLocationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketLocationRequest || (GetBucketLocationRequest = {}));
var TargetGrant;
(function (TargetGrant) {
    TargetGrant.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(TargetGrant || (TargetGrant = {}));
var LoggingEnabled;
(function (LoggingEnabled) {
    LoggingEnabled.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(LoggingEnabled || (LoggingEnabled = {}));
var GetBucketLoggingOutput;
(function (GetBucketLoggingOutput) {
    GetBucketLoggingOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketLoggingOutput || (GetBucketLoggingOutput = {}));
var GetBucketLoggingRequest;
(function (GetBucketLoggingRequest) {
    GetBucketLoggingRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketLoggingRequest || (GetBucketLoggingRequest = {}));
var MetricsAndOperator;
(function (MetricsAndOperator) {
    MetricsAndOperator.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(MetricsAndOperator || (MetricsAndOperator = {}));
var MetricsFilter;
(function (MetricsFilter) {
    MetricsFilter.visit = function (value, visitor) {
        if (value.Prefix !== undefined)
            return visitor.Prefix(value.Prefix);
        if (value.Tag !== undefined)
            return visitor.Tag(value.Tag);
        if (value.AccessPointArn !== undefined)
            return visitor.AccessPointArn(value.AccessPointArn);
        if (value.And !== undefined)
            return visitor.And(value.And);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
    MetricsFilter.filterSensitiveLog = function (obj) {
        var _a;
        if (obj.Prefix !== undefined)
            return { Prefix: obj.Prefix };
        if (obj.Tag !== undefined)
            return { Tag: Tag$1.filterSensitiveLog(obj.Tag) };
        if (obj.AccessPointArn !== undefined)
            return { AccessPointArn: obj.AccessPointArn };
        if (obj.And !== undefined)
            return { And: MetricsAndOperator.filterSensitiveLog(obj.And) };
        if (obj.$unknown !== undefined)
            return _a = {}, _a[obj.$unknown[0]] = "UNKNOWN", _a;
    };
})(MetricsFilter || (MetricsFilter = {}));
var MetricsConfiguration;
(function (MetricsConfiguration) {
    MetricsConfiguration.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.Filter && { Filter: MetricsFilter.filterSensitiveLog(obj.Filter) }))); };
})(MetricsConfiguration || (MetricsConfiguration = {}));
var GetBucketMetricsConfigurationOutput;
(function (GetBucketMetricsConfigurationOutput) {
    GetBucketMetricsConfigurationOutput.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.MetricsConfiguration && {
        MetricsConfiguration: MetricsConfiguration.filterSensitiveLog(obj.MetricsConfiguration),
    }))); };
})(GetBucketMetricsConfigurationOutput || (GetBucketMetricsConfigurationOutput = {}));
var GetBucketMetricsConfigurationRequest;
(function (GetBucketMetricsConfigurationRequest) {
    GetBucketMetricsConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketMetricsConfigurationRequest || (GetBucketMetricsConfigurationRequest = {}));
var GetBucketNotificationConfigurationRequest;
(function (GetBucketNotificationConfigurationRequest) {
    GetBucketNotificationConfigurationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketNotificationConfigurationRequest || (GetBucketNotificationConfigurationRequest = {}));
var EventBridgeConfiguration;
(function (EventBridgeConfiguration) {
    EventBridgeConfiguration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(EventBridgeConfiguration || (EventBridgeConfiguration = {}));
var FilterRule;
(function (FilterRule) {
    FilterRule.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(FilterRule || (FilterRule = {}));
var S3KeyFilter;
(function (S3KeyFilter) {
    S3KeyFilter.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(S3KeyFilter || (S3KeyFilter = {}));
var NotificationConfigurationFilter;
(function (NotificationConfigurationFilter) {
    NotificationConfigurationFilter.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(NotificationConfigurationFilter || (NotificationConfigurationFilter = {}));
var LambdaFunctionConfiguration;
(function (LambdaFunctionConfiguration) {
    LambdaFunctionConfiguration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(LambdaFunctionConfiguration || (LambdaFunctionConfiguration = {}));
var QueueConfiguration;
(function (QueueConfiguration) {
    QueueConfiguration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(QueueConfiguration || (QueueConfiguration = {}));
var TopicConfiguration;
(function (TopicConfiguration) {
    TopicConfiguration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(TopicConfiguration || (TopicConfiguration = {}));
var NotificationConfiguration;
(function (NotificationConfiguration) {
    NotificationConfiguration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(NotificationConfiguration || (NotificationConfiguration = {}));
var OwnershipControlsRule;
(function (OwnershipControlsRule) {
    OwnershipControlsRule.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(OwnershipControlsRule || (OwnershipControlsRule = {}));
var OwnershipControls;
(function (OwnershipControls) {
    OwnershipControls.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(OwnershipControls || (OwnershipControls = {}));
var GetBucketOwnershipControlsOutput;
(function (GetBucketOwnershipControlsOutput) {
    GetBucketOwnershipControlsOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketOwnershipControlsOutput || (GetBucketOwnershipControlsOutput = {}));
var GetBucketOwnershipControlsRequest;
(function (GetBucketOwnershipControlsRequest) {
    GetBucketOwnershipControlsRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketOwnershipControlsRequest || (GetBucketOwnershipControlsRequest = {}));
var GetBucketPolicyOutput;
(function (GetBucketPolicyOutput) {
    GetBucketPolicyOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketPolicyOutput || (GetBucketPolicyOutput = {}));
var GetBucketPolicyRequest;
(function (GetBucketPolicyRequest) {
    GetBucketPolicyRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketPolicyRequest || (GetBucketPolicyRequest = {}));
var PolicyStatus;
(function (PolicyStatus) {
    PolicyStatus.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(PolicyStatus || (PolicyStatus = {}));
var GetBucketPolicyStatusOutput;
(function (GetBucketPolicyStatusOutput) {
    GetBucketPolicyStatusOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketPolicyStatusOutput || (GetBucketPolicyStatusOutput = {}));
var GetBucketPolicyStatusRequest;
(function (GetBucketPolicyStatusRequest) {
    GetBucketPolicyStatusRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketPolicyStatusRequest || (GetBucketPolicyStatusRequest = {}));
var DeleteMarkerReplication;
(function (DeleteMarkerReplication) {
    DeleteMarkerReplication.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(DeleteMarkerReplication || (DeleteMarkerReplication = {}));
var EncryptionConfiguration;
(function (EncryptionConfiguration) {
    EncryptionConfiguration.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(EncryptionConfiguration || (EncryptionConfiguration = {}));
var ReplicationTimeValue;
(function (ReplicationTimeValue) {
    ReplicationTimeValue.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(ReplicationTimeValue || (ReplicationTimeValue = {}));
var Metrics;
(function (Metrics) {
    Metrics.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(Metrics || (Metrics = {}));
var ReplicationTime;
(function (ReplicationTime) {
    ReplicationTime.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(ReplicationTime || (ReplicationTime = {}));
var Destination;
(function (Destination) {
    Destination.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(Destination || (Destination = {}));
var ExistingObjectReplication;
(function (ExistingObjectReplication) {
    ExistingObjectReplication.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(ExistingObjectReplication || (ExistingObjectReplication = {}));
var ReplicationRuleAndOperator;
(function (ReplicationRuleAndOperator) {
    ReplicationRuleAndOperator.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(ReplicationRuleAndOperator || (ReplicationRuleAndOperator = {}));
var ReplicationRuleFilter;
(function (ReplicationRuleFilter) {
    ReplicationRuleFilter.visit = function (value, visitor) {
        if (value.Prefix !== undefined)
            return visitor.Prefix(value.Prefix);
        if (value.Tag !== undefined)
            return visitor.Tag(value.Tag);
        if (value.And !== undefined)
            return visitor.And(value.And);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
    ReplicationRuleFilter.filterSensitiveLog = function (obj) {
        var _a;
        if (obj.Prefix !== undefined)
            return { Prefix: obj.Prefix };
        if (obj.Tag !== undefined)
            return { Tag: Tag$1.filterSensitiveLog(obj.Tag) };
        if (obj.And !== undefined)
            return { And: ReplicationRuleAndOperator.filterSensitiveLog(obj.And) };
        if (obj.$unknown !== undefined)
            return _a = {}, _a[obj.$unknown[0]] = "UNKNOWN", _a;
    };
})(ReplicationRuleFilter || (ReplicationRuleFilter = {}));
var ReplicaModifications;
(function (ReplicaModifications) {
    ReplicaModifications.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(ReplicaModifications || (ReplicaModifications = {}));
var SseKmsEncryptedObjects;
(function (SseKmsEncryptedObjects) {
    SseKmsEncryptedObjects.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(SseKmsEncryptedObjects || (SseKmsEncryptedObjects = {}));
var SourceSelectionCriteria;
(function (SourceSelectionCriteria) {
    SourceSelectionCriteria.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(SourceSelectionCriteria || (SourceSelectionCriteria = {}));
var ReplicationRule;
(function (ReplicationRule) {
    ReplicationRule.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.Filter && { Filter: ReplicationRuleFilter.filterSensitiveLog(obj.Filter) }))); };
})(ReplicationRule || (ReplicationRule = {}));
var ReplicationConfiguration;
(function (ReplicationConfiguration) {
    ReplicationConfiguration.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.Rules && { Rules: obj.Rules.map(function (item) { return ReplicationRule.filterSensitiveLog(item); }) }))); };
})(ReplicationConfiguration || (ReplicationConfiguration = {}));
var GetBucketReplicationOutput;
(function (GetBucketReplicationOutput) {
    GetBucketReplicationOutput.filterSensitiveLog = function (obj) { return (__assign$2(__assign$2({}, obj), (obj.ReplicationConfiguration && {
        ReplicationConfiguration: ReplicationConfiguration.filterSensitiveLog(obj.ReplicationConfiguration),
    }))); };
})(GetBucketReplicationOutput || (GetBucketReplicationOutput = {}));
var GetBucketReplicationRequest;
(function (GetBucketReplicationRequest) {
    GetBucketReplicationRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketReplicationRequest || (GetBucketReplicationRequest = {}));
var GetBucketRequestPaymentOutput;
(function (GetBucketRequestPaymentOutput) {
    GetBucketRequestPaymentOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketRequestPaymentOutput || (GetBucketRequestPaymentOutput = {}));
var GetBucketRequestPaymentRequest;
(function (GetBucketRequestPaymentRequest) {
    GetBucketRequestPaymentRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketRequestPaymentRequest || (GetBucketRequestPaymentRequest = {}));
var GetBucketTaggingOutput;
(function (GetBucketTaggingOutput) {
    GetBucketTaggingOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketTaggingOutput || (GetBucketTaggingOutput = {}));
var GetBucketTaggingRequest;
(function (GetBucketTaggingRequest) {
    GetBucketTaggingRequest.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketTaggingRequest || (GetBucketTaggingRequest = {}));
var GetBucketVersioningOutput;
(function (GetBucketVersioningOutput) {
    GetBucketVersioningOutput.filterSensitiveLog = function (obj) { return (__assign$2({}, obj)); };
})(GetBucketVersioningOutput || (GetBucketVersioningOutput = {}));

