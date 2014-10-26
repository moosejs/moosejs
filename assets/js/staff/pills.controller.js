'use strict';

angular.module('mooseJs.staff')
	.controller('staff.PillsController', ["$scope", "socket", function($scope, socket){
		$scope.prints = 0;
		$scope.balloons = 0;

		socket.get('/print');
		socket.on('print', function(message){
			$scope.prints++;
		});

		socket.get('/balloon');
		socket.on('balloon', function(message){
			$scope.balloons++;
		});
	}]);