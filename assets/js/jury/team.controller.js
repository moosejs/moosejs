'use strict';

angular.module('mooseJs.jury')
	.controller('jury.TeamController', ["$scope", "socket", "$upload", function($scope, socket, $upload){
	
	socket.get('/task', function(data){
		$scope.tasks = data;
	});

	socket.get('/language', function(data){
		$scope.languages = data;
	});

	$scope.submit = {
		task: '',
		language: ''
	}

	$scope.$watch('source', function(value){
		if(value){
			var source = value[0];
			var fileName = source.name.split('.');
			for(var i=0, n=$scope.languages.length; i<n; i++){
				if($scope.languages[i].extension === fileName[fileName.length-1]){
					$scope.submit.language = $scope.languages[i].id;
					break;
				}
			}
			for(var i=0, n=$scope.tasks.length; i<n; i++){
				if($scope.tasks[i].code === fileName[0]){
					$scope.submit.task = $scope.tasks[i].id;
					break;
				}
			}
		}
	});

	$scope.submit = function(){
		$scope.errors = [];
		if(!$scope.source || !$scope.submit.task || !$scope.submit.language){
			$scope.errors.push('Please select a file and fill all the fields');
			return;
		}
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
				file: $scope.source[0],
				fileFormDataName: 'source',
				data: $scope.submit
			}).success(function(data){
				swal('Done!', 'Submission sent','success');
			}).error(function(data){
				swal('Error', 'Submission not sent', 'error');
			});
		});
	}
}]);