/* global angular */
(function(){
    'use strict';

    angular.module('Auth', [
        'ngCookies',
        'LocalStorageModule',
        'ui.router'
    ])
    
    .config(
                ['localStorageServiceProvider',
        function( localStorageServiceProvider ){
            // Remove the default prefix on localStorage
            localStorageServiceProvider.setPrefix('');
        }
    ])

    .run(
                ['$rootScope', 'Auth',
        function( $rootScope,   Auth ){
            // Provide access to Auth methods from views, e.g. <div ng-show="Auth.isAuthenticated()">Hello {{username}}</div>
            $rootScope.Auth = Auth;
        }
    ])

    // Login Controller
    // ---------------------------------------------
    // Simple controller for login form submission
    .controller(
            'loginController', 
            ['$scope', '$state', 'localStorageService', 'Auth', '$timeout', '$rootScope', '$cookies',
    function( $scope,   $state,   localStorageService,   Auth,   $timeout,   $rootScope,   $cookies ) {

        $scope.creds = {};
        $scope.creds.email = $cookies.get(Auth.getPrefix()+'.auth.user.email');
        $scope.creds.password = '';
        $scope.creds.remember = ($scope.creds.email) ? true : false;
        $scope.showMessage = false;

        $scope.login = function(credentials){
            Auth.login(credentials).then(
                function(response){

                },
                function(error){
                    $scope.showMessage = true;
                    $scope.creds.password = '';
                    
                    $scope.loginForm.$setPristine();
                    $scope.loginForm.email.$touched = false;
                    $scope.loginForm.password.$touched = false;
                }
            );
        };
    }])

    // Password Controller
    // ---------------------------------------------
    // Deal with password reset email requests and clicked reset links
    .controller(
            'passwordController', 
            ['$scope', '$state', '$stateParams', 'localStorageService', 'Auth', '$rootScope',
    function( $scope,   $state,   $stateParams,   localStorageService,   Auth,   $rootScope ) {

        $scope.creds = {
            email: $stateParams.email,
            token: $stateParams.token,
            password: '',
            password_confirmation: ''
        };

        if( $state.includes('reset') && (!$stateParams.email || !$stateParams.token) ){
            $state.go(Auth.loggedOut_state);
        } 

        $scope.submitPasswordRequest = function(credentials){
            console.log(credentials);
            Auth.requestPasswordReset({
                email: credentials.email
            }).then(
                function(response){
                    if( response.status === 200 ){
                        $scope.message = $rootScope.content.login_password_request_success;
                        $scope.passwordResetFail = false;
                    } else {
                        $scope.message = $rootScope.content.login_password_request_fail; 
                    }
                },
                function(error){
                    $scope.message = $rootScope.content.login_password_request_fail; 
                }
            );
        };

        $scope.submitPasswordReset = function(credentials){
            console.log(credentials);
            Auth.resetPassword(credentials).then(
                function(response){
                    console.log(response);
                    $scope.message = $rootScope.content.login_password_reset_success; 
                    $scope.passwordResetSuccess = true;
                },
                function(error){
                    // alert('ERROR');
                    console.log(error);
                    $scope.message = $rootScope.content.login_password_reset_fail;
                    $scope.passwordResetFail = true;
                }
            );
        };
    }])

    // Auth Provider
    // -------------
    .provider(
        'Auth', function(){

        var auth_url = '';
        var loggedIn_state = '';
        var loggedOut_state = '';
        var prefix = '';

        // Parameter setters (called from App config)
        this.set_auth_url = function(value){
            auth_url = value;
        };

        this.set_loggedIn_state = function(value){
            loggedIn_state = value;
        };

        this.set_loggedOut_state = function(value){
            loggedOut_state = value;
        };

        this.set_prefix = function(value){
            prefix = value;
        };

        // Auth Service
        // ------------
        this.$get = ['localStorageService', '$rootScope', '$q', '$injector', '$timeout', '$cookies',
            function( localStorageService,   $rootScope,   $q,   $injector,   $timeout,   $cookies ){
                
                var service = {};

                service.loggedIn_state = loggedIn_state;
                service.loggedOut_state = loggedOut_state;

                var tokenKey = prefix+'.auth.token';
               
                // Parse the JWT token to retrieve the User ID
                var parseToken = function(token){
                    var userObjEncoded = token.split('.')[1];
                    var userObj = JSON.parse(atob(userObjEncoded));
                    var userId = userObj.sub;
                    return userId;
                };

                // Load the stored token (if any)
                var storedToken = localStorageService.get(tokenKey);
                service.userId = (storedToken) ? parseToken(storedToken) : null;

                // Determine whether user has logged in before (useful for onboarding/tutorials on how to use the app)
                var vars = {
                    firstVisit: ( $cookies.get(prefix+'.auth.user.'+service.userId+'.returningUser') ) ? false : true 
                };

                // Utility function to get the user's ID
                service.getUserId = function(){
                    if( !service.isAuthenticated() ){
                        return false;
                    }

                    if( service.userId === null ){
                        service.userId = parseToken( localStorageService.get(tokenKey) );
                    }

                    return service.userId;
                };

                // LOGIN
                service.login = function(creds){

                    var deferred = $q.defer();
                    var $http = $injector.get('$http');
                    
                    $http.post(auth_url, creds)
                    .success(function(response){
                        
                        localStorageService.set(tokenKey, response.token);

                        // Set user ID here
                        service.userId = parseToken(response.token);

                        // Set cookie expiry date
                        var exp = new Date();
                        exp.setDate(exp.getDate()+30);
                        var cookieOptions = {
                            expires: exp
                        };

                        if( $cookies.get(prefix+'.auth.user.'+service.userId+'.returningUser') ){
                            vars.firstVisit = false;
                        } else {
                            vars.firstVisit = true;
                            $timeout(function(){
                                $cookies.put(prefix+'.auth.user.'+service.userId+'.returningUser', 1, cookieOptions);
                            });
                            
                        }
                       
                        if( creds.remember ){
                            $cookies.put(prefix+'.auth.user.email', creds.email, cookieOptions);
                        } else {
                            $cookies.remove(prefix+'.auth.user.email');
                        }
                        
                        $rootScope.$broadcast('AUTH:LOGIN', service.userId);

                        var $state = $injector.get('$state');
                            $state.go(service.loggedIn_state, null, {location: 'replace'});
                        
                        deferred.resolve();
                    })
                    .error(function(error, status){
                        deferred.reject();
                    });

                    return deferred.promise;
                };

                
                // LOGOUT
                service.logout = function(noRedirect){
                    localStorageService.remove(tokenKey);
                    service.userId = null;
                    
                    var $http = $injector.get('$http');
                    $http.get('/logout').then(function(response){
                        console.log('logging out');
                        $timeout(function(){
                            $rootScope.$broadcast('AUTH:LOGOUT');

                            if( !noRedirect ){
                                var $state = $injector.get('$state');
                                $state.go(service.loggedOut_state, null, {location: 'replace'});
                            }
                        });
                    });
                };

                service.isAuthenticated = function(redirect){
                    if( localStorageService.get(tokenKey) ){
                        //service.userId = parseToken(localStorageService.get(tokenKey));
                        return true;
                    } else {
                        if( redirect ){
                            var $state = $injector.get('$state');
                            $timeout(function(){
                                $state.go(service.loggedOut_state, null, {location: 'replace'});
                            });
                        }
                        return false;
                    }
                };

                service.isNotAuthenticated = function(redirect){
                    if( !localStorageService.get(tokenKey) ){
                        return true;
                    } else {
                        if( redirect ){
                            var $state = $injector.get('$state');
                            $timeout(function(){
                                $state.go(service.loggedIn_state, null, {location: 'replace'});
                            });
                        }
                        return false;
                    }
                };

                service.requestPasswordReset = function(creds){
                    var $http = $injector.get('$http');
                    creds.url_path = prefix+'/'+$rootScope.lang+'/#/password/reset/{email}/{token}';
                    if( service.userType === 'profile' ){
                        creds.url_path.replace('profile/', '');
                    }

                    // console.log('request email');
                    return $http.post('/'+prefix+'/password/email', creds);
                };

                service.resetPassword = function(creds){
                    var $http = $injector.get('$http');
                    return $http.post('/'+prefix+'/password/reset', creds);
                };

                service.getPrefix = function(){
                    return prefix;
                };

                service.isFirstVisit = function(){
                    if( vars.firstVisit ){
                        return true;
                    } else {
                        return false;
                    }
                };

                return service;
            }
        ];

    })
    
    // Auth Interceptor
    // ----------------
    // Send the JWT token with every HTTP request and deal with 'unauthorised' server responses
    
    .factory('authInterceptor', [
             'localStorageService', '$rootScope', '$q', 'Auth',
    function( localStorageService,   $rootScope,   $q,   Auth ) {

        // Don't intercept any URLs that contain the following strings:
        var ignore = ['amazon', 'templates'];

        var tokenKey = Auth.getPrefix()+'.auth.token';

        // Checks string for matches against substring array
        function containsAny(substrings, string){
            for (var i = 0; i !== substrings.length; i++) {
                var substring = substrings[i];
                    if (string.indexOf(substring) !== - 1) {
                    return substring;
                }
            }
            return false; 
        }

        return {

            request: function(config){
                if( !containsAny(ignore, config.url) ){
                    var token = localStorageService.get(tokenKey);
                    if( token ){
                        config.headers.Authorization = 'Bearer '+token;
                    }
                }
                return config;
            },

            response: function(response){
                var authHeader = response.headers('Authorization');
                if( authHeader ){
                    var token = authHeader.replace('Bearer ', '');
                    // console.log(token);
                    localStorageService.set(tokenKey, token);
                }
                return $q.resolve(response);
            },

            responseError: function(response){
                if( response.status === 401 || (response.data && response.data.error === 'token_invalid') ){
                    console.log('UNAUTHORISED');
                    Auth.logout();
                } 
                return $q.reject(response); 
            }
        };
    }])
    ;

}());