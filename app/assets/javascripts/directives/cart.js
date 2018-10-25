/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Application.Directives.directive('cart', [ '$rootScope', '$uibModal', 'dialogs', 'growl', 'Auth', 'Price', 'Wallet', 'CustomAsset', 'Slot', 'helpers', '_t'
, ($rootScope, $uibModal, dialogs, growl, Auth, Price, Wallet, CustomAsset, Slot, helpers, _t) =>
  ({
    restrict: 'E',
    scope: {
      slot: '=',
      slotSelectionTime: '=',
      events: '=',
      user: '=',
      modePlans: '=',
      plan: '=',
      planSelectionTime: '=',
      settings: '=',
      onSlotAddedToCart: '=',
      onSlotRemovedFromCart: '=',
      onSlotStartToModify: '=',
      onSlotModifyDestination: '=',
      onSlotModifySuccess: '=',
      onSlotModifyCancel: '=',
      onSlotModifyUnselect: '=',
      onSlotCancelSuccess: '=',
      afterPayment: '=',
      reservableId: '@',
      reservableType: '@',
      reservableName: '@',
      limitToOneSlot: '@'
    },
    templateUrl: '<%= asset_path "shared/_cart.html" %>',
    link($scope, element, attributes) {
      //# will store the user's plan if he choosed to buy one
      $scope.selectedPlan = null;

      //# total amount of the bill to pay
      $scope.amountTotal = 0;

      //# total amount of the elements in the cart, without considering any coupon
      $scope.totalNoCoupon = 0;

      //# Discount coupon to apply to the basket, if any
      $scope.coupon =
        {applied: null};

      //# Global config: is the user authorized to change his bookings slots?
      $scope.enableBookingMove = ($scope.settings.booking_move_enable === "true");

      //# Global config: delay in hours before a booking while changing the booking slot is forbidden
      $scope.moveBookingDelay = parseInt($scope.settings.booking_move_delay);

      //# Global config: is the user authorized to cancel his bookings?
      $scope.enableBookingCancel = ($scope.settings.booking_cancel_enable === "true");

      //# Global config: delay in hours before a booking while the cancellation is forbidden
      $scope.cancelBookingDelay = parseInt($scope.settings.booking_cancel_delay);



      //#
      // Add the provided slot to the shopping cart (state transition from free to 'about to be reserved')
      // and increment the total amount of the cart if needed.
      // @param slot {Object} fullCalendar event object
      //#
      $scope.validateSlot = function(slot){
        slot.isValid = true;
        return updateCartPrice();
      };



      //#
      // Remove the provided slot from the shopping cart (state transition from 'about to be reserved' to free)
      // and decrement the total amount of the cart if needed.
      // @param slot {Object} fullCalendar event object
      // @param index {number} index of the slot in the reservation array
      // @param [event] {Object} see https://docs.angularjs.org/guide/expression#-event-
      //#
      $scope.removeSlot = function(slot, index, event){
        if (event) { event.preventDefault(); }
        $scope.events.reserved.splice(index, 1);
        // if is was the last slot, we remove any plan from the cart
        if ($scope.events.reserved.length === 0) {
          $scope.selectedPlan = null;
          $scope.plan = null;
          $scope.modePlans = false;
        }
        if (typeof $scope.onSlotRemovedFromCart === 'function') { $scope.onSlotRemovedFromCart(slot); }
        return updateCartPrice();
      };



      //#
      // Checks that every selected slots were added to the shopping cart. Ie. will return false if
      // any checked slot was not validated by the user.
      //#
      $scope.isSlotsValid = function() {
        let isValid = true;
        angular.forEach($scope.events.reserved, function(m){
          if (!m.isValid) { return isValid = false; }
        });
        return isValid;
      };



      //#
      // Switch the user's view from the reservation agenda to the plan subscription
      //#
      $scope.showPlans = function() {
        // first, we ensure that a user was selected (admin) or logged (member)
        if (Object.keys($scope.user).length > 0) {
          return $scope.modePlans = true;
        } else {
          // otherwise we alert, this error musn't occur when the current user hasn't the admin role
          return growl.error(_t('cart.please_select_a_member_first'));
        }
      };


      //#
      // Validates the shopping chart and redirect the user to the payment step
      //#
      $scope.payCart = function() {
        // first, we check that a user was selected
        if (Object.keys($scope.user).length > 0) {
          const reservation = mkReservation($scope.user, $scope.events.reserved, $scope.selectedPlan);

          return Wallet.getWalletByUser({user_id: $scope.user.id}, function(wallet) {
            const amountToPay = helpers.getAmountToPay($scope.amountTotal, wallet.amount);
            if (!$scope.isAdmin() && (amountToPay > 0)) {
              return payByStripe(reservation);
            } else {
              if ($scope.isAdmin() || (amountToPay === 0)) {
                return payOnSite(reservation);
              }
            }
          });
        } else {
          // otherwise we alert, this error musn't occur when the current user is not admin
          return growl.error(_t('cart.please_select_a_member_first'));
        }
      };


      //#
      // When modifying an already booked reservation, confirm the modification.
      //#
      $scope.modifySlot = () =>
        Slot.update({id: $scope.events.modifiable.id}, {
          slot: {
            start_at: $scope.events.placable.start,
            end_at: $scope.events.placable.end,
            availability_id: $scope.events.placable.availability_id
          }
        }
        , function() { // success
          // -> run the callback
          if (typeof $scope.onSlotModifySuccess === 'function') { $scope.onSlotModifySuccess(); }
          // -> set the events as successfully moved (to display a summary)
          $scope.events.moved = {
            newSlot: $scope.events.placable,
            oldSlot: $scope.events.modifiable
          };
          // -> reset the 'moving' status
          $scope.events.placable = null;
          return $scope.events.modifiable = null;
        }
        , function(err) {  // failure
          growl.error(_t('cart.unable_to_change_the_reservation'));
          return console.error(err);
        })
      ;



      //#
      // Cancel the current booking modification, reseting the whole process
      // @param event {Object} see https://docs.angularjs.org/guide/expression#-event-
      //#
      $scope.cancelModifySlot = function(event) {
        if (event) { event.preventDefault(); }
        if (typeof $scope.onSlotModifyCancel === 'function') { $scope.onSlotModifyCancel(); }
        $scope.events.placable = null;
        return $scope.events.modifiable = null;
      };



      //#
      // When modifying an already booked reservation, cancel the choice of the new slot
      // @param e {Object} see https://docs.angularjs.org/guide/expression#-event-
      //#
      $scope.removeSlotToPlace = function(e){
        e.preventDefault();
        if (typeof $scope.onSlotModifyUnselect === 'function') { $scope.onSlotModifyUnselect(); }
        return $scope.events.placable = null;
      };



      //#
      // Checks if $scope.events.modifiable and $scope.events.placable have tag incompatibilities
      // @returns {boolean} true in case of incompatibility
      //#
      $scope.tagMissmatch = function() {
        if ($scope.events.placable.tag_ids.length === 0) { return false; }
        for (let tag of Array.from($scope.events.modifiable.tags)) {
          if (!Array.from($scope.events.placable.tag_ids).includes(tag.id)) {
            return true;
          }
        }
        return false;
      };



      //#
      // Check if the currently logged user has teh 'admin' role?
      // @returns {boolean}
      //#
      $scope.isAdmin = () => $rootScope.currentUser && ($rootScope.currentUser.role === 'admin');



      /* PRIVATE SCOPE */

      //#
      // Kind of constructor: these actions will be realized first when the directive is loaded
      //#
      const initialize = function() {
        // What the binded slot
        $scope.$watch('slotSelectionTime', function(newValue, oldValue) {
          if (newValue !== oldValue) {
            return slotSelectionChanged();
          }
        });
        $scope.$watch('user', function(newValue, oldValue) {
          if (newValue !== oldValue) {
            resetCartState();
            return updateCartPrice();
          }
        });
        $scope.$watch('planSelectionTime', function(newValue, oldValue) {
          if (newValue !== oldValue) {
            return planSelectionChanged();
          }
        });
        // watch when a coupon is applied to re-compute the total price
        return $scope.$watch('coupon.applied', function(newValue, oldValue) {
          if ((newValue !== null) || (oldValue !== null)) {
            return updateCartPrice();
          }
        });
      };



      //#
      // Callback triggered when the selected slot changed
      //#
      var slotSelectionChanged = function() {
        if ($scope.slot) {
          if (!$scope.slot.is_reserved && !$scope.events.modifiable && !$scope.slot.is_completed) {
            // slot is not reserved and we are not currently modifying a slot
            // -> can be added to cart or removed if already present
            const index = $scope.events.reserved.indexOf($scope.slot);
            if (index === -1) {
              if (($scope.limitToOneSlot === 'true') && $scope.events.reserved[0]) {
                // if we limit the number of slots in the cart to 1, and there is already
                // a slot in the cart, we remove it before adding the new one
                $scope.removeSlot($scope.events.reserved[0], 0);
              }
              // slot is not in the cart, so we add it
              $scope.events.reserved.push($scope.slot);
              if (typeof $scope.onSlotAddedToCart === 'function') { $scope.onSlotAddedToCart(); }
            } else {
              // slot is in the cart, remove it
              $scope.removeSlot($scope.slot, index);
            }
            // in every cases, because a new reservation has started, we reset the cart content
            resetCartState();
            // finally, we update the prices
            return updateCartPrice();
          } else if (!$scope.slot.is_reserved && !$scope.slot.is_completed && $scope.events.modifiable) {
            // slot is not reserved but we are currently modifying a slot
            // -> we request the calender to change the rendering
            if (typeof $scope.onSlotModifyUnselect === 'function') { $scope.onSlotModifyUnselect(); }
            // -> then, we re-affect the destination slot
            if (!$scope.events.placable || ($scope.events.placable._id !== $scope.slot._id)) {
              return $scope.events.placable = $scope.slot;
            } else {
              return $scope.events.placable = null;
            }
          } else if ($scope.slot.is_reserved && $scope.events.modifiable && ($scope.slot.is_reserved._id === $scope.events.modifiable._id)) {
            // slot is reserved and currently modified
            // -> we cancel the modification
            return $scope.cancelModifySlot();
          } else if ($scope.slot.is_reserved && (slotCanBeModified($scope.slot) || slotCanBeCanceled($scope.slot)) && !$scope.events.modifiable && ($scope.events.reserved.length === 0)) {
            // slot is reserved and is ok to be modified or cancelled
            // but we are not currently running a modification or having any slots in the cart
            // -> first the affect the modification/cancellation rights attributes to the current slot
            resetCartState();
            $scope.slot.movable = slotCanBeModified($scope.slot);
            $scope.slot.cancelable = slotCanBeCanceled($scope.slot);
            // -> then, we open a dialog to ask to the user to choose an action
            return dialogs.confirm({
              templateUrl: '<%= asset_path "shared/confirm_modify_slot_modal.html" %>',
              resolve: {
                object() { return $scope.slot; }
              }
            }
            , function(type) {
              // the user has choosen an action, so we proceed
              if (type === 'move') {
                if (typeof $scope.onSlotStartToModify === 'function') { $scope.onSlotStartToModify(); }
                return $scope.events.modifiable = $scope.slot;
              } else if (type === 'cancel') {
                return dialogs.confirm({
                  resolve: {
                    object() {
                      return {
                        title: _t('cart.confirmation_required'),
                        msg: _t('cart.do_you_really_want_to_cancel_this_reservation')
                      };
                    }
                  }
                }
                , () => // cancel confirmed
                  Slot.cancel({id: $scope.slot.id}, function() { // successfully canceled
                    growl.success(_t('cart.reservation_was_cancelled_successfully'));
                    if (typeof $scope.onSlotCancelSuccess === 'function') { return $scope.onSlotCancelSuccess(); }
                  }
                  , () => // error while canceling
                    growl.error(_t('cart.cancellation_failed'))
                  )
                );
              }
            });
          }
        }
      };



      //#
      // Reset the parameters that may lead to a wrong price but leave the content (events added to cart)
      //#
      var resetCartState = function() {
        $scope.selectedPlan = null;
        $scope.coupon.applied = null;
        $scope.events.moved = null;
        $scope.events.paid = [];
        $scope.events.modifiable = null;
        return $scope.events.placable = null;
      };



      //#
      // Determines if the provided booked slot is able to be modified by the user.
      // @param slot {Object} fullCalendar event object
      //#
      var slotCanBeModified = function(slot){
        if ($scope.isAdmin()) { return true; }
        const slotStart = moment(slot.start);
        const now = moment();
        if (slot.can_modify && $scope.enableBookingMove && (slotStart.diff(now, "hours") >= $scope.moveBookingDelay)) {
          return true;
        } else {
          return false;
        }
      };



      //#
      // Determines if the provided booked slot is able to be canceled by the user.
      // @param slot {Object} fullCalendar event object
      //#
      var slotCanBeCanceled = function(slot) {
        if ($scope.isAdmin()) { return true; }
        const slotStart = moment(slot.start);
        const now = moment();
        if (slot.can_modify && $scope.enableBookingCancel && (slotStart.diff(now, "hours") >= $scope.cancelBookingDelay)) {
          return true;
        } else {
          return false;
        }
      };



      //#
      // Callback triggered when the selected slot changed
      //#
      var planSelectionChanged = function() {
        if (Auth.isAuthenticated()) {
          if ($scope.selectedPlan !== $scope.plan) {
            $scope.selectedPlan = $scope.plan;
          } else {
            $scope.selectedPlan = null;
          }
          return updateCartPrice();
        } else {
          return $rootScope.login(null, function() {
            $scope.selectedPlan = $scope.plan;
            return updateCartPrice();
          });
        }
      };


      //#
      // Update the total price of the current selection/reservation
      //#
      var updateCartPrice = function() {
        if (Object.keys($scope.user).length > 0) {
          const r = mkReservation($scope.user, $scope.events.reserved, $scope.selectedPlan);
          return Price.compute(mkRequestParams(r, $scope.coupon.applied), function(res) {
            $scope.amountTotal = res.price;
            $scope.totalNoCoupon = res.price_without_coupon;
            return setSlotsDetails(res.details);
          });
        } else {
          // otherwise we alert, this error musn't occur when the current user is not admin
          growl.warning(_t('cart.please_select_a_member_first'));
          return $scope.amountTotal = null;
        }
      };


      var setSlotsDetails = details =>
        angular.forEach($scope.events.reserved, slot =>
          angular.forEach(details.slots, function(s) {
            if (moment(s.start_at).isSame(slot.start)) {
              slot.promo = s.promo;
              return slot.price = s.price;
            }
          })
        )
      ;


      //#
      // Format the parameters expected by /api/prices/compute or /api/reservations and return the resulting object
      // @param reservation {Object} as returned by mkReservation()
      // @param coupon {Object} Coupon as returned from the API
      // @return {{reservation:Object, coupon_code:string}}
      //#
      var mkRequestParams = function(reservation, coupon) {
        const params = {
          reservation,
          coupon_code: ((coupon ? coupon.code : undefined))
        };

        return params;
      };



      //#
      // Create an hash map implementing the Reservation specs
      // @param member {Object} User as retreived from the API: current user / selected user if current is admin
      // @param slots {Array<Object>} Array of fullCalendar events: slots selected on the calendar
      // @param [plan] {Object} Plan as retrived from the API: plan to buy with the current reservation
      // @return {{user_id:Number, reservable_id:Number, reservable_type:String, slots_attributes:Array<Object>, plan_id:Number|null}}
      //#
      var mkReservation = function(member, slots, plan = null) {
        const reservation = {
          user_id: member.id,
          reservable_id: $scope.reservableId,
          reservable_type: $scope.reservableType,
          slots_attributes: [],
          plan_id: ((plan ? plan.id : undefined))
        };
        angular.forEach(slots, (slot, key) =>
          reservation.slots_attributes.push({
            start_at: slot.start,
            end_at: slot.end,
            availability_id: slot.availability_id,
            offered: slot.offered || false
          })
        );

        return reservation;
      };



      //#
      // Open a modal window that allows the user to process a credit card payment for his current shopping cart.
      //#
      var payByStripe = reservation =>
        $uibModal.open({
          templateUrl: '<%= asset_path "stripe/payment_modal.html" %>',
          size: 'md',
          resolve: {
            reservation() {
              return reservation;
            },
            price() {
              return Price.compute(mkRequestParams(reservation, $scope.coupon.applied)).$promise;
            },
            wallet() {
              return Wallet.getWalletByUser({user_id: reservation.user_id}).$promise;
            },
            cgv() {
              return CustomAsset.get({name: 'cgv-file'}).$promise;
            },
            coupon() {
              return $scope.coupon.applied;
            }
          },
          controller: ['$scope', '$uibModalInstance', '$state', 'reservation', 'price', 'cgv', 'Auth', 'Reservation', 'wallet', 'helpers', '$filter', 'coupon',
            function($scope, $uibModalInstance, $state, reservation, price, cgv, Auth, Reservation, wallet, helpers, $filter, coupon) {
              // user wallet amount
              $scope.walletAmount = wallet.amount;

              // Price
              $scope.amount = helpers.getAmountToPay(price.price, wallet.amount);

              // CGV
              $scope.cgv = cgv.custom_asset;

              // Reservation
              $scope.reservation = reservation;

              // Used in wallet info template to interpolate some translations
              $scope.numberFilter = $filter('number');

              //#
              // Callback to process the payment with Stripe, triggered on button click
              //#
              return $scope.payment = function(status, response) {
                if (response.error) {
                  return growl.error(response.error.message);
                } else {
                  $scope.attempting = true;
                  $scope.reservation.card_token = response.id;
                  return Reservation.save(mkRequestParams($scope.reservation, coupon), reservation => $uibModalInstance.close(reservation)
                  , function(response){
                    $scope.alerts = [];
                    if (response.status === 500) {
                      $scope.alerts.push({
                        msg: response.statusText,
                        type: 'danger'
                      });
                    } else {
                      if (response.data.card && (response.data.card.join('').length > 0)) {
                        $scope.alerts.push({
                          msg: response.data.card.join('. '),
                          type: 'danger'
                        });
                      } else if (response.data.payment && (response.data.payment.join('').length > 0)) {
                        $scope.alerts.push({
                          msg: response.data.payment.join('. '),
                          type: 'danger'
                        });
                      }
                    }
                    return $scope.attempting = false;
                  });
                }
              };
            }
          ]})
        .result['finally'](null).then(reservation=> afterPayment(reservation))
      ;



      //#
      // Open a modal window that allows the user to process a local payment for his current shopping cart (admin only).
      //#
      var payOnSite = reservation =>
        $uibModal.open({
          templateUrl: '<%= asset_path "shared/valid_reservation_modal.html" %>',
          size: 'sm',
          resolve: {
            reservation() {
              return reservation;
            },
            price() {
              return Price.compute(mkRequestParams(reservation, $scope.coupon.applied)).$promise;
            },
            wallet() {
              return Wallet.getWalletByUser({user_id: reservation.user_id}).$promise;
            },
            coupon() {
              return $scope.coupon.applied;
            }
          },
          controller: ['$scope', '$uibModalInstance', '$state', 'reservation', 'price', 'Auth', 'Reservation', 'wallet', 'helpers', '$filter', 'coupon',
            function($scope, $uibModalInstance, $state, reservation, price, Auth, Reservation, wallet, helpers, $filter, coupon) {

              // user wallet amount
              $scope.walletAmount = wallet.amount;

              // Global price (total of all items)
              $scope.price = price.price;

              // Price to pay (wallet deducted)
              $scope.amount = helpers.getAmountToPay(price.price, wallet.amount);

              // Reservation
              $scope.reservation = reservation;

              // Used in wallet info template to interpolate some translations
              $scope.numberFilter = $filter('number');

              // Button label
              if ($scope.amount > 0) {
                $scope.validButtonName = _t('cart.confirm_payment_of_html', {ROLE:$rootScope.currentUser.role, AMOUNT:$filter('currency')($scope.amount)}, "messageformat");
              } else {
                if ((price.price > 0) && ($scope.walletAmount === 0)) {
                  $scope.validButtonName = _t('cart.confirm_payment_of_html', {ROLE:$rootScope.currentUser.role, AMOUNT:$filter('currency')(price.price)}, "messageformat");
                } else {
                  $scope.validButtonName = _t('confirm');
                }
              }

              //#
              // Callback to process the local payment, triggered on button click
              //#
              $scope.ok = function() {
                $scope.attempting = true;
                return Reservation.save(mkRequestParams($scope.reservation, coupon), function(reservation) {
                  $uibModalInstance.close(reservation);
                  return $scope.attempting = true;
                }
                , function(response){
                  $scope.alerts = [];
                  $scope.alerts.push({msg: _t('cart.a_problem_occured_during_the_payment_process_please_try_again_later'), type: 'danger' });
                  return $scope.attempting = false;
                });
              };
              return $scope.cancel = () => $uibModalInstance.dismiss('cancel');
            }
          ]})
        .result['finally'](null).then(reservation=> afterPayment(reservation))
      ;



      //#
      // Actions to run after the payment was successfull
      //#
      var afterPayment = function(reservation) {
        // we set the cart content as 'paid' to display a summary of the transaction
        $scope.events.paid = $scope.events.reserved;
        // we call the external callback if present
        if (typeof $scope.afterPayment === 'function') { $scope.afterPayment(reservation); }
        // we reset the coupon and the cart content and we unselect the slot
        $scope.events.reserved = [];
        $scope.coupon.applied = null;
        $scope.slot = null;
        return $scope.selectedPlan = null;
      };



      //# !!! MUST BE CALLED AT THE END of the directive
      return initialize();
    }
  })

]);


