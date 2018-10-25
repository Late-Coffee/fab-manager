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
// in the various machines' admin controllers.
//
// Provides :
//  - $scope.submited(content)
//  - $scope.cancel()
//  - $scope.fileinputClass(v)
//  - $scope.addFile()
//  - $scope.deleteFile(file)
//
// Requires :
//  - $scope.machine.machine_files_attributes = []
//  - $state (Ui-Router) [ 'app.public.machines_list' ]
//#
class MachinesController {
  constructor($scope, $state){
    //#
    // For use with ngUpload (https://github.com/twilson63/ngUpload).
    // Intended to be the callback when the upload is done: any raised error will be stacked in the
    // $scope.alerts array. If everything goes fine, the user is redirected to the machines list.
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
        return $state.go('app.public.machines_list');
      }
    };

    //#
    // Changes the current user's view, redirecting him to the machines list
    //#
    $scope.cancel = () => $state.go('app.public.machines_list');

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

    //#
    // This will create a single new empty entry into the machine attachements list.
    //#
    $scope.addFile = () => $scope.machine.machine_files_attributes.push({});

    //#
    // This will remove the given file from the machine attachements list. If the file was previously uploaded
    // to the server, it will be marked for deletion on the server. Otherwise, it will be simply truncated from
    // the attachements array.
    // @param file {Object} the file to delete
    //#
    $scope.deleteFile = function(file) {
      const index = $scope.machine.machine_files_attributes.indexOf(file);
      if (file.id != null) {
        return file._destroy = true;
      } else {
        return $scope.machine.machine_files_attributes.splice(index, 1);
      }
    };
  }
}



//#
// Manages the transition when a user clicks on the reservation button.
// According to the status of user currently logged into the system, redirect him to the reservation page,
// or display a modal window asking him to complete a training before he can book a machine reservation.
// @param machine {{id:number}} An object containg the id of the machine to book,
//   the object will be completed before the fonction returns.
// @param e {Object} see https://docs.angularjs.org/guide/expression#-event-
//#
const _reserveMachine = function(machine, e) {
  const _this = this;
  e.preventDefault();
  e.stopPropagation();

  // retrieve the full machine object
  return machine = _this.Machine.get({id: machine.id}, function() {

    // if the currently logged'in user has completed the training for this machine, or this machine does not require
    // a prior training, just redirect him to the machine's booking page
    if (machine.current_user_is_training || (machine.trainings.length === 0)) {
      return _this.$state.go('app.logged.machines_reserve', {id: machine.slug});
    } else {
      // otherwise, if a user is authenticated ...
      if (_this.$scope.isAuthenticated()) {
        // ... and have booked a training for this machine, tell him that he must wait for an admin to validate
        // the training before he can book the reservation
        if (machine.current_user_training_reservation) {
          return _this.$uibModal.open({
            templateUrl: '<%= asset_path "machines/training_reservation_modal.html" %>',
            controller: ['$scope', '$uibModalInstance', '$state', function($scope, $uibModalInstance, $state) {
              $scope.machine = machine;
              return $scope.cancel = () => $uibModalInstance.dismiss('cancel');
            }
            ]});
        // ... but does not have booked the training, tell him to register for a training session first
        // unless all associated trainings are disabled
        } else {
          // if all trainings are disabled, just redirect the user to the reservation calendar
          if (machine.trainings.map(t => t.disabled).reduce(((acc, val) => acc && val), true)) {
            return _this.$state.go('app.logged.machines_reserve', {id: machine.slug});
          // otherwise open the information modal
          } else {
            return _this.$uibModal.open({
              templateUrl: '<%= asset_path "machines/request_training_modal.html" %>',
              controller: ['$scope', '$uibModalInstance', '$state', function($scope, $uibModalInstance, $state) {
                $scope.machine = machine;
                $scope.member = _this.$scope.currentUser;

                // transform the name of the trainings associated with the machine to integrate them in a sentence
                $scope.humanizeTrainings = function() {
                  let text = '';
                  angular.forEach($scope.machine.trainings, function(training) {
                    if (text.length > 0) {
                      text += _this._t('machines_list._or_the_');
                    }
                    return text += training.name.substr(0,1).toLowerCase() + training.name.substr(1);
                  });
                  return text;
                };

                // modal is closed with validation
                $scope.ok = function() {
                  $state.go('app.logged.trainings_reserve', {id: $scope.machine.trainings[0].id});
                  return $uibModalInstance.close(machine);
                };

                // modal is closed with escaping
                return $scope.cancel = function(e){
                  e.preventDefault();
                  return $uibModalInstance.dismiss('cancel');
                };
              }
              ]});
          }
        }


      // if the user is not logged, open the login modal window
      } else {
        return _this.$scope.login();
      }
    }
  });
};




//#
// Controller used in the public listing page, allowing everyone to see the list of machines
//#
Application.Controllers.controller("MachinesController", ["$scope", "$state", '_t', 'Machine', '$uibModal', 'machinesPromise', function($scope, $state, _t, Machine, $uibModal, machinesPromise) {

//# Retrieve the list of machines
  $scope.machines = machinesPromise;

  //#
  // Redirect the user to the machine details page
  //#
  $scope.showMachine = machine => $state.go('app.public.machines_show', {id: machine.slug});

  //#
  // Callback to book a reservation for the current machine
  //#
  $scope.reserveMachine = _reserveMachine.bind({
    $scope,
    $state,
    _t,
    $uibModal,
    Machine
  });

  //# Default: we show only enabled machines
  $scope.machineFiltering = 'enabled';

  //# Available options for filtering machines by status
  return $scope.filterDisabled = [
    'enabled',
    'disabled',
    'all',
  ];
}
]);



//#
// Controller used in the machine creation page (admin)
//#
Application.Controllers.controller("NewMachineController", ["$scope", "$state", 'CSRF',function($scope, $state, CSRF) {
  CSRF.setMetaTags();

  //# API URL where the form will be posted
  $scope.actionUrl = "/api/machines/";

  //# Form action on the above URL
  $scope.method = "post";

  //# default machine parameters
  $scope.machine =
    {machine_files_attributes: []};

  //# Using the MachinesController
  return new MachinesController($scope, $state);
}
]);



//#
// Controller used in the machine edition page (admin)
//#
Application.Controllers.controller("EditMachineController", ["$scope", '$state', '$stateParams', 'machinePromise', 'CSRF', function($scope, $state, $stateParams, machinePromise, CSRF) {



  /* PUBLIC SCOPE */

  //# API URL where the form will be posted
  $scope.actionUrl = `/api/machines/${$stateParams.id}`;

  //# Form action on the above URL
  $scope.method = "put";

  //# Retrieve the details for the machine id in the URL, if an error occurs redirect the user to the machines list
  $scope.machine = machinePromise;



  /* PRIVATE SCOPE */

  //#
  // Kind of constructor: these actions will be realized first when the controller is loaded
  //#
  const initialize = function() {
    CSRF.setMetaTags();

    //# Using the MachinesController
    return new MachinesController($scope, $state);
  };


  //# !!! MUST BE CALLED AT THE END of the controller
  return initialize();
}
]);



//#
// Controller used in the machine details page (public)
//#
Application.Controllers.controller("ShowMachineController", ['$scope', '$state', '$uibModal', '$stateParams', '_t', 'Machine', 'growl', 'machinePromise', 'dialogs'
, function($scope, $state, $uibModal, $stateParams, _t, Machine, growl, machinePromise, dialogs) {

  //# Retrieve the details for the machine id in the URL, if an error occurs redirect the user to the machines list
  $scope.machine = machinePromise;

  //#
  // Callback to delete the current machine (admins only)
  //#
  $scope.delete = function(machine) {
    // check the permissions
    if ($scope.currentUser.role !== 'admin') {
      return console.error(_t('unauthorized_operation'));
    } else {
      return dialogs.confirm({
        resolve: {
          object() {
            return {
              title: _t('confirmation_required'),
              msg: _t('do_you_really_want_to_delete_this_machine')
            };
          }
        }
      }
      , () => // deletion confirmed
        // delete the machine then redirect to the machines listing
        machine.$delete(() => $state.go('app.public.machines_list')
        , error=> growl.warning(_t('the_machine_cant_be_deleted_because_it_is_already_reserved_by_some_users')))
      );
    }
  };



  //#
  // Callback to book a reservation for the current machine
  //#
  return $scope.reserveMachine = _reserveMachine.bind({
    $scope,
    $state,
    _t,
    $uibModal,
    Machine
  });
}
]);



//#
// Controller used in the machine reservation page (for logged users who have completed the training and admins).
// This controller workflow is pretty similar to the trainings reservation controller.
//#

Application.Controllers.controller("ReserveMachineController", ["$scope", '$stateParams', '_t', "moment", 'Auth', '$timeout', 'Member', 'Availability', 'plansPromise', 'groupsPromise', 'machinePromise', 'settingsPromise', 'uiCalendarConfig', 'CalendarConfig',
function($scope, $stateParams, _t, moment, Auth, $timeout, Member, Availability, plansPromise, groupsPromise, machinePromise, settingsPromise, uiCalendarConfig, CalendarConfig) {



  /* PRIVATE STATIC CONSTANTS */

  // Slot free to be booked
  const FREE_SLOT_BORDER_COLOR = '<%= AvailabilityHelper::MACHINE_COLOR %>';

  // Slot already booked by another user
  const UNAVAILABLE_SLOT_BORDER_COLOR = '<%= AvailabilityHelper::MACHINE_IS_RESERVED_BY_USER %>';

  // Slot already booked by the current user
  const BOOKED_SLOT_BORDER_COLOR = '<%= AvailabilityHelper::IS_RESERVED_BY_CURRENT_USER %>';



  /* PUBLIC SCOPE */

  //# bind the machine availabilities with full-Calendar events
  $scope.eventSources = [];

  //# indicates the state of the current view : calendar or plans information
  $scope.plansAreShown = false;

  //# will store the user's plan if he choosed to buy one
  $scope.selectedPlan = null;

  //# the moment when the plan selection changed for the last time, used to trigger changes in the cart
  $scope.planSelectionTime = null;

  //# mapping of fullCalendar events.
  $scope.events = {
    reserved: [], // Slots that the user wants to book
    modifiable: null, // Slot that the user wants to change
    placable: null, // Destination slot for the change
    paid: [], // Slots that were just booked by the user (transaction ok)
    moved: null // Slots that were just moved by the user (change done) -> {newSlot:* oldSlot: *}
  };

  //# the moment when the slot selection changed for the last time, used to trigger changes in the cart
  $scope.selectionTime = null;

  //# the last clicked event in the calender
  $scope.selectedEvent = null;

  //# the application global settings
  $scope.settings = settingsPromise;

  //# list of plans, classified by group
  $scope.plansClassifiedByGroup = [];
  for (let group of Array.from(groupsPromise)) {
    const groupObj = { id: group.id, name: group.name, plans: [] };
    for (let plan of Array.from(plansPromise)) {
      if (plan.group_id === group.id) { groupObj.plans.push(plan); }
    }
    $scope.plansClassifiedByGroup.push(groupObj);
  }

  //# the user to deal with, ie. the current user for non-admins
  $scope.ctrl =
    {member: {}};

  //# current machine to reserve
  $scope.machine = machinePromise;

  //# fullCalendar (v2) configuration
  $scope.calendarConfig = CalendarConfig({
    minTime: moment.duration(moment(settingsPromise.booking_window_start).format('HH:mm:ss')),
    maxTime: moment.duration(moment(settingsPromise.booking_window_end).format('HH:mm:ss')),
    eventClick(event, jsEvent, view) {
      return calendarEventClickCb(event, jsEvent, view);
    },
    eventRender(event, element, view) {
      return eventRenderCb(event, element);
    }
  });

  //# Global config: message to the end user concerning the subscriptions rules
  $scope.subscriptionExplicationsAlert = settingsPromise.subscription_explications_alert;

  //# Global config: message to the end user concerning the machine bookings
  $scope.machineExplicationsAlert = settingsPromise.machine_explications_alert;



  //#
  // Change the last selected slot's appearence to looks like 'added to cart'
  //#
  $scope.markSlotAsAdded = function() {
    $scope.selectedEvent.backgroundColor = FREE_SLOT_BORDER_COLOR;
    $scope.selectedEvent.title = _t('i_reserve');
    return updateCalendar();
  };



  //#
  // Change the last selected slot's appearence to looks like 'never added to cart'
  //#
  $scope.markSlotAsRemoved = function(slot) {
    slot.backgroundColor = 'white';
    slot.borderColor = FREE_SLOT_BORDER_COLOR;
    slot.title = '';
    slot.isValid = false;
    slot.id = null;
    slot.is_reserved = false;
    slot.can_modify = false;
    slot.offered = false;
    return updateCalendar();
  };



  //#
  // Callback when a slot was successfully cancelled. Reset the slot style as 'ready to book'
  //#
  $scope.slotCancelled = () => $scope.markSlotAsRemoved($scope.selectedEvent);



  //#
  // Change the last selected slot's appearence to looks like 'currently looking for a new destination to exchange'
  //#
  $scope.markSlotAsModifying = function() {
    $scope.selectedEvent.backgroundColor = '#eee';
    $scope.selectedEvent.title = _t('i_change');
    return updateCalendar();
  };



  //#
  // Change the last selected slot's appearence to looks like 'the slot being exchanged will take this place'
  //#
  $scope.changeModifyMachineSlot = function() {
    if ($scope.events.placable) {
      $scope.events.placable.backgroundColor = 'white';
      $scope.events.placable.title = '';
    }
    if (!$scope.events.placable || ($scope.events.placable._id !== $scope.selectedEvent._id)) {
      $scope.selectedEvent.backgroundColor = '#bbb';
      $scope.selectedEvent.title = _t('i_shift');
    }
    return updateCalendar();
  };



  //#
  // When modifying an already booked reservation, callback when the modification was successfully done.
  //#
  $scope.modifyMachineSlot = function() {
    $scope.events.placable.title = $scope.currentUser.role !== 'admin' ? _t('i_ve_reserved') : _t('not_available');
    $scope.events.placable.backgroundColor = 'white';
    $scope.events.placable.borderColor = $scope.events.modifiable.borderColor;
    $scope.events.placable.id = $scope.events.modifiable.id;
    $scope.events.placable.is_reserved = true;
    $scope.events.placable.can_modify = true;

    $scope.events.modifiable.backgroundColor = 'white';
    $scope.events.modifiable.title = '';
    $scope.events.modifiable.borderColor = FREE_SLOT_BORDER_COLOR;
    $scope.events.modifiable.id = null;
    $scope.events.modifiable.is_reserved = false;
    $scope.events.modifiable.can_modify = false;

    return updateCalendar();
  };



  //#
  // Cancel the current booking modification, reseting the whole process
  //#
  $scope.cancelModifyMachineSlot = function() {
    if ($scope.events.placable) {
      $scope.events.placable.backgroundColor = 'white';
      $scope.events.placable.title = '';
    }
    $scope.events.modifiable.title = $scope.currentUser.role !== 'admin' ? _t('i_ve_reserved') : _t('not_available');
    $scope.events.modifiable.backgroundColor = 'white';

    return updateCalendar();
  };



  //#
  // Callback to deal with the reservations of the user selected in the dropdown list instead of the current user's
  // reservations. (admins only)
  //#
  $scope.updateMember = function() {
    $scope.plansAreShown = false;
    $scope.selectedPlan = null;
    return Member.get({id: $scope.ctrl.member.id}, member => $scope.ctrl.member = member);
  };



  //#
  // Changes the user current view from the plan subsription screen to the machine reservation agenda
  // @param e {Object} see https://docs.angularjs.org/guide/expression#-event-
  //#
  $scope.doNotSubscribePlan = function(e){
    e.preventDefault();
    $scope.plansAreShown = false;
    $scope.selectPlan($scope.selectedPlan);
    return $scope.planSelectionTime = new Date();
  };



  //#
  // Switch the user's view from the reservation agenda to the plan subscription
  //#
  $scope.showPlans = () => $scope.plansAreShown = true;



  //#
  // Add the provided plan to the current shopping cart
  // @param plan {Object} the plan to subscribe
  //#
  $scope.selectPlan = function(plan) {
    // toggle selected plan
    if ($scope.selectedPlan !== plan) {
      $scope.selectedPlan = plan;
    } else {
      $scope.selectedPlan = null;
    }
    return $scope.planSelectionTime = new Date();
  };



  //#
  // Once the reservation is booked (payment process successfully completed), change the event style
  // in fullCalendar, update the user's subscription and free-credits if needed
  // @param reservation {Object}
  //#
  $scope.afterPayment = function(reservation){
    angular.forEach($scope.events.reserved, function(machineSlot, key) {
      machineSlot.is_reserved = true;
      machineSlot.can_modify = true;
      if ($scope.currentUser.role !== 'admin') {
        machineSlot.title = _t('i_ve_reserved');
        machineSlot.borderColor = BOOKED_SLOT_BORDER_COLOR;
        updateMachineSlot(machineSlot, reservation, $scope.currentUser);
      } else {
        machineSlot.title = _t('not_available');
        machineSlot.borderColor = UNAVAILABLE_SLOT_BORDER_COLOR;
        updateMachineSlot(machineSlot, reservation, $scope.ctrl.member);
      }
      return machineSlot.backgroundColor = 'white';
    });

    if ($scope.selectedPlan) {
      $scope.ctrl.member.subscribed_plan = angular.copy($scope.selectedPlan);
      Auth._currentUser.subscribed_plan = angular.copy($scope.selectedPlan);
      $scope.plansAreShown = false;
      $scope.selectedPlan = null;
    }

    return refetchCalendar();
  };



  //#
  // To use as callback in Array.prototype.filter to get only enabled plans
  //#
  $scope.filterDisabledPlans = plan => !plan.disabled;



  /* PRIVATE SCOPE */

  //#
  // Kind of constructor: these actions will be realized first when the controller is loaded
  //#
  const initialize = function() {
    Availability.machine({machineId: $stateParams.id}, availabilities =>
      $scope.eventSources.push({
        events: availabilities,
        textColor: 'black'
      })
    );

    if ($scope.currentUser.role !== 'admin') {
      return $scope.ctrl.member = $scope.currentUser;
    }
  };



  //#
  // Triggered when the user click on a reservation slot in the agenda.
  // Defines the behavior to adopt depending on the slot status (already booked, free, ready to be reserved ...),
  // the user's subscription (current or about to be took) and the time (the user cannot modify a booked reservation
  // if it's too late).
  //#
  var calendarEventClickCb = function(event, jsEvent, view) {
    $scope.selectedEvent = event;
    return $scope.selectionTime = new Date();
  };




  //#
  // Triggered when fullCalendar tries to graphicaly render an event block.
  // Append the event tag into the block, just after the event title.
  // @see http://fullcalendar.io/docs/event_rendering/eventRender/
  //#
  var eventRenderCb = function(event, element) {
    if (($scope.currentUser.role === 'admin') && (event.tags.length > 0)) {
      let html = '';
      for (let tag of Array.from(event.tags)) {
        html += `<span class='label label-success text-white' title='${tag.name}'>${tag.name}</span>`;
      }
      element.find('.fc-time').append(html);
    }
  };



  //#
  // After payment, update the id of the newly reserved slot with the id returned by the server.
  // This will allow the user to modify the reservation he just booked. The associated user will also be registered
  // with the slot.
  // @param slot {Object}
  // @param reservation {Object}
  // @param user {Object} user associated with the slot
  //#
  var updateMachineSlot = (slot, reservation, user)=>
    angular.forEach(reservation.slots, function(s){
      if (slot.start.isSame(s.start_at)) {
        slot.id = s.id;
        return slot.user = user;
      }
    })
  ;



  //#
  // Update the calendar's display to render the new attributes of the events
  //#
  var updateCalendar = () => uiCalendarConfig.calendars.calendar.fullCalendar('rerenderEvents');



  //#
  // Asynchronously fetch the events from the API and refresh the calendar's view with these new events
  //#
  var refetchCalendar = () =>
    $timeout(function() {
      uiCalendarConfig.calendars.calendar.fullCalendar('refetchEvents');
      return uiCalendarConfig.calendars.calendar.fullCalendar('rerenderEvents');
    })
  ;


  //# !!! MUST BE CALLED AT THE END of the controller
  return initialize();
}
]);
