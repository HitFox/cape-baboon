var CapeBaboon = require('./../src/cape-baboon');
var Request = require('request-promise');

// use standard options
var options = {};

// init CapeBaboon Queue
var baboon = new CapeBaboon(options);

// define request
var request = Request('http://www.google.de');

// simple queing
baboon.push(function(){ return request });

// with promise chaining
baboon.push(function(){ return request }).then(function(data){console.log(data);});
