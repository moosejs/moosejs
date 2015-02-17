'use strict';

module.exports = {
	addUser: function(user, contest){
		Task.find({ contest: contest }).populate('subtasks').exec(function(err, tasks){
			if(err){ 
				sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
			}
			async.map(tasks, function(task, callback){

				async.map(task.subtasks, function(subtask, cb){
					Scoreboard.create({ contest: task.contest, user: user, task: task.id, subtask: subtask.id}).exec(function(err, res){
						
						cb(err, res);
					});
				}, function(err, results){
						callback(err, results);
				});

			},function(err, results){
				if(err){ 
					sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
				}
				Scoreboard.publishCreate({
					id: user,
					rows: results
				});
			})
			
		});
	},

	deleteUser: function(users){
		async.each(users, function(user, callback){
			Scoreboard.destroy({user: user.id}).exec(function(err, res){
				if(err){ 
					callback(err);
					return;
				}
				if(res && res[0]){
					Scoreboard.publishDestroy(res[0].id);
				}
				callback();
			}, function(err){
				if(err){ 
					sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
				}
			});
		});
	},

	removeUserFromContest: function(user, contest){
		Scoreboard.destroy({user: user, contest: contest}).exec(function(err, res){
			if(err){ 
				sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
			}
			if(res && res[0]){
				Scoreboard.publishDestroy(res[0].id);
			}
		});
	},

	addTask: function(task, finished){
		Contest.findOne({ id: task.contest}).populate('users').exec(function(err,contest){
			if(err){
				sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
			}
			async.map(contest.users, function(user, callback){
				if(user.role === 'jury' || user.role === 'team'){
					async.map(task.subtasks, function(subtask, cb){
						Scoreboard.create({ contest: task.contest, user: user.id, task: task.id, subtask: subtask.id}).exec(function(err, res){
							
							cb(err,res);
						});
					}, function(err,results){
						callback(err, results);
					});
				}else{
					callback();
				}
			}, function(err, results){
				if(err){ 
					sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
				}
				Scoreboard.publishCreate(results);
				if(finished) finished();
			});
		});
	},

	deleteTask: function(tasks, cb){
		async.each(tasks, function(task, callback){
			Scoreboard.destroy({task: task.id}).exec(function(err, res){
				if(err){ 
					callback(err);
					return;
				}
				if(res && res[0]){
					Scoreboard.publishDestroy(res[0].id);
				}
				callback();
			});
		}, function(err){
			if(err){ 
				sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
			}
			if(cb) cb();
		});
	},

	addSubtask: function(subtask){
		Task.findOne(subtask.task).exec(function(err, task){
			if(err){
				sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
			}
			Contest.findOne(task.contest).populate('users').exec(function(err, contest){
				if(err){
					sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
				}
				async.map(contest.users, function(user, callback){
					if(user.role === 'jury' || user.role === 'team'){
						Scoreboard.create({ contest: contest.id, user: user.id, task: task.id, subtask: subtask.id}).exec(function(err, res){
							callback(err,res);
						});
					}
				}, function(err, results){
					if(err){ 
						sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
					}
					Scoreboard.publishCreate({
						id: 1,
						rows: results
					});
				});
			});
		});
	},

	deleteSubtask: function(subtasks){
		async.each(subtasks, function(subtask, callback){
			Scoreboard.destroy({subtask: subtask.id}).exec(function(err, res){
				if(err){ 
					callback(err);
					return;
				}
				if(res && res[0]){
					Scoreboard.publishDestroy(res[0].id);
				}
				callback();
			}, function(err){
				if(err){ 
					sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
				}
			});
		});
	},

	update: function(grade, veredicts){
		/**
		
			- Get previous result for that task
			- Compare subtask to subtask to see which one of the runs is better
			- Update if needed
		
		**/
		
		GradeService.getRunResult(grade.run, function(err, response){
			if(err){
				sails.log.err("Error building scoreboard. Please refresh scoreboard"); return;
			}
			if(response.run.owner.role !== 'team'){
				return;
			}
			Scoreboard.find({ where: {user: response.run.owner.id, task: response.task.id}, sort: 'subtask'}).exec(function(err, rows){
				if(err){
					sails.log.err("Error building scoreboard. Please refresh scoreboard"); 
					return;
				}

				//Get the score points from the previous submit and the next one
				var subTaskUtil = {};
				var previousScore = rows.map(function(current){
					return current.points;
				}).reduce(function(prev,next){
					return prev+next;
				});
				
				var nextScore = veredicts.map(function(current){
					subTaskUtil[current.id] = {
						points : current.points,
						veredict : current.veredict,
						autojudge : current.autojudge,
						jury: current.owner
					};
					return current.veredict === 'accepted' ? parseInt(current.points) : 0;
				}).reduce(function (prev, next){
					return prev + next;
				});

				// update each subtask entry in the scoreboard
				async.each(rows, function(item, cb){
					item.submissions = parseInt(item.submissions) + 1;

					// update results if needed
					if(nextScore > previousScore){
						if(subTaskUtil[item.subtask].veredict === 'accepted'){
							item.points = subTaskUtil[item.subtask].points;
							item.isCorrect = true;
							item.jury = subTaskUtil[item.subtask].jury;
						}else{
							item.points = 0;
							item.isCorrect = false;
							item.jury = subTaskUtil[item.subtask].jury;
						}
						item.juryModified = subTaskUtil[item.subtask].veredict !== subTaskUtil[item.subtask].autojudge;
						item.time = response.run.time;
						item.penalty = (item.submissions - 1) * response.contest.penalty;
					}
					item.save();
					cb();
				}, function(err){
					if(err){
						sails.log.err("Error building scoreboard. Please refresh scoreboard"); 
						return;
					}
					Scoreboard.publishUpdate(rows[0].id, rows);
				});					

			});
		});
	},
	findScoreboardJury: function(contestId, callback){
		Scoreboard.find({ contest: contestId }).exec(callback);
	},
	findScoreboardTeam: function(userId, callback){
		ContestService.getActiveContest(userId, function(err, contest){
			if(err){
				callback(err); return;
			}
			ScoreboardPublic.find({ contest: contest.id}).exec(callback);
		});
	},
	findScoreboardPublic: function(contestId, callback){
		Contest.findOne(contestId).exec(function(err, contest){
			if(err){
				callback(err); return;
			}
			if(contest){
				var currentTime = new Date();
				if(new Date(contest.unfreezeTime) < currentTime){
					Scoreboard.find({ contest: contestId }).exec(callback);
				}else{
					ScoreboardPublic.find({ contest: contestId }).exec(callback);
				}
			}else{
				return [];
			}
		});
	}
}