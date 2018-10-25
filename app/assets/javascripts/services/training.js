/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';

Application.Services.factory('Training', ["$resource", $resource=>
  $resource("/api/trainings/:id",
    {id: "@id"}, {
    update: {
      method: 'PUT'
    },
    availabilities: {
      method: 'GET',
      url: "/api/trainings/:id/availabilities"
    }
  }
  )

]);
