### Angular Auth Module

An authentication module for AngularJS 1.x, based on the JSON Web Tokens (JWT) authentication standard.

The module consists of: 
- Provider/service for login/logout methods
- a $http interceptor that adds the stored JWT token to every $http request header
- Controllers for login and forgot password forms

Dependencies:
- [Angular UI Router](https://github.com/angular-ui/ui-router) (for login/logout state redirects)
- [angular-local-storage](https://github.com/grevory/angular-local-storage) (for JWT token storage)
- [ngCookies](https://github.com/angular/bower-angular-cookies) (for username "remember me" checkbox functionality)

Example usage (in your app config):
	
	angular.module('myApp', [
        'ui.router',
        'Auth'
    ])
	.config(    ['$httpProvider', 'AuthProvider', '$stateProvider', '$urlRouterProvider',
        function( $httpProvider,   AuthProvider,   $stateProvider,   $urlRouterProvider ){ 

        	// API endpoint to send login details
            AuthProvider.set_auth_url('/path/to/login'); 

            // Redirect here on successful login
            AuthProvider.set_loggedIn_state('loggedIn_state_name'); 

            // Redirect here when unauthenticated
            AuthProvider.set_loggedOut_state('loggedOut_state_name'); 

            // Set a prefix to avoid clashes with any other apps on the same domain that might be using this module
            AuthProvider.set_prefix('myApp'); 

     		// Use the auth Interceptor for all HTTP requests
            $httpProvider.interceptors.push('authInterceptor');


            // Resolve functions - called from the below UI router state definitions
            // ---------------------------------------------------------------------
            
            // Check if logged in
            var loggedIn = ['Auth', function(Auth){
                return Auth.isAuthenticated('redirect');
            }];

            // Check if logged out
            var loggedOut = ['Auth', function(Auth){
                return Auth.isNotAuthenticated('redirect');
            }];

            // Get the user's profile data from another service
            var getProfile = ['Profile', function(Profile){
                return Profile.get();
            }];

            
            // State definitions
            // ---------------------------------------------------------------------
            // Example auth/password routes and a logged in 'dashboard' route
            // Resolve functions are used to check user's auth status and retrieve 
            // any data before changing the state

            $stateProvider
                .state('auth', {
                    abstract:true,
                    templateUrl: '/templates/auth.html'
                })
                .state('login', {
                    url: '/login',
                    parent: 'auth',
                    templateUrl: '/templates/login-form.html',
                    controller: 'loginController',
                    resolve: {
                        loggedOut: loggedOut,
                    }   
                })
                .state('password-request', {
                    url: '/password/request/{email}',
                    parent: 'auth',
                    templateUrl: '/templates/password-form.html',
                    controller: 'passwordController',
                    resolve: {
                        loggedOut: loggedOut,
                    }        
                })
                .state('password-reset', {
                    url: '/password/reset/{email}/{token}',
                    parent: 'auth',
                    templateUrl: '/templates/password-form.html',
                    controller: 'passwordController',
                    resolve: {
                        loggedOut: loggedOut,
                    }        
                })
            	.state('dashboard', {
                    url: '/dashboard',
                    templateUrl: '/templates/dashboard.html',
                    controller: 'dashboardController',
                    resolve: {
                        loggedIn: loggedIn
                        profile: getProfile
                    }
                })
        }
    ]);
