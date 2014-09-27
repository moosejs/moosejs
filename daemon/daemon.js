var fs = require('fs-extra');
var socketIOClient = require('socket.io-client');
var sailsIOClient = require('sails.io.js');
var async = require('async');
var util = require('./util.js');
var grader = require('../grader/grader.js');
var jsonfile = require('jsonfile');
var config,tmp;

var io = sailsIOClient(socketIOClient);

var subscribe = function(){
	util.log.info('Waiting for next run');
	io.socket.get('/judgehost/subscribe',function(body,responseObj){
		if(body.status === 'pending'){
			judge(body.grade);
		}  
	});
}

var saveCompileError = function(grade, err){
	/**
	
		TODO:
		- Save compile error in DB	
	**/
}

var cleanGrade = function(grade){
	io.socket.post('/grade/cleanGrade', {
		grade: grade.id
	});
}

var judgeTestcase = function(runnable, grade, subtask, testcase, cb){
	util.log.judge("Running testcase "+ testcase.id);
	grader.run(runnable, testcase.inputFile, testcase.outputFile, subtask.timeLimit, subtask.memoryLimit,
		function(err, data){
			if(err){
				cb(err);
				return;
			}
			util.log.judge('Result for the run of testcase ' + testcase.id);
			util.log.judge(data);
			io.socket.post('/grade/saveGrade',{
				grade: grade.id,
				testcase: testcase.id,
				result: data.result,
				message: data.message
			}, function(data,responseObj){
				if(responseObj.statusCode !== 200){
					cb(data);
					return;
				}
				cb(null);
				
			});
		});
}

var judgeSubtask = function(runnable, grade, subtask, cb){
	util.log.judge("Judging subtask " + subtask.id);

	async.eachSeries(subtask.testcases, function(testcase, callback){
		judgeTestcase(runnable, grade, subtask, testcase, callback);
	},function(err){
		if(err){
			cb(err);
			return;
		}
		cb(null);
	});
}

var judgeTask = function(grade, runnable){
	util.log.judge("Judging for task "+ grade.task.name);
	async.eachSeries(grade.subtasks, function(subtask, callback){
		judgeSubtask(runnable, grade, subtask, callback);
	}, function(err){
		if(err){
			util.log.error(err);
			cleanGrade(grade);
			return;
		}
		io.socket.post('/grade/done', {grade: grade.id}, 
			function(data,responseObj){
				if(responseObj.statusCode !== 200){
					util.log.warn('Unable to mark problem judging done. Retrying...');
					io.socket.post('/grade/done', {grade : grade.id},  
						function(data,responseObj){
							if(responseObj.statusCode !== 200){
								util.log.error('Retry failed, starting cleaning for further judging');
								cleanGrade();
								return;
							}
							util.log.judge('Grade '+ grade.id + ' completed!!');
							// After judging the task, subscribe to receive new ones
							subscribe();
						});
					return;
				}
				util.log.judge('Grade '+ grade.id + ' completed!!');
				// After judging the task, subscribe to receive new ones
				subscribe();
				
			});
	});
}

var judge = function(grade){
	io.socket.get('/grade/toJudging/'+grade.id);
	grade.status = 'judging';

	util.log.judge("Received a new grade to judge");
	util.log.judge("Getting source file for the run");


	var sourceUrl = util.buildUrl({
		host: config.host,
		port: config.port,
		path: '/sources/'+grade.run.source
	});

	setTimeout(function(){
		util.httpGetContent(sourceUrl,function(err,data){
			var fileName = util.buildPath(['sources', grade.run.owner.username, 
				util.toSlug(grade.task.name), grade.run.id, util.getFileName(grade.run.source) ]);
			async.series([
					function(callback){
						fs.outputFile(fileName, data, callback);
					},
					function(callback){
						util.log.judge("Source file acquired. Beginning to judge");
						grader.compile(fileName, callback);
					}
				],function(err, results){
					if(err){
						if(err.compileError){
							saveCompileError(grade, err);
							util.log.warning(err);
						}else{
							util.log.error(err);
						}
						return;
					}
					util.log.judge("Source file compiled succesfully.");
					judgeTask(grade,results[1]);	
				});

		});
	},3000);
}

var getTestCase = function(testcase, callback){
	var inputFile = util.buildUrl({
		host: config.host,
		port: config.port,
		path: '/testcases/'+testcase.inputFile
	});

	var outputFile = util.buildUrl({
		host: config.host,
		port: config.port,
		path: '/testcases/'+testcase.outputFile
	});
	util.log.info("Fetching testcase "+testcase.id);
	async.parallel(
		[
		function(callback){
			util.httpGetContent(inputFile, callback);
		},
		function(callback){
			util.httpGetContent(outputFile, callback);
		}
		],
		function(err,results){
			if(err){ 
				callback(err); 
				return;
			}
			fs.outputFileSync('testcases/'+testcase.inputFile, results[0]);
			fs.outputFileSync('testcases/'+testcase.outputFile, results[1]);

			util.log.info("Testcase saved "+ testcase.id);
			callback();
		}
		)
}

var onTestcaseChange = function(obj){
	util.log.info("Getting updated testcases");
	if(obj.verb === "updated"){
		getTestCase(obj.previous, function(err){
			if(err){
				util.log.error(err);
				return;
			}
			util.log.info("Testcase updated");
		});
	}else if(obj.verb === "created"){
		setTimeout(function(){
			getTestCase(obj.data, function(err){
				if(err){
					util.log.error(err);
					return;
				}
				util.log.info("New Testcase saved");
			})},3000);
	};
}

var syncTestcases = function(callback){
	io.socket.post('/testcase/sync',{date: tmp.lastUpdate}, function(body, responseObj){
		async.each(body, getTestCase, function(err){
			callback();
		});
	});
}

var onConnect = function(){
	util.log.info("Initiating handshake with the server.");
	io.socket.post('/judgehost/handshake', {token: config.key}, function(body, responseObj){
		if(responseObj.statusCode !== 200){
			util.log.info('Handshake not successful');
			process.exit(1);
		}
		syncTestcases(subscribe);
    });
}


var onSubmission = function(grade){
	io.socket.get('/judgehost/unsubscribe');
	judge(grade);
}

util.log.info("Starting...");

//Reading config file
util.log.info("Reading config file...");
config = jsonfile.readFileSync('config.json');
util.log.info("Config file loaded.");
var configToShow = JSON.parse(JSON.stringify(config));
delete configToShow.key;
util.log.info("Config:");
util.log.info(configToShow);

//Reading TMP file
if(!fs.existsSync('tmp.json')){
	var newTmp = {
		lastUpdate: config.lastUpdate
	}
	jsonfile.writeFileSync('tmp.json',newTmp);
}
tmp = jsonfile.readFileSync('tmp.json');


io.sails.url = config.host+':'+config.port;

//define event actions
io.socket.on('connect', onConnect);
io.socket.on('submission', onSubmission);
io.socket.on('testcase', onTestcaseChange);
io.socket.on('message', function(event){
	util.log.info(event);
});