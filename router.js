var express = require("express");
var route = express.Router();

var { AtsScanResume } = require('./controller/ResumeCheck')
route.post('/scan/resume', AtsScanResume)

module.exports =route