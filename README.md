# cape-baboon
![Baboons with Car](http://i.dailymail.co.uk/i/pix/2009/07/20/article-1200917-05C68C79000005DC-619_634x399.jpg)

Node.js http request throttler for promises

## How it works
![How it works](http://i.giphy.com/pFwRzOLfuGHok.gif)

```javascript
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
```
