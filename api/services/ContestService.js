'use strict';
var AdmZip = require('adm-zip');
var fs = require('fs-extra');

module.exports = {
	/**
	*
	* function to find the active contest for a given user
	*
	**/
	getActiveContest: function(userId, callback){
		var curTime = new Date();
		User.findOne(userId).populate('contests').exec(function(err, user){
			if(err){
				callback(err);
				return;
			}
			for(var i=0;i<user.contests.length;i++){
				var contest = user.contests[i];
				if(new Date(contest.startTime) < curTime && curTime < new Date(contest.unfreezeTime)){
					callback(null, contest);
					return;
				}
			}
			callback(null, []);
		});
	},

	saveFromJson: function(contest, callback){
		contest.set = true;
		contest.tasks.forEach(function(task, index){
			var subtasks = task.subtasks.slice();
			delete task.subtasks;
			task.contest = contest.id;
			Task.create(task).exec(function(err, newTask){
				subtasks.forEach(function(subtask, subIndex){
					var testcasesN = subtask.testcases;
					delete subtask.testcases;
					subtask.task = newTask.id;
					Subtask.create(subtask).exec(function(err, newSubTask){
						var testcases = []; testcases.length = testcasesN;
						for(var i=0;i<testcasesN;i++){
							testcases[i] = {
								subtask: newSubTask.id,
								inputFile: '',
								outputFile: ''
							}
						}
						Testcase.create(testcases).exec(function(err, newTestcases){
							delete contest.users;
							delete contest.tasks;
							Contest.update({id: contest.id}, contest).exec(callback);
						});
					});
					
				});

			});
		});
	},
	
	saveFromZip: function(id, file, cb){
		file.upload({
			saveAs: 'contest.zip',
			maxBytes: Number.MAX_VALUE
		}, function(err, up){
			if(err){ cb(err); return; }
			var zip = new AdmZip(up[0].fd);
			var contestData = JSON.parse(zip.readAsText('contest.json'));
			contestData.id = id;
			ContestService.saveFromJson(contestData, function(err, contests){
				if(err){ cb(err); return; }
				var contest = contests[0];
		 		var contestName = contest.id;
				Task.find({contest: contest.id}).populate('subtasks').exec(function(err, tasks){
					async.each(tasks, function(task, finishedTask){
						var taskName = URLService.toSlug(task.code);
						fs.mkdirs(sails.config.appPath + '/assets/statements/', function(err){
							zip.extractEntryTo('tasks/'+task.code+'/'+task.code+'.pdf', sails.config.appPath + '/assets/statements/'+contestName+'/'+task.code+'/', false, true);
						});
						task.subtasks.forEach(function(subtask, subtaskIndex){
							var dirName =  contestName+"/"+taskName+"/"+subtask.id+"/";
							fs.mkdirs(sails.config.appPath + '/protected/testcases/' + dirName, function(err){
								if(err){ cb(err); return; }
								Testcase.find({subtask: subtask.id}).exec(function(err, testcases){
									if(err){ cb(err); return; }
									testcases.forEach(function(testcase, index){
										var from = 'tasks/'+task.code+'/'+(subtaskIndex+1)+'/'+(index+1);
										var to = sails.config.appPath + "/protected/testcases/" + dirName;
										zip.extractEntryTo(from+'.in', to, false, true);
										zip.extractEntryTo(from+'.out', to, false, true);
										fs.renameSync(to+(index+1)+'.in', to+testcase.id+'.in');
										fs.renameSync(to+(index+1)+'.out', to+testcase.id+'.out');
										testcase.inputFile = dirName + testcase.id + '.in';
										testcase.outputFile = dirName + testcase.id + '.out';
										testcase.save(function(){
											Testcase.publishUpdate(testcase.id);
										});
									});
								});
							});
						});
						finishedTask();
					}, function(err){
						cb(err, contest);
						return;
					});
				});
			});
		});
	}

}