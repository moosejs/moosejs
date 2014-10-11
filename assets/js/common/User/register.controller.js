'use strict';

angular.module('mooseJs.common')
.controller('common.RegisterController', ["$scope", "$state", "User", function($scope, $state, User){
	
	$scope.user = {
		username : '',
		name : '',
		email : '',
		role : 'team',
		password : '',
		members: ''
	};
	$scope.errors = [];
	$scope.register = function(){
		$scope.errors = [];
		User.save($scope.user, 
			function(data){
		        	//TODO
		        		$state.go('admin.home');
		        	},
        function(error){
        	$scope.errors.push({message: error.data.summary});
        });
	};
	
}]);