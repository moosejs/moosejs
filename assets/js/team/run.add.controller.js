'use strict';

angular.module('mooseJs.team')
.controller('team.RunAddController', ["$scope", "socket", "$upload", function($scope, socket, $upload){
	socket.get('/task/contest', function(data){
		$scope.tasks = data;
	});

	socket.get('/language', function(data){
		$scope.languages = data;
	});

	$scope.$watch('source', function(value){
		var source = value[0];
		var fileName = source.name.split('.');
		for(var i=0;i<$scope.languages.length; i++){
			if($scope.languages[i].extension === fileName.pop()){
				$scope.submit.language = $scope.languages[i].id;
				break;
			}
		}
		for(var i=0;i<$scope.tasks.length; i++){
			if($scope.tasks[i].code === fileName[0]){
				$scope.submit.task = $scope.tasks[i].id;
				break;
			}
		}
	});

	$scope.submit = function(){
		swal({
			title: 'Submitting solution',
			text: 'Are you sure?',
			type: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Yes, submit',
			closeOnConfirm: false
		}, function(){
			$upload.upload({
				url: '/run/submit',
				file: $scope.source,
				fileFormDataName: 'source',
				data: $scope.submit
			}).success(function(data){
				swal('Done!', 'Submission sent','success');
			});
		});
	}
}]);