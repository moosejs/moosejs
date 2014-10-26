'use strict';

angular.module('mooseJs.team')
.controller('team.ClarificationsAddController', ["$scope", "$sce", "$state", "socket", "LocalService", function($scope, $sce, $state, socket, LocalService){
	$scope.subjects = [{name: 'General Issue'}];
	socket.get('/task', function(data){
		$scope.subjects.push.apply($scope.subjects, data);
	});

	$scope.trustAsHtml = function(value) {
		return $sce.trustAsHtml(value);
	};
	$scope.submitClarification = function(){
		//TODO: Remove token from data
		$scope.clarification.token = angular.fromJson(LocalService.get('auth_token')).token;
		socket.post('/clarification', $scope.clarification, function(){
			$scope.clarification = {};
			$state.go('team.clarifications');
		});
	}
}]);