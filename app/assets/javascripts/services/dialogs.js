/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';

Application.Services.factory('dialogs', ["$uibModal", $uibModal =>
    ({
      confirm(options, success, error){
        const defaultOpts = {
          templateUrl: '<%= asset_path "shared/confirm_modal.html" %>',
          size: 'sm',
          resolve: {
            object() {
              return {
                title: 'Titre de confirmation',
                msg: 'Message de confirmation'
              };
            }
          },
          controller: ['$scope', '$uibModalInstance', '$state', 'object', function($scope, $uibModalInstance, $state, object) {
            $scope.object = object;
            $scope.ok = info => $uibModalInstance.close( info );
            return $scope.cancel = () => $uibModalInstance.dismiss('cancel');
          }
          ]
        };
        if (angular.isObject(options)) { angular.extend(defaultOpts, options); }
        return $uibModal.open(defaultOpts)
        .result['finally'](null).then(function(info){
          if (angular.isFunction(success)) {
            return success(info);
          }
        }
        , function(reason){
          if (angular.isFunction(error)) {
            return error(reason);
          }
        });
      }
    })
  
  ]);
