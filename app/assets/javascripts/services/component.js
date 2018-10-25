/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';

Application.Services.factory('Component', ["$resource", $resource=>
  $resource("/api/components/:id",
    {id: "@id"}, {
    update: {
      method: 'PUT'
    }
  }
  )

]);
