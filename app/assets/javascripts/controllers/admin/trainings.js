/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';

/* COMMON CODE */

//#
// Provides a set of common callback methods to the $scope parameter. These methods are used
// in the various trainings' admin controllers.
//
// Provides :
//  - $scope.submited(content)
//  - $scope.fileinputClass(v)
//  - $scope.onDisableToggled
//
// Requires :
//  - $state (Ui-Router) [ 'app.admin.trainings' ]
//  - $scope.training
//#
class TrainingsController {
  constructor($scope, $state) {

    //#
    // For use with ngUpload (https://github.com/twilson63/ngUpload).
    // Intended to be the callback when the upload is done: any raised error will be stacked in the
    // $scope.alerts array. If everything goes fine, the user is redirected to the trainings list.
    // @param content {Object} JSON - The upload's result
    //#
    $scope.submited = function(content) {
      if ((content.id == null)) {
        $scope.alerts = [];
        return angular.forEach(content, (v, k)=>
          angular.forEach(v, err=>
            $scope.alerts.push({
              msg: k+': '+err,
              type: 'danger'
            })
          )
        );
      } else {
        return $state.go('app.admin.trainings');
      }
    };



    //#
    // Changes the current user's view, redirecting him to the machines list
    //#
    $scope.cancel = () => $state.go('app.admin.trainings');



    //#
    // Force the 'public_page' attribute to false when the current training is disabled
    //#
    $scope.onDisableToggled = () => $scope.training.public_page = !$scope.training.disabled;



    //#
    // For use with 'ng-class', returns the CSS class name for the uploads previews.
    // The preview may show a placeholder or the content of the file depending on the upload state.
    // @param v {*} any attribute, will be tested for truthiness (see JS evaluation rules)
    //#
    $scope.fileinputClass = function(v){
      if (v) {
        return 'fileinput-exists';
      } else {
        return 'fileinput-new';
      }
    };
  }
}



//#
// Controller used in the training creation page (admin)
//#
Application.Controllers.controller("NewTrainingController", [ '$scope', '$state', 'machinesPromise', 'CSRF'
, function($scope, $state, machinesPromise, CSRF) {



  /* PUBLIC SCOPE */

  //# Form action on the following URL
  $scope.method = 'post';

  //# API URL where the form will be posted
  $scope.actionUrl = '/api/trainings/';

  //# list of machines
  $scope.machines = machinesPromise;



  /* PRIVATE SCOPE */

  //#
  // Kind of constructor: these actions will be realized first when the controller is loaded
  //#
  const initialize = function() {
    CSRF.setMetaTags();

    //# Using the TrainingsController
    return new TrainingsController($scope, $state);
  };


  //# !!! MUST BE CALLED AT THE END of the controller
  return initialize();
}
]);



//#
// Controller used in the training edition page (admin)
//#
Application.Controllers.controller("EditTrainingController", [ '$scope', '$state', '$stateParams', 'trainingPromise', 'machinesPromise', 'CSRF'
, function($scope, $state, $stateParams, trainingPromise, machinesPromise, CSRF) {



  /* PUBLIC SCOPE */

  //# Form action on the following URL
  $scope.method = 'patch';

  //# API URL where the form will be posted
  $scope.actionUrl = `/api/trainings/${$stateParams.id}`;

  //# Details of the training to edit (id in URL)
  $scope.training = trainingPromise;

  //# list of machines
  $scope.machines = machinesPromise;



  /* PRIVATE SCOPE */

  //#
  // Kind of constructor: these actions will be realized first when the controller is loaded
  //#
  const initialize = function() {
    CSRF.setMetaTags();

    //# Using the TrainingsController
    return new TrainingsController($scope, $state);
  };


  //# !!! MUST BE CALLED AT THE END of the controller
  return initialize();
}
]);




//#
// Controller used in the trainings management page, allowing admins users to see and manage the list of trainings and reservations.
//#
Application.Controllers.controller("TrainingsAdminController", ["$scope", "$state", "$uibModal", 'Training', 'trainingsPromise', 'machinesPromise', '_t', 'growl', 'dialogs'
, function($scope, $state, $uibModal, Training, trainingsPromise, machinesPromise, _t, growl, dialogs) {



  /* PUBLIC SCOPE */

  //# list of trainings
  let groupAvailabilities;
  $scope.trainings = trainingsPromise;

  //# simplified list of machines
  $scope.machines = machinesPromise;

  //# Training to monitor, binded with drop-down selection
  $scope.monitoring =
    {training: null};

  //# list of training availabilies, grouped by date
  $scope.groupedAvailabilities = {};

  //# default: accordions are not open
  $scope.accordions = {};

  //# Binding for the parseInt function
  $scope.parseInt = parseInt;

  //# Default: we show only enabled trainings
  $scope.trainingFiltering = 'enabled';

  //# Available options for filtering trainings by status
  $scope.filterDisabled = [
    'enabled',
    'disabled',
    'all',
  ];

  //#
  // In the trainings listing tab, return the stringified list of machines associated with the provided training
  // @param training {Object} Training object, inherited from $resource
  // @returns {string}
  //#
  $scope.showMachines = function(training) {
    const selected = [];
    angular.forEach($scope.machines, function(m) {
      if (training.machine_ids.indexOf(m.id) >= 0) {
        return selected.push(m.name);
      }
    });
    if (selected.length) { return selected.join(', '); } else { return _t('none'); }
  };



  //#
  // Removes the newly inserted but not saved training / Cancel the current training modification
  // @param rowform {Object} see http://vitalets.github.io/angular-xeditable/
  // @param index {number} training index in the $scope.trainings array
  //#
  $scope.cancelTraining = function(rowform, index) {
    if ($scope.trainings[index].id != null) {
      return rowform.$cancel();
    } else {
      return $scope.trainings.splice(index, 1);
    }
  };



  //#
  // In the trainings monitoring tab, callback to open a modal window displaying the current bookings for the
  // provided training slot. The admin will be then able to validate the training for the users that followed
  // the training.
  // @param training {Object} Training object, inherited from $resource
  // @param availability {Object} time slot when the training occurs
  //#
  $scope.showReservations = (training, availability) =>
    $uibModal.open({
      templateUrl: '<%= asset_path "admin/trainings/validTrainingModal.html" %>',
      controller: ['$scope', '$uibModalInstance', function($scope, $uibModalInstance) {
        $scope.availability = availability;

        $scope.usersToValid = [];

        //#
        // Mark/unmark the provided user for training validation
        // @param user {Object} from the availability.reservation_users list
        //#
        $scope.toggleSelection = function(user) {
          const index = $scope.usersToValid.indexOf(user);
          if (index > -1) {
            return $scope.usersToValid.splice(index, 1);
          } else {
            return $scope.usersToValid.push(user);
          }
        };

        //#
        // Validates the modifications (training validations) and save them to the server
        //#
        $scope.ok = function() {
          const users = $scope.usersToValid.map(u => u.id);
          return Training.update({id: training.id}, {
            training: {
              users
            }
          }
          , function() { // success
            angular.forEach($scope.usersToValid, u => u.is_valid = true);
            $scope.usersToValid = [];
            return $uibModalInstance.close(training);
          });
        };

        //#
        // Cancel the modifications and close the modal window
        //#
        return $scope.cancel = () => $uibModalInstance.dismiss('cancel');
      }
      ]})
  ;



  //#
  // Delete the provided training and, in case of sucess, remove it from the trainings list afterwards
  // @param index {number} index of the provided training in $scope.trainings
  // @param training {Object} training to delete
  //#
  $scope.removeTraining = (index, training)=>
    dialogs.confirm({
      resolve: {
        object() {
          return {
            title: _t('confirmation_required'),
            msg: _t('do_you_really_want_to_delete_this_training')
          };
        }
      }
    }
    , () => // deletion confirmed
      training.$delete(function() {
        $scope.trainings.splice(index, 1);
        return growl.info(_t('training_successfully_deleted'));
      }
      , error=> growl.warning(_t('unable_to_delete_the_training_because_some_users_alredy_booked_it')))
    )
  ;



  //#
  // Takes a month number and return its localized literal name
  // @param {Number} from 0 to 11
  // @returns {String} eg. 'janvier'
  //#
  $scope.formatMonth = function(number) {
    number = parseInt(number);
    return moment().month(number).format('MMMM');
  };



  //#
  // Given a day, month and year, return a localized literal name for the day
  // @param day {Number} from 1 to 31
  // @param month {Number} from 0 to 11
  // @param year {Number} Gregorian's year number
  // @returns {String} eg. 'mercredi 12'
  //#
  $scope.formatDay = function(day, month, year) {
    day = parseInt(day);
    month = parseInt(month);
    year = parseInt(year);

    return moment({year, month, day}).format('dddd D');
  };



  //#
  // Callback when the drop-down selection is changed.
  // The selected training details will be loaded from the API and rendered into the accordions.
  //#
  $scope.selectTrainingToMonitor = () =>
    Training.availabilities({id: $scope.monitoring.training.id}, function(training) {
      $scope.groupedAvailabilities = groupAvailabilities([training]);
      // we open current year/month by default
      const now = moment();
      $scope.accordions[training.name] = {};
      $scope.accordions[training.name][now.year()] =
        {isOpenFirst: true};
      return $scope.accordions[training.name][now.year()][now.month()] =
        {isOpenFirst: true};
    })
  ;



  /* PRIVATE SCOPE */

  //#
  // Group the trainings availabilites by trainings and by dates and return the resulting tree
  // @param trainings {Array} $scope.trainings is expected here
  // @returns {Object} Tree constructed as /training_name/year/month/day/[availabilities]
  //#
  return groupAvailabilities = function(trainings) {
    const tree = {};
    for (let training of Array.from(trainings)) {
      tree[training.name] = {};
      tree[training.name].training = training;
      for (let availability of Array.from(training.availabilities)) {
        const start = moment(availability.start_at);

        // init the tree structure
        if (typeof tree[training.name][start.year()] === 'undefined') {
          tree[training.name][start.year()] = {};
        }
        if (typeof tree[training.name][start.year()][start.month()] === 'undefined') {
          tree[training.name][start.year()][start.month()] = {};
        }
        if (typeof tree[training.name][start.year()][start.month()][start.date()] === 'undefined') {
          tree[training.name][start.year()][start.month()][start.date()] = [];
        }

        // add the availability at its right place
        tree[training.name][start.year()][start.month()][start.date()].push( availability );
      }
    }
    return tree;
  };
}

]);
